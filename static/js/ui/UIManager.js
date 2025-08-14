/**
 * UIManager - Manages UI controls and user interactions
 * Handles modal dialogs, control panels, and event delegation
 */
import { Events } from '../utils/EventBus.js';
import { DEFAULTS } from '../utils/Constants.js';

export class UIManager {
    /**
     * Create a UIManager
     * @param {EventBus} eventBus - Central event system
     */
    constructor(eventBus, visualizer) {
        this.eventBus = eventBus;
        
        // UI elements
        this.elements = {
            // Modal
            modal: document.getElementById('loadModal'),
            modalClose: document.querySelector('.close'),
            loadNewBtn: document.getElementById('loadNewBtn'),
            
            // Video Manager panels
            videoManagementPanel: document.getElementById('videoManagementPanel'),
            currentVideoName: document.getElementById('currentVideoName'),
            currentVideoStatus: document.getElementById('currentVideoStatus'),
            keyframeStatus: document.getElementById('keyframeStatus'),
            detectionSection: document.getElementById('detectionSection'),
            
            // Upload form
            uploadForm: document.getElementById('uploadForm'),
            videoFile: document.getElementById('videoFile'),
            
            // Quick load form
            quickLoadForm: document.getElementById('quickLoadForm'),
            codeInput: document.getElementById('codeInput'),
            availableCodesList: document.getElementById('availableCodesList'),
            codesGrid: document.getElementById('codesGrid'),
            
            // New management buttons
            loadIntoOctoWatchBtn: document.getElementById('loadIntoOctoWatchBtn'),
            deleteCurrentVideoBtn: document.getElementById('deleteCurrentVideoBtn'),
            unloadVideoBtn: document.getElementById('unloadVideoBtn'),
            runDetectionBtn: document.getElementById('runDetectionBtn'),
            importKeyframesBtn: document.getElementById('importKeyframesBtn'),
            keyframesFileInput: document.getElementById('keyframesFileInput'),
            
            // Video controls
            playPauseBtn: document.getElementById('playPauseBtn'),
            prevFrameBtn: document.getElementById('prevFrameBtn'),
            nextFrameBtn: document.getElementById('nextFrameBtn'),
            prevKeyframeBtn: document.getElementById('prevKeyframeBtn'),
            nextKeyframeBtn: document.getElementById('nextKeyframeBtn'),
            screenshotBtn: document.getElementById('screenshotBtn'),
            frameSlider: document.getElementById('frameSlider'),
            frameNumber: document.getElementById('frameNumber'),
            frameInfo: document.getElementById('frameInfo'),
            
            // Visualization options
            showTank: document.getElementById('showTank'),
            enableInterpolation: document.getElementById('enableInterpolation'),
            editBoundingBoxesBtn: document.getElementById('editBoundingBoxesBtn'),
            boxToggleContainer: document.getElementById('boxToggleContainer'),
            sideSelect: document.getElementById('sideSelect'),
            showTrajectory: document.getElementById('showTrajectory'),
            trajectoryAlphaContainer: document.getElementById('trajectoryAlphaContainer'),
            trajectoryAlphaSlider: document.getElementById('trajectoryAlphaSlider'),
            trajectoryAlphaValue: document.getElementById('trajectoryAlphaValue'),
            showSpatialHeatmap: document.getElementById('showSpatialHeatmap'),
            heatmapAlphaContainer: document.getElementById('heatmapAlphaContainer'),
            heatmapAlphaSlider: document.getElementById('heatmapAlphaSlider'),
            heatmapAlphaValue: document.getElementById('heatmapAlphaValue'),
            useViridisColormap: document.getElementById('useViridisColormap'),
            viridisColormapLabel: document.getElementById('viridisColormapLabel'),
            
            // Export menu
            exportMenuBtn: document.getElementById('exportMenuBtn'),
            exportMenu: document.getElementById('exportMenu'),
            exportHeatmapImages: document.getElementById('exportHeatmapImages'),
            exportHeatmapData: document.getElementById('exportHeatmapData'),
            exportTrajectoryJSON: document.getElementById('exportTrajectoryJSON'),
            exportTrajectoryCSV: document.getElementById('exportTrajectoryCSV'),
            exportActivityJSON: document.getElementById('exportActivityJSON'),
            exportActivityCSV: document.getElementById('exportActivityCSV'),
            exportProximityJSON: document.getElementById('exportProximityJSON'),
            exportProximityCSV: document.getElementById('exportProximityCSV'),
            exportAllJSON: document.getElementById('exportAllJSON'),
            exportKeyframesJSON: document.getElementById('exportKeyframesJSON'),
            exportZoneInfoCSV: document.getElementById('exportZoneInfoCSV'),
            
            // Export settings
            exportPostfix: document.getElementById('exportPostfix'),
            
            // Sensitivity controls
            activitySensitivitySlider: document.getElementById('activitySensitivitySlider'),
            activitySensitivityValue: document.getElementById('activitySensitivityValue'),
            proximitySensitivitySlider: document.getElementById('proximitySensitivitySlider'),
            proximitySensitivityValue: document.getElementById('proximitySensitivityValue'),
            
            // Deletion controls
            deleteKeyframesBtn: document.getElementById('deleteKeyframesBtn'),
            keyframeDeletionModal: document.getElementById('keyframeDeletionModal'),
            keyframeDeletionMessage: document.getElementById('keyframeDeletionMessage'),
            deletionSide: document.getElementById('deletionSide'),
            deletionMethod: document.getElementById('deletionMethod'),
            dMethod: document.getElementById('dMethod'),
            deletionStartTime: document.getElementById('deletionStartTime'),
            deletionEndTime: document.getElementById('deletionEndTime'),
            deletionFrameCount: document.getElementById('deletionFrameCount'),
            cancelKeyframeDeletionBtn: document.getElementById('cancelKeyframeDeletionBtn'),
            confirmKeyframeDeletionBtn: document.getElementById('confirmKeyframeDeletionBtn'),
            deletionSideContainer: document.getElementById('deletionSideContainer'),
            deletionSideSelect: document.getElementById('deletionSideSelect'),
            deletionMethodSelect: document.getElementById('deletionMethodSelect'),
            
            // Backups controls
            viewBackupsBtn: document.getElementById('viewBackupsBtn'),
            backupsModal: document.getElementById('backupsModal'),
            backupsModalClose: document.getElementById('backupsModalClose'),
            backupsLoading: document.getElementById('backupsLoading'),
            backupsList: document.getElementById('backupsList'),
            backupsTableBody: document.getElementById('backupsTableBody'),
            noBackupsMessage: document.getElementById('noBackupsMessage'),
            
            // Analysis controls
            activityMetric: document.getElementById('activityMetric'),
            proximityMetric: document.getElementById('proximityMetric'),
            //fourierAnalysis: document.getElementById('fourierAnalysis'),
            //fourierControls: document.getElementById('fourierControls'),
            freqRankSlider: document.getElementById('freqRankSlider'),
            freqRankValue: document.getElementById('freqRankValue'),
            freqInfo: document.getElementById('freqInfo'),
            
            // Zone analysis display
            zoneAnalysisContainer: document.getElementById('zoneAnalysisContainer'),
            leftZoneDisplay: document.getElementById('leftZoneDisplay'),
            rightZoneDisplay: document.getElementById('rightZoneDisplay'),
            overlapZoneDisplay: document.getElementById('overlapZoneDisplay'),
            toggleZoneVisualization: document.getElementById('toggleZoneVisualization'),
            
            // Sections
            visualizerSection: document.getElementById('visualizerSection'),
            activityHeatmap: document.getElementById('activityHeatmap'),
            
            // Thumbnail elements
            videoThumbnailContainer: document.getElementById('videoThumbnailContainer'),
            videoThumbnail: document.getElementById('videoThumbnail'),
            thumbnailLoading: document.getElementById('thumbnailLoading')
        };
        
        // UI state
        this.state = {
            activitySensitivity: DEFAULTS.ACTIVITY_SENSITIVITY,
            proximitySensitivity: DEFAULTS.PROXIMITY_SENSITIVITY,
            trajectoryAlpha: DEFAULTS.TRAJECTORY_ALPHA,
            heatmapAlpha: DEFAULTS.HEATMAP_ALPHA,
            frequencyRank: DEFAULTS.FREQUENCY_RANK,
            showZoneVisualization: false,
            useViridisColormap: true,
            deletionMode: false,
            deletionSelection: {
                startProgress: null,
                endProgress: null,
                isDragging: false
            }
        };
        
        // Data references
        this.keyframesData = null;
        this.videoFilename = null;
        this.visualizer = visualizer;
        this.currentVideoCode = null;
        this.currentVideoHasKeyframes = false;
        
        // Load saved export postfix
        this.loadExportPostfix();
        
        this.setupEventListeners();
        this.setupEventHandlers();
        
        // Initialize video list on modal open
        this.loadAvailableVideos();
    }

    /**
     * Setup UI event listeners
     */
    setupEventListeners() {
        // Modal controls
        this.elements.modalClose.addEventListener('click', () => this.hideModal());
        this.elements.loadNewBtn.addEventListener('click', () => this.showModal());
        
        // Click outside modal to close
        window.addEventListener('click', (e) => {
            if (e.target === this.elements.modal) {
                this.hideModal();
            }
            if (e.target === this.elements.keyframeDeletionModal) {
                this.hideKeyframeDeletionModal();
            }
        });
        
        // Delete confirmation modal controls
        const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
        const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
        const deleteConfirmModal = document.getElementById('deleteConfirmModal');
        
        cancelDeleteBtn?.addEventListener('click', () => this.hideDeleteConfirmation());
        confirmDeleteBtn?.addEventListener('click', () => this.handleDeleteConfirm());
        
        // Close modal on outside click
        deleteConfirmModal?.addEventListener('click', (e) => {
            if (e.target === deleteConfirmModal) {
                this.hideDeleteConfirmation();
            }
        });
        
        // Keyframe deletion modal controls
        this.elements.cancelKeyframeDeletionBtn?.addEventListener('click', () => this.hideKeyframeDeletionModal());
        this.elements.confirmKeyframeDeletionBtn?.addEventListener('click', () => this.handleKeyframeDeletionConfirm());
        
        // Upload form
        this.elements.uploadForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleFileUploadSubmit();
        });
        
        
        // Quick load form
        this.elements.quickLoadForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleQuickLoadSubmit(true);
        });
        
        // New management buttons
        if (this.elements.loadIntoOctoWatchBtn) {
            this.elements.loadIntoOctoWatchBtn.addEventListener('click', () => {
                this.handleLoadIntoOctoWatch();
            });
        }
        
        if (this.elements.deleteCurrentVideoBtn) {
            this.elements.deleteCurrentVideoBtn.addEventListener('click', () => {
                this.handleDeleteCurrentVideo();
            });
        }
        
        if (this.elements.unloadVideoBtn) {
            this.elements.unloadVideoBtn.addEventListener('click', () => {
                this.handleUnloadVideo();
            });
        }
        
        // Import keyframes button functionality
        if (this.elements.importKeyframesBtn) {
            this.elements.importKeyframesBtn.addEventListener('click', () => {
                this.elements.keyframesFileInput.click();
            });
            
            this.elements.keyframesFileInput.addEventListener('change', (e) => {
                this.handleKeyframesImport(e);
            });
        }
        
        // Run detection button
        if (this.elements.runDetectionBtn) {
            this.elements.runDetectionBtn.addEventListener('click', () => {
                this.handleRunDetection();
            });
        }
        
        // Experiment type dropdown
        const experimentSelect = document.getElementById('experimentTypeSelect');
        if (experimentSelect) {
            experimentSelect.addEventListener('change', () => {
                this.updateRunDetectionState();
            });
        }
        
        // Zone visualization toggle
        if (this.elements.toggleZoneVisualization) {
            this.elements.toggleZoneVisualization.addEventListener('click', () => {
                this.state.showZoneVisualization = !this.state.showZoneVisualization;
                
                // Update button text
                this.elements.toggleZoneVisualization.textContent = 
                    this.state.showZoneVisualization ? 'Hide' : 'Show';
                
                // Update button style
                this.elements.toggleZoneVisualization.style.background = 
                    this.state.showZoneVisualization ? '#28a745' : '#6c757d';
                
                // Emit event to trigger re-render
                this.eventBus.emit(Events.UI_CONTROL_CHANGE, {
                    control: 'showZoneVisualization',
                    value: this.state.showZoneVisualization
                });
            });
        }
        
        // Video controls
        this.elements.playPauseBtn.addEventListener('click', () => {
            this.eventBus.emit('ui:playPauseClick');
        });
        
        this.elements.prevFrameBtn.addEventListener('click', () => {
            this.eventBus.emit('ui:stepFrame', { direction: -1 });
        });
        
        this.elements.nextFrameBtn.addEventListener('click', () => {
            this.eventBus.emit('ui:stepFrame', { direction: 1 });
        });
        
        this.elements.prevKeyframeBtn.addEventListener('click', () => {
            this.eventBus.emit('ui:jumpKeyframe', { direction: -1 });
        });
        
        this.elements.nextKeyframeBtn.addEventListener('click', () => {
            this.eventBus.emit('ui:jumpKeyframe', { direction: 1 });
        });
        
        this.elements.frameSlider.addEventListener('input', (e) => {
            const frame = parseInt(e.target.value);
            this.eventBus.emit('ui:seekFrame', { frame });
        });
        
        // Screenshot button
        this.elements.screenshotBtn.addEventListener('click', () => {
            this.eventBus.emit('ui:takeScreenshot');
        });
        
        // Delete keyframes button
        this.elements.deleteKeyframesBtn.addEventListener('click', () => {
            this.toggleDeletionMode();
        });
        
        // View backups button
        this.elements.viewBackupsBtn.addEventListener('click', () => {
            this.showBackupsModal();
        });
        
        // Backups modal close button
        this.elements.backupsModalClose.addEventListener('click', () => {
            this.hideBackupsModal();
        });
        
        // Close backups modal on outside click
        window.addEventListener('click', (e) => {
            if (e.target === this.elements.backupsModal) {
                this.hideBackupsModal();
            }
        });
        
        // Edit bounding boxes button
        this.elements.editBoundingBoxesBtn.addEventListener('click', () => {
            this.toggleBboxEditMode();
        });
                
        
        // Visualization options
        this.elements.showTank.addEventListener('change', () => {
            this.eventBus.emit(Events.UI_CONTROL_CHANGE, {
                control: 'showTank',
                value: this.elements.showTank.checked
            });
        });
        
        this.elements.enableInterpolation.addEventListener('change', () => {
            this.eventBus.emit(Events.UI_CONTROL_CHANGE, {
                control: 'enableInterpolation',
                value: this.elements.enableInterpolation.checked
            });
        });
        
        this.elements.sideSelect.addEventListener('change', () => {
            this.eventBus.emit(Events.UI_CONTROL_CHANGE, {
                control: 'sideSelect',
                value: this.elements.sideSelect.value
            });
        });
        
        this.elements.showTrajectory.addEventListener('change', () => {
            const isChecked = this.elements.showTrajectory.checked;
            this.elements.trajectoryAlphaContainer.style.display = isChecked ? 'flex' : 'none';
            this.eventBus.emit(Events.UI_CONTROL_CHANGE, {
                control: 'showTrajectory',
                value: isChecked
            });
        });
        
        this.elements.showSpatialHeatmap.addEventListener('change', () => {
            const isChecked = this.elements.showSpatialHeatmap.checked;
            this.elements.heatmapAlphaContainer.style.display = isChecked ? 'block' : 'none';
            this.elements.viridisColormapLabel.style.display = isChecked ? 'flex' : 'none';
            this.eventBus.emit(Events.UI_CONTROL_CHANGE, {
                control: 'showSpatialHeatmap',
                value: isChecked
            });
        });
        
        // Heatmap alpha slider
        this.elements.heatmapAlphaSlider.addEventListener('input', (e) => {
            this.state.heatmapAlpha = parseFloat(e.target.value);
            this.elements.heatmapAlphaValue.textContent = this.state.heatmapAlpha.toFixed(2);
            this.eventBus.emit(Events.UI_CONTROL_CHANGE, {
                control: 'heatmapAlpha',
                value: this.state.heatmapAlpha
            });
        });
        
        // Viridis colormap checkbox
        this.elements.useViridisColormap.addEventListener('change', (e) => {
            this.state.useViridisColormap = e.target.checked;
            this.eventBus.emit(Events.UI_CONTROL_CHANGE, {
                control: 'heatmapColormap',
                value: this.state.useViridisColormap
            });
        });
        
        // Export menu button
        this.elements.exportMenuBtn.addEventListener('click', () => {
            this.toggleExportMenu();
        });
        
        // Export menu handlers
        this.elements.exportHeatmapImages.addEventListener('click', () => {
            this.eventBus.emit(Events.EXPORT_HEATMAP_IMAGES);
            this.hideExportMenu();
        });
        
        this.elements.exportHeatmapData.addEventListener('click', () => {
            this.eventBus.emit(Events.EXPORT_HEATMAP_DATA);
            this.hideExportMenu();
        });
        
        this.elements.exportTrajectoryJSON.addEventListener('click', () => {
            this.eventBus.emit(Events.EXPORT_TRAJECTORY_JSON);
            this.hideExportMenu();
        });
        
        this.elements.exportTrajectoryCSV.addEventListener('click', () => {
            this.eventBus.emit(Events.EXPORT_TRAJECTORY_CSV);
            this.hideExportMenu();
        });
        
        this.elements.exportActivityJSON.addEventListener('click', () => {
            this.eventBus.emit(Events.EXPORT_ACTIVITY_JSON);
            this.hideExportMenu();
        });
        
        this.elements.exportActivityCSV.addEventListener('click', () => {
            this.eventBus.emit(Events.EXPORT_ACTIVITY_CSV);
            this.hideExportMenu();
        });
        
        this.elements.exportProximityJSON.addEventListener('click', () => {
            this.eventBus.emit(Events.EXPORT_PROXIMITY_JSON);
            this.hideExportMenu();
        });
        
        this.elements.exportProximityCSV.addEventListener('click', () => {
            this.eventBus.emit(Events.EXPORT_PROXIMITY_CSV);
            this.hideExportMenu();
        });
        
        this.elements.exportAllJSON.addEventListener('click', () => {
            this.eventBus.emit(Events.EXPORT_ALL_JSON);
            this.hideExportMenu();
        });
        
        this.elements.exportKeyframesJSON.addEventListener('click', () => {
            this.eventBus.emit(Events.EXPORT_KEYFRAMES_JSON);
            this.hideExportMenu();
        });
        
        this.elements.exportZoneInfoCSV.addEventListener('click', () => {
            this.eventBus.emit(Events.EXPORT_ZONE_INFO_CSV);
            this.hideExportMenu();
        });
        
        // Click outside to close export menu
        document.addEventListener('click', (e) => {
            if (!this.elements.exportMenuBtn.contains(e.target) && 
                !this.elements.exportMenu.contains(e.target)) {
                this.hideExportMenu();
            }
        });
        
        // Export postfix input
        if (this.elements.exportPostfix) {
            this.elements.exportPostfix.addEventListener('input', (e) => {
                // Remove non-alphanumeric characters and limit to 8 chars
                const value = e.target.value;
                
                // Save to localStorage and update DataExporter
                localStorage.setItem('exportPostfix', value);
                if (this.visualizer && this.visualizer.dataExporter) {
                    this.visualizer.dataExporter.setExportPostfix(value);
                }
            });
        }
        
        // Trajectory alpha slider
        this.elements.trajectoryAlphaSlider.addEventListener('input', (e) => {
            this.state.trajectoryAlpha = parseFloat(e.target.value);
            this.elements.trajectoryAlphaValue.textContent = this.state.trajectoryAlpha.toFixed(2);
            this.eventBus.emit(Events.UI_CONTROL_CHANGE, {
                control: 'trajectoryAlpha',
                value: this.state.trajectoryAlpha
            });
        });
        
        // Sensitivity sliders
        this.elements.activitySensitivitySlider.addEventListener('input', (e) => {
            this.state.activitySensitivity = parseFloat(e.target.value);
            this.elements.activitySensitivityValue.textContent = this.state.activitySensitivity.toFixed(3);
            this.eventBus.emit(Events.UI_CONTROL_CHANGE, {
                control: 'activitySensitivity',
                value: this.state.activitySensitivity
            });
        });
        
        this.elements.proximitySensitivitySlider.addEventListener('input', (e) => {
            this.state.proximitySensitivity = parseFloat(e.target.value);
            this.elements.proximitySensitivityValue.textContent = this.state.proximitySensitivity.toFixed(3);
            this.eventBus.emit(Events.UI_CONTROL_CHANGE, {
                control: 'proximitySensitivity',
                value: this.state.proximitySensitivity
            });
        });
        
        // Analysis controls
        this.elements.activityMetric.addEventListener('change', (e) => {
            this.eventBus.emit(Events.UI_CONTROL_CHANGE, {
                control: 'activityMetric',
                value: e.target.value
            });
        });
        
        this.elements.proximityMetric.addEventListener('change', (e) => {
            this.eventBus.emit(Events.UI_CONTROL_CHANGE, {
                control: 'proximityMetric',
                value: e.target.value
            });
        });
        
        /*this.elements.fourierAnalysis.addEventListener('change', (e) => {
            const isChecked = e.target.checked;
            this.elements.fourierControls.style.display = isChecked ? 'block' : 'none';
            this.eventBus.emit(Events.UI_CONTROL_CHANGE, {
                control: 'showFourierAnalysis',
                value: isChecked
            });
        });*/
        
        this.elements.freqRankSlider.addEventListener('input', (e) => {
            this.state.frequencyRank = parseInt(e.target.value);
            this.elements.freqRankValue.textContent = this.state.frequencyRank;
            this.eventBus.emit(Events.UI_CONTROL_CHANGE, {
                control: 'frequencyRank',
                value: this.state.frequencyRank
            });
        });
        
        // Heatmap interaction (seeking and deletion selection)
        this.setupHeatmapInteraction();
    }

    /**
     * Setup event handlers from other modules
     */
    setupEventHandlers() {
        // Video events
        this.eventBus.on(Events.VIDEO_PLAY, () => {
            this.elements.playPauseBtn.textContent = 'Pause';
        });
        
        this.eventBus.on(Events.VIDEO_PAUSE, () => {
            this.elements.playPauseBtn.textContent = 'Play';
        });
        
        this.eventBus.on(Events.VIDEO_FRAME_UPDATE, (data) => {
            this.updateFrameDisplay(data.frame);
        });
        
        this.eventBus.on(Events.VIDEO_LOADED, () => {
            this.elements.visualizerSection.style.display = 'block';
        });
        
        // Modal events
        this.eventBus.on(Events.UI_MODAL_SHOW, (data) => {
            if (data && data.type === 'loading') {
                // Show loading state
            } else {
                this.showModal();
            }
        });
        
        this.eventBus.on(Events.UI_MODAL_HIDE, () => {
            this.hideModal();
        });
        
        // Data loaded
        this.eventBus.on(Events.DATA_LOADED, (data) => {
            this.keyframesData = data.keyframesData;
            this.videoFilename = data.videoFilename;
            
            const fps = data.keyframesData.video_info.fps || DEFAULTS.FPS;
            const totalFrames = data.keyframesData.video_info.total_frames_processed;
            this.elements.frameSlider.max = totalFrames;
            
            // Show export button and zone analysis when data is loaded
            this.elements.exportMenuBtn.style.display = 'block';
            this.elements.zoneAnalysisContainer.style.display = 'block';
        });
        
        // Listen for zone analysis completion
        this.eventBus.on(Events.ZONE_ANALYSIS_CALCULATED, (data) => {
            this.displayZoneAnalysis(data);
        });
        
        // Detection completed
        this.eventBus.on('detection:completed', (data) => {
            // Update current video to show it now has keyframes
            if (data.code === this.currentVideoCode) {
                this.updateCurrentVideoDisplay(data.code, true);
            }
            this.loadAvailableVideos();
        });
        
        // Code check result
        this.eventBus.on('detection:codeCheckResult', (data) => {
            if (data.exists) {
                this.updateCurrentVideoDisplay(data.code, data.hasKeyframes, data.experimentType);
            } else {
                this.showError(`Video MVI_${data.code}_proxy not found`);
            }
        });
    }

    /**
     * Show modal dialog
     */
    showModal() {
        this.elements.modal.style.display = 'block';
        // Refresh video list when modal opens
        this.loadAvailableVideos();
    }

    /**
     * Hide modal dialog
     */
    hideModal() {
        this.elements.modal.style.display = 'none';
    }

    /**
     * Handle file upload form submission
     */
    async handleFileUploadSubmit() {
        const videoFile = this.elements.videoFile.files[0];
        
        if (!videoFile) {
            Swal.fire({
                icon: 'warning',
                title: 'No file selected',
                text: 'Please select a video file',
                confirmButtonColor: '#007bff'
            });
            return;
        }
        
        // Upload and then select the new video
        this.eventBus.emit('ui:uploadVideo', { videoFile });
        
        // Listen for upload completion to select the new video
        this.eventBus.once('upload:completed', (data) => {
            if (data.code) {
                this.updateCurrentVideoDisplay(data.code, false);
                // Clear the file input
                this.elements.videoFile.value = '';
            }
        });
    }

    /**
     * Handle quick load form submission
     */
    handleQuickLoadSubmit(explicit = false) {
        const code = this.elements.codeInput.value.trim();
        if (!code) {
            this.showError('Please enter a 4-digit code');
            return;
        }
        
        // Check if video exists and update display
        this.eventBus.emit('detection:checkCode', { code, explicit, selectOnly: true });
    }

    /**
     * Load available videos on modal open
     */
    async loadAvailableVideos() {
        try {
            this.eventBus.emit('ui:fetchAvailableCodes');
        } catch (error) {
            this.showError('Failed to load available videos');
        }
    }
    
    /**
     * Update current video display
     * @param {string} code - Video code
     * @param {boolean} hasKeyframes - Whether video has keyframes
     * @param {string|null} experimentType - Type of experiment (mirror/social/control or null)
     */
    updateCurrentVideoDisplay(code, hasKeyframes, experimentType = null) {
        this.currentVideoCode = code;
        this.currentVideoHasKeyframes = hasKeyframes;
        
        // Show management panel
        this.elements.videoManagementPanel.style.display = 'block';
        
        // Update video info
        this.elements.currentVideoName.textContent = `MVI_${code}_proxy.mp4`;
        this.elements.currentVideoStatus.textContent = hasKeyframes ? '✅ Has keyframes' : '⚠️ Needs detection';
        
        // Load and display thumbnail
        this.loadVideoThumbnail(code);
        
        // Show experiment type dropdown and set its state
        const experimentContainer = document.getElementById('experimentTypeContainer');
        const experimentSelect = document.getElementById('experimentTypeSelect');
        if (experimentContainer) {
            experimentContainer.style.display = 'block';
        }
        if (experimentSelect) {
            // Set dropdown based on mirror status or existing experiment type
            if (hasKeyframes) {
                // For existing videos with keyframes, set based on mirror flag
                experimentSelect.value = experimentType || '';
            } else {
                // For new videos, reset to default
                experimentSelect.value = '';
            }
            // Enable/disable run detection based on selection
            this.updateRunDetectionState();
        }
        
        // Update keyframe status and detection section
        if (hasKeyframes) {
            this.elements.keyframeStatus.style.display = 'block';
            this.elements.keyframeStatus.textContent = 'Keyframes available - ready to visualize';
            this.elements.keyframeStatus.style.backgroundColor = '#d4edda';
            this.elements.keyframeStatus.style.borderColor = '#28a745';
            // Show detection section with Re-run option
            this.elements.detectionSection.style.display = 'block';
            if (this.elements.runDetectionBtn) {
                this.elements.runDetectionBtn.textContent = '🔄 Re-run Detection';
            }
        } else {
            this.elements.keyframeStatus.style.display = 'block';
            this.elements.keyframeStatus.textContent = 'No keyframes - run detection or import';
            this.elements.keyframeStatus.style.backgroundColor = '#fff3cd';
            this.elements.keyframeStatus.style.borderColor = '#ffc107';
            this.elements.detectionSection.style.display = 'block';
            if (this.elements.runDetectionBtn) {
                this.elements.runDetectionBtn.textContent = '🔍 Run Detection';
            }
        }
        
        // Enable/disable Load into OctoWatch button
        this.elements.loadIntoOctoWatchBtn.disabled = !hasKeyframes;
        
        // Update code status
        const statusEl = document.getElementById('codeStatus');
        if (statusEl) {
            statusEl.textContent = '';
            statusEl.style.display = 'none';
        }
    }
    
    /**
     * Load and display video thumbnail
     * @param {string} code - Video code
     */
    async loadVideoThumbnail(code) {
        // Show thumbnail container and loading state
        if (this.elements.videoThumbnailContainer) {
            this.elements.videoThumbnailContainer.style.display = 'block';
            this.elements.thumbnailLoading.style.display = 'flex';
            this.elements.videoThumbnail.style.display = 'none';
            
            try {
                // Fetch thumbnail from server
                const response = await fetch(`/video-thumbnail/${code}`);
                
                if (response.ok) {
                    // Create blob URL for the image
                    const blob = await response.blob();
                    const imageUrl = URL.createObjectURL(blob);
                    
                    // Set the image source and show it
                    this.elements.videoThumbnail.src = imageUrl;
                    this.elements.videoThumbnail.onload = () => {
                        this.elements.thumbnailLoading.style.display = 'none';
                        this.elements.videoThumbnail.style.display = 'block';
                    };
                } else {
                    // Hide loading and show placeholder or error
                    this.elements.thumbnailLoading.style.display = 'none';
                    console.error('Failed to load thumbnail:', response.status);
                }
            } catch (error) {
                // Hide loading on error
                this.elements.thumbnailLoading.style.display = 'none';
                console.error('Error loading thumbnail:', error);
            }
        }
    }
    
    /**
     * Handle Load into OctoWatch button click
     */
    handleLoadIntoOctoWatch() {
        if (!this.currentVideoCode || !this.currentVideoHasKeyframes) {
            this.showError('Cannot load video without keyframes');
            return;
        }
        
        // Hide modal
        this.hideModal();
        
        // Emit event to load video into visualizer
        this.eventBus.emit('ui:quickLoad', { code: this.currentVideoCode });
    }
    
    /**
     * Handle unload video - clear selection and return to initial state
     */
    handleUnloadVideo() {
        // Clear current video state
        this.currentVideoCode = null;
        this.currentVideoHasKeyframes = false;
        
        // Hide management panel
        this.elements.videoManagementPanel.style.display = 'none';
        
        // Hide thumbnail
        if (this.elements.videoThumbnailContainer) {
            this.elements.videoThumbnailContainer.style.display = 'none';
            this.elements.videoThumbnail.src = '';
        }
        
        // Hide experiment type dropdown
        const experimentContainer = document.getElementById('experimentTypeContainer');
        if (experimentContainer) {
            experimentContainer.style.display = 'none';
        }
        
        // Clear the quick load input
        if (this.elements.codeInput) {
            this.elements.codeInput.value = '';
        }
        
        // Clear any status messages
        const statusEl = document.getElementById('codeStatus');
        if (statusEl) {
            statusEl.textContent = '';
            statusEl.style.display = 'none';
        }
    }
    
    /**
     * Handle delete current video
     */
    async handleDeleteCurrentVideo() {
        if (!this.currentVideoCode) return;
        
        const result = await Swal.fire({
            icon: 'warning',
            title: 'Delete Video?',
            text: `This will permanently delete MVI_${this.currentVideoCode}_proxy and its keyframes`,
            showCancelButton: true,
            confirmButtonColor: '#dc3545',
            cancelButtonColor: '#6c757d',
            confirmButtonText: 'Yes, delete it',
            cancelButtonText: 'Cancel'
        });
        
        if (result.isConfirmed) {
            try {
                const response = await fetch(`/delete-video/${this.currentVideoCode}`, {
                    method: 'DELETE'
                });
                
                const data = await response.json();
                
                if (response.ok) {
                    this.showSuccess(`Deleted MVI_${this.currentVideoCode}_proxy`);
                    
                    // Clear current video
                    this.currentVideoCode = null;
                    this.currentVideoHasKeyframes = false;
                    this.elements.videoManagementPanel.style.display = 'none';
                    
                    // Refresh video list
                    this.loadAvailableVideos();
                } else {
                    this.showError(data.error || 'Failed to delete video');
                }
            } catch (error) {
                this.showError('Network error while deleting video');
            }
        }
    }
    
    /**
     * Handle keyframes import
     * @param {Event} e - File input change event
     */
    async handleKeyframesImport(e) {
        const file = e.target.files[0];
        if (!file || !this.currentVideoCode) return;
        
        const formData = new FormData();
        formData.append('keyframes', file);
        
        try {
            const response = await fetch(`/import-keyframes/${this.currentVideoCode}`, {
                method: 'POST',
                body: formData
            });
            
            const data = await response.json();
            
            if (response.ok) {
                this.showSuccess('Keyframes imported successfully');
                this.updateCurrentVideoDisplay(this.currentVideoCode, true);
                this.loadAvailableVideos();
            } else {
                this.showError(data.error || 'Failed to import keyframes');
            }
        } catch (error) {
            this.showError('Network error while importing keyframes');
        }
        
        // Clear file input
        e.target.value = '';
    }
    
    /**
     * Update run detection button state based on experiment type selection
     */
    updateRunDetectionState() {
        const experimentSelect = document.getElementById('experimentTypeSelect');
        const tooltip = document.getElementById('runDetectionTooltip');
        if (!experimentSelect || !this.elements.runDetectionBtn) return;
        
        const hasSelection = experimentSelect.value !== '';
        this.elements.runDetectionBtn.disabled = !hasSelection;
        
        // Update tooltip visibility and text
        if (tooltip) {
            if (!hasSelection) {
                tooltip.textContent = 'Please select experiment type first';
            } else {
                // You can update the tooltip text based on selection if needed
                tooltip.textContent = `Run detection for ${experimentSelect.value} experiment`;
            }
        }
    }
    
    /**
     * Handle run detection button click
     */
    handleRunDetection() {
        if (!this.currentVideoCode) return;
        
        const experimentSelect = document.getElementById('experimentTypeSelect');
        if (!experimentSelect || !experimentSelect.value) {
            this.showError('Please select experiment type first');
            return;
        }
        
        // Run detection with mirror flag set if experiment type is 'mirror'
        const experimentType = experimentSelect.value;
        this.eventBus.emit('detection:run', { 
            code: this.currentVideoCode,
            experimentType: experimentType
        });
    }

    /**
     * Display available codes in grid
     * @param {Array} codes - Array of code objects
     */
    displayAvailableCodes(codes) {
        this.elements.codesGrid.innerHTML = '';
        
        codes.forEach(codeInfo => {
            const codeElement = document.createElement('div');
            codeElement.className = 'code-item';
            codeElement.classList.add(codeInfo.has_keyframes ? 'code-ready' : 'code-needs-detection');
            
            const codeNumber = document.createElement('div');
            codeNumber.className = 'code-number';
            codeNumber.textContent = codeInfo.code;
            
            const statusIcon = document.createElement('div');
            statusIcon.className = 'code-status-icon';
            statusIcon.textContent = codeInfo.has_keyframes ? '✅' : '⚪️';
            statusIcon.title = codeInfo.has_keyframes ? 'Ready to load' : 'Needs detection';
            
            // Add mirror indicator if video is mirrored
            if (codeInfo.experiment_type) {
                const experimentIcon = document.createElement('div');
                experimentIcon.className = 'code-experiment-icon';
                
                // Set icon and title based on experiment type
                switch(codeInfo.experiment_type) {
                    case 'mirror':
                        experimentIcon.textContent = '🪞';
                        experimentIcon.title = 'Mirror experiment';
                        break;
                    case 'social':
                        experimentIcon.innerHTML = '🐙<br>🐙';
                        experimentIcon.title = 'Social experiment';
                        break;
                    case 'control':
                        experimentIcon.textContent = '🐙';
                        experimentIcon.title = 'Control experiment';
                        break;
                }
                
                codeElement.appendChild(experimentIcon);
            }
            
            // Add delete button
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'code-delete-btn';
            deleteBtn.textContent = '×';
            deleteBtn.title = 'Delete this video';
            deleteBtn.onclick = (e) => {
                e.stopPropagation(); // Prevent triggering the code click
                this.showDeleteConfirmation(codeInfo.code);
            };
            
            codeElement.appendChild(codeNumber);
            codeElement.appendChild(statusIcon);
            codeElement.appendChild(deleteBtn);
            
            // Make clickable
            codeElement.addEventListener('click', () => {
                // Update current video display with mirror status
                this.updateCurrentVideoDisplay(codeInfo.code, codeInfo.has_keyframes, codeInfo.experiment_type || null);
            });
            
            this.elements.codesGrid.appendChild(codeElement);
        });
    }

    /**
     * Update frame display
     * @param {number} frame - Current frame number
     */
    updateFrameDisplay(frame) {
        this.elements.frameNumber.textContent = frame;
        this.elements.frameSlider.value = frame;
    }

    /**
     * Update frame info display
     * @param {string} info - Frame information text
     */
    updateFrameInfo(info) {
        this.elements.frameInfo.textContent = info;
    }

    /**
     * Update frequency info display
     * @param {string} info - Frequency information text
     */
    updateFrequencyInfo(info) {
        this.elements.freqInfo.textContent = info;
    }

    /**
     * Get current UI state
     * @returns {Object} Current UI state
     */
    getState() {
        return {
            showTank: this.elements.showTank.checked,
            enableInterpolation: this.elements.enableInterpolation.checked,
            sideSelect: this.elements.sideSelect.value,
            showTrajectory: this.elements.showTrajectory.checked,
            trajectoryAlpha: this.state.trajectoryAlpha,
            showSpatialHeatmap: this.elements.showSpatialHeatmap.checked,
            heatmapAlpha: this.state.heatmapAlpha,
            useViridisColormap: this.state.useViridisColormap,
            activitySensitivity: this.state.activitySensitivity,
            proximitySensitivity: this.state.proximitySensitivity,
            activityMetric: this.elements.activityMetric.value,
            proximityMetric: this.elements.proximityMetric.value,
            showZoneVisualization: this.state.showZoneVisualization,
            //showFourierAnalysis: this.elements.fourierAnalysis.checked,
            frequencyRank: this.state.frequencyRank
        };
    }

    /**
     * Enable/disable controls
     * @param {boolean} enabled - True to enable controls
     */
    setControlsEnabled(enabled) {
        const controls = [
            this.elements.playPauseBtn,
            this.elements.prevFrameBtn,
            this.elements.nextFrameBtn,
            this.elements.prevKeyframeBtn,
            this.elements.nextKeyframeBtn,
            this.elements.screenshotBtn,
            this.elements.frameSlider
        ];
        
        controls.forEach(control => {
            control.disabled = !enabled;
        });
    }

    /**
     * Show error message
     * @param {string} message - Error message to display
     */
    showError(message) {
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: message,
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 1000,
            timerProgressBar: true
        });
    }
    
    /**
     * Show success message
     * @param {string} message - Success message to display
     * @param {string} title - Optional title
     */
    showSuccess(message, title = 'Success!') {
        Swal.fire({
            icon: 'success',
            title: title,
            text: message,
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 1000,
            timerProgressBar: true
        });
    }
    
    /**
     * Show info message
     * @param {string} message - Info message to display
     * @param {string} title - Optional title
     */
    showInfo(message, title = 'Info') {
        Swal.fire({
            icon: 'info',
            title: title,
            text: message,
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 1000,
            timerProgressBar: true
        });
    }
    
    /**
     * Show delete success message
     * @param {string} message - Success message to display
     */
    showDeleteSuccess(message) {
        this.hideDeleteConfirmation();
        this.showSuccess(message);
    }

    /**
     * Display zone analysis results
     * @param {Object} data - Zone analysis data with left, right, and overlap percentages
     */
    displayZoneAnalysis(data) {
        if (!data || !data.left || !data.right) return;
        
        // Zones arranged in three rows
        const zonesRow1 = ['MP', 'H1', 'H2'];
        const zonesRow2 = ['D', 'T', 'B'];
        const zonesRow3 = ['H1T', 'H1B', 'H2T', 'H2B'];
        
        // Format left side zones as table rows
        this.elements.leftZoneDisplay.innerHTML = '';
        
        // First row
        const leftRow1 = document.createElement('tr');
        zonesRow1.forEach(zone => {
            const percentage = data.left.percentages[zone];
            const td = document.createElement('td');
            td.style.cssText = 'padding: 2px 4px; border: 1px solid #e0e0e0; background: white;';
            td.innerHTML = `<b>${zone}</b>:${percentage !== undefined ? percentage.toFixed(1) : '-'}`;
            leftRow1.appendChild(td);
        });
        this.elements.leftZoneDisplay.appendChild(leftRow1);
        
        // Second row
        const leftRow2 = document.createElement('tr');
        zonesRow2.forEach(zone => {
            const percentage = data.left.percentages[zone];
            const td = document.createElement('td');
            td.style.cssText = 'padding: 2px 4px; border: 1px solid #e0e0e0; background: white;';
            td.innerHTML = `<b>${zone}</b>:${percentage !== undefined ? percentage.toFixed(1) : '-'}`;
            leftRow2.appendChild(td);
        });
        this.elements.leftZoneDisplay.appendChild(leftRow2);
        
        // Third row - quadrants (2x2 layout in 3 columns)
        const leftRow3 = document.createElement('tr');
        // H1T and H1B in first column
        const td1 = document.createElement('td');
        td1.style.cssText = 'padding: 2px 4px; border: 1px solid #e0e0e0; background: white; font-size: 10px;';
        td1.innerHTML = `<b>H1T</b>:${data.left.percentages.H1T !== undefined ? data.left.percentages.H1T.toFixed(1) : '-'}<br><b>H1B</b>:${data.left.percentages.H1B !== undefined ? data.left.percentages.H1B.toFixed(1) : '-'}`;
        leftRow3.appendChild(td1);
        // H2T and H2B in second column
        const td2 = document.createElement('td');
        td2.style.cssText = 'padding: 2px 4px; border: 1px solid #e0e0e0; background: white; font-size: 10px;';
        td2.innerHTML = `<b>H2T</b>:${data.left.percentages.H2T !== undefined ? data.left.percentages.H2T.toFixed(1) : '-'}<br><b>H2B</b>:${data.left.percentages.H2B !== undefined ? data.left.percentages.H2B.toFixed(1) : '-'}`;
        leftRow3.appendChild(td2);
        // MPT and MPB in third column
        const td3 = document.createElement('td');
        td3.style.cssText = 'padding: 2px 4px; border: 1px solid #e0e0e0; background: white; font-size: 10px;';
        td3.innerHTML = `<b>MPT</b>:${data.left.percentages.MPT !== undefined ? data.left.percentages.MPT.toFixed(1) : '-'}<br><b>MPB</b>:${data.left.percentages.MPB !== undefined ? data.left.percentages.MPB.toFixed(1) : '-'}`;
        leftRow3.appendChild(td3);
        this.elements.leftZoneDisplay.appendChild(leftRow3);
        
        // Format right side zones as table rows
        this.elements.rightZoneDisplay.innerHTML = '';
        
        // First row
        const rightRow1 = document.createElement('tr');
        zonesRow1.forEach(zone => {
            const percentage = data.right.percentages[zone];
            const td = document.createElement('td');
            td.style.cssText = 'padding: 2px 4px; border: 1px solid #e0e0e0; background: white;';
            td.innerHTML = `<b>${zone}</b>:${percentage !== undefined ? percentage.toFixed(1) : '-'}`;
            rightRow1.appendChild(td);
        });
        this.elements.rightZoneDisplay.appendChild(rightRow1);
        
        // Second row
        const rightRow2 = document.createElement('tr');
        zonesRow2.forEach(zone => {
            const percentage = data.right.percentages[zone];
            const td = document.createElement('td');
            td.style.cssText = 'padding: 2px 4px; border: 1px solid #e0e0e0; background: white;';
            td.innerHTML = `<b>${zone}</b>:${percentage !== undefined ? percentage.toFixed(1) : '-'}`;
            rightRow2.appendChild(td);
        });
        this.elements.rightZoneDisplay.appendChild(rightRow2);
        
        // Third row - quadrants (2x2 layout in 3 columns)
        const rightRow3 = document.createElement('tr');
        // H1T and H1B in first column
        const rtd1 = document.createElement('td');
        rtd1.style.cssText = 'padding: 2px 4px; border: 1px solid #e0e0e0; background: white; font-size: 10px;';
        rtd1.innerHTML = `<b>H1T</b>:${data.right.percentages.H1T !== undefined ? data.right.percentages.H1T.toFixed(1) : '-'}<br><b>H1B</b>:${data.right.percentages.H1B !== undefined ? data.right.percentages.H1B.toFixed(1) : '-'}`;
        rightRow3.appendChild(rtd1);
        // H2T and H2B in second column
        const rtd2 = document.createElement('td');
        rtd2.style.cssText = 'padding: 2px 4px; border: 1px solid #e0e0e0; background: white; font-size: 10px;';
        rtd2.innerHTML = `<b>H2T</b>:${data.right.percentages.H2T !== undefined ? data.right.percentages.H2T.toFixed(1) : '-'}<br><b>H2B</b>:${data.right.percentages.H2B !== undefined ? data.right.percentages.H2B.toFixed(1) : '-'}`;
        rightRow3.appendChild(rtd2);
        // MPT and MPB in third column
        const rtd3 = document.createElement('td');
        rtd3.style.cssText = 'padding: 2px 4px; border: 1px solid #e0e0e0; background: white; font-size: 10px;';
        rtd3.innerHTML = `<b>MPT</b>:${data.right.percentages.MPT !== undefined ? data.right.percentages.MPT.toFixed(1) : '-'}<br><b>MPB</b>:${data.right.percentages.MPB !== undefined ? data.right.percentages.MPB.toFixed(1) : '-'}`;
        rightRow3.appendChild(rtd3);
        this.elements.rightZoneDisplay.appendChild(rightRow3);
        
        // Display overlap zones if available
        if (data.overlap && this.elements.overlapZoneDisplay) {
            this.elements.overlapZoneDisplay.innerHTML = '';
            
            // First row - basic overlap zones
            const overlapRow1 = document.createElement('tr');
            const overlapZones1 = ['MP', 'H1', 'H2'];
            overlapZones1.forEach(zone => {
                const percentage = data.overlap.percentages[zone];
                const td = document.createElement('td');
                td.style.cssText = 'padding: 2px 4px; border: 1px solid #e0e0e0; background: white;';
                td.innerHTML = `<b>${zone}</b>:${percentage !== undefined ? percentage.toFixed(1) : '-'}`;
                overlapRow1.appendChild(td);
            });
            this.elements.overlapZoneDisplay.appendChild(overlapRow1);
            
            // Second row - basic vertical and den overlap
            const overlapRow2 = document.createElement('tr');
            const overlapZones2 = ['D', 'T', 'B'];
            overlapZones2.forEach(zone => {
                const percentage = data.overlap.percentages[zone];
                const td = document.createElement('td');
                td.style.cssText = 'padding: 2px 4px; border: 1px solid #e0e0e0; background: white;';
                td.innerHTML = `<b>${zone}</b>:${percentage !== undefined ? percentage.toFixed(1) : '-'}`;
                overlapRow2.appendChild(td);
            });
            this.elements.overlapZoneDisplay.appendChild(overlapRow2);
            
            // Third row - quadrant overlaps and MP subdivisions
            const overlapRow3 = document.createElement('tr');
            // H1TO and H1BO in first column
            const otd1 = document.createElement('td');
            otd1.style.cssText = 'padding: 2px 4px; border: 1px solid #e0e0e0; background: white; font-size: 10px;';
            otd1.innerHTML = `<b>H1TO</b>:${data.overlap.percentages.H1T !== undefined ? data.overlap.percentages.H1T.toFixed(1) : '-'}<br><b>H1BO</b>:${data.overlap.percentages.H1B !== undefined ? data.overlap.percentages.H1B.toFixed(1) : '-'}`;
            overlapRow3.appendChild(otd1);
            // H2TO and H2BO in second column
            const otd2 = document.createElement('td');
            otd2.style.cssText = 'padding: 2px 4px; border: 1px solid #e0e0e0; background: white; font-size: 10px;';
            otd2.innerHTML = `<b>H2T</b>:${data.overlap.percentages.H2T !== undefined ? data.overlap.percentages.H2T.toFixed(1) : '-'}<br><b>H2BO</b>:${data.overlap.percentages.H2B !== undefined ? data.overlap.percentages.H2B.toFixed(1) : '-'}`;
            overlapRow3.appendChild(otd2);
            // MPTO and MPBO in third column
            const otd3 = document.createElement('td');
            otd3.style.cssText = 'padding: 2px 4px; border: 1px solid #e0e0e0; background: white; font-size: 10px;';
            otd3.innerHTML = `<b>MPT</b>:${data.overlap.percentages.MPT !== undefined ? data.overlap.percentages.MPT.toFixed(1) : '-'}<br><b>MPBO</b>:${data.overlap.percentages.MPB !== undefined ? data.overlap.percentages.MPB.toFixed(1) : '-'}`;
            overlapRow3.appendChild(otd3);
            this.elements.overlapZoneDisplay.appendChild(overlapRow3);
        }
    }
    
    /**
     * Show upload success message
     * @param {string} code - Assigned MVI code
     * @param {string} message - Success message
     */
    showUploadSuccess(code, message) {
        const statusEl = document.getElementById('codeStatus');
        if (statusEl) {
            statusEl.className = 'code-status success';
            statusEl.textContent = message;
            statusEl.style.display = 'block';
            
            // Show the run detection button
            const runDetectionBtn = document.getElementById('runDetectionBtn');
            if (runDetectionBtn) {
                runDetectionBtn.style.display = 'inline-block';
            }
            
            // Show detection options (including Mirror Video checkbox)
            const detectionOptions = document.getElementById('detectionOptions');
            if (detectionOptions) {
                detectionOptions.style.display = 'block';
            }
            
            // For new uploads, always uncheck mirror checkbox
            const experimentSelect = document.getElementById('experimentTypeSelect');
            if (experimentSelect) {
                experimentSelect.value = '';
            }
            
            // Hide after 5 seconds
            setTimeout(() => {
                statusEl.style.display = 'none';
            }, 5000);
        }
    }

    /**
     * Get modal state
     * @returns {boolean} True if modal is visible
     */
    isModalVisible() {
        return this.elements.modal.style.display === 'block';
    }

    /**
     * Refresh available codes list
     */
    refreshAvailableCodes() {
        this.loadAvailableVideos();
    }
    
    /**
     * Toggle export menu visibility
     */
    toggleExportMenu() {
        const isVisible = this.elements.exportMenu.style.display !== 'none';
        if (isVisible) {
            this.hideExportMenu();
        } else {
            this.showExportMenu();
        }
    }
    
    /**
     * Show export menu
     */
    showExportMenu() {
        this.elements.exportMenu.style.display = 'block';
    }
    
    /**
     * Hide export menu
     */
    hideExportMenu() {
        this.elements.exportMenu.style.display = 'none';
    }
    
    /**
     * Show delete confirmation dialog
     * @param {string} code - The video code to delete
     */
    showDeleteConfirmation(code) {
        this.deleteCode = code;
        const modal = document.getElementById('deleteConfirmModal');
        const message = document.getElementById('deleteConfirmMessage');
        message.textContent = `Are you sure you want to delete video MVI_${code}_proxy and its associated keyframes?`;
        modal.style.display = 'flex';
    }
    
    /**
     * Hide delete confirmation dialog
     */
    hideDeleteConfirmation() {
        const modal = document.getElementById('deleteConfirmModal');
        modal.style.display = 'none';
        this.deleteCode = null;
        
        // Reset modal to original state
        const modalContent = modal.querySelector('.modal-content');
        const title = modalContent.querySelector('h3');
        const messageEl = document.getElementById('deleteConfirmMessage');
        const buttonsDiv = modalContent.querySelector('div[style*="flex"]');
        
        // Reset content
        title.textContent = 'Confirm Delete';
        messageEl.style.color = '';
        
        // Restore original buttons
        buttonsDiv.innerHTML = `
            <button id="cancelDeleteBtn" class="secondary-btn">Cancel</button>
            <button id="confirmDeleteBtn" class="danger-btn">Delete</button>
        `;
        
        // Re-attach event listeners
        document.getElementById('cancelDeleteBtn').addEventListener('click', () => this.hideDeleteConfirmation());
        document.getElementById('confirmDeleteBtn').addEventListener('click', () => this.handleDeleteConfirm());
    }
    
    /**
     * Handle delete confirmation
     */
    async handleDeleteConfirm() {
        if (!this.deleteCode) return;
        
        try {
            const response = await fetch(`/delete-video/${this.deleteCode}`, {
                method: 'DELETE'
            });
            
            const data = await response.json();
            
            if (response.ok) {
                this.showDeleteSuccess(`Successfully deleted MVI_${this.deleteCode}_proxy`);
                
                // Refresh the codes list
                this.refreshAvailableCodes();
            } else {
                this.showError(data.error || 'Failed to delete video');
            }
        } catch (error) {
            this.showError('Network error while deleting video');
        }
    }
    
    /**
     * Setup heatmap interaction for seeking and deletion selection
     */
    setupHeatmapInteraction() {
        const heatmap = this.elements.activityHeatmap;
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.state.deletionMode) {
                // Exit deletion mode on Escape key
                this.clearDeletionSelection();
            }
        });
        
        heatmap.addEventListener('mousedown', (e) => {
            const rect = heatmap.getBoundingClientRect();
            const progress = (e.clientX - rect.left) / rect.width;
            
            if (this.state.deletionMode) {
                // Start deletion selection
                this.state.deletionSelection.isDragging = true;
                this.state.deletionSelection.startProgress = progress;
                this.state.deletionSelection.endProgress = progress;
                this.updateDeletionSelection();
            }
        });
        
        heatmap.addEventListener('mousemove', (e) => {
            if (this.state.deletionMode && this.state.deletionSelection.isDragging) {
                const rect = heatmap.getBoundingClientRect();
                const progress = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                this.state.deletionSelection.endProgress = progress;
                this.updateDeletionSelection();
            }
        });
        
        heatmap.addEventListener('mouseup', (e) => {
            // Check if the mouse is still within the heatmap bounds
            
            if (this.state.deletionMode && this.state.deletionSelection.isDragging) {
                this.state.deletionSelection.isDragging = false;
                this.finalizeDeletionSelection();
            } else if (!this.state.deletionMode) {
                const rect = heatmap.getBoundingClientRect();
                // Normal seeking behavior
                const progress = (e.clientX - rect.left) / rect.width;
                this.eventBus.emit('ui:heatmapSeek', { progress });
            }
        });
        
        // Handle mouse leave
        heatmap.addEventListener('mouseleave', () => {
            if (this.state.deletionSelection.isDragging) {
                this.state.deletionSelection.isDragging = false;
                //this.finalizeDeletionSelection();
                this.clearDeletionSelection();
            }
        });
    }
    
    /**
     * Toggle deletion mode
     */
    toggleBboxEditMode() {
        this.state.bboxEditMode = !this.state.bboxEditMode;
        // Bbox edits "hijacks" deletion mode
        this.state.deletionMode = !this.state.deletionMode;
        if (this.state.bboxEditMode) {
            document.getElementById('deletionName').innerText = 'Edit keyframes from:';
            document.getElementById('deleteConfirmText').innerHTML = 'Confirm Keyframe Edit';
            document.getElementById('confirmKeyframeDeletionBtn').innerHTML = 'Edit Keyframes';
            this.elements.deletionSideContainer.style.display = 'block';
            this.elements.confirmKeyframeDeletionBtn.classList.remove("danger-btn");
            this.elements.confirmKeyframeDeletionBtn.classList.add("control-button")
            //document.getElementById('deletionMethod').style.display = 'none';
            // Hide it
            this.elements.dMethod.hidden = true;

            // Entering bbox edit mode
            this.elements.editBoundingBoxesBtn.classList.add('active');
            this.elements.editBoundingBoxesBtn.innerHTML = '✏️ Cancel Edit';
            this.elements.editBoundingBoxesBtn.style.backgroundColor = '#6c757d';
            // Show box toggle buttons
            //this.elements.boxToggleContainer.style.display = 'inline-flex';
            
            // Emit event to enable bbox interaction
            this.eventBus.emit('ui:toggleBboxEdit');
            
            // Show edit mode notification
            Swal.fire({
                icon: 'info',
                title: 'Bounding Box Edit Mode',
                text: 'Click and drag to move/resize boxes. Use L/R buttons to add/remove boxes.',
                toast: true,
                position: 'top',
                showConfirmButton: false,
                timer: 1000,
                timerProgressBar: true
            });
            // Disable the "Delete Keyframes" button if in bbox edit mode
            this.elements.deleteKeyframesBtn.disabled = true;
            this.elements.deleteKeyframesBtn.classList.add('disabled');
        } else {
            document.getElementById('deletionName').innerText = 'Delete keyframes from:';
            document.getElementById('deleteConfirmText').innerHTML = 'Confirm Keyframe Deletion';
            document.getElementById('confirmKeyframeDeletionBtn').innerHTML = 'Delete Keyframes';

            // Exiting bbox edit mode
            this.elements.deletionSideContainer.style.display = 'none';
            this.elements.dMethod.hidden = false;

            this.elements.confirmKeyframeDeletionBtn.classList.remove("control-button");
            this.elements.confirmKeyframeDeletionBtn.classList.add("danger-btn");
            // Exiting bbox edit mode
            this.elements.editBoundingBoxesBtn.classList.remove('active');
            this.elements.editBoundingBoxesBtn.innerHTML = 'Edit Bounding Boxes';
            this.elements.editBoundingBoxesBtn.style.backgroundColor = '#4CAF50';
            
            // Hide box toggle buttons
            this.elements.boxToggleContainer.style.display = 'none';
            
            // Emit event to disable bbox interaction
            this.eventBus.emit('ui:toggleBboxEdit');
            // Re-enable the "Delete Keyframes" button
            this.elements.deleteKeyframesBtn.disabled = false;
            this.elements.deleteKeyframesBtn.classList.remove('disabled');
            this.eventBus.emit(Events.RENDER_REQUEST);
        }
    }
    
    /**
     * Load export postfix from localStorage
     */
    loadExportPostfix() {
        const savedPostfix = localStorage.getItem('exportPostfix');
        if (savedPostfix && this.elements.exportPostfix) {
            this.elements.exportPostfix.value = savedPostfix;
        }
    }
    
    toggleDeletionMode() {
        this.state.deletionMode = !this.state.deletionMode;
        
        if (this.state.deletionMode) {
            // Entering deletion mode
            this.elements.deleteKeyframesBtn.classList.add('active');
            this.elements.deleteKeyframesBtn.innerHTML = '❌ Cancel';
            this.elements.activityHeatmap.classList.add('deletion-mode');
            this.elements.deletionSideContainer.style.display = 'block';
            
            // Show deletion mode notification
            Swal.fire({
                icon: 'info',
                title: 'Deletion Mode Active',
                text: 'Drag on the heatmap to select keyframes to delete',
                toast: true,
                position: 'top',
                showConfirmButton: false,
                timer: 1000,
                timerProgressBar: true,
                background: '#dc3545',
                color: '#fff',
                iconColor: '#fff'
            });
            
            // Reset selection
            this.state.deletionSelection = {
                startProgress: null,
                endProgress: null,
                isDragging: false
            };

            // Disable the "Edit Bounding Boxes" button if in deletion mode
            this.elements.editBoundingBoxesBtn.disabled = true;
            this.elements.editBoundingBoxesBtn.classList.add('disabled');
        } else {
            // Exiting deletion mode
            this.elements.deleteKeyframesBtn.classList.remove('active');
            this.elements.deleteKeyframesBtn.innerHTML = '🗑️ Delete Keyframes';
            this.elements.activityHeatmap.classList.remove('deletion-mode');
            this.elements.deletionSideContainer.style.display = 'none';
            this.clearDeletionSelection();
            // Re-enable the "Edit Bounding Boxes" button
            this.elements.editBoundingBoxesBtn.disabled = false;
            this.elements.editBoundingBoxesBtn.classList.remove('disabled');
        }
        
        this.eventBus.emit(Events.DELETION_MODE_TOGGLE, { active: this.state.deletionMode });
    }
    
    /**
     * Update deletion selection during drag
     */
    updateDeletionSelection() {
        const { startProgress, endProgress } = this.state.deletionSelection;
        const side = this.elements.deletionSideSelect.value;        
        // Ensure start is before end
        const start = Math.min(startProgress, endProgress);
        const end = Math.max(startProgress, endProgress);
        
        this.eventBus.emit(Events.DELETION_SELECTION_UPDATE, {
            startProgress: start,
            endProgress: end,
            side: side,
            bboxUpdate: this.state.bboxEditMode
        });
    }
    
    /**
     * Clear deletion selection
     */
    clearDeletionSelection() {
        this.state.deletionSelection = {
            startProgress: null,
            endProgress: null,
            isDragging: false
        };
        
        this.eventBus.emit(Events.DELETION_SELECTION_UPDATE, {
            startProgress: null,
            endProgress: null
        });
    }
    
    /**
     * Finalize deletion selection and show confirmation
     */
    finalizeDeletionSelection() {
        const { startProgress, endProgress } = this.state.deletionSelection;
        
        if (startProgress === null || endProgress === null) return;
        
        // Ensure start is before end
        const start = Math.min(startProgress, endProgress);
        const end = Math.max(startProgress, endProgress);
        
        // Don't process if the selection is too small
        if (Math.abs(end - start) < 0.001) {
            this.clearDeletionSelection();
            return;
        }
        
        // Get frame information
        const maxFrames = this.keyframesData?.video_info?.total_frames_processed || 0;
        const fps = this.keyframesData?.video_info?.fps || 30;
        
        const startFrame = Math.floor(start * maxFrames);
        const endFrame = Math.floor(end * maxFrames);
        const startTime = startFrame / fps;
        const endTime = endFrame / fps;
        
        // Get selected side and method
        const side = this.elements.deletionSideSelect.value;
        const sideText = side === 'both' ? 'Both Sides' : 
                        side === 'left' ? 'Left Side Only' : 'Right Side Only';
        
        const method = this.elements.deletionMethodSelect.value;
        const methodText = method === 'delete' ? 'Delete' : 'Infill (Interpolate)';
        
        // Update modal with selection info
        this.elements.keyframeDeletionMessage.textContent = method === 'delete' ?
            `This will delete all keyframes between the selected time range.` :
            `This will replace keyframes in the selected range with interpolated values.`;
        if (this.state.bboxEditMode) {
            this.elements.keyframeDeletionMessage.textContent = 'This will edit the bounding boxes in the selected range.';
        }
        this.elements.deletionSide.textContent = sideText;
        this.elements.deletionMethod.textContent = this.state.bboxEditMode ? 'Edit' : methodText;
        this.elements.deletionStartTime.textContent = `${startTime.toFixed(2)}s (frame ${startFrame})`;
        this.elements.deletionEndTime.textContent = `${endTime.toFixed(2)}s (frame ${endFrame})`;
        this.elements.deletionFrameCount.textContent = `${endFrame - startFrame + 1}`;
        // Store selection for confirmation
        this.pendingDeletion = {
            startTime,
            endTime,
            startFrame,
            endFrame,
            side,
            method
        };
        if (this.state.bboxEditMode) {
            this.pendingDeletion.method = 'edit';
            this.pendingDeletion.bboxUpdate = this.visualizer.draggedBboxes;
        }
        
        // Show confirmation modal
        this.showKeyframeDeletionModal();
    }
    
    /**
     * Show keyframe deletion modal
     */
    showKeyframeDeletionModal() {
        this.elements.keyframeDeletionModal.style.display = 'flex';
    }
    
    /**
     * Hide keyframe deletion modal
     */
    hideKeyframeDeletionModal() {
        this.elements.keyframeDeletionModal.style.display = 'none';
        this.clearDeletionSelection();
    }
    
    /**
     * Handle keyframe deletion confirmation
     */
    async handleKeyframeDeletionConfirm() {
        if (!this.pendingDeletion) return;
        
        const videoCode = this.videoFilename?.match(/MVI_(\d{4})/)?.[1];
        if (!videoCode) {
            this.showError('Unable to determine video code');
            return;
        }
        
        try {
            const response = await fetch(`/delete-keyframes/${videoCode}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    start_time: this.pendingDeletion.startTime,
                    end_time: this.pendingDeletion.endTime,
                    start_frame: this.pendingDeletion.startFrame,
                    end_frame: this.pendingDeletion.endFrame,
                    side: this.pendingDeletion.side,
                    method: this.pendingDeletion.method,
                    bbox_update: this.state.bboxEditMode ? this.pendingDeletion.bboxUpdate : null
                })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                // Show detailed success message based on method
                let stats, title;
                
                if (data.method === 'delete') {
                    stats = data.keyframes_affected > 0 ? 
                        `Deleted ${data.left_detections_deleted + data.right_detections_deleted} detections from ${data.keyframes_affected} keyframes` :
                        'No keyframes were found in the selected range';
                    title = 'Keyframes Deleted!';
                } else if (data.method === 'edit') {
                    stats = data.keyframes_affected > 0 ?
                        `Edited bounding boxes in ${data.keyframes_affected} keyframes` :
                        'No keyframes were found in the selected range';
                    title = 'Keyframes Edited!';
                } else {
                    // Infill method
                    const totalInfilled = data.left_keyframes_infilled + data.right_keyframes_infilled;
                    stats = data.keyframes_affected > 0 ? 
                        `Infilled ${totalInfilled} keyframes with interpolated detections` :
                        'No keyframes were found in the selected range';
                    title = 'Keyframes Infilled!';
                }
                
                /*Swal.fire({
                    icon: 'success',
                    title: title,
                    html: `
                        <div style="text-align: left;">
                            <p><strong>${stats}</strong></p>
                            <p style="font-size: 0.9em; color: #666;">
                                Method: ${data.method}<br>
                                Side: ${this.pendingDeletion.side === 'both' ? 'Both' : 
                                       this.pendingDeletion.side === 'left' ? 'Left Only' : 'Right Only'}<br>
                                Time Range: ${this.pendingDeletion.startTime.toFixed(2)}s - ${this.pendingDeletion.endTime.toFixed(2)}s<br>
                                Backup Created: ${data.backup_file}
                            </p>
                        </div>
                    `,
                    confirmButtonColor: '#28a745',
                    confirmButtonText: 'OK'
                });*/
                
                this.hideKeyframeDeletionModal();
                if (this.state.bboxEditMode) {
                    this.toggleBboxEditMode(); // Exit bbox edit mode
                } else {
                    this.toggleDeletionMode(); // Exit deletion mode
                }
                
                // Emit event for other components to update
                this.eventBus.emit(Events.KEYFRAMES_DELETE, {
                    ...this.pendingDeletion,
                    keyframes_affected: data.keyframes_affected,
                    left_detections_deleted: data.left_detections_deleted,
                    right_detections_deleted: data.right_detections_deleted
                });
                this.eventBus.emit('ui:reloadCurrentData');

                // Reload the keyframes data to reflect changes
                //setTimeout(() => {
                   /* Swal.fire({
                        icon: 'info',
                        title: 'Refreshing Data',
                        text: 'Reloading keyframes to reflect changes...',
                        toast: true,
                        position: 'top-end',
                        showConfirmButton: false,
                        timer: 1000
                    });*/
                    
                    // Trigger reload of current video
                //}, 1000);
            } else {
                this.showError(data.error || 'Failed to delete keyframes');
            }
        } catch (error) {
            this.showError('Network error while deleting keyframes');
        }
        
        this.pendingDeletion = null;
    }
    
    /**
     * Show backups modal
     */
    showBackupsModal() {
        // Get current video code
        const videoCode = this.videoFilename?.match(/MVI_(\d{4})/)?.[1];
        if (!videoCode) {
            this.showError('Unable to determine video code');
            return;
        }
        
        // Show modal and loading state
        this.elements.backupsModal.style.display = 'flex';
        this.elements.backupsLoading.style.display = 'block';
        this.elements.backupsList.style.display = 'none';
        
        // Fetch backups
        this.fetchBackups(videoCode);
    }
    
    /**
     * Hide backups modal
     */
    hideBackupsModal() {
        this.elements.backupsModal.style.display = 'none';
    }
    
    /**
     * Fetch backups for current video
     * @param {string} code - Video code
     */
    async fetchBackups(code) {
        try {
            const response = await fetch(`/list-backups/${code}`);
            const data = await response.json();
            
            if (response.ok) {
                this.displayBackups(data.backups, code);
            } else {
                this.showError(data.error || 'Failed to fetch backups');
                this.hideBackupsModal();
            }
        } catch (error) {
            this.showError('Network error while fetching backups');
            this.hideBackupsModal();
        }
    }
    
    /**
     * Display backups in modal
     * @param {Array} backups - Array of backup objects
     * @param {string} code - Video code
     */
    displayBackups(backups, code) {
        // Hide loading, show list
        this.elements.backupsLoading.style.display = 'none';
        this.elements.backupsList.style.display = 'block';
        
        // Clear existing table rows
        this.elements.backupsTableBody.innerHTML = '';
        
        if (backups.length === 0) {
            // Show no backups message
            this.elements.noBackupsMessage.style.display = 'block';
            this.elements.backupsTableBody.parentElement.style.display = 'none';
        } else {
            // Hide no backups message
            this.elements.noBackupsMessage.style.display = 'none';
            this.elements.backupsTableBody.parentElement.style.display = 'table';
            
            // Add each backup to table
            backups.forEach((backup, index) => {
                const row = document.createElement('tr');
                row.style.borderBottom = '1px solid #eee';
                
                // Date/Time column
                const dateCell = document.createElement('td');
                dateCell.style.padding = '10px';
                dateCell.textContent = backup.timestamp_str;
                
                // Size column
                const sizeCell = document.createElement('td');
                sizeCell.style.padding = '10px';
                sizeCell.textContent = backup.size_str;
                
                // Actions column
                const actionsCell = document.createElement('td');
                actionsCell.style.padding = '10px';
                actionsCell.style.textAlign = 'center';
                
                const restoreBtn = document.createElement('button');
                restoreBtn.textContent = 'Restore';
                restoreBtn.className = 'secondary-btn';
                restoreBtn.style.padding = '5px 15px';
                restoreBtn.style.fontSize = '14px';
                restoreBtn.onclick = () => this.confirmRestore(backup.filename, code);
                
                actionsCell.appendChild(restoreBtn);
                
                row.appendChild(dateCell);
                row.appendChild(sizeCell);
                row.appendChild(actionsCell);
                
                this.elements.backupsTableBody.appendChild(row);
            });
        }
    }
    
    /**
     * Confirm backup restore
     * @param {string} backupFilename - Backup file name
     * @param {string} code - Video code
     */
    async confirmRestore(backupFilename, code) {
        const result = await Swal.fire({
            icon: 'warning',
            title: 'Confirm Restore',
            html: `Are you sure you want to restore from backup?<br><br>
                   <strong>File:</strong> ${backupFilename}<br><br>
                   This will replace the current keyframes with the backup version.`,
            showCancelButton: true,
            confirmButtonColor: '#dc3545',
            cancelButtonColor: '#6c757d',
            confirmButtonText: 'Yes, restore',
            cancelButtonText: 'Cancel'
        });
        
        if (result.isConfirmed) {
            await this.restoreBackup(backupFilename, code);
        }
    }
    
    /**
     * Restore backup
     * @param {string} backupFilename - Backup file name
     * @param {string} code - Video code
     */
    async restoreBackup(backupFilename, code) {
        try {
            const response = await fetch(`/restore-backup/${code}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    backup_filename: backupFilename
                })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                // Hide the backups modal
                this.hideBackupsModal();
                
                // Show success message
                await Swal.fire({
                    icon: 'success',
                    title: 'Backup Restored!',
                    text: data.message,
                    confirmButtonColor: '#28a745'
                });
                
                // Reload the current data
                this.eventBus.emit('ui:reloadCurrentData');
            } else {
                this.showError(data.error || 'Failed to restore backup');
            }
        } catch (error) {
            this.showError('Network error while restoring backup');
        }
    }
}