/**
 * WebGLRenderer - Manages WebGL context and basic rendering operations
 * Provides shader management and primitive drawing functions
 */
import { Events } from '../utils/EventBus.js';
import { SHADERS, RENDERING } from '../utils/Constants.js';

export class WebGLRenderer {
    /**
     * Create a WebGLRenderer
     * @param {HTMLCanvasElement} canvas - Canvas element for WebGL rendering
     * @param {EventBus} eventBus - Central event system
     */
    constructor(canvas, eventBus) {
        this.canvas = canvas;
        this.eventBus = eventBus;
        this.gl = null;
        
        // Shader programs
        this.shaderProgram = null;
        this.trajectoryLineShaderProgram = null;
        this.trajectoryPointShaderProgram = null;
        this.heatmapShaderProgram = null;
        
        // Buffers
        this.positionBuffer = null;
        this.colorBuffer = null;
        this.texCoordBuffer = null;
        
        // Attribute and uniform locations
        this.attributes = {};
        this.uniforms = {};
        
        // Heatmap textures
        this.leftHeatmapTexture = null;
        this.rightHeatmapTexture = null;
        this.heatmapData = null;
        
        this.initialize();
        this.setupEventListeners();
    }

    /**
     * Initialize WebGL context and shaders
     */
    initialize() {
        // Add preserveDrawingBuffer for screenshot capability
        const contextOptions = {
            preserveDrawingBuffer: true,
            alpha: true
        };
        
        this.gl = this.canvas.getContext('webgl', contextOptions) || 
                  this.canvas.getContext('experimental-webgl', contextOptions);
        
        if (!this.gl) {
            this.eventBus.emit(Events.ERROR, {
                error: new Error('WebGL not supported'),
                module: 'WebGLRenderer',
                severity: 'critical'
            });
            return false;
        }

        // Create basic shader program
        this.shaderProgram = this.createShaderProgram(SHADERS.VERTEX_BASIC, SHADERS.FRAGMENT_BASIC);
        if (this.shaderProgram) {
            this.attributes.position = this.gl.getAttribLocation(this.shaderProgram, 'a_position');
            this.uniforms.resolution = this.gl.getUniformLocation(this.shaderProgram, 'u_resolution');
            this.uniforms.color = this.gl.getUniformLocation(this.shaderProgram, 'u_color');
        }

        // Create trajectory shader programs
        this.trajectoryLineShaderProgram = this.createShaderProgram(
            SHADERS.VERTEX_TRAJECTORY,
            SHADERS.FRAGMENT_TRAJECTORY_LINE
        );
        if (this.trajectoryLineShaderProgram) {
            this.attributes.trajLinePosition = this.gl.getAttribLocation(this.trajectoryLineShaderProgram, 'a_position');
            this.attributes.trajLineColor = this.gl.getAttribLocation(this.trajectoryLineShaderProgram, 'a_color');
            this.uniforms.trajLineResolution = this.gl.getUniformLocation(this.trajectoryLineShaderProgram, 'u_resolution');
        }

        this.trajectoryPointShaderProgram = this.createShaderProgram(
            SHADERS.VERTEX_TRAJECTORY,
            SHADERS.FRAGMENT_TRAJECTORY_POINT
        );
        if (this.trajectoryPointShaderProgram) {
            this.attributes.trajPointPosition = this.gl.getAttribLocation(this.trajectoryPointShaderProgram, 'a_position');
            this.attributes.trajPointColor = this.gl.getAttribLocation(this.trajectoryPointShaderProgram, 'a_color');
            this.uniforms.trajPointResolution = this.gl.getUniformLocation(this.trajectoryPointShaderProgram, 'u_resolution');
        }

        // Create heatmap shader program
        this.heatmapShaderProgram = this.createShaderProgram(
            SHADERS.VERTEX_HEATMAP,
            SHADERS.FRAGMENT_HEATMAP
        );
        if (this.heatmapShaderProgram) {
            this.attributes.heatmapPosition = this.gl.getAttribLocation(this.heatmapShaderProgram, 'a_position');
            this.attributes.heatmapTexCoord = this.gl.getAttribLocation(this.heatmapShaderProgram, 'a_texCoord');
            this.uniforms.heatmapResolution = this.gl.getUniformLocation(this.heatmapShaderProgram, 'u_resolution');
            this.uniforms.heatmapTexture = this.gl.getUniformLocation(this.heatmapShaderProgram, 'u_heatmap');
            this.uniforms.heatmapOpacity = this.gl.getUniformLocation(this.heatmapShaderProgram, 'u_opacity');
        }

        // Create buffers
        this.positionBuffer = this.gl.createBuffer();
        this.colorBuffer = this.gl.createBuffer();
        this.texCoordBuffer = this.gl.createBuffer();
        
        // Create heatmap textures
        this.leftHeatmapTexture = this.gl.createTexture();
        this.rightHeatmapTexture = this.gl.createTexture();

        // Setup GL state
        this.gl.enable(this.gl.BLEND);
        this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);

        return true;
    }

    /**
     * Create shader program from vertex and fragment sources
     * @param {string} vsSource - Vertex shader source
     * @param {string} fsSource - Fragment shader source
     * @returns {WebGLProgram|null} Compiled shader program
     */
    createShaderProgram(vsSource, fsSource) {
        const vertexShader = this.loadShader(this.gl.VERTEX_SHADER, vsSource);
        const fragmentShader = this.loadShader(this.gl.FRAGMENT_SHADER, fsSource);

        if (!vertexShader || !fragmentShader) {
            return null;
        }

        const shaderProgram = this.gl.createProgram();
        this.gl.attachShader(shaderProgram, vertexShader);
        this.gl.attachShader(shaderProgram, fragmentShader);
        this.gl.linkProgram(shaderProgram);

        if (!this.gl.getProgramParameter(shaderProgram, this.gl.LINK_STATUS)) {
            const error = new Error('Unable to initialize shader program: ' + 
                                  this.gl.getProgramInfoLog(shaderProgram));
            this.eventBus.emit(Events.ERROR, {
                error,
                module: 'WebGLRenderer',
                severity: 'error'
            });
            return null;
        }

        return shaderProgram;
    }

    /**
     * Load and compile a shader
     * @param {number} type - Shader type (VERTEX_SHADER or FRAGMENT_SHADER)
     * @param {string} source - Shader source code
     * @returns {WebGLShader|null} Compiled shader
     */
    loadShader(type, source) {
        const shader = this.gl.createShader(type);
        this.gl.shaderSource(shader, source);
        this.gl.compileShader(shader);

        if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
            const error = new Error('Error compiling shader: ' + 
                                  this.gl.getShaderInfoLog(shader));
            this.eventBus.emit(Events.ERROR, {
                error,
                module: 'WebGLRenderer',
                severity: 'error'
            });
            this.gl.deleteShader(shader);
            return null;
        }

        return shader;
    }

    /**
     * Clear the canvas
     */
    clear() {
        this.gl.clearColor(0, 0, 0, 0);
        this.gl.clear(this.gl.COLOR_BUFFER_BIT);
    }

    /**
     * Resize canvas and update viewport
     * @param {number} width - New width
     * @param {number} height - New height
     */
    resize(width, height) {
        this.canvas.width = width;
        this.canvas.height = height;
        this.gl.viewport(0, 0, width, height);
    }

    /**
     * Draw a line
     * @param {number} x1 - Start X coordinate
     * @param {number} y1 - Start Y coordinate
     * @param {number} x2 - End X coordinate
     * @param {number} y2 - End Y coordinate
     * @param {number[]} color - RGBA color array
     */
    drawLine(x1, y1, x2, y2, color) {
        const gl = this.gl;

        // Use basic shader program
        gl.useProgram(this.shaderProgram);
        gl.uniform2f(this.uniforms.resolution, this.canvas.width, this.canvas.height);

        // Set up vertices
        gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([x1, y1, x2, y2]), gl.STATIC_DRAW);

        gl.enableVertexAttribArray(this.attributes.position);
        gl.vertexAttribPointer(this.attributes.position, 2, gl.FLOAT, false, 0, 0);

        // Set color
        gl.uniform4fv(this.uniforms.color, color);

        // Draw
        gl.lineWidth(RENDERING.WEBGL_LINE_WIDTH);
        gl.drawArrays(gl.LINES, 0, 2);

        gl.disableVertexAttribArray(this.attributes.position);
    }

    /**
     * Draw a rectangle outline
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @param {number} width - Rectangle width
     * @param {number} height - Rectangle height
     * @param {number[]} color - RGBA color array
     */
    drawRectangle(x, y, width, height, color) {
        const x1 = x;
        const y1 = y;
        const x2 = x + width;
        const y2 = y + height;

        // Draw 4 lines for rectangle outline
        this.drawLine(x1, y1, x2, y1, color); // Top
        this.drawLine(x2, y1, x2, y2, color); // Right
        this.drawLine(x2, y2, x1, y2, color); // Bottom
        this.drawLine(x1, y2, x1, y1, color); // Left
    }

    /**
     * Draw trajectory lines
     * @param {Float32Array} vertices - Line vertices (x1, y1, x2, y2, ...)
     * @param {Float32Array} colors - Vertex colors (r1, g1, b1, a1, ...)
     */
    drawTrajectoryLines(vertices, colors) {
        const gl = this.gl;

        // Switch to trajectory line shader program
        gl.useProgram(this.trajectoryLineShaderProgram);
        gl.uniform2f(this.uniforms.trajLineResolution, this.canvas.width, this.canvas.height);
        
        // Bind position buffer
        gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
        gl.enableVertexAttribArray(this.attributes.trajLinePosition);
        gl.vertexAttribPointer(this.attributes.trajLinePosition, 2, gl.FLOAT, false, 0, 0);
        
        // Bind color buffer
        gl.bindBuffer(gl.ARRAY_BUFFER, this.colorBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, colors, gl.STATIC_DRAW);
        gl.enableVertexAttribArray(this.attributes.trajLineColor);
        gl.vertexAttribPointer(this.attributes.trajLineColor, 4, gl.FLOAT, false, 0, 0);
        
        gl.lineWidth(RENDERING.WEBGL_LINE_WIDTH);
        gl.drawArrays(gl.LINES, 0, vertices.length / 2);
        
        // Disable vertex attributes
        gl.disableVertexAttribArray(this.attributes.trajLinePosition);
        gl.disableVertexAttribArray(this.attributes.trajLineColor);
    }

    /**
     * Draw trajectory points
     * @param {Float32Array} vertices - Point vertices (x, y, ...)
     * @param {Float32Array} colors - Vertex colors (r, g, b, a, ...)
     */
    drawTrajectoryPoints(vertices, colors) {
        const gl = this.gl;

        // Switch to trajectory point shader program
        gl.useProgram(this.trajectoryPointShaderProgram);
        gl.uniform2f(this.uniforms.trajPointResolution, this.canvas.width, this.canvas.height);
        
        // Bind position buffer
        gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
        gl.enableVertexAttribArray(this.attributes.trajPointPosition);
        gl.vertexAttribPointer(this.attributes.trajPointPosition, 2, gl.FLOAT, false, 0, 0);
        
        // Bind color buffer
        gl.bindBuffer(gl.ARRAY_BUFFER, this.colorBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, colors, gl.STATIC_DRAW);
        gl.enableVertexAttribArray(this.attributes.trajPointColor);
        gl.vertexAttribPointer(this.attributes.trajPointColor, 4, gl.FLOAT, false, 0, 0);
        
        gl.drawArrays(gl.POINTS, 0, vertices.length / 2);
        
        // Disable vertex attributes
        gl.disableVertexAttribArray(this.attributes.trajPointPosition);
        gl.disableVertexAttribArray(this.attributes.trajPointColor);
    }

    /**
     * Draw zone boundaries for H1, H2, H3 visualization
     * @param {Object} tankBbox - Tank bounding box
     * @param {number} scaleX - X scale factor
     * @param {number} scaleY - Y scale factor
     */
    drawZoneBoundaries(tankBbox, scaleX, scaleY) {
        const gl = this.gl;
        
        // Calculate tank dimensions in canvas coordinates
        const tankLeft = tankBbox.x_min * scaleX;
        const tankTop = tankBbox.y_min * scaleY;
        const tankRight = tankBbox.x_max * scaleX;
        const tankBottom = tankBbox.y_max * scaleY;
        const tankCenterX = tankBbox.center_x * scaleX;
        const tankCenterY = (tankTop + tankBottom) / 2;
        
        // Zone boundary color (semi-transparent gray)
        const zoneColor = [0.5, 0.5, 0.5, 0.5];
        const labelColor = [0.3, 0.3, 0.3, 0.8];
        const mpZoneColor = [0.8, 0.5, 0.2, 0.5]; // Orange color for MP zones
        
        // Draw horizontal center line (for T/B zones)
        this.drawLine(tankLeft, tankCenterY, tankRight, tankCenterY, zoneColor);
        
        // Left side zone boundary (H1, H2 - halves)
        const leftHalf = (tankCenterX - tankLeft) / 2;
        const leftMidpoint = tankLeft + leftHalf;
        
        // Draw left side vertical zone line
        this.drawLine(leftMidpoint, tankTop, leftMidpoint, tankBottom, zoneColor);
        
        // Right side zone boundary (H1, H2 - halves)
        const rightHalf = (tankRight - tankCenterX) / 2;
        const rightMidpoint = tankCenterX + rightHalf;
        
        // Draw right side vertical zone line
        this.drawLine(rightMidpoint, tankTop, rightMidpoint, tankBottom, zoneColor);
        
        // Draw Mirror Partition (MP) zones - 1/12 of half-tank width from center
        const mpThreshold = 1/12;
        const leftHalfWidth = tankCenterX - tankLeft;
        const rightHalfWidth = tankRight - tankCenterX;
        
        // Left MP zone boundary (closer to mirror)
        const leftMPBoundary = tankCenterX - (mpThreshold * leftHalfWidth);
        this.drawLine(leftMPBoundary, tankTop, leftMPBoundary, tankBottom, mpZoneColor);
        
        // Right MP zone boundary (closer to mirror)
        const rightMPBoundary = tankCenterX + (mpThreshold * rightHalfWidth);
        this.drawLine(rightMPBoundary, tankTop, rightMPBoundary, tankBottom, mpZoneColor);
        
        // Draw thicker lines for tank boundaries and center partition
        const thickColor = [0.3, 0.3, 0.3, 0.7];
        
        // Draw center partition with thicker line
        gl.lineWidth(2.0);
        this.drawLine(tankCenterX, tankTop, tankCenterX, tankBottom, thickColor);
        gl.lineWidth(1.0);
    }
    
    /**
     * Draw a circle as triangles
     * @param {number} x - Center X coordinate
     * @param {number} y - Center Y coordinate
     * @param {number} radius - Circle radius
     * @param {number[]} color - RGBA color array
     */
    drawCircle(x, y, radius, color) {
        const gl = this.gl;
        const segments = RENDERING.CIRCLE_SEGMENTS;
        
        // Use basic shader program
        gl.useProgram(this.shaderProgram);
        gl.uniform2f(this.uniforms.resolution, this.canvas.width, this.canvas.height);
        gl.uniform4fv(this.uniforms.color, color);
        
        // Draw circle as a series of triangles
        for (let i = 0; i < segments; i++) {
            const angle1 = (i / segments) * Math.PI * 2;
            const angle2 = ((i + 1) / segments) * Math.PI * 2;
            
            const x1 = x + Math.cos(angle1) * radius;
            const y1 = y + Math.sin(angle1) * radius;
            const x2 = x + Math.cos(angle2) * radius;
            const y2 = y + Math.sin(angle2) * radius;
            
            // Draw triangle from center to edge
            const vertices = new Float32Array([x, y, x1, y1, x2, y2]);
            
            gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
            
            gl.enableVertexAttribArray(this.attributes.position);
            gl.vertexAttribPointer(this.attributes.position, 2, gl.FLOAT, false, 0, 0);
            
            gl.drawArrays(gl.TRIANGLES, 0, 3);
        }
        
        gl.disableVertexAttribArray(this.attributes.position);
    }

    /**
     * Switch back to basic shader program
     */
    useBasicShader() {
        this.gl.useProgram(this.shaderProgram);
        this.gl.uniform2f(this.uniforms.resolution, this.canvas.width, this.canvas.height);
    }

    /**
     * Get WebGL context
     * @returns {WebGLRenderingContext} WebGL context
     */
    getContext() {
        return this.gl;
    }

    /**
     * Check if WebGL is initialized
     * @returns {boolean} True if initialized
     */
    isInitialized() {
        return this.gl !== null;
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        this.eventBus.on(Events.HEATMAP_CALCULATED, (data) => {
            this.heatmapData = data;
            this.updateHeatmapTextures(data);
        });
    }

    /**
     * Update heatmap textures with new data
     * @param {Object} data - Heatmap data
     */
    updateHeatmapTextures(data) {
        const gl = this.gl;
        
        // Convert float data to unsigned byte
        const leftData = new Uint8Array(data.leftHeatmap.length);
        const rightData = new Uint8Array(data.rightHeatmap.length);
        for (let i = 0; i < data.leftHeatmap.length; i++) {
           leftData[i] = Math.floor(data.leftHeatmap[i] * 255);
            rightData[i] = Math.floor(data.rightHeatmap[i] * 255);

        }
        [this.leftHeatmapTexture, this.rightHeatmapTexture].forEach(texture => {
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        });
        // Update left heatmap texture with byte data
        gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
        gl.bindTexture(gl.TEXTURE_2D, this.leftHeatmapTexture);
        gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.LUMINANCE,
            data.heatmapWidth,
            data.heatmapHeight,
            0,
            gl.LUMINANCE,
            gl.UNSIGNED_BYTE,
            leftData
        );
        
        // Update right heatmap texture with byte data
        gl.bindTexture(gl.TEXTURE_2D, this.rightHeatmapTexture);
        gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.LUMINANCE,
            data.heatmapWidth,
            data.heatmapHeight,
            0,
            gl.LUMINANCE,
            gl.UNSIGNED_BYTE,
            rightData
        );
        
        // Set texture parameters for both textures
        gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
        
        gl.bindTexture(gl.TEXTURE_2D, null);
    }

    /**
     * Draw spatial heatmap overlay
     * @param {Object} tankBbox - Tank bounding box
     * @param {number} scaleX - X scale factor
     * @param {number} scaleY - Y scale factor
     * @param {number} opacity - Heatmap opacity (0-1)
     * @param {string} side - Which side to draw ('left', 'right', or 'both')
     */
    drawSpatialHeatmap(tankBbox, scaleX, scaleY, opacity = 0.7, side = 'both') {
        if (!this.heatmapData || !this.heatmapShaderProgram) return;
        const gl = this.gl;
        const videoWidth = this.canvas.width / scaleX;
        const videoHeight = this.canvas.height / scaleY;
        
        // Calculate tank dimensions in canvas coordinates
        const tankLeft = tankBbox.x_min * scaleX;
        const tankTop = tankBbox.y_min * scaleY;
        const tankRight = tankBbox.x_max * scaleX;
        const tankBottom = tankBbox.y_max * scaleY;
        const tankCenterX = tankBbox.center_x * scaleX;
        // Use heatmap shader
        gl.useProgram(this.heatmapShaderProgram);
        gl.uniform2f(this.uniforms.heatmapResolution, this.canvas.width, this.canvas.height);
        gl.uniform1f(this.uniforms.heatmapOpacity, opacity);
        
        // Enable vertex attributes
        gl.enableVertexAttribArray(this.attributes.heatmapPosition);
        gl.enableVertexAttribArray(this.attributes.heatmapTexCoord);
        
        // Draw left heatmap if needed
        if (side === 'left' || side === 'both') {
            this.drawHeatmapQuad(
                tankLeft, tankTop,
                tankCenterX, tankBottom,
                this.leftHeatmapTexture
            );
        }
        
        // Draw right heatmap if needed
        if (side === 'right' || side === 'both') {
            this.drawHeatmapQuad(
                tankCenterX, tankTop,
                tankRight, tankBottom,
                this.rightHeatmapTexture
            );
        }
        
        // Disable vertex attributes
        gl.disableVertexAttribArray(this.attributes.heatmapPosition);
        gl.disableVertexAttribArray(this.attributes.heatmapTexCoord);
    }

    /**
     * Draw a single heatmap quad
     * @param {number} x1 - Left coordinate
     * @param {number} y1 - Top coordinate
     * @param {number} x2 - Right coordinate
     * @param {number} y2 - Bottom coordinate
     * @param {WebGLTexture} texture - Heatmap texture
     */
    drawHeatmapQuad(x1, y1, x2, y2, texture) {
        const gl = this.gl;
        // Set up vertex positions (two triangles for a quad)
        const positions = new Float32Array([
            x1, y1,
            x2, y1,
            x1, y2,
            x1, y2,
            x2, y1,
            x2, y2
        ]);
        
        // Set up texture coordinates
        const texCoords = new Float32Array([
            0, 0,
            1, 0,
            0, 1,
            0, 1,
            1, 0,
            1, 1
        ]);
        
        // Bind position buffer
        gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
        gl.vertexAttribPointer(this.attributes.heatmapPosition, 2, gl.FLOAT, false, 0, 0);
        
        // Bind texture coordinate buffer
        gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, texCoords, gl.STATIC_DRAW);
        gl.vertexAttribPointer(this.attributes.heatmapTexCoord, 2, gl.FLOAT, false, 0, 0);
        
        // Bind texture
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.uniform1i(this.uniforms.heatmapTexture, 0);
        
        // Draw
        gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
}