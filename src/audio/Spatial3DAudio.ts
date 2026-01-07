/**
 * Spatial3DAudio.ts - Enhanced 3D spatial audio integration
 * 
 * Provides a higher-level 3D audio system with automatic Doppler effect,
 * occlusion, and distance-based effects.
 */

import { Vector3 } from '../math/Vector3';
import { WebForgeAudioContext } from './AudioContext';
import { AudioBufferManager } from './AudioBuffer';
import { SpatialAudioSource, AudioListener, DistanceModel, PanningModel, SpatialAudioConfig } from './SpatialAudio';
import { AudioSourceConfig } from './AudioSource';

/**
 * 3D audio source configuration
 */
export interface Audio3DConfig extends AudioSourceConfig {
    /** Position in 3D space */
    position?: Vector3;
    /** Distance model */
    distanceModel?: DistanceModel;
    /** Panning model */
    panningModel?: PanningModel;
    /** Reference distance */
    refDistance?: number;
    /** Maximum distance */
    maxDistance?: number;
    /** Rolloff factor */
    rolloffFactor?: number;
    /** Directional cone settings */
    cone?: {
        innerAngle: number;
        outerAngle: number;
        outerGain: number;
    };
    /** Orientation for directional sounds */
    orientation?: Vector3;
}

/**
 * Spatial audio manager
 * 
 * Manages 3D positioned audio sources and the audio listener,
 * providing a complete spatial audio system.
 */
export class SpatialAudioManager {
    private audioContext: WebForgeAudioContext;
    private bufferManager: AudioBufferManager;
    private listener: AudioListener;
    private sources: Map<string, SpatialAudioSource> = new Map();
    private dopplerFactor: number = 1.0;
    private speedOfSound: number = 343.3; // m/s

    constructor(audioContext: WebForgeAudioContext, bufferManager: AudioBufferManager) {
        this.audioContext = audioContext;
        this.bufferManager = bufferManager;
        
        // Create audio listener
        this.listener = new AudioListener(audioContext);
    }

    /**
     * Get the audio listener
     */
    public getListener(): AudioListener {
        return this.listener;
    }

    /**
     * Set listener position and orientation from camera
     */
    public updateListenerFromCamera(position: Vector3, forward: Vector3, up: Vector3): void {
        this.listener.setPosition(position);
        this.listener.setOrientation(forward, up);
    }

    /**
     * Create a 3D positioned audio source
     */
    public async create3DSound(
        url: string,
        config: Audio3DConfig
    ): Promise<SpatialAudioSource> {
        // Load buffer
        const buffer = await this.bufferManager.load(url);

        // Create base audio source
        const source = new (await import('./AudioSource')).AudioSource(
            this.audioContext,
            {
                ...config,
                buffer
            }
        );

        // Create spatial wrapper
        const spatialConfig: SpatialAudioConfig = {
            source,
            position: config.position,
            distanceModel: config.distanceModel,
            panningModel: config.panningModel,
            refDistance: config.refDistance,
            maxDistance: config.maxDistance,
            rolloffFactor: config.rolloffFactor,
            coneInnerAngle: config.cone?.innerAngle,
            coneOuterAngle: config.cone?.outerAngle,
            coneOuterGain: config.cone?.outerGain,
            orientation: config.orientation
        };

        const spatialSource = new SpatialAudioSource(this.audioContext, spatialConfig);
        
        return spatialSource;
    }

    /**
     * Play a 3D positioned sound
     */
    public async play3DSound(
        url: string,
        position: Vector3,
        config: Partial<Audio3DConfig> = {}
    ): Promise<SpatialAudioSource> {
        const spatialSource = await this.create3DSound(url, {
            ...config,
            position,
            autoplay: true
        } as Audio3DConfig);

        return spatialSource;
    }

    /**
     * Play a 3D positioned one-shot sound
     */
    public async play3DOneShot(
        url: string,
        position: Vector3,
        volume: number = 1.0
    ): Promise<void> {
        const source = await this.play3DSound(url, position, { volume });

        // Auto-cleanup when finished
        source.getSource().getEvents().on('ended', () => {
            source.destroy();
        });
    }

    /**
     * Register a named 3D sound
     */
    public registerSource(name: string, source: SpatialAudioSource): void {
        this.sources.set(name, source);
    }

    /**
     * Get a registered source
     */
    public getSource(name: string): SpatialAudioSource | undefined {
        return this.sources.get(name);
    }

    /**
     * Remove a registered source
     */
    public removeSource(name: string): void {
        const source = this.sources.get(name);
        if (source) {
            source.destroy();
            this.sources.delete(name);
        }
    }

    /**
     * Update all sources (for Doppler effect, etc.)
     */
    public update(_deltaTime: number): void {
        const listenerPos = this.listener.getPosition();
        const listenerVel = this.listener.getVelocity();

        for (const source of this.sources.values()) {
            // Calculate Doppler effect
            const sourcePos = source.getPosition();
            const sourceVel = source.getVelocity();

            // Relative velocity
            const relVel = sourceVel.clone().subtract(listenerVel);
            
            // Distance vector
            const dist = sourcePos.clone().subtract(listenerPos);
            const distance = dist.length();

            if (distance > 0.001) {
                // Velocity component along line between source and listener
                const dir = dist.normalize();
                const radialVel = relVel.dot(dir);

                // Doppler shift
                if (this.dopplerFactor > 0) {
                    const dopplerShift = 1 - (radialVel * this.dopplerFactor) / this.speedOfSound;
                    source.getSource().setPitch(dopplerShift);
                }
            }
        }
    }

    /**
     * Set Doppler factor (0 = no Doppler, 1 = realistic)
     */
    public setDopplerFactor(factor: number): void {
        this.dopplerFactor = Math.max(0, factor);
    }

    /**
     * Get Doppler factor
     */
    public getDopplerFactor(): number {
        return this.dopplerFactor;
    }

    /**
     * Set speed of sound (m/s)
     */
    public setSpeedOfSound(speed: number): void {
        this.speedOfSound = Math.max(1, speed);
    }

    /**
     * Get speed of sound
     */
    public getSpeedOfSound(): number {
        return this.speedOfSound;
    }

    /**
     * Stop all 3D sounds
     */
    public stopAll(): void {
        for (const source of this.sources.values()) {
            source.getSource().stop();
        }
    }

    /**
     * Get statistics
     */
    public getStats() {
        return {
            activeSources: this.sources.size,
            listenerPosition: this.listener.getPosition(),
            dopplerFactor: this.dopplerFactor,
            speedOfSound: this.speedOfSound
        };
    }

    /**
     * Cleanup and destroy
     */
    public destroy(): void {
        for (const source of this.sources.values()) {
            source.destroy();
        }
        this.sources.clear();
    }
}
