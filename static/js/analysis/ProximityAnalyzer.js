/**
 * ProximityAnalyzer - Analyzes proximity of octopus to mirror
 * Calculates distance-based metrics for both sides of the tank
 */
import { Events } from '../utils/EventBus.js';
import { DEFAULTS } from '../utils/Constants.js';
import { clamp } from '../utils/MathUtils.js';

export class ProximityAnalyzer {
    /**
     * Create a ProximityAnalyzer
     * @param {EventBus} eventBus - Central event system
     * @param {Object} config - Configuration options
     */
    constructor(eventBus, config = {}) {
        this.eventBus = eventBus;
        this.metric = config.metric || DEFAULTS.PROXIMITY_METRIC;
        this.sensitivity = config.sensitivity || DEFAULTS.PROXIMITY_SENSITIVITY;
        
        this.leftProximityData = null;
        this.rightProximityData = null;
        
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
     * Calculate proximity data for entire video
     * @param {Function} getBboxAtFrame - Function to get bounding box at a frame
     * @returns {Object} Proximity data for left and right sides
     */
    calculateProximityData(getBboxAtFrame) {
        if (!this.keyframesData) {
            throw new Error('No keyframes data loaded');
        }

        const totalFrames = this.keyframesData.video_info.total_frames_processed;
        const tankBbox = this.keyframesData.tank_info.bbox;
        const videoWidth = this.keyframesData.video_info.width;
        
        // Convert tank bbox to normalized coordinates
        const mirrorX = tankBbox.center_x / videoWidth;
        const mirrorY = tankBbox.center_y / this.keyframesData.video_info.height;
        const tankMinX = tankBbox.x_min / videoWidth;
        const tankMaxX = tankBbox.x_max / videoWidth;
        const tankMinY = tankBbox.y_min / this.keyframesData.video_info.height;
        const tankMaxY = tankBbox.y_max / this.keyframesData.video_info.height;
        
        this.leftProximityData = new Float32Array(totalFrames);
        this.rightProximityData = new Float32Array(totalFrames);
        this.leftVerticalData = new Float32Array(totalFrames);
        this.rightVerticalData = new Float32Array(totalFrames);
        
        for (let frame = 0; frame < totalFrames; frame++) {
            // Get bounding box for this frame (keyframe or interpolated) - already in normalized coords
            const leftBbox = getBboxAtFrame(frame, 'left');
            const rightBbox = getBboxAtFrame(frame, 'right');
            
            // Calculate proximity for left side
            if (leftBbox) {
                const proximity = this.calculateSideProximity(
                    leftBbox, 
                    mirrorX, 
                    tankMinX, 
                    tankMaxX, 
                    'left'
                );
                this.leftProximityData[frame] = proximity;
                const verticalProximity = this.calculateVerticalProximity(
                    leftBbox,
                    tankMinY,
                    tankMaxY
                );
                this.leftVerticalData[frame] = verticalProximity;
            } else {
                this.leftProximityData[frame] = 0;
                this.leftVerticalData[frame] = 0;
            }
            
            // Calculate proximity for right side
            if (rightBbox) {
                const proximity = this.calculateSideProximity(
                    rightBbox, 
                    mirrorX, 
                    tankMinX, 
                    tankMaxX, 
                    'right'
                );
                this.rightProximityData[frame] = proximity;
                const verticalProximity = this.calculateVerticalProximity(
                    rightBbox,
                    tankMinY,
                    tankMaxY
                );
                this.rightVerticalData[frame] = verticalProximity;
            } else {
                this.rightProximityData[frame] = 0;
                this.rightVerticalData[frame] = 0;
            }
        }

        // Emit event
        this.eventBus.emit(Events.PROXIMITY_CALCULATED, {
            leftProximityData: this.leftProximityData,
            rightProximityData: this.rightProximityData,
            leftVerticalData: this.leftVerticalData,
            rightVerticalData: this.rightVerticalData
        });

        return {
            leftProximityData: this.leftProximityData,
            rightProximityData: this.rightProximityData,
            leftVerticalData: this.leftVerticalData,
            rightVerticalData: this.rightVerticalData
        };
    }

    /**
     * Calculate proximity for a single side
     * @param {Object} bbox - Bounding box
     * @param {number} mirrorX - Mirror X position (normalized)
     * @param {number} tankMinX - Tank minimum X (normalized)
     * @param {number} tankMaxX - Tank maximum X (normalized)
     * @param {string} side - 'left' or 'right'
     * @returns {number} Proximity value (0-1)
     */
    calculateSideProximity(bbox, mirrorX, tankMinX, tankMaxX, side) {
        let distance, totalDistance;

        if (side === 'left') {
            if (this.metric === 'edge') {
                // Edge-based: rightmost point to mirror
                distance = mirrorX - bbox.x_max;
                totalDistance = mirrorX - tankMinX;
            } else {
                // Centroid-based
                const centroidX = (bbox.x_min + bbox.x_max) / 2;
                distance = Math.abs(mirrorX - centroidX);
                totalDistance = mirrorX - tankMinX;
            }
        } else { // right side
            if (this.metric === 'edge') {
                // Edge-based: leftmost point to mirror
                distance = bbox.x_min - mirrorX;
                totalDistance = tankMaxX - mirrorX;
            } else {
                // Centroid-based
                const centroidX = (bbox.x_min + bbox.x_max) / 2;
                distance = Math.abs(centroidX - mirrorX);
                totalDistance = tankMaxX - mirrorX;
            }
        }

        // Calculate proximity as inverse of normalized distance
        const normalizedDistance = distance / totalDistance;
        return clamp(1 - normalizedDistance, 0, 1);
    }

    /**
     * Calculate vertical proximity to the bottom from a single side
     * @param {Object} bbox - Bounding box
     * @param {number} tankMinY - Tank minimum Y (normalized)
     * @param {number} tankMaxY - Tank maximum Y (normalized)
     * @param {string} side - 'left' or 'right'
     * @returns {number} Vertical proximity value (0-1)
     */
    calculateVerticalProximity(bbox, tankMinY, tankMaxY) {
        let distance, totalDistance;

        if (this.metric === 'edge') {
            // Edge-based: bottom edge to tank bottom
            distance = tankMaxY - bbox.y_min;
            totalDistance = tankMaxY - tankMinY;
        } else {
            // Centroid-based: centroid Y to tank bottom
            const centroidY = (bbox.y_min + bbox.y_max) / 2;
            distance = tankMaxY - centroidY;
            totalDistance = tankMaxY - tankMinY;
        }
        // Calculate vertical proximity as inverse of normalized distance
        const normalizedDistance = distance / totalDistance;
        return clamp(normalizedDistance, 0, 1);
    }

    /**
     * Update proximity metric
     * @param {string} metric - 'edge' or 'centroid'
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
     * Get current proximity data
     * @returns {Object} Current proximity data
     */
    getProximityData() {
        return {
            leftProximityData: this.leftProximityData,
            rightProximityData: this.rightProximityData,
            leftVerticalData: this.leftVerticalData,
            rightVerticalData: this.rightVerticalData,
            metric: this.metric,
            sensitivity: this.sensitivity
        };
    }

    /**
     * Get mirror position information
     * @returns {Object} Mirror position data
     */
    getMirrorInfo() {
        if (!this.keyframesData) return null;

        const tankBbox = this.keyframesData.tank_info.bbox;
        const videoWidth = this.keyframesData.video_info.width;

        return {
            mirrorX: tankBbox.center_x / videoWidth,
            tankMinX: tankBbox.x_min / videoWidth,
            tankMaxX: tankBbox.x_max / videoWidth
        };
    }
}