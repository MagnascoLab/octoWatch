/**
 * EventBus - Central event system for module communication
 * Implements a simple publish/subscribe pattern for loose coupling between modules
 */
export class EventBus {
    constructor() {
        this.events = {};
    }

    /**
     * Subscribe to an event
     * @param {string} event - Event name
     * @param {Function} callback - Callback function
     * @returns {Function} Unsubscribe function
     */
    on(event, callback) {
        if (!this.events[event]) {
            this.events[event] = [];
        }
        this.events[event].push(callback);

        // Return unsubscribe function
        return () => this.off(event, callback);
    }

    /**
     * Emit an event
     * @param {string} event - Event name
     * @param {*} data - Data to pass to callbacks
     */
    emit(event, data) {
        if (!this.events[event]) return;
        
        this.events[event].forEach(callback => {
            try {
                callback(data);
            } catch (error) {
                console.error(`Error in event handler for ${event}:`, error);
            }
        });
    }

    /**
     * Unsubscribe from an event
     * @param {string} event - Event name
     * @param {Function} callback - Callback function to remove
     */
    off(event, callback) {
        if (!this.events[event]) return;
        
        this.events[event] = this.events[event].filter(cb => cb !== callback);
    }

    /**
     * Subscribe to an event only once
     * @param {string} event - Event name
     * @param {Function} callback - Callback function
     */
    once(event, callback) {
        const onceCallback = (data) => {
            callback(data);
            this.off(event, onceCallback);
        };
        this.on(event, onceCallback);
    }

    /**
     * Clear all event listeners
     */
    clear() {
        this.events = {};
    }

    /**
     * Get all listeners for an event
     * @param {string} event - Event name
     * @returns {Function[]} Array of callback functions
     */
    listeners(event) {
        return this.events[event] || [];
    }
}

// Event name constants
export const Events = {
    // Data events
    DATA_LOADED: 'data:loaded',
    DATA_ERROR: 'data:error',
    
    // Video events
    VIDEO_LOADED: 'video:loaded',
    VIDEO_PLAY: 'video:play',
    VIDEO_PAUSE: 'video:pause',
    VIDEO_SEEK: 'video:seek',
    VIDEO_FRAME_UPDATE: 'video:frameUpdate',
    
    // Analysis events
    ACTIVITY_CALCULATED: 'analysis:activityCalculated',
    PROXIMITY_CALCULATED: 'analysis:proximityCalculated',
    TRAJECTORY_CALCULATED: 'analysis:trajectoryCalculated',
    FOURIER_CALCULATED: 'analysis:fourierCalculated',
    HEATMAP_CALCULATED: 'analysis:heatmapCalculated',
    
    // Rendering events
    RENDER_REQUEST: 'render:request',
    RENDER_COMPLETE: 'render:complete',
    
    // UI events
    UI_CONTROL_CHANGE: 'ui:controlChange',
    UI_MODAL_SHOW: 'ui:modalShow',
    UI_MODAL_HIDE: 'ui:modalHide',
    DOWNLOAD_HEATMAPS: 'ui:downloadHeatmaps',
    
    // Error events
    ERROR: 'error',
    WARNING: 'warning'
};