/**
 * AudioSource.ts - Audio source management and playback
 * 
 * Provides a high-level interface for playing audio with volume, pitch,
 * looping, and other controls.
 */

import { WebForgeAudioContext } from './AudioContext';
import { EventSystem } from '../core/EventSystem';

/**
 * Audio source configuration
 */
export interface AudioSourceConfig {
    /** Audio buffer to play */
    buffer: AudioBuffer;
    /** Initial volume (0-1, default: 1) */
    volume?: number;
    /** Initial pitch (default: 1) */
    pitch?: number;
    /** Loop the audio (default: false) */
    loop?: boolean;
    /** Loop start time in seconds (default: 0) */
    loopStart?: number;
    /** Loop end time in seconds (default: buffer duration) */
    loopEnd?: number;
    /** Auto-play on creation (default: false) */
    autoplay?: boolean;
}

/**
 * Audio source playback state
 */
export enum AudioSourceState {
    /** Not playing */
    STOPPED = 'stopped',
    /** Currently playing */
    PLAYING = 'playing',
    /** Paused */
    PAUSED = 'paused'
}

/**
 * Audio source for playback
 * 
 * Manages a single audio source with playback controls, volume, pitch,
 * and looping capabilities.
 */
export class AudioSource {
    private audioContext: WebForgeAudioContext;
    private buffer: AudioBuffer;
    private source: AudioBufferSourceNode | null = null;
    private gainNode: GainNode;
    private events: EventSystem;

    private _volume: number = 1.0;
    private _pitch: number = 1.0;
    private _loop: boolean = false;
    private _loopStart: number = 0;
    private _loopEnd: number = 0;
    private _state: AudioSourceState = AudioSourceState.STOPPED;
    private _startTime: number = 0;
    private _pauseTime: number = 0;

    constructor(audioContext: WebForgeAudioContext, config: AudioSourceConfig) {
        this.audioContext = audioContext;
        this.buffer = config.buffer;
        this.events = new EventSystem();

        // Create gain node
        this.gainNode = audioContext.createGain();
        this.gainNode.connect(audioContext.getMasterGain());

        // Set initial parameters
        this._volume = config.volume ?? 1.0;
        this._pitch = config.pitch ?? 1.0;
        this._loop = config.loop ?? false;
        this._loopStart = config.loopStart ?? 0;
        this._loopEnd = config.loopEnd ?? this.buffer.duration;

        this.gainNode.gain.value = this._volume;

        // Auto-play if requested
        if (config.autoplay) {
            this.play();
        }
    }

    /**
     * Play the audio source
     * 
     * @param offset - Start position in seconds (default: 0 or current position if paused)
     */
    public play(offset?: number): void {
        if (this._state === AudioSourceState.PLAYING) {
            return;
        }

        // Stop any existing source
        this.stop();

        // Create new source
        this.source = this.audioContext.createBufferSource();
        this.source.buffer = this.buffer;
        this.source.loop = this._loop;
        this.source.loopStart = this._loopStart;
        this.source.loopEnd = this._loopEnd;
        this.source.playbackRate.value = this._pitch;

        // Connect to gain node
        this.source.connect(this.gainNode);

        // Set up ended handler
        this.source.onended = () => {
            if (this._state === AudioSourceState.PLAYING && !this._loop) {
                this._state = AudioSourceState.STOPPED;
                this.events.emit('ended', {});
            }
        };

        // Determine start offset
        const startOffset = offset ?? (this._state === AudioSourceState.PAUSED ? this._pauseTime : 0);

        // Start playback
        this._startTime = this.audioContext.getCurrentTime() - startOffset;
        this.source.start(0, startOffset);

        this._state = AudioSourceState.PLAYING;
        this.events.emit('play', {});
    }

    /**
     * Pause playback
     */
    public pause(): void {
        if (this._state !== AudioSourceState.PLAYING) {
            return;
        }

        // Store current position
        this._pauseTime = this.getCurrentTime();
        this.stop();
        this._state = AudioSourceState.PAUSED;
        this.events.emit('pause', {});
    }

    /**
     * Stop playback
     */
    public stop(): void {
        if (this.source) {
            try {
                this.source.stop();
            } catch (e) {
                // Ignore errors if already stopped
            }
            this.source.disconnect();
            this.source = null;
        }

        if (this._state !== AudioSourceState.STOPPED) {
            this._state = AudioSourceState.STOPPED;
            this._pauseTime = 0;
            this.events.emit('stop', {});
        }
    }

    /**
     * Seek to a specific time position
     * 
     * @param time - Time in seconds
     */
    public seek(time: number): void {
        const wasPlaying = this._state === AudioSourceState.PLAYING;
        this.stop();

        this._pauseTime = Math.max(0, Math.min(time, this.buffer.duration));

        if (wasPlaying) {
            this.play(this._pauseTime);
        }
    }

    /**
     * Get current playback time in seconds
     */
    public getCurrentTime(): number {
        if (this._state === AudioSourceState.PLAYING) {
            const elapsed = this.audioContext.getCurrentTime() - this._startTime;
            if (this._loop) {
                const loopDuration = this._loopEnd - this._loopStart;
                return this._loopStart + ((elapsed - this._loopStart) % loopDuration);
            }
            return Math.min(elapsed, this.buffer.duration);
        }
        return this._pauseTime;
    }

    /**
     * Get duration in seconds
     */
    public getDuration(): number {
        return this.buffer.duration;
    }

    /**
     * Set volume (0-1)
     */
    public setVolume(volume: number): void {
        this._volume = Math.max(0, Math.min(1, volume));
        this.gainNode.gain.setValueAtTime(
            this._volume,
            this.audioContext.getCurrentTime()
        );
    }

    /**
     * Get volume
     */
    public getVolume(): number {
        return this._volume;
    }

    /**
     * Set pitch/playback rate
     */
    public setPitch(pitch: number): void {
        this._pitch = Math.max(0.25, Math.min(4, pitch));
        if (this.source) {
            this.source.playbackRate.setValueAtTime(
                this._pitch,
                this.audioContext.getCurrentTime()
            );
        }
    }

    /**
     * Get pitch
     */
    public getPitch(): number {
        return this._pitch;
    }

    /**
     * Set loop enabled
     */
    public setLoop(loop: boolean): void {
        this._loop = loop;
        if (this.source) {
            this.source.loop = loop;
        }
    }

    /**
     * Get loop enabled
     */
    public getLoop(): boolean {
        return this._loop;
    }

    /**
     * Set loop points
     */
    public setLoopPoints(start: number, end: number): void {
        this._loopStart = Math.max(0, start);
        this._loopEnd = Math.min(this.buffer.duration, end);
        if (this.source) {
            this.source.loopStart = this._loopStart;
            this.source.loopEnd = this._loopEnd;
        }
    }

    /**
     * Get playback state
     */
    public getState(): AudioSourceState {
        return this._state;
    }

    /**
     * Check if playing
     */
    public isPlaying(): boolean {
        return this._state === AudioSourceState.PLAYING;
    }

    /**
     * Check if paused
     */
    public isPaused(): boolean {
        return this._state === AudioSourceState.PAUSED;
    }

    /**
     * Check if stopped
     */
    public isStopped(): boolean {
        return this._state === AudioSourceState.STOPPED;
    }

    /**
     * Get event system
     */
    public getEvents(): EventSystem {
        return this.events;
    }

    /**
     * Fade volume to target over duration
     */
    public fadeVolume(targetVolume: number, duration: number): void {
        const currentTime = this.audioContext.getCurrentTime();
        this.gainNode.gain.setValueAtTime(this._volume, currentTime);
        this.gainNode.gain.linearRampToValueAtTime(
            Math.max(0, Math.min(1, targetVolume)),
            currentTime + duration
        );
        this._volume = targetVolume;
    }

    /**
     * Fade in from zero volume
     */
    public fadeIn(duration: number): void {
        this.gainNode.gain.setValueAtTime(0, this.audioContext.getCurrentTime());
        this.fadeVolume(this._volume, duration);
    }

    /**
     * Fade out to zero volume and stop
     */
    public fadeOut(duration: number): void {
        const originalVolume = this._volume;
        this.fadeVolume(0, duration);
        setTimeout(() => {
            this.stop();
            this._volume = originalVolume;
        }, duration * 1000);
    }

    /**
     * Cleanup and disconnect
     */
    public destroy(): void {
        this.stop();
        this.gainNode.disconnect();
        this.events.clear();
    }
}
