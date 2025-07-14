/**
 * Main entry point for the Octopus Visualizer application
 * Initializes the event system and core modules
 */
import { OctopusVisualizer } from './core/OctopusVisualizer.js';
import { EventBus } from './utils/EventBus.js';
import { ErrorHandler } from './core/ErrorHandler.js';

// Initialize global event bus
const eventBus = new EventBus();

// Setup error handling
const errorHandler = new ErrorHandler(eventBus);

// Initialize visualizer when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    try {
        console.log('Initializing Octopus Visualizer...');
        
        // Create main visualizer instance
        const visualizer = new OctopusVisualizer(eventBus, errorHandler);
        
        // Expose to global scope for debugging in development
            window.octopusVisualizer = visualizer;
            window.eventBus = eventBus;
            window.errorHandler = errorHandler;
            
            console.log('Debug objects exposed to window:', {
                octopusVisualizer: visualizer,
                eventBus: eventBus,
                errorHandler: errorHandler
            });
        
        // Setup performance monitoring shortcut
        window.addEventListener('keydown', (e) => {
            // Ctrl/Cmd + Shift + P for performance report
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'P') {
                if (visualizer.performanceMonitor) {
                    visualizer.performanceMonitor.exportReport();
                }
            }
            
            // Ctrl/Cmd + Shift + E for error log
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'E') {
                errorHandler.exportToConsole();
            }
        });
        
        console.log('Octopus Visualizer initialized successfully');
        
    } catch (error) {
        console.error('Failed to initialize Octopus Visualizer:', error);
        errorHandler.handleError(error, 'main', 'critical');
        
        // Show user-friendly error message
        const errorMessage = document.createElement('div');
        errorMessage.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: #f44336;
            color: white;
            padding: 20px;
            border-radius: 4px;
            font-family: Arial, sans-serif;
            text-align: center;
            z-index: 10000;
        `;
        errorMessage.innerHTML = `
            <h3>Failed to Initialize Application</h3>
            <p>${error.message}</p>
            <p>Please refresh the page to try again.</p>
        `;
        document.body.appendChild(errorMessage);
    }
});

// Handle uncaught errors at the window level
window.addEventListener('error', (event) => {
    console.error('Uncaught error:', event.error);
    if (errorHandler) {
        errorHandler.handleError(
            event.error,
            'window',
            'error',
            {
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno
            }
        );
    }
    // Prevent default error handling
    event.preventDefault();
});

// Handle unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    if (errorHandler) {
        errorHandler.handleError(
            new Error(event.reason),
            'promise',
            'error'
        );
    }
    // Prevent default rejection handling
    event.preventDefault();
});

// Export for potential use in other scripts
export { eventBus, errorHandler };