/**
 * DetectionManager - Handles YOLO detection process and progress monitoring
 */
import { Events } from '../utils/EventBus.js';

export class DetectionManager {
    /**
     * Create a DetectionManager
     * @param {EventBus} eventBus - Central event system
     */
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.currentJobId = null;
        this.eventSource = null;
        
        // UI elements
        this.detectionModal = document.getElementById('detectionModal');
        this.detectionMessage = document.getElementById('detectionMessage');
        this.detectionProgressBar = document.getElementById('detectionProgressBar');
        this.detectionStage = document.getElementById('detectionStage');
        this.detectionProgress = document.getElementById('detectionProgress');
        this.detectionTime = document.getElementById('detectionTime');
        this.detectionTimeRemaining = document.getElementById('detectionTimeRemaining');
        this.detectionSpeed = document.getElementById('detectionSpeed');
        this.leftDetections = document.getElementById('leftDetections');
        this.rightDetections = document.getElementById('rightDetections');
        this.cancelBtn = document.getElementById('cancelDetectionBtn');
        this.runDetectionBtn = document.getElementById('runDetectionBtn');
        this.importKeyframesBtn = document.getElementById('importKeyframesBtn');
        this.keyframesFileInput = document.getElementById('keyframesFileInput');
        this.codeStatus = document.getElementById('codeStatus');
        this.detectionOptions = document.getElementById('detectionOptions');
        this.mirrorVideoCheckbox = document.getElementById('mirrorVideoCheckbox');
        
        this.setupEventListeners();
        this.setupEventHandlers();
    }
    
    setupEventListeners() {
        this.cancelBtn.addEventListener('click', () => this.cancelDetection());
        
        // NOTE: runDetectionBtn click is now handled by UIManager
        // which properly handles the experiment type dropdown
        // DO NOT add a listener here - it would create duplicate events
        
        // Remove import keyframes listeners - now handled in UIManager
        // The old code handling is kept for backward compatibility
        // but will not be used in the new workflow
    }
    
    setupEventHandlers() {
        // Listen for code validation
        this.eventBus.on('detection:checkCode', async (data) => {
            await this.checkCode(data.code, data.explicit, data.selectOnly);
        });
        
        // Listen for detection run request
        this.eventBus.on('detection:run', (data) => {
            const params = {};
            if (data.mirrorVideo) {
                params.is_mirror = true;
            }
            this.startDetection(data.code, params);
        });
    }
    
    async checkCode(code, explicit = false, selectOnly = false) {
        try {
            const response = await fetch(`/check-keyframes/${code}`);
            const data = await response.json();
            
            if (response.ok) {
                // Emit result back to UIManager
                this.eventBus.emit('detection:codeCheckResult', {
                    code: code,
                    exists: data.has_video,
                    hasKeyframes: data.has_keyframes,
                    isMirror: data.is_mirror || false
                });
                
                // If not select-only mode and explicitly loading with keyframes, load the video
                if (!selectOnly && explicit && data.has_video && data.has_keyframes) {
                    this.eventBus.emit('ui:quickLoad', { code });
                }
            }
        } catch (error) {
            console.error('Error checking code:', error);
            this.eventBus.emit('detection:codeCheckResult', {
                code: code,
                exists: false,
                hasKeyframes: false,
                error: error.message
            });
        }
    }
    
    async importKeyframes(file) {
        const code = document.getElementById('codeInput').value;
        if (!code) {
            Swal.fire({
                icon: 'error',
                title: 'No video selected',
                text: 'Please enter a video code first',
                confirmButtonColor: '#007bff'
            });
            return;
        }
        
        // Validate file type
        if (!file.name.toLowerCase().endsWith('.json')) {
            Swal.fire({
                icon: 'error',
                title: 'Invalid file type',
                text: 'Please select a JSON file',
                confirmButtonColor: '#007bff'
            });
            return;
        }
        
        // Create FormData for file upload
        const formData = new FormData();
        formData.append('keyframes', file);
        
        try {
            // Show loading
            Swal.fire({
                title: 'Importing Keyframes',
                text: 'Please wait...',
                allowOutsideClick: false,
                didOpen: () => {
                    Swal.showLoading();
                }
            });
            
            const response = await fetch(`/import-keyframes/${code}`, {
                method: 'POST',
                body: formData
            });
            
            const data = await response.json();
            
            if (response.ok) {
                // Show success message with details
                let message = `Successfully imported ${data.total_frames} keyframes`;
                if (data.frames_with_left > 0 || data.frames_with_right > 0) {
                    message += `\n\nDetections found:\n`;
                    message += `• Left side: ${data.frames_with_left} frames\n`;
                    message += `• Right side: ${data.frames_with_right} frames`;
                }
                if (data.replaced_existing) {
                    message += `\n\nBackup created: ${data.backup_created}`;
                }
                
                await Swal.fire({
                    icon: 'success',
                    title: 'Import Successful',
                    text: message,
                    confirmButtonColor: '#28a745'
                });
                
                // Automatically load the video with the imported keyframes
                this.eventBus.emit('ui:quickLoad', { code });
            } else {
                // Show error
                Swal.fire({
                    icon: 'error',
                    title: 'Import Failed',
                    text: data.error || 'Failed to import keyframes',
                    confirmButtonColor: '#dc3545'
                });
            }
        } catch (error) {
            console.error('Error importing keyframes:', error);
            Swal.fire({
                icon: 'error',
                title: 'Import Error',
                text: 'An error occurred while importing keyframes',
                confirmButtonColor: '#dc3545'
            });
        }
    }
    
    async startDetection(code, params = {}) {
        // Disable button to prevent multiple clicks
        this.runDetectionBtn.disabled = true;
        
        try {
            // Start detection job
            const response = await fetch(`/start-detection/${code}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(params)
            });
            
            const data = await response.json();
            
            if (response.ok) {
                this.currentJobId = data.job_id;
                this.showDetectionModal();
                this.connectToProgress();
            } else {
                this.eventBus.emit(Events.DATA_ERROR, {
                    error: new Error(data.error || 'Failed to start detection'),
                    module: 'DetectionManager',
                    severity: 'error'
                });
            }
        } catch (error) {
            this.eventBus.emit(Events.DATA_ERROR, {
                error,
                module: 'DetectionManager',
                severity: 'error'
            });
            // Re-enable button on error
            this.runDetectionBtn.disabled = false;
        }
    }
    
    connectToProgress() {
        if (this.eventSource) {
            this.eventSource.close();
        }
        
        this.eventSource = new EventSource(`/detection-progress/${this.currentJobId}`);
        
        this.eventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                this.handleProgressUpdate(data);
            } catch (error) {
                console.error('Error parsing progress data:', error);
            }
        };
        
        this.eventSource.onerror = (error) => {
            console.error('SSE error:', error);
            this.eventSource.close();
            this.hideDetectionModal();
        };
    }
    
    handleProgressUpdate(data) {
        switch (data.type) {
            case 'progress':
                this.updateProgress(data);
                break;
            case 'complete':
                this.handleComplete(data);
                break;
            case 'error':
                this.handleError(data);
                break;
            case 'cancelled':
                this.handleCancelled(data);
                break;
        }
    }
    
    updateProgress(data) {
        // Update stage
        const stageMap = {
            'tank_detection': 'Detecting Tank',
            'frame_processing': 'Processing Frames',
            'preprocessing': 'Preprocessing',
            'complete': 'Complete'
        };
        this.detectionStage.textContent = stageMap[data.stage] || data.stage;
        
        // Update message
        this.detectionMessage.textContent = data.message || 'Processing...';
        
        // Update progress bar and calculate time remaining
        if (data.current_frame && data.total_frames) {
            const progress = (data.current_frame / data.total_frames) * 100;
            this.detectionProgressBar.style.width = `${progress}%`;
            this.detectionProgressBar.textContent = `${Math.round(progress)}%`;
            this.detectionProgress.textContent = `${data.current_frame}/${data.total_frames} frames`;
            
            // Calculate time remaining and processing speed
            if (data.time_elapsed && data.current_frame > 0) {
                // Calculate seconds per frame
                const secondsPerFrame = data.time_elapsed / data.current_frame;
                
                // Calculate frames remaining
                const framesRemaining = data.total_frames - data.current_frame;
                
                // Estimate time remaining
                const timeRemaining = secondsPerFrame * framesRemaining;
                
                // Format time remaining
                const minutes = Math.floor(timeRemaining / 60);
                const seconds = Math.round(timeRemaining % 60);
                if (minutes > 0) {
                    this.detectionTimeRemaining.textContent = `${minutes}m ${seconds}s`;
                } else {
                    this.detectionTimeRemaining.textContent = `${seconds}s`;
                }
                
                // Calculate processing speed ratio (video fps / processing fps)
                if (data.fps) {
                    const processingFps = 1 / secondsPerFrame;
                    const speedRatio = processingFps / data.fps;
                    this.detectionSpeed.textContent = `${speedRatio.toFixed(1)}x real-time`;
                }
            }
        }
        
        // Update time
        if (data.time_elapsed) {
            this.detectionTime.textContent = `${Math.round(data.time_elapsed)}s`;
        }
        
        // Update detection counts
        if (data.left_detections !== undefined) {
            this.leftDetections.textContent = data.left_detections;
        }
        if (data.right_detections !== undefined) {
            this.rightDetections.textContent = data.right_detections;
        }
    }
    
    handleComplete(data) {
        this.detectionMessage.textContent = 'Detection completed successfully!';
        this.detectionProgressBar.style.width = '100%';
        this.detectionProgressBar.textContent = '100%';
        
        // Close modal after delay
        setTimeout(() => {
            this.hideDetectionModal();
            // Reload the video with new keyframes
            const code = document.getElementById('codeInput').value;
            // Emit detection completed event first
            this.eventBus.emit('detection:completed', { code });
            // Then load the video
            this.eventBus.emit('ui:quickLoad', { code });
        }, 2000);
    }
    
    handleError(data) {
        this.detectionMessage.textContent = `Error: ${data.message}`;
        this.detectionMessage.style.color = '#dc3545';
    }
    
    handleCancelled(data) {
        this.detectionMessage.textContent = 'Detection cancelled';
        setTimeout(() => this.hideDetectionModal(), 1000);
    }
    
    async cancelDetection() {
        if (this.currentJobId) {
            try {
                await fetch(`/cancel-detection/${this.currentJobId}`, {
                    method: 'POST'
                });
            } catch (error) {
                console.error('Error cancelling detection:', error);
            }
        }
        
        if (this.eventSource) {
            this.eventSource.close();
        }
        
        this.hideDetectionModal();
    }
    
    showDetectionModal() {
        this.detectionModal.style.display = 'block';
        // Reset UI
        this.detectionProgressBar.style.width = '0%';
        this.detectionProgressBar.textContent = '0%';
        this.detectionMessage.textContent = 'Initializing detection...';
        this.detectionMessage.style.color = '';
        this.detectionStage.textContent = 'Starting';
        this.detectionProgress.textContent = '0/0 frames';
        this.detectionTime.textContent = '0s';
        this.detectionTimeRemaining.textContent = '--';
        this.detectionSpeed.textContent = '--';
        this.leftDetections.textContent = '0';
        this.rightDetections.textContent = '0';
    }
    
    hideDetectionModal() {
        this.detectionModal.style.display = 'none';
        this.currentJobId = null;
        if (this.eventSource) {
            this.eventSource.close();
            this.eventSource = null;
        }
        // Re-enable button when modal closes
        this.runDetectionBtn.disabled = false;
    }
}