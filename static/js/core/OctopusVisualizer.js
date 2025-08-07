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
import { interpolateTrajectoryColor, viridis } from '../utils/ColorMaps.js';
import { DEFAULTS } from '../utils/Constants.js';
import { computeUnionBbox } from '../utils/MathUtils.js';
import { DetectionManager } from '../detection/DetectionManager.js';
import { ScreenshotCapture } from '../utils/ScreenshotCapture.js';
import { DataExporter } from '../utils/DataExporter.js';
import { BoundingBoxInteraction } from '../interaction/BoundingBoxInteraction.js';

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
        this.videoFilename = null;
        this.currentVideoCode = null;
        
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
            this.uiManager = new UIManager(this.eventBus, this);
            
            // Detection module
            this.detectionManager = new DetectionManager(this.eventBus);
            
            // Screenshot utility
            this.screenshotCapture = new ScreenshotCapture();
            
            // Data exporter
            this.dataExporter = new DataExporter();
            
            // Bounding box interaction
            this.bboxInteraction = new BoundingBoxInteraction(this.canvas, this.videoPlayer, this.eventBus);
            
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
        this.eventBus.on('ui:uploadVideo', async (data) => {
            try {
                const result = await this.dataLoader.handleVideoUpload(data.videoFile);
                // Show success message with the assigned code
                this.uiManager.showUploadSuccess(result.code, result.message);
                // Automatically set the code in the quick load input
                document.getElementById('codeInput').value = result.code;
                // Refresh available codes list if visible
                this.uiManager.refreshAvailableCodes();
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
        
        this.eventBus.on('ui:fetchAvailableCodes', async () => {
            try {
                const codes = await this.dataLoader.fetchAvailableCodes();
                this.uiManager.displayAvailableCodes(codes);
            } catch (error) {
                this.uiManager.showError('Failed to fetch available codes');
            }
        });
        
        // Reload current data (after keyframe deletion)
        this.eventBus.on('ui:reloadCurrentData', async () => {
            if (this.currentVideoCode) {
                // Get current time
                const frame = this.videoController.getCurrentFrame();
                try {
                    await this.dataLoader.handleQuickLoad(this.currentVideoCode);
                    this.videoController.seekToFrame(frame);
                    this.uiManager.showSuccess('Data reloaded successfully');
                } catch (error) {
                    this.uiManager.showError('Failed to reload data: ' + error.message);
                }
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
        
        this.eventBus.on('ui:takeScreenshot', () => {
            this.takeScreenshot();
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
        
        // Export events
        this.eventBus.on(Events.EXPORT_HEATMAP_IMAGES, () => {
            this.downloadHeatmaps();
        });
        
        this.eventBus.on(Events.EXPORT_HEATMAP_DATA, () => {
            this.exportHeatmapData();
        });
        
        this.eventBus.on(Events.EXPORT_TRAJECTORY_JSON, () => {
            this.exportTrajectoryJSON();
        });
        
        this.eventBus.on(Events.EXPORT_TRAJECTORY_CSV, () => {
            this.exportTrajectoryCSV();
        });
        
        this.eventBus.on(Events.EXPORT_ACTIVITY_JSON, () => {
            this.exportActivityJSON();
        });
        
        this.eventBus.on(Events.EXPORT_ACTIVITY_CSV, () => {
            this.exportActivityCSV();
        });
        
        this.eventBus.on(Events.EXPORT_PROXIMITY_JSON, () => {
            this.exportProximityJSON();
        });
        
        this.eventBus.on(Events.EXPORT_PROXIMITY_CSV, () => {
            this.exportProximityCSV();
        });
        
        this.eventBus.on(Events.EXPORT_ALL_JSON, () => {
            this.exportAllData();
        });
        
        this.eventBus.on(Events.EXPORT_KEYFRAMES_JSON, () => {
            this.exportKeyframesData();
        });
        
        // Bounding box editing events
        this.eventBus.on('ui:toggleBboxEdit', () => {
            this.toggleBboxEditMode();
        });
        
        this.eventBus.on('bboxDragged', (data) => {
            this.handleBboxDrag(data);
        });
        
        this.eventBus.on('bboxResizing', (data) => {
            this.handleBboxResize(data);
        });
        
        this.eventBus.on('bboxSelected', (data) => {
            this.selectedBox = data;
            this.render();
        });
        
        this.eventBus.on('bboxDeselected', () => {
            this.selectedBox = null;
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
        this.videoFilename = data.videoFilename;
        this.dataExporter.setVideoFilename(this.videoFilename);
        this.videoController.loadVideo(data.videoUrl);
        
        // Extract and store the video code for reloading
        const codeMatch = this.videoFilename?.match(/MVI_(\d{4})/);
        if (codeMatch) {
            this.currentVideoCode = codeMatch[1];
        }
        
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
                    this.draggedBboxes = {}; // Clear dragged bboxes when frame changes
                    this.render();
                    this.heatmapRenderer.setCurrentFrame(newFrame);
                    this.heatmapRenderer.render();
                    // Update box toggle buttons when frame changes
                    if (this.bboxInteraction && this.bboxInteraction.isEnabled) {
                        this.updateBoxToggleButtons();
                    }
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
            this.webglRenderer.drawSpatialHeatmap(tankBbox, scaleX, scaleY, uiState.heatmapAlpha, uiState.sideSelect);
            this.performanceMonitor.incrementDrawCalls();
        }
        
        // Draw tank if enabled
        if (uiState.showTank) {
            this.drawTank(tankBbox, scaleX, scaleY);
            this.performanceMonitor.incrementDrawCalls();
        }
        
        // Collect current bounding boxes for interaction
        const currentBboxes = { left: [], right: [] };
        
        // Draw octopus bounding boxes
        if (uiState.sideSelect === 'left' || uiState.sideSelect === 'both') {
            let leftBbox = this.getOctopusBbox('left', uiState.enableInterpolation);
            
            // Use dragged bbox if available
            if (this.draggedBboxes && this.draggedBboxes.left) {
                leftBbox = this.draggedBboxes.left.bbox;
            }
            
            if (leftBbox && leftBbox !== null) {
                currentBboxes.left.push(leftBbox);
                this.drawBboxFromData(leftBbox, 'left', scaleX, scaleY);
            }
            this.performanceMonitor.incrementDrawCalls();
        }
        
        if (uiState.sideSelect === 'right' || uiState.sideSelect === 'both') {
            let rightBbox = this.getOctopusBbox('right', uiState.enableInterpolation);
            
            // Use dragged bbox if available
            if (this.draggedBboxes && this.draggedBboxes.right) {
                rightBbox = this.draggedBboxes.right.bbox;
            }
            
            if (rightBbox && rightBbox !== null) {
                currentBboxes.right.push(rightBbox);
                this.drawBboxFromData(rightBbox, 'right', scaleX, scaleY);
            }
            this.performanceMonitor.incrementDrawCalls();
        }
        
        // Update bounding box interaction module with current boxes (including dragged ones)
        this.eventBus.emit('boundingBoxesUpdated', currentBboxes);
        
        // Draw resize handles if a box is selected and we're in edit mode
        if (this.selectedBox && this.bboxInteraction.isEnabled) {
            const selectedBbox = this.selectedBox.side === 'left' ? 
                (this.draggedBboxes && this.draggedBboxes.left ? this.draggedBboxes.left.bbox : null) :
                (this.draggedBboxes && this.draggedBboxes.right ? this.draggedBboxes.right.bbox : null);
            
            if (selectedBbox) {
                this.drawResizeHandles(selectedBbox, scaleX, scaleY);
            }
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
     * Get octopus bounding box for a side
     */
    getOctopusBbox(side, enableInterpolation) {
        const keyframe = this.keyframesData.keyframes[this.currentFrame.toString()];
        
        // Check if this is a keyframe AND it has detections
        const isKeyframeWithDetections = keyframe && keyframe[`${side}_detections`].length > 0;
        
        if (isKeyframeWithDetections) {
            // Compute union bbox for keyframe
            const detections = keyframe[`${side}_detections`];
            return computeUnionBbox(detections);
        } else if (enableInterpolation) {
            // Get interpolated bbox
            return this.interpolationEngine.getBboxAtFrame(this.currentFrame, side);
        }
        
        return null;
    }
    
    /**
     * Draw bounding box from data
     */
    drawBboxFromData(bbox, side, scaleX, scaleY) {
        const color = side === 'left' ? [1, 0, 0, 1] : [0, 0, 1, 1]; // Red for left, Blue for right
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
    
    /**
     * Draw resize handles for selected box
     */
    drawResizeHandles(bbox, scaleX, scaleY) {
        const videoWidth = this.keyframesData.video_info.width;
        const videoHeight = this.keyframesData.video_info.height;
        const handleSize = 6; // Size of handles in pixels
        const handleColor = [1, 1, 1, 1]; // White handles
        const handleBorderColor = [0, 0, 0, 1]; // Black border
        
        // Convert normalized bbox coords to canvas coords
        const x1 = bbox.x_min * videoWidth * scaleX;
        const y1 = bbox.y_min * videoHeight * scaleY;
        const x2 = bbox.x_max * videoWidth * scaleX;
        const y2 = bbox.y_max * videoHeight * scaleY;
        const midX = (x1 + x2) / 2;
        const midY = (y1 + y2) / 2;
        
        // Define handle positions
        const handles = [
            { x: x1, y: y1 }, // nw
            { x: midX, y: y1 }, // n
            { x: x2, y: y1 }, // ne
            { x: x2, y: midY }, // e
            { x: x2, y: y2 }, // se
            { x: midX, y: y2 }, // s
            { x: x1, y: y2 }, // sw
            { x: x1, y: midY } // w
        ];
        
        // Draw each handle
        handles.forEach(handle => {
            // Draw handle as a small square with border
            // Use drawCircle as a workaround for filled square
            this.webglRenderer.drawCircle(
                handle.x,
                handle.y,
                handleSize/2,
                handleColor
            );
            
            // Draw border using rectangle outline
            this.webglRenderer.drawRectangle(
                handle.x - handleSize/2,
                handle.y - handleSize/2,
                handleSize,
                handleSize,
                handleBorderColor
            );
        });
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
    
    /**
     * Download spatial heatmaps as images
     */
    downloadHeatmaps() {
        if (!this.heatmapCalculator.isCalculated()) {
            console.warn('No heatmaps to download');
            return;
        }
        
        const heatmapData = this.heatmapCalculator.getHeatmapData();
        const { leftHeatmap, rightHeatmap, heatmapWidth, heatmapHeight } = heatmapData;
        
        // Create canvas for rendering
        const canvas = document.createElement('canvas');
        canvas.width = heatmapWidth;
        canvas.height = heatmapHeight;
        const ctx = canvas.getContext('2d');
        
        // Get base filename without extension
        const baseFilename = this.videoFilename ? 
            this.videoFilename.replace(/\.[^/.]+$/, '') : 'octopus';
        
        // Download left heatmap
        this.renderHeatmapToCanvas(ctx, leftHeatmap, heatmapWidth, heatmapHeight);
        this.downloadCanvas(canvas, `${baseFilename}_heatmap_left.png`);
        
        // Download right heatmap
        this.renderHeatmapToCanvas(ctx, rightHeatmap, heatmapWidth, heatmapHeight);
        this.downloadCanvas(canvas, `${baseFilename}_heatmap_right.png`);
    }
    
    /**
     * Render heatmap data to canvas
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {Float32Array} heatmapData - Normalized heatmap data
     * @param {number} width - Heatmap width
     * @param {number} height - Heatmap height
     */
    renderHeatmapToCanvas(ctx, heatmapData, width, height) {
        const imageData = ctx.createImageData(width, height);
        const data = imageData.data;
        
        // Use imported viridis colormap
        
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = y * width + x;
                const value = heatmapData[idx];
                
                // Get color from viridis colormap
                const color = viridis(value);
                
                // Set pixel color
                const pixelIdx = idx * 4;
                data[pixelIdx] = color[0];     // R
                data[pixelIdx + 1] = color[1]; // G
                data[pixelIdx + 2] = color[2]; // B
                data[pixelIdx + 3] = 255;      // A
            }
        }
        
        ctx.putImageData(imageData, 0, 0);
    }
    
    /**
     * Download canvas as image
     * @param {HTMLCanvasElement} canvas - Canvas to download
     * @param {string} filename - Filename for download
     */
    downloadCanvas(canvas, filename) {
        canvas.toBlob((blob) => {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.click();
            URL.revokeObjectURL(url);
        });
    }
    
    /**
     * Take screenshot of current video frame with overlays
     */
    takeScreenshot() {
        // Ensure video is loaded
        if (!this.videoPlayer.videoWidth || !this.videoPlayer.videoHeight) {
            this.uiManager.showError('Video not loaded');
            return;
        }
        
        // Get current frame number
        const currentFrame = this.videoController.getCurrentFrame();
        
        // Take screenshot
        const result = this.screenshotCapture.takeScreenshot(
            this.videoPlayer,
            this.canvas,
            currentFrame,
            this.videoFilename || 'octopus_video'
        );
        
        if (!result.success) {
            this.uiManager.showError(`Screenshot failed: ${result.error}`);
        } else {
            // Optional: Show brief success feedback
            console.log(`Screenshot saved: ${result.filename}`);
        }
    }
    
    /**
     * Export heatmap data as JSON
     */
    exportHeatmapData() {
        if (!this.heatmapCalculator.isCalculated()) {
            this.uiManager.showError('No heatmap data to export');
            return;
        }
        
        const heatmapData = this.heatmapCalculator.getHeatmapData();
        const side = this.uiManager.getState().sideSelect;
        this.dataExporter.exportHeatmapJSON(heatmapData, side);
    }
    
    /**
     * Export trajectory data as JSON
     */
    exportTrajectoryJSON() {
        if (!this.trajectoryCalculator.isCalculated()) {
            this.uiManager.showError('No trajectory data to export');
            return;
        }
        
        const trajectoryData = this.trajectoryCalculator.getTrajectoryData();
        const side = this.uiManager.getState().sideSelect;
        this.dataExporter.exportTrajectoryJSON(trajectoryData, this.keyframesData.video_info, side);
    }
    
    /**
     * Export trajectory data as CSV
     */
    exportTrajectoryCSV() {
        if (!this.trajectoryCalculator.isCalculated()) {
            this.uiManager.showError('No trajectory data to export');
            return;
        }
        
        const trajectoryData = this.trajectoryCalculator.getTrajectoryData();
        const side = this.uiManager.getState().sideSelect;
        this.dataExporter.exportTrajectoryCSV(trajectoryData, side);
    }
    
    /**
     * Export activity data as JSON
     */
    exportActivityJSON() {
        const activityData = this.activityAnalyzer.getActivityData();
        const side = this.uiManager.getState().sideSelect;
        const metric = this.uiManager.getState().activityMetric;
        this.dataExporter.exportActivityJSON(activityData, this.keyframesData.video_info, metric, side);
    }
    
    /**
     * Export activity data as CSV
     */
    exportActivityCSV() {
        const activityData = this.activityAnalyzer.getActivityData();
        const side = this.uiManager.getState().sideSelect;
        this.dataExporter.exportActivityCSV(activityData, side);
    }
    
    /**
     * Export proximity data as JSON
     */
    exportProximityJSON() {
        const proximityData = this.proximityAnalyzer.getProximityData();
        const side = this.uiManager.getState().sideSelect;
        this.dataExporter.exportProximityJSON(proximityData, this.keyframesData.video_info, side);
    }
    
    /**
     * Export proximity data as CSV
     */
    exportProximityCSV() {
        const proximityData = this.proximityAnalyzer.getProximityData();
        const side = this.uiManager.getState().sideSelect;
        this.dataExporter.exportProximityCSV(proximityData, side);
    }
    
    /**
     * Export all analysis data as JSON
     */
    exportAllData() {
        const allData = {
            videoInfo: this.keyframesData.video_info,
            heatmapData: this.heatmapCalculator.isCalculated() ? this.heatmapCalculator.getHeatmapData() : null,
            trajectoryData: this.trajectoryCalculator.isCalculated() ? this.trajectoryCalculator.getTrajectoryData() : null,
            activityData: this.activityAnalyzer.getActivityData(),
            proximityData: this.proximityAnalyzer.getProximityData()
        };
        
        const side = this.uiManager.getState().sideSelect;
        this.dataExporter.exportAllJSON(allData, side);
    }
    
    /**
     * Export keyframes data as JSON
     */
    exportKeyframesData() {
        if (!this.keyframesData) {
            console.error('No keyframes data available to export');
            return;
        }
        this.dataExporter.exportKeyframesJSON(this.keyframesData);
    }
    
    /**
     * Toggle bounding box edit mode
     */
    toggleBboxEditMode() {
        if (this.bboxInteraction.isEnabled) {
            this.bboxInteraction.disable();
            this.draggedBboxes = {}; // Clear any dragged bboxes
            // Resume video when exiting edit mode (if it was playing before)
            if (!this.videoPlayer.paused) {
                this.videoPlayer.play();
            }
        } else {
            // Pause video when entering edit mode
            this.videoPlayer.pause();
            this.bboxInteraction.enable();
            // Update box toggle buttons when entering edit mode
            this.updateBoxToggleButtons();
        }
    }
    
    /**
     * Handle bounding box drag event
     */
    handleBboxDrag(data) {
        // Store the dragged bbox temporarily for rendering
        if (!this.draggedBboxes) {
            this.draggedBboxes = {};
        }
        
        this.draggedBboxes[data.side] = {
            index: data.index,
            bbox: data.newBox
        };
        
        // Re-render to show the dragged position
        this.render();
        this.updateSubmitButtonVisibility();
    }
    
    /**
     * Handle bounding box resize event
     */
    handleBboxResize(data) {
        // Use the same draggedBboxes storage for resize
        if (!this.draggedBboxes) {
            this.draggedBboxes = {};
        }
        
        this.draggedBboxes[data.side] = {
            index: data.index,
            bbox: data.newBox
        };
        
        // Re-render to show the resized position
        this.render();
        this.updateSubmitButtonVisibility();
    }
}