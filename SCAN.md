# Keyframe Deletion Algorithm

## Overview
This document describes the algorithm for intelligent keyframe deletion based on spatial similarity (IoU - Intersection over Union).

## Algorithm Steps

### 1. Input
- **Timestamp**: The exact timestamp where the user clicked to delete
- **Side**: Which octopus to delete (left/right/both)
- **Deletion Event**: The trigger from the UI

### 2. Find Target Keyframe
- Locate the nearest keyframe to the provided timestamp
- This becomes the "reference keyframe" for the deletion operation

### 3. Extract Reference Bounding Box
- Get the bounding box for the specified side from the reference keyframe
- If no detection exists at this keyframe, abort the deletion

### 4. Define Time Interval via IoU Scanning

#### 4.1 Backward Scan
- Starting from the reference keyframe, scan backward in time
- For each previous keyframe:
  - Calculate IoU between its bounding box and the reference box
  - If IoU ≥ 0.95: Include this keyframe in the deletion interval
  - If IoU < 0.95: Stop scanning, this marks the start of the interval
  - If no detection exists: Stop scanning

#### 4.2 Forward Scan
- Starting from the reference keyframe, scan forward in time
- For each subsequent keyframe:
  - Calculate IoU between its bounding box and the reference box
  - If IoU ≥ 0.95: Include this keyframe in the deletion interval
  - If IoU < 0.95: Stop scanning, this marks the end of the interval
  - If no detection exists: Stop scanning

### 5. Execute Deletion
- For all keyframes within the determined time interval:
  - Delete the bounding box(es) for the specified side(s)
  - Update the detection flags accordingly

## IoU Calculation
```
IoU = Area of Intersection / Area of Union

Where:
- Area of Intersection = overlap between two bounding boxes
- Area of Union = total area covered by both boxes
```

## Rationale
This algorithm ensures that when a user wants to delete a detection, they delete not just a single frame but all temporally adjacent frames where the octopus remains in essentially the same position (IoU ≥ 0.95). This prevents leaving behind "orphaned" detections that are part of the same stationary behavior.

## Example Scenario
If an octopus remains stationary from frames 100-200, clicking anywhere in that range will:
1. Find the nearest keyframe (e.g., frame 150)
2. Scan backward and find IoU remains ≥ 0.95 until frame 100
3. Scan forward and find IoU remains ≥ 0.95 until frame 200
4. Delete all detections for frames 100-200

## Edge Cases
- No detection at clicked timestamp: Abort operation
- Single isolated keyframe: Only delete that keyframe
- IoU threshold boundary: Strict cutoff at 0.95