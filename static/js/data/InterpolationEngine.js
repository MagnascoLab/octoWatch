/**
 * InterpolationEngine - Handles bounding box interpolation between keyframes
 * Provides smooth transitions for object tracking visualization
 */
import { Events } from '../utils/EventBus.js';
import { binarySearchInArray, lerp, computeUnionBbox } from '../utils/MathUtils.js';

export class InterpolationEngine {
    /**
     * Create an InterpolationEngine
     * @param {EventBus} eventBus - Central event system
     */
    constructor(eventBus) {
        this.eventBus = eventBus;
        
        this.keyframesData = null;
        this.keyframeIndices = [];
        this.leftDetectionIndices = [];
        this.rightDetectionIndices = [];
        this.maxInterpolationTime = 15;
        
        this.setupEventListeners();
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        this.eventBus.on(Events.DATA_LOADED, (data) => {
            this.keyframesData = data.keyframesData;
            this.keyframeIndices = data.keyframeIndices;
            this.leftDetectionIndices = data.leftDetectionIndices;
            this.rightDetectionIndices = data.rightDetectionIndices;
        });
    }

    /**
     * Get bounding box at any frame (keyframe or interpolated)
     * @param {number} frame - Frame number
     * @param {string} side - 'left' or 'right'
     * @returns {Object|null} Bounding box or null if not found
     */
    getBboxAtFrame(frame, side) {
        if (!this.keyframesData) return null;

        const keyframe = this.keyframesData.keyframes[frame.toString()];
        
        if (keyframe && keyframe[`${side}_detections`].length > 0) {
            // This is a keyframe with detections
            return computeUnionBbox(keyframe[`${side}_detections`]);
        } else {
            // Try interpolation
            return this.interpolateBbox(frame, side);
        }
    }

    /**
     * Interpolate bounding box between keyframes
     * @param {number} frame - Target frame
     * @param {string} side - 'left' or 'right'
     * @returns {Object|null} Interpolated bounding box
     */
    interpolateBbox(frame, side) {
        const fps = this.keyframesData.video_info.fps;
        const detectionIndices = side === 'left' ? this.leftDetectionIndices : this.rightDetectionIndices;
        
        // Find prev and next keyframes with detections
        const prevIdx = binarySearchInArray(detectionIndices, frame, true);
        const nextIdx = binarySearchInArray(detectionIndices, frame, false);
        
        if (prevIdx === -1 || nextIdx === -1) return null;
        
        const prevKf = detectionIndices[prevIdx];
        const nextKf = detectionIndices[nextIdx];
        
        // Get bounding boxes at the keyframes
        const prevDetections = this.keyframesData.keyframes[prevKf.toString()][`${side}_detections`];
        const nextDetections = this.keyframesData.keyframes[nextKf.toString()][`${side}_detections`];
        
        if (prevDetections.length === 0 || nextDetections.length === 0) return null;
        
        const prevBbox = computeUnionBbox(prevDetections);
        const nextBbox = computeUnionBbox(nextDetections);
        
        // Compute time between keyframes
        const timeBetweenKfs = (nextKf - prevKf) / fps;
        if (timeBetweenKfs > this.maxInterpolationTime) {
            return null;
        }
        // Linear interpolation
        const t = (frame - prevKf) / (nextKf - prevKf);
        
        return {
            x_min: lerp(prevBbox.x_min, nextBbox.x_min, t),
            y_min: lerp(prevBbox.y_min, nextBbox.y_min, t),
            x_max: lerp(prevBbox.x_max, nextBbox.x_max, t),
            y_max: lerp(prevBbox.y_max, nextBbox.y_max, t)
        };
    }

    /**
     * Get interpolated activity data between sparse samples
     * @param {Map} activityMap - Sparse activity map
     * @param {number} totalFrames - Total number of frames
     * @returns {Float32Array} Interpolated activity data
     */
    interpolateActivityData(activityMap, totalFrames) {
        const data = new Float32Array(totalFrames);
        const sortedFrames = Array.from(activityMap.keys()).sort((a, b) => a - b);
        
        if (sortedFrames.length === 0) return data;
        
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
                    data[frame] = lerp(prevValue, nextValue, t);
                }
            }
        }
        
        return data;
    }

    /**
     * Check if interpolation is available for a frame
     * @param {number} frame - Frame number
     * @param {string} side - 'left' or 'right'
     * @returns {boolean} True if interpolation is possible
     */
    canInterpolate(frame, side) {
        const detectionIndices = side === 'left' ? this.leftDetectionIndices : this.rightDetectionIndices;
        
        const prevIdx = binarySearchInArray(detectionIndices, frame, true);
        const nextIdx = binarySearchInArray(detectionIndices, frame, false);
        
        return prevIdx !== -1 && nextIdx !== -1;
    }

    /**
     * Get nearest keyframes for a given frame
     * @param {number} frame - Frame number
     * @param {string} side - 'left' or 'right'
     * @returns {Object} Previous and next keyframe indices
     */
    getNearestKeyframes(frame, side) {
        const detectionIndices = side === 'left' ? this.leftDetectionIndices : this.rightDetectionIndices;
        
        const prevIdx = binarySearchInArray(detectionIndices, frame, true);
        const nextIdx = binarySearchInArray(detectionIndices, frame, false);
        
        return {
            previous: prevIdx !== -1 ? detectionIndices[prevIdx] : null,
            next: nextIdx !== -1 ? detectionIndices[nextIdx] : null
        };
    }

    /**
     * Get interpolation info for current frame
     * @param {number} frame - Frame number
     * @returns {Object} Interpolation information
     */
    getInterpolationInfo(frame) {
        const info = {
            isKeyframe: false,
            leftInterpolated: false,
            rightInterpolated: false,
            leftKeyframes: null,
            rightKeyframes: null
        };

        if (this.keyframesData) {
            const keyframe = this.keyframesData.keyframes[frame.toString()];
            info.isKeyframe = !!keyframe;

            if (!info.isKeyframe) {
                // Check if interpolation is being used
                info.leftKeyframes = this.getNearestKeyframes(frame, 'left');
                info.rightKeyframes = this.getNearestKeyframes(frame, 'right');
                
                info.leftInterpolated = info.leftKeyframes.previous !== null && 
                                       info.leftKeyframes.next !== null;
                info.rightInterpolated = info.rightKeyframes.previous !== null && 
                                        info.rightKeyframes.next !== null;
            }
        }

        return info;
    }
}