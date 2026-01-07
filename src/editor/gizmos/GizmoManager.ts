/**
 * WebForge Gizmo Manager
 * 
 * Manages gizmo rendering, interaction, and mode switching.
 * Integrates with EditorContext to sync with transform mode.
 */

import { Gizmo } from './Gizmo';
import { TranslateGizmo } from './TranslateGizmo';
import { RotateGizmo } from './RotateGizmo';
import { ScaleGizmo } from './ScaleGizmo';
import { EditorContext, TransformMode } from '../EditorContext';
import { Camera } from '../../rendering/Camera';
import { GameObject } from '../../scene/GameObject';

/**
 * Gizmo manager for handling all gizmo operations
 */
export class GizmoManager {
    private context: EditorContext;
    private camera: Camera | null = null;
    
    // Gizmos
    private translateGizmo: TranslateGizmo;
    private rotateGizmo: RotateGizmo;
    private scaleGizmo: ScaleGizmo;
    private currentGizmo: Gizmo | null = null;
    
    // State
    private enabled: boolean = true;
    private target: GameObject | null = null;
    
    /**
     * Creates a new gizmo manager
     * @param context - Editor context
     * @param canvas - Canvas element for rendering
     */
    constructor(context: EditorContext, canvas: HTMLCanvasElement) {
        this.context = context;
        
        // Create gizmos
        this.translateGizmo = new TranslateGizmo(canvas);
        this.rotateGizmo = new RotateGizmo(canvas);
        this.scaleGizmo = new ScaleGizmo(canvas);
        
        // Set initial gizmo based on transform mode
        this.updateCurrentGizmo();
        
        // Listen to context changes
        this.context.on('transformModeChanged', this.onTransformModeChanged.bind(this));
        this.context.on('selectionChanged', this.onSelectionChanged.bind(this));
    }
    
    /**
     * Sets the camera for projection
     */
    public setCamera(camera: Camera): void {
        this.camera = camera;
        this.translateGizmo.setCamera(camera);
        this.rotateGizmo.setCamera(camera);
        this.scaleGizmo.setCamera(camera);
    }
    
    /**
     * Sets whether gizmos are enabled
     */
    public setEnabled(enabled: boolean): void {
        this.enabled = enabled;
    }
    
    /**
     * Gets whether gizmos are enabled
     */
    public isEnabled(): boolean {
        return this.enabled;
    }
    
    /**
     * Sets the target GameObject
     */
    public setTarget(target: GameObject | null): void {
        this.target = target;
        
        if (this.currentGizmo) {
            this.currentGizmo.setTarget(target);
        }
    }
    
    /**
     * Gets the current target
     */
    public getTarget(): GameObject | null {
        return this.target;
    }
    
    /**
     * Renders the current gizmo
     */
    public render(): void {
        if (!this.enabled || !this.target || !this.currentGizmo) return;
        
        this.currentGizmo.render();
    }
    
    /**
     * Handles mouse down event
     * @returns true if gizmo handled the event
     */
    public onMouseDown(x: number, y: number): boolean {
        if (!this.enabled || !this.currentGizmo) return false;
        
        return this.currentGizmo.onMouseDown(x, y);
    }
    
    /**
     * Handles mouse move event
     * @returns true if gizmo handled the event
     */
    public onMouseMove(x: number, y: number): boolean {
        if (!this.enabled || !this.currentGizmo) return false;
        
        return this.currentGizmo.onMouseMove(x, y);
    }
    
    /**
     * Handles mouse up event
     * @returns true if gizmo handled the event
     */
    public onMouseUp(): boolean {
        if (!this.enabled || !this.currentGizmo) return false;
        
        return this.currentGizmo.onMouseUp();
    }
    
    /**
     * Updates the current gizmo based on transform mode
     */
    private updateCurrentGizmo(): void {
        const mode = this.context.getTransformMode();
        
        switch (mode) {
            case TransformMode.TRANSLATE:
                this.currentGizmo = this.translateGizmo;
                break;
            case TransformMode.ROTATE:
                this.currentGizmo = this.rotateGizmo;
                break;
            case TransformMode.SCALE:
                this.currentGizmo = this.scaleGizmo;
                break;
            case TransformMode.SELECT:
            default:
                this.currentGizmo = null;
                break;
        }
        
        // Update target on the new gizmo
        if (this.currentGizmo && this.target) {
            this.currentGizmo.setTarget(this.target);
        }
        
        // Update camera on the new gizmo
        if (this.currentGizmo && this.camera) {
            this.currentGizmo.setCamera(this.camera);
        }
    }
    
    /**
     * Handles transform mode change
     */
    private onTransformModeChanged(): void {
        this.updateCurrentGizmo();
    }
    
    /**
     * Handles selection change
     */
    private onSelectionChanged(): void {
        const selected = this.context.getSelection();
        
        if (selected.length === 1) {
            this.setTarget(selected[0]);
        } else {
            this.setTarget(null);
        }
    }
    
    /**
     * Cleans up resources
     */
    public dispose(): void {
        this.context.off('transformModeChanged', this.onTransformModeChanged.bind(this));
        this.context.off('selectionChanged', this.onSelectionChanged.bind(this));
    }
}
