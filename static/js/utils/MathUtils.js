/**
 * MathUtils - Mathematical utilities for data processing
 * Provides binary search, interpolation, and other mathematical functions
 */

/**
 * Binary search to find the closest keyframe index
 * @param {number[]} keyframeIndices - Sorted array of keyframe indices
 * @param {number} frame - Target frame number
 * @param {boolean} searchPrev - If true, find previous keyframe; if false, find next
 * @returns {number} Index in keyframeIndices array, or -1 if not found
 */
export function binarySearchKeyframe(keyframeIndices, frame, searchPrev) {
    let left = 0;
    let right = keyframeIndices.length - 1;
    let result = -1;
    
    while (left <= right) {
        const mid = Math.floor((left + right) / 2);
        const kf = keyframeIndices[mid];
        
        if (searchPrev) {
            // Looking for the largest frame <= target
            if (kf <= frame) {
                result = mid;
                left = mid + 1;
            } else {
                right = mid - 1;
            }
        } else {
            // Looking for the smallest frame > target
            if (kf > frame) {
                result = mid;
                right = mid - 1;
            } else {
                left = mid + 1;
            }
        }
    }
    
    return result;
}

/**
 * Binary search in a specific array
 * @param {number[]} arr - Sorted array to search
 * @param {number} frame - Target frame number
 * @param {boolean} searchPrev - If true, find previous; if false, find next
 * @returns {number} Index in array, or -1 if not found
 */
export function binarySearchInArray(arr, frame, searchPrev) {
    let left = 0;
    let right = arr.length - 1;
    let result = -1;
    
    while (left <= right) {
        const mid = Math.floor((left + right) / 2);
        const kf = arr[mid];
        
        if (searchPrev) {
            // Looking for the largest frame <= target
            if (kf <= frame) {
                result = mid;
                left = mid + 1;
            } else {
                right = mid - 1;
            }
        } else {
            // Looking for the smallest frame > target
            if (kf > frame) {
                result = mid;
                right = mid - 1;
            } else {
                left = mid + 1;
            }
        }
    }
    
    return result;
}

/**
 * Linear interpolation between two values
 * @param {number} a - First value
 * @param {number} b - Second value
 * @param {number} t - Interpolation factor (0-1)
 * @returns {number} Interpolated value
 */
export function lerp(a, b, t) {
    return a + (b - a) * t;
}

/**
 * Clamp a value between min and max
 * @param {number} value - Value to clamp
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {number} Clamped value
 */
export function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

/**
 * Convert HSL to RGB
 * @param {number} h - Hue (0-360)
 * @param {number} s - Saturation (0-1)
 * @param {number} l - Lightness (0-1)
 * @returns {number[]} RGB array [r, g, b] with values 0-1
 */
export function hslToRgb(h, s, l) {
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs((h / 60) % 2 - 1));
    const m = l - c / 2;
    
    let r, g, b;
    
    if (h >= 0 && h < 60) {
        r = c; g = x; b = 0;
    } else if (h >= 60 && h < 120) {
        r = x; g = c; b = 0;
    } else if (h >= 120 && h < 180) {
        r = 0; g = c; b = x;
    } else if (h >= 180 && h < 240) {
        r = 0; g = x; b = c;
    } else if (h >= 240 && h < 300) {
        r = x; g = 0; b = c;
    } else {
        r = c; g = 0; b = x;
    }
    
    return [r + m, g + m, b + m];
}

/**
 * Calculate the intersection over union (IoU) of two bounding boxes
 * @param {Object} box1 - First bounding box {x_min, y_min, x_max, y_max}
 * @param {Object} box2 - Second bounding box
 * @returns {number} IoU value between 0 and 1
 */
export function calculateIoU(box1, box2) {
    // Calculate intersection
    const x1 = Math.max(box1.x_min, box2.x_min);
    const y1 = Math.max(box1.y_min, box2.y_min);
    const x2 = Math.min(box1.x_max, box2.x_max);
    const y2 = Math.min(box1.y_max, box2.y_max);

    let intersection = 0;
    if (x2 > x1 && y2 > y1) {
        intersection = (x2 - x1) * (y2 - y1);
    }

    // Calculate areas
    const area1 = (box1.x_max - box1.x_min) * (box1.y_max - box1.y_min);
    const area2 = (box2.x_max - box2.x_min) * (box2.y_max - box2.y_min);

    // Calculate union
    const union = area1 + area2 - intersection;

    // Return IoU
    return union > 0 ? intersection / union : 0;
}

/**
 * Calculate the distance between two bounding box centroids
 * @param {Object} box1 - First bounding box {x_min, y_min, x_max, y_max}
 * @param {Object} box2 - Second bounding box
 * @returns {number} Euclidean distance between centroids
 */
export function calculateCentroidDistance(box1, box2) {
    // Calculate centroids
    const centroid1X = (box1.x_min + box1.x_max) / 2;
    const centroid1Y = (box1.y_min + box1.y_max) / 2;
    const centroid2X = (box2.x_min + box2.x_max) / 2;
    const centroid2Y = (box2.y_min + box2.y_max) / 2;

    // Calculate distance
    const dx = centroid2X - centroid1X;
    const dy = centroid2Y - centroid1Y;
    return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Get the next power of 2
 * @param {number} n - Input number
 * @returns {number} Next power of 2
 */
export function nextPowerOf2(n) {
    return Math.pow(2, Math.ceil(Math.log2(n)));
}

/**
 * Normalize a value to 0-1 range
 * @param {number} value - Value to normalize
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {number} Normalized value between 0 and 1
 */
export function normalize(value, min, max) {
    if (max === min) return 0;
    return (value - min) / (max - min);
}

/**
 * Apply power transformation for sensitivity adjustment
 * @param {number} value - Input value (0-1)
 * @param {number} sensitivity - Sensitivity factor
 * @returns {number} Transformed value (0-1)
 */
export function applySensitivity(value, sensitivity) {
    return Math.pow(value, 1.0 / sensitivity);
}

/**
 * Compute union bounding box of multiple detections
 * @param {Object[]} detections - Array of bounding boxes
 * @returns {Object|null} Union bounding box or null if no detections
 */
export function computeUnionBbox(detections) {
    if (detections.length === 0) return null;

    let x_min = Math.min(...detections.map(d => d.x_min));
    let y_min = Math.min(...detections.map(d => d.y_min));
    let x_max = Math.max(...detections.map(d => d.x_max));
    let y_max = Math.max(...detections.map(d => d.y_max));

    return { x_min, y_min, x_max, y_max };
}