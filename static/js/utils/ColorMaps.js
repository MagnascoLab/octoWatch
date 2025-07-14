/**
 * ColorMaps - Color mapping utilities for visualization
 * Provides various color mapping functions for data visualization
 */

/**
 * Viridis colormap approximation
 * Maps a value from 0-1 to a color in the viridis colormap
 * @param {number} value - Value between 0 and 1
 * @returns {number[]} RGB color array [r, g, b] with values 0-255
 */
export function viridis(value) {
    // Normalize value to 0-1
    const t = Math.max(0, Math.min(1, value));

    // Viridis color points
    const colors = [
        [68, 1, 84],    // 0.0 - dark purple
        [71, 44, 122],  // 0.1
        [59, 81, 139],  // 0.2
        [44, 113, 142], // 0.3
        [33, 144, 141], // 0.4
        [39, 173, 129], // 0.5
        [92, 200, 99],  // 0.6
        [170, 220, 50], // 0.7
        [253, 231, 37]  // 1.0 - bright yellow
    ];

    // Find which two colors to interpolate between
    const scaledT = t * (colors.length - 1);
    const idx = Math.floor(scaledT);
    const f = scaledT - idx;

    if (idx >= colors.length - 1) {
        return colors[colors.length - 1];
    }

    // Linear interpolation between colors
    const c1 = colors[idx];
    const c2 = colors[idx + 1];

    return [
        Math.round(c1[0] + (c2[0] - c1[0]) * f),
        Math.round(c1[1] + (c2[1] - c1[1]) * f),
        Math.round(c1[2] + (c2[2] - c1[2]) * f)
    ];
}

/**
 * Black to red colormap for proximity visualization
 * Maps a value from 0-1 to a color between black and red
 * @param {number} value - Value between 0 and 1
 * @returns {number[]} RGB color array [r, g, b] with values 0-255
 */
export function blackRed(value) {
    // Normalize value to 0-1
    const t = Math.max(0, Math.min(1, value));
    
    // Interpolate from black (0,0,0) to red (255,0,0)
    const r = Math.round(255 * t * t); // Quadratic for more contrast
    const g = 0;
    const b = 0;
    
    return [r, g, b];
}

export function redGreen(v1, v2) {
    const u = Math.max(0, Math.min(1, v1));
    const v = Math.max(0, Math.min(1, v2));
    const r = Math.round(255 * u * u); // Quadratic for more contrast
    const g = Math.round(255 * v * v); // Quadratic for more contrast
    const b = 0; // No blue component
    return [r, g, 0];
}

/**
 * Interpolate color based on progress (for trajectory visualization)
 * Uses HSL color space to create a rainbow gradient
 * @param {number} progress - Progress value between 0 and 1
 * @returns {number[]} RGBA color array [r, g, b, a] with values 0-1
 */
export function interpolateTrajectoryColor(progress) {
    // Use HSL color space to create rainbow gradient
    // Hue goes from 0 (red) to 270 (purple)
    const hue = progress * 270;
    const saturation = 1.0;
    const lightness = 0.5;
    
    // Convert HSL to RGB
    const c = (1 - Math.abs(2 * lightness - 1)) * saturation;
    const x = c * (1 - Math.abs((hue / 60) % 2 - 1));
    const m = lightness - c / 2;
    
    let r, g, b;
    
    if (hue >= 0 && hue < 60) {
        r = c; g = x; b = 0;
    } else if (hue >= 60 && hue < 120) {
        r = x; g = c; b = 0;
    } else if (hue >= 120 && hue < 180) {
        r = 0; g = c; b = x;
    } else if (hue >= 180 && hue < 240) {
        r = 0; g = x; b = c;
    } else if (hue >= 240 && hue < 300) {
        r = x; g = 0; b = c;
    } else {
        r = c; g = 0; b = x;
    }
    
    // Return RGBA values (0-1 range for WebGL)
    return [r + m, g + m, b + m, 0.8];
}

/**
 * Get CSS color string from colormap
 * @param {string} colormap - Colormap name ('viridis' or 'blackRed')
 * @param {number} value - Value between 0 and 1
 * @returns {string} CSS color string
 */
export function getColorString(colormap, value) {
    let color;
    
    switch (colormap) {
        case 'viridis':
            color = viridis(value);
            break;
        case 'blackRed':
            color = blackRed(value);
            break;
        default:
            color = [128, 128, 128]; // Gray fallback
    }
    
    return `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
}

/**
 * Get stroke color for sinusoid overlay
 * @param {string} colormap - Colormap name
 * @returns {string} CSS color string
 */
export function getSinusoidColor(colormap) {
    return colormap === 'blackRed' ? '#ff0000' : '#00ff00';
}