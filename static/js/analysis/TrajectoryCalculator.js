/**
 * TrajectoryCalculator - Calculates and manages octopus movement trajectories
 * Tracks centroid positions over time for visualization
 */
import { Events } from '../utils/EventBus.js';
import { DEFAULTS, ANALYSIS } from '../utils/Constants.js';

export class TrajectoryCalculator {
    /**
     * Create a TrajectoryCalculator
     * @param {EventBus} eventBus - Central event system
     * @param {Object} config - Configuration options
     */
    constructor(eventBus, config = {}) {
        this.eventBus = eventBus;
        this.trajectoryAlpha = config.alpha || DEFAULTS.TRAJECTORY_ALPHA;
        
        this.leftTrajectory = [];
        this.rightTrajectory = [];
        this.trajectoryCalculated = false;
        
        this.setupEventListeners();
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        this.eventBus.on(Events.DATA_LOADED, (data) => {
            this.keyframesData = data.keyframesData;
            // Reset trajectories when new data is loaded
            this.leftTrajectory = [];
            this.rightTrajectory = [];
            this.trajectoryCalculated = false;
        });
    }

    /**
     * Calculate trajectories for both sides
     * @param {Function} getBboxAtFrame - Function to get bounding box at a frame
     * @returns {Object} Trajectory data for left and right sides
     */
    calculateTrajectories(getBboxAtFrame) {
        if (!this.keyframesData) {
            throw new Error('No keyframes data loaded');
        }

        const totalFrames = this.keyframesData.video_info.total_frames_processed;
        const fps = this.keyframesData.video_info.fps;
        const hertz = this.keyframesData.detection_params?.hertz || DEFAULTS.DETECTION_HERTZ;
        
        // Sample at the detection rate
        const sampleInterval = Math.max(1, fps / hertz);
        
        this.leftTrajectory = [];
        this.rightTrajectory = [];
        
        for (let frame = 0; frame < totalFrames; frame += sampleInterval) {
            // Get bounding box for this frame
            const leftBbox = getBboxAtFrame(frame, 'left');
            const rightBbox = getBboxAtFrame(frame, 'right');
            
            // Store centroid positions
            if (leftBbox) {
                const centroid = this.calculateCentroid(leftBbox);
                this.leftTrajectory.push({
                    x: centroid.x,
                    y: centroid.y,
                    frame: frame,
                    progress: frame / totalFrames
                });
            }
            
            if (rightBbox) {
                const centroid = this.calculateCentroid(rightBbox);
                this.rightTrajectory.push({
                    x: centroid.x,
                    y: centroid.y,
                    frame: frame,
                    progress: frame / totalFrames
                });
            }
        }
        
        this.trajectoryCalculated = true;

        // Emit event
        this.eventBus.emit(Events.TRAJECTORY_CALCULATED, {
            leftTrajectory: this.leftTrajectory,
            rightTrajectory: this.rightTrajectory
        });

        return {
            leftTrajectory: this.leftTrajectory,
            rightTrajectory: this.rightTrajectory
        };
    }

    /**
     * Calculate centroid of a bounding box
     * @param {Object} bbox - Bounding box {x_min, y_min, x_max, y_max}
     * @returns {Object} Centroid {x, y}
     */
    calculateCentroid(bbox) {
        return {
            x: (bbox.x_min + bbox.x_max) / 2,
            y: (bbox.y_min + bbox.y_max) / 2
        };
    }

    /**
     * Get trajectory for a specific side
     * @param {string} side - 'left' or 'right'
     * @returns {Array} Trajectory points
     */
    getTrajectory(side) {
        return side === 'left' ? this.leftTrajectory : this.rightTrajectory;
    }

    /**
     * Get all trajectory data
     * @returns {Object} All trajectory data
     */
    getTrajectoryData() {
        return {
            leftTrajectory: this.leftTrajectory,
            rightTrajectory: this.rightTrajectory,
            trajectoryCalculated: this.trajectoryCalculated,
            alpha: this.trajectoryAlpha
        };
    }

    /**
     * Update trajectory alpha (transparency)
     * @param {number} alpha - Alpha value (0-1)
     */
    setAlpha(alpha) {
        this.trajectoryAlpha = alpha;
    }

    /**
     * Check if trajectories have been calculated
     * @returns {boolean} True if trajectories are calculated
     */
    isCalculated() {
        return this.trajectoryCalculated;
    }

    /**
     * Get trajectory at specific frame
     * @param {number} frame - Frame number
     * @param {string} side - 'left' or 'right'
     * @returns {Object|null} Trajectory point at frame or null
     */
    getTrajectoryAtFrame(frame, side) {
        const trajectory = this.getTrajectory(side);
        
        // Find closest trajectory point to the frame
        let closestPoint = null;
        let minDistance = Infinity;
        
        for (const point of trajectory) {
            const distance = Math.abs(point.frame - frame);
            if (distance < minDistance) {
                minDistance = distance;
                closestPoint = point;
            }
        }
        
        return closestPoint;
    }

    /**
     * Get trajectory statistics
     * @param {string} side - 'left' or 'right'
     * @returns {Object} Statistics about the trajectory
     */
    getTrajectoryStats(side) {
        const trajectory = this.getTrajectory(side);
        
        if (trajectory.length === 0) {
            return null;
        }

        // Calculate total distance traveled
        let totalDistance = 0;
        for (let i = 1; i < trajectory.length; i++) {
            const p1 = trajectory[i - 1];
            const p2 = trajectory[i];
            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            totalDistance += Math.sqrt(dx * dx + dy * dy);
        }

        // Calculate bounding box of trajectory
        const xs = trajectory.map(p => p.x);
        const ys = trajectory.map(p => p.y);
        const bounds = {
            x_min: Math.min(...xs),
            x_max: Math.max(...xs),
            y_min: Math.min(...ys),
            y_max: Math.max(...ys)
        };

        return {
            pointCount: trajectory.length,
            totalDistance,
            bounds,
            startPoint: trajectory[0],
            endPoint: trajectory[trajectory.length - 1]
        };
    }

    /**
     * Clear all trajectory data
     */
    clear() {
        this.leftTrajectory = [];
        this.rightTrajectory = [];
        this.trajectoryCalculated = false;
    }
}