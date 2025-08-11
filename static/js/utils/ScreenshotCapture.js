/**
 * ScreenshotCapture - Utility for capturing video frames with WebGL overlays
 * Composites video and canvas content into a downloadable image
 */

export class ScreenshotCapture {
    /**
     * Capture current frame with overlays
     * @param {HTMLVideoElement} videoElement - Video element
     * @param {HTMLCanvasElement} webglCanvas - WebGL canvas with overlays
     * @param {number} currentFrame - Current frame number
     * @param {string} videoFilename - Video filename for naming screenshot
     * @returns {Object} Result object with success status and data/error
     */
    captureFrame(videoElement, webglCanvas, currentFrame, videoFilename) {
        try {
            // Create offscreen canvas matching video dimensions
            const canvas = document.createElement('canvas');
            canvas.width = videoElement.videoWidth;
            canvas.height = videoElement.videoHeight;
            const ctx = canvas.getContext('2d');
            
            // Draw video frame first
            ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
            
            // Draw WebGL overlay on top
            // Scale WebGL canvas to match video dimensions if needed
            ctx.drawImage(webglCanvas, 0, 0, canvas.width, canvas.height);
            
            // Generate filename
            const filename = this.generateFilename(videoFilename, currentFrame);
            
            // Convert to data URL
            const dataUrl = canvas.toDataURL('image/png');
            
            return {
                success: true,
                dataUrl,
                filename
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    /**
     * Download image from data URL
     * @param {string} dataUrl - Image data URL
     * @param {string} filename - Filename for download
     */
    downloadImage(dataUrl, filename) {
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = filename;
        
        // Temporarily add to document for Firefox compatibility
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
    
    /**
     * Generate descriptive filename
     * @param {string} videoFilename - Original video filename
     * @param {number} frameNumber - Current frame number
     * @returns {string} Generated filename
     */
    generateFilename(videoFilename, frameNumber) {
        // Extract base name without extension
        const baseName = videoFilename ? videoFilename.replace(/\.[^/.]+$/, '') : 'octopus_video';
        
        // Get export postfix from localStorage
        const postfix = localStorage.getItem('exportPostfix') || '';
        
        // Create timestamp
        const now = new Date();
        const timestamp = now.getFullYear() +
            String(now.getMonth() + 1).padStart(2, '0') +
            String(now.getDate()).padStart(2, '0') + '_' +
            String(now.getHours()).padStart(2, '0') +
            String(now.getMinutes()).padStart(2, '0') +
            String(now.getSeconds()).padStart(2, '0');
        
        // Construct filename with optional postfix
        if (postfix) {
            return `${baseName}_frame_${frameNumber}_${timestamp}_${postfix}.png`;
        }
        return `${baseName}_frame_${frameNumber}_${timestamp}.png`;
    }
    
    /**
     * Take screenshot with automatic download
     * @param {HTMLVideoElement} videoElement - Video element
     * @param {HTMLCanvasElement} webglCanvas - WebGL canvas
     * @param {number} currentFrame - Current frame number
     * @param {string} videoFilename - Video filename
     * @returns {Object} Result object
     */
    takeScreenshot(videoElement, webglCanvas, currentFrame, videoFilename) {
        const result = this.captureFrame(videoElement, webglCanvas, currentFrame, videoFilename);
        
        if (result.success) {
            this.downloadImage(result.dataUrl, result.filename);
        }
        
        return result;
    }
}