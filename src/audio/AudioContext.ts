/**
 * AudioContext.ts - Web Audio API integration and management
 * 
 * Wraps the Web Audio API to provide a simplified interface for audio playback,
 * spatial audio, and effects processing.
 */

/**
 * Audio context configuration options
 */
export interface AudioContextConfig {
    /** Sample rate in Hz (default: 44100) */
    sampleRate?: number;
    /** Latency hint for performance tuning */
    latencyHint?: 'interactive' | 'balanced' | 'playback';
    /** Master volume (0-1) */
    masterVolume?: number;
}

/**
 * Audio output destination types
 */
export enum AudioDestination {
    /** Main audio output (speakers/headphones) */
    MASTER = 'master',
    /** Offline rendering for export */
    OFFLINE = 'offline'
}

/**
 * Main audio context manager
 * 
 * Handles the Web Audio API context lifecycle and provides
 * access to the audio graph for all audio sources and effects.
 */
export class WebForgeAudioContext {
    private context: AudioContext | null = null;
    private masterGainNode: GainNode | null = null;
    private suspended: boolean = true;
    private config: Required<AudioContextConfig>;

    constructor(config: AudioContextConfig = {}) {
        this.config = {
            sampleRate: config.sampleRate ?? 44100,
            latencyHint: config.latencyHint ?? 'interactive',
            masterVolume: config.masterVolume ?? 1.0
        };
    }

    /**
     * Initialize the audio context
     * 
     * Must be called after a user interaction due to browser autoplay policies.
     * 
     * @returns true if successfully initialized
     */
    public initialize(): boolean {
        if (this.context) {
            return true;
        }

        try {
            // Create audio context with configuration
            this.context = new (window.AudioContext || (window as any).webkitAudioContext)({
                sampleRate: this.config.sampleRate,
                latencyHint: this.config.latencyHint
            });

            // Create master gain node
            this.masterGainNode = this.context.createGain();
            this.masterGainNode.gain.value = this.config.masterVolume;
            this.masterGainNode.connect(this.context.destination);

            // Resume if it was auto-suspended
            if (this.context.state === 'suspended') {
                this.context.resume();
            }

            this.suspended = false;
            return true;
        } catch (error) {
            console.error('Failed to initialize audio context:', error);
            return false;
        }
    }

    /**
     * Resume audio context (required after user interaction)
     */
    public async resume(): Promise<void> {
        if (!this.context) {
            throw new Error('Audio context not initialized');
        }

        if (this.context.state === 'suspended') {
            await this.context.resume();
            this.suspended = false;
        }
    }

    /**
     * Suspend audio context to save resources
     */
    public async suspend(): Promise<void> {
        if (!this.context) {
            return;
        }

        if (this.context.state === 'running') {
            await this.context.suspend();
            this.suspended = true;
        }
    }

    /**
     * Close and cleanup audio context
     */
    public async close(): Promise<void> {
        if (this.context) {
            await this.context.close();
            this.context = null;
            this.masterGainNode = null;
            this.suspended = true;
        }
    }

    /**
     * Get the native Web Audio API context
     */
    public getContext(): AudioContext {
        if (!this.context) {
            throw new Error('Audio context not initialized. Call initialize() first.');
        }
        return this.context;
    }

    /**
     * Get the master gain node for connecting audio sources
     */
    public getMasterGain(): GainNode {
        if (!this.masterGainNode) {
            throw new Error('Audio context not initialized');
        }
        return this.masterGainNode;
    }

    /**
     * Get current audio time in seconds
     */
    public getCurrentTime(): number {
        return this.context?.currentTime ?? 0;
    }

    /**
     * Get sample rate
     */
    public getSampleRate(): number {
        return this.context?.sampleRate ?? this.config.sampleRate;
    }

    /**
     * Set master volume (0-1)
     */
    public setMasterVolume(volume: number): void {
        const clampedVolume = Math.max(0, Math.min(1, volume));
        this.config.masterVolume = clampedVolume;

        if (this.masterGainNode) {
            this.masterGainNode.gain.setValueAtTime(
                clampedVolume,
                this.getCurrentTime()
            );
        }
    }

    /**
     * Get master volume
     */
    public getMasterVolume(): number {
        return this.config.masterVolume;
    }

    /**
     * Check if audio context is running
     */
    public isRunning(): boolean {
        return this.context?.state === 'running';
    }

    /**
     * Check if audio context is suspended
     */
    public isSuspended(): boolean {
        return this.suspended || this.context?.state === 'suspended';
    }

    /**
     * Get audio context state
     */
    public getState(): AudioContextState {
        return this.context?.state ?? 'suspended';
    }

    /**
     * Create an oscillator node for testing/synthesis
     */
    public createOscillator(): OscillatorNode {
        if (!this.context) {
            throw new Error('Audio context not initialized');
        }
        return this.context.createOscillator();
    }

    /**
     * Create a gain node
     */
    public createGain(): GainNode {
        if (!this.context) {
            throw new Error('Audio context not initialized');
        }
        return this.context.createGain();
    }

    /**
     * Create a buffer source node
     */
    public createBufferSource(): AudioBufferSourceNode {
        if (!this.context) {
            throw new Error('Audio context not initialized');
        }
        return this.context.createBufferSource();
    }

    /**
     * Create a panner node for 3D spatial audio
     */
    public createPanner(): PannerNode {
        if (!this.context) {
            throw new Error('Audio context not initialized');
        }
        return this.context.createPanner();
    }

    /**
     * Create a convolver node for reverb effects
     */
    public createConvolver(): ConvolverNode {
        if (!this.context) {
            throw new Error('Audio context not initialized');
        }
        return this.context.createConvolver();
    }

    /**
     * Create a biquad filter node
     */
    public createBiquadFilter(): BiquadFilterNode {
        if (!this.context) {
            throw new Error('Audio context not initialized');
        }
        return this.context.createBiquadFilter();
    }

    /**
     * Create a delay node
     */
    public createDelay(maxDelayTime?: number): DelayNode {
        if (!this.context) {
            throw new Error('Audio context not initialized');
        }
        return this.context.createDelay(maxDelayTime);
    }

    /**
     * Create a dynamics compressor node
     */
    public createDynamicsCompressor(): DynamicsCompressorNode {
        if (!this.context) {
            throw new Error('Audio context not initialized');
        }
        return this.context.createDynamicsCompressor();
    }

    /**
     * Create an analyser node for visualization
     */
    public createAnalyser(): AnalyserNode {
        if (!this.context) {
            throw new Error('Audio context not initialized');
        }
        return this.context.createAnalyser();
    }

    /**
     * Decode audio data from an ArrayBuffer
     */
    public async decodeAudioData(arrayBuffer: ArrayBuffer): Promise<AudioBuffer> {
        if (!this.context) {
            throw new Error('Audio context not initialized');
        }
        return this.context.decodeAudioData(arrayBuffer);
    }

    /**
     * Create an empty audio buffer
     */
    public createBuffer(
        numberOfChannels: number,
        length: number,
        sampleRate: number
    ): AudioBuffer {
        if (!this.context) {
            throw new Error('Audio context not initialized');
        }
        return this.context.createBuffer(numberOfChannels, length, sampleRate);
    }
}
