/**
 * ZoneAnalyzer - Analyzes octopus position within behavioral zones
 * Tracks percentage of time spent in different tank regions
 */
import { Events } from '../utils/EventBus.js';

export class ZoneAnalyzer {
    /**
     * Create a ZoneAnalyzer
     * @param {EventBus} eventBus - Central event system
     */
    constructor(eventBus) {
        this.eventBus = eventBus;
        
        this.keyframesData = null;
        this.interpolationEngine = null;
        
        // Zone data storage
        this.leftZoneData = null;
        this.rightZoneData = null;
        this.overlapZoneData = null;
        
        // Zone definitions
        this.zones = ['D', 'MP', 'H1', 'H2', 'T', 'B', 'H1T', 'H1B', 'H2T', 'H2B', 'MPT', 'MPB'];
        // Overlap zones (when both octopuses are in same zone)
        this.overlapZones = ['DO', 'MPO', 'H1O', 'H2O', 'TO', 'BO', 'H1TO', 'H1BO', 'H2TO', 'H2BO', 'MPTO', 'MPBO'];
        this.mpThreshold = 1/12; // Distance threshold for mirror partition zone
        
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
     * Calculate zone occupancy for entire video
     * @returns {Object} Zone occupancy data for left and right sides
     */
    calculateZoneOccupancy() {
        if (!this.keyframesData || !this.interpolationEngine) {
            throw new Error('Missing required data for zone analysis');
        }
        console.time();
        const totalFrames = this.keyframesData.video_info.total_frames_processed;
        const tankInfo = this.keyframesData.tank_info;
        
        // Initialize zone counters and frame assignments
        const leftZoneCounts = {};
        const rightZoneCounts = {};
        const overlapZoneCounts = {};
        const leftFrameZones = new Array(totalFrames);
        const rightFrameZones = new Array(totalFrames);
        const overlapFrameZones = new Array(totalFrames);
        
        // Initialize counters for all zone combinations
        this.zones.forEach(zone => {
            leftZoneCounts[zone] = 0;
            rightZoneCounts[zone] = 0;
        });
        
        // Initialize overlap zone counters
        this.overlapZones.forEach(zone => {
            overlapZoneCounts[zone] = 0;
        });
        
        // Process each frame
        for (let frame = 0; frame < totalFrames; frame++) {
            // Get zone fractions for this frame
            const leftZoneFractions = this.getZonesForFrame(frame, 'left', tankInfo);
            const rightZoneFractions = this.getZonesForFrame(frame, 'right', tankInfo);
            
            // Calculate overlap fractions using geometric mean
            const overlapFractions = {};
            for (const zone of this.zones) {
                const overlapZone = zone + 'O';
                overlapFractions[overlapZone] = Math.sqrt(
                    leftZoneFractions[zone] * rightZoneFractions[zone]
                );
            }
            
            // Store frame assignments
            leftFrameZones[frame] = leftZoneFractions;
            rightFrameZones[frame] = rightZoneFractions;
            overlapFrameZones[frame] = overlapFractions;
            
            // Add fractional counts
            for (const [zone, fraction] of Object.entries(leftZoneFractions)) {
                if (fraction > 0) {
                    leftZoneCounts[zone] += fraction;
                }
            }
            for (const [zone, fraction] of Object.entries(rightZoneFractions)) {
                if (fraction > 0) {
                    rightZoneCounts[zone] += fraction;
                }
            }
            for (const [zone, fraction] of Object.entries(overlapFractions)) {
                if (fraction > 0) {
                    overlapZoneCounts[zone] += fraction;
                }
            }
        }
        
        // Calculate percentages
        const leftPercentages = {};
        const rightPercentages = {};
        const overlapPercentages = {};
        
        this.zones.forEach(zone => {
            leftPercentages[zone] = (leftZoneCounts[zone] / totalFrames) * 100;
            rightPercentages[zone] = (rightZoneCounts[zone] / totalFrames) * 100;
        });
        
        this.overlapZones.forEach(zone => {
            overlapPercentages[zone] = (overlapZoneCounts[zone] / totalFrames) * 100;
        });
        
        // Store results
        this.leftZoneData = {
            counts: leftZoneCounts,
            percentages: leftPercentages,
            frameAssignments: leftFrameZones,
            totalFrames: totalFrames
        };
        
        this.rightZoneData = {
            counts: rightZoneCounts,
            percentages: rightPercentages,
            frameAssignments: rightFrameZones,
            totalFrames: totalFrames
        };
        
        this.overlapZoneData = {
            counts: overlapZoneCounts,
            percentages: overlapPercentages,
            frameAssignments: overlapFrameZones,
            totalFrames: totalFrames
        };
        
        // Emit event
        this.eventBus.emit(Events.ZONE_ANALYSIS_CALCULATED, {
            left: this.leftZoneData,
            right: this.rightZoneData,
            overlap: this.overlapZoneData
        });
        
        return {
            left: this.leftZoneData,
            right: this.rightZoneData,
            overlap: this.overlapZoneData
        };
    }

    /**
     * Get zones for a specific frame and side with fractional occupancy
     * @param {number} frame - Frame number
     * @param {string} side - 'left' or 'right'
     * @param {Object} tankInfo - Tank information
     * @returns {Object} Object with zone fractions for this frame
     */
    getZonesForFrame(frame, side, tankInfo) {
        const bbox = this.interpolationEngine.getBboxAtFrame(frame, side);
        
        // Initialize zone fractions
        const zoneFractions = {
            'D': 0,
            'MP': 0,
            'H1': 0,
            'H2': 0,
            'T': 0,
            'B': 0,
            'H1T': 0,
            'H1B': 0,
            'H2T': 0,
            'H2B': 0,
            'MPT': 0,
            'MPB': 0
        };
        
        // Check for den (no detection)
        if (!bbox) {
            zoneFractions['D'] = 1.0;
            return zoneFractions;
        }
        
        // Calculate centroid for other purposes
        const centroid = {
            x: (bbox.x_min + bbox.x_max) / 2,
            y: (bbox.y_min + bbox.y_max) / 2
        };
        
        // Get tank boundaries in normalized coordinates
        const videoWidth = this.keyframesData.video_info.width;
        const videoHeight = this.keyframesData.video_info.height;
        const tankLeft = tankInfo.bbox.x_min / videoWidth;
        const tankRight = tankInfo.bbox.x_max / videoWidth;
        const tankTop = tankInfo.bbox.y_min / videoHeight;
        const tankBottom = tankInfo.bbox.y_max / videoHeight;
        const tankCenterX = tankInfo.bbox.center_x / videoWidth;
        const tankCenterY = (tankInfo.bbox.y_min + tankInfo.bbox.y_max) / 2 / videoHeight;
        
        // Calculate half-tank width for the appropriate side
        const halfTankWidth = Math.max(tankRight - tankCenterX, tankCenterX - tankLeft);
        
        // Check MP (Mirror Partition) zone - use closest edge to mirror
        let distanceFromMirror;
        if (side === 'left') {
            // For left octopus, use the right edge (x_max) which is closer to mirror
            distanceFromMirror = Math.abs(tankCenterX - bbox.x_max);
        } else {
            // For right octopus, use the left edge (x_min) which is closer to mirror
            distanceFromMirror = Math.abs(bbox.x_min - tankCenterX);
        }
        
        if (distanceFromMirror < (this.mpThreshold * halfTankWidth)) {
            zoneFractions['MP'] = 1.0;
        }
        
        // Calculate horizontal zone fractions (H1, H2) based on bbox overlap
        const horizontalFractions = this.calculateHorizontalZoneFractions(
            bbox, side, tankLeft, tankRight, tankCenterX
        );
        zoneFractions['H1'] = horizontalFractions.H1;
        zoneFractions['H2'] = horizontalFractions.H2;
        
        // Calculate vertical zone fractions (T, B) based on bbox overlap
        const verticalFractions = this.calculateVerticalZoneFractions(bbox, tankCenterY);
        zoneFractions['T'] = verticalFractions.T;
        zoneFractions['B'] = verticalFractions.B;
        
        // Calculate quadrant fractions as products of horizontal and vertical fractions
        zoneFractions['H1T'] = zoneFractions['H1'] * zoneFractions['T'];
        zoneFractions['H1B'] = zoneFractions['H1'] * zoneFractions['B'];
        zoneFractions['H2T'] = zoneFractions['H2'] * zoneFractions['T'];
        zoneFractions['H2B'] = zoneFractions['H2'] * zoneFractions['B'];
        
        // Calculate MP subdivisions (MP is binary, so MPT = MP * T, MPB = MP * B)
        zoneFractions['MPT'] = zoneFractions['MP'] * zoneFractions['T'];
        zoneFractions['MPB'] = zoneFractions['MP'] * zoneFractions['B'];
        
        return zoneFractions;
    }

    /**
     * Calculate overlap fraction when a box spans a boundary
     * @param {number} boxMin - Minimum coordinate of the box
     * @param {number} boxMax - Maximum coordinate of the box
     * @param {number} boundary - Boundary position
     * @returns {Object} Fractions on each side {before: fraction, after: fraction}
     */
    calculateOverlapFraction(boxMin, boxMax, boundary) {
        // If box is entirely before boundary
        if (boxMax <= boundary) {
            return { before: 1.0, after: 0.0 };
        }
        
        // If box is entirely after boundary
        if (boxMin >= boundary) {
            return { before: 0.0, after: 1.0 };
        }
        
        // Box spans the boundary - calculate fraction on each side
        const boxSize = boxMax - boxMin;
        const beforeSize = boundary - boxMin;
        const afterSize = boxMax - boundary;
        
        return {
            before: beforeSize / boxSize,
            after: afterSize / boxSize
        };
    }

    /**
     * Calculate horizontal zone fractions for a bounding box
     * @param {Object} bbox - Bounding box
     * @param {string} side - 'left' or 'right'
     * @param {number} tankLeft - Tank left boundary
     * @param {number} tankRight - Tank right boundary
     * @param {number} tankCenterX - Tank center X position
     * @returns {Object} Zone fractions {H1: fraction, H2: fraction}
     */
    calculateHorizontalZoneFractions(bbox, side, tankLeft, tankRight, tankCenterX) {
        let boundary;
        
        if (side === 'left') {
            // For left side, boundary is at midpoint between tank left and center
            boundary = (tankLeft + tankCenterX) / 2;
            const overlap = this.calculateOverlapFraction(bbox.x_min, bbox.x_max, boundary);
            
            // For left side: before boundary is H2 (far), after is H1 (near mirror)
            return {
                H1: overlap.after,
                H2: overlap.before
            };
        } else {
            // For right side, boundary is at midpoint between center and tank right
            boundary = (tankCenterX + tankRight) / 2;
            const overlap = this.calculateOverlapFraction(bbox.x_min, bbox.x_max, boundary);
            
            // For right side: before boundary is H1 (near mirror), after is H2 (far)
            return {
                H1: overlap.before,
                H2: overlap.after
            };
        }
    }

    /**
     * Calculate vertical zone fractions for a bounding box
     * @param {Object} bbox - Bounding box
     * @param {number} tankCenterY - Tank center Y position
     * @returns {Object} Zone fractions {T: fraction, B: fraction}
     */
    calculateVerticalZoneFractions(bbox, tankCenterY) {
        const overlap = this.calculateOverlapFraction(bbox.y_min, bbox.y_max, tankCenterY);
        
        // Before center is Top, after center is Bottom
        return {
            T: overlap.before,
            B: overlap.after
        };
    }

    /**
     * Get zone statistics
     * @returns {Object} Zone statistics for both sides
     */
    getZoneStatistics() {
        if (!this.leftZoneData || !this.rightZoneData) {
            return null;
        }
        
        return {
            left: {
                percentages: this.leftZoneData.percentages,
                totalFrames: this.leftZoneData.totalFrames
            },
            right: {
                percentages: this.rightZoneData.percentages,
                totalFrames: this.rightZoneData.totalFrames
            }
        };
    }

    /**
     * Get zone at specific frame
     * @param {number} frame - Frame number
     * @param {string} side - 'left' or 'right'
     * @returns {Object} Zone fractions at frame
     */
    getZoneAtFrame(frame, side) {
        const zoneData = side === 'left' ? this.leftZoneData : this.rightZoneData;
        
        if (!zoneData || frame >= zoneData.frameAssignments.length) {
            return null;
        }
        
        return zoneData.frameAssignments[frame];
    }

    /**
     * Get formatted zone data for export
     * @returns {Object} Formatted zone data
     */
    getExportData() {
        if (!this.leftZoneData || !this.rightZoneData) {
            return null;
        }
        
        const fps = this.keyframesData.video_info.fps;
        const totalFrames = this.keyframesData.video_info.total_frames_processed;
        
        // Create time series data
        const timeSeries = [];
        for (let frame = 0; frame < totalFrames; frame++) {
            const leftZones = this.leftZoneData.frameAssignments[frame];
            const rightZones = this.rightZoneData.frameAssignments[frame];
            
            // Format zones with significant fractions (> 0.01)
            const leftZoneStr = Object.entries(leftZones)
                .filter(([zone, fraction]) => fraction > 0.01)
                .map(([zone, fraction]) => fraction >= 0.99 ? zone : `${zone}:${fraction.toFixed(2)}`)
                .join(',');
            
            const rightZoneStr = Object.entries(rightZones)
                .filter(([zone, fraction]) => fraction > 0.01)
                .map(([zone, fraction]) => fraction >= 0.99 ? zone : `${zone}:${fraction.toFixed(2)}`)
                .join(',');
            
            timeSeries.push({
                frame: frame,
                time: frame / fps,
                left_zones: leftZoneStr || 'none',
                right_zones: rightZoneStr || 'none'
            });
        }
        
        return {
            summary: {
                left: this.leftZoneData.percentages,
                right: this.rightZoneData.percentages,
                totalFrames: totalFrames,
                duration: totalFrames / fps
            },
            timeSeries: timeSeries
        };
    }

    /**
     * Clear zone data
     */
    clear() {
        this.leftZoneData = null;
        this.rightZoneData = null;
        this.overlapZoneData = null;
    }
}