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
import re

# Store mapping of MVI codes to original uploaded filenames
VIDEO_UPLOAD_MAPPING = {}
MAPPING_FILE = Path('videos_keyframes/upload_mapping.json')

def load_upload_mapping():
    """Load the upload mapping from persistent storage"""
    global VIDEO_UPLOAD_MAPPING
    if MAPPING_FILE.exists():
        try:
            with open(MAPPING_FILE, 'r') as f:
                VIDEO_UPLOAD_MAPPING = json.load(f)
        except Exception as e:
            print(f"Error loading upload mapping: {e}")
            VIDEO_UPLOAD_MAPPING = {}
    else:
        VIDEO_UPLOAD_MAPPING = {}

def save_upload_mapping():
    """Save the upload mapping to persistent storage"""
    try:
        MAPPING_FILE.parent.mkdir(parents=True, exist_ok=True)
        with open(MAPPING_FILE, 'w') as f:
            json.dump(VIDEO_UPLOAD_MAPPING, f, indent=2)
    except Exception as e:
        print(f"Error saving upload mapping: {e}")

def calculate_iou(box1, box2):
    """Calculate Intersection over Union between two bounding boxes"""
    if not box1 or not box2:
        return 0.0
    
    # Calculate intersection
    x_min = max(box1['x_min'], box2['x_min'])
    y_min = max(box1['y_min'], box2['y_min'])
    x_max = min(box1['x_max'], box2['x_max'])
    y_max = min(box1['y_max'], box2['y_max'])
    
    if x_max < x_min or y_max < y_min:
        return 0.0
    
    intersection_area = (x_max - x_min) * (y_max - y_min)
    
    # Calculate union
    box1_area = (box1['x_max'] - box1['x_min']) * (box1['y_max'] - box1['y_min'])
    box2_area = (box2['x_max'] - box2['x_min']) * (box2['y_max'] - box2['y_min'])
    union_area = box1_area + box2_area - intersection_area
    
    if union_area == 0:
        return 0.0
    
    return intersection_area / union_area

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['MAX_CONTENT_LENGTH'] = 8 * 1024 * 1024 * 1024  # 8GB max file size
app.config['SEND_FILE_MAX_AGE_DEFAULT'] = 0

# Ensure upload directory exists
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
os.makedirs('videos', exist_ok=True)
os.makedirs('videos_keyframes', exist_ok=True)

# Load the upload mapping on startup
load_upload_mapping()

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
    
    # Try to extract a 4-digit code from the uploaded filename
    code_from_filename = None
    # Look for any 4-digit sequence surrounded by non-digits (or at string boundaries)
    matches = re.findall(r'(?:^|\D)(\d{4})(?:\D|$)', video_file.filename)
    
    if matches:
        # Use the first 4-digit code found
        potential_code = int(matches[0])
        # Check if this code is available
        if potential_code not in existing_codes and 1 <= potential_code <= 9999:
            code_from_filename = f"{potential_code:04d}"
    
    if code_from_filename:
        # Use the code from filename
        code = code_from_filename
    else:
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
    
    # Store the mapping of MVI code to original filename
    VIDEO_UPLOAD_MAPPING[code] = {
        'original_filename': video_file.filename,
        'uploaded_filename': video_filename,
        'upload_timestamp': time.time()
    }
    save_upload_mapping()
    
    return jsonify({
        'code': code,
        'video_filename': video_filename,
        'original_filename': video_file.filename,
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
    
    # Check if existing keyframes have experiment type flags
    experiment_type = None
    if has_keyframes:
        try:
            with open(keyframes_path, 'r') as f:
                keyframes_data = json.load(f)
                # Check if detection_params has experiment type flags
                if 'detection_params' in keyframes_data:
                    params = keyframes_data['detection_params']
                    if params.get('is_mirror', False):
                        experiment_type = 'mirror'
                    elif params.get('is_social', False):
                        experiment_type = 'social'
                    elif params.get('is_control', False):
                        experiment_type = 'control'
        except (json.JSONDecodeError, IOError):
            # If we can't read the file, default to None
            pass
    
    return jsonify({
        'has_video': has_video,
        'has_keyframes': has_keyframes,
        'experiment_type': experiment_type
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
    
    # Check for corresponding keyframes and mirror status
    codes_info = []
    for code in sorted(video_files.keys()):
        keyframes_path = keyframes_dir / f'MVI_{code}_keyframes.json'
        has_keyframes = keyframes_path.exists()
        
        # Check if existing keyframes have experiment type flags
        experiment_type = None
        if has_keyframes:
            try:
                with open(keyframes_path, 'r') as f:
                    keyframes_data = json.load(f)
                    # Check if detection_params has experiment type flags
                    if 'detection_params' in keyframes_data:
                        params = keyframes_data['detection_params']
                        if params.get('is_mirror', False):
                            experiment_type = 'mirror'
                        elif params.get('is_social', False):
                            experiment_type = 'social'
                        elif params.get('is_control', False):
                            experiment_type = 'control'
            except (json.JSONDecodeError, IOError):
                # If we can't read the file, default to None
                pass
        
        codes_info.append({
            'code': code,
            'has_video': True,
            'has_keyframes': has_keyframes,
            'experiment_type': experiment_type
        })
    
    return jsonify({'codes': codes_info})

@app.route('/delete-keyframes/<code>', methods=['POST'])
def delete_keyframes(code):
    """Delete keyframes within a specified time range"""
    # Validate code format (4 digits)
    if not code.isdigit() or len(code) != 4:
        return jsonify({'error': 'Invalid code format'}), 400
    
    # Get request data
    data = request.get_json()
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    start_time = data.get('start_time')
    end_time = data.get('end_time')
    start_frame = data.get('start_frame')
    end_frame = data.get('end_frame')
    side = data.get('side', 'both')  # Default to 'both' if not specified
    method = data.get('method', 'delete')  # Default to 'delete' if not specified
    bbox_update = None
    if method == "edit":
        bbox_update = data.get('bbox_update')
    if start_time is None or end_time is None:
        return jsonify({'error': 'start_time and end_time are required'}), 400
    
    # Load keyframes file
    keyframes_path = Path('videos_keyframes') / f'MVI_{code}_keyframes.json'
    if not keyframes_path.exists():
        return jsonify({'error': 'Keyframes file not found'}), 404
    
    try:
        with open(keyframes_path, 'r') as f:
            keyframes_data = json.load(f)
    except Exception as e:
        return jsonify({'error': f'Failed to load keyframes: {str(e)}'}), 500
    
    # Create backup before deletion
    import shutil
    from datetime import datetime
    backup_path = keyframes_path.with_suffix(f'.backup_{datetime.now().strftime("%Y%m%d_%H%M%S")}.json')
    shutil.copy2(keyframes_path, backup_path)
    
    # Count affected keyframes before processing
    affected_count = 0
    deleted_left = 0
    deleted_right = 0
    infilled_left = 0
    infilled_right = 0
    edited_left = 0
    edited_right = 0
    
    if method == 'delete':
        # Original deletion logic
        if 'keyframes' in keyframes_data:
            for frame_key, frame_data in keyframes_data['keyframes'].items():
                timestamp = frame_data.get('timestamp', 0)
                
                # Check if timestamp is within range
                if start_time <= timestamp <= end_time:
                    # Delete based on side selection
                    if side == 'both' or side == 'left':
                        if frame_data.get('left_detections'):
                            deleted_left += len(frame_data['left_detections'])
                            frame_data['left_detections'] = []
                            frame_data['has_left_octopus'] = False
                            affected_count += 1
                    
                    if side == 'both' or side == 'right':
                        if frame_data.get('right_detections'):
                            deleted_right += len(frame_data['right_detections'])
                            frame_data['right_detections'] = []
                            frame_data['has_right_octopus'] = False
                            affected_count += 1
    
    elif method == 'infill':
        # Infill interpolation logic
        if 'keyframes' in keyframes_data:
            # Helper function to find boundary keyframes with detections
            def find_boundary_keyframes(side_key):
                prev_frame = None
                next_frame = None
                prev_timestamp = None
                next_timestamp = None
                
                # Sort keyframe keys by frame number
                sorted_frames = sorted(keyframes_data['keyframes'].items(), 
                                     key=lambda x: int(x[0]))
                
                # Find previous frame with detection
                for frame_key, frame_data in sorted_frames:
                    timestamp = frame_data.get('timestamp', 0)
                    if timestamp < start_time and frame_data.get(f'{side_key}_detections'):
                        prev_frame = frame_data
                        prev_timestamp = timestamp
                
                # Find next frame with detection
                for frame_key, frame_data in sorted_frames:
                    timestamp = frame_data.get('timestamp', 0)
                    if timestamp > end_time and frame_data.get(f'{side_key}_detections'):
                        next_frame = frame_data
                        next_timestamp = timestamp
                        break
                
                return prev_frame, prev_timestamp, next_frame, next_timestamp
            
            # Helper function to compute union bbox if multiple detections
            def compute_union_bbox(detections):
                if not detections:
                    return None
                if len(detections) == 1:
                    return detections[0]
                
                # Compute union of all bounding boxes
                x_min = min(d['x_min'] for d in detections)
                y_min = min(d['y_min'] for d in detections)
                x_max = max(d['x_max'] for d in detections)
                y_max = max(d['y_max'] for d in detections)
                avg_confidence = sum(d['confidence'] for d in detections) / len(detections)
                
                return {
                    'x_min': x_min,
                    'y_min': y_min,
                    'x_max': x_max,
                    'y_max': y_max,
                    'confidence': avg_confidence,
                    'side': detections[0]['side']
                }
            
            # Process left side if needed
            if side == 'both' or side == 'left':
                prev_frame, prev_ts, next_frame, next_ts = find_boundary_keyframes('left')
                
                if prev_frame or next_frame:
                    # Get union bboxes for boundaries
                    prev_bbox = compute_union_bbox(prev_frame['left_detections']) if prev_frame else None
                    next_bbox = compute_union_bbox(next_frame['left_detections']) if next_frame else None
                    
                    # Process frames in range
                    for frame_key, frame_data in keyframes_data['keyframes'].items():
                        timestamp = frame_data.get('timestamp', 0)
                        
                        if start_time <= timestamp <= end_time:
                            if prev_bbox and next_bbox:
                                # Interpolate between prev and next
                                weight = (timestamp - prev_ts) / (next_ts - prev_ts)
                                interpolated = {
                                    'x_min': prev_bbox['x_min'] + (next_bbox['x_min'] - prev_bbox['x_min']) * weight,
                                    'y_min': prev_bbox['y_min'] + (next_bbox['y_min'] - prev_bbox['y_min']) * weight,
                                    'x_max': prev_bbox['x_max'] + (next_bbox['x_max'] - prev_bbox['x_max']) * weight,
                                    'y_max': prev_bbox['y_max'] + (next_bbox['y_max'] - prev_bbox['y_max']) * weight,
                                    'confidence': prev_bbox['confidence'] + (next_bbox['confidence'] - prev_bbox['confidence']) * weight,
                                    'side': 'left',
                                    'interpolated': True
                                }
                                frame_data['left_detections'] = [interpolated]
                                frame_data['has_left_octopus'] = True
                                infilled_left += 1
                            elif prev_bbox:
                                # Only prev available, copy forward
                                frame_data['left_detections'] = [{**prev_bbox, 'interpolated': True}]
                                frame_data['has_left_octopus'] = True
                                infilled_left += 1
                            elif next_bbox:
                                # Only next available, copy backward
                                frame_data['left_detections'] = [{**next_bbox, 'interpolated': True}]
                                frame_data['has_left_octopus'] = True
                                infilled_left += 1
                            affected_count += 1
            
            # Process right side if needed
            if side == 'both' or side == 'right':
                prev_frame, prev_ts, next_frame, next_ts = find_boundary_keyframes('right')
                
                if prev_frame or next_frame:
                    # Get union bboxes for boundaries
                    prev_bbox = compute_union_bbox(prev_frame['right_detections']) if prev_frame else None
                    next_bbox = compute_union_bbox(next_frame['right_detections']) if next_frame else None
                    
                    # Process frames in range
                    for frame_key, frame_data in keyframes_data['keyframes'].items():
                        timestamp = frame_data.get('timestamp', 0)
                        
                        if start_time <= timestamp <= end_time:
                            if prev_bbox and next_bbox:
                                # Interpolate between prev and next
                                weight = (timestamp - prev_ts) / (next_ts - prev_ts)
                                interpolated = {
                                    'x_min': prev_bbox['x_min'] + (next_bbox['x_min'] - prev_bbox['x_min']) * weight,
                                    'y_min': prev_bbox['y_min'] + (next_bbox['y_min'] - prev_bbox['y_min']) * weight,
                                    'x_max': prev_bbox['x_max'] + (next_bbox['x_max'] - prev_bbox['x_max']) * weight,
                                    'y_max': prev_bbox['y_max'] + (next_bbox['y_max'] - prev_bbox['y_max']) * weight,
                                    'confidence': prev_bbox['confidence'] + (next_bbox['confidence'] - prev_bbox['confidence']) * weight,
                                    'side': 'right',
                                    'interpolated': True
                                }
                                frame_data['right_detections'] = [interpolated]
                                frame_data['has_right_octopus'] = True
                                infilled_right += 1
                            elif prev_bbox:
                                # Only prev available, copy forward
                                frame_data['right_detections'] = [{**prev_bbox, 'interpolated': True}]
                                frame_data['has_right_octopus'] = True
                                infilled_right += 1
                            elif next_bbox:
                                # Only next available, copy backward
                                frame_data['right_detections'] = [{**next_bbox, 'interpolated': True}]
                                frame_data['has_right_octopus'] = True
                                infilled_right += 1
                            affected_count += 1
    
    elif method == 'edit':
        # Handle edits (additions/modifications)
        if not bbox_update:
            return jsonify({'error': 'bbox_update is required for edit method'}), 400
        
        # Validate bbox_update structure
        if not isinstance(bbox_update, dict):
            return jsonify({'error': 'Invalid bbox_update format'}), 400
        
        # Validate individual bbox fields
        def validate_bbox(bbox_data, side_name):
            if not isinstance(bbox_data, dict):
                return False, f"Invalid {side_name} data format"
            
            # Check for nested bbox structure
            if 'bbox' not in bbox_data:
                return False, f"Missing bbox in {side_name} data"
            
            bbox = bbox_data['bbox']
            required_fields = ['x_min', 'y_min', 'x_max', 'y_max']
            for field in required_fields:
                if field not in bbox:
                    return False, f"Missing {field} in {side_name} bbox"
            
            # Validate coordinate ranges (assuming normalized coordinates 0-1)
            if not (0 <= bbox['x_min'] < bbox['x_max'] <= 1):
                return False, f"Invalid x coordinates in {side_name} bbox"
            if not (0 <= bbox['y_min'] < bbox['y_max'] <= 1):
                return False, f"Invalid y coordinates in {side_name} bbox"
            
            return True, None
        
        # Validate bbox updates based on side
        if (side == 'both' or side == 'left') and 'left' in bbox_update:
            valid, error = validate_bbox(bbox_update['left'], 'left')
            if not valid:
                return jsonify({'error': error}), 400
        
        if (side == 'both' or side == 'right') and 'right' in bbox_update:
            valid, error = validate_bbox(bbox_update['right'], 'right')
            if not valid:
                return jsonify({'error': error}), 400
        
        # Process keyframes
        if 'keyframes' in keyframes_data:
            for frame_key, frame_data in keyframes_data['keyframes'].items():
                timestamp = frame_data.get('timestamp', 0)
                
                # Check if timestamp is within range
                if start_time <= timestamp <= end_time:
                    # Update based on side selection
                    if (side == 'both' or side == 'left') and 'left' in bbox_update:
                        # Extract bbox from nested structure
                        left_bbox = bbox_update['left']['bbox']
                        # Create properly formatted detection
                        left_detection = {
                            'x_min': left_bbox['x_min'],
                            'y_min': left_bbox['y_min'],
                            'x_max': left_bbox['x_max'],
                            'y_max': left_bbox['y_max'],
                            'confidence': left_bbox.get('confidence', 0.9),  # Default confidence if not provided
                            'side': 'left',
                            'edited': True  # Mark as edited for tracking
                        }
                        frame_data['left_detections'] = [left_detection]
                        frame_data['has_left_octopus'] = True
                        edited_left += 1
                    
                    if (side == 'both' or side == 'right') and 'right' in bbox_update:
                        # Extract bbox from nested structure
                        right_bbox = bbox_update['right']['bbox']
                        # Create properly formatted detection
                        right_detection = {
                            'x_min': right_bbox['x_min'],
                            'y_min': right_bbox['y_min'],
                            'x_max': right_bbox['x_max'],
                            'y_max': right_bbox['y_max'],
                            'confidence': right_bbox.get('confidence', 0.9),  # Default confidence if not provided
                            'side': 'right',
                            'edited': True  # Mark as edited for tracking
                        }
                        frame_data['right_detections'] = [right_detection]
                        frame_data['has_right_octopus'] = True
                        edited_right += 1
                    
                    affected_count += 1
    
    # Save updated keyframes
    try:
        with open(keyframes_path, 'w') as f:
            json.dump(keyframes_data, f, indent=2)
    except Exception as e:
        # Restore from backup if save fails
        shutil.move(backup_path, keyframes_path)
        return jsonify({'error': f'Failed to save keyframes: {str(e)}'}), 500
    
    # Print summary
    if method == 'delete':
        print(f"=== KEYFRAME DELETION COMPLETED ===")
        print(f"Video ID: MVI_{code}")
        print(f"Method: DELETE")
        print(f"Side: {side.upper()}")
        print(f"Time Range: {start_time}s - {end_time}s")
        print(f"Frames Range: {start_frame} - {end_frame}")
        print(f"Keyframes Affected: {affected_count}")
        print(f"Left Detections Deleted: {deleted_left}")
        print(f"Right Detections Deleted: {deleted_right}")
        print(f"Backup Created: {backup_path.name}")
        print(f"===================================")
    elif method == 'infill':
        print(f"=== KEYFRAME INFILL COMPLETED ===")
        print(f"Video ID: MVI_{code}")
        print(f"Method: INFILL")
        print(f"Side: {side.upper()}")
        print(f"Time Range: {start_time}s - {end_time}s")
        print(f"Frames Range: {start_frame} - {end_frame}")
        print(f"Keyframes Affected: {affected_count}")
        print(f"Left Keyframes Infilled: {infilled_left}")
        print(f"Right Keyframes Infilled: {infilled_right}")
        print(f"Backup Created: {backup_path.name}")
        print(f"===================================")
    elif method == 'edit':
        print(f"=== KEYFRAME EDIT COMPLETED ===")
        print(f"Video ID: MVI_{code}")
        print(f"Method: EDIT")
        print(f"Side: {side.upper()}")
        print(f"Time Range: {start_time}s - {end_time}s")
        print(f"Frames Range: {start_frame} - {end_frame}")
        print(f"Keyframes Affected: {affected_count}")
        print(f"Left Keyframes Edited: {edited_left}")
        print(f"Right Keyframes Edited: {edited_right}")
        print(f"Backup Created: {backup_path.name}")
        print(f"===================================")
    
    return jsonify({
        'success': True,
        'message': 'Keyframes processed successfully',
        'video_id': f'MVI_{code}',
        'method': method,
        'side': side,
        'start_time': start_time,
        'end_time': end_time,
        'keyframes_affected': affected_count,
        'left_detections_deleted': deleted_left if method == 'delete' else 0,
        'right_detections_deleted': deleted_right if method == 'delete' else 0,
        'left_keyframes_infilled': infilled_left if method == 'infill' else 0,
        'right_keyframes_infilled': infilled_right if method == 'infill' else 0,
        'left_keyframes_edited': edited_left if method == 'edit' else 0,
        'right_keyframes_edited': edited_right if method == 'edit' else 0,
        'backup_file': backup_path.name
    })
@app.route('/list-backups/<code>')
def list_backups(code):
    """List all backup files for a given video code"""
    # Validate code format (4 digits)
    if not code.isdigit() or len(code) != 4:
        return jsonify({'error': 'Invalid code format'}), 400
    
    keyframes_dir = Path('videos_keyframes')
    backup_pattern = f'MVI_{code}_keyframes.backup_*.json'
    
    backups = []
    for backup_path in keyframes_dir.glob(backup_pattern):
        # Extract timestamp from filename
        # Format: MVI_XXXX_keyframes.backup_YYYYMMDD_HHMMSS.json
        timestamp_str = backup_path.stem.split('backup_')[1]
        
        try:
            # Parse timestamp
            from datetime import datetime
            timestamp = datetime.strptime(timestamp_str, '%Y%m%d_%H%M%S')
            
            # Get file stats
            stats = backup_path.stat()
            
            backups.append({
                'filename': backup_path.name,
                'timestamp': timestamp.isoformat(),
                'timestamp_str': timestamp.strftime('%Y-%m-%d %H:%M:%S'),
                'size': stats.st_size,
                'size_str': f'{stats.st_size / 1024:.1f} KB'
            })
        except Exception as e:
            print(f"Error parsing backup file {backup_path}: {e}")
            continue
    
    # Sort by timestamp, newest first
    backups.sort(key=lambda x: x['timestamp'], reverse=True)
    
    return jsonify({
        'code': code,
        'backups': backups
    })

@app.route('/restore-backup/<code>', methods=['POST'])
def restore_backup(code):
    """Restore a backup file as the current keyframes file"""
    # Validate code format (4 digits)
    if not code.isdigit() or len(code) != 4:
        return jsonify({'error': 'Invalid code format'}), 400
    
    data = request.get_json()
    if not data or 'backup_filename' not in data:
        return jsonify({'error': 'backup_filename is required'}), 400
    
    backup_filename = data['backup_filename']
    
    # Validate backup filename format
    if not backup_filename.startswith(f'MVI_{code}_keyframes.backup_') or not backup_filename.endswith('.json'):
        return jsonify({'error': 'Invalid backup filename'}), 400
    
    keyframes_dir = Path('videos_keyframes')
    backup_path = keyframes_dir / backup_filename
    current_keyframes_path = keyframes_dir / f'MVI_{code}_keyframes.json'
    
    # Check if backup exists
    if not backup_path.exists():
        return jsonify({'error': 'Backup file not found'}), 404
    
    try:
        # Create a backup of the current file before restoring
        import shutil
        from datetime import datetime
        
        if current_keyframes_path.exists():
            pre_restore_backup = current_keyframes_path.with_suffix(
                f'.backup_{datetime.now().strftime("%Y%m%d_%H%M%S")}.json'
            )
            shutil.copy2(current_keyframes_path, pre_restore_backup)
        
        # Restore the backup
        shutil.copy2(backup_path, current_keyframes_path)
        
        return jsonify({
            'success': True,
            'message': f'Successfully restored backup from {backup_filename}',
            'backup_filename': backup_filename
        })
    except Exception as e:
        return jsonify({'error': f'Failed to restore backup: {str(e)}'}), 500

@app.route('/get-upload-mapping/<code>')
def get_upload_mapping(code):
    """Get the original upload information for a specific MVI code"""
    # Validate code format (4 digits)
    if not code.isdigit() or len(code) != 4:
        return jsonify({'error': 'Invalid code format'}), 400
    
    # Check if mapping exists for this code
    if code in VIDEO_UPLOAD_MAPPING:
        return jsonify({
            'code': code,
            'mapping': VIDEO_UPLOAD_MAPPING[code]
        })
    else:
        return jsonify({
            'code': code,
            'mapping': None,
            'message': 'No upload mapping found for this code'
        })

@app.route('/get-all-upload-mappings')
def get_all_upload_mappings():
    """Get all upload mappings for export purposes"""
    return jsonify({
        'mappings': VIDEO_UPLOAD_MAPPING,
        'total_count': len(VIDEO_UPLOAD_MAPPING)
    })

@app.route('/import-keyframes/<code>', methods=['POST'])
def import_keyframes(code):
    """Import keyframes JSON file for a specific video code"""
    # Validate code format (4 digits)
    if not code.isdigit() or len(code) != 4:
        return jsonify({'error': 'Invalid code format'}), 400
    
    # Check if video exists
    videos_dir = Path('videos')
    video_path_lower = videos_dir / f'MVI_{code}_proxy.mp4'
    video_path_upper = videos_dir / f'MVI_{code}_proxy.MP4'
    
    if not (video_path_lower.exists() or video_path_upper.exists()):
        return jsonify({'error': f'Video not found for code {code}'}), 404
    
    # Check if keyframes file was uploaded
    if 'keyframes' not in request.files:
        return jsonify({'error': 'No keyframes file provided'}), 400
    
    keyframes_file = request.files['keyframes']
    
    if keyframes_file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    
    # Validate it's a JSON file
    if not keyframes_file.filename.lower().endswith('.json'):
        return jsonify({'error': 'File must be a JSON file'}), 400
    
    try:
        # Read and parse the uploaded JSON
        keyframes_content = keyframes_file.read()
        keyframes_data = json.loads(keyframes_content)
        
        # Validate basic structure
        if 'keyframes' not in keyframes_data:
            return jsonify({'error': 'Invalid keyframes format: missing "keyframes" field'}), 400
        
        # Validate that keyframes is a dict
        if not isinstance(keyframes_data['keyframes'], dict):
            return jsonify({'error': 'Invalid keyframes format: "keyframes" must be an object'}), 400
        
        # Path for the keyframes file
        keyframes_dir = Path('videos_keyframes')
        keyframes_path = keyframes_dir / f'MVI_{code}_keyframes.json'
        
        # Create backup if existing keyframes exist
        backup_path = None
        if keyframes_path.exists():
            from datetime import datetime
            backup_path = keyframes_path.with_suffix(
                f'.backup_{datetime.now().strftime("%Y%m%d_%H%M%S")}.json'
            )
            import shutil
            shutil.copy2(keyframes_path, backup_path)
        
        # Save the new keyframes
        with open(keyframes_path, 'w') as f:
            json.dump(keyframes_data, f, indent=2)
        
        # Count some statistics
        total_frames = len(keyframes_data['keyframes'])
        frames_with_left = sum(1 for frame in keyframes_data['keyframes'].values() 
                               if frame.get('has_left_octopus', False))
        frames_with_right = sum(1 for frame in keyframes_data['keyframes'].values() 
                                if frame.get('has_right_octopus', False))
        
        response = {
            'success': True,
            'message': f'Successfully imported keyframes for MVI_{code}',
            'total_frames': total_frames,
            'frames_with_left': frames_with_left,
            'frames_with_right': frames_with_right
        }
        
        if backup_path:
            response['backup_created'] = backup_path.name
            response['replaced_existing'] = True
        else:
            response['replaced_existing'] = False
        
        return jsonify(response)
        
    except json.JSONDecodeError as e:
        return jsonify({'error': f'Invalid JSON file: {str(e)}'}), 400
    except Exception as e:
        return jsonify({'error': f'Failed to import keyframes: {str(e)}'}), 500

@app.route('/delete-video/<code>', methods=['DELETE'])
def delete_video(code):
    """Delete video and associated keyframes by code"""
    # Validate code format (4 digits)
    if not code.isdigit() or len(code) != 4:
        return jsonify({'error': 'Invalid code format'}), 400
    
    # Define directories
    videos_dir = Path('videos')
    keyframes_dir = Path('videos_keyframes')
    
    # Check if video exists
    video_path = videos_dir / f'MVI_{code}_proxy.mp4'
    if not video_path.exists():
        # Try uppercase extension
        video_path = videos_dir / f'MVI_{code}_proxy.MP4'
        if not video_path.exists():
            return jsonify({'error': 'Video not found'}), 404
    
    # Check for keyframes file
    keyframes_path = keyframes_dir / f'MVI_{code}_keyframes.json'
    keyframes_existed = keyframes_path.exists()
    
    try:
        # Delete video file
        video_path.unlink()
        
        # Delete keyframes if exists
        if keyframes_existed:
            keyframes_path.unlink()
        
        # Remove from upload mapping
        if code in VIDEO_UPLOAD_MAPPING:
            del VIDEO_UPLOAD_MAPPING[code]
            save_upload_mapping()
        
        return jsonify({
            'success': True,
            'message': f'Deleted video MVI_{code}_proxy',
            'keyframes_deleted': keyframes_existed
        })
    except Exception as e:
        return jsonify({'error': f'Failed to delete: {str(e)}'}), 500

import os

if __name__ == '__main__':
    if getattr(sys, 'frozen', False):
        app.run(host='127.0.0.1', port=5172, debug=False, use_reloader=False)
    else:
        # Just try to run - Flask will error clearly if port is taken
        app.run(debug=True, host='0.0.0.0', port=5172)