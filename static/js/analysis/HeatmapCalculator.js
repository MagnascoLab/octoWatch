/**
 * HeatmapCalculator - Calculates spatial heatmaps of octopus presence
 * Creates 2D heatmaps showing cumulative octopus locations over time
 */
import { Events } from '../utils/EventBus.js';
import { DEFAULTS } from '../utils/Constants.js';

export class HeatmapCalculator {
    /**
     * Create a HeatmapCalculator
     * @param {EventBus} eventBus - Central event system
     * @param {Object} config - Configuration options
     */
    constructor(eventBus, config = {}) {
        this.eventBus = eventBus;
        
        // Heatmap data
        this.leftHeatmap = null;
        this.rightHeatmap = null;
        this.heatmapWidth = 0;
        this.heatmapHeight = 0;
        this.leftMaxValue = 0;
        this.rightMaxValue = 0;
        
        // References to data
        this.keyframesData = null;
        this.interpolationEngine = null;
        
        this.setupEventListeners();
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        this.eventBus.on(Events.DATA_LOADED, (data) => {
            this.keyframesData = data.keyframesData;
        });
    }

    /**
     * Set interpolation engine reference
     * @param {InterpolationEngine} interpolationEngine - Interpolation engine instance
     */
    setInterpolationEngine(interpolationEngine) {
        this.interpolationEngine = interpolationEngine;
    }

    /**
     * Calculate spatial heatmaps for entire video
     * @returns {Object} Heatmap data for left and right sides
     */
    calculateHeatmaps() {
        if (!this.keyframesData || !this.interpolationEngine) {
            throw new Error('Missing required data for heatmap calculation');
        }

        const videoInfo = this.keyframesData.video_info;
        const tankInfo = this.keyframesData.tank_info;
        const totalFrames = videoInfo.total_frames_processed;
        
        // Calculate heatmap dimensions (half tank width for each side)
        const tankWidth = tankInfo.bbox.x_max - tankInfo.bbox.x_min;
        const tankHeight = tankInfo.bbox.y_max - tankInfo.bbox.y_min;
        
        // Use video resolution to determine heatmap resolution
        this.heatmapWidth = Math.floor(tankWidth / 2);
        this.heatmapHeight = Math.floor(tankHeight);
        
        // Initialize heatmaps
        const heatmapSize = this.heatmapWidth * this.heatmapHeight;
        this.leftHeatmap = new Float32Array(heatmapSize);
        this.rightHeatmap = new Float32Array(heatmapSize);
        
        // Tank boundaries in normalized coordinates
        const tankLeft = tankInfo.bbox.x_min;
        const tankTop = tankInfo.bbox.y_min;
        const tankCenterX = tankInfo.bbox.center_x;
        const fps = videoInfo.fps;
        // Process each frame
        let frame = 0;
        while (frame < totalFrames) {
            //let step = Math.ceil(25 + Math.random() * 50);
            let step = Math.ceil(fps * (0.5 + Math.random()));
            frame += step;
            // Process left side
            const leftBbox = this.interpolationEngine.getBboxAtFrame(frame, 'left');
            if (leftBbox) {
                this.addBboxToHeatmap(
                    leftBbox, 
                    this.leftHeatmap, 
                    tankLeft, 
                    tankTop, 
                    tankLeft, 
                    tankCenterX,
                    videoInfo.width,
                    videoInfo.height,
                    step 
                );
            }
            
            // Process right side
            const rightBbox = this.interpolationEngine.getBboxAtFrame(frame, 'right');
            if (rightBbox) {
                this.addBboxToHeatmap(
                    rightBbox, 
                    this.rightHeatmap, 
                    tankLeft, 
                    tankTop,
                    tankCenterX,
                    tankInfo.bbox.x_max,
                    videoInfo.width,
                    videoInfo.height,
                    step
                );
            }
        }
        
        // Normalize heatmaps
        this.normalizeHeatmap(this.leftHeatmap);
        this.normalizeHeatmap(this.rightHeatmap);
        // Emit event
        this.eventBus.emit(Events.HEATMAP_CALCULATED, {
            leftHeatmap: this.leftHeatmap,
            rightHeatmap: this.rightHeatmap,
            heatmapWidth: this.heatmapWidth,
            heatmapHeight: this.heatmapHeight,
            leftMaxValue: this.leftMaxValue,
            rightMaxValue: this.rightMaxValue
        });
        
        return {
            leftHeatmap: this.leftHeatmap,
            rightHeatmap: this.rightHeatmap,
            heatmapWidth: this.heatmapWidth,
            heatmapHeight: this.heatmapHeight,
            leftMaxValue: this.leftMaxValue,
            rightMaxValue: this.rightMaxValue
        };
    }

    /**
     * Add a bounding box to the heatmap
     * @param {Object} bbox - Bounding box in normalized coordinates
     * @param {Float32Array} heatmap - Heatmap array to update
     * @param {number} tankLeft - Tank left boundary (normalized)
     * @param {number} tankTop - Tank top boundary (normalized)
     * @param {number} sideLeft - Side left boundary (normalized)
     * @param {number} sideRight - Side right boundary (normalized)
     * @param {number} videoWidth - Video width in pixels
     * @param {number} videoHeight - Video height in pixels
     */
    addBboxToHeatmap(bbox, heatmap, tankLeft, tankTop, sideLeft, sideRight, videoWidth, videoHeight, strength) {
        // Convert normalized bbox to pixel coordinates relative to the side
        const sideWidth = sideRight - sideLeft;
        // Convert to pixel coordinates in video space
        const bboxLeftPx = Math.max(bbox.x_min * videoWidth, sideLeft);
        const bboxRightPx = Math.min(bbox.x_max * videoWidth, sideRight);
        const bboxTopPx = bbox.y_min * videoHeight;
        const bboxBottomPx = bbox.y_max * videoHeight;
        // Convert to heatmap coordinates (relative to side)
        const heatmapLeft = Math.floor((bboxLeftPx - sideLeft) / sideWidth * this.heatmapWidth);
        const heatmapRight = Math.ceil((bboxRightPx - sideLeft) / sideWidth * this.heatmapWidth);
        const heatmapTop = Math.floor(bboxTopPx - tankTop);
        const heatmapBottom = Math.ceil(bboxBottomPx - tankTop);
        // Clamp to heatmap bounds
        const x1 = Math.max(0, heatmapLeft);
        const x2 = Math.min(this.heatmapWidth - 1, heatmapRight);
        const y1 = Math.max(0, heatmapTop);
        const y2 = Math.min(this.heatmapHeight - 1, heatmapBottom);
        // Increment pixels in the bounding box
        const xDist = x2 - x1;
        const yDist = y2 - y1;
        const invXDist = 1/xDist;
        const invYDist = 1/yDist;
        for (let y = y1; y <= y2; y++) {
            for (let x = x1; x <= x2; x++) {
                /*const idx = y * this.heatmapWidth + x;
                heatmap[idx] += 1;*/
                // Put into space of box
                const xPercent = (x - x1) * invXDist;
                const yPercent = (y - y1) * invYDist;
                // Compute distance from 0.5
                const xPercentMinusHalf = xPercent - 0.5;
                const yPercentMinusHalf = yPercent - 0.5;
                const radius = Math.min(2 * Math.sqrt(xPercentMinusHalf * xPercentMinusHalf + yPercentMinusHalf * yPercentMinusHalf), 1);
                
                const intensity = (1 - radius) * (1 - radius); // Falloff from center
                const idx = y * this.heatmapWidth + x;
                heatmap[idx] += intensity * strength;
            }
        }
    }

    /**
     * Normalize heatmap values to 0-1 range
     * @param {Float32Array} heatmap - Heatmap to normalize
     */
    normalizeHeatmap(heatmap) {
        // Start w/ a max value equal to 15 seconds of video
        const fps = this.keyframesData.video_info.fps;
        let maxValue = 15 * fps; // 15 seconds of video at current FPS
        for (let i = 0; i < heatmap.length; i++) {
            maxValue = Math.max(maxValue, heatmap[i]);
        }
        
        // Store max value
        if (heatmap === this.leftHeatmap) {
            this.leftMaxValue = maxValue;
        } else {
            this.rightMaxValue = maxValue;
        }
        
        // Normalize if max > 0
        if (maxValue > 0) {
            for (let i = 0; i < heatmap.length; i++) {
                heatmap[i] /= maxValue;
                heatmap[i] = Math.sqrt(heatmap[i]); // Optional: square root for better distribution
            }
        }
    }

    /**
     * Get current heatmap data
     * @returns {Object} Current heatmap data
     */
    getHeatmapData() {
        return {
            leftHeatmap: this.leftHeatmap,
            rightHeatmap: this.rightHeatmap,
            heatmapWidth: this.heatmapWidth,
            heatmapHeight: this.heatmapHeight,
            leftMaxValue: this.leftMaxValue,
            rightMaxValue: this.rightMaxValue
        };
    }

    /**
     * Check if heatmaps have been calculated
     * @returns {boolean} True if calculated
     */
    isCalculated() {
        return this.leftHeatmap !== null && this.rightHeatmap !== null;
    }

    /**
     * Clear heatmap data
     */
    clear() {
        this.leftHeatmap = null;
        this.rightHeatmap = null;
        this.heatmapWidth = 0;
        this.heatmapHeight = 0;
        this.leftMaxValue = 0;
        this.rightMaxValue = 0;
    }
}