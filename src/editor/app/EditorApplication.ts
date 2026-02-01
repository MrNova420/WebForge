/**
 * @fileoverview EditorApplication - Main WebForge Editor Orchestrator
 * @module editor/app
 * 
 * Central controller for the WebForge visual editor.
 * Manages all editor subsystems, panels, and coordinates between backend systems.
 * 
 * @author MrNova420
 * @license MIT
 */

import { EventSystem } from '../../core/EventSystem';
import { Logger } from '../../core/Logger';
import { GameObject } from '../../scene/GameObject';
import { WebGLContext } from '../../rendering/WebGLContext';
import { EditorContext, TransformMode, TransformSpace } from '../EditorContext';
import { EditorRenderer } from './EditorRenderer';
import { EditorScene } from './EditorScene';
import { EditorSelection } from './EditorSelection';
import { UndoManager } from './EditorCommands';
import { EditorKeyboard } from './EditorKeyboard';

/**
 * Editor configuration options
 */
export interface EditorConfig {
    /** Canvas element for 3D viewport */
    canvas: HTMLCanvasElement;
    /** Enable debug mode */
    debug?: boolean;
    /** Auto-create demo scene */
    createDemoScene?: boolean;
    /** Target FPS */
    targetFPS?: number;
}

/**
 * Editor panel references
 */
export interface EditorPanels {
    hierarchy?: HTMLElement;
    inspector?: HTMLElement;
    console?: HTMLElement;
    assets?: HTMLElement;
    sceneView?: HTMLElement;
}

/**
 * Editor statistics
 */
export interface EditorStats {
    fps: number;
    frameTime: number;
    drawCalls: number;
    triangles: number;
    gameObjects: number;
    vertices: number;
}

/**
 * Main WebForge Editor Application
 * 
 * Orchestrates all editor subsystems and provides a unified API
 * for the editor UI to interact with the backend systems.
 */
export class EditorApplication {
    // Core systems
    private logger: Logger;
    private events: EventSystem;
    private context: EditorContext;
    
    // WebGL systems
    private glContext: WebGLContext | null = null;
    private renderer: EditorRenderer | null = null;
    
    // Scene management
    private scene: EditorScene | null = null;
    private _selection: EditorSelection;
    
    // Command/Undo system
    private undoManager: UndoManager;
    
    // Input handling
    private keyboard: EditorKeyboard;
    
    // Configuration
    private config: EditorConfig;
    
    // State
    private isInitialized: boolean = false;
    private isRunning: boolean = false;
    private isPaused: boolean = false;
    private isPlaying: boolean = false; // Game preview mode
    
    // Animation loop
    private animationFrameId: number | null = null;
    private lastFrameTime: number = 0;
    private frameCount: number = 0;
    private fpsUpdateTime: number = 0;
    private currentFPS: number = 0;
    
    // Stats
    private stats: EditorStats = {
        fps: 0,
        frameTime: 0,
        drawCalls: 0,
        triangles: 0,
        gameObjects: 0,
        vertices: 0
    };

    /**
     * Creates a new EditorApplication
     * @param config - Editor configuration
     */
    constructor(config: EditorConfig) {
        this.config = {
            debug: false,
            createDemoScene: true,
            targetFPS: 60,
            ...config
        };
        
        this.logger = new Logger('EditorApplication');
        this.events = new EventSystem();
        this.context = new EditorContext();
        this._selection = new EditorSelection(this.context);
        this.undoManager = new UndoManager();
        this.keyboard = new EditorKeyboard(this);
        
        this.logger.info('EditorApplication created');
    }

    /**
     * Initialize the editor
     */
    async initialize(): Promise<void> {
        if (this.isInitialized) {
            this.logger.warn('Editor already initialized');
            return;
        }
        
        this.logger.info('Initializing WebForge Editor...');
        
        try {
            // Initialize WebGL context
            this.glContext = new WebGLContext({
                canvas: this.config.canvas,
                antialias: true,
                alpha: false,
                depth: true,
                stencil: true
            });
            await this.glContext.initialize();
            this.logger.info('WebGL context initialized');
            
            // Initialize renderer
            this.renderer = new EditorRenderer(this.glContext, this.context);
            this.logger.info('Editor renderer initialized');
            
            // Initialize scene
            this.scene = new EditorScene(this.context);
            if (this.config.createDemoScene) {
                this.scene.createDemoScene();
            }
            this.logger.info('Editor scene initialized');
            
            // Setup selection listeners
            this.setupSelectionListeners();
            
            // Setup keyboard shortcuts
            this.keyboard.initialize();
            
            // Setup resize handler
            this.setupResizeHandler();
            
            // Update hierarchy with initial objects
            this.updateHierarchy();
            
            this.isInitialized = true;
            this.events.emit('initialized');
            this.logger.info('WebForge Editor initialized successfully');
            
        } catch (error) {
            this.logger.error('Failed to initialize editor', error);
            throw error;
        }
    }

    /**
     * Start the editor render loop
     */
    start(): void {
        if (!this.isInitialized) {
            throw new Error('Editor not initialized. Call initialize() first.');
        }
        
        if (this.isRunning) {
            this.logger.warn('Editor already running');
            return;
        }
        
        this.isRunning = true;
        this.lastFrameTime = performance.now();
        this.fpsUpdateTime = this.lastFrameTime;
        this.loop();
        
        this.events.emit('started');
        this.logger.info('Editor started');
    }

    /**
     * Stop the editor
     */
    stop(): void {
        if (!this.isRunning) return;
        
        this.isRunning = false;
        if (this.animationFrameId !== null) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        
        this.events.emit('stopped');
        this.logger.info('Editor stopped');
    }

    /**
     * Main render loop
     */
    private loop = (): void => {
        if (!this.isRunning) return;
        
        this.animationFrameId = requestAnimationFrame(this.loop);
        
        const now = performance.now();
        const deltaTime = (now - this.lastFrameTime) / 1000;
        this.lastFrameTime = now;
        
        // Update FPS counter
        this.frameCount++;
        if (now - this.fpsUpdateTime >= 1000) {
            this.currentFPS = this.frameCount;
            this.frameCount = 0;
            this.fpsUpdateTime = now;
            this.updateStats();
        }
        
        // Update scene (if playing)
        if (this.isPlaying && this.scene) {
            this.scene.update(deltaTime);
        }
        
        // Render
        if (this.renderer && this.scene) {
            this.renderer.render(this.scene, deltaTime);
        }
    };

    /**
     * Update editor statistics
     */
    private updateStats(): void {
        this.stats.fps = this.currentFPS;
        this.stats.frameTime = 1000 / Math.max(1, this.currentFPS);
        
        if (this.renderer) {
            const renderStats = this.renderer.getStats();
            this.stats.drawCalls = renderStats.drawCalls;
            this.stats.triangles = renderStats.triangles;
            this.stats.vertices = renderStats.vertices;
        }
        
        if (this.scene) {
            this.stats.gameObjects = this.scene.getObjectCount();
        }
        
        this.events.emit('statsUpdated', this.stats);
    }

    /**
     * Setup selection change listeners
     */
    private setupSelectionListeners(): void {
        this.context.on('selectionChanged', (objects: GameObject[]) => {
            this.events.emit('selectionChanged', objects);
            this.updateInspector();
            
            // Auto-switch to Translate mode when selecting an object (if in Select mode)
            if (objects.length > 0 && this.context.getTransformMode() === TransformMode.SELECT) {
                this.context.setTransformMode(TransformMode.TRANSLATE);
            }
        });
        
        this.context.on('transformModeChanged', (mode: TransformMode) => {
            this.events.emit('transformModeChanged', mode);
        });
    }

    /**
     * Setup window resize handler
     */
    private setupResizeHandler(): void {
        const resizeObserver = new ResizeObserver(() => {
            this.handleResize();
        });
        
        const parent = this.config.canvas.parentElement;
        if (parent) {
            resizeObserver.observe(parent);
        }
        
        // Initial resize
        this.handleResize();
    }

    /**
     * Handle canvas resize
     */
    private handleResize(): void {
        const parent = this.config.canvas.parentElement;
        if (!parent) return;
        
        const width = parent.clientWidth;
        const height = parent.clientHeight;
        
        if (width > 0 && height > 0) {
            this.config.canvas.width = width;
            this.config.canvas.height = height;
            
            if (this.glContext) {
                this.glContext.resize(width, height);
            }
            
            if (this.renderer) {
                this.renderer.resize(width, height);
            }
            
            this.events.emit('resized', { width, height });
        }
    }

    // ========== Panel Connections ==========

    /**
     * Update hierarchy panel
     */
    updateHierarchy(): void {
        if (!this.scene) return;
        
        const objects = this.scene.getAllGameObjects();
        this.events.emit('hierarchyUpdated', objects);
    }

    /**
     * Update inspector panel
     */
    updateInspector(): void {
        const selected = this.context.getSelection();
        this.events.emit('inspectorUpdated', selected);
    }

    /**
     * Log message to console panel
     */
    log(message: string, type: 'info' | 'warn' | 'error' | 'success' = 'info'): void {
        this.events.emit('consoleLog', { message, type, time: new Date() });
    }

    // ========== Scene Operations ==========

    /**
     * Create a new GameObject
     */
    createGameObject(name: string = 'GameObject'): GameObject | null {
        if (!this.scene) return null;
        
        const gameObject = this.scene.createGameObject(name);
        this.updateHierarchy();
        this.log(`Created: ${name}`, 'success');
        return gameObject;
    }

    /**
     * Create primitive
     */
    createPrimitive(type: 'cube' | 'sphere' | 'plane' | 'cylinder' | 'cone', position?: { x: number; y: number; z: number }): GameObject | null {
        if (!this.scene) return null;
        
        const gameObject = this.scene.createPrimitive(type);
        if (position) {
            gameObject.transform.position.set(position.x, position.y, position.z);
            gameObject.transform.markLocalDirty();
        }
        this.updateHierarchy();
        this.log(`Created ${type}`, 'success');
        return gameObject;
    }

    /**
     * Create light
     */
    createLight(type: 'directional' | 'point' | 'spot', position?: { x: number; y: number; z: number }): GameObject | null {
        if (!this.scene) return null;
        
        const gameObject = this.scene.createLight(type);
        if (position) {
            gameObject.transform.position.set(position.x, position.y, position.z);
            gameObject.transform.markLocalDirty();
        }
        this.updateHierarchy();
        this.log(`Created ${type} light`, 'success');
        return gameObject;
    }

    /**
     * Delete selected GameObjects
     */
    deleteSelected(): void {
        const selected = this.context.getSelection();
        if (selected.length === 0) return;
        
        for (const obj of selected) {
            this.scene?.removeGameObject(obj);
        }
        
        this.context.clearSelection();
        this.updateHierarchy();
        this.log(`Deleted ${selected.length} object(s)`, 'info');
    }

    /**
     * Duplicate selected GameObjects
     */
    duplicateSelected(): void {
        const selected = this.context.getSelection();
        if (selected.length === 0 || !this.scene) return;
        
        const newObjects: GameObject[] = [];
        for (const obj of selected) {
            const clone = obj.clone();
            clone.name = obj.name + '_copy';
            this.scene.addGameObject(clone);
            newObjects.push(clone);
        }
        
        this.context.setSelection(newObjects);
        this.updateHierarchy();
        this.log(`Duplicated ${selected.length} object(s)`, 'success');
    }

    /**
     * Select a GameObject by name
     */
    selectByName(name: string): void {
        if (!this.scene) return;
        
        const obj = this.scene.findByName(name);
        if (obj) {
            this.context.setSelection([obj]);
        }
    }

    /**
     * Frame selected objects (focus camera on selection)
     */
    frameSelected(): void {
        const selected = this.context.getSelection();
        if (selected.length === 0 || !this.renderer) return;
        
        this.renderer.frameObjects(selected);
        this.log('Framed selection', 'info');
    }

    /**
     * Update live placement preview position
     */
    setPreviewPosition(pos: { x: number; y: number; z: number } | null, type?: string): void {
        this.renderer?.setPreviewPosition(pos, type);
    }

    /**
     * Clear placement preview
     */
    clearPreviewPosition(): void {
        this.renderer?.clearPreviewPosition();
    }

    /**
     * Convert normalized screen coords to ground-plane hit (y=0)
     */
    screenToGround(normX: number, normY: number) {
        return this.renderer?.screenToGround(normX, normY) || null;
    }

    /**
     * Raycast to surfaces for placement
     */
    screenToSurface(normX: number, normY: number) {
        return this.renderer?.screenToSurface(normX, normY) || null;
    }

    // ========== Transform Mode ==========

    /**
     * Set transform mode
     */
    setTransformMode(mode: TransformMode): void {
        this.context.setTransformMode(mode);
    }

    /**
     * Set transform space
     */
    setTransformSpace(space: TransformSpace): void {
        this.context.setTransformSpace(space);
    }

    /**
     * Toggle grid snapping
     */
    toggleGridSnap(): void {
        const settings = this.context.getSnappingSettings();
        this.context.setGridSnapping(!settings.gridSnapping);
        this.log(`Grid snap: ${!settings.gridSnapping ? 'ON' : 'OFF'}`, 'info');
    }

    toggleGrid(): void {
        if (this.renderer) {
            this.renderer.toggleGrid();
            this.log(`Grid: ${this.renderer.isGridVisible() ? 'ON' : 'OFF'}`, 'info');
        }
    }

    /**
     * Undo last action
     */
    undo(): void {
        if (this.undoManager.undo()) {
            this.updateHierarchy();
            this.updateInspector();
            this.log('Undo', 'info');
        }
    }

    /**
     * Redo last undone action
     */
    redo(): void {
        if (this.undoManager.redo()) {
            this.updateHierarchy();
            this.updateInspector();
            this.log('Redo', 'info');
        }
    }

    // ========== Play Mode ==========

    /**
     * Start game preview
     */
    play(): void {
        if (this.isPlaying) return;
        
        this.isPlaying = true;
        this.scene?.saveState();
        this.events.emit('playStarted');
        this.log('Play mode started', 'success');
    }

    /**
     * Pause game preview
     */
    pause(): void {
        if (!this.isPlaying) return;
        
        this.isPaused = !this.isPaused;
        this.events.emit('playPaused', this.isPaused);
        this.log(this.isPaused ? 'Paused' : 'Resumed', 'info');
    }

    /**
     * Stop game preview
     */
    stopPlay(): void {
        if (!this.isPlaying) return;
        
        this.isPlaying = false;
        this.isPaused = false;
        this.scene?.restoreState();
        this.events.emit('playStopped');
        this.log('Play mode stopped', 'info');
    }

    // ========== View Controls ==========

    /**
     * Set camera view
     */
    setView(view: 'top' | 'front' | 'right' | 'perspective'): void {
        if (!this.renderer) return;
        this.renderer.setView(view);
        this.log(`View: ${view}`, 'info');
    }

    /**
     * Toggle wireframe mode
     */
    toggleWireframe(): void {
        if (!this.renderer) return;
        const current = this.context.getViewportSettings().wireframe;
        this.context.setWireframe(!current);
        this.renderer.setWireframe(!current);
    }

    // ========== Getters ==========

    /**
     * Get editor context
     */
    getContext(): EditorContext {
        return this.context;
    }

    /**
     * Get current selection
     */
    getSelection(): GameObject[] {
        return this.context.getSelection();
    }

    /**
     * Get editor scene
     */
    getScene(): EditorScene | null {
        return this.scene;
    }

    /**
     * Get selection manager
     */
    getSelectionManager(): EditorSelection {
        return this._selection;
    }

    /**
     * Get editor stats
     */
    getStats(): EditorStats {
        return { ...this.stats };
    }

    /**
     * Get event system for subscriptions
     */
    getEvents(): EventSystem {
        return this.events;
    }

    /**
     * Check if editor is playing
     */
    getIsPlaying(): boolean {
        return this.isPlaying;
    }

    /**
     * Check if editor is paused
     */
    getIsPaused(): boolean {
        return this.isPaused;
    }

    // ========== Cleanup ==========

    /**
     * Dispose of all resources
     */
    dispose(): void {
        this.stop();
        
        this.keyboard.dispose();
        this.renderer?.dispose();
        this.scene?.dispose();
        this.glContext?.destroy();
        
        this.events.clear();
        this.isInitialized = false;
        
        this.logger.info('Editor disposed');
    }
}
