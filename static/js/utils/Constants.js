/**
 * Constants - Shared constants and configuration values
 * Central location for all application constants
 */

// Default values
export const DEFAULTS = {
    FPS: 30,
    ACTIVITY_SENSITIVITY: 2.0,
    PROXIMITY_SENSITIVITY: 2.0,
    TRAJECTORY_ALPHA: 0.5,
    HEATMAP_ALPHA: 0.7,
    FREQUENCY_RANK: 1,
    ACTIVITY_METRIC: 'centroid', // 'iou' or 'centroid'
    PROXIMITY_METRIC: 'edge', // 'edge' or 'centroid'
    LINE_WIDTH: 3,
    CIRCLE_SEGMENTS: 16,
    MAX_ERRORS: 100
};

// Canvas and rendering constants
export const RENDERING = {
    WEBGL_LINE_WIDTH: 2.0,
    POINT_SIZE: 6.0,
    HEATMAP_DIVIDER_COLOR: '#333',
    HEATMAP_DIVIDER_WIDTH: 2,
    POSITION_INDICATOR_COLOR: 'white',
    POSITION_INDICATOR_WIDTH: 2,
    FOURIER_BASELINE_COLOR: '#666',
    FOURIER_LINE_WIDTH: 2,
    TRAJECTORY_LINE_ALPHA: 0.8
};

// UI constants
export const UI = {
    ERROR_NOTIFICATION_DURATION: 5000, // milliseconds
    ERROR_NOTIFICATION_STYLE: {
        position: 'fixed',
        top: '20px',
        right: '20px',
        backgroundColor: '#f44336',
        color: 'white',
        padding: '16px',
        borderRadius: '4px',
        boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
        zIndex: 10000,
        maxWidth: '400px'
    }
};

// Detection parameters
export const DETECTION = {
    MIN_DETECTION_CONFIDENCE: 0.5,
    DEFAULT_HERTZ: 10
};

// Analysis parameters
export const ANALYSIS = {
    GAUSSIAN_SIGMA_SECONDS: 4, // For smoothing activity data
    MAX_TRAJECTORY_POINTS: 500,
    FFT_TOP_FREQUENCIES: 5
};

// File upload constants
export const FILE_UPLOAD = {
    ACCEPTED_VIDEO_TYPES: ['.mp4', '.mov', '.avi', '.webm'],
    ACCEPTED_DATA_TYPES: ['.json'],
    MAX_FILE_SIZE: 8 * 1024 * 1024 * 1024 // 8GB
};

// WebGL shader sources
export const SHADERS = {
    VERTEX_BASIC: `
        attribute vec2 a_position;
        uniform vec2 u_resolution;
        
        void main() {
            vec2 clipSpace = ((a_position / u_resolution) * 2.0) - 1.0;
            gl_Position = vec4(clipSpace * vec2(1, -1), 0, 1);
        }
    `,
    
    FRAGMENT_BASIC: `
        precision mediump float;
        uniform vec4 u_color;
        
        void main() {
            gl_FragColor = u_color;
        }
    `,
    
    VERTEX_TRAJECTORY: `
        attribute vec2 a_position;
        attribute vec4 a_color;
        uniform vec2 u_resolution;
        varying vec4 v_color;
        
        void main() {
            vec2 clipSpace = ((a_position / u_resolution) * 2.0) - 1.0;
            gl_Position = vec4(clipSpace * vec2(1, -1), 0, 1);
            gl_PointSize = ${RENDERING.POINT_SIZE}.0;
            v_color = a_color;
        }
    `,
    
    FRAGMENT_TRAJECTORY_LINE: `
        precision mediump float;
        varying vec4 v_color;
        
        void main() {
            gl_FragColor = v_color;
        }
    `,
    
    FRAGMENT_TRAJECTORY_POINT: `
        precision mediump float;
        varying vec4 v_color;
        
        void main() {
            vec2 coord = gl_PointCoord - vec2(0.5);
            float dist = length(coord);
            if (dist > 0.5) {
                discard;
            }
            gl_FragColor = v_color;
        }
    `,
    
    VERTEX_HEATMAP: `
        attribute vec2 a_position;
        attribute vec2 a_texCoord;
        uniform vec2 u_resolution;
        varying vec2 v_texCoord;
        
        void main() {
            vec2 clipSpace = ((a_position / u_resolution) * 2.0) - 1.0;
            gl_Position = vec4(clipSpace * vec2(1, -1), 0, 1);
            v_texCoord = a_texCoord;
        }
    `,
    
    FRAGMENT_HEATMAP: `
        precision mediump float;
        uniform sampler2D u_heatmap;
        uniform float u_opacity;
        uniform float u_useViridis;
        varying vec2 v_texCoord;
        
        // Viridis colormap approximation
        vec3 viridis(float t) {
            const vec3 c0 = vec3(0.26, 0.0, 0.33);
            const vec3 c1 = vec3(0.13, 0.57, 0.55);
            const vec3 c2 = vec3(0.99, 0.91, 0.13);
            
            if (t < 0.5) {
                return mix(c0, c1, t * 2.0);
            } else {
                return mix(c1, c2, (t - 0.5) * 2.0);
            }
        }
        void main() {
            float value = texture2D(u_heatmap, v_texCoord).r;
            vec3 color;
            if (u_useViridis > 0.5) {
                color = viridis(value);
            } else {
                color = mix(vec3(1.0), vec3(0.0, 0.0, 0.7), sqrt(value)); // From white to blue
            }
            gl_FragColor = vec4(color, u_opacity);
        }
    `
};

// Quick load video paths
export const QUICK_LOAD_VIDEOS = {
    MVI_0020: {
        video: '/octovids/MVI_0020.mp4',
        data: '/octovids/MVI_0020_proxy_octopus_tracked.json',
        label: 'MVI_0020'
    },
    MVI_0022: {
        video: '/octovids/MVI_0022.mp4',
        data: '/octovids/MVI_0022_proxy_octopus_tracked.json',
        label: 'MVI_0022'
    },
    MVI_0601: {
        video: '/octovids/MVI_0601.mp4',
        data: '/octovids/MVI_0601_proxy_octopus_tracked.json',
        label: 'MVI_0601'
    },
    MVI_0603: {
        video: '/octovids/MVI_0603.mp4',
        data: '/octovids/MVI_0603_proxy_octopus_tracked.json',
        label: 'MVI_0603'
    }
};