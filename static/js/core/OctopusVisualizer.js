/**
 * OctopusVisualizer - Main orchestrator class
 * Coordinates all modules and manages the visualization lifecycle
 */
import { Events } from '../utils/EventBus.js';
import { WebGLRenderer } from '../rendering/WebGLRenderer.js';
import { HeatmapRenderer } from '../rendering/HeatmapRenderer.js';
import { ActivityAnalyzer } from '../analysis/ActivityAnalyzer.js';
import { ProximityAnalyzer } from '../analysis/ProximityAnalyzer.js';
import { FourierAnalyzer } from '../analysis/FourierAnalyzer.js';
import { TrajectoryCalculator } from '../analysis/TrajectoryCalculator.js';
import { HeatmapCalculator } from '../analysis/HeatmapCalculator.js';
import { VideoController } from '../controls/VideoController.js';
import { DataLoader } from '../data/DataLoader.js';
import { InterpolationEngine } from '../data/InterpolationEngine.js';
import { UIManager } from '../ui/UIManager.js';
import { PerformanceMonitor } from '../utils/PerformanceMonitor.js';
import { interpolateTrajectoryColor } from '../utils/ColorMaps.js';
import { DEFAULTS } from '../utils/Constants.js';
import { computeUnionBbox } from '../utils/MathUtils.js';

export class OctopusVisualizer {
    /**
     * Create an OctopusVisualizer
     * @param {EventBus} eventBus - Central event system
     * @param {ErrorHandler} errorHandler - Error handler instance
     */
    constructor(eventBus, errorHandler) {
        this.eventBus = eventBus;
        this.errorHandler = errorHandler;
        
        // Get DOM elements
        this.videoPlayer = document.getElementById('videoPlayer');
        this.canvas = document.getElementById('overlayCanvas');
        this.heatmapCanvas = document.getElementById('activityHeatmap');
        
        // State
        this.keyframesData = null;
        this.currentFrame = 0;
        this.animationId = null;
        
        // Initialize modules
        this.initializeModules();
        
        // Setup event handlers
        this.setupEventHandlers();
        
        // Start render loop
        this.startRenderLoop();
        
        // Show initial modal
        this.uiManager.showModal();
    }

    /**
     * Initialize all modules
     */
    initializeModules() {
        try {
            // Performance monitoring
            this.performanceMonitor = new PerformanceMonitor(this.eventBus);
            
            // Rendering modules
            this.webglRenderer = new WebGLRenderer(this.canvas, this.eventBus);
            this.heatmapRenderer = new HeatmapRenderer(this.heatmapCanvas, this.eventBus);
            
            // Analysis modules
            this.activityAnalyzer = new ActivityAnalyzer(this.eventBus);
            this.proximityAnalyzer = new ProximityAnalyzer(this.eventBus);
            //this.fourierAnalyzer = new FourierAnalyzer(this.eventBus);
            this.trajectoryCalculator = new TrajectoryCalculator(this.eventBus);
            this.heatmapCalculator = new HeatmapCalculator(this.eventBus);
            
            // Control modules
            this.videoController = new VideoController(this.videoPlayer, this.eventBus);
            this.dataLoader = new DataLoader(this.eventBus);
            this.interpolationEngine = new InterpolationEngine(this.eventBus);
            
            // UI module
            this.uiManager = new UIManager(this.eventBus);
            
        } catch (error) {
            this.errorHandler.handleError(error, 'OctopusVisualizer', 'critical');
        }
    }

    /**
     * Setup event handlers
     */
    setupEventHandlers() {
        // Data loading events
        this.eventBus.on(Events.DATA_LOADED, (data) => {
            this.handleDataLoaded(data);
        });
        
        // UI events
        this.eventBus.on('ui:uploadFiles', async (data) => {
            try {
                await this.dataLoader.handleFileUpload(data.videoFile, data.keyframesFile);
            } catch (error) {
                this.uiManager.showError(error.message);
            }
        });
        
        this.eventBus.on('ui:quickLoad', async (data) => {
            try {
                await this.dataLoader.handleQuickLoad(data.code);
            } catch (error) {
                this.uiManager.showError(error.message);
            }
        });
        
        this.eventBus.on('ui:playPauseClick', () => {
            const isPlaying = this.videoController.togglePlayPause();
        });
        
        this.eventBus.on('ui:stepFrame', (data) => {
            this.videoController.stepFrame(data.direction);
        });
        
        this.eventBus.on('ui:jumpKeyframe', (data) => {
            this.videoController.jumpToKeyframe(data.direction);
        });
        
        this.eventBus.on('ui:seekFrame', (data) => {
            this.videoController.seekToFrame(data.frame); 
        });
        
        this.eventBus.on('ui:heatmapSeek', (data) => {
            const maxFrames = this.videoController.getMaxFrames();
            const targetFrame = Math.floor(data.progress * maxFrames);
            this.videoController.seekToFrame(targetFrame);
        });
        
        // Control change events
        this.eventBus.on(Events.UI_CONTROL_CHANGE, (data) => {
            this.handleControlChange(data);
        });
        
        // Video events
        this.eventBus.on(Events.VIDEO_LOADED, () => {
            this.resizeCanvas();
        });
        
        /*this.eventBus.on(Events.VIDEO_FRAME_UPDATE, (data) => {
            this.currentFrame = data.frame;
            this.updateFrameInfo();
        });*/
        
        // Render requests
        this.eventBus.on(Events.RENDER_REQUEST, () => {
            this.render();
        });
        
        // Window resize
        window.addEventListener('resize', () => this.resizeCanvas());
    }

    /**
     * Handle data loaded event
     * @param {Object} data - Loaded data
     */
    handleDataLoaded(data) {
        this.keyframesData = data.keyframesData;
        this.videoController.loadVideo(data.videoUrl);
        
        // Calculate all analysis data
        this.performanceMonitor.measureModuleLoad('analysis', async () => {
            // Calculate activity data
            this.activityAnalyzer.calculateActivityData();
            
            // Calculate proximity data using interpolation engine
            this.proximityAnalyzer.calculateProximityData(
                (frame, side) => this.interpolationEngine.getBboxAtFrame(frame, side)
            );
            
            // Set interpolation engine for heatmap calculator and calculate heatmaps
            this.heatmapCalculator.setInterpolationEngine(this.interpolationEngine);
            this.heatmapCalculator.calculateHeatmaps();
            
            // Check if trajectory should be calculated
            const uiState = this.uiManager.getState();
            if (uiState.showTrajectory) {
                this.trajectoryCalculator.calculateTrajectories(
                    (frame, side) => this.interpolationEngine.getBboxAtFrame(frame, side)
                );
            }
            
            // Initial render
            this.render();
            this.heatmapRenderer.render();
        });
    }

    /**
     * Handle control change events
     * @param {Object} data - Control change data
     */
    handleControlChange(data) {
        switch (data.control) {
            case 'activityMetric':
                this.activityAnalyzer.setMetric(data.value);
                this.activityAnalyzer.calculateActivityData();
                this.heatmapRenderer.render();
                break;
                
            case 'proximityMetric':
                this.proximityAnalyzer.setMetric(data.value);
                this.proximityAnalyzer.calculateProximityData(
                    (frame, side) => this.interpolationEngine.getBboxAtFrame(frame, side)
                );
                this.heatmapRenderer.render();
                break;
                
            case 'showTrajectory':
                if (data.value && !this.trajectoryCalculator.isCalculated()) {
                    this.trajectoryCalculator.calculateTrajectories(
                        (frame, side) => this.interpolationEngine.getBboxAtFrame(frame, side)
                    );
                }
                this.render();
                break;
                
            case 'trajectoryAlpha':
                this.trajectoryCalculator.setAlpha(data.value);
                this.render();
                break;
                
            case 'showSpatialHeatmap':
                this.render();
                break;
                
            case 'activitySensitivity':
            case 'proximitySensitivity':
            case 'frequencyRank':
                this.heatmapRenderer.render();
                break;
                
            default:
                this.render();
        }
    }

    /**
     * Resize canvas to match video
     */
    resizeCanvas() {
        const rect = this.videoController.getVideoRect();
        this.webglRenderer.resize(rect.width, rect.height);
        
        if (this.activityAnalyzer.getActivityData().leftActivityData) {
            this.heatmapRenderer.render();
        }
    }

    /**
     * Update frame information display
     */
    updateFrameInfo() {
        if (!this.keyframesData) return;
        
        const keyframe = this.keyframesData.keyframes[this.currentFrame.toString()];
        const uiState = this.uiManager.getState();
        
        let infoText = `Frame ${this.currentFrame}`;
        
        if (keyframe) {
            infoText += ' (Keyframe)';
            const leftCount = keyframe.left_detections.length;
            const rightCount = keyframe.right_detections.length;
            infoText += ` - L: ${leftCount}, R: ${rightCount}`;
        } else if (uiState.enableInterpolation) {
            const interpolationInfo = this.interpolationEngine.getInterpolationInfo(this.currentFrame);
            if (interpolationInfo.leftInterpolated || interpolationInfo.rightInterpolated) {
                infoText += ' (Interpolated)';
            }
        }
        
        this.uiManager.updateFrameInfo(infoText);
    }

    /**
     * Start the render loop
     */
    startRenderLoop() {
        const renderFrame = () => {
            this.performanceMonitor.startFrame();
            
            if (this.keyframesData && this.videoController.isReady()) {
                const newFrame = this.videoController.updateCurrentFrame();
                // Only re-render if frame changed
                if (newFrame !== this.currentFrame) {
                    this.currentFrame = newFrame;
                    this.render();
                    this.heatmapRenderer.setCurrentFrame(newFrame);
                    this.heatmapRenderer.render();
                }
            }
            
            this.performanceMonitor.endFrame();
            this.animationId = requestAnimationFrame(renderFrame);
        };
        
        renderFrame();
    }

    /**
     * Main render function
     */
    render() {
        if (!this.keyframesData || !this.webglRenderer.isInitialized()) return;
        this.performanceMonitor.resetDrawCalls();
        
        // Clear canvas
        this.webglRenderer.clear();
        
        const uiState = this.uiManager.getState();
        const videoInfo = this.keyframesData.video_info;
        const tankBbox = this.keyframesData.tank_info.bbox;
        
        // Calculate scaling factors
        const videoWidth = videoInfo.width;
        const videoHeight = videoInfo.height;
        const canvasWidth = this.canvas.width;
        const canvasHeight = this.canvas.height;
        const scaleX = canvasWidth / videoWidth;
        const scaleY = canvasHeight / videoHeight;
        
        // Draw spatial heatmap if enabled (draw first so it's in the background)
        if (uiState.showSpatialHeatmap && this.heatmapCalculator.isCalculated()) {
            this.webglRenderer.drawSpatialHeatmap(tankBbox, scaleX, scaleY, 0.7);
            this.performanceMonitor.incrementDrawCalls();
        }
        
        // Draw tank if enabled
        if (uiState.showTank) {
            this.drawTank(tankBbox, scaleX, scaleY);
            this.performanceMonitor.incrementDrawCalls();
        }
        
        // Draw octopus bounding boxes
        if (uiState.sideSelect === 'left' || uiState.sideSelect === 'both') {
            this.drawOctopusBbox('left', uiState.enableInterpolation, scaleX, scaleY);
            this.performanceMonitor.incrementDrawCalls();
        }
        
        if (uiState.sideSelect === 'right' || uiState.sideSelect === 'both') {
            this.drawOctopusBbox('right', uiState.enableInterpolation, scaleX, scaleY);
            this.performanceMonitor.incrementDrawCalls();
        }
        
        // Draw trajectories if enabled
        if (uiState.showTrajectory && this.trajectoryCalculator.isCalculated()) {
            if (uiState.sideSelect === 'left' || uiState.sideSelect === 'both') {
                this.drawTrajectory('left', scaleX, scaleY);
                this.performanceMonitor.incrementDrawCalls();
            }
            if (uiState.sideSelect === 'right' || uiState.sideSelect === 'both') {
                this.drawTrajectory('right', scaleX, scaleY);
                this.performanceMonitor.incrementDrawCalls();
            }
        }
    }

    /**
     * Draw tank boundaries
     */
    drawTank(tankBbox, scaleX, scaleY) {
        const color = [0, 1, 0, 1]; // Green
        
        // Tank outline
        this.webglRenderer.drawRectangle(
            tankBbox.x_min * scaleX,
            tankBbox.y_min * scaleY,
            (tankBbox.x_max - tankBbox.x_min) * scaleX,
            (tankBbox.y_max - tankBbox.y_min) * scaleY,
            color
        );
        
        // Center divider
        this.webglRenderer.drawLine(
            tankBbox.center_x * scaleX,
            tankBbox.y_min * scaleY,
            tankBbox.center_x * scaleX,
            tankBbox.y_max * scaleY,
            color
        );
    }

    /**
     * Draw octopus bounding box
     */
    drawOctopusBbox(side, enableInterpolation, scaleX, scaleY) {
        const color = side === 'left' ? [1, 0, 0, 1] : [0, 0, 1, 1]; // Red for left, Blue for right
        const keyframe = this.keyframesData.keyframes[this.currentFrame.toString()];
        
        let bbox = null;
        
        // Check if this is a keyframe AND it has detections
        const isKeyframeWithDetections = keyframe && keyframe[`${side}_detections`].length > 0;
        
        if (isKeyframeWithDetections) {
            // Compute union bbox for keyframe
            const detections = keyframe[`${side}_detections`];
            bbox = computeUnionBbox(detections);
        } else if (enableInterpolation) {
            // Get interpolated bbox
            bbox = this.interpolationEngine.getBboxAtFrame(this.currentFrame, side);
        }
        
        if (bbox) {
            const videoWidth = this.keyframesData.video_info.width;
            const videoHeight = this.keyframesData.video_info.height;
            
            this.webglRenderer.drawRectangle(
                bbox.x_min * videoWidth * scaleX,
                bbox.y_min * videoHeight * scaleY,
                (bbox.x_max - bbox.x_min) * videoWidth * scaleX,
                (bbox.y_max - bbox.y_min) * videoHeight * scaleY,
                color
            );
        }
    }

    /**
     * Draw trajectory
     */
    drawTrajectory(side, scaleX, scaleY) {
        const trajectory = this.trajectoryCalculator.getTrajectory(side);
        if (!trajectory || trajectory.length < 2) return;
        
        const videoWidth = this.keyframesData.video_info.width;
        const videoHeight = this.keyframesData.video_info.height;
        const alpha = this.trajectoryCalculator.trajectoryAlpha;
        
        // Build line vertices array
        const lineVertices = [];
        const lineColors = [];
        
        for (let i = 1; i < trajectory.length; i++) {
            const p1 = trajectory[i - 1];
            const p2 = trajectory[i];
            
            // Add line segment vertices
            lineVertices.push(
                p1.x * videoWidth * scaleX, p1.y * videoHeight * scaleY,
                p2.x * videoWidth * scaleX, p2.y * videoHeight * scaleY
            );
            
            // Add colors for both vertices
            const color1 = interpolateTrajectoryColor(p1.progress);
            const color2 = interpolateTrajectoryColor(p2.progress);
            color1[3] = alpha;
            color2[3] = alpha;
            lineColors.push(...color1, ...color2);
        }
        
        // Draw lines
        if (lineVertices.length > 0) {
            this.webglRenderer.drawTrajectoryLines(
                new Float32Array(lineVertices),
                new Float32Array(lineColors)
            );
        }
        
        // Build point vertices
        const pointVertices = [];
        const pointColors = [];
        
        for (const point of trajectory) {
            const x = point.x * videoWidth * scaleX;
            const y = point.y * videoHeight * scaleY;
            
            pointVertices.push(x, y);
            
            const color = interpolateTrajectoryColor(point.progress);
            color[3] = alpha;
            pointColors.push(...color);
        }
        
        // Draw points
        if (pointVertices.length > 0) {
            this.webglRenderer.drawTrajectoryPoints(
                new Float32Array(pointVertices),
                new Float32Array(pointColors)
            );
        }
    }


    /**
     * Cleanup resources
     */
    destroy() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
        
        // Clear event listeners
        window.removeEventListener('resize', this.resizeCanvas);
    }
}