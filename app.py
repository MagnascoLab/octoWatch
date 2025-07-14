#!/usr/bin/env python3
from flask import Flask, render_template, request, jsonify, send_from_directory
import os
import json
from pathlib import Path

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['MAX_CONTENT_LENGTH'] = 2 * 1024 * 1024 * 1024  # 2GB max file size
app.config['SEND_FILE_MAX_AGE_DEFAULT'] = 0

# Ensure upload directory exists
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/upload', methods=['POST'])
def upload_files():
    if 'video' not in request.files or 'keyframes' not in request.files:
        return jsonify({'error': 'Both video and keyframes files are required'}), 400
    
    video_file = request.files['video']
    keyframes_file = request.files['keyframes']
    
    if video_file.filename == '' or keyframes_file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    
    # Save files
    video_filename = f"video_{os.urandom(8).hex()}{Path(video_file.filename).suffix}"
    keyframes_filename = f"keyframes_{os.urandom(8).hex()}.json"
    
    video_path = os.path.join(app.config['UPLOAD_FOLDER'], video_filename)
    keyframes_path = os.path.join(app.config['UPLOAD_FOLDER'], keyframes_filename)
    
    video_file.save(video_path)
    keyframes_file.save(keyframes_path)
    
    # Load and validate keyframes JSON
    try:
        with open(keyframes_path, 'r') as f:
            keyframes_data = json.load(f)
    except json.JSONDecodeError:
        return jsonify({'error': 'Invalid JSON file'}), 400
    
    return jsonify({
        'video_url': f'/uploads/{video_filename}',
        'keyframes': keyframes_data
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

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5172)