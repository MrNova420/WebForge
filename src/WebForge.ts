/**
 * @fileoverview WebForge - Main Engine Class
 * @module WebForge
 * 
 * Main entry point for WebForge game engine.
 * Provides a unified API wrapping the real Engine, Scene, Camera,
 * Renderer, PhysicsWorld, and other subsystems.
 * 
 * @example
 * ```typescript
 * import { WebForge } from '@webforge/platform';
 * 
 * const engine = new WebForge({ antialias: true });
 * await engine.initialize();
 * 
 * const player = engine.createGameObject('Player');
 * player.transform.position.set(0, 1, 0);
 * 
 * engine.start();
 * ```
 * 
 * @author MrNova420
 * @license MIT
 */

import { Engine, EngineConfig } from './core/Engine';
import { Scene } from './scene/Scene';
import { GameObject } from './scene/GameObject';
import { Camera } from './rendering/Camera';
import { PhysicsWorld, PhysicsWorldConfig } from './physics/PhysicsWorld';
import { Vector3 } from './math/Vector3';
import { Time } from './core/Time';
import { Input } from './core/Input';
import { EventSystem } from './core/EventSystem';

/**
 * Quality presets for automatic configuration
 */
export enum QualityPreset {
    LOW = 'low',
    MEDIUM = 'medium',
    HIGH = 'high',
    ULTRA = 'ultra',
    AUTO = 'auto'
}

/**
 * Engine configuration options
 */
export interface WebForgeConfig {
    /** Canvas element or selector */
    canvas?: string | HTMLCanvasElement;
    /** Quality preset */
    quality?: QualityPreset | string;
    /** Enable physics simulation */
    physics?: boolean;
    /** Enable audio system */
    audio?: boolean;
    /** Enable particle system */
    particles?: boolean;
    /** Enable animation system */
    animations?: boolean;
    /** Width override (auto-detect if not specified) */
    width?: number;
    /** Height override (auto-detect if not specified) */
    height?: number;
    /** Enable hot reload */
    hotReload?: boolean;
    /** Enable debug mode */
    debug?: boolean;
    /** Target frame rate (0 = unlimited) */
    targetFPS?: number;
    /** Fixed timestep for physics (0 = variable) */
    fixedTimestep?: number;
    /** Headless mode (no rendering, server-side) */
    headless?: boolean;
    /** Enable anti-aliasing */
    antialias?: boolean;
    /** Gravity vector for physics */
    gravity?: Vector3;
}

/**
 * Main WebForge Engine class
 * 
 * Provides unified access to all engine subsystems and lifecycle management.
 * Wraps the real Engine, Scene, Camera, Renderer, and PhysicsWorld implementations.
 * 
 * @example Complete Engine Mode
 * ```typescript
 * const engine = new WebForge();
 * await engine.initialize();
 * const scene = engine.createScene('MyScene');
 * const player = engine.createGameObject('Player');
 * player.transform.position.set(0, 1, 0);
 * engine.start();
 * ```
 */
export class WebForge {
    private _engine: Engine;
    private config: WebForgeConfig;
    private _isInitialized: boolean = false;
    private _camera: Camera | null = null;
    private _physics: PhysicsWorld | null = null;
    private _scene: Scene | null = null;
    private _events: EventSystem;

    /**
     * Creates a new WebForge engine instance
     * 
     * @param canvasOrConfig - Canvas element, selector, or config object
     * @param config - Configuration options (if first param is canvas)
     */
    constructor(canvasOrConfig?: string | HTMLCanvasElement | WebForgeConfig, config?: WebForgeConfig) {
        // Parse arguments
        if (typeof canvasOrConfig === 'object' && !(canvasOrConfig instanceof HTMLCanvasElement)) {
            this.config = canvasOrConfig;
        } else {
            this.config = config || {};
            if (canvasOrConfig) {
                this.config.canvas = canvasOrConfig;
            }
        }

        // Apply defaults
        this.config = {
            quality: QualityPreset.AUTO,
            physics: true,
            audio: true,
            particles: true,
            animations: true,
            debug: false,
            targetFPS: 60,
            fixedTimestep: 1/60,
            headless: false,
            hotReload: false,
            antialias: true,
            ...this.config
        };

        // Build EngineConfig from WebForgeConfig
        const engineConfig: EngineConfig = {
            canvas: this.config.canvas,
            width: this.config.width,
            height: this.config.height,
            antialias: this.config.antialias,
            fixedTimestep: this.config.fixedTimestep,
            targetFPS: this.config.targetFPS,
            enableProfiling: this.config.debug,
        };

        this._engine = new Engine(engineConfig);
        this._events = new EventSystem();

        console.log('🔥 WebForge Engine Created');
    }

    /**
     * Initialize the engine and all subsystems
     * Must be called before using the engine
     * 
     * @returns Promise that resolves when initialization is complete
     */
    async initialize(): Promise<void> {
        if (this._isInitialized) {
            console.warn('Engine already initialized');
            return;
        }

        console.log('🚀 Initializing WebForge Engine...');

        // Initialize physics
        if (this.config.physics) {
            const physicsConfig: PhysicsWorldConfig = {
                fixedTimestep: this.config.fixedTimestep,
            };
            if (this.config.gravity) {
                physicsConfig.gravity = this.config.gravity;
            }
            this._physics = new PhysicsWorld(physicsConfig);
            console.log('✅ Physics initialized');
        }

        // Create default camera
        this._camera = new Camera();
        this._camera.setPosition(new Vector3(0, 5, 10));
        this._camera.lookAt(new Vector3(0, 0, 0));
        console.log('✅ Camera initialized');

        // Create default scene
        this._scene = new Scene('Default');
        this._engine.setScene(this._scene);
        console.log('✅ Default scene created');

        // Wire physics into engine fixed update
        if (this._physics) {
            this._engine.getEvents().on('engine:fixed-update', (data: { deltaTime: number }) => {
                this._physics!.step(data.deltaTime);
            });
        }

        this._isInitialized = true;
        console.log('🎉 WebForge Engine Ready!');
    }

    /**
     * Create a new scene
     * 
     * @param name - Optional scene name
     * @returns The created Scene instance
     */
    createScene(name?: string): Scene {
        const scene = new Scene(name || 'Scene');
        this._scene = scene;
        this._engine.setScene(scene);
        return scene;
    }

    /**
     * Get the active scene
     */
    getScene(): Scene | null {
        return this._scene;
    }

    /**
     * Create a new GameObject and add it to the active scene
     * 
     * @param name - Optional object name
     * @returns The created GameObject instance
     */
    createGameObject(name?: string): GameObject {
        const obj = new GameObject(name);
        if (this._scene) {
            this._scene.add(obj);
        }
        return obj;
    }

    /**
     * Start the engine render loop
     */
    async start(): Promise<void> {
        if (!this._isInitialized) {
            // Auto-initialize if not done
            await this.initialize();
        }

        await this._engine.start();
        console.log('▶️  WebForge started');
    }

    /**
     * Stop the engine
     */
    stop(): void {
        this._engine.stop();
        console.log('⏸️  WebForge stopped');
    }

    /**
     * Pause the engine (rendering continues, updates stop)
     */
    pause(): void {
        this._engine.pause();
    }

    /**
     * Resume the engine from pause
     */
    resume(): void {
        this._engine.resume();
    }

    // ========== Accessors ==========

    /**
     * Get the underlying Engine instance
     */
    get engine(): Engine {
        return this._engine;
    }

    /**
     * Get the Time system
     */
    get time(): Time {
        return this._engine.time;
    }

    /**
     * Get the Input system
     */
    get input(): Input {
        return this._engine.input;
    }

    /**
     * Get the camera
     */
    get camera(): Camera | null {
        return this._camera;
    }

    /**
     * Set the camera
     */
    set camera(cam: Camera | null) {
        this._camera = cam;
    }

    /**
     * Get the active scene
     */
    get scene(): Scene | null {
        return this._scene;
    }

    /**
     * Get the physics world
     */
    get physics(): PhysicsWorld | null {
        return this._physics;
    }

    /**
     * Get the event system
     */
    get events(): EventSystem {
        return this._events;
    }

    /**
     * Get current FPS
     */
    get fps(): number {
        return this._engine.time.fps;
    }

    /**
     * Check if engine is initialized
     */
    get isInitialized(): boolean {
        return this._isInitialized;
    }

    /**
     * Check if engine is running
     */
    get isRunning(): boolean {
        return this._engine.isRunning();
    }

    /**
     * Check if engine is paused
     */
    get isPaused(): boolean {
        return this._engine.isPaused();
    }

    /**
     * Resize the canvas
     * 
     * @param width - New width
     * @param height - New height
     */
    resize(width: number, height: number): void {
        this._engine.resize(width, height);
        if (this._camera) {
            this._camera.setPerspective(Math.PI / 4, width / height, 0.1, 1000);
        }
    }

    /**
     * Dispose of all resources and cleanup
     */
    dispose(): void {
        this._engine.destroy();
        if (this._physics) {
            this._physics.dispose();
        }
        this._scene = null;
        this._camera = null;
        this._physics = null;
        this._isInitialized = false;
        console.log('🗑️  WebForge disposed');
    }
}

// Default export for convenience
export default WebForge;
