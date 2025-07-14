#!/usr/bin/env python3
import argparse
import cv2
import json
from pathlib import Path
from ultralytics import YOLO
import torch
import time
from typing import Dict, List, Tuple
from PIL import Image
import numpy as np
from transformers import AutoModelForCausalLM


def compute_iou(box1, box2):
    """Compute Intersection over Union between two bounding boxes"""
    x1 = max(box1['x_min'], box2['x_min'])
    y1 = max(box1['y_min'], box2['y_min'])
    x2 = min(box1['x_max'], box2['x_max'])
    y2 = min(box1['y_max'], box2['y_max'])
    
    intersection = max(0, x2 - x1) * max(0, y2 - y1)
    
    area1 = (box1['x_max'] - box1['x_min']) * (box1['y_max'] - box1['y_min'])
    area2 = (box2['x_max'] - box2['x_min']) * (box2['y_max'] - box2['y_min'])
    
    union = area1 + area2 - intersection
    
    return intersection / union if union > 0 else 0


def preprocess_keyframes(keyframes):
    """Preprocess keyframes to remove extra detections based on IoU with last single detection"""
    processed_keyframes = {}
    
    for side in ['left', 'right']:
        detections_key = f'{side}_detections'
        last_single_detection = None
        last_single_frame = None
        
        for kf_idx in sorted([int(k) for k in keyframes.keys()]):
            kf = keyframes[str(kf_idx)]
            detections = kf[detections_key]
            
            if len(detections) == 1:
                last_single_detection = detections[0]
                last_single_frame = kf_idx
            elif len(detections) > 1 and last_single_detection is not None:
                best_detection = None
                best_iou = -1
                
                for det in detections:
                    iou = compute_iou(last_single_detection, det)
                    if iou > best_iou:
                        best_iou = iou
                        best_detection = det
                
                if str(kf_idx) not in processed_keyframes:
                    processed_keyframes[str(kf_idx)] = kf.copy()
                    processed_keyframes[str(kf_idx)][detections_key] = []
                
                processed_keyframes[str(kf_idx)][detections_key] = [best_detection] if best_detection else []
            else:
                if str(kf_idx) not in processed_keyframes:
                    processed_keyframes[str(kf_idx)] = kf.copy()
    
    for kf_idx in keyframes.keys():
        if kf_idx not in processed_keyframes:
            processed_keyframes[kf_idx] = keyframes[kf_idx]
    
    return processed_keyframes


def find_tank_bbox(video_path, model, sample_rate=2, scale=0.5):
    """
    Find tank bounding box using progressive sampling with moondream.
    
    Args:
        video_path: Path to input video
        model: Loaded moondream model
        sample_rate: Initial sample rate in Hz (default 2Hz)
        scale: Scale factor for model detection (default 0.5)
    
    Returns:
        tuple: (found, bbox) where bbox is averaged from multiple detections
    """
    # Open video
    video = cv2.VideoCapture(video_path)
    fps = video.get(cv2.CAP_PROP_FPS)
    frame_width = int(video.get(cv2.CAP_PROP_FRAME_WIDTH))
    frame_height = int(video.get(cv2.CAP_PROP_FRAME_HEIGHT))
    total_frames = int(video.get(cv2.CAP_PROP_FRAME_COUNT))
    
    print(f"Searching for tank...")
    print(f"Video dimensions: {frame_width}x{frame_height}")
    
    # Start from the middle of the video
    middle_frame = total_frames // 2
    print(f"Starting tank detection from middle of video (frame {middle_frame} of {total_frames})")
    
    # Progressive sampling rates
    sampling_rates = [sample_rate, 1.0, 0.5]
    collected_boxes = []
    first_detection_frame = None
    
    for current_rate in sampling_rates:
        frame_interval = int(fps / current_rate)
        print(f"Sampling at {current_rate}Hz (every {frame_interval} frames)")
        
        # Reset to first detection frame or middle of video
        start_frame = first_detection_frame if first_detection_frame is not None else middle_frame
        video.set(cv2.CAP_PROP_POS_FRAMES, start_frame)
        
        frame_count = start_frame
        detections_this_round = 0
        
        while frame_count < total_frames and len(collected_boxes) < 5:
            ret, frame = video.read()
            if not ret:
                break
            
            # Check frames at specified sample rate
            if (frame_count - start_frame) % frame_interval == 0:
                # Convert BGR to RGB and create PIL Image
                frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                
                # Apply scaling if needed
                if scale != 1.0:
                    scaled_width = int(frame_width * scale)
                    scaled_height = int(frame_height * scale)
                    frame_for_detection = cv2.resize(frame_rgb, (scaled_width, scaled_height))
                else:
                    frame_for_detection = frame_rgb
                
                image = Image.fromarray(frame_for_detection)
                
                # Detect tank
                results = model.detect(image, "tank")
                detections = results["objects"]
                
                if detections:
                    # Found the tank
                    obj = detections[0]
                    
                    # Convert normalized coordinates to pixel coordinates
                    x_min = int(obj["x_min"] * frame_width)
                    y_min = int(obj["y_min"] * frame_height)
                    x_max = int(obj["x_max"] * frame_width)
                    y_max = int(obj["y_max"] * frame_height)
                    
                    bbox = (x_min, y_min, x_max, y_max)
                    collected_boxes.append(bbox)
                    detections_this_round += 1
                    
                    # Remember first detection frame for finer sampling
                    if first_detection_frame is None:
                        first_detection_frame = max(0, frame_count - int(fps * 2))  # Start 2 seconds before
                    
                    print(f"Frame {frame_count}: Found tank - Box #{len(collected_boxes)}")
            
            frame_count += 1
        
        # Stop if we have enough boxes
        if len(collected_boxes) >= 5:
            break
    
    video.release()
    
    if len(collected_boxes) == 0:
        return False, None
    
    # Average all collected bounding boxes
    avg_x_min = int(sum(box[0] for box in collected_boxes) / len(collected_boxes))
    avg_y_min = int(sum(box[1] for box in collected_boxes) / len(collected_boxes))
    avg_x_max = int(sum(box[2] for box in collected_boxes) / len(collected_boxes))
    avg_y_max = int(sum(box[3] for box in collected_boxes) / len(collected_boxes))
    avg_x_min = max(0, avg_x_min)
    avg_y_min = max(0, avg_y_min)
    avg_x_max = min(frame_width, avg_x_max)
    avg_y_max = min(frame_height, avg_y_max)

    
    avg_bbox = (avg_x_min, avg_y_min, avg_x_max, avg_y_max)
    
    print(f"\nCollected {len(collected_boxes)} tank bounding boxes")
    print(f"Averaged tank bounding box: ({avg_x_min}, {avg_y_min}, {avg_x_max}, {avg_y_max})")
    
    return True, avg_bbox


def process_tank_half_batch(model, frames: List[np.ndarray], tank_bbox: Dict, side: str, 
                           conf_threshold: float = 0.25) -> List[List[Dict]]:
    """
    Process one half of the tank with YOLO model for a batch of frames.
    
    Args:
        model: YOLO model
        frames: List of OpenCV frames
        tank_bbox: Tank bounding box info
        side: 'left' or 'right'
        conf_threshold: Confidence threshold
    
    Returns:
        List of detection lists (one per frame) in full-frame normalized coordinates
    """
    if not frames:
        return []
    
    height, width = frames[0].shape[:2]
    
    # Calculate crop region
    x_min = tank_bbox['x_min']
    y_min = tank_bbox['y_min']
    x_max = tank_bbox['x_max']
    y_max = tank_bbox['y_max']
    center_x = tank_bbox['center_x']
    
    if side == 'left':
        crop_bbox = (x_min, y_min, center_x, y_max)
    else:  # right
        crop_bbox = (center_x, y_min, x_max, y_max)
    
    # Crop all frames in batch
    crop_x_min, crop_y_min, crop_x_max, crop_y_max = crop_bbox
    cropped_frames = [frame[crop_y_min:crop_y_max, crop_x_min:crop_x_max] for frame in frames]
    
    # Run YOLO inference on batch
    results = model(cropped_frames, conf=conf_threshold, verbose=False)
    
    # Convert detections to full-frame coordinates for each frame
    batch_detections = []
    for r in results:
        detections = []
        boxes = r.boxes
        if boxes is not None:
            for box in boxes:
                # Get box coordinates in crop space
                x1, y1, x2, y2 = box.xyxy[0].tolist()
                conf = box.conf[0].item()
                
                # Convert to full-frame pixel coordinates
                full_x1 = crop_x_min + x1
                full_y1 = crop_y_min + y1
                full_x2 = crop_x_min + x2
                full_y2 = crop_y_min + y2
                
                # Normalize to 0-1 range
                det = {
                    'x_min': full_x1 / width,
                    'y_min': full_y1 / height,
                    'x_max': full_x2 / width,
                    'y_max': full_y2 / height,
                    'confidence': conf,
                    'side': side
                }
                detections.append(det)
        batch_detections.append(detections)
    
    return batch_detections


def detect_octopus_in_video(video_path: str, model_path: str, tank_bbox: Dict = None,
                            duration: float = 60, hertz: float = 2,
                            conf_threshold: float = 0.25, device: str = None,
                            moondream_device: str = 'mps', scale: float = 0.5,
                            batch_size: int = 4, preprocess: bool = True) -> Dict:
    """
    Run YOLO detection on video, processing tank halves separately with batch processing.
    
    Args:
        video_path: Path to video file
        model_path: Path to trained YOLO model
        tank_bbox: Tank bounding box info (if None, will detect with moondream)
        duration: Maximum duration to process
        hertz: Detection frequency
        conf_threshold: Confidence threshold
        device: Device to use for YOLO
        moondream_device: Device to use for moondream tank detection
        scale: Scale factor for moondream processing
        batch_size: Number of frames to process in parallel (default: 4)
        preprocess: Whether to preprocess keyframes to remove extra detections (default: True)
    
    Returns:
        Dictionary with keyframe detections
    """
    # Detect tank if not provided
    if tank_bbox is None:
        print("Loading moondream model for tank detection...")
        moondream_model = AutoModelForCausalLM.from_pretrained(
            "vikhyatk/moondream2",
            revision="2025-06-21",
            trust_remote_code=True,
            device_map={"": moondream_device}
        )
        
        found, bbox_tuple = find_tank_bbox(video_path, moondream_model, scale=scale)
        if not found:
            raise ValueError("Could not find tank in video")
        
        x_min, y_min, x_max, y_max = bbox_tuple
        tank_bbox = {
            'x_min': x_min,
            'y_min': y_min,
            'x_max': x_max,
            'y_max': y_max,
            'center_x': (x_min + x_max) // 2
        }
        
        # Clean up moondream model
        del moondream_model
        torch.cuda.empty_cache() if torch.cuda.is_available() else None
    # Auto-detect device if not specified
    if device is None:
        if torch.cuda.is_available():
            device = 'cuda'
        elif torch.backends.mps.is_available():
            device = 'mps'
        else:
            device = 'cpu'
    
    
    print(f"Running inference on device: {device}")
    
    # Load model
    model = YOLO(model_path)
    model.to(device)
    
    # Open video
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise ValueError(f"Could not open video: {video_path}")
    
    fps = cap.get(cv2.CAP_PROP_FPS)
    frame_width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    frame_height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    
    # Calculate frame interval
    frame_interval = int(fps / hertz)
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    print(total_frames)
    max_frames = int(fps * duration)
    
    print(f"Video FPS: {fps}")
    print(f"Processing every {frame_interval} frames ({hertz} Hz)")
    
    # Prepare output data
    keyframe_data = {
        'video_info': {
            'filename': video_path,
            'fps': fps,
            'width': frame_width,
            'height': frame_height,
            'duration_processed': 0,
            'total_frames_processed': 0
        },
        'tank_info': {
            'bbox': tank_bbox
        },
        'detection_params': {
            'object': 'octopus',
            'hertz': hertz,
            'max_duration': duration,
            'model': model_path,
            'confidence_threshold': conf_threshold,
            'batch_size': batch_size
        },
        'keyframes': {}
    }
    
    frame_count = 0
    total_left_detections = 0
    total_right_detections = 0
    start_time = time.time()
    
    # Batch processing variables
    batch_frames = []
    batch_frame_numbers = []
    
    print(f"\nProcessing video with batch size: {batch_size}...")
    
    while frame_count < max_frames:
        ret, frame = cap.read()
        if not ret:
            break
        
        # Check if this is a keyframe
        if frame_count % frame_interval == 0 or frame_count == max_frames - 1 or frame_count == total_frames - 1:
            batch_frames.append(frame)
            batch_frame_numbers.append(frame_count)
            
            # Process batch when full or at end of video
            if len(batch_frames) == batch_size or frame_count + frame_interval >= max_frames:
                # Process both tank halves for the batch
                left_batch_detections = process_tank_half_batch(model, batch_frames, tank_bbox, 'left', conf_threshold)
                right_batch_detections = process_tank_half_batch(model, batch_frames, tank_bbox, 'right', conf_threshold)
                
                # Store results for each frame in the batch
                for i, (frame_num, left_dets, right_dets) in enumerate(zip(batch_frame_numbers, 
                                                                           left_batch_detections, 
                                                                           right_batch_detections)):
                    # Store keyframe data
                    keyframe_data['keyframes'][str(frame_num)] = {
                        'timestamp': frame_num / fps,
                        'left_detections': left_dets,
                        'right_detections': right_dets,
                        'has_left_octopus': len(left_dets) > 0,
                        'has_right_octopus': len(right_dets) > 0
                    }
                    
                    total_left_detections += len(left_dets)
                    total_right_detections += len(right_dets)
                    
                    # Report progress
                    left_status = f"{len(left_dets)} octopus" if left_dets else "No octopus"
                    right_status = f"{len(right_dets)} octopus" if right_dets else "No octopus"
                    print(f"Frame {frame_num} (t={frame_num/fps:.2f}s): Left: {left_status}, Right: {right_status}")
                
                # Clear batch
                batch_frames = []
                batch_frame_numbers = []
        
        frame_count += 1
    
    # Process any remaining frames in the batch
    if batch_frames:
        # Process both tank halves for the remaining batch
        left_batch_detections = process_tank_half_batch(model, batch_frames, tank_bbox, 'left', conf_threshold)
        right_batch_detections = process_tank_half_batch(model, batch_frames, tank_bbox, 'right', conf_threshold)
        
        # Store results for each frame in the batch
        for i, (frame_num, left_dets, right_dets) in enumerate(zip(batch_frame_numbers, 
                                                                   left_batch_detections, 
                                                                   right_batch_detections)):
            # Store keyframe data
            keyframe_data['keyframes'][str(frame_num)] = {
                'timestamp': frame_num / fps,
                'left_detections': left_dets,
                'right_detections': right_dets,
                'has_left_octopus': len(left_dets) > 0,
                'has_right_octopus': len(right_dets) > 0
            }
            
            total_left_detections += len(left_dets)
            total_right_detections += len(right_dets)
            
            # Report progress
            left_status = f"{len(left_dets)} octopus" if left_dets else "No octopus"
            right_status = f"{len(right_dets)} octopus" if right_dets else "No octopus"
            print(f"Frame {frame_num} (t={frame_num/fps:.2f}s): Left: {left_status}, Right: {right_status}")
    
    # Update final statistics
    end_time = time.time()
    processing_time = end_time - start_time
    video_duration = frame_count / fps
    
    keyframe_data['video_info']['duration_processed'] = video_duration
    keyframe_data['video_info']['total_frames_processed'] = frame_count
    keyframe_data['processing_stats'] = {
        'processing_time': processing_time,
        'real_time_ratio': video_duration / processing_time,
        'total_keyframes': len(keyframe_data['keyframes']),
        'total_left_detections': total_left_detections,
        'total_right_detections': total_right_detections
    }
    
    cap.release()
    
    print(f"\nProcessing completed:")
    print(f"  Video duration: {video_duration:.2f}s")
    print(f"  Processing time: {processing_time:.2f}s")
    print(f"  Speed: {video_duration/processing_time:.2f}x real-time")
    print(f"  Total left detections: {total_left_detections}")
    print(f"  Total right detections: {total_right_detections}")
    
    # Apply preprocessing if requested
    if preprocess:
        print("\nPreprocessing keyframes to remove extra detections...")
        keyframe_data['keyframes'] = preprocess_keyframes(keyframe_data['keyframes'])
        print("Preprocessing completed.")
    
    return keyframe_data


def main():
    parser = argparse.ArgumentParser(description='Run YOLO octopus detection on video')
    parser.add_argument('video', type=str, help='Path to input video file')
    parser.add_argument('--model', type=str, help='Path to trained YOLO model', default="default_detector.pt")
    parser.add_argument('--tank-keyframes', type=str,
                        help='Path to keyframes JSON with tank bbox info (optional)')
    parser.add_argument('--tank-bbox', type=str,
                        help='Pre-computed tank bounding box as "x_min,y_min,x_max,y_max"')
    parser.add_argument('--duration', type=float, default=3600,
                        help='Maximum duration to process in seconds (default: 60)')
    parser.add_argument('--hertz', type=float, default=2,
                        help='Detection frequency in Hz (default: 2)')
    parser.add_argument('--confidence', type=float, default=0.75,
                        help='Confidence threshold (default: 0.75)')
    parser.add_argument('--output', type=str,
                        help='Output JSON file path (default: <video>_yolo_keyframes.json)')
    parser.add_argument('--device', type=str, choices=['cuda', 'mps', 'cpu'],
                        help='Device to use for YOLO (auto-detected if not specified)')
    parser.add_argument('--moondream-device', type=str, default='mps',
                        help='Device for moondream tank detection (default: mps)')
    parser.add_argument('--scale', type=float, default=0.5,
                        help='Scale factor for moondream processing (default: 0.5)')
    parser.add_argument('--batch-size', type=int, default=4,
                        help='Number of frames to process in parallel (default: 4)')
    parser.add_argument('--no-preprocess', action='store_true',
                        help='Disable preprocessing of keyframes to remove extra detections')
    
    args = parser.parse_args()
    
    # Get tank bbox from various sources
    tank_bbox = None
    
    if args.tank_bbox:
        # Use provided bounding box
        parts = args.tank_bbox.split(',')
        x_min, y_min, x_max, y_max = [int(x) for x in parts]
        tank_bbox = {
            'x_min': x_min,
            'y_min': y_min,
            'x_max': x_max,
            'y_max': y_max,
            'center_x': (x_min + x_max) // 2
        }
        print(f"Using provided tank bounding box: ({x_min}, {y_min}, {x_max}, {y_max})")
    elif args.tank_keyframes:
        # Get from keyframes file
        with open(args.tank_keyframes, 'r') as f:
            data = json.load(f)
        tank_info = data.get('tank_info', {})
        if tank_info:
            tank_bbox = tank_info['bbox']
            print(f"Using tank bbox from keyframes file")
    # If tank_bbox is still None, moondream will detect it
    # Check if video is 4-digit number
    video_path = args.video
    if args.video.isdigit() and len(args.video) == 4:
        video_path = f"videos/MVI_{args.video}_proxy.mp4"
        print(f"Interpreting video as code, using path: {video_path}")
        args.output = f"videos_keyframes/MVI_{args.video}_keyframes.json"
        args.video = video_path

    # Run detection
    keyframe_data = detect_octopus_in_video(
        args.video,
        args.model,
        tank_bbox,
        duration=args.duration,
        hertz=args.hertz,
        conf_threshold=args.confidence,
        device=args.device,
        moondream_device=args.moondream_device,
        scale=args.scale,
        batch_size=args.batch_size,
        preprocess=not args.no_preprocess
    )
    
    # Determine output filename
    if args.output:
        output_path = args.output
    else:
        video_stem = Path(args.video).stem
        output_path = f"{video_stem}_yolo_keyframes.json"
    
    # Save results
    with open(output_path, 'w') as f:
        json.dump(keyframe_data, f, indent=2)
    
    print(f"\nResults saved to: {output_path}")


if __name__ == "__main__":
    main()