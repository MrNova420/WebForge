/**
 * WebForge Editor Context
 * 
 * Centralized state management for the visual editor.
 * Manages selection, transform modes, snapping, grid settings, and viewport configuration.
 */

import { EventSystem } from '../core/EventSystem';
import { GameObject } from '../scene/GameObject';

/**
 * Transform mode for manipulating objects
 */
export enum TransformMode {
    SELECT = 'select',
    TRANSLATE = 'translate',
    ROTATE = 'rotate',
    SCALE = 'scale'
}

/**
 * Transform space (local or world coordinates)
 */
export enum TransformSpace {
    LOCAL = 'local',
    WORLD = 'world'
}

/**
 * Editor viewport settings
 */
export interface ViewportSettings {
    backgroundColor: string;
    showGizmos: boolean;
    showGrid: boolean;
    showStats: boolean;
    wireframe: boolean;
}

/**
 * Grid settings for snapping and visualization
 */
export interface GridSettings {
    size: number;
    divisions: number;
    visible: boolean;
    color: string;
    opacity: number;
}

/**
 * Snapping configuration
 */
export interface SnappingSettings {
    gridSnapping: boolean;
    gridSize: number;
    angleSnapping: boolean;
    angleStep: number;
    scaleSnapping: boolean;
    scaleStep: number;
}

/**
 * Editor Context
 * 
 * Central state management for the editor.
 * Handles selection, transform modes, snapping, and viewport settings.
 */
export class EditorContext {
    private selection: GameObject[] = [];
    private transformMode: TransformMode = TransformMode.SELECT;
    private transformSpace: TransformSpace = TransformSpace.WORLD;
    private events: EventSystem;
    
    private snapping: SnappingSettings = {
        gridSnapping: false,
        gridSize: 1.0,
        angleSnapping: false,
        angleStep: 15,
        scaleSnapping: false,
        scaleStep: 0.1
    };
    
    private grid: GridSettings = {
        size: 10,
        divisions: 10,
        visible: true,
        color: '#888888',
        opacity: 0.5
    };
    
    private viewport: ViewportSettings = {
        backgroundColor: '#1e1e1e',
        showGizmos: true,
        showGrid: true,
        showStats: true,
        wireframe: false
    };
    
    constructor() {
        this.events = new EventSystem();
    }
    
    /**
     * Get the event system for listening to editor events
     */
    public getEvents(): EventSystem {
        return this.events;
    }
    
    // Selection Management
    
    /**
     * Set the selected objects
     */
    public setSelection(objects: GameObject[]): void {
        this.selection = objects;
        this.events.emit('selectionChanged', objects);
    }
    
    /**
     * Get the currently selected objects
     */
    public getSelection(): GameObject[] {
        return this.selection;
    }
    
    /**
     * Check if an object is selected
     */
    public isSelected(object: GameObject): boolean {
        return this.selection.includes(object);
    }
    
    /**
     * Add an object to the selection
     */
    public addToSelection(object: GameObject): void {
        if (!this.isSelected(object)) {
            this.selection.push(object);
            this.events.emit('selectionChanged', this.selection);
        }
    }
    
    /**
     * Remove an object from the selection
     */
    public removeFromSelection(object: GameObject): void {
        const index = this.selection.indexOf(object);
        if (index !== -1) {
            this.selection.splice(index, 1);
            this.events.emit('selectionChanged', this.selection);
        }
    }
    
    /**
     * Clear the selection
     */
    public clearSelection(): void {
        if (this.selection.length > 0) {
            this.selection = [];
            this.events.emit('selectionChanged', this.selection);
        }
    }
    
    // Transform Mode
    
    /**
     * Set the transform mode
     */
    public setTransformMode(mode: TransformMode): void {
        if (this.transformMode !== mode) {
            this.transformMode = mode;
            this.events.emit('transformModeChanged', mode);
        }
    }
    
    /**
     * Get the current transform mode
     */
    public getTransformMode(): TransformMode {
        return this.transformMode;
    }
    
    /**
     * Set the transform space (local or world)
     */
    public setTransformSpace(space: TransformSpace): void {
        if (this.transformSpace !== space) {
            this.transformSpace = space;
            this.events.emit('transformSpaceChanged', space);
        }
    }
    
    /**
     * Get the current transform space
     */
    public getTransformSpace(): TransformSpace {
        return this.transformSpace;
    }
    
    // Snapping Settings
    
    /**
     * Enable or disable grid snapping
     */
    public setGridSnapping(enabled: boolean): void {
        this.snapping.gridSnapping = enabled;
        this.events.emit('snappingChanged', this.snapping);
    }
    
    /**
     * Set the grid snap size
     */
    public setGridSize(size: number): void {
        this.snapping.gridSize = size;
        this.events.emit('snappingChanged', this.snapping);
    }
    
    /**
     * Enable or disable angle snapping
     */
    public setAngleSnapping(enabled: boolean): void {
        this.snapping.angleSnapping = enabled;
        this.events.emit('snappingChanged', this.snapping);
    }
    
    /**
     * Set the angle snap step (in degrees)
     */
    public setAngleStep(step: number): void {
        this.snapping.angleStep = step;
        this.events.emit('snappingChanged', this.snapping);
    }
    
    /**
     * Enable or disable scale snapping
     */
    public setScaleSnapping(enabled: boolean): void {
        this.snapping.scaleSnapping = enabled;
        this.events.emit('snappingChanged', this.snapping);
    }
    
    /**
     * Set the scale snap step
     */
    public setScaleStep(step: number): void {
        this.snapping.scaleStep = step;
        this.events.emit('snappingChanged', this.snapping);
    }
    
    /**
     * Get the snapping settings
     */
    public getSnappingSettings(): SnappingSettings {
        return { ...this.snapping };
    }
    
    // Grid Settings
    
    /**
     * Set grid size (total size of the grid)
     */
    public setGridTotalSize(size: number): void {
        this.grid.size = size;
        this.events.emit('gridChanged', this.grid);
    }
    
    /**
     * Set grid divisions (number of cells)
     */
    public setGridDivisions(divisions: number): void {
        this.grid.divisions = divisions;
        this.events.emit('gridChanged', this.grid);
    }
    
    /**
     * Set grid visibility
     */
    public setGridVisible(visible: boolean): void {
        this.grid.visible = visible;
        this.events.emit('gridChanged', this.grid);
    }
    
    /**
     * Get the grid settings
     */
    public getGridSettings(): GridSettings {
        return { ...this.grid };
    }
    
    // Viewport Settings
    
    /**
     * Set viewport background color
     */
    public setBackgroundColor(color: string): void {
        this.viewport.backgroundColor = color;
        this.events.emit('viewportChanged', this.viewport);
    }
    
    /**
     * Toggle gizmo visibility
     */
    public setShowGizmos(show: boolean): void {
        this.viewport.showGizmos = show;
        this.events.emit('viewportChanged', this.viewport);
    }
    
    /**
     * Toggle grid visibility
     */
    public setShowGrid(show: boolean): void {
        this.viewport.showGrid = show;
        this.events.emit('viewportChanged', this.viewport);
    }
    
    /**
     * Toggle stats display
     */
    public setShowStats(show: boolean): void {
        this.viewport.showStats = show;
        this.events.emit('viewportChanged', this.viewport);
    }
    
    /**
     * Toggle wireframe mode
     */
    public setWireframe(enabled: boolean): void {
        this.viewport.wireframe = enabled;
        this.events.emit('viewportChanged', this.viewport);
    }
    
    /**
     * Get the viewport settings
     */
    public getViewportSettings(): ViewportSettings {
        return { ...this.viewport };
    }
}
