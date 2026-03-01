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
 * Animation playback state
 */
export enum PlaybackState {
  /** Not playing */
  STOPPED = 'stopped',
  /** Currently playing */
  PLAYING = 'playing',
  /** Paused */
  PAUSED = 'paused'
}

/**
 * Animation event triggered at specific time
 */
export interface AnimationEvent {
  /** Time in seconds when event triggers */
  time: number;
  /** Event name/identifier */
  name: string;
  /** Custom data payload */
  data?: any;
}

/**
 * Root motion data extracted from animation
 */
export interface RootMotionData {
  /** Delta position since last frame */
  deltaPosition: { x: number; y: number; z: number };
  /** Delta rotation since last frame (euler angles) */
  deltaRotation: { x: number; y: number; z: number };
}

/**
 * Animation player
 */
export class AnimationPlayer {
  private clip: AnimationClip | null = null;
  private time: number = 0;
  private state: PlaybackState = PlaybackState.STOPPED;
  private playbackMode: PlaybackMode = PlaybackMode.ONCE;
  private speed: number = 1.0;
  private targets: Map<string, any> = new Map();
  private events: EventSystem;
  private direction: number = 1; // 1 for forward, -1 for backward (ping-pong)
  
  /** Animation events */
  private animationEvents: AnimationEvent[] = [];
  private lastEventTime: number = 0;
  
  /** Root motion support */
  private rootMotionEnabled: boolean = false;
  private rootMotionTarget: string = '';
  private lastRootPosition: { x: number; y: number; z: number } = { x: 0, y: 0, z: 0 };
  private currentRootMotion: RootMotionData = {
    deltaPosition: { x: 0, y: 0, z: 0 },
    deltaRotation: { x: 0, y: 0, z: 0 }
  };
  
  /** Blending support */
  private blendWeight: number = 1.0;
  private blendTarget: AnimationClip | null = null;
  private blendDuration: number = 0;
  private blendProgress: number = 0;

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
    this.state = PlaybackState.PLAYING;
    this.playbackMode = mode;
    this.direction = 1;
    this.events.emit('play', {});
  }

  /**
   * Pauses playback
   */
  pause(): void {
    this.state = PlaybackState.PAUSED;
    this.events.emit('pause', {});
  }

  /**
   * Stops playback and resets
   */
  stop(): void {
    this.state = PlaybackState.STOPPED;
    this.time = 0;
    this.events.emit('stop', {});
  }

  /**
   * Updates the animation
   * @param deltaTime - Time since last update
   */
  update(deltaTime: number): void {
    if (this.state !== PlaybackState.PLAYING || !this.clip) return;

    // Update blend progress if cross-fading
    if (this.blendTarget && this.blendDuration > 0) {
      this.blendProgress += deltaTime / this.blendDuration;
      this.blendWeight = Math.max(0, 1.0 - this.blendProgress);
      
      if (this.blendProgress >= 1.0) {
        // Transition complete - switch to new clip
        this.clip = this.blendTarget;
        this.blendTarget = null;
        this.blendWeight = 1.0;
        this.blendProgress = 0;
        this.time = 0;
      }
    }

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

    // Process animation events
    this.processEvents();

    // Apply animation
    this.apply();

    // Extract root motion if enabled
    if (this.rootMotionEnabled) {
      this.extractRootMotion();
    }
  }

  /**
   * Extracts root motion delta from the root target
   */
  private extractRootMotion(): void {
    const rootTarget = this.targets.get(this.rootMotionTarget);
    if (!rootTarget) return;

    const currentPos = rootTarget.position || rootTarget;
    const newPos = {
      x: typeof currentPos.x === 'number' ? currentPos.x : 0,
      y: typeof currentPos.y === 'number' ? currentPos.y : 0,
      z: typeof currentPos.z === 'number' ? currentPos.z : 0
    };

    this.currentRootMotion.deltaPosition = {
      x: newPos.x - this.lastRootPosition.x,
      y: newPos.y - this.lastRootPosition.y,
      z: newPos.z - this.lastRootPosition.z
    };

    this.lastRootPosition = { ...newPos };
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

          default:
            // PROPERTY tracks use compound keys "property:<path>".
            // Only handle keys that start with the PROPERTY type prefix.
            if (typeof trackType === 'string' && trackType.startsWith(TrackType.PROPERTY + ':')) {
              const propertyPath = trackType.substring(TrackType.PROPERTY.length + 1);
              const parts = propertyPath.split('.');
              let obj: any = target;
              for (let i = 0; i < parts.length - 1; i++) {
                if (obj && typeof obj === 'object' && parts[i] in obj) {
                  obj = obj[parts[i]];
                } else {
                  obj = null;
                  break;
                }
              }
              if (obj && typeof obj === 'object') {
                const lastPart = parts[parts.length - 1];
                if (lastPart in obj) {
                  obj[lastPart] = value;
                }
              }
            }
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
    if (this.state !== PlaybackState.STOPPED) {
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
  getState(): PlaybackState {
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
    return this.state === PlaybackState.PLAYING;
  }

  /**
   * Adds an animation event at a specific time
   * @param time - Time in seconds
   * @param name - Event name
   * @param data - Optional data payload
   */
  addEvent(time: number, name: string, data?: any): void {
    this.animationEvents.push({ time, name, data });
    // Keep events sorted by time
    this.animationEvents.sort((a, b) => a.time - b.time);
  }

  /**
   * Removes an animation event by name
   * @param name - Event name to remove
   */
  removeEvent(name: string): void {
    this.animationEvents = this.animationEvents.filter(e => e.name !== name);
  }

  /**
   * Gets all animation events
   * @returns Array of animation events
   */
  getAnimationEvents(): AnimationEvent[] {
    return [...this.animationEvents];
  }

  /**
   * Clears all animation events
   */
  clearEvents(): void {
    this.animationEvents = [];
  }

  /**
   * Processes animation events between lastTime and currentTime
   */
  private processEvents(): void {
    const currentTime = this.time;
    
    for (const event of this.animationEvents) {
      // Check if event falls between last update time and current time
      if (this.direction > 0) {
        if (event.time > this.lastEventTime && event.time <= currentTime) {
          this.events.emit('animationEvent', { name: event.name, time: event.time, data: event.data });
        }
      } else {
        if (event.time < this.lastEventTime && event.time >= currentTime) {
          this.events.emit('animationEvent', { name: event.name, time: event.time, data: event.data });
        }
      }
    }
    
    this.lastEventTime = currentTime;
  }

  /**
   * Enables root motion extraction
   * @param targetName - Name of the root bone/object
   */
  enableRootMotion(targetName: string): void {
    this.rootMotionEnabled = true;
    this.rootMotionTarget = targetName;
    this.lastRootPosition = { x: 0, y: 0, z: 0 };
  }

  /**
   * Disables root motion
   */
  disableRootMotion(): void {
    this.rootMotionEnabled = false;
    this.currentRootMotion = {
      deltaPosition: { x: 0, y: 0, z: 0 },
      deltaRotation: { x: 0, y: 0, z: 0 }
    };
  }

  /**
   * Gets the root motion delta for this frame
   * @returns Root motion data
   */
  getRootMotion(): RootMotionData {
    return { ...this.currentRootMotion };
  }

  /**
   * Whether root motion is enabled
   */
  isRootMotionEnabled(): boolean {
    return this.rootMotionEnabled;
  }

  /**
   * Cross-fades to another animation clip over a duration
   * @param clip - Target animation clip
   * @param duration - Blend duration in seconds
   */
  crossFadeTo(clip: AnimationClip, duration: number): void {
    this.blendTarget = clip;
    this.blendDuration = Math.max(0.01, duration);
    this.blendProgress = 0;
    this.blendWeight = 1.0;
  }

  /**
   * Gets current blend weight
   * @returns Blend weight (0-1)
   */
  getBlendWeight(): number {
    return this.blendWeight;
  }

  /**
   * Gets the current clip
   * @returns Current animation clip or null
   */
  getClip(): AnimationClip | null {
    return this.clip;
  }

  /**
   * Gets playback speed
   * @returns Speed multiplier
   */
  getSpeed(): number {
    return this.speed;
  }

  /**
   * Gets the normalized time (0-1)
   * @returns Normalized time
   */
  getNormalizedTime(): number {
    if (!this.clip || this.clip.getDuration() === 0) return 0;
    return this.time / this.clip.getDuration();
  }
}
