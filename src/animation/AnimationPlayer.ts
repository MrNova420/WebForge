/**
 * @module animation
 * @fileoverview Animation player for controlling animation playback
 */

import { AnimationClip, TrackType } from './AnimationClip';
import { EventSystem } from '../core/EventSystem';

/**
 * Animation playback mode
 */
export enum PlaybackMode {
  /** Play once and stop */
  ONCE = 'once',
  /** Loop continuously */
  LOOP = 'loop',
  /** Ping-pong (forward then backward) */
  PING_PONG = 'pingpong'
}

/**
 * Animation state
 */
export enum AnimationState {
  /** Not playing */
  STOPPED = 'stopped',
  /** Currently playing */
  PLAYING = 'playing',
  /** Paused */
  PAUSED = 'paused'
}

/**
 * Animation player
 */
export class AnimationPlayer {
  private clip: AnimationClip | null = null;
  private time: number = 0;
  private state: AnimationState = AnimationState.STOPPED;
  private playbackMode: PlaybackMode = PlaybackMode.ONCE;
  private speed: number = 1.0;
  private targets: Map<string, any> = new Map();
  private events: EventSystem;
  private direction: number = 1; // 1 for forward, -1 for backward (ping-pong)

  constructor() {
    this.events = new EventSystem();
  }

  /**
   * Sets the animation clip
   * @param clip - Animation clip
   */
  setClip(clip: AnimationClip): void {
    this.clip = clip;
    this.time = 0;
  }

  /**
   * Registers a target object
   * @param name - Target name (matches track target)
   * @param object - Target object
   */
  registerTarget(name: string, object: any): void {
    this.targets.set(name, object);
  }

  /**
   * Starts playing
   * @param mode - Playback mode
   */
  play(mode: PlaybackMode = PlaybackMode.ONCE): void {
    if (!this.clip) return;
    this.state = AnimationState.PLAYING;
    this.playbackMode = mode;
    this.direction = 1;
    this.events.emit('play', {});
  }

  /**
   * Pauses playback
   */
  pause(): void {
    this.state = AnimationState.PAUSED;
    this.events.emit('pause', {});
  }

  /**
   * Stops playback and resets
   */
  stop(): void {
    this.state = AnimationState.STOPPED;
    this.time = 0;
    this.events.emit('stop', {});
  }

  /**
   * Updates the animation
   * @param deltaTime - Time since last update
   */
  update(deltaTime: number): void {
    if (this.state !== AnimationState.PLAYING || !this.clip) return;

    // Update time
    this.time += deltaTime * this.speed * this.direction;

    // Handle playback modes
    if (this.direction > 0 && this.time >= this.clip.getDuration()) {
      switch (this.playbackMode) {
        case PlaybackMode.ONCE:
          this.time = this.clip.getDuration();
          this.stop();
          this.events.emit('finished', {});
          return;

        case PlaybackMode.LOOP:
          this.time = this.time % this.clip.getDuration();
          this.events.emit('loop', {});
          break;

        case PlaybackMode.PING_PONG:
          this.time = this.clip.getDuration();
          this.direction = -1;
          break;
      }
    }

    if (this.direction < 0 && this.time <= 0) {
      if (this.playbackMode === PlaybackMode.PING_PONG) {
        this.time = 0;
        this.direction = 1;
      }
    }

    // Apply animation
    this.apply();
  }

  /**
   * Applies the animation at current time
   */
  private apply(): void {
    if (!this.clip) return;

    const values = this.clip.evaluate(this.time);

    for (const [targetName, trackValues] of values) {
      const target = this.targets.get(targetName);
      if (!target) continue;

      for (const [trackType, value] of trackValues) {
        switch (trackType) {
          case TrackType.POSITION:
            if (target.position || target.setPosition) {
              if (target.setPosition) {
                target.setPosition(value);
              } else if (target.position) {
                target.position.copy(value);
              }
            }
            break;

          case TrackType.ROTATION:
            if (target.rotation || target.setRotation) {
              if (target.setRotation) {
                target.setRotation(value);
              } else if (target.rotation) {
                target.rotation.copy(value);
              }
            }
            break;

          case TrackType.SCALE:
            if (target.scale) {
              target.scale.copy(value);
            }
            break;

          case TrackType.PROPERTY:
            // Set custom property
            const parts = trackType.split('.');
            let obj = target;
            for (let i = 0; i < parts.length - 1; i++) {
              obj = obj[parts[i]];
            }
            obj[parts[parts.length - 1]] = value;
            break;
        }
      }
    }
  }

  /**
   * Seeks to a specific time
   * @param time - Time in seconds
   */
  seek(time: number): void {
    if (!this.clip) return;
    this.time = Math.max(0, Math.min(time, this.clip.getDuration()));
    if (this.state !== AnimationState.STOPPED) {
      this.apply();
    }
  }

  /**
   * Sets playback speed
   * @param speed - Playback speed multiplier
   */
  setSpeed(speed: number): void {
    this.speed = Math.max(0, speed);
  }

  /**
   * Gets current time
   * @returns Current time in seconds
   */
  getTime(): number {
    return this.time;
  }

  /**
   * Gets current state
   * @returns Animation state
   */
  getState(): AnimationState {
    return this.state;
  }

  /**
   * Gets the event system
   * @returns Event system
   */
  getEvents(): EventSystem {
    return this.events;
  }

  /**
   * Checks if playing
   * @returns True if playing
   */
  isPlaying(): boolean {
    return this.state === AnimationState.PLAYING;
  }
}
