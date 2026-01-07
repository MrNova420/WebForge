/**
 * Music System
 * Handles music playback with crossfades and adaptive music layers
 */

import { EventSystem } from '../core/EventSystem';
import { AudioSource } from './AudioSource';
import { AudioBufferManager } from './AudioBuffer';
import { WebForgeAudioContext } from './AudioContext';

/**
 * Music track information
 */
export interface MusicTrack {
    url: string;
    name: string;
    loop?: boolean;
    volume?: number;
    bpm?: number;
    bars?: number;
}

/**
 * Music layer for adaptive music
 */
export interface MusicLayer {
    source: AudioSource;
    name: string;
    weight: number;
    fadeTime: number;
}

/**
 * Music system for managing game music with crossfades and layers
 */
export class MusicSystem {
    private context: WebForgeAudioContext;
    private bufferManager: AudioBufferManager;
    private events: EventSystem;
    
    private currentTrack: AudioSource | null = null;
    private currentTrackName: string = '';
    private layers: Map<string, MusicLayer> = new Map();
    private masterGain: GainNode;
    private isCrossfading: boolean = false;
    
    constructor(context: WebForgeAudioContext, bufferManager: AudioBufferManager) {
        this.context = context;
        this.bufferManager = bufferManager;
        this.events = new EventSystem();
        
        // Create master gain node for music
        const ctx = context.getContext();
        this.masterGain = ctx.createGain();
        this.masterGain.connect(ctx.destination);
    }
    
    /**
     * Get event system
     */
    getEvents(): EventSystem {
        return this.events;
    }
    
    /**
     * Play a music track
     */
    async playTrack(track: MusicTrack): Promise<AudioSource> {
        const buffer = await this.bufferManager.load(track.url);
        
        const source = new AudioSource(this.context, {
            buffer,
            volume: track.volume ?? 1.0,
            loop: track.loop ?? true,
            autoplay: true
        });
        
        this.currentTrack = source;
        this.currentTrackName = track.name;
        
        this.events.emit('trackStarted', { name: track.name });
        
        // Listen for track end
        source.getEvents().on('ended', () => {
            this.events.emit('trackEnded', { name: track.name });
        });
        
        return source;
    }
    
    /**
     * Crossfade to a new track
     */
    async crossfade(newTrack: MusicTrack, duration: number = 2.0): Promise<void> {
        if (this.isCrossfading) {
            return;
        }
        
        this.isCrossfading = true;
        const oldTrack = this.currentTrack;
        const oldName = this.currentTrackName;
        
        this.events.emit('crossfadeStarted', {
            from: oldName,
            to: newTrack.name,
            duration
        });
        
        // Load and play new track
        const newSource = await this.playTrack(newTrack);
        newSource.setVolume(0);
        
        // Fade out old, fade in new
        if (oldTrack) {
            oldTrack.fadeOut(duration);
            setTimeout(() => {
                oldTrack.stop();
            }, duration * 1000);
        }
        
        newSource.fadeIn(duration);
        
        setTimeout(() => {
            this.isCrossfading = false;
            this.events.emit('crossfadeCompleted', { name: newTrack.name });
        }, duration * 1000);
    }
    
    /**
     * Stop current track
     */
    stopTrack(fadeOut: number = 1.0): void {
        if (this.currentTrack) {
            if (fadeOut > 0) {
                this.currentTrack.fadeOut(fadeOut);
                setTimeout(() => {
                    if (this.currentTrack) {
                        this.currentTrack.stop();
                        this.currentTrack = null;
                        this.currentTrackName = '';
                    }
                }, fadeOut * 1000);
            } else {
                this.currentTrack.stop();
                this.currentTrack = null;
                this.currentTrackName = '';
            }
        }
    }
    
    /**
     * Add an adaptive music layer
     */
    async addLayer(name: string, url: string, weight: number = 0, fadeTime: number = 1.0): Promise<void> {
        const buffer = await this.bufferManager.load(url);
        
        const source = new AudioSource(this.context, {
            buffer,
            volume: weight,
            loop: true,
            autoplay: false
        });
        
        
        if (this.currentTrack) {
            const currentTime = this.currentTrack.getCurrentTime();
            source.play(currentTime);
        } else {
            source.play();
        }
        
        const layer: MusicLayer = {
            source,
            name,
            weight,
            fadeTime
        };
        
        this.layers.set(name, layer);
        this.events.emit('layerAdded', { name });
    }
    
    /**
     * Remove an adaptive music layer
     */
    removeLayer(name: string, fadeOut: number = 1.0): void {
        const layer = this.layers.get(name);
        if (layer) {
            if (fadeOut > 0) {
                layer.source.fadeOut(fadeOut);
                setTimeout(() => {
                    layer.source.stop();
                    this.layers.delete(name);
                    this.events.emit('layerRemoved', { name });
                }, fadeOut * 1000);
            } else {
                layer.source.stop();
                this.layers.delete(name);
                this.events.emit('layerRemoved', { name });
            }
        }
    }
    
    /**
     * Set layer weight (volume)
     */
    setLayerWeight(name: string, weight: number, fadeTime?: number): void {
        const layer = this.layers.get(name);
        if (layer) {
            const time = fadeTime ?? layer.fadeTime;
            layer.weight = weight;
            
            if (time > 0) {
                // Fade to new weight over time
                layer.source.setVolume(weight);
            } else {
                layer.source.setVolume(weight);
            }
        }
    }
    
    /**
     * Get all layers
     */
    getLayers(): Map<string, MusicLayer> {
        return new Map(this.layers);
    }
    
    /**
     * Get current track name
     */
    getCurrentTrackName(): string {
        return this.currentTrackName;
    }
    
    /**
     * Check if currently crossfading
     */
    isCrossfadingNow(): boolean {
        return this.isCrossfading;
    }
    
    /**
     * Set master music volume
     */
    setMasterVolume(volume: number): void {
        this.masterGain.gain.value = Math.max(0, Math.min(1, volume));
    }
    
    /**
     * Get master music volume
     */
    getMasterVolume(): number {
        return this.masterGain.gain.value;
    }
    
    /**
     * Pause all music
     */
    pause(): void {
        if (this.currentTrack) {
            this.currentTrack.pause();
        }
        this.layers.forEach(layer => layer.source.pause());
    }
    
    /**
     * Resume all music
     */
    resume(): void {
        if (this.currentTrack) {
            this.currentTrack.play();
        }
        this.layers.forEach(layer => layer.source.play());
    }
    
    /**
     * Stop all music and layers
     */
    stopAll(fadeOut: number = 1.0): void {
        this.stopTrack(fadeOut);
        this.layers.forEach((_layer, name) => {
            this.removeLayer(name, fadeOut);
        });
    }
    
    /**
     * Dispose of the music system
     */
    dispose(): void {
        this.stopAll(0);
        this.masterGain.disconnect();
    }
}

/**
 * Adaptive music controller
 * Automatically adjusts music layers based on game state
 */
export class AdaptiveMusicController {
    private musicSystem: MusicSystem;
    private parameters: Map<string, number> = new Map();
    private layerMappings: Map<string, { layer: string; min: number; max: number }[]> = new Map();
    
    constructor(musicSystem: MusicSystem) {
        this.musicSystem = musicSystem;
    }
    
    /**
     * Set a parameter value (e.g., intensity, danger, exploration)
     */
    setParameter(name: string, value: number): void {
        this.parameters.set(name, value);
        this.updateLayers();
    }
    
    /**
     * Get a parameter value
     */
    getParameter(name: string): number {
        return this.parameters.get(name) ?? 0;
    }
    
    /**
     * Map a parameter range to a layer weight
     */
    mapParameterToLayer(parameter: string, layer: string, min: number, max: number): void {
        if (!this.layerMappings.has(parameter)) {
            this.layerMappings.set(parameter, []);
        }
        
        this.layerMappings.get(parameter)!.push({ layer, min, max });
    }
    
    /**
     * Update all layer weights based on current parameters
     */
    private updateLayers(): void {
        this.parameters.forEach((value, param) => {
            const mappings = this.layerMappings.get(param);
            if (mappings) {
                mappings.forEach(({ layer: layerName, min, max }) => {
                    // Calculate weight based on parameter value
                    let weight = 0;
                    if (value >= min && value <= max) {
                        // Linear interpolation
                        const range = max - min;
                        if (range > 0) {
                            weight = (value - min) / range;
                        } else {
                            weight = 1;
                        }
                    }
                    
                    this.musicSystem.setLayerWeight(layerName, weight, 0.5);
                });
            }
        });
    }
    
    /**
     * Clear all parameter mappings
     */
    clearMappings(): void {
        this.layerMappings.clear();
    }
}
