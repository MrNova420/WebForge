/**
 * Audio Effects System
 * Implements various audio effects using Web Audio API nodes
 */

import { WebForgeAudioContext } from './AudioContext';

/**
 * Effect types available
 */
export enum EffectType {
    REVERB = 'reverb',
    DELAY = 'delay',
    EQUALIZER = 'equalizer',
    COMPRESSOR = 'compressor',
    DISTORTION = 'distortion',
    CHORUS = 'chorus',
    FILTER = 'filter'
}

/**
 * Base audio effect interface
 */
export interface IAudioEffect {
    readonly type: EffectType;
    connect(destination: AudioNode): void;
    disconnect(): void;
    bypass(enabled: boolean): void;
    dispose(): void;
    getInput(): AudioNode;
    getOutput(): AudioNode;
}

/**
 * Reverb effect using convolution
 */
export class ReverbEffect implements IAudioEffect {
    readonly type = EffectType.REVERB;
    
    private context: WebForgeAudioContext;
    private convolver: ConvolverNode;
    private wetGain: GainNode;
    private dryGain: GainNode;
    private inputNode: GainNode;
    private outputNode: GainNode;
    
    constructor(context: WebForgeAudioContext) {
        this.context = context;
        const ctx = context.getContext();
        
        // Create nodes
        this.convolver = ctx.createConvolver();
        this.wetGain = ctx.createGain();
        this.dryGain = ctx.createGain();
        this.inputNode = ctx.createGain();
        this.outputNode = ctx.createGain();
        
        // Default wet/dry mix (50/50)
        this.wetGain.gain.value = 0.5;
        this.dryGain.gain.value = 0.5;
        
        // Connect nodes
        this.inputNode.connect(this.convolver);
        this.convolver.connect(this.wetGain);
        this.wetGain.connect(this.outputNode);
        
        this.inputNode.connect(this.dryGain);
        this.dryGain.connect(this.outputNode);
    }
    
    /**
     * Set reverb impulse response buffer
     */
    setImpulseResponse(buffer: AudioBuffer): void {
        this.convolver.buffer = buffer;
    }
    
    /**
     * Set wet/dry mix (0 = dry, 1 = wet)
     */
    setMix(mix: number): void {
        const clampedMix = Math.max(0, Math.min(1, mix));
        this.wetGain.gain.value = clampedMix;
        this.dryGain.gain.value = 1 - clampedMix;
    }
    
    /**
     * Generate simple reverb impulse response
     */
    generateSimpleImpulse(duration: number = 2, decay: number = 2): AudioBuffer {
        const ctx = this.context.getContext();
        const sampleRate = ctx.sampleRate;
        const length = sampleRate * duration;
        const impulse = ctx.createBuffer(2, length, sampleRate);
        
        for (let channel = 0; channel < 2; channel++) {
            const channelData = impulse.getChannelData(channel);
            for (let i = 0; i < length; i++) {
                channelData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
            }
        }
        
        return impulse;
    }
    
    connect(destination: AudioNode): void {
        this.outputNode.connect(destination);
    }
    
    disconnect(): void {
        this.outputNode.disconnect();
    }
    
    bypass(enabled: boolean): void {
        if (enabled) {
            this.wetGain.gain.value = 0;
            this.dryGain.gain.value = 1;
        } else {
            // Restore previous mix
            this.setMix(0.5);
        }
    }
    
    getInput(): AudioNode {
        return this.inputNode;
    }
    
    getOutput(): AudioNode {
        return this.outputNode;
    }
    
    dispose(): void {
        this.disconnect();
        this.inputNode.disconnect();
        this.dryGain.disconnect();
        this.convolver.disconnect();
        this.wetGain.disconnect();
    }
}

/**
 * Delay effect
 */
export class DelayEffect implements IAudioEffect {
    readonly type = EffectType.DELAY;
    
    private delayNode: DelayNode;
    private feedbackGain: GainNode;
    private wetGain: GainNode;
    private dryGain: GainNode;
    private inputNode: GainNode;
    private outputNode: GainNode;
    
    constructor(context: WebForgeAudioContext, delayTime: number = 0.5, feedback: number = 0.5) {
        const ctx = context.getContext();
        
        // Create nodes
        this.delayNode = ctx.createDelay(5.0); // Max 5 seconds
        this.feedbackGain = ctx.createGain();
        this.wetGain = ctx.createGain();
        this.dryGain = ctx.createGain();
        this.inputNode = ctx.createGain();
        this.outputNode = ctx.createGain();
        
        // Set parameters
        this.delayNode.delayTime.value = delayTime;
        this.feedbackGain.gain.value = feedback;
        this.wetGain.gain.value = 0.5;
        this.dryGain.gain.value = 0.5;
        
        // Connect nodes: input -> delay -> feedback -> output
        this.inputNode.connect(this.delayNode);
        this.delayNode.connect(this.feedbackGain);
        this.feedbackGain.connect(this.delayNode); // Feedback loop
        this.delayNode.connect(this.wetGain);
        this.wetGain.connect(this.outputNode);
        
        // Dry path
        this.inputNode.connect(this.dryGain);
        this.dryGain.connect(this.outputNode);
    }
    
    /**
     * Set delay time in seconds
     */
    setDelayTime(time: number): void {
        this.delayNode.delayTime.value = Math.max(0, Math.min(5, time));
    }
    
    /**
     * Set feedback amount (0-1)
     */
    setFeedback(feedback: number): void {
        this.feedbackGain.gain.value = Math.max(0, Math.min(0.95, feedback));
    }
    
    /**
     * Set wet/dry mix
     */
    setMix(mix: number): void {
        const clampedMix = Math.max(0, Math.min(1, mix));
        this.wetGain.gain.value = clampedMix;
        this.dryGain.gain.value = 1 - clampedMix;
    }
    
    connect(destination: AudioNode): void {
        this.outputNode.connect(destination);
    }
    
    disconnect(): void {
        this.outputNode.disconnect();
    }
    
    bypass(enabled: boolean): void {
        if (enabled) {
            this.wetGain.gain.value = 0;
            this.dryGain.gain.value = 1;
        } else {
            this.setMix(0.5);
        }
    }
    
    getInput(): AudioNode {
        return this.inputNode;
    }
    
    getOutput(): AudioNode {
        return this.outputNode;
    }
    
    dispose(): void {
        this.disconnect();
        this.inputNode.disconnect();
        this.delayNode.disconnect();
        this.feedbackGain.disconnect();
        this.wetGain.disconnect();
        this.dryGain.disconnect();
    }
}

/**
 * 3-band equalizer
 */
export class EqualizerEffect implements IAudioEffect {
    readonly type = EffectType.EQUALIZER;
    
    private lowFilter: BiquadFilterNode;
    private midFilter: BiquadFilterNode;
    private highFilter: BiquadFilterNode;
    private inputNode: GainNode;
    private outputNode: GainNode;
    
    constructor(context: WebForgeAudioContext) {
        const ctx = context.getContext();
        
        // Create nodes
        this.inputNode = ctx.createGain();
        this.outputNode = ctx.createGain();
        
        // Low shelf filter (bass)
        this.lowFilter = ctx.createBiquadFilter();
        this.lowFilter.type = 'lowshelf';
        this.lowFilter.frequency.value = 250;
        this.lowFilter.gain.value = 0;
        
        // Peak filter (mid)
        this.midFilter = ctx.createBiquadFilter();
        this.midFilter.type = 'peaking';
        this.midFilter.frequency.value = 1000;
        this.midFilter.Q.value = 0.5;
        this.midFilter.gain.value = 0;
        
        // High shelf filter (treble)
        this.highFilter = ctx.createBiquadFilter();
        this.highFilter.type = 'highshelf';
        this.highFilter.frequency.value = 4000;
        this.highFilter.gain.value = 0;
        
        // Connect in series
        this.inputNode.connect(this.lowFilter);
        this.lowFilter.connect(this.midFilter);
        this.midFilter.connect(this.highFilter);
        this.highFilter.connect(this.outputNode);
    }
    
    /**
     * Set low frequency gain (-40 to +40 dB)
     */
    setLow(gain: number): void {
        this.lowFilter.gain.value = Math.max(-40, Math.min(40, gain));
    }
    
    /**
     * Set mid frequency gain (-40 to +40 dB)
     */
    setMid(gain: number): void {
        this.midFilter.gain.value = Math.max(-40, Math.min(40, gain));
    }
    
    /**
     * Set high frequency gain (-40 to +40 dB)
     */
    setHigh(gain: number): void {
        this.highFilter.gain.value = Math.max(-40, Math.min(40, gain));
    }
    
    /**
     * Set all bands at once
     */
    setBands(low: number, mid: number, high: number): void {
        this.setLow(low);
        this.setMid(mid);
        this.setHigh(high);
    }
    
    connect(destination: AudioNode): void {
        this.outputNode.connect(destination);
    }
    
    disconnect(): void {
        this.outputNode.disconnect();
    }
    
    bypass(enabled: boolean): void {
        if (enabled) {
            this.setBands(0, 0, 0);
        }
    }
    
    getInput(): AudioNode {
        return this.inputNode;
    }
    
    getOutput(): AudioNode {
        return this.outputNode;
    }
    
    dispose(): void {
        this.disconnect();
        this.inputNode.disconnect();
        this.lowFilter.disconnect();
        this.midFilter.disconnect();
        this.highFilter.disconnect();
    }
}

/**
 * Dynamics compressor effect
 */
export class CompressorEffect implements IAudioEffect {
    readonly type = EffectType.COMPRESSOR;
    
    private compressor: DynamicsCompressorNode;
    private inputNode: GainNode;
    private outputNode: GainNode;
    
    constructor(context: WebForgeAudioContext) {
        
        const ctx = context.getContext();
        
        this.inputNode = ctx.createGain();
        this.outputNode = ctx.createGain();
        this.compressor = ctx.createDynamicsCompressor();
        
        // Default settings
        this.compressor.threshold.value = -24;
        this.compressor.knee.value = 30;
        this.compressor.ratio.value = 12;
        this.compressor.attack.value = 0.003;
        this.compressor.release.value = 0.25;
        
        // Connect
        this.inputNode.connect(this.compressor);
        this.compressor.connect(this.outputNode);
    }
    
    /**
     * Set threshold (-100 to 0 dB)
     */
    setThreshold(value: number): void {
        this.compressor.threshold.value = Math.max(-100, Math.min(0, value));
    }
    
    /**
     * Set knee (0 to 40 dB)
     */
    setKnee(value: number): void {
        this.compressor.knee.value = Math.max(0, Math.min(40, value));
    }
    
    /**
     * Set ratio (1 to 20)
     */
    setRatio(value: number): void {
        this.compressor.ratio.value = Math.max(1, Math.min(20, value));
    }
    
    /**
     * Set attack time (0 to 1 seconds)
     */
    setAttack(value: number): void {
        this.compressor.attack.value = Math.max(0, Math.min(1, value));
    }
    
    /**
     * Set release time (0 to 1 seconds)
     */
    setRelease(value: number): void {
        this.compressor.release.value = Math.max(0, Math.min(1, value));
    }
    
    /**
     * Get current reduction in dB
     */
    getReduction(): number {
        return this.compressor.reduction;
    }
    
    connect(destination: AudioNode): void {
        this.outputNode.connect(destination);
    }
    
    disconnect(): void {
        this.outputNode.disconnect();
    }
    
    bypass(enabled: boolean): void {
        if (enabled) {
            this.inputNode.disconnect();
            this.inputNode.connect(this.outputNode);
        } else {
            this.inputNode.disconnect();
            this.inputNode.connect(this.compressor);
        }
    }
    
    getInput(): AudioNode {
        return this.inputNode;
    }
    
    getOutput(): AudioNode {
        return this.outputNode;
    }
    
    dispose(): void {
        this.disconnect();
        this.inputNode.disconnect();
        this.compressor.disconnect();
    }
}

/**
 * Audio effect chain manager
 */
export class EffectChain {
    private effects: IAudioEffect[] = [];
    private inputNode: GainNode;
    private outputNode: GainNode;
    
    constructor(context: WebForgeAudioContext) {
        
        const ctx = context.getContext();
        
        this.inputNode = ctx.createGain();
        this.outputNode = ctx.createGain();
        
        // Direct connection initially
        this.inputNode.connect(this.outputNode);
    }
    
    /**
     * Add effect to the chain
     */
    addEffect(effect: IAudioEffect): void {
        this.effects.push(effect);
        this.reconnect();
    }
    
    /**
     * Remove effect from the chain
     */
    removeEffect(effect: IAudioEffect): void {
        const index = this.effects.indexOf(effect);
        if (index !== -1) {
            this.effects.splice(index, 1);
            effect.dispose();
            this.reconnect();
        }
    }
    
    /**
     * Clear all effects
     */
    clearEffects(): void {
        this.effects.forEach(effect => effect.dispose());
        this.effects = [];
        this.reconnect();
    }
    
    /**
     * Get all effects
     */
    getEffects(): IAudioEffect[] {
        return [...this.effects];
    }
    
    /**
     * Reconnect the entire chain
     */
    private reconnect(): void {
        // Disconnect everything
        this.inputNode.disconnect();
        this.effects.forEach(effect => effect.disconnect());
        
        if (this.effects.length === 0) {
            // Direct connection
            this.inputNode.connect(this.outputNode);
        } else {
            // Chain effects
            this.inputNode.connect(this.effects[0].getInput());
            
            for (let i = 0; i < this.effects.length - 1; i++) {
                this.effects[i].getOutput().connect(this.effects[i + 1].getInput());
            }
            
            this.effects[this.effects.length - 1].getOutput().connect(this.outputNode);
        }
    }
    
    /**
     * Get input node
     */
    getInput(): AudioNode {
        return this.inputNode;
    }
    
    /**
     * Get output node
     */
    getOutput(): AudioNode {
        return this.outputNode;
    }
    
    /**
     * Connect chain output to destination
     */
    connect(destination: AudioNode): void {
        this.outputNode.connect(destination);
    }
    
    /**
     * Disconnect chain output
     */
    disconnect(): void {
        this.outputNode.disconnect();
    }
    
    /**
     * Dispose of the chain and all effects
     */
    dispose(): void {
        this.clearEffects();
        this.disconnect();
        this.inputNode.disconnect();
    }
}
