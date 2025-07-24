export class BoundingBoxInteraction {
    constructor(canvas, videoElement, eventBus) {
        this.canvas = canvas;
        this.videoElement = videoElement;
        this.eventBus = eventBus;
        this.isEnabled = false;
        this.isDragging = false;
        this.isResizing = false;
        this.selectedBox = null;
        this.dragOffset = { x: 0, y: 0 };
        this.currentBoundingBoxes = { left: [], right: [] };
        
        // Resize properties
        this.resizeHandle = null; // Which handle is being dragged
        this.handleSize = 8; // Size of resize handles in pixels
        this.minBoxSize = 0.02; // Minimum box size (2% of video dimensions)
        
        this.mouseDownHandler = this.handleMouseDown.bind(this);
        this.mouseMoveHandler = this.handleMouseMove.bind(this);
        this.mouseUpHandler = this.handleMouseUp.bind(this);
        
        this.eventBus.on('boundingBoxesUpdated', (data) => {
            this.currentBoundingBoxes = data;
        });
    }
    
    enable() {
        this.isEnabled = true;
        this.canvas.style.pointerEvents = 'auto';
        this.canvas.style.cursor = 'default';
        
        this.canvas.addEventListener('mousedown', this.mouseDownHandler);
        this.canvas.addEventListener('mousemove', this.mouseMoveHandler);
        this.canvas.addEventListener('mouseup', this.mouseUpHandler);
        
        this.eventBus.emit('bboxEditingEnabled');
    }
    
    disable() {
        this.isEnabled = false;
        this.canvas.style.pointerEvents = 'none';
        this.canvas.style.cursor = 'default';
        
        this.canvas.removeEventListener('mousedown', this.mouseDownHandler);
        this.canvas.removeEventListener('mousemove', this.mouseMoveHandler);
        this.canvas.removeEventListener('mouseup', this.mouseUpHandler);
        
        this.isDragging = false;
        this.selectedBox = null;
        
        this.eventBus.emit('bboxEditingDisabled');
    }
    
    getMousePosition(event) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        
        return {
            x: (event.clientX - rect.left) * scaleX,
            y: (event.clientY - rect.top) * scaleY
        };
    }
    
    canvasToVideoCoords(canvasX, canvasY) {
        const videoWidth = this.videoElement.videoWidth;
        const videoHeight = this.videoElement.videoHeight;
        const canvasWidth = this.canvas.width;
        const canvasHeight = this.canvas.height;
        
        const videoAspect = videoWidth / videoHeight;
        const canvasAspect = canvasWidth / canvasHeight;
        
        let scale, offsetX = 0, offsetY = 0;
        
        if (videoAspect > canvasAspect) {
            scale = canvasWidth / videoWidth;
            offsetY = (canvasHeight - videoHeight * scale) / 2;
        } else {
            scale = canvasHeight / videoHeight;
            offsetX = (canvasWidth - videoWidth * scale) / 2;
        }
        return {
            x: ((canvasX - offsetX) / scale) / videoWidth,
            y: ((canvasY - offsetY) / scale) / videoHeight
        };
    }
    
    videoToCanvasCoords(videoX, videoY) {
        const videoWidth = this.videoElement.videoWidth;
        const videoHeight = this.videoElement.videoHeight;
        const canvasWidth = this.canvas.width;
        const canvasHeight = this.canvas.height;
        
        const videoAspect = videoWidth / videoHeight;
        const canvasAspect = canvasWidth / canvasHeight;
        
        let scale, offsetX = 0, offsetY = 0;
        
        if (videoAspect > canvasAspect) {
            scale = canvasWidth / videoWidth;
            offsetY = (canvasHeight - videoHeight * scale) / 2;
        } else {
            scale = canvasHeight / videoHeight;
            offsetX = (canvasWidth - videoWidth * scale) / 2;
        }
        
        return {
            x: videoX * scale + offsetX,
            y: videoY * scale + offsetY
        };
    }
    
    findBoxAtPosition(x, y) {
        const videoCoords = this.canvasToVideoCoords(x, y);
       
        for (const [side, boxes] of Object.entries(this.currentBoundingBoxes)) {
            for (let i = 0; i < boxes.length; i++) {
                const box = boxes[i];
                if (videoCoords.x >= box.x_min && videoCoords.x <= box.x_max &&
                    videoCoords.y >= box.y_min && videoCoords.y <= box.y_max) {
                    return { side, index: i, box };
                }
            }
        }
        
        return null;
    }
    
    getResizeHandle(box, x, y) {
        const videoCoords = this.canvasToVideoCoords(x, y);
        const handleSizeNorm = this.handleSize / this.videoElement.videoWidth * 2; // Normalized handle size
        
        // Check corners first (they have priority)
        const corners = {
            'nw': { x: box.x_min, y: box.y_min },
            'ne': { x: box.x_max, y: box.y_min },
            'sw': { x: box.x_min, y: box.y_max },
            'se': { x: box.x_max, y: box.y_max }
        };
        
        for (const [handle, pos] of Object.entries(corners)) {
            if (Math.abs(videoCoords.x - pos.x) < handleSizeNorm && 
                Math.abs(videoCoords.y - pos.y) < handleSizeNorm) {
                return handle;
            }
        }
        
        // Check edges
        const midX = (box.x_min + box.x_max) / 2;
        const midY = (box.y_min + box.y_max) / 2;
        
        // North edge
        if (Math.abs(videoCoords.y - box.y_min) < handleSizeNorm &&
            videoCoords.x > box.x_min + handleSizeNorm && 
            videoCoords.x < box.x_max - handleSizeNorm) {
            return 'n';
        }
        
        // South edge
        if (Math.abs(videoCoords.y - box.y_max) < handleSizeNorm &&
            videoCoords.x > box.x_min + handleSizeNorm && 
            videoCoords.x < box.x_max - handleSizeNorm) {
            return 's';
        }
        
        // West edge
        if (Math.abs(videoCoords.x - box.x_min) < handleSizeNorm &&
            videoCoords.y > box.y_min + handleSizeNorm && 
            videoCoords.y < box.y_max - handleSizeNorm) {
            return 'w';
        }
        
        // East edge
        if (Math.abs(videoCoords.x - box.x_max) < handleSizeNorm &&
            videoCoords.y > box.y_min + handleSizeNorm && 
            videoCoords.y < box.y_max - handleSizeNorm) {
            return 'e';
        }
        
        return null;
    }
    
    getCursorForHandle(handle) {
        const cursors = {
            'nw': 'nw-resize',
            'n': 'n-resize',
            'ne': 'ne-resize',
            'e': 'e-resize',
            'se': 'se-resize',
            's': 's-resize',
            'sw': 'sw-resize',
            'w': 'w-resize'
        };
        return cursors[handle] || 'move';
    }
    
    handleMouseDown(event) {
        if (!this.isEnabled) return;
        
        const mousePos = this.getMousePosition(event);
        
        // First check if we clicked on a resize handle
        if (this.selectedBox) {
            const handle = this.getResizeHandle(this.selectedBox.box, mousePos.x, mousePos.y);
            if (handle) {
                this.isResizing = true;
                this.resizeHandle = handle;
                this.canvas.style.cursor = this.getCursorForHandle(handle);
                return;
            }
        }
        
        // Otherwise check if we clicked on a box
        const hitBox = this.findBoxAtPosition(mousePos.x, mousePos.y);
        
        if (hitBox) {
            this.selectedBox = hitBox;
            
            // Check if we're on a resize handle
            const handle = this.getResizeHandle(hitBox.box, mousePos.x, mousePos.y);
            if (handle) {
                this.isResizing = true;
                this.resizeHandle = handle;
                this.canvas.style.cursor = this.getCursorForHandle(handle);
            } else {
                // We're dragging the box
                this.isDragging = true;
                const videoCoords = this.canvasToVideoCoords(mousePos.x, mousePos.y);
                this.dragOffset = {
                    x: videoCoords.x - hitBox.box.x_min,
                    y: videoCoords.y - hitBox.box.y_min
                };
                this.canvas.style.cursor = 'move';
            }
            
            this.eventBus.emit('bboxSelected', hitBox);
        } else {
            // Clicked outside any box
            this.selectedBox = null;
            this.eventBus.emit('bboxDeselected');
        }
    }
    
    handleMouseMove(event) {
        if (!this.isEnabled) return;
        
        const mousePos = this.getMousePosition(event);
        
        if (this.isResizing && this.selectedBox) {
            const videoCoords = this.canvasToVideoCoords(mousePos.x, mousePos.y);
            const newBox = this.calculateResizedBox(this.selectedBox.box, videoCoords, this.resizeHandle);
            
            this.eventBus.emit('bboxResizing', {
                side: this.selectedBox.side,
                index: this.selectedBox.index,
                newBox: newBox
            });
        } else if (this.isDragging && this.selectedBox) {
            const videoCoords = this.canvasToVideoCoords(mousePos.x, mousePos.y);
            
            const width = this.selectedBox.box.x_max - this.selectedBox.box.x_min;
            const height = this.selectedBox.box.y_max - this.selectedBox.box.y_min;
            
            const newBox = {
                ...this.selectedBox.box,
                x_min: videoCoords.x - this.dragOffset.x,
                y_min: videoCoords.y - this.dragOffset.y,
                x_max: videoCoords.x - this.dragOffset.x + width,
                y_max: videoCoords.y - this.dragOffset.y + height
            };
            
            this.eventBus.emit('bboxDragged', {
                side: this.selectedBox.side,
                index: this.selectedBox.index,
                newBox: newBox
            });
        } else {
            // Update cursor based on what we're hovering over
            if (this.selectedBox) {
                const handle = this.getResizeHandle(this.selectedBox.box, mousePos.x, mousePos.y);
                if (handle) {
                    this.canvas.style.cursor = this.getCursorForHandle(handle);
                } else {
                    const hitBox = this.findBoxAtPosition(mousePos.x, mousePos.y);
                    this.canvas.style.cursor = hitBox ? 'move' : 'default';
                }
            } else {
                const hitBox = this.findBoxAtPosition(mousePos.x, mousePos.y);
                this.canvas.style.cursor = hitBox ? 'pointer' : 'default';
            }
        }
    }
    
    calculateResizedBox(originalBox, mouseCoords, handle) {
        let newBox = { ...originalBox };
        
        // Apply constraints to ensure minimum size
        const applyMinSize = (box) => {
            if (box.x_max - box.x_min < this.minBoxSize) {
                const center = (box.x_min + box.x_max) / 2;
                box.x_min = center - this.minBoxSize / 2;
                box.x_max = center + this.minBoxSize / 2;
            }
            if (box.y_max - box.y_min < this.minBoxSize) {
                const center = (box.y_min + box.y_max) / 2;
                box.y_min = center - this.minBoxSize / 2;
                box.y_max = center + this.minBoxSize / 2;
            }
            // Clamp to video bounds
            box.x_min = Math.max(0, Math.min(1, box.x_min));
            box.x_max = Math.max(0, Math.min(1, box.x_max));
            box.y_min = Math.max(0, Math.min(1, box.y_min));
            box.y_max = Math.max(0, Math.min(1, box.y_max));
            return box;
        };
        
        // Update box based on which handle is being dragged
        switch (handle) {
            case 'nw':
                newBox.x_min = mouseCoords.x;
                newBox.y_min = mouseCoords.y;
                break;
            case 'n':
                newBox.y_min = mouseCoords.y;
                break;
            case 'ne':
                newBox.x_max = mouseCoords.x;
                newBox.y_min = mouseCoords.y;
                break;
            case 'e':
                newBox.x_max = mouseCoords.x;
                break;
            case 'se':
                newBox.x_max = mouseCoords.x;
                newBox.y_max = mouseCoords.y;
                break;
            case 's':
                newBox.y_max = mouseCoords.y;
                break;
            case 'sw':
                newBox.x_min = mouseCoords.x;
                newBox.y_max = mouseCoords.y;
                break;
            case 'w':
                newBox.x_min = mouseCoords.x;
                break;
        }
        
        return applyMinSize(newBox);
    }
    
    handleMouseUp(event) {
        if (!this.isEnabled) return;
        
        if (this.isResizing && this.selectedBox) {
            // Calculate final resized box
            const mousePos = this.getMousePosition(event);
            const videoCoords = this.canvasToVideoCoords(mousePos.x, mousePos.y);
            const newBox = this.calculateResizedBox(this.selectedBox.box, videoCoords, this.resizeHandle);
            
            // Update the selectedBox with the new coordinates
            this.selectedBox.box = newBox;
            
            this.isResizing = false;
            this.resizeHandle = null;
            this.canvas.style.cursor = 'default';
            
            this.eventBus.emit('bboxResizeComplete', {
                ...this.selectedBox,
                newBox: newBox
            });
        } else if (this.isDragging && this.selectedBox) {
            // Calculate final dragged box
            const mousePos = this.getMousePosition(event);
            const videoCoords = this.canvasToVideoCoords(mousePos.x, mousePos.y);
            
            const width = this.selectedBox.box.x_max - this.selectedBox.box.x_min;
            const height = this.selectedBox.box.y_max - this.selectedBox.box.y_min;
            
            const newBox = {
                ...this.selectedBox.box,
                x_min: videoCoords.x - this.dragOffset.x,
                y_min: videoCoords.y - this.dragOffset.y,
                x_max: videoCoords.x - this.dragOffset.x + width,
                y_max: videoCoords.y - this.dragOffset.y + height
            };
            
            // Update the selectedBox with the new coordinates
            this.selectedBox.box = newBox;
            
            this.isDragging = false;
            this.canvas.style.cursor = 'default';
            
            this.eventBus.emit('bboxDragComplete', {
                ...this.selectedBox,
                newBox: newBox
            });
        }
        
        // Don't clear selectedBox here - keep it selected after drag/resize
        this.dragOffset = { x: 0, y: 0 };
    }
}