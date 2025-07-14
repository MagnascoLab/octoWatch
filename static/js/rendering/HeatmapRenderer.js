/**
 * HeatmapRenderer - Renders activity and proximity heatmaps
 * Manages canvas-based visualization of analysis data
 */
import { Events } from '../utils/EventBus.js';
import { viridis, blackRed, getSinusoidColor, redGreen } from '../utils/ColorMaps.js';
import { applySensitivity } from '../utils/MathUtils.js';
import { RENDERING } from '../utils/Constants.js';

export class HeatmapRenderer {
    /**
     * Create a HeatmapRenderer
     * @param {HTMLCanvasElement} canvas - Canvas element for heatmap rendering
     * @param {EventBus} eventBus - Central event system
     */
    constructor(canvas, eventBus) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.eventBus = eventBus;
        
        // Data references
        this.activityData = null;
        this.proximityData = null;
        this.fourierData = null;
        this.keyframesData = null;
        
        // Settings
        this.activitySensitivity = 2.0;
        this.proximitySensitivity = 2.0;
        this.showFourierAnalysis = false;
        this.frequencyRank = 1;
        this.currentFrame = 0;
        
        this.setupEventListeners();
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        this.eventBus.on(Events.DATA_LOADED, (data) => {
            this.keyframesData = data.keyframesData;
        });

        this.eventBus.on(Events.ACTIVITY_CALCULATED, (data) => {
            this.activityData = data;
        });

        this.eventBus.on(Events.PROXIMITY_CALCULATED, (data) => {
            this.proximityData = data;
        });

        this.eventBus.on(Events.FOURIER_CALCULATED, (data) => {
            this.fourierData = data;
        });

        this.eventBus.on(Events.VIDEO_FRAME_UPDATE, (data) => {
            this.currentFrame = data.frame;
        });

        this.eventBus.on(Events.UI_CONTROL_CHANGE, (data) => {
            if (data.control === 'activitySensitivity') {
                this.activitySensitivity = data.value;
            } else if (data.control === 'proximitySensitivity') {
                this.proximitySensitivity = data.value;
            } else if (data.control === 'showFourierAnalysis') {
                this.showFourierAnalysis = data.value;
            } else if (data.control === 'frequencyRank') {
                this.frequencyRank = data.value;
            }
        });
    }

    /**
     * Render the complete heatmap
     */
    render() {
        if (!this.activityData || !this.proximityData || !this.canvas) return;

        // Set canvas size
        const rect = this.canvas.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;

        const ctx = this.ctx;
        const width = this.canvas.width;
        const height = this.canvas.height;

        // Clear canvas
        ctx.clearRect(0, 0, width, height);
        
        // Render the heatmaps
        this.renderNormalHeatmaps();
        
        // Then overlay Fourier analysis if enabled
        if (this.showFourierAnalysis && this.fourierData) {
            this.overlayFourierAnalysis();
        }

        // Draw position indicator
        this.drawPositionIndicator();
        this.drawTextOverlay();
    }

    /**
     * Draw text overlay with current frame and sensitivity settings
     */

    drawTextOverlay() {
        const ctx = this.ctx;
        const quarterHeight = this.canvas.height / 4;
        ctx.fillStyle = 'white';
        ctx.font = '10px Arial';
        ctx.textAlign = 'left';
        ctx.fillText('L prox', 5, 10);
        ctx.fillText('R prox', 5, quarterHeight + 10);
        ctx.fillText('L act', 5, quarterHeight * 2 + 10);
        ctx.fillText('R act', 5, quarterHeight * 3 + 10);
    }
    /**
     * Render normal heatmaps (activity and proximity)
     */
    renderNormalHeatmaps() {
        const ctx = this.ctx;
        const width = this.canvas.width;
        const height = this.canvas.height;
        const quarterHeight = height / 4;
        const totalFrames = this.activityData.leftActivityData.length;
        
        // Draw left proximity (top quarter)
        if (this.proximityData.leftProximityData) {
            for (let x = 0; x < width; x++) {
                const frame = Math.floor((x / width) * totalFrames);
                const proximityRaw = this.proximityData.leftProximityData[frame];
                const verticalRaw = this.proximityData.leftVerticalData[frame];
                const proximity = applySensitivity(proximityRaw, this.proximitySensitivity);
                const verticality = applySensitivity(verticalRaw, this.proximitySensitivity);
                
                const color = redGreen(proximity, verticality);
                ctx.fillStyle = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
                ctx.fillRect(x, 0, 1, quarterHeight);
            }
        }

        // Draw right proximity (second quarter)
        if (this.proximityData.rightProximityData) {
            for (let x = 0; x < width; x++) {
                const frame = Math.floor((x / width) * totalFrames);
                const proximityRaw = this.proximityData.rightProximityData[frame];
                const verticalRaw = this.proximityData.rightVerticalData[frame];
                const proximity = applySensitivity(proximityRaw, this.proximitySensitivity);
                const verticality = applySensitivity(verticalRaw, this.proximitySensitivity);
                const color = redGreen(proximity, verticality);
                ctx.fillStyle = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
                ctx.fillRect(x, quarterHeight, 1, quarterHeight);
            }
        }

        // Draw left activity (third quarter)
        for (let x = 0; x < width; x++) {
            const frame = Math.floor((x / width) * totalFrames);
            const leftActivity = this.activityData.leftActivityData[frame];
            const normalizedLeftActivity = this.activityData.maxLeftActivity > 0 ? 
                leftActivity / this.activityData.maxLeftActivity : 0;
            
            // Apply sensitivity transformation
            const transformedLeftActivity = applySensitivity(normalizedLeftActivity, this.activitySensitivity);

            const leftColor = viridis(transformedLeftActivity);
            ctx.fillStyle = `rgb(${leftColor[0]}, ${leftColor[1]}, ${leftColor[2]})`;
            ctx.fillRect(x, quarterHeight * 2, 1, quarterHeight);
        }

        // Draw right activity (bottom quarter)
        for (let x = 0; x < width; x++) {
            const frame = Math.floor((x / width) * totalFrames);
            const rightActivity = this.activityData.rightActivityData[frame];
            const normalizedRightActivity = this.activityData.maxRightActivity > 0 ? 
                rightActivity / this.activityData.maxRightActivity : 0;
            
            // Apply sensitivity transformation
            const transformedRightActivity = applySensitivity(normalizedRightActivity, this.activitySensitivity);

            const rightColor = viridis(transformedRightActivity);
            ctx.fillStyle = `rgb(${rightColor[0]}, ${rightColor[1]}, ${rightColor[2]})`;
            ctx.fillRect(x, quarterHeight * 3, 1, quarterHeight);
        }

        // Draw dividing lines
        ctx.strokeStyle = RENDERING.HEATMAP_DIVIDER_COLOR;
        ctx.lineWidth = RENDERING.HEATMAP_DIVIDER_WIDTH;
        ctx.beginPath();
        ctx.moveTo(0, quarterHeight);
        ctx.lineTo(width, quarterHeight);
        ctx.moveTo(0, quarterHeight * 2);
        ctx.lineTo(width, quarterHeight * 2);
        ctx.moveTo(0, quarterHeight * 3);
        ctx.lineTo(width, quarterHeight * 3);
        ctx.stroke();
    }

    /**
     * Overlay Fourier analysis on the heatmap
     */
    overlayFourierAnalysis() {
        if (!this.fourierData || !this.keyframesData) return;

        const ctx = this.ctx;
        const width = this.canvas.width;
        const height = this.canvas.height;
        const quarterHeight = height / 4;
        const totalFrames = this.keyframesData.video_info.total_frames_processed;
        const fps = this.keyframesData.video_info.fps;
        
        // Get selected frequency data
        const rankIdx = this.frequencyRank - 1;
        const leftProxFreq = this.fourierData.leftProx[rankIdx] || null;
        const rightProxFreq = this.fourierData.rightProx[rankIdx] || null;
        const leftActFreq = this.fourierData.leftAct[rankIdx] || null;
        const rightActFreq = this.fourierData.rightAct[rankIdx] || null;
        
        // Draw sinusoid overlays
        const drawSinusoid = (freqData, yOffset, colormap) => {
            if (!freqData) return;
            
            ctx.beginPath();
            
            for (let x = 0; x < width; x++) {
                const frame = (x / width) * totalFrames;
                const time = frame / fps;
                
                // Generate sinusoid: A * sin(2π * f * t + φ)
                const value = freqData.magnitude * Math.sin(2 * Math.PI * freqData.frequency * time + freqData.phase);
                
                // Normalize to 0-1 range
                const normalized = (value + freqData.magnitude) / (2 * freqData.magnitude);
                
                // Map to y position
                const y = yOffset + quarterHeight * (1 - normalized);
                
                if (x === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            }
            
            // Draw the line
            ctx.strokeStyle = getSinusoidColor(colormap);
            ctx.lineWidth = RENDERING.FOURIER_LINE_WIDTH;
            ctx.stroke();
            
            // Draw baseline
            ctx.strokeStyle = RENDERING.FOURIER_BASELINE_COLOR;
            ctx.lineWidth = 1;
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            ctx.moveTo(0, yOffset + quarterHeight / 2);
            ctx.lineTo(width, yOffset + quarterHeight / 2);
            ctx.stroke();
            ctx.setLineDash([]);
        };
        
        // Draw each sinusoid
        drawSinusoid(leftProxFreq, 0, 'blackRed');
        drawSinusoid(rightProxFreq, quarterHeight, 'blackRed');
        drawSinusoid(leftActFreq, quarterHeight * 2, 'viridis');
        drawSinusoid(rightActFreq, quarterHeight * 3, 'viridis');
    }

    /**
     * Draw current position indicator
     */
    drawPositionIndicator() {
        if (!this.activityData) return;

        const totalFrames = this.activityData.leftActivityData.length;
        const currentX = (this.currentFrame / totalFrames) * this.canvas.width;
        
        this.ctx.strokeStyle = RENDERING.POSITION_INDICATOR_COLOR;
        this.ctx.lineWidth = RENDERING.POSITION_INDICATOR_WIDTH;
        this.ctx.beginPath();
        this.ctx.moveTo(currentX, 0);
        this.ctx.lineTo(currentX, this.canvas.height);
        this.ctx.stroke();
    }

    /**
     * Update sensitivity settings
     * @param {string} type - 'activity' or 'proximity'
     * @param {number} value - Sensitivity value
     */
    setSensitivity(type, value) {
        if (type === 'activity') {
            this.activitySensitivity = value;
        } else if (type === 'proximity') {
            this.proximitySensitivity = value;
        }
        this.eventBus.emit(Events.RENDER_REQUEST);
    }

    /**
     * Update Fourier analysis settings
     * @param {boolean} show - Show Fourier analysis
     * @param {number} rank - Frequency rank
     */
    setFourierSettings(show, rank) {
        this.showFourierAnalysis = show;
        this.frequencyRank = rank;
        this.eventBus.emit(Events.RENDER_REQUEST);
    }

    /**
     * Update current frame
     * @param {number} frame - Frame number
     */
    setCurrentFrame(frame) {
        this.currentFrame = frame;
        this.eventBus.emit(Events.RENDER_REQUEST);
    }

    /**
     * Get canvas dimensions
     * @returns {Object} Width and height
     */
    getDimensions() {
        return {
            width: this.canvas.width,
            height: this.canvas.height
        };
    }
}