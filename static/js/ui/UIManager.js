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
    constructor(eventBus) {
        this.eventBus = eventBus;
        
        // UI elements
        this.elements = {
            // Modal
            modal: document.getElementById('loadModal'),
            modalClose: document.querySelector('.close'),
            loadNewBtn: document.getElementById('loadNewBtn'),
            
            // Upload form
            uploadForm: document.getElementById('uploadForm'),
            videoFile: document.getElementById('videoFile'),
            
            // Quick load form
            quickLoadForm: document.getElementById('quickLoadForm'),
            codeInput: document.getElementById('codeInput'),
            browseCodesBtn: document.getElementById('browseCodesBtn'),
            availableCodesList: document.getElementById('availableCodesList'),
            codesGrid: document.getElementById('codesGrid'),
            
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
            leftBoxToggle: document.getElementById('leftBoxToggle'),
            rightBoxToggle: document.getElementById('rightBoxToggle'),
            submitBboxChangesBtn: document.getElementById('submitBboxChangesBtn'),
            sideSelect: document.getElementById('sideSelect'),
            showTrajectory: document.getElementById('showTrajectory'),
            trajectoryAlphaContainer: document.getElementById('trajectoryAlphaContainer'),
            trajectoryAlphaSlider: document.getElementById('trajectoryAlphaSlider'),
            trajectoryAlphaValue: document.getElementById('trajectoryAlphaValue'),
            showSpatialHeatmap: document.getElementById('showSpatialHeatmap'),
            heatmapAlphaContainer: document.getElementById('heatmapAlphaContainer'),
            heatmapAlphaSlider: document.getElementById('heatmapAlphaSlider'),
            heatmapAlphaValue: document.getElementById('heatmapAlphaValue'),
            
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
            deletionStartTime: document.getElementById('deletionStartTime'),
            deletionEndTime: document.getElementById('deletionEndTime'),
            deletionFrameCount: document.getElementById('deletionFrameCount'),
            cancelKeyframeDeletionBtn: document.getElementById('cancelKeyframeDeletionBtn'),
            confirmKeyframeDeletionBtn: document.getElementById('confirmKeyframeDeletionBtn'),
            deletionSideContainer: document.getElementById('deletionSideContainer'),
            deletionSideSelect: document.getElementById('deletionSideSelect'),
            deletionMethodSelect: document.getElementById('deletionMethodSelect'),
            
            // Analysis controls
            activityMetric: document.getElementById('activityMetric'),
            proximityMetric: document.getElementById('proximityMetric'),
            //fourierAnalysis: document.getElementById('fourierAnalysis'),
            //fourierControls: document.getElementById('fourierControls'),
            freqRankSlider: document.getElementById('freqRankSlider'),
            freqRankValue: document.getElementById('freqRankValue'),
            freqInfo: document.getElementById('freqInfo'),
            
            // Sections
            visualizerSection: document.getElementById('visualizerSection'),
            activityHeatmap: document.getElementById('activityHeatmap')
        };
        
        // UI state
        this.state = {
            activitySensitivity: DEFAULTS.ACTIVITY_SENSITIVITY,
            proximitySensitivity: DEFAULTS.PROXIMITY_SENSITIVITY,
            trajectoryAlpha: DEFAULTS.TRAJECTORY_ALPHA,
            heatmapAlpha: DEFAULTS.HEATMAP_ALPHA,
            frequencyRank: DEFAULTS.FREQUENCY_RANK,
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
        
        this.setupEventListeners();
        this.setupEventHandlers();
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
        
        // Browse codes button
        this.elements.browseCodesBtn.addEventListener('click', () => {
            this.handleBrowseCodesClick();
        });
        
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
        
        // Edit bounding boxes button
        this.elements.editBoundingBoxesBtn.addEventListener('click', () => {
            this.toggleBboxEditMode();
        });
        
        // Box toggle buttons
        this.elements.leftBoxToggle.addEventListener('click', () => {
            this.eventBus.emit('ui:toggleBoxVisibility', { side: 'left' });
        });
        
        this.elements.rightBoxToggle.addEventListener('click', () => {
            this.eventBus.emit('ui:toggleBoxVisibility', { side: 'right' });
        });
        
        // Submit bbox changes button
        this.elements.submitBboxChangesBtn.addEventListener('click', () => {
            this.eventBus.emit('ui:submitBboxChanges');
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
            this.elements.heatmapAlphaContainer.style.display = isChecked ? 'flex' : 'none';
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
        
        // Click outside to close export menu
        document.addEventListener('click', (e) => {
            if (!this.elements.exportMenuBtn.contains(e.target) && 
                !this.elements.exportMenu.contains(e.target)) {
                this.hideExportMenu();
            }
        });
        
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
            
            // Show export button when data is loaded
            this.elements.exportMenuBtn.style.display = 'block';
        });
        
        // Detection completed
        this.eventBus.on('detection:completed', (data) => {
            this.refreshAvailableCodes();
        });
    }

    /**
     * Show modal dialog
     */
    showModal() {
        this.elements.modal.style.display = 'block';
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
    handleFileUploadSubmit() {
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
        
        this.eventBus.emit('ui:uploadVideo', { videoFile });
    }

    /**
     * Handle quick load form submission
     */
    handleQuickLoadSubmit(explicit = false) {
        const code = this.elements.codeInput.value.trim();
        // Only check if keyframes exist - DetectionManager will handle loading if appropriate
        this.eventBus.emit('detection:checkCode', { code, explicit });
    }

    /**
     * Handle browse codes button click
     */
    async handleBrowseCodesClick() {
        // Toggle visibility
        const isVisible = this.elements.availableCodesList.style.display !== 'none';
        
        if (!isVisible) {
            // Show the codes list
            this.elements.availableCodesList.style.display = 'block';
            this.elements.browseCodesBtn.textContent = 'Hide Available Codes';
            
            // Fetch and display available codes
            try {
                this.eventBus.emit('ui:fetchAvailableCodes');
            } catch (error) {
                this.showError('Failed to load available codes');
            }
        } else {
            // Hide the codes list
            this.elements.availableCodesList.style.display = 'none';
            this.elements.browseCodesBtn.textContent = 'Browse Available Codes';
        }
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
            statusIcon.textContent = codeInfo.has_keyframes ? '✅' : '🟡';
            statusIcon.title = codeInfo.has_keyframes ? 'Ready to load' : 'Needs detection';
            
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
                this.elements.codeInput.value = codeInfo.code;
                this.handleQuickLoadSubmit();
                //this.elements.codeInput.focus();
                //if (codeInfo.has_keyframes) {
                    // Auto-submit if keyframes exist
                    //this.handleQuickLoadSubmit();
                /*} else {
                    // Just populate the field and let user decide
                    this.elements.codeInput.focus();
                }*/
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
            activitySensitivity: this.state.activitySensitivity,
            proximitySensitivity: this.state.proximitySensitivity,
            activityMetric: this.elements.activityMetric.value,
            proximityMetric: this.elements.proximityMetric.value,
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
     * Refresh available codes list if visible
     */
    refreshAvailableCodes() {
        // Check if the codes list is currently visible
        const isVisible = this.elements.availableCodesList.style.display !== 'none';
        
        if (isVisible) {
            // Re-fetch and display available codes
            this.eventBus.emit('ui:fetchAvailableCodes');
        }
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
            if (this.state.deletionMode && this.state.deletionSelection.isDragging) {
                this.state.deletionSelection.isDragging = false;
                this.finalizeDeletionSelection();
            } else if (!this.state.deletionMode) {
                // Normal seeking behavior
                const rect = heatmap.getBoundingClientRect();
                const progress = (e.clientX - rect.left) / rect.width;
                this.eventBus.emit('ui:heatmapSeek', { progress });
            }
        });
        
        // Handle mouse leave
        heatmap.addEventListener('mouseleave', () => {
            if (this.state.deletionSelection.isDragging) {
                this.state.deletionSelection.isDragging = false;
                this.finalizeDeletionSelection();
            }
        });
    }
    
    /**
     * Toggle deletion mode
     */
    toggleBboxEditMode() {
        this.state.bboxEditMode = !this.state.bboxEditMode;
        
        if (this.state.bboxEditMode) {
            // Entering bbox edit mode
            this.elements.editBoundingBoxesBtn.classList.add('active');
            this.elements.editBoundingBoxesBtn.innerHTML = '✏️ Cancel Edit';
            this.elements.editBoundingBoxesBtn.style.backgroundColor = '#6c757d';
            
            // Show box toggle buttons
            this.elements.boxToggleContainer.style.display = 'inline-flex';
            
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
        } else {
            // Exiting bbox edit mode
            this.elements.editBoundingBoxesBtn.classList.remove('active');
            this.elements.editBoundingBoxesBtn.innerHTML = 'Edit Bounding Boxes';
            this.elements.editBoundingBoxesBtn.style.backgroundColor = '#4CAF50';
            
            // Hide box toggle buttons
            this.elements.boxToggleContainer.style.display = 'none';
            
            // Emit event to disable bbox interaction
            this.eventBus.emit('ui:toggleBboxEdit');
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
        } else {
            // Exiting deletion mode
            this.elements.deleteKeyframesBtn.classList.remove('active');
            this.elements.deleteKeyframesBtn.innerHTML = '🗑️ Delete Keyframes';
            this.elements.activityHeatmap.classList.remove('deletion-mode');
            this.elements.deletionSideContainer.style.display = 'none';
            this.clearDeletionSelection();
        }
        
        this.eventBus.emit(Events.DELETION_MODE_TOGGLE, { active: this.state.deletionMode });
    }
    
    /**
     * Update deletion selection during drag
     */
    updateDeletionSelection() {
        const { startProgress, endProgress } = this.state.deletionSelection;
        
        // Ensure start is before end
        const start = Math.min(startProgress, endProgress);
        const end = Math.max(startProgress, endProgress);
        
        this.eventBus.emit(Events.DELETION_SELECTION_UPDATE, {
            startProgress: start,
            endProgress: end
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
        this.elements.deletionSide.textContent = sideText;
        this.elements.deletionMethod.textContent = methodText;
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
                    method: this.pendingDeletion.method
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
                } else {
                    // Infill method
                    const totalInfilled = data.left_keyframes_infilled + data.right_keyframes_infilled;
                    stats = data.keyframes_affected > 0 ? 
                        `Infilled ${totalInfilled} keyframes with interpolated detections` :
                        'No keyframes were found in the selected range';
                    title = 'Keyframes Infilled!';
                }
                
                Swal.fire({
                    icon: 'success',
                    title: title,
                    html: `
                        <div style="text-align: left;">
                            <p><strong>${stats}</strong></p>
                            <p style="font-size: 0.9em; color: #666;">
                                Method: ${data.method === 'delete' ? 'Delete' : 'Infill (Interpolate)'}<br>
                                Side: ${this.pendingDeletion.side === 'both' ? 'Both' : 
                                       this.pendingDeletion.side === 'left' ? 'Left Only' : 'Right Only'}<br>
                                Time Range: ${this.pendingDeletion.startTime.toFixed(2)}s - ${this.pendingDeletion.endTime.toFixed(2)}s<br>
                                Backup Created: ${data.backup_file}
                            </p>
                        </div>
                    `,
                    confirmButtonColor: '#28a745',
                    confirmButtonText: 'OK'
                });
                
                this.hideKeyframeDeletionModal();
                this.toggleDeletionMode(); // Exit deletion mode
                
                // Emit event for other components to update
                this.eventBus.emit(Events.KEYFRAMES_DELETE, {
                    ...this.pendingDeletion,
                    keyframes_affected: data.keyframes_affected,
                    left_detections_deleted: data.left_detections_deleted,
                    right_detections_deleted: data.right_detections_deleted
                });
                
                // Reload the keyframes data to reflect changes
                setTimeout(() => {
                    Swal.fire({
                        icon: 'info',
                        title: 'Refreshing Data',
                        text: 'Reloading keyframes to reflect changes...',
                        toast: true,
                        position: 'top-end',
                        showConfirmButton: false,
                        timer: 1000
                    });
                    
                    // Trigger reload of current video
                    this.eventBus.emit('ui:reloadCurrentData');
                }, 1000);
            } else {
                this.showError(data.error || 'Failed to delete keyframes');
            }
        } catch (error) {
            this.showError('Network error while deleting keyframes');
        }
        
        this.pendingDeletion = null;
    }
}