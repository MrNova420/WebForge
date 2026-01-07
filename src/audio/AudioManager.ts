/**
 * AudioManager.ts - Central audio management system
 * 
 * Manages the overall audio system, including context, buffers, sources,
 * and audio groups/buses.
 */

import { WebForgeAudioContext } from './AudioContext';
import { AudioBufferManager } from './AudioBuffer';
import { AudioSource, AudioSourceConfig } from './AudioSource';
import { EventSystem } from '../core/EventSystem';

/**
 * Audio group/bus for organizing audio
 */
export class AudioGroup {
    private name: string;
    private gainNode: GainNode;
    private _volume: number = 1.0;
    private _muted: boolean = false;
    private sources: Set<AudioSource> = new Set();

    constructor(name: string, audioContext: WebForgeAudioContext, parent: GainNode) {
        this.name = name;
        this.gainNode = audioContext.createGain();
        this.gainNode.connect(parent);
    }

    /**
     * Get the gain node
     */
    public getGainNode(): GainNode {
        return this.gainNode;
    }

    /**
     * Add source to group
     */
    public addSource(source: AudioSource): void {
        this.sources.add(source);
    }

    /**
     * Remove source from group
     */
    public removeSource(source: AudioSource): void {
        this.sources.delete(source);
    }

    /**
     * Set volume
     */
    public setVolume(volume: number): void {
        this._volume = Math.max(0, Math.min(1, volume));
        if (!this._muted) {
            this.gainNode.gain.value = this._volume;
        }
    }

    /**
     * Get volume
     */
    public getVolume(): number {
        return this._volume;
    }

    /**
     * Mute the group
     */
    public mute(): void {
        this._muted = true;
        this.gainNode.gain.value = 0;
    }

    /**
     * Unmute the group
     */
    public unmute(): void {
        this._muted = false;
        this.gainNode.gain.value = this._volume;
    }

    /**
     * Check if muted
     */
    public isMuted(): boolean {
        return this._muted;
    }

    /**
     * Stop all sources in group
     */
    public stopAll(): void {
        for (const source of this.sources) {
            source.stop();
        }
    }

    /**
     * Get source count
     */
    public getSourceCount(): number {
        return this.sources.size;
    }

    /**
     * Get name
     */
    public getName(): string {
        return this.name;
    }
}

/**
 * Audio manager configuration
 */
export interface AudioManagerConfig {
    /** Sample rate (default: 44100) */
    sampleRate?: number;
    /** Latency hint */
    latencyHint?: 'interactive' | 'balanced' | 'playback';
    /** Master volume (0-1) */
    masterVolume?: number;
    /** Default groups to create */
    defaultGroups?: string[];
}

/**
 * Central audio management system
 * 
 * Provides a high-level API for managing all audio in the engine,
 * including context, buffers, sources, and audio groups.
 */
export class AudioManager {
    private audioContext: WebForgeAudioContext;
    private bufferManager: AudioBufferManager;
    private groups: Map<string, AudioGroup> = new Map();
    private sources: Set<AudioSource> = new Set();
    private events: EventSystem;
    private initialized: boolean = false;

    constructor(config: AudioManagerConfig = {}) {
        this.events = new EventSystem();

        // Create audio context
        this.audioContext = new WebForgeAudioContext({
            sampleRate: config.sampleRate,
            latencyHint: config.latencyHint,
            masterVolume: config.masterVolume
        });

        // Create buffer manager
        this.bufferManager = new AudioBufferManager(this.audioContext);

        // Create default groups
        const defaultGroups = config.defaultGroups ?? ['music', 'sfx', 'voice', 'ambient'];
        for (const groupName of defaultGroups) {
            this.createGroup(groupName);
        }
    }

    /**
     * Initialize the audio manager
     * 
     * Must be called after user interaction due to browser policies.
     */
    public initialize(): boolean {
        if (this.initialized) {
            return true;
        }

        const success = this.audioContext.initialize();
        if (success) {
            this.initialized = true;
            this.events.emit('initialized', {});
        }
        return success;
    }

    /**
     * Resume audio context
     */
    public async resume(): Promise<void> {
        await this.audioContext.resume();
        this.events.emit('resumed', {});
    }

    /**
     * Suspend audio context
     */
    public async suspend(): Promise<void> {
        await this.audioContext.suspend();
        this.events.emit('suspended', {});
    }

    /**
     * Create an audio group/bus
     */
    public createGroup(name: string): AudioGroup {
        if (this.groups.has(name)) {
            return this.groups.get(name)!;
        }

        const group = new AudioGroup(name, this.audioContext, this.audioContext.getMasterGain());
        this.groups.set(name, group);
        return group;
    }

    /**
     * Get an audio group
     */
    public getGroup(name: string): AudioGroup | undefined {
        return this.groups.get(name);
    }

    /**
     * Delete an audio group
     */
    public deleteGroup(name: string): void {
        const group = this.groups.get(name);
        if (group) {
            group.stopAll();
            this.groups.delete(name);
        }
    }

    /**
     * Load an audio file
     */
    public async loadAudio(url: string): Promise<AudioBuffer> {
        return this.bufferManager.load(url);
    }

    /**
     * Load multiple audio files
     */
    public async loadMultiple(urls: string[]): Promise<Map<string, AudioBuffer>> {
        return this.bufferManager.loadMultiple(urls);
    }

    /**
     * Create an audio source
     */
    public createSource(config: AudioSourceConfig, groupName?: string): AudioSource {
        const source = new AudioSource(this.audioContext, config);

        // Add to group if specified
        if (groupName) {
            const group = this.getGroup(groupName);
            if (group) {
                group.addSource(source);
            }
        }

        this.sources.add(source);

        // Clean up when source ends
        source.getEvents().on('ended', () => {
            this.sources.delete(source);
        });

        return source;
    }

    /**
     * Play a sound from URL
     */
    public async playSound(
        url: string,
        groupName?: string,
        volume?: number
    ): Promise<AudioSource> {
        const buffer = await this.loadAudio(url);
        return this.createSource({
            buffer,
            volume,
            autoplay: true
        }, groupName);
    }

    /**
     * Play a one-shot sound
     */
    public async playOneShot(
        url: string,
        groupName?: string,
        volume: number = 1.0
    ): Promise<void> {
        const source = await this.playSound(url, groupName, volume);

        // Auto-destroy when finished
        source.getEvents().on('ended', () => {
            source.destroy();
        });
    }

    /**
     * Stop all audio
     */
    public stopAll(): void {
        for (const source of this.sources) {
            source.stop();
        }
    }

    /**
     * Set master volume
     */
    public setMasterVolume(volume: number): void {
        this.audioContext.setMasterVolume(volume);
    }

    /**
     * Get master volume
     */
    public getMasterVolume(): number {
        return this.audioContext.getMasterVolume();
    }

    /**
     * Mute all audio
     */
    public muteAll(): void {
        this.audioContext.setMasterVolume(0);
    }

    /**
     * Unmute all audio
     */
    public unmuteAll(): void {
        this.audioContext.setMasterVolume(1);
    }

    /**
     * Get audio context
     */
    public getAudioContext(): WebForgeAudioContext {
        return this.audioContext;
    }

    /**
     * Get buffer manager
     */
    public getBufferManager(): AudioBufferManager {
        return this.bufferManager;
    }

    /**
     * Get event system
     */
    public getEvents(): EventSystem {
        return this.events;
    }

    /**
     * Get statistics
     */
    public getStats() {
        return {
            initialized: this.initialized,
            running: this.audioContext.isRunning(),
            activeSources: this.sources.size,
            cachedBuffers: this.bufferManager.getBufferCount(),
            memoryUsage: this.bufferManager.getMemoryUsage(),
            groups: this.groups.size,
            sampleRate: this.audioContext.getSampleRate()
        };
    }

    /**
     * Cleanup and destroy
     */
    public async destroy(): Promise<void> {
        this.stopAll();
        this.bufferManager.clear();
        await this.audioContext.close();
        this.events.clear();
        this.groups.clear();
        this.sources.clear();
        this.initialized = false;
    }
}
