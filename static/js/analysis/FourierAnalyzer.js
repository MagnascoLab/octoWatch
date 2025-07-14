/**
 * FourierAnalyzer - Performs Fourier analysis on activity and proximity data
 * Identifies dominant frequencies in octopus movement patterns
 */
import { Events } from '../utils/EventBus.js';
import { ANALYSIS } from '../utils/Constants.js';

export class FourierAnalyzer {
    /**
     * Create a FourierAnalyzer
     * @param {EventBus} eventBus - Central event system
     */
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.topFrequencies = null;
        this.fftInstance = null;
        
        this.setupEventListeners();
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        this.eventBus.on(Events.DATA_LOADED, (data) => {
            this.keyframesData = data.keyframesData;
            // Reset Fourier analysis when new data is loaded
            this.topFrequencies = null;
        });
    }

    /**
     * Compute FFT using fft.js library
     * @param {Float32Array} signal - Input signal
     * @returns {Float32Array} Magnitude spectrum
     */
    computeFFT(signal) {
        const N = signal.length;
        // Pad to next power of 2
        const n = Math.pow(2, Math.ceil(Math.log2(N)));
        const padded = new Array(n);
        
        for (let i = 0; i < N; i++) {
            padded[i] = signal[i];
        }
        for (let i = N; i < n; i++) {
            padded[i] = 0;
        }
        
        // Create FFT instance if needed
        if (!this.fftInstance || this.fftInstance.size !== n) {
            this.fftInstance = new FFT(n);
        }
        
        // Convert to complex array format expected by fft.js
        const complex = this.fftInstance.toComplexArray(padded);
        const output = this.fftInstance.createComplexArray();
        
        // Perform FFT
        this.fftInstance.transform(output, complex);
        
        // Compute magnitude spectrum
        const magnitude = new Float32Array(n / 2);
        for (let i = 0; i < n / 2; i++) {
            const real = output[i * 2];
            const imag = output[i * 2 + 1];
            magnitude[i] = Math.sqrt(real * real + imag * imag) / n;
        }
        
        return magnitude;
    }

    /**
     * Compute FFT with both magnitude and phase
     * @param {Float32Array} signalData - Input signal
     * @returns {Array} Array of frequency data objects
     */
    computeFFTWithPhase(signalData) {
        if (!this.keyframesData) {
            throw new Error('No keyframes data loaded');
        }

        const fps = this.keyframesData.video_info.fps;
        const nyquist = fps / 2;
        
        const N = signalData.length;
        const n = Math.pow(2, Math.ceil(Math.log2(N)));
        const padded = new Array(n);
        
        for (let i = 0; i < N; i++) {
            padded[i] = signalData[i];
        }
        for (let i = N; i < n; i++) {
            padded[i] = 0;
        }
        
        // Create FFT instance if needed
        if (!this.fftInstance || this.fftInstance.size !== n) {
            this.fftInstance = new FFT(n);
        }
        
        const complex = this.fftInstance.toComplexArray(padded);
        const output = this.fftInstance.createComplexArray();
        
        // Perform FFT
        this.fftInstance.transform(output, complex);
        
        // Extract magnitude and phase for each frequency
        const result = [];
        const freqResolution = nyquist / (n / 2);
        
        for (let i = 0; i < n / 2; i++) {
            const real = output[i * 2];
            const imag = output[i * 2 + 1];
            const magnitude = Math.sqrt(real * real + imag * imag) / n;
            const phase = Math.atan2(imag, real);
            const frequency = i * freqResolution;
            
            result.push({
                frequency,
                magnitude,
                phase
            });
        }
        
        return result;
    }

    /**
     * Find top frequencies in FFT data
     * @param {Array} fftData - FFT data with frequency, magnitude, and phase
     * @returns {Array} Top frequency components
     */
    findTopFrequencies(fftData) {
        // Filter to frequencies up to 2 Hz, skip DC component
        const filtered = fftData.slice(1).filter(f => f.frequency <= 2.0);
        
        // Sort by magnitude and take top frequencies
        filtered.sort((a, b) => b.magnitude - a.magnitude);
        return filtered.slice(0, ANALYSIS.FFT_TOP_FREQUENCIES);
    }

    /**
     * Compute top frequencies for all signals
     * @param {Object} activityData - Activity data from ActivityAnalyzer
     * @param {Object} proximityData - Proximity data from ProximityAnalyzer
     * @returns {Object} Top frequencies for each signal
     */
    computeTopFrequencies(activityData, proximityData) {
        if (!activityData || !proximityData) {
            throw new Error('Activity and proximity data required');
        }

        // Compute FFT with phase for all signals
        const leftProxFFT = this.computeFFTWithPhase(proximityData.leftProximityData);
        const rightProxFFT = this.computeFFTWithPhase(proximityData.rightProximityData);
        const leftActFFT = this.computeFFTWithPhase(activityData.leftActivityData);
        const rightActFFT = this.computeFFTWithPhase(activityData.rightActivityData);
        
        // Find top frequencies for each signal
        this.topFrequencies = {
            leftProx: this.findTopFrequencies(leftProxFFT),
            rightProx: this.findTopFrequencies(rightProxFFT),
            leftAct: this.findTopFrequencies(leftActFFT),
            rightAct: this.findTopFrequencies(rightActFFT)
        };

        // Emit event
        this.eventBus.emit(Events.FOURIER_CALCULATED, this.topFrequencies);

        return this.topFrequencies;
    }

    /**
     * Generate sinusoid for a frequency component
     * @param {Object} freqData - Frequency data {frequency, magnitude, phase}
     * @param {number} totalFrames - Total number of frames
     * @param {number} fps - Frames per second
     * @returns {Array} Sinusoid values
     */
    generateSinusoid(freqData, totalFrames, fps) {
        if (!freqData) return null;

        const values = [];
        for (let frame = 0; frame < totalFrames; frame++) {
            const time = frame / fps;
            
            // Generate sinusoid: A * sin(2π * f * t + φ)
            const value = freqData.magnitude * Math.sin(2 * Math.PI * freqData.frequency * time + freqData.phase);
            
            // Normalize to 0-1 range
            const normalized = (value + freqData.magnitude) / (2 * freqData.magnitude);
            values.push(normalized);
        }

        return values;
    }

    /**
     * Get frequency data for specific rank
     * @param {number} rank - Frequency rank (1-based)
     * @returns {Object} Frequency data for each signal
     */
    getFrequencyByRank(rank) {
        if (!this.topFrequencies) return null;

        const rankIdx = rank - 1;
        return {
            leftProx: this.topFrequencies.leftProx[rankIdx] || null,
            rightProx: this.topFrequencies.rightProx[rankIdx] || null,
            leftAct: this.topFrequencies.leftAct[rankIdx] || null,
            rightAct: this.topFrequencies.rightAct[rankIdx] || null
        };
    }

    /**
     * Get current top frequencies
     * @returns {Object} Top frequencies data
     */
    getTopFrequencies() {
        return this.topFrequencies;
    }

    /**
     * Clear analysis data
     */
    clear() {
        this.topFrequencies = null;
    }
}