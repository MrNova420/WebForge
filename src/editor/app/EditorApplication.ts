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
import { UndoManager, CreateObjectCommand, EditorCommands } from './EditorCommands';
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
        this.updateStats(); // Emit initial stats so UI shows correct object count immediately
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
            this.watchSelectedTransforms(objects);
            
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
     * Watch selected objects' transforms for live inspector updates
     */
    private transformWatchCallbacks: Array<() => void> = [];
    private watchSelectedTransforms(objects: GameObject[]): void {
        // Remove old watchers
        this.transformWatchCallbacks = [];
        
        // Add change callbacks to selected objects
        for (const obj of objects) {
            const callback = () => {
                this.events.emit('inspectorUpdated', this.context.getSelection());
                this.events.emit('propertyChanged', { object: obj, property: 'transform' });
            };
            obj.transform.onChange(callback);
            this.transformWatchCallbacks.push(callback);
        }
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
        
        // Record for undo
        const sceneRef = this.scene;
        this.undoManager.execute(
            EditorCommands.createObject(
                gameObject,
                (obj) => { sceneRef.addGameObject(obj); },
                (obj) => { sceneRef.removeGameObject(obj); }
            )
        );
        
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
        
        // Record for undo
        const sceneRef = this.scene;
        this.undoManager.execute(
            EditorCommands.createObject(
                gameObject,
                (obj) => { sceneRef.addGameObject(obj); },
                (obj) => { sceneRef.removeGameObject(obj); }
            )
        );
        
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
        
        // Record for undo
        const sceneRef = this.scene;
        this.undoManager.execute(
            EditorCommands.createObject(
                gameObject,
                (obj) => { sceneRef.addGameObject(obj); },
                (obj) => { sceneRef.removeGameObject(obj); }
            )
        );
        
        this.updateHierarchy();
        this.log(`Created ${type} light`, 'success');
        return gameObject;
    }

    /**
     * Delete selected GameObjects
     */
    deleteSelected(): void {
        const selected = this.context.getSelection();
        if (selected.length === 0 || !this.scene) return;
        
        const sceneRef = this.scene;
        
        if (selected.length === 1) {
            this.undoManager.execute(
                EditorCommands.deleteObject(
                    selected[0],
                    (obj) => { sceneRef.addGameObject(obj); },
                    (obj) => { sceneRef.removeGameObject(obj); }
                )
            );
        } else {
            // Batch delete
            const commands = selected.map(obj =>
                EditorCommands.deleteObject(
                    obj,
                    (o) => { sceneRef.addGameObject(o); },
                    (o) => { sceneRef.removeGameObject(o); }
                )
            );
            this.undoManager.execute(
                EditorCommands.composite(commands, `Delete ${selected.length} objects`)
            );
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
        
        const sceneRef = this.scene;
        const newObjects: GameObject[] = [];
        const commands: CreateObjectCommand[] = [];
        
        for (const obj of selected) {
            const clone = obj.clone();
            clone.name = obj.name + '_copy';
            sceneRef.addGameObject(clone);
            newObjects.push(clone);
            commands.push(
                EditorCommands.createObject(
                    clone,
                    (o) => { sceneRef.addGameObject(o); },
                    (o) => { sceneRef.removeGameObject(o); }
                )
            );
        }
        
        if (commands.length === 1) {
            this.undoManager.execute(commands[0]);
        } else {
            this.undoManager.execute(
                EditorCommands.composite(commands, `Duplicate ${selected.length} objects`)
            );
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
     * Select all GameObjects in the scene
     */
    selectAll(): void {
        if (!this.scene) return;

        const all = this.scene.getAllGameObjects();
        this.context.setSelection(all);
    }

    /**
     * Deselect all GameObjects
     */
    deselectAll(): void {
        this.context.clearSelection();
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

    /**
     * Get undo manager for external access
     */
    getUndoManager(): UndoManager {
        return this.undoManager;
    }

    /**
     * Change a selected object's position with undo support
     */
    setObjectPosition(obj: GameObject, x: number, y: number, z: number): void {
        const newPos = obj.transform.position.clone();
        newPos.set(x, y, z);
        this.undoManager.execute(EditorCommands.createPositionChange(obj, newPos));
        this.updateInspector();
    }

    /**
     * Change a selected object's scale with undo support
     */
    setObjectScale(obj: GameObject, x: number, y: number, z: number): void {
        const newScale = obj.transform.scale.clone();
        newScale.set(x, y, z);
        this.undoManager.execute(EditorCommands.createScaleChange(obj, newScale));
        this.updateInspector();
    }

    /**
     * Rename an object with undo support
     */
    renameObject(obj: GameObject, newName: string): void {
        this.undoManager.execute(EditorCommands.rename(obj, newName));
        this.updateHierarchy();
        this.updateInspector();
    }

    // ========== Play Mode ==========

    /**
     * Start game preview
     */
    play(): void {
        if (this.isPlaying) return;
        
        this.isPlaying = true;
        this.scene?.saveState();
        this.scene?.initPhysics();
        this.events.emit('playStarted');
        this.log('Play mode started (physics + animation active)', 'success');
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
        this.scene?.disposePhysics();
        this.scene?.clearAnimationPlayers();
        this.scene?.restoreState();
        this.events.emit('playStopped');
        this.log('Play mode stopped', 'info');
    }

    // ========== Scene Save/Load ==========

    /**
     * Save scene to JSON and return it
     */
    saveScene(): string | null {
        if (!this.scene) return null;

        const json = this.scene.toJSON();
        const data = JSON.stringify(json, null, 2);
        this.log('Scene saved', 'success');
        return data;
    }

    /**
     * Load scene from JSON string
     */
    loadScene(data: string): boolean {
        if (!this.scene) return false;

        try {
            const json = JSON.parse(data);
            this.scene.fromJSON(json);
            this.context.clearSelection();
            this.updateHierarchy();
            this.log(`Scene loaded — ${this.scene.getObjectCount()} objects`, 'success');
            return true;
        } catch (error) {
            this.logger.error('Failed to load scene', error);
            this.log('Failed to load scene: invalid data', 'error');
            return false;
        }
    }

    /**
     * Create a new empty scene
     */
    newScene(): void {
        if (!this.scene) return;

        this.scene.clear();
        this.context.clearSelection();
        this.updateHierarchy();
        this.log('New scene created', 'success');
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

    // ========== Panel Data Operations ==========

    /**
     * Get material data for the currently selected object
     */
    getSelectedMaterial(): { color: [number, number, number]; metallic: number; roughness: number; emission: [number, number, number]; opacity: number; shader: string } | null {
        const sel = this.context.getSelection();
        if (sel.length === 0) return null;
        const obj = sel[0] as any;
        return {
            color: obj.editorColor || [0.5, 0.5, 0.5],
            metallic: obj.materialMetallic ?? 0,
            roughness: obj.materialRoughness ?? 0.5,
            emission: obj.materialEmission || [0, 0, 0],
            opacity: obj.materialOpacity ?? 1,
            shader: obj.materialShader || 'Standard PBR'
        };
    }

    /**
     * Set material property on selected object
     */
    setMaterialProperty(property: string, value: any): void {
        const sel = this.context.getSelection();
        if (sel.length === 0) return;
        const obj = sel[0] as any;
        switch (property) {
            case 'color': obj.editorColor = value; break;
            case 'metallic': obj.materialMetallic = value; break;
            case 'roughness': obj.materialRoughness = value; break;
            case 'emission': obj.materialEmission = value; break;
            case 'opacity': obj.materialOpacity = value; break;
            case 'shader': obj.materialShader = value; break;
        }
        this.events.emit('materialChanged', { object: obj, property, value });
    }

    /**
     * Create a terrain object in the scene
     */
    createTerrain(width: number = 100, depth: number = 100, resolution: number = 64): any {
        if (!this.scene) return null;
        const terrain = this.scene.createGameObject('Terrain');
        const obj = terrain as any;
        obj.primitiveType = 'terrain';
        obj.editorColor = [0.35, 0.55, 0.25];
        obj.isTerrain = true;
        obj.terrainWidth = width;
        obj.terrainDepth = depth;
        obj.terrainResolution = resolution;
        obj.terrainLayers = [];
        obj.terrainHeightData = new Float32Array(resolution * resolution);
        obj._terrainVersion = 0;
        terrain.transform.scale.set(width, 1, depth);
        this.updateHierarchy();
        this.log(`Terrain created (${width}×${depth}, ${resolution}² resolution)`, 'success');
        return terrain;
    }

    /**
     * Get selected terrain object (if any)
     */
    getSelectedTerrain(): any | null {
        const sel = this.context.getSelection();
        if (sel.length === 0) return null;
        const obj = sel[0] as any;
        return obj.isTerrain ? obj : null;
    }

    /**
     * Bump terrain mesh version so the renderer rebuilds its VAO.
     */
    private bumpTerrainVersion(terrain: any): void {
        terrain._terrainVersion = (terrain._terrainVersion ?? 0) + 1;
    }

    /**
     * Apply terrain brush at a position
     */
    applyTerrainBrush(tool: string, x: number, z: number, brushSize: number, brushStrength: number): boolean {
        const terrain = this.getSelectedTerrain();
        if (!terrain || !terrain.terrainHeightData) return false;
        
        const res = terrain.terrainResolution || 64;
        const data = terrain.terrainHeightData as Float32Array;
        const radius = Math.floor((brushSize / 100) * res * 0.5);
        const strength = (brushStrength / 100) * 0.1;
        
        // Convert world position to heightmap coordinates
        const hx = Math.floor(((x / terrain.terrainWidth) + 0.5) * res);
        const hz = Math.floor(((z / terrain.terrainDepth) + 0.5) * res);
        
        for (let dz = -radius; dz <= radius; dz++) {
            for (let dx = -radius; dx <= radius; dx++) {
                const px = hx + dx;
                const pz = hz + dz;
                if (px < 0 || px >= res || pz < 0 || pz >= res) continue;
                
                const dist = Math.sqrt(dx * dx + dz * dz) / radius;
                if (dist > 1) continue;
                
                // Smoothstep falloff (3t² - 2t³) for natural brush transitions
                const falloff = 1 - (3 * dist * dist - 2 * dist * dist * dist);
                const idx = pz * res + px;
                
                switch (tool) {
                    case 'raise':
                        data[idx] += strength * falloff;
                        break;
                    case 'lower':
                        data[idx] -= strength * falloff;
                        break;
                    case 'smooth': {
                        let sum = 0;
                        let count = 0;
                        for (let sy = -1; sy <= 1; sy++) {
                            for (let sx = -1; sx <= 1; sx++) {
                                const nx = px + sx;
                                const nz = pz + sy;
                                if (nx >= 0 && nx < res && nz >= 0 && nz < res) {
                                    sum += data[nz * res + nx];
                                    count++;
                                }
                            }
                        }
                        const avg = sum / count;
                        data[idx] += (avg - data[idx]) * strength * falloff * 5;
                        break;
                    }
                    case 'flatten':
                        data[idx] *= (1 - strength * falloff);
                        break;
                }
            }
        }
        
        this.bumpTerrainVersion(terrain);
        this.events.emit('terrainModified', { tool, x, z });
        return true;
    }

    /**
     * Generate terrain heightmap using noise
     */
    generateTerrainNoise(preset: string = 'hills'): boolean {
        const terrain = this.getSelectedTerrain();
        if (!terrain || !terrain.terrainHeightData) return false;
        
        const res = terrain.terrainResolution || 64;
        const data = terrain.terrainHeightData as Float32Array;
        
        const presets: Record<string, { freq: number; amp: number; octaves: number }> = {
            flat: { freq: 0, amp: 0, octaves: 1 },
            hills: { freq: 3, amp: 0.3, octaves: 4 },
            mountains: { freq: 2, amp: 0.8, octaves: 6 },
            valleys: { freq: 4, amp: 0.5, octaves: 5 },
            islands: { freq: 2, amp: 0.6, octaves: 4 }
        };
        
        const cfg = presets[preset] || presets.hills;
        
        // Simple multi-octave noise
        for (let z = 0; z < res; z++) {
            for (let x = 0; x < res; x++) {
                let height = 0;
                let amplitude = cfg.amp;
                let frequency = cfg.freq;
                
                for (let oct = 0; oct < cfg.octaves; oct++) {
                    const nx = (x / res) * frequency;
                    const nz = (z / res) * frequency;
                    // Simple hash-based noise
                    const val = Math.sin(nx * 12.9898 + nz * 78.233) * 43758.5453;
                    height += (val - Math.floor(val)) * amplitude;
                    amplitude *= 0.5;
                    frequency *= 2;
                }
                
                // Island mask (higher in center, lower at edges)
                if (preset === 'islands') {
                    const cx = (x / res - 0.5) * 2;
                    const cz = (z / res - 0.5) * 2;
                    const edgeDist = 1 - Math.sqrt(cx * cx + cz * cz);
                    height *= Math.max(0, edgeDist);
                }
                
                data[z * res + x] = height;
            }
        }
        
        this.bumpTerrainVersion(terrain);
        this.events.emit('terrainModified', { tool: 'generate', preset });
        this.log(`Terrain generated: ${preset}`, 'success');
        return true;
    }

    /**
     * Flatten/reset all terrain height data
     */
    resetTerrainHeight(): boolean {
        const terrain = this.getSelectedTerrain();
        if (!terrain || !terrain.terrainHeightData) return false;
        
        const data = terrain.terrainHeightData as Float32Array;
        data.fill(0);
        this.bumpTerrainVersion(terrain);
        this.events.emit('terrainModified', { tool: 'reset' });
        this.log('Terrain height reset', 'info');
        return true;
    }

    /**
     * Add a terrain texture layer
     */
    addTerrainLayer(name: string, color: string): boolean {
        const terrain = this.getSelectedTerrain();
        if (!terrain) return false;
        
        if (!terrain.terrainLayers) terrain.terrainLayers = [];
        terrain.terrainLayers.push({ name, color, weight: 1.0 });
        this.events.emit('terrainModified', { tool: 'addLayer', name });
        this.log(`Terrain layer added: ${name}`, 'success');
        return true;
    }

    /**
     * Export terrain heightmap as downloadable file
     */
    exportTerrainHeightmap(): boolean {
        const terrain = this.getSelectedTerrain();
        if (!terrain || !terrain.terrainHeightData) return false;
        
        const res = terrain.terrainResolution || 64;
        const data = terrain.terrainHeightData as Float32Array;
        
        // Export as JSON
        const json = JSON.stringify({
            resolution: res,
            width: terrain.terrainWidth,
            depth: terrain.terrainDepth,
            heights: Array.from(data)
        });
        
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `terrain_heightmap_${res}x${res}.json`;
        a.click();
        URL.revokeObjectURL(url);
        
        this.log('Heightmap exported', 'success');
        return true;
    }

    /**
     * Import terrain heightmap from file
     */
    importTerrainHeightmap(jsonString: string): boolean {
        const terrain = this.getSelectedTerrain();
        if (!terrain) return false;
        
        try {
            const parsed = JSON.parse(jsonString);
            if (parsed.heights && Array.isArray(parsed.heights)) {
                const res = parsed.resolution || terrain.terrainResolution || 64;
                terrain.terrainResolution = res;
                terrain.terrainHeightData = new Float32Array(parsed.heights);
                if (parsed.width) terrain.terrainWidth = parsed.width;
                if (parsed.depth) terrain.terrainDepth = parsed.depth;
                this.bumpTerrainVersion(terrain);
                this.events.emit('terrainModified', { tool: 'import' });
                this.log('Heightmap imported', 'success');
                return true;
            }
        } catch (e) {
            this.log('Failed to import heightmap: invalid format', 'error');
        }
        return false;
    }

    /**
     * Add an audio source component to the selected object
     */
    addAudioSource(): boolean {
        const sel = this.context.getSelection();
        if (sel.length === 0) return false;
        const obj = sel[0] as any;
        if (!obj._components) obj._components = [];
        obj._components.push({
            type: 'audio',
            enabled: true,
            volume: 1,
            spatial: true,
            loop: false,
            minDistance: 1,
            maxDistance: 50,
            clip: null
        });
        this.events.emit('selectionChanged', sel);
        this.log('Audio source added', 'success');
        return true;
    }

    /**
     * Set the audio clip URL on the selected object's audio component
     */
    setAudioClip(clipUrl: string, clipName: string): void {
        const sel = this.context.getSelection();
        if (sel.length === 0) return;
        const obj = sel[0] as any;
        const audioComp = obj._components?.find((c: any) => c.type === 'audio');
        if (audioComp) {
            audioComp.clip = clipUrl;
            audioComp.clipName = clipName;
            this.events.emit('audioChanged', { object: obj, clipUrl, clipName });
        }
    }

    /**
     * Add a particle system component to the selected object
     */
    addParticleSystem(preset?: string): boolean {
        const sel = this.context.getSelection();
        if (sel.length === 0) return false;
        const obj = sel[0] as any;
        if (!obj._components) obj._components = [];

        const presets: Record<string, any> = {
            fire: { shape: 'cone', rate: 100, lifetime: 1.5, speed: 3, size: 0.3, color: [1, 0.4, 0], gravity: -0.5 },
            smoke: { shape: 'sphere', rate: 30, lifetime: 4, speed: 1, size: 1.0, color: [0.5, 0.5, 0.5], gravity: -0.2 },
            sparks: { shape: 'point', rate: 200, lifetime: 0.5, speed: 8, size: 0.05, color: [1, 0.8, 0.2], gravity: 2 },
            rain: { shape: 'box', rate: 500, lifetime: 2, speed: 15, size: 0.02, color: [0.7, 0.8, 1], gravity: 9.8 },
            snow: { shape: 'box', rate: 100, lifetime: 5, speed: 1, size: 0.1, color: [1, 1, 1], gravity: 0.5 }
        };

        const config = preset && presets[preset] ? presets[preset] : presets.fire;
        obj._components.push({
            type: 'particle',
            enabled: true,
            ...config
        });
        this.events.emit('selectionChanged', sel);
        this.log(`Particle system added${preset ? ` (${preset})` : ''}`, 'success');
        return true;
    }

    /**
     * Get animation data for the selected object
     */
    getSelectedAnimation(): { clips: any[]; currentClip: string | null; isPlaying: boolean; currentTime: number } | null {
        const sel = this.context.getSelection();
        if (sel.length === 0) return null;
        const obj = sel[0] as any;
        return {
            clips: obj.animationClips || [],
            currentClip: obj.currentAnimClip || null,
            isPlaying: obj.animPlaying || false,
            currentTime: obj.animTime || 0
        };
    }

    /**
     * Add an animation clip to the selected object
     */
    addAnimationClip(name: string, duration: number = 1.0): boolean {
        const sel = this.context.getSelection();
        if (sel.length === 0) return false;
        const obj = sel[0] as any;
        if (!obj.animationClips) obj.animationClips = [];
        obj.animationClips.push({
            name,
            duration,
            frameRate: 30,
            tracks: [],
            loop: true
        });
        this.events.emit('selectionChanged', sel);
        this.log(`Animation clip "${name}" added`, 'success');
        return true;
    }

    /**
     * Remove an animation clip from the selected object
     */
    removeAnimationClip(index: number): boolean {
        const sel = this.context.getSelection();
        if (sel.length === 0) return false;
        const obj = sel[0] as any;
        if (!obj.animationClips || index >= obj.animationClips.length) return false;
        const removed = obj.animationClips.splice(index, 1);
        this.events.emit('selectionChanged', sel);
        this.log(`Animation clip "${removed[0]?.name}" removed`, 'info');
        return true;
    }

    /**
     * Get visual scripting graph for the selected object
     */
    getScriptGraph(): { nodes: any[]; connections: any[]; variables: any[] } | null {
        const sel = this.context.getSelection();
        if (sel.length === 0) return null;
        const obj = sel[0] as any;
        return {
            nodes: obj.scriptNodes || [],
            connections: obj.scriptConnections || [],
            variables: obj.scriptVariables || []
        };
    }

    /**
     * Add a script node to the selected object's graph
     */
    addScriptNode(type: string, x: number = 100, y: number = 100): any {
        const sel = this.context.getSelection();
        if (sel.length === 0) return null;
        const obj = sel[0] as any;
        if (!obj.scriptNodes) obj.scriptNodes = [];

        const nodeId = `node_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        const node = { id: nodeId, type, x, y, properties: {} };
        obj.scriptNodes.push(node);
        this.events.emit('scriptGraphChanged', { object: obj });
        this.log(`Script node "${type}" added`, 'info');
        return node;
    }

    /**
     * Remove a script node from the selected object's graph
     */
    removeScriptNode(nodeId: string): boolean {
        const sel = this.context.getSelection();
        if (sel.length === 0) return false;
        const obj = sel[0] as any;
        if (!obj.scriptNodes) return false;
        const idx = obj.scriptNodes.findIndex((n: any) => n.id === nodeId);
        if (idx === -1) return false;
        obj.scriptNodes.splice(idx, 1);
        // Also remove related connections
        if (obj.scriptConnections) {
            obj.scriptConnections = obj.scriptConnections.filter(
                (c: any) => c.fromNode !== nodeId && c.toNode !== nodeId
            );
        }
        this.events.emit('scriptGraphChanged', { object: obj });
        return true;
    }

    /**
     * Add a script variable to the selected object's graph
     */
    addScriptVariable(name: string, type: string = 'float', value: any = 0): boolean {
        const sel = this.context.getSelection();
        if (sel.length === 0) return false;
        const obj = sel[0] as any;
        if (!obj.scriptVariables) obj.scriptVariables = [];
        obj.scriptVariables.push({ name, type, value });
        this.events.emit('scriptGraphChanged', { object: obj });
        this.log(`Script variable "${name}" added`, 'info');
        return true;
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
