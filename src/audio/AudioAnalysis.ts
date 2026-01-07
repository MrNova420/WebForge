/**
 * Audio Analysis System
 * Provides FFT analysis, waveform visualization, and audio feature detection
 */

import { WebForgeAudioContext } from './AudioContext';

/**
 * Audio analyzer for frequency and waveform analysis
 */
export class AudioAnalyzer {
    private context: WebForgeAudioContext;
    private analyser: AnalyserNode;
    private inputNode: GainNode;
    
    constructor(context: WebForgeAudioContext, fftSize: number = 2048) {
        this.context = context;
        const ctx = context.getContext();
        
        this.analyser = ctx.createAnalyser();
        this.analyser.fftSize = fftSize;
        this.analyser.smoothingTimeConstant = 0.8;
        
        this.inputNode = ctx.createGain();
        this.inputNode.connect(this.analyser);
    }
    
    /**
     * Get input node to connect audio source
     */
    getInput(): AudioNode {
        return this.inputNode;
    }
    
    /**
     * Get the analyser node
     */
    getAnalyser(): AnalyserNode {
        return this.analyser;
    }
    
    /**
     * Set FFT size (must be power of 2: 32-32768)
     */
    setFFTSize(size: number): void {
        this.analyser.fftSize = size;
    }
    
    /**
     * Set smoothing time constant (0-1)
     */
    setSmoothing(value: number): void {
        this.analyser.smoothingTimeConstant = Math.max(0, Math.min(1, value));
    }
    
    /**
     * Get frequency data (0-255 values)
     */
    getFrequencyData(): Uint8Array {
        const data = new Uint8Array(this.analyser.frequencyBinCount);
        this.analyser.getByteFrequencyData(data);
        return data;
    }
    
    /**
     * Get time domain data (waveform) (0-255 values)
     */
    getTimeDomainData(): Uint8Array {
        const data = new Uint8Array(this.analyser.fftSize);
        this.analyser.getByteTimeDomainData(data);
        return data;
    }
    
    /**
     * Get frequency data as float array (-Infinity to 0 dB)
     */
    getFrequencyDataFloat(): Float32Array {
        const data = new Float32Array(this.analyser.frequencyBinCount);
        this.analyser.getFloatFrequencyData(data);
        return data;
    }
    
    /**
     * Get time domain data as float array (-1 to 1)
     */
    getTimeDomainDataFloat(): Float32Array {
        const data = new Float32Array(this.analyser.fftSize);
        this.analyser.getFloatTimeDomainData(data);
        return data;
    }
    
    /**
     * Get average frequency across all bins
     */
    getAverageFrequency(): number {
        const data = this.getFrequencyData();
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
            sum += data[i];
        }
        return sum / data.length;
    }
    
    /**
     * Get frequency in a specific range (Hz)
     */
    getFrequencyRange(minFreq: number, maxFreq: number): number {
        const data = this.getFrequencyData();
        const sampleRate = this.context.getContext().sampleRate;
        const nyquist = sampleRate / 2;
        const binCount = this.analyser.frequencyBinCount;
        
        const minBin = Math.floor((minFreq / nyquist) * binCount);
        const maxBin = Math.ceil((maxFreq / nyquist) * binCount);
        
        let sum = 0;
        let count = 0;
        
        for (let i = minBin; i <= maxBin && i < data.length; i++) {
            sum += data[i];
            count++;
        }
        
        return count > 0 ? sum / count : 0;
    }
    
    /**
     * Get bass level (20-250 Hz)
     */
    getBass(): number {
        return this.getFrequencyRange(20, 250);
    }
    
    /**
     * Get mid level (250-4000 Hz)
     */
    getMid(): number {
        return this.getFrequencyRange(250, 4000);
    }
    
    /**
     * Get treble level (4000-20000 Hz)
     */
    getTreble(): number {
        return this.getFrequencyRange(4000, 20000);
    }
    
    /**
     * Get peak frequency
     */
    getPeakFrequency(): number {
        const data = this.getFrequencyData();
        let maxValue = 0;
        let maxIndex = 0;
        
        for (let i = 0; i < data.length; i++) {
            if (data[i] > maxValue) {
                maxValue = data[i];
                maxIndex = i;
            }
        }
        
        const sampleRate = this.context.getContext().sampleRate;
        const nyquist = sampleRate / 2;
        return (maxIndex / data.length) * nyquist;
    }
    
    /**
     * Detect beat (simple energy-based detection)
     */
    detectBeat(threshold: number = 200): boolean {
        return this.getAverageFrequency() > threshold;
    }
    
    /**
     * Get RMS (Root Mean Square) level
     */
    getRMS(): number {
        const data = this.getTimeDomainDataFloat();
        let sum = 0;
        
        for (let i = 0; i < data.length; i++) {
            sum += data[i] * data[i];
        }
        
        return Math.sqrt(sum / data.length);
    }
    
    /**
     * Dispose of the analyzer
     */
    dispose(): void {
        this.inputNode.disconnect();
        this.analyser.disconnect();
    }
}

/**
 * Waveform visualizer
 */
export class WaveformVisualizer {
    private analyzer: AudioAnalyzer;
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private animationId: number = 0;
    private isRunning: boolean = false;
    
    constructor(analyzer: AudioAnalyzer, canvas: HTMLCanvasElement) {
        this.analyzer = analyzer;
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d')!;
    }
    
    /**
     * Start rendering waveform
     */
    start(): void {
        if (this.isRunning) return;
        
        this.isRunning = true;
        this.render();
    }
    
    /**
     * Stop rendering waveform
     */
    stop(): void {
        this.isRunning = false;
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = 0;
        }
    }
    
    /**
     * Render waveform
     */
    private render = (): void => {
        if (!this.isRunning) return;
        
        this.animationId = requestAnimationFrame(this.render);
        
        const data = this.analyzer.getTimeDomainData();
        const width = this.canvas.width;
        const height = this.canvas.height;
        
        // Clear canvas
        this.ctx.fillStyle = 'rgb(0, 0, 0)';
        this.ctx.fillRect(0, 0, width, height);
        
        // Draw waveform
        this.ctx.lineWidth = 2;
        this.ctx.strokeStyle = 'rgb(0, 255, 0)';
        this.ctx.beginPath();
        
        const sliceWidth = width / data.length;
        let x = 0;
        
        for (let i = 0; i < data.length; i++) {
            const v = data[i] / 128.0; // Normalize to 0-2
            const y = (v * height) / 2;
            
            if (i === 0) {
                this.ctx.moveTo(x, y);
            } else {
                this.ctx.lineTo(x, y);
            }
            
            x += sliceWidth;
        }
        
        this.ctx.lineTo(width, height / 2);
        this.ctx.stroke();
    };
}

/**
 * Frequency spectrum visualizer
 */
export class SpectrumVisualizer {
    private analyzer: AudioAnalyzer;
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private animationId: number = 0;
    private isRunning: boolean = false;
    private barColor: string = 'rgb(0, 255, 0)';
    
    constructor(analyzer: AudioAnalyzer, canvas: HTMLCanvasElement) {
        this.analyzer = analyzer;
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d')!;
    }
    
    /**
     * Set bar color
     */
    setBarColor(color: string): void {
        this.barColor = color;
    }
    
    /**
     * Start rendering spectrum
     */
    start(): void {
        if (this.isRunning) return;
        
        this.isRunning = true;
        this.render();
    }
    
    /**
     * Stop rendering spectrum
     */
    stop(): void {
        this.isRunning = false;
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = 0;
        }
    }
    
    /**
     * Render spectrum
     */
    private render = (): void => {
        if (!this.isRunning) return;
        
        this.animationId = requestAnimationFrame(this.render);
        
        const data = this.analyzer.getFrequencyData();
        const width = this.canvas.width;
        const height = this.canvas.height;
        
        // Clear canvas
        this.ctx.fillStyle = 'rgb(0, 0, 0)';
        this.ctx.fillRect(0, 0, width, height);
        
        // Draw bars
        const barWidth = width / data.length;
        let x = 0;
        
        for (let i = 0; i < data.length; i++) {
            const barHeight = (data[i] / 255) * height;
            
            this.ctx.fillStyle = this.barColor;
            this.ctx.fillRect(x, height - barHeight, barWidth, barHeight);
            
            x += barWidth;
        }
    };
}
