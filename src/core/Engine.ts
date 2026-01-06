/**
 * @module core
 * @fileoverview Engine class - Main game engine with lifecycle management
 */

import { Time } from './Time';
import { Input } from './Input';
import { ResourceManager } from './ResourceManager';
import { Scene } from '../scene/Scene';
import { EventSystem } from './EventSystem';
import { Logger, LogLevel } from './Logger';
import { profiler } from '../utils/Profiler';

/**
 * Engine configuration options.
 */
export interface EngineConfig {
  /** Canvas element or canvas ID */
  canvas?: HTMLCanvasElement | string;
  /** Canvas width (default: canvas.width or 800) */
  width?: number;
  /** Canvas height (default: canvas.height or 600) */
  height?: number;
  /** Enable anti-aliasing (default: true) */
  antialias?: boolean;
  /** Fixed timestep for physics (default: 1/60) */
  fixedTimestep?: number;
  /** Maximum delta time (default: 0.1) */
  maxDeltaTime?: number;
  /** Enable profiling (default: false) */
  enableProfiling?: boolean;
  /** Log level (default: INFO) */
  logLevel?: LogLevel;
  /** Target FPS (0 = unlimited, default: 60) */
  targetFPS?: number;
}

/**
 * Engine state enumeration.
 */
export enum EngineState {
  STOPPED = 'stopped',
  STARTING = 'starting',
  RUNNING = 'running',
  PAUSED = 'paused',
  STOPPING = 'stopping'
}

/**
 * Main game engine class.
 * Manages the game loop, systems, and lifecycle.
 * 
 * @example
 * ```typescript
 * const engine = new Engine({
 *   canvas: 'game-canvas',
 *   width: 1920,
 *   height: 1080,
 *   targetFPS: 60
 * });
 * 
 * // Set up scene
 * const scene = new Scene('MainScene');
 * engine.setScene(scene);
 * 
 * // Add game objects
 * const player = new GameObject('Player');
 * scene.add(player);
 * 
 * // Start engine
 * await engine.start();
 * 
 * // Later: stop engine
 * engine.stop();
 * ```
 */
export class Engine {
  /** Canvas element */
  public canvas: HTMLCanvasElement | null;
  
  /** Canvas width */
  public width: number;
  
  /** Canvas height */
  public height: number;
  
  /** Time system */
  public time: Time;
  
  /** Input system */
  public input: Input;
  
  /** Resource manager */
  public resources: ResourceManager;
  
  /** Current scene */
  private _scene: Scene | null;
  
  /** Event system */
  private events: EventSystem;
  
  /** Logger */
  private logger: Logger;
  
  /** Engine state */
  private state: EngineState;
  
  /** Animation frame request ID */
  private animationFrameId: number | null;
  
  /** Target frame time in milliseconds (0 = unlimited) */
  private targetFrameTime: number;
  
  /** Last frame timestamp */
  private lastFrameTime: number;
  
  /** Enable profiling */
  private enableProfiling: boolean;

  /**
   * Creates a new Engine.
   * @param config - Engine configuration
   */
  constructor(config: EngineConfig = {}) {
    // Get or create canvas
    if (config.canvas) {
      if (typeof config.canvas === 'string') {
        const element = document.getElementById(config.canvas);
        if (!element || !(element instanceof HTMLCanvasElement)) {
          throw new Error(`Canvas element "${config.canvas}" not found or not a canvas`);
        }
        this.canvas = element;
      } else {
        this.canvas = config.canvas;
      }
    } else {
      this.canvas = null;
    }
    
    // Set dimensions
    this.width = config.width || this.canvas?.width || 800;
    this.height = config.height || this.canvas?.height || 600;
    
    if (this.canvas) {
      this.canvas.width = this.width;
      this.canvas.height = this.height;
    }
    
    // Initialize systems
    this.time = new Time(
      config.fixedTimestep || 1 / 60,
      config.maxDeltaTime || 0.1
    );
    
    this.input = new Input(this.canvas || undefined);
    this.resources = new ResourceManager();
    this._scene = null;
    this.events = new EventSystem();
    
    // Initialize logger
    this.logger = new Logger('Engine', {
      level: config.logLevel || LogLevel.INFO
    });
    
    // Set state
    this.state = EngineState.STOPPED;
    this.animationFrameId = null;
    this.lastFrameTime = 0;
    
    // Calculate target frame time
    const targetFPS = config.targetFPS ?? 60;
    this.targetFrameTime = targetFPS > 0 ? 1000 / targetFPS : 0;
    
    // Profiling
    this.enableProfiling = config.enableProfiling ?? false;
    profiler.setEnabled(this.enableProfiling);
    
    this.logger.info('Engine initialized', {
      width: this.width,
      height: this.height,
      targetFPS,
      fixedTimestep: this.time.fixedDeltaTime
    });
  }

  /**
   * Gets the current scene.
   * @returns Current scene or null
   */
  getScene(): Scene | null {
    return this._scene;
  }

  /**
   * Sets the active scene.
   * @param scene - Scene to set active
   */
  setScene(scene: Scene): void {
    const oldScene = this._scene;
    
    if (oldScene) {
      oldScene.disable();
      this.events.emit('scene:changed', { old: oldScene, new: scene });
    }
    
    this._scene = scene;
    scene.enable();
    
    this.logger.info(`Scene changed to "${scene.name}"`);
  }

  /**
   * Starts the engine.
   * @returns Promise that resolves when engine is started
   */
  async start(): Promise<void> {
    if (this.state === EngineState.RUNNING) {
      this.logger.warn('Engine is already running');
      return;
    }
    
    if (this.state === EngineState.STARTING) {
      this.logger.warn('Engine is already starting');
      return;
    }
    
    this.state = EngineState.STARTING;
    this.logger.info('Starting engine...');
    
    try {
      // Emit start event
      this.events.emit('engine:starting');
      
      // Reset time
      this.time.reset();
      
      // Start game loop
      this.state = EngineState.RUNNING;
      this.lastFrameTime = performance.now();
      this.animationFrameId = requestAnimationFrame(this.gameLoop);
      
      this.events.emit('engine:started');
      this.logger.info('Engine started');
    } catch (error) {
      this.state = EngineState.STOPPED;
      this.logger.error('Failed to start engine', error);
      throw error;
    }
  }

  /**
   * Stops the engine.
   */
  stop(): void {
    if (this.state !== EngineState.RUNNING && this.state !== EngineState.PAUSED) {
      this.logger.warn('Engine is not running');
      return;
    }
    
    this.state = EngineState.STOPPING;
    this.logger.info('Stopping engine...');
    
    // Cancel animation frame
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    
    this.state = EngineState.STOPPED;
    this.events.emit('engine:stopped');
    this.logger.info('Engine stopped');
  }

  /**
   * Pauses the engine.
   */
  pause(): void {
    if (this.state !== EngineState.RUNNING) {
      this.logger.warn('Engine is not running');
      return;
    }
    
    this.state = EngineState.PAUSED;
    this.time.pause();
    this.events.emit('engine:paused');
    this.logger.info('Engine paused');
  }

  /**
   * Resumes the engine.
   */
  resume(): void {
    if (this.state !== EngineState.PAUSED) {
      this.logger.warn('Engine is not paused');
      return;
    }
    
    this.state = EngineState.RUNNING;
    this.time.resume();
    this.lastFrameTime = performance.now();
    this.events.emit('engine:resumed');
    this.logger.info('Engine resumed');
  }

  /**
   * Main game loop.
   */
  private gameLoop = (timestamp: number): void => {
    if (this.state !== EngineState.RUNNING) {
      return;
    }
    
    // Frame rate limiting
    if (this.targetFrameTime > 0) {
      const elapsed = timestamp - this.lastFrameTime;
      if (elapsed < this.targetFrameTime) {
        this.animationFrameId = requestAnimationFrame(this.gameLoop);
        return;
      }
    }
    
    this.lastFrameTime = timestamp;
    
    // Start frame profiling
    if (this.enableProfiling) {
      profiler.beginFrame();
      profiler.start('frame');
    }
    
    // Update time
    this.time.update(timestamp);
    
    // Update input
    if (this.enableProfiling) profiler.start('input');
    // Input update happens automatically via event listeners
    if (this.enableProfiling) profiler.end('input');
    
    // Fixed timestep updates (physics)
    if (this.enableProfiling) profiler.start('fixed-update');
    while (this.time.consumeFixedUpdate()) {
      this.fixedUpdate(this.time.fixedDeltaTime);
    }
    if (this.enableProfiling) profiler.end('fixed-update');
    
    // Variable timestep update (game logic)
    if (this.enableProfiling) profiler.start('update');
    this.update(this.time.deltaTime);
    if (this.enableProfiling) profiler.end('update');
    
    // Render
    if (this.enableProfiling) profiler.start('render');
    this.render();
    if (this.enableProfiling) profiler.end('render');
    
    // Update input state (clear pressed/released)
    this.input.update();
    
    // End frame profiling
    if (this.enableProfiling) {
      profiler.end('frame');
      profiler.endFrame();
    }
    
    // Request next frame
    this.animationFrameId = requestAnimationFrame(this.gameLoop);
  };

  /**
   * Fixed timestep update (for physics).
   * @param fixedDeltaTime - Fixed delta time
   */
  private fixedUpdate(fixedDeltaTime: number): void {
    this.events.emit('engine:fixed-update', { deltaTime: fixedDeltaTime });
  }

  /**
   * Variable timestep update (for game logic).
   * @param deltaTime - Delta time since last frame
   */
  private update(deltaTime: number): void {
    // Update scene
    if (this._scene) {
      this._scene.update(deltaTime);
    }
    
    this.events.emit('engine:update', { deltaTime });
  }

  /**
   * Render frame.
   */
  private render(): void {
    // Clear canvas (if exists)
    if (this.canvas) {
      const ctx = this.canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, this.width, this.height);
      }
    }
    
    this.events.emit('engine:render');
  }

  /**
   * Gets the engine state.
   * @returns Current engine state
   */
  getState(): EngineState {
    return this.state;
  }

  /**
   * Checks if engine is running.
   * @returns True if running
   */
  isRunning(): boolean {
    return this.state === EngineState.RUNNING;
  }

  /**
   * Checks if engine is paused.
   * @returns True if paused
   */
  isPaused(): boolean {
    return this.state === EngineState.PAUSED;
  }

  /**
   * Gets the event system.
   * @returns Event system
   */
  getEvents(): EventSystem {
    return this.events;
  }

  /**
   * Resizes the canvas.
   * @param width - New width
   * @param height - New height
   */
  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    
    if (this.canvas) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
    
    this.events.emit('engine:resize', { width, height });
    this.logger.info(`Engine resized to ${width}x${height}`);
  }

  /**
   * Destroys the engine and cleans up resources.
   */
  destroy(): void {
    this.stop();
    
    // Destroy scene
    if (this._scene) {
      this._scene.destroy();
      this._scene = null;
    }
    
    // Detach input
    this.input.detach();
    
    // Unload all resources
    this.resources.unloadAll();
    
    // Clear events
    this.events.clear();
    
    this.logger.info('Engine destroyed');
  }
}
