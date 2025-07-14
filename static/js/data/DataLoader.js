/**
 * DataLoader - Handles file upload and data loading
 * Manages video and keyframe data loading from files or quick load codes
 */
import { Events } from '../utils/EventBus.js';
import { FILE_UPLOAD, QUICK_LOAD_VIDEOS } from '../utils/Constants.js';

export class DataLoader {
    /**
     * Create a DataLoader
     * @param {EventBus} eventBus - Central event system
     */
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.isLoading = false;
    }

    /**
     * Handle file upload
     * @param {File} videoFile - Video file
     * @param {File} keyframesFile - Keyframes JSON file
     * @returns {Promise} Upload result
     */
    async handleFileUpload(videoFile, keyframesFile) {
        if (!videoFile || !keyframesFile) {
            throw new Error('Both video and keyframes files are required');
        }

        // Validate file types
        if (!this.isValidVideoFile(videoFile)) {
            throw new Error('Invalid video file type. Supported types: ' + 
                          FILE_UPLOAD.ACCEPTED_VIDEO_TYPES.join(', '));
        }

        if (!this.isValidDataFile(keyframesFile)) {
            throw new Error('Invalid keyframes file type. Expected: .json');
        }

        // Check file sizes
        if (videoFile.size > FILE_UPLOAD.MAX_FILE_SIZE) {
            throw new Error('Video file too large. Maximum size: ' + 
                          (FILE_UPLOAD.MAX_FILE_SIZE / 1024 / 1024) + 'MB');
        }

        this.isLoading = true;
        this.eventBus.emit(Events.UI_MODAL_SHOW, { type: 'loading' });

        const formData = new FormData();
        formData.append('video', videoFile);
        formData.append('keyframes', keyframesFile);

        try {
            const response = await fetch('/upload', {
                method: 'POST',
                body: formData
            });

            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                throw new Error('Server response was not JSON');
            }

            const data = await response.json();

            if (response.ok) {
                this.eventBus.emit(Events.UI_MODAL_HIDE);
                this.processLoadedData(data.video_url, data.keyframes);
                return data;
            } else {
                throw new Error(data.error || 'Upload failed');
            }
        } catch (error) {
            this.eventBus.emit(Events.DATA_ERROR, {
                error,
                module: 'DataLoader',
                severity: 'error'
            });
            throw error;
        } finally {
            this.isLoading = false;
        }
    }

    /**
     * Handle quick load by code
     * @param {string} code - Quick load code (e.g., "0020")
     * @returns {Promise} Load result
     */
    async handleQuickLoad(code) {
        if (!/^\d{4}$/.test(code)) {
            throw new Error('Please enter a valid 4-digit code');
        }

        this.isLoading = true;
        try {
            const response = await fetch(`/load-by-code/${code}`);
            const data = await response.json();

            if (response.ok) {
                this.eventBus.emit(Events.UI_MODAL_HIDE);
                this.processLoadedData(data.video_url, data.keyframes);
                return data;
            } else {
                throw new Error(data.error || 'Failed to load video');
            }
        } catch (error) {
            this.eventBus.emit(Events.DATA_ERROR, {
                error,
                module: 'DataLoader',
                severity: 'error'
            });
            throw error;
        } finally {
            this.isLoading = false;
        }
    }

    /**
     * Load from predefined quick load option
     * @param {string} key - Quick load key (e.g., 'MVI_0020')
     * @returns {Promise} Load result
     */
    async loadPredefined(key) {
        const config = QUICK_LOAD_VIDEOS[key];
        if (!config) {
            throw new Error('Unknown quick load key: ' + key);
        }

        this.isLoading = true;

        try {
            // Load keyframes data
            const response = await fetch(config.data);
            const keyframesData = await response.json();

            if (response.ok) {
                this.eventBus.emit(Events.UI_MODAL_HIDE);
                this.processLoadedData(config.video, keyframesData);
                return {
                    video_url: config.video,
                    keyframes_data: keyframesData
                };
            } else {
                throw new Error('Failed to load keyframes data');
            }
        } catch (error) {
            this.eventBus.emit(Events.DATA_ERROR, {
                error,
                module: 'DataLoader',
                severity: 'error'
            });
            throw error;
        } finally {
            this.isLoading = false;
        }
    }

    /**
     * Process loaded data and emit events
     * @param {string} videoUrl - Video URL
     * @param {Object} keyframesData - Keyframes data object
     */
    processLoadedData(videoUrl, keyframesData) {
        // Validate keyframes data
        if (!this.validateKeyframesData(keyframesData)) {
            throw new Error('Invalid keyframes data format');
        }

        // Sort keyframe indices
        const keyframeIndices = Object.keys(keyframesData.keyframes)
            .map(k => parseInt(k))
            .sort((a, b) => a - b);

        // Pre-process keyframes with detections for each side
        const leftDetectionIndices = keyframeIndices.filter(kf => 
            keyframesData.keyframes[kf.toString()].left_detections.length > 0
        );
        const rightDetectionIndices = keyframeIndices.filter(kf => 
            keyframesData.keyframes[kf.toString()].right_detections.length > 0
        );

        // Emit data loaded event
        this.eventBus.emit(Events.DATA_LOADED, {
            videoUrl,
            keyframesData,
            keyframeIndices,
            leftDetectionIndices,
            rightDetectionIndices
        });
    }

    /**
     * Validate video file type
     * @param {File} file - Video file
     * @returns {boolean} True if valid
     */
    isValidVideoFile(file) {
        const extension = '.' + file.name.split('.').pop().toLowerCase();
        return FILE_UPLOAD.ACCEPTED_VIDEO_TYPES.includes(extension);
    }

    /**
     * Validate data file type
     * @param {File} file - Data file
     * @returns {boolean} True if valid
     */
    isValidDataFile(file) {
        const extension = '.' + file.name.split('.').pop().toLowerCase();
        return FILE_UPLOAD.ACCEPTED_DATA_TYPES.includes(extension);
    }

    /**
     * Validate keyframes data structure
     * @param {Object} data - Keyframes data
     * @returns {boolean} True if valid
     */
    validateKeyframesData(data) {
        if (!data || typeof data !== 'object') return false;
        if (!data.keyframes || typeof data.keyframes !== 'object') return false;
        if (!data.video_info || !data.tank_info) return false;
        if (!data.video_info.width || !data.video_info.height) return false;
        if (!data.video_info.fps || !data.video_info.total_frames_processed) return false;
        if (!data.tank_info.bbox) return false;
        
        // Check at least one keyframe exists
        const keyframeKeys = Object.keys(data.keyframes);
        if (keyframeKeys.length === 0) return false;
        
        // Validate first keyframe structure
        const firstKeyframe = data.keyframes[keyframeKeys[0]];
        if (!Array.isArray(firstKeyframe.left_detections) || 
            !Array.isArray(firstKeyframe.right_detections)) {
            return false;
        }
        
        return true;
    }

    /**
     * Get loading state
     * @returns {boolean} True if currently loading
     */
    getLoadingState() {
        return this.isLoading;
    }

    /**
     * Get available quick load options
     * @returns {Object} Quick load configurations
     */
    getQuickLoadOptions() {
        return Object.entries(QUICK_LOAD_VIDEOS).map(([key, config]) => ({
            key,
            label: config.label,
            video: config.video,
            data: config.data
        }));
    }
}