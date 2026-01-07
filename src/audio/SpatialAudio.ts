/**
 * SpatialAudio.ts - 3D positional audio system
 * 
 * Implements 3D spatial audio using Web Audio API's panner nodes,
 * providing realistic distance attenuation, Doppler effect, and directionality.
 */

import { Vector3 } from '../math/Vector3';
import { WebForgeAudioContext } from './AudioContext';
import { AudioSource } from './AudioSource';

/**
 * Distance model types for attenuation
 */
export enum DistanceModel {
    /** Linear distance model */
    LINEAR = 'linear',
    /** Inverse distance model (more natural) */
    INVERSE = 'inverse',
    /** Exponential distance model */
    EXPONENTIAL = 'exponential'
}

/**
 * Panning model types
 */
export enum PanningModel {
    /** Equal power panning (stereo) */
    EQUAL_POWER = 'equalpower',
    /** HRTF panning (binaural, more realistic) */
    HRTF = 'HRTF'
}

/**
 * Spatial audio source configuration
 */
export interface SpatialAudioConfig {
    /** Audio source */
    source: AudioSource;
    /** Initial position */
    position?: Vector3;
    /** Distance model */
    distanceModel?: DistanceModel;
    /** Panning model */
    panningModel?: PanningModel;
    /** Reference distance (default: 1) */
    refDistance?: number;
    /** Maximum distance (default: 10000) */
    maxDistance?: number;
    /** Rolloff factor (default: 1) */
    rolloffFactor?: number;
    /** Cone inner angle in degrees (default: 360) */
    coneInnerAngle?: number;
    /** Cone outer angle in degrees (default: 360) */
    coneOuterAngle?: number;
    /** Cone outer gain (default: 0) */
    coneOuterGain?: number;
    /** Orientation (forward direction, default: -Z) */
    orientation?: Vector3;
}

/**
 * Spatial audio source
 * 
 * Wraps an audio source with 3D spatial properties including position,
 * orientation, distance attenuation, and Doppler effect.
 */
export class SpatialAudioSource {
    private audioContext: WebForgeAudioContext;
    private source: AudioSource;
    private pannerNode: PannerNode;
    private position: Vector3;
    private orientation: Vector3;
    private velocity: Vector3 = new Vector3();

    constructor(audioContext: WebForgeAudioContext, config: SpatialAudioConfig) {
        this.audioContext = audioContext;
        this.source = config.source;
        this.position = config.position?.clone() ?? new Vector3();
        this.orientation = config.orientation?.clone() ?? new Vector3(0, 0, -1);

        // Create panner node
        this.pannerNode = audioContext.createPanner();

        // Configure panner
        this.pannerNode.panningModel = config.panningModel ?? PanningModel.HRTF;
        this.pannerNode.distanceModel = config.distanceModel ?? DistanceModel.INVERSE;
        this.pannerNode.refDistance = config.refDistance ?? 1;
        this.pannerNode.maxDistance = config.maxDistance ?? 10000;
        this.pannerNode.rolloffFactor = config.rolloffFactor ?? 1;
        this.pannerNode.coneInnerAngle = config.coneInnerAngle ?? 360;
        this.pannerNode.coneOuterAngle = config.coneOuterAngle ?? 360;
        this.pannerNode.coneOuterGain = config.coneOuterGain ?? 0;

        // Set initial position and orientation
        this.updatePannerPosition();
        this.updatePannerOrientation();

        // Note: Actual audio connection needs to be done externally
        // as AudioSource doesn't expose internal nodes directly
    }

    /**
     * Get the panner node for audio graph connection
     */
    public getPannerNode(): PannerNode {
        return this.pannerNode;
    }

    /**
     * Get the audio source
     */
    public getSource(): AudioSource {
        return this.source;
    }

    /**
     * Set position
     */
    public setPosition(position: Vector3): void {
        this.position.copy(position);
        this.updatePannerPosition();
    }

    /**
     * Get position
     */
    public getPosition(): Vector3 {
        return this.position.clone();
    }

    /**
     * Set orientation (forward direction)
     */
    public setOrientation(orientation: Vector3): void {
        this.orientation.copy(orientation).normalize();
        this.updatePannerOrientation();
    }

    /**
     * Get orientation
     */
    public getOrientation(): Vector3 {
        return this.orientation.clone();
    }

    /**
     * Set velocity for Doppler effect
     */
    public setVelocity(velocity: Vector3): void {
        this.velocity.copy(velocity);
        
        // Note: Some browsers deprecated velocity-based Doppler
        // Modern approach would be to manually adjust playback rate
    }

    /**
     * Get velocity
     */
    public getVelocity(): Vector3 {
        return this.velocity.clone();
    }

    /**
     * Set distance model
     */
    public setDistanceModel(model: DistanceModel): void {
        this.pannerNode.distanceModel = model;
    }

    /**
     * Set panning model
     */
    public setPanningModel(model: PanningModel): void {
        this.pannerNode.panningModel = model;
    }

    /**
     * Set reference distance
     */
    public setRefDistance(distance: number): void {
        this.pannerNode.refDistance = Math.max(0, distance);
    }

    /**
     * Set maximum distance
     */
    public setMaxDistance(distance: number): void {
        this.pannerNode.maxDistance = Math.max(0, distance);
    }

    /**
     * Set rolloff factor
     */
    public setRolloffFactor(factor: number): void {
        this.pannerNode.rolloffFactor = Math.max(0, factor);
    }

    /**
     * Set cone angles and gain (for directional sounds)
     */
    public setCone(innerAngle: number, outerAngle: number, outerGain: number): void {
        this.pannerNode.coneInnerAngle = Math.max(0, Math.min(360, innerAngle));
        this.pannerNode.coneOuterAngle = Math.max(0, Math.min(360, outerAngle));
        this.pannerNode.coneOuterGain = Math.max(0, Math.min(1, outerGain));
    }

    /**
     * Update panner position from internal vector
     */
    private updatePannerPosition(): void {
        this.pannerNode.positionX.setValueAtTime(
            this.position.x,
            this.audioContext.getCurrentTime()
        );
        this.pannerNode.positionY.setValueAtTime(
            this.position.y,
            this.audioContext.getCurrentTime()
        );
        this.pannerNode.positionZ.setValueAtTime(
            this.position.z,
            this.audioContext.getCurrentTime()
        );
    }

    /**
     * Update panner orientation from internal vector
     */
    private updatePannerOrientation(): void {
        this.pannerNode.orientationX.setValueAtTime(
            this.orientation.x,
            this.audioContext.getCurrentTime()
        );
        this.pannerNode.orientationY.setValueAtTime(
            this.orientation.y,
            this.audioContext.getCurrentTime()
        );
        this.pannerNode.orientationZ.setValueAtTime(
            this.orientation.z,
            this.audioContext.getCurrentTime()
        );
    }

    /**
     * Calculate distance to listener position
     */
    public distanceTo(listenerPosition: Vector3): number {
        return this.position.distanceTo(listenerPosition);
    }

    /**
     * Cleanup and disconnect
     */
    public destroy(): void {
        this.pannerNode.disconnect();
    }
}

/**
 * Audio listener configuration
 */
export interface AudioListenerConfig {
    /** Initial position */
    position?: Vector3;
    /** Initial forward direction */
    forward?: Vector3;
    /** Initial up direction */
    up?: Vector3;
}

/**
 * Audio listener
 * 
 * Represents the "ear" in the 3D audio space, typically attached
 * to the player camera or character.
 */
export class AudioListener {
    private audioContext: WebForgeAudioContext;
    private nativeListener: globalThis.AudioListener;
    private position: Vector3;
    private forward: Vector3;
    private up: Vector3;
    private velocity: Vector3 = new Vector3();

    constructor(audioContext: WebForgeAudioContext, config: AudioListenerConfig = {}) {
        this.audioContext = audioContext;
        this.nativeListener = audioContext.getContext().listener;
        this.position = config.position?.clone() ?? new Vector3();
        this.forward = config.forward?.clone() ?? new Vector3(0, 0, -1);
        this.up = config.up?.clone() ?? new Vector3(0, 1, 0);

        // Set initial position and orientation
        this.updateListenerPosition();
        this.updateListenerOrientation();
    }

    /**
     * Set position
     */
    public setPosition(position: Vector3): void {
        this.position.copy(position);
        this.updateListenerPosition();
    }

    /**
     * Get position
     */
    public getPosition(): Vector3 {
        return this.position.clone();
    }

    /**
     * Set orientation (forward and up vectors)
     */
    public setOrientation(forward: Vector3, up: Vector3): void {
        this.forward.copy(forward).normalize();
        this.up.copy(up).normalize();
        this.updateListenerOrientation();
    }

    /**
     * Get forward direction
     */
    public getForward(): Vector3 {
        return this.forward.clone();
    }

    /**
     * Get up direction
     */
    public getUp(): Vector3 {
        return this.up.clone();
    }

    /**
     * Set velocity for Doppler effect
     */
    public setVelocity(velocity: Vector3): void {
        this.velocity.copy(velocity);
    }

    /**
     * Get velocity
     */
    public getVelocity(): Vector3 {
        return this.velocity.clone();
    }

    /**
     * Update listener position
     */
    private updateListenerPosition(): void {
        const currentTime = this.audioContext.getCurrentTime();
        this.nativeListener.positionX.setValueAtTime(this.position.x, currentTime);
        this.nativeListener.positionY.setValueAtTime(this.position.y, currentTime);
        this.nativeListener.positionZ.setValueAtTime(this.position.z, currentTime);
    }

    /**
     * Update listener orientation
     */
    private updateListenerOrientation(): void {
        const currentTime = this.audioContext.getCurrentTime();
        
        this.nativeListener.forwardX.setValueAtTime(this.forward.x, currentTime);
        this.nativeListener.forwardY.setValueAtTime(this.forward.y, currentTime);
        this.nativeListener.forwardZ.setValueAtTime(this.forward.z, currentTime);
        
        this.nativeListener.upX.setValueAtTime(this.up.x, currentTime);
        this.nativeListener.upY.setValueAtTime(this.up.y, currentTime);
        this.nativeListener.upZ.setValueAtTime(this.up.z, currentTime);
    }

    /**
     * Look at a target position
     */
    public lookAt(target: Vector3, up?: Vector3): void {
        this.forward.copy(target).subtract(this.position).normalize();
        if (up) {
            this.up.copy(up).normalize();
        }
        this.updateListenerOrientation();
    }
}
