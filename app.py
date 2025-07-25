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

@app.route('/update-keyframe/<code>', methods=['POST'])
def update_keyframe(code):
    """Update keyframe with client-side bounding box edits"""
    
    # Get request data
    data = request.get_json()
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    # Extract fields
    frame = data.get('frame')
    timestamp = data.get('timestamp')
    modifications = data.get('modifications', {})
    
    # Check if any side has a deletion or modification
    has_deletion = False
    has_modification = False
    deletion_sides = []
    modification_sides = []
    modification_boxes = {}
    
    if 'left' in modifications:
        if modifications['left'].get('editType') == 'deletion':
            has_deletion = True
            deletion_sides.append('left')
        elif modifications['left'].get('editType') == 'modification':
            has_modification = True
            modification_sides.append('left')
            modification_boxes['left'] = modifications['left'].get('bbox')
    
    if 'right' in modifications:
        if modifications['right'].get('editType') == 'deletion':
            has_deletion = True
            deletion_sides.append('right')
        elif modifications['right'].get('editType') == 'modification':
            has_modification = True
            modification_sides.append('right')
            modification_boxes['right'] = modifications['right'].get('bbox')
    
    # If we have deletions, use IoU-based deletion logic
    if has_deletion:
        # Determine which side to delete
        if len(deletion_sides) == 2:
            side = 'both'
        else:
            side = deletion_sides[0]
        
        # Load keyframes file
        keyframes_path = Path('videos_keyframes') / f'MVI_{code}_keyframes.json'
        if not keyframes_path.exists():
            return jsonify({'error': 'Keyframes file not found'}), 404
        
        try:
            with open(keyframes_path, 'r') as f:
                keyframes_data = json.load(f)
        except Exception as e:
            return jsonify({'error': f'Failed to load keyframes: {str(e)}'}), 500
        
        # Find nearest keyframe to timestamp
        nearest_frame = None
        nearest_frame_key = None
        min_time_diff = float('inf')
        
        for frame_key, frame_data in keyframes_data['keyframes'].items():
            frame_timestamp = frame_data.get('timestamp', 0)
            time_diff = abs(frame_timestamp - timestamp)
            if time_diff < min_time_diff:
                min_time_diff = time_diff
                nearest_frame = frame_data
                nearest_frame_key = frame_key
        
        if not nearest_frame:
            return jsonify({'error': 'No keyframes found'}), 404
        
        # Get reference bounding box for the side we're deleting
        reference_boxes = {}
        if side in ['both', 'left'] and nearest_frame.get('left_detections'):
            reference_boxes['left'] = nearest_frame['left_detections'][0]  # Use first detection
        if side in ['both', 'right'] and nearest_frame.get('right_detections'):
            reference_boxes['right'] = nearest_frame['right_detections'][0]  # Use first detection
        
        if not reference_boxes:
            return jsonify({'error': f'No detection found at timestamp {timestamp:.3f}s for side: {side}'}), 404
        
        # Sort keyframes by frame number for scanning
        sorted_frames = sorted(keyframes_data['keyframes'].items(), key=lambda x: int(x[0]))
        nearest_index = next(i for i, (k, v) in enumerate(sorted_frames) if k == nearest_frame_key)
        
        # Scan backward to find interval start
        interval_start_index = nearest_index
        for i in range(nearest_index - 1, -1, -1):
            frame_key, frame_data = sorted_frames[i]
            should_stop = False
            
            # Check each side we're processing
            for s in ['left', 'right']:
                if s in reference_boxes:
                    detections = frame_data.get(f'{s}_detections', [])
                    if not detections:
                        should_stop = True
                        break
                    
                    # Calculate IoU with reference box
                    current_box = detections[0]  # Use first detection
                    iou = calculate_iou(reference_boxes[s], current_box)
                    if iou < 0.8:
                        should_stop = True
                        break
            
            if should_stop:
                break
            interval_start_index = i
        
        # Scan forward to find interval end
        interval_end_index = nearest_index
        for i in range(nearest_index + 1, len(sorted_frames)):
            frame_key, frame_data = sorted_frames[i]
            should_stop = False
            
            # Check each side we're processing
            for s in ['left', 'right']:
                if s in reference_boxes:
                    detections = frame_data.get(f'{s}_detections', [])
                    if not detections:
                        should_stop = True
                        break
                    
                    # Calculate IoU with reference box
                    current_box = detections[0]  # Use first detection
                    iou = calculate_iou(reference_boxes[s], current_box)
                    if iou < 0.8:
                        should_stop = True
                        break
            
            if should_stop:
                break
            interval_end_index = i
        
        # Create backup before deletion
        import shutil
        from datetime import datetime
        backup_path = keyframes_path.with_suffix(f'.backup_{datetime.now().strftime("%Y%m%d_%H%M%S")}.json')
        shutil.copy2(keyframes_path, backup_path)
        
        # Delete detections within the interval
        deleted_count = {'left': 0, 'right': 0}
        affected_frames = []
        
        for i in range(interval_start_index, interval_end_index + 1):
            frame_key, frame_data = sorted_frames[i]
            affected_frames.append(int(frame_key))
            
            if side in ['both', 'left'] and frame_data.get('left_detections'):
                deleted_count['left'] += len(frame_data['left_detections'])
                frame_data['left_detections'] = []
                frame_data['has_left_octopus'] = False
            
            if side in ['both', 'right'] and frame_data.get('right_detections'):
                deleted_count['right'] += len(frame_data['right_detections'])
                frame_data['right_detections'] = []
                frame_data['has_right_octopus'] = False
        
        # Save updated keyframes
        try:
            with open(keyframes_path, 'w') as f:
                json.dump(keyframes_data, f, indent=2)
        except Exception as e:
            # Restore from backup if save fails
            shutil.move(backup_path, keyframes_path)
            return jsonify({'error': f'Failed to save keyframes: {str(e)}'}), 500
        
        # Get time range of deletion
        start_time = sorted_frames[interval_start_index][1]['timestamp']
        end_time = sorted_frames[interval_end_index][1]['timestamp']
        
        # Print summary
        print(f"\n=== IoU-BASED KEYFRAME DELETION ===")
        print(f"Video ID: MVI_{code}")
        print(f"Clicked Timestamp: {timestamp:.3f}s")
        print(f"Nearest Frame: {nearest_frame_key}")
        print(f"Side: {side.upper()}")
        print(f"IoU Threshold: 0.95")
        print(f"Deletion Interval: {start_time:.3f}s - {end_time:.3f}s")
        print(f"Frames Affected: {len(affected_frames)} (frames {min(affected_frames)} - {max(affected_frames)})")
        print(f"Left Detections Deleted: {deleted_count['left']}")
        print(f"Right Detections Deleted: {deleted_count['right']}")
        print(f"Backup Created: {backup_path.name}")
        print(f"===================================\n")
        
        # Return success response
        return jsonify({
            'success': True,
            'message': 'IoU-based deletion completed',
            'timestamp': timestamp,
            'interval': {
                'start_time': start_time,
                'end_time': end_time,
                'start_frame': min(affected_frames),
                'end_frame': max(affected_frames)
            },
            'frames_affected': len(affected_frames),
            'detections_deleted': deleted_count,
            'backup_file': backup_path.name
        })
    
    # If we have modifications, use IoU-based modification logic
    elif has_modification:
        # Determine which side to modify
        if len(modification_sides) == 2:
            side = 'both'
        else:
            side = modification_sides[0]
        
        # Load keyframes file
        keyframes_path = Path('videos_keyframes') / f'MVI_{code}_keyframes.json'
        if not keyframes_path.exists():
            return jsonify({'error': 'Keyframes file not found'}), 404
        
        try:
            with open(keyframes_path, 'r') as f:
                keyframes_data = json.load(f)
        except Exception as e:
            return jsonify({'error': f'Failed to load keyframes: {str(e)}'}), 500
        
        # Find nearest keyframe to timestamp
        nearest_frame = None
        nearest_frame_key = None
        min_time_diff = float('inf')
        
        for frame_key, frame_data in keyframes_data['keyframes'].items():
            frame_timestamp = frame_data.get('timestamp', 0)
            time_diff = abs(frame_timestamp - timestamp)
            if time_diff < min_time_diff:
                min_time_diff = time_diff
                nearest_frame = frame_data
                nearest_frame_key = frame_key
        
        if not nearest_frame:
            return jsonify({'error': 'No keyframes found'}), 404
        
        # Get reference bounding box for the side we're modifying
        reference_boxes = {}
        if side in ['both', 'left'] and nearest_frame.get('left_detections'):
            reference_boxes['left'] = nearest_frame['left_detections'][0]  # Use first detection
        if side in ['both', 'right'] and nearest_frame.get('right_detections'):
            reference_boxes['right'] = nearest_frame['right_detections'][0]  # Use first detection
        
        if not reference_boxes:
            return jsonify({'error': f'No detection found at timestamp {timestamp:.3f}s for side: {side}'}), 404
        
        # Sort keyframes by frame number for scanning
        sorted_frames = sorted(keyframes_data['keyframes'].items(), key=lambda x: int(x[0]))
        nearest_index = next(i for i, (k, v) in enumerate(sorted_frames) if k == nearest_frame_key)
        
        # Scan backward to find interval start
        interval_start_index = nearest_index
        for i in range(nearest_index - 1, -1, -1):
            frame_key, frame_data = sorted_frames[i]
            should_stop = False
            
            # Check each side we're processing
            for s in ['left', 'right']:
                if s in reference_boxes:
                    detections = frame_data.get(f'{s}_detections', [])
                    if not detections:
                        should_stop = True
                        break
                    
                    # Calculate IoU with reference box
                    current_box = detections[0]  # Use first detection
                    iou = calculate_iou(reference_boxes[s], current_box)
                    if iou < 0.8:
                        should_stop = True
                        break
            
            if should_stop:
                break
            interval_start_index = i
        
        # Scan forward to find interval end
        interval_end_index = nearest_index
        for i in range(nearest_index + 1, len(sorted_frames)):
            frame_key, frame_data = sorted_frames[i]
            should_stop = False
            
            # Check each side we're processing
            for s in ['left', 'right']:
                if s in reference_boxes:
                    detections = frame_data.get(f'{s}_detections', [])
                    if not detections:
                        should_stop = True
                        break
                    
                    # Calculate IoU with reference box
                    current_box = detections[0]  # Use first detection
                    iou = calculate_iou(reference_boxes[s], current_box)
                    if iou < 0.8:
                        should_stop = True
                        break
            
            if should_stop:
                break
            interval_end_index = i
        
        # Create backup before modification
        import shutil
        from datetime import datetime
        backup_path = keyframes_path.with_suffix(f'.backup_{datetime.now().strftime("%Y%m%d_%H%M%S")}.json')
        shutil.copy2(keyframes_path, backup_path)
        
        # Replace detections within the interval
        modified_count = {'left': 0, 'right': 0}
        affected_frames = []
        
        for i in range(interval_start_index, interval_end_index + 1):
            frame_key, frame_data = sorted_frames[i]
            affected_frames.append(int(frame_key))
            
            if side in ['both', 'left'] and frame_data.get('left_detections') and 'left' in modification_boxes:
                # Replace with modified box
                frame_data['left_detections'] = [{
                    **modification_boxes['left'],
                    'side': 'left',
                    'confidence': 1.0  # Set high confidence for user-modified boxes
                }]
                modified_count['left'] += 1
            
            if side in ['both', 'right'] and frame_data.get('right_detections') and 'right' in modification_boxes:
                # Replace with modified box
                frame_data['right_detections'] = [{
                    **modification_boxes['right'],
                    'side': 'right',
                    'confidence': 1.0  # Set high confidence for user-modified boxes
                }]
                modified_count['right'] += 1
        
        # Save updated keyframes
        try:
            with open(keyframes_path, 'w') as f:
                json.dump(keyframes_data, f, indent=2)
        except Exception as e:
            # Restore from backup if save fails
            shutil.move(backup_path, keyframes_path)
            return jsonify({'error': f'Failed to save keyframes: {str(e)}'}), 500
        
        # Get time range of modification
        start_time = sorted_frames[interval_start_index][1]['timestamp']
        end_time = sorted_frames[interval_end_index][1]['timestamp']
        
        # Print summary
        print(f"\n=== IoU-BASED KEYFRAME MODIFICATION ===")
        print(f"Video ID: MVI_{code}")
        print(f"Clicked Timestamp: {timestamp:.3f}s")
        print(f"Nearest Frame: {nearest_frame_key}")
        print(f"Side: {side.upper()}")
        print(f"IoU Threshold: 0.8")
        print(f"Modification Interval: {start_time:.3f}s - {end_time:.3f}s")
        print(f"Frames Affected: {len(affected_frames)} (frames {min(affected_frames)} - {max(affected_frames)})")
        print(f"Left Detections Modified: {modified_count['left']}")
        print(f"Right Detections Modified: {modified_count['right']}")
        if 'left' in modification_boxes and modification_boxes['left']:
            bbox = modification_boxes['left']
            print(f"Left Box: x_min={bbox['x_min']:.3f}, y_min={bbox['y_min']:.3f}, x_max={bbox['x_max']:.3f}, y_max={bbox['y_max']:.3f}")
        if 'right' in modification_boxes and modification_boxes['right']:
            bbox = modification_boxes['right']
            print(f"Right Box: x_min={bbox['x_min']:.3f}, y_min={bbox['y_min']:.3f}, x_max={bbox['x_max']:.3f}, y_max={bbox['y_max']:.3f}")
        print(f"Backup Created: {backup_path.name}")
        print(f"=====================================\n")
        
        # Return success response
        return jsonify({
            'success': True,
            'message': 'IoU-based modification completed',
            'timestamp': timestamp,
            'interval': {
                'start_time': start_time,
                'end_time': end_time,
                'start_frame': min(affected_frames),
                'end_frame': max(affected_frames)
            },
            'frames_affected': len(affected_frames),
            'detections_modified': modified_count,
            'backup_file': backup_path.name
        })
    
    # Otherwise, handle non-deletion/non-modification edits (additions)
    print(f"\n=== Received Bounding Box Edit ===")
    print(f"Video Code: {code}")
    print(f"Frame: {frame}")
    print(f"Timestamp: {timestamp:.3f}s")
    print(f"Modifications:")
    
    if 'left' in modifications:
        left_mod = modifications['left']
        edit_type = left_mod.get('editType', 'unknown')
        bbox = left_mod.get('bbox')
        had_original = left_mod.get('hadOriginal', False)
        
        print(f"\n  Left Side:")
        print(f"    Edit Type: {edit_type.upper()}")
        print(f"    Had Original Box: {had_original}")
        
        if edit_type == 'addition':
            print(f"    Action: Created new box")
            if bbox:
                print(f"    New box coordinates: x_min={bbox['x_min']:.3f}, y_min={bbox['y_min']:.3f}, x_max={bbox['x_max']:.3f}, y_max={bbox['y_max']:.3f}")
        elif edit_type == 'modification':
            print(f"    Action: Modified existing box")
            if bbox:
                print(f"    Updated coordinates: x_min={bbox['x_min']:.3f}, y_min={bbox['y_min']:.3f}, x_max={bbox['x_max']:.3f}, y_max={bbox['y_max']:.3f}")
    
    if 'right' in modifications:
        right_mod = modifications['right']
        edit_type = right_mod.get('editType', 'unknown')
        bbox = right_mod.get('bbox')
        had_original = right_mod.get('hadOriginal', False)
        
        print(f"\n  Right Side:")
        print(f"    Edit Type: {edit_type.upper()}")
        print(f"    Had Original Box: {had_original}")
        
        if edit_type == 'addition':
            print(f"    Action: Created new box")
            if bbox:
                print(f"    New box coordinates: x_min={bbox['x_min']:.3f}, y_min={bbox['y_min']:.3f}, x_max={bbox['x_max']:.3f}, y_max={bbox['y_max']:.3f}")
        elif edit_type == 'modification':
            print(f"    Action: Modified existing box")
            if bbox:
                print(f"    Updated coordinates: x_min={bbox['x_min']:.3f}, y_min={bbox['y_min']:.3f}, x_max={bbox['x_max']:.3f}, y_max={bbox['y_max']:.3f}")
    
    print("\n=================================\n")
    
    # Return success response
    return jsonify({
        'success': True,
        'message': 'Edits received successfully',
        'frame': frame,
        'code': code
    })

@app.route('/delete-keyframe-iou/<code>', methods=['POST'])
def delete_keyframe_iou(code):
    """Delete keyframes based on IoU similarity scanning"""
    
    # Get request data
    data = request.get_json()
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    # Extract fields
    timestamp = data.get('timestamp')
    side = data.get('side', 'both')  # Which octopus to delete
    
    if timestamp is None:
        return jsonify({'error': 'Timestamp is required'}), 400
    
    # Load keyframes file
    keyframes_path = Path('videos_keyframes') / f'MVI_{code}_keyframes.json'
    if not keyframes_path.exists():
        return jsonify({'error': 'Keyframes file not found'}), 404
    
    try:
        with open(keyframes_path, 'r') as f:
            keyframes_data = json.load(f)
    except Exception as e:
        return jsonify({'error': f'Failed to load keyframes: {str(e)}'}), 500
    
    # Find nearest keyframe to timestamp
    nearest_frame = None
    nearest_frame_key = None
    min_time_diff = float('inf')
    
    for frame_key, frame_data in keyframes_data['keyframes'].items():
        frame_timestamp = frame_data.get('timestamp', 0)
        time_diff = abs(frame_timestamp - timestamp)
        if time_diff < min_time_diff:
            min_time_diff = time_diff
            nearest_frame = frame_data
            nearest_frame_key = frame_key
    
    if not nearest_frame:
        return jsonify({'error': 'No keyframes found'}), 404
    
    # Get reference bounding box for the side we're deleting
    reference_boxes = {}
    if side in ['both', 'left'] and nearest_frame.get('left_detections'):
        reference_boxes['left'] = nearest_frame['left_detections'][0]  # Use first detection
    if side in ['both', 'right'] and nearest_frame.get('right_detections'):
        reference_boxes['right'] = nearest_frame['right_detections'][0]  # Use first detection
    
    if not reference_boxes:
        return jsonify({'error': f'No detection found at timestamp {timestamp:.3f}s for side: {side}'}), 404
    
    # Sort keyframes by frame number for scanning
    sorted_frames = sorted(keyframes_data['keyframes'].items(), key=lambda x: int(x[0]))
    nearest_index = next(i for i, (k, v) in enumerate(sorted_frames) if k == nearest_frame_key)
    
    # Scan backward to find interval start
    interval_start_index = nearest_index
    for i in range(nearest_index - 1, -1, -1):
        frame_key, frame_data = sorted_frames[i]
        should_stop = False
        
        # Check each side we're processing
        for s in ['left', 'right']:
            if s in reference_boxes:
                detections = frame_data.get(f'{s}_detections', [])
                if not detections:
                    should_stop = True
                    break
                
                # Calculate IoU with reference box
                current_box = detections[0]  # Use first detection
                iou = calculate_iou(reference_boxes[s], current_box)
                if iou < 0.8:
                    should_stop = True
                    break
        
        if should_stop:
            break
        interval_start_index = i
    
    # Scan forward to find interval end
    interval_end_index = nearest_index
    for i in range(nearest_index + 1, len(sorted_frames)):
        frame_key, frame_data = sorted_frames[i]
        should_stop = False
        
        # Check each side we're processing
        for s in ['left', 'right']:
            if s in reference_boxes:
                detections = frame_data.get(f'{s}_detections', [])
                if not detections:
                    should_stop = True
                    break
                
                # Calculate IoU with reference box
                current_box = detections[0]  # Use first detection
                iou = calculate_iou(reference_boxes[s], current_box)
                if iou < 0.8:
                    should_stop = True
                    break
        
        if should_stop:
            break
        interval_end_index = i
    
    # Create backup before deletion
    import shutil
    from datetime import datetime
    backup_path = keyframes_path.with_suffix(f'.backup_{datetime.now().strftime("%Y%m%d_%H%M%S")}.json')
    shutil.copy2(keyframes_path, backup_path)
    
    # Delete detections within the interval
    deleted_count = {'left': 0, 'right': 0}
    affected_frames = []
    
    for i in range(interval_start_index, interval_end_index + 1):
        frame_key, frame_data = sorted_frames[i]
        affected_frames.append(int(frame_key))
        
        if side in ['both', 'left'] and frame_data.get('left_detections'):
            deleted_count['left'] += len(frame_data['left_detections'])
            frame_data['left_detections'] = []
            frame_data['has_left_octopus'] = False
        
        if side in ['both', 'right'] and frame_data.get('right_detections'):
            deleted_count['right'] += len(frame_data['right_detections'])
            frame_data['right_detections'] = []
            frame_data['has_right_octopus'] = False
    
    # Save updated keyframes
    try:
        with open(keyframes_path, 'w') as f:
            json.dump(keyframes_data, f, indent=2)
    except Exception as e:
        # Restore from backup if save fails
        shutil.move(backup_path, keyframes_path)
        return jsonify({'error': f'Failed to save keyframes: {str(e)}'}), 500
    
    # Get time range of deletion
    start_time = sorted_frames[interval_start_index][1]['timestamp']
    end_time = sorted_frames[interval_end_index][1]['timestamp']
    
    # Print summary
    print(f"\n=== IoU-BASED KEYFRAME DELETION ===")
    print(f"Video ID: MVI_{code}")
    print(f"Clicked Timestamp: {timestamp:.3f}s")
    print(f"Nearest Frame: {nearest_frame_key}")
    print(f"Side: {side.upper()}")
    print(f"IoU Threshold: 0.95")
    print(f"Deletion Interval: {start_time:.3f}s - {end_time:.3f}s")
    print(f"Frames Affected: {len(affected_frames)} (frames {min(affected_frames)} - {max(affected_frames)})")
    print(f"Left Detections Deleted: {deleted_count['left']}")
    print(f"Right Detections Deleted: {deleted_count['right']}")
    print(f"Backup Created: {backup_path.name}")
    print(f"===================================\n")
    
    # Return success response
    return jsonify({
        'success': True,
        'message': 'IoU-based deletion completed',
        'timestamp': timestamp,
        'interval': {
            'start_time': start_time,
            'end_time': end_time,
            'start_frame': min(affected_frames),
            'end_frame': max(affected_frames)
        },
        'frames_affected': len(affected_frames),
        'detections_deleted': deleted_count,
        'backup_file': backup_path.name
    })

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
    else:
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
    
    return jsonify({
        'success': True,
        'message': 'Keyframes processed successfully',
        'video_id': f'MVI_{code}',
        'method': method,
        'side': side,
        'start_time': start_time,
        'end_time': end_time,
        'keyframes_affected': affected_count,
        'left_detections_deleted': deleted_left,
        'right_detections_deleted': deleted_right,
        'left_keyframes_infilled': infilled_left,
        'right_keyframes_infilled': infilled_right,
        'backup_file': backup_path.name
    })

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