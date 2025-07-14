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
            keyframesFile: document.getElementById('keyframesFile'),
            
            // Quick load form
            quickLoadForm: document.getElementById('quickLoadForm'),
            codeInput: document.getElementById('codeInput'),
            
            // Video controls
            playPauseBtn: document.getElementById('playPauseBtn'),
            prevFrameBtn: document.getElementById('prevFrameBtn'),
            nextFrameBtn: document.getElementById('nextFrameBtn'),
            prevKeyframeBtn: document.getElementById('prevKeyframeBtn'),
            nextKeyframeBtn: document.getElementById('nextKeyframeBtn'),
            frameSlider: document.getElementById('frameSlider'),
            frameNumber: document.getElementById('frameNumber'),
            frameInfo: document.getElementById('frameInfo'),
            
            // Visualization options
            showTank: document.getElementById('showTank'),
            enableInterpolation: document.getElementById('enableInterpolation'),
            sideSelect: document.getElementById('sideSelect'),
            showTrajectory: document.getElementById('showTrajectory'),
            trajectoryAlphaContainer: document.getElementById('trajectoryAlphaContainer'),
            trajectoryAlphaSlider: document.getElementById('trajectoryAlphaSlider'),
            trajectoryAlphaValue: document.getElementById('trajectoryAlphaValue'),
            showSpatialHeatmap: document.getElementById('showSpatialHeatmap'),
            downloadHeatmaps: document.getElementById('downloadHeatmaps'),
            
            // Sensitivity controls
            activitySensitivitySlider: document.getElementById('activitySensitivitySlider'),
            activitySensitivityValue: document.getElementById('activitySensitivityValue'),
            proximitySensitivitySlider: document.getElementById('proximitySensitivitySlider'),
            proximitySensitivityValue: document.getElementById('proximitySensitivityValue'),
            
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
            frequencyRank: DEFAULTS.FREQUENCY_RANK
        };
        
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
        });
        
        // Upload form
        this.elements.uploadForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleFileUploadSubmit();
        });
        
        // Quick load form
        this.elements.quickLoadForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleQuickLoadSubmit();
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
            this.eventBus.emit(Events.UI_CONTROL_CHANGE, {
                control: 'showSpatialHeatmap',
                value: isChecked
            });
            // Show/hide download button
            this.elements.downloadHeatmaps.style.display = isChecked ? 'block' : 'none';
        });
        
        // Download heatmaps button
        this.elements.downloadHeatmaps.addEventListener('click', () => {
            this.eventBus.emit(Events.DOWNLOAD_HEATMAPS);
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
        
        // Heatmap click for seeking
        this.elements.activityHeatmap.addEventListener('click', (e) => {
            const rect = this.elements.activityHeatmap.getBoundingClientRect();
            const progress = (e.clientX - rect.left) / rect.width;
            this.eventBus.emit('ui:heatmapSeek', { progress });
        });
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
            const fps = data.keyframesData.video_info.fps || DEFAULTS.FPS;
            const totalFrames = data.keyframesData.video_info.total_frames_processed;
            this.elements.frameSlider.max = totalFrames;
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
        const keyframesFile = this.elements.keyframesFile.files[0];
        
        if (!videoFile || !keyframesFile) {
            alert('Please select both video and keyframes files');
            return;
        }
        
        this.eventBus.emit('ui:uploadFiles', { videoFile, keyframesFile });
    }

    /**
     * Handle quick load form submission
     */
    handleQuickLoadSubmit() {
        const code = this.elements.codeInput.value.trim();
        // Only check if keyframes exist - DetectionManager will handle loading if appropriate
        this.eventBus.emit('detection:checkCode', { code });
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
        alert(message); // Can be replaced with better UI notification
    }

    /**
     * Get modal state
     * @returns {boolean} True if modal is visible
     */
    isModalVisible() {
        return this.elements.modal.style.display === 'block';
    }
}