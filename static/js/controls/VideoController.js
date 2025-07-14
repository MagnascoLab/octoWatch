/**
 * VideoController - Manages video playback and frame navigation
 * Handles seeking, stepping through frames, and keyframe navigation
 */
import { Events } from '../utils/EventBus.js';
import { DEFAULTS } from '../utils/Constants.js';

export class VideoController {
    /**
     * Create a VideoController
     * @param {HTMLVideoElement} videoElement - Video element to control
     * @param {EventBus} eventBus - Central event system
     */
    constructor(videoElement, eventBus) {
        this.videoPlayer = videoElement;
        this.eventBus = eventBus;
        
        this.currentFrame = 0;
        this.fps = DEFAULTS.FPS;
        this.keyframeIndices = [];
        this.isPlaying = false;
        
        this.setupEventListeners();
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Video element events
        this.videoPlayer.addEventListener('loadedmetadata', () => {
            this.eventBus.emit(Events.VIDEO_LOADED, {
                duration: this.videoPlayer.duration,
                videoWidth: this.videoPlayer.videoWidth,
                videoHeight: this.videoPlayer.videoHeight
            });
        });

        this.videoPlayer.addEventListener('play', () => {
            this.isPlaying = true;
            this.eventBus.emit(Events.VIDEO_PLAY);
        });

        this.videoPlayer.addEventListener('pause', () => {
            this.isPlaying = false;
            this.eventBus.emit(Events.VIDEO_PAUSE);
        });

        this.videoPlayer.addEventListener('seeked', () => {
            this.updateCurrentFrame();
            this.eventBus.emit(Events.VIDEO_SEEK, {
                frame: this.currentFrame,
                time: this.videoPlayer.currentTime
            });
        });
        

        // Listen for data loaded to get FPS and keyframes
        this.eventBus.on(Events.DATA_LOADED, (data) => {
            this.fps = data.keyframesData.video_info.fps || DEFAULTS.FPS;
            this.keyframeIndices = data.keyframeIndices;
        });
    }

    /**
     * Load a video URL
     * @param {string} url - Video URL to load
     */
    loadVideo(url) {
        this.videoPlayer.src = url;
        this.currentFrame = 0;
    }

    /**
     * Toggle play/pause
     * @returns {boolean} True if playing after toggle
     */
    togglePlayPause() {
        if (this.videoPlayer.paused) {
            this.videoPlayer.play();
            return true;
        } else {
            this.videoPlayer.pause();
            return false;
        }
    }

    /**
     * Seek to a specific frame
     * @param {number} frame - Frame number to seek to
     */
    seekToFrame(frame) {
        const time = frame / this.fps;
        this.videoPlayer.currentTime = time;
        this.currentFrame = frame;
    }

    /**
     * Step forward or backward by frames
     * @param {number} direction - Number of frames to step (negative for backward)
     */
    stepFrame(direction) {
        const newFrame = Math.max(0, this.currentFrame + direction);
        this.seekToFrame(newFrame);
    }

    /**
     * Jump to next or previous keyframe
     * @param {number} direction - 1 for next, -1 for previous
     */
    jumpToKeyframe(direction) {
        let targetFrame = null;
        if (direction > 0) {
            // Find next keyframe
            for (const kf of this.keyframeIndices) {
                if (kf > this.currentFrame) {
                    targetFrame = kf;
                    break;
                }
            }
            // If no next keyframe, wrap to first
            if (targetFrame === null && this.keyframeIndices.length > 0) {
                targetFrame = this.keyframeIndices[0];
            }
        } else {
            // Find previous keyframe
            for (let i = this.keyframeIndices.length - 1; i >= 0; i--) {
                if (this.keyframeIndices[i] < this.currentFrame) {
                    targetFrame = this.keyframeIndices[i];
                    break;
                }
            }
            // If no previous keyframe, wrap to last
            if (targetFrame === null && this.keyframeIndices.length > 0) {
                targetFrame = this.keyframeIndices[this.keyframeIndices.length - 1];
            }
        }

        if (targetFrame !== null) {
            this.seekToFrame(targetFrame);
        }
    }

    /**
     * Update current frame based on video time
     * @returns {number} Current frame number
     */
    updateCurrentFrame() {
        this.currentFrame = Math.round(this.videoPlayer.currentTime * this.fps);
        
        this.eventBus.emit(Events.VIDEO_FRAME_UPDATE, {
            frame: this.currentFrame,
            time: this.videoPlayer.currentTime
        });
        
        return this.currentFrame;
    }

    /**
     * Get current frame number
     * @returns {number} Current frame
     */
    getCurrentFrame() {
        return this.currentFrame;
    }

    /**
     * Get maximum number of frames
     * @returns {number} Total frames in video
     */
    getMaxFrames() {
        return Math.floor(this.videoPlayer.duration * this.fps);
    }

    /**
     * Get video dimensions
     * @returns {Object} Video width and height
     */
    getVideoDimensions() {
        return {
            width: this.videoPlayer.videoWidth,
            height: this.videoPlayer.videoHeight
        };
    }

    /**
     * Get video element rectangle
     * @returns {DOMRect} Video element bounding rectangle
     */
    getVideoRect() {
        return this.videoPlayer.getBoundingClientRect();
    }

    /**
     * Check if video is ready
     * @returns {boolean} True if video is ready to play
     */
    isReady() {
        return this.videoPlayer.readyState >= 2;
    }

    /**
     * Get playback state
     * @returns {Object} Playback state information
     */
    getPlaybackState() {
        return {
            isPlaying: this.isPlaying,
            currentFrame: this.currentFrame,
            currentTime: this.videoPlayer.currentTime,
            duration: this.videoPlayer.duration,
            fps: this.fps
        };
    }

    /**
     * Set playback rate
     * @param {number} rate - Playback rate (1.0 = normal speed)
     */
    setPlaybackRate(rate) {
        this.videoPlayer.playbackRate = rate;
    }

    /**
     * Mute/unmute video
     * @param {boolean} muted - True to mute, false to unmute
     */
    setMuted(muted) {
        this.videoPlayer.muted = muted;
    }

    /**
     * Get video element reference
     * @returns {HTMLVideoElement} Video element
     */
    getVideoElement() {
        return this.videoPlayer;
    }
}