/**
 * ActivityAnalyzer - Analyzes octopus activity between frames
 * Calculates movement and activity metrics for tracked objects
 */
import { Events } from '../utils/EventBus.js';
import { binarySearchInArray, calculateIoU, calculateCentroidDistance } from '../utils/MathUtils.js';
import { DEFAULTS } from '../utils/Constants.js';

export class ActivityAnalyzer {
    /**
     * Create an ActivityAnalyzer
     * @param {EventBus} eventBus - Central event system
     * @param {Object} config - Configuration options
     */
    constructor(eventBus, config = {}) {
        this.eventBus = eventBus;
        this.metric = config.metric || DEFAULTS.ACTIVITY_METRIC;
        this.sensitivity = config.sensitivity || DEFAULTS.ACTIVITY_SENSITIVITY;
        
        this.leftActivityData = null;
        this.rightActivityData = null;
        this.maxLeftActivity = 0;
        this.maxRightActivity = 0;
        this.maxInterpolationTime = config.maxInterpolationTime || 15; // seconds
        
        this.setupEventListeners();
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        this.eventBus.on(Events.DATA_LOADED, (data) => {
            this.keyframesData = data.keyframesData;
            this.leftDetectionIndices = data.leftDetectionIndices;
            this.rightDetectionIndices = data.rightDetectionIndices;
            this.keyframeIndices = data.keyframeIndices;
        });
    }

    /**
     * Calculate activity for a specific frame and side
     * @param {number} frame - Frame number
     * @param {string} side - 'left' or 'right'
     * @returns {number} Activity value
     */
    calculateFrameActivity(frame, side) {
        if (!this.keyframesData) return 0;
        
        const fps = this.keyframesData.video_info.fps;

        // Use pre-filtered detection indices for the appropriate side
        const detectionIndices = side === 'left' ? this.leftDetectionIndices : this.rightDetectionIndices;
        
        // Find prev and next keyframes with detections using binary search
        let prevKf = null, nextKf = null;

        const prevIdx = binarySearchInArray(detectionIndices, frame, true);
        if (prevIdx !== -1) {
            prevKf = detectionIndices[prevIdx];
        }

        const nextIdx = binarySearchInArray(detectionIndices, frame, false);
        if (nextIdx !== -1) {
            nextKf = detectionIndices[nextIdx];
        }

        // If no surrounding keyframes with detections, return 0 activity
        if (prevKf === null || nextKf === null) {
            return 0;
        }

        const timeBetweenKfs = (nextKf - prevKf) / fps;
        if (timeBetweenKfs > this.maxInterpolationTime) {
            // If the time between keyframes is too long, return 0 activity
            return 0;
        }

        // Get bounding boxes at the keyframes
        const prevDetections = this.keyframesData.keyframes[prevKf.toString()][`${side}_detections`];
        const nextDetections = this.keyframesData.keyframes[nextKf.toString()][`${side}_detections`];

        if (prevDetections.length === 0 || nextDetections.length === 0) {
            return 0;
        }

        // Compute union bounding box at each keyframe
        const prevBbox = this.computeUnionBbox(prevDetections);
        const nextBbox = this.computeUnionBbox(nextDetections);

        // Calculate difference
        const videoWidth = this.keyframesData.video_info.width;
        const videoHeight = this.keyframesData.video_info.height;

        const prevBboxPixels = {
            x_min: prevBbox.x_min * videoWidth,
            y_min: prevBbox.y_min * videoHeight,
            x_max: prevBbox.x_max * videoWidth,
            y_max: prevBbox.y_max * videoHeight
        };
        
        const nextBboxPixels = {
            x_min: nextBbox.x_min * videoWidth,
            y_min: nextBbox.y_min * videoHeight,
            x_max: nextBbox.x_max * videoWidth,
            y_max: nextBbox.y_max * videoHeight
        };
        
        const pixelDifference = this.calculateBoxDifference(prevBboxPixels, nextBboxPixels);
        
        return pixelDifference;
    }

    /**
     * Calculate the difference between two bounding boxes
     * @param {Object} box1 - First bounding box
     * @param {Object} box2 - Second bounding box
     * @returns {number} Difference value based on metric
     */
    calculateBoxDifference(box1, box2) {
        if (!box1 || !box2) return 0;

        if (this.metric === 'iou') {
            // Use 1 - IoU as the difference metric
            const iou = calculateIoU(box1, box2);
            return 1 - iou;
        } else {
            // Centroid distance metric
            return calculateCentroidDistance(box1, box2);
        }
    }

    /**
     * Compute union bounding box of multiple detections
     * @param {Object[]} detections - Array of detection objects
     * @returns {Object|null} Union bounding box
     */
    computeUnionBbox(detections) {
        if (detections.length === 0) return null;

        let x_min = Math.min(...detections.map(d => d.x_min));
        let y_min = Math.min(...detections.map(d => d.y_min));
        let x_max = Math.max(...detections.map(d => d.x_max));
        let y_max = Math.max(...detections.map(d => d.y_max));

        return { x_min, y_min, x_max, y_max };
    }

    /**
     * Calculate activity data for entire video
     * @returns {Object} Activity data for left and right sides
     */
    calculateActivityData() {
        if (!this.keyframesData) {
            throw new Error('No keyframes data loaded');
        }

        const fps = this.keyframesData.video_info.fps;
        const totalFrames = this.keyframesData.video_info.total_frames_processed;

        // Calculate average keyframe interval
        const keyframeInterval = this.keyframeIndices.length > 1 ? 
            (this.keyframeIndices[this.keyframeIndices.length - 1] - this.keyframeIndices[0]) / (this.keyframeIndices.length - 1) : 
            fps * 0.5; // Default to 0.5 seconds if not enough keyframes
        
        // Sample at half the keyframe interval, offset by quarter interval
        const sampleInterval = Math.max(1, Math.floor(keyframeInterval / 2));
        const sampleOffset = Math.max(1, Math.floor(keyframeInterval / 4));
        
        // Create sparse activity maps
        const leftActivityMap = new Map();
        const rightActivityMap = new Map();
        this.maxLeftActivity = 1;
        this.maxRightActivity = 1;

        // Sample activity at regular intervals
        for (let frame = sampleOffset; frame < totalFrames; frame += sampleInterval) {
            const leftActivity = this.calculateFrameActivity(frame, 'left');
            const rightActivity = this.calculateFrameActivity(frame, 'right');

            leftActivityMap.set(frame, leftActivity);
            rightActivityMap.set(frame, rightActivity);
            this.maxLeftActivity = Math.max(this.maxLeftActivity, leftActivity);
            this.maxRightActivity = Math.max(this.maxRightActivity, rightActivity);
        }

        // Interpolate to create full arrays
        this.leftActivityData = this.interpolateActivityData(leftActivityMap, totalFrames);
        this.rightActivityData = this.interpolateActivityData(rightActivityMap, totalFrames);

        // Emit event
        this.eventBus.emit(Events.ACTIVITY_CALCULATED, {
            leftActivityData: this.leftActivityData,
            rightActivityData: this.rightActivityData,
            maxLeftActivity: this.maxLeftActivity,
            maxRightActivity: this.maxRightActivity
        });

        return {
            leftActivityData: this.leftActivityData,
            rightActivityData: this.rightActivityData,
            maxLeftActivity: this.maxLeftActivity,
            maxRightActivity: this.maxRightActivity
        };
    }

    /**
     * Interpolate sparse activity data to full array
     * @param {Map} activityMap - Sparse activity map
     * @param {number} totalFrames - Total number of frames
     * @returns {Float32Array} Interpolated activity data
     */
    interpolateActivityData(activityMap, totalFrames) {
        const data = new Float32Array(totalFrames);
        const sortedFrames = Array.from(activityMap.keys()).sort((a, b) => a - b);
        
        for (let frame = 0; frame < totalFrames; frame++) {
            if (activityMap.has(frame)) {
                // Use sampled value directly
                data[frame] = activityMap.get(frame);
            } else {
                // Use binary search to find surrounding sample points
                const prevIdx = binarySearchInArray(sortedFrames, frame, true);
                const nextIdx = binarySearchInArray(sortedFrames, frame, false);
                
                const prevFrame = prevIdx !== -1 ? sortedFrames[prevIdx] : -1;
                const nextFrame = nextIdx !== -1 ? sortedFrames[nextIdx] : -1;
                
                if (prevFrame === -1 && nextFrame === -1) {
                    data[frame] = 0;
                } else if (prevFrame === -1) {
                    data[frame] = activityMap.get(nextFrame);
                } else if (nextFrame === -1) {
                    data[frame] = activityMap.get(prevFrame);
                } else {
                    // Linear interpolation
                    const t = (frame - prevFrame) / (nextFrame - prevFrame);
                    const prevValue = activityMap.get(prevFrame);
                    const nextValue = activityMap.get(nextFrame);
                    data[frame] = prevValue + (nextValue - prevValue) * t;
                }
            }
        }
        
        return data;
    }

    /**
     * Update activity metric
     * @param {string} metric - 'iou' or 'centroid'
     */
    setMetric(metric) {
        this.metric = metric;
    }

    /**
     * Update sensitivity
     * @param {number} sensitivity - Sensitivity value
     */
    setSensitivity(sensitivity) {
        this.sensitivity = sensitivity;
    }

    /**
     * Get current activity data
     * @returns {Object} Current activity data
     */
    getActivityData() {
        return {
            leftActivityData: this.leftActivityData,
            rightActivityData: this.rightActivityData,
            maxLeftActivity: this.maxLeftActivity,
            maxRightActivity: this.maxRightActivity,
            metric: this.metric,
            sensitivity: this.sensitivity
        };
    }
}