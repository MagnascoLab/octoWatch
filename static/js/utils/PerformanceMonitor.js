/**
 * PerformanceMonitor - Performance metrics collection and monitoring
 * Tracks FPS, memory usage, and module load times
 */
export class PerformanceMonitor {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.metrics = {
            fps: 0,
            frameTime: 0,
            drawCalls: 0,
            memoryUsage: 0,
            moduleLoadTimes: {},
            renderTimes: []
        };
        
        this.frameCount = 0;
        this.lastTime = performance.now();
        this.fpsUpdateInterval = 1000; // Update FPS every second
        this.maxRenderTimeSamples = 100;
        
        this.setupPerformanceObserver();
    }

    /**
     * Setup performance observer for memory metrics if available
     */
    setupPerformanceObserver() {
        // Check if memory info is available (Chrome only)
        if (performance.memory) {
            setInterval(() => {
                this.metrics.memoryUsage = performance.memory.usedJSHeapSize;
                this.eventBus.emit('performance:memoryUpdate', {
                    used: performance.memory.usedJSHeapSize,
                    total: performance.memory.totalJSHeapSize,
                    limit: performance.memory.jsHeapSizeLimit
                });
            }, 5000); // Update every 5 seconds
        }
    }

    /**
     * Start frame timing
     */
    startFrame() {
        this.frameStartTime = performance.now();
    }

    /**
     * End frame timing and update metrics
     */
    endFrame() {
        const now = performance.now();
        const frameTime = now - this.frameStartTime;
        
        // Update frame time
        this.metrics.frameTime = frameTime;
        
        // Store render time sample
        this.metrics.renderTimes.push(frameTime);
        if (this.metrics.renderTimes.length > this.maxRenderTimeSamples) {
            this.metrics.renderTimes.shift();
        }
        
        // Update FPS
        this.frameCount++;
        const elapsed = now - this.lastTime;
        
        if (elapsed >= this.fpsUpdateInterval) {
            this.metrics.fps = (this.frameCount / elapsed) * 1000;
            this.frameCount = 0;
            this.lastTime = now;
            
            // Emit FPS update event
            this.eventBus.emit('performance:fpsUpdate', {
                fps: this.metrics.fps,
                avgFrameTime: this.getAverageRenderTime()
            });
        }
    }

    /**
     * Increment draw call counter
     */
    incrementDrawCalls() {
        this.metrics.drawCalls++;
    }

    /**
     * Reset draw call counter (usually at start of frame)
     */
    resetDrawCalls() {
        this.metrics.drawCalls = 0;
    }

    /**
     * Measure module load time
     * @param {string} moduleName - Name of the module
     * @param {Function} loadFn - Function that loads the module
     * @returns {*} Result of the load function
     */
    async measureModuleLoad(moduleName, loadFn) {
        const start = performance.now();
        
        try {
            const result = await loadFn();
            const loadTime = performance.now() - start;
            
            this.metrics.moduleLoadTimes[moduleName] = loadTime;
            
            this.eventBus.emit('performance:moduleLoaded', {
                module: moduleName,
                time: loadTime
            });
            
            return result;
        } catch (error) {
            const loadTime = performance.now() - start;
            this.metrics.moduleLoadTimes[moduleName] = loadTime;
            
            this.eventBus.emit('performance:moduleLoadError', {
                module: moduleName,
                time: loadTime,
                error
            });
            
            throw error;
        }
    }

    /**
     * Get current metrics
     * @returns {Object} Current performance metrics
     */
    getMetrics() {
        return {
            ...this.metrics,
            avgRenderTime: this.getAverageRenderTime()
        };
    }

    /**
     * Get average render time
     * @returns {number} Average render time in milliseconds
     */
    getAverageRenderTime() {
        if (this.metrics.renderTimes.length === 0) return 0;
        
        const sum = this.metrics.renderTimes.reduce((a, b) => a + b, 0);
        return sum / this.metrics.renderTimes.length;
    }

    /**
     * Export performance report to console
     */
    exportReport() {
        const report = this.getMetrics();
        
        console.group('Performance Report');
        console.log('FPS:', report.fps.toFixed(2));
        console.log('Average Frame Time:', report.avgRenderTime.toFixed(2) + 'ms');
        console.log('Draw Calls per Frame:', report.drawCalls);
        
        if (report.memoryUsage > 0) {
            console.log('Memory Usage:', (report.memoryUsage / 1024 / 1024).toFixed(2) + 'MB');
        }
        
        console.group('Module Load Times');
        Object.entries(report.moduleLoadTimes).forEach(([module, time]) => {
            console.log(`${module}:`, time.toFixed(2) + 'ms');
        });
        console.groupEnd();
        
        console.groupEnd();
    }

    /**
     * Reset all metrics
     */
    reset() {
        this.metrics = {
            fps: 0,
            frameTime: 0,
            drawCalls: 0,
            memoryUsage: 0,
            moduleLoadTimes: {},
            renderTimes: []
        };
        this.frameCount = 0;
        this.lastTime = performance.now();
    }
}