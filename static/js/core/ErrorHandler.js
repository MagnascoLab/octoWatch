/**
 * ErrorHandler - Centralized error handling and logging
 * Manages errors across all modules and provides user notifications
 */
export class ErrorHandler {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.errors = [];
        this.maxErrors = 100; // Keep last 100 errors
        this.setupErrorListeners();
    }

    /**
     * Setup event listeners for error handling
     */
    setupErrorListeners() {
        // Listen for error events
        this.eventBus.on('error', (data) => {
            this.handleError(data.error, data.module, data.severity);
        });

        // Listen for warnings
        this.eventBus.on('warning', (data) => {
            this.handleError(data.error, data.module, 'warning');
        });

        // Global error handler
        window.addEventListener('error', (event) => {
            this.handleError(
                new Error(event.message),
                'window',
                'critical',
                {
                    filename: event.filename,
                    lineno: event.lineno,
                    colno: event.colno
                }
            );
        });

        // Unhandled promise rejection handler
        window.addEventListener('unhandledrejection', (event) => {
            this.handleError(
                new Error(event.reason),
                'promise',
                'critical'
            );
        });
    }

    /**
     * Handle an error
     * @param {Error} error - The error object
     * @param {string} module - Module where error occurred
     * @param {string} severity - Error severity (info, warning, error, critical)
     * @param {Object} context - Additional context information
     */
    handleError(error, module, severity = 'error', context = {}) {
        const errorEntry = {
            timestamp: new Date().toISOString(),
            module,
            severity,
            message: error.message,
            stack: error.stack,
            context
        };

        // Store error
        this.errors.push(errorEntry);
        if (this.errors.length > this.maxErrors) {
            this.errors.shift();
        }

        // Log to console
        const logMethod = severity === 'warning' ? 'warn' : 'error';
        console[logMethod](`[${module}] ${error.message}`, error);

        // Show user notification for errors and critical issues
        if (severity === 'error' || severity === 'critical') {
            this.showUserNotification(errorEntry);
        }

        // For critical errors, emit a special event
        if (severity === 'critical') {
            this.eventBus.emit('critical-error', errorEntry);
        }

        return errorEntry;
    }

    /**
     * Show user notification for errors
     * @param {Object} errorEntry - Error entry object
     */
    showUserNotification(errorEntry) {
        // Check if notification element exists
        let notificationEl = document.getElementById('error-notification');
        
        if (!notificationEl) {
            // Create notification element if it doesn't exist
            notificationEl = document.createElement('div');
            notificationEl.id = 'error-notification';
            notificationEl.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background-color: #f44336;
                color: white;
                padding: 16px;
                border-radius: 4px;
                box-shadow: 0 2px 5px rgba(0,0,0,0.2);
                z-index: 10000;
                max-width: 400px;
                display: none;
            `;
            document.body.appendChild(notificationEl);
        }

        // Show notification
        notificationEl.textContent = `${errorEntry.module}: ${errorEntry.message}`;
        notificationEl.style.display = 'block';

        // Auto-hide after 5 seconds
        setTimeout(() => {
            notificationEl.style.display = 'none';
        }, 5000);
    }

    /**
     * Get all errors
     * @returns {Array} Array of error entries
     */
    getErrors() {
        return [...this.errors];
    }

    /**
     * Get errors by severity
     * @param {string} severity - Severity level
     * @returns {Array} Filtered error entries
     */
    getErrorsBySeverity(severity) {
        return this.errors.filter(error => error.severity === severity);
    }

    /**
     * Get errors by module
     * @param {string} module - Module name
     * @returns {Array} Filtered error entries
     */
    getErrorsByModule(module) {
        return this.errors.filter(error => error.module === module);
    }

    /**
     * Clear all errors
     */
    clearErrors() {
        this.errors = [];
    }

    /**
     * Export errors to console
     */
    exportToConsole() {
        console.group('Error Log Export');
        this.errors.forEach(error => {
            console.group(`[${error.timestamp}] ${error.module} - ${error.severity}`);
            console.log('Message:', error.message);
            if (error.stack) console.log('Stack:', error.stack);
            if (Object.keys(error.context).length > 0) {
                console.log('Context:', error.context);
            }
            console.groupEnd();
        });
        console.groupEnd();
    }
}