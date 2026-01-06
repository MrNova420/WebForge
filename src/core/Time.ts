/**
 * @module core
 * @fileoverview Time class - Time management with delta time and fixed timestep
 */

/**
 * Time management system for game loop timing.
 * Provides delta time, fixed timestep updates, and time scaling.
 * 
 * @example
 * ```typescript
 * const time = new Time();
 * 
 * function gameLoop(timestamp: number) {
 *   time.update(timestamp);
 *   
 *   // Variable timestep update
 *   update(time.deltaTime);
 *   
 *   // Fixed timestep physics updates
 *   while (time.consumeFixedUpdate()) {
 *     updatePhysics(time.fixedDeltaTime);
 *   }
 *   
 *   render();
 *   requestAnimationFrame(gameLoop);
 * }
 * ```
 */
export class Time {
  /** Current time in seconds since start */
  private _time: number;
  
  /** Time of previous frame */
  private _lastTime: number;
  
  /** Delta time in seconds (time since last frame) */
  private _deltaTime: number;
  
  /** Unscaled delta time (not affected by timeScale) */
  private _unscaledDeltaTime: number;
  
  /** Fixed delta time for physics updates */
  private _fixedDeltaTime: number;
  
  /** Accumulated time for fixed updates */
  private _accumulator: number;
  
  /** Time scale multiplier (1.0 = normal speed) */
  private _timeScale: number;
  
  /** Frame count since start */
  private _frameCount: number;
  
  /** Frames per second (smoothed) */
  private _fps: number;
  
  /** FPS calculation buffer */
  private _fpsBuffer: number[];
  
  /** Maximum FPS buffer size */
  private readonly FPS_BUFFER_SIZE = 60;
  
  /** Maximum delta time to prevent spiral of death */
  private _maxDeltaTime: number;
  
  /** Whether time system has started */
  private _started: boolean;

  /**
   * Creates a new Time system.
   * @param fixedDeltaTime - Fixed timestep in seconds (default: 1/60 = 0.01667)
   * @param maxDeltaTime - Maximum delta time in seconds (default: 0.1)
   */
  constructor(fixedDeltaTime: number = 1 / 60, maxDeltaTime: number = 0.1) {
    this._time = 0;
    this._lastTime = 0;
    this._deltaTime = 0;
    this._unscaledDeltaTime = 0;
    this._fixedDeltaTime = fixedDeltaTime;
    this._accumulator = 0;
    this._timeScale = 1.0;
    this._frameCount = 0;
    this._fps = 0;
    this._fpsBuffer = [];
    this._maxDeltaTime = maxDeltaTime;
    this._started = false;
  }

  /**
   * Updates the time system. Call this once per frame.
   * @param timestamp - Current timestamp in milliseconds (from requestAnimationFrame)
   */
  update(timestamp: number): void {
    // Convert timestamp from milliseconds to seconds
    const currentTime = timestamp / 1000;
    
    if (!this._started) {
      this._lastTime = currentTime;
      this._started = true;
      return;
    }
    
    // Calculate delta time
    this._unscaledDeltaTime = currentTime - this._lastTime;
    
    // Clamp delta time to prevent spiral of death
    this._unscaledDeltaTime = Math.min(this._unscaledDeltaTime, this._maxDeltaTime);
    
    // Apply time scale
    this._deltaTime = this._unscaledDeltaTime * this._timeScale;
    
    // Update time
    this._time += this._deltaTime;
    this._lastTime = currentTime;
    
    // Accumulate time for fixed updates
    this._accumulator += this._deltaTime;
    
    // Update frame count
    this._frameCount++;
    
    // Calculate FPS
    this.updateFPS();
  }

  /**
   * Updates the FPS calculation.
   */
  private updateFPS(): void {
    if (this._unscaledDeltaTime > 0) {
      const instantFPS = 1 / this._unscaledDeltaTime;
      this._fpsBuffer.push(instantFPS);
      
      if (this._fpsBuffer.length > this.FPS_BUFFER_SIZE) {
        this._fpsBuffer.shift();
      }
      
      // Calculate average FPS
      const sum = this._fpsBuffer.reduce((a, b) => a + b, 0);
      this._fps = sum / this._fpsBuffer.length;
    }
  }

  /**
   * Consumes a fixed update if enough time has accumulated.
   * Use this in a while loop for fixed timestep updates.
   * @returns True if a fixed update should be performed
   */
  consumeFixedUpdate(): boolean {
    if (this._accumulator >= this._fixedDeltaTime) {
      this._accumulator -= this._fixedDeltaTime;
      return true;
    }
    return false;
  }

  /**
   * Gets the current time in seconds since start.
   */
  get time(): number {
    return this._time;
  }

  /**
   * Gets the delta time in seconds (scaled by timeScale).
   */
  get deltaTime(): number {
    return this._deltaTime;
  }

  /**
   * Gets the unscaled delta time in seconds.
   */
  get unscaledDeltaTime(): number {
    return this._unscaledDeltaTime;
  }

  /**
   * Gets the fixed delta time in seconds.
   */
  get fixedDeltaTime(): number {
    return this._fixedDeltaTime;
  }

  /**
   * Sets the fixed delta time in seconds.
   */
  set fixedDeltaTime(value: number) {
    this._fixedDeltaTime = value;
  }

  /**
   * Gets the time scale multiplier.
   */
  get timeScale(): number {
    return this._timeScale;
  }

  /**
   * Sets the time scale multiplier.
   * Use values < 1 for slow motion, > 1 for fast forward, 0 for pause.
   */
  set timeScale(value: number) {
    this._timeScale = Math.max(0, value);
  }

  /**
   * Gets the frame count since start.
   */
  get frameCount(): number {
    return this._frameCount;
  }

  /**
   * Gets the current FPS (smoothed average).
   */
  get fps(): number {
    return this._fps;
  }

  /**
   * Gets the maximum allowed delta time.
   */
  get maxDeltaTime(): number {
    return this._maxDeltaTime;
  }

  /**
   * Sets the maximum allowed delta time.
   */
  set maxDeltaTime(value: number) {
    this._maxDeltaTime = Math.max(0, value);
  }

  /**
   * Resets the time system to initial state.
   */
  reset(): void {
    this._time = 0;
    this._lastTime = 0;
    this._deltaTime = 0;
    this._unscaledDeltaTime = 0;
    this._accumulator = 0;
    this._frameCount = 0;
    this._fps = 0;
    this._fpsBuffer = [];
    this._started = false;
  }

  /**
   * Pauses time (sets timeScale to 0).
   */
  pause(): void {
    this._timeScale = 0;
  }

  /**
   * Resumes time (sets timeScale to 1).
   */
  resume(): void {
    this._timeScale = 1.0;
  }

  /**
   * Checks if time is paused.
   * @returns True if timeScale is 0
   */
  isPaused(): boolean {
    return this._timeScale === 0;
  }

  /**
   * Gets the interpolation alpha for rendering between fixed updates.
   * Use this for smooth rendering between physics updates.
   * @returns Alpha value between 0 and 1
   */
  getFixedUpdateAlpha(): number {
    return this._accumulator / this._fixedDeltaTime;
  }

  /**
   * Converts seconds to milliseconds.
   * @param seconds - Time in seconds
   * @returns Time in milliseconds
   */
  static secondsToMilliseconds(seconds: number): number {
    return seconds * 1000;
  }

  /**
   * Converts milliseconds to seconds.
   * @param milliseconds - Time in milliseconds
   * @returns Time in seconds
   */
  static millisecondsToSeconds(milliseconds: number): number {
    return milliseconds / 1000;
  }
}
