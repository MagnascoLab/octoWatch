#!/usr/bin/env python3
from flask import Flask, render_template, request, jsonify, send_from_directory, Response, stream_with_context
import os
import json
from pathlib import Path
import time
import queue
import subprocess
import sys
from detection_manager import detection_manager

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['MAX_CONTENT_LENGTH'] = 8 * 1024 * 1024 * 1024  # 8GB max file size
app.config['SEND_FILE_MAX_AGE_DEFAULT'] = 0

# Ensure upload directory exists
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/upload-video', methods=['POST'])
def upload_video():
    if 'video' not in request.files:
        return jsonify({'error': 'Video file is required'}), 400
    
    video_file = request.files['video']
    
    if video_file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    
    # Find the next available MVI index
    videos_dir = Path('videos')
    os.makedirs(videos_dir, exist_ok=True)
    
    # Get all existing MVI codes
    existing_codes = set()
    for video_path in videos_dir.glob('MVI_*_proxy.[mM][pP]4'):
        code = video_path.stem.split('_')[1]  # MVI_XXXX_proxy -> XXXX
        if code.isdigit():
            existing_codes.add(int(code))
    
    # Find the next available code (starting from 0001)
    next_code = 1
    while next_code in existing_codes and next_code <= 9999:
        next_code += 1
    
    if next_code > 9999:
        return jsonify({'error': 'Maximum video limit reached (9999)'}), 400
    
    # Format code as 4-digit string
    code = f"{next_code:04d}"
    
    # Save video with MVI naming convention
    video_extension = Path(video_file.filename).suffix.lower()
    video_filename = f"MVI_{code}_proxy{video_extension}"
    video_path = videos_dir / video_filename
    
    video_file.save(str(video_path))
    
    return jsonify({
        'code': code,
        'video_filename': video_filename,
        'message': f'Video uploaded successfully with code {code}. You can now run detection.'
    })

@app.route('/uploads/<filename>')
def uploaded_file(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

@app.route('/videos/<filename>')
def video_file(filename):
    return send_from_directory('videos', filename)

@app.route('/load-by-code/<code>')
def load_by_code(code):
    # Validate code is 4 digits
    if not code.isdigit() or len(code) != 4:
        return jsonify({'error': 'Invalid code format. Must be 4 digits.'}), 400
    
    # Define the base paths
    keyframes_dir = Path('videos_keyframes')
    video_dir = Path('videos')
    
    # Construct file paths
    keyframes_filename = f'MVI_{code}_keyframes.json'
    keyframes_path = keyframes_dir / keyframes_filename
    
    # Check for video file with both .mp4 and .MP4 extensions
    video_filename_lower = f'MVI_{code}_proxy.mp4'
    video_filename_upper = f'MVI_{code}_proxy.MP4'
    
    video_path = None
    if (video_dir / video_filename_lower).exists():
        video_path = video_dir / video_filename_lower
    elif (video_dir / video_filename_upper).exists():
        video_path = video_dir / video_filename_upper
    
    # Check if files exist
    if not keyframes_path.exists():
        return jsonify({'error': f'Keyframes file not found for code {code}'}), 404
    
    if not video_path:
        return jsonify({'error': f'Video file not found for code {code}'}), 404
    
    # Load keyframes data
    try:
        with open(keyframes_path, 'r') as f:
            keyframes_data = json.load(f)
    except json.JSONDecodeError:
        return jsonify({'error': 'Invalid keyframes JSON file'}), 400
    
    # Use the existing video path directly
    return jsonify({
        'video_url': f'/{video_path}',
        'keyframes': keyframes_data
    })

@app.route('/check-keyframes/<code>')
def check_keyframes(code):
    """Check if keyframes exist for a video code"""
    if not code.isdigit() or len(code) != 4:
        return jsonify({'error': 'Invalid code format'}), 400
    
    keyframes_path = Path('videos_keyframes') / f'MVI_{code}_keyframes.json'
    video_path_lower = Path('videos') / f'MVI_{code}_proxy.mp4'
    video_path_upper = Path('videos') / f'MVI_{code}_proxy.MP4'
    
    has_video = video_path_lower.exists() or video_path_upper.exists()
    has_keyframes = keyframes_path.exists()
    
    return jsonify({
        'has_video': has_video,
        'has_keyframes': has_keyframes
    })

@app.route('/start-detection/<code>', methods=['POST'])
def start_detection(code):
    """Start YOLO detection for a video"""
    if not code.isdigit() or len(code) != 4:
        return jsonify({'error': 'Invalid code format'}), 400
    
    # Check if video exists
    video_path_lower = Path('videos') / f'MVI_{code}_proxy.mp4'
    video_path_upper = Path('videos') / f'MVI_{code}_proxy.MP4'
    
    if not (video_path_lower.exists() or video_path_upper.exists()):
        return jsonify({'error': 'Video not found'}), 404
    
    # Get detection parameters from request
    params = request.get_json() or {}
    
    # Start detection job
    job_id = detection_manager.start_detection(code, params)
    
    return jsonify({
        'job_id': job_id,
        'status': 'started'
    })

@app.route('/detection-progress/<job_id>')
def detection_progress(job_id):
    """SSE endpoint for detection progress"""
    def generate():
        progress_queue = detection_manager.get_progress_queue(job_id)
        if not progress_queue:
            yield 'data: {"type": "error", "message": "Invalid job ID"}\n\n'
            return
        
        while True:
            try:
                # Get progress update with timeout
                progress = progress_queue.get(timeout=1.0)
                yield f'data: {json.dumps(progress)}\n\n'
                
                # End stream if complete or error
                if progress.get('type') in ['complete', 'error']:
                    break
                    
            except queue.Empty:
                # Send heartbeat
                yield 'data: {"type": "heartbeat"}\n\n'
            
            # Check if job was cancelled
            status = detection_manager.get_job_status(job_id)
            if status == 'cancelled':
                yield 'data: {"type": "cancelled", "message": "Detection cancelled"}\n\n'
                break
    
    return Response(
        stream_with_context(generate()),
        mimetype='text/event-stream',
        headers={
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no'  # Disable Nginx buffering
        }
    )

@app.route('/cancel-detection/<job_id>', methods=['POST'])
def cancel_detection(job_id):
    """Cancel a running detection job"""
    success = detection_manager.cancel_job(job_id)
    if success:
        return jsonify({'status': 'cancelled'})
    else:
        return jsonify({'error': 'Job not found or already completed'}), 404

@app.route('/list-available-codes')
def list_available_codes():
    """List all available video codes and their keyframe status"""
    videos_dir = Path('videos')
    keyframes_dir = Path('videos_keyframes')
    
    # Find all video files
    video_files = {}
    for video_path in videos_dir.glob('MVI_*_proxy.[mM][pP]4'):
        # Extract code from filename
        code = video_path.stem.split('_')[1]  # MVI_XXXX_proxy -> XXXX
        video_files[code] = True
    
    # Check for corresponding keyframes
    codes_info = []
    for code in sorted(video_files.keys()):
        keyframes_path = keyframes_dir / f'MVI_{code}_keyframes.json'
        codes_info.append({
            'code': code,
            'has_video': True,
            'has_keyframes': keyframes_path.exists()
        })
    
    return jsonify({'codes': codes_info})

import os

if __name__ == '__main__':
    if getattr(sys, 'frozen', False):
        app.run(host='127.0.0.1', port=5172, debug=False, use_reloader=False)
    else:
        # Just try to run - Flask will error clearly if port is taken
        app.run(debug=True, host='0.0.0.0', port=5172)