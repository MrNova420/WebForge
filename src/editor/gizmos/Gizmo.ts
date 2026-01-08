/**
 * WebForge Gizmo Base Class
 * 
 * Base class for all transform gizmos (translate, rotate, scale).
 * Handles common gizmo functionality like selection, highlighting, and rendering.
 */

import { Vector3 } from '../../math/Vector3';
import { Vector4 } from '../../math/Vector4';
import { Camera } from '../../rendering/Camera';
import { GameObject } from '../../scene/GameObject';

/**
 * Gizmo axis enumeration
 */
export enum GizmoAxis {
    NONE = 'none',
    X = 'x',
    Y = 'y',
    Z = 'z',
    XY = 'xy',
    YZ = 'yz',
    XZ = 'xz',
    XYZ = 'xyz'
}

/**
 * Gizmo colors for axes
 */
export const GizmoColors = {
    X: { normal: '#ff5555', highlight: '#ff8888' },
    Y: { normal: '#55ff55', highlight: '#88ff88' },
    Z: { normal: '#5555ff', highlight: '#8888ff' },
    XYZ: { normal: '#ffffff', highlight: '#ffff00' },
    Plane: { normal: 'rgba(255, 255, 255, 0.3)', highlight: 'rgba(255, 255, 0, 0.5)' }
};

/**
 * Gizmo interaction state
 */
export interface GizmoState {
    isDragging: boolean;
    activeAxis: GizmoAxis;
    dragStart: Vector3;
    dragCurrent: Vector3;
    objectStartTransform: {
        position: Vector3;
        rotation: Vector3;
        scale: Vector3;
    };
}

/**
 * Base gizmo class
 */
export abstract class Gizmo {
    protected target: GameObject | null = null;
    protected camera: Camera | null = null;
    protected canvas: HTMLCanvasElement | null = null;
    protected ctx: CanvasRenderingContext2D | null = null;
    
    protected size: number = 100; // Gizmo size in pixels
    protected hoveredAxis: GizmoAxis = GizmoAxis.NONE;
    
    protected state: GizmoState = {
        isDragging: false,
        activeAxis: GizmoAxis.NONE,
        dragStart: new Vector3(),
        dragCurrent: new Vector3(),
        objectStartTransform: {
            position: new Vector3(),
            rotation: new Vector3(),
            scale: new Vector3(1, 1, 1)
        }
    };
    
    /**
     * Creates a new gizmo
     * @param canvas - Canvas element for rendering
     */
    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
    }
    
    /**
     * Sets the target GameObject
     */
    public setTarget(target: GameObject | null): void {
        this.target = target;
    }
    
    /**
     * Gets the target GameObject
     */
    public getTarget(): GameObject | null {
        return this.target;
    }
    
    /**
     * Sets the camera for projection
     */
    public setCamera(camera: Camera): void {
        this.camera = camera;
    }
    
    /**
     * Sets the gizmo size in pixels
     */
    public setSize(size: number): void {
        this.size = size;
    }
    
    /**
     * Renders the gizmo
     */
    public render(): void {
        if (!this.target || !this.camera || !this.ctx || !this.canvas) return;
        
        // Clear any previous gizmo rendering
        this.ctx.save();
        
        // Render the specific gizmo type
        this.renderGizmo();
        
        this.ctx.restore();
    }
    
    /**
     * Abstract method to render the specific gizmo type
     */
    protected abstract renderGizmo(): void;
    
    /**
     * Handles mouse down event
     */
    public onMouseDown(x: number, y: number): boolean {
        if (!this.target) return false;
        
        // Check if mouse is over any axis
        const axis = this.hitTest(x, y);
        
        if (axis !== GizmoAxis.NONE) {
            this.state.isDragging = true;
            this.state.activeAxis = axis;
            this.state.dragStart.set(x, y, 0);
            this.state.dragCurrent.set(x, y, 0);
            
            // Store initial transform
            this.state.objectStartTransform.position.copy(this.target.transform.position);
            this.state.objectStartTransform.rotation.copy(this.target.transform.rotation.toEuler());
            this.state.objectStartTransform.scale.copy(this.target.transform.scale);
            
            return true;
        }
        
        return false;
    }
    
    /**
     * Handles mouse move event
     */
    public onMouseMove(x: number, y: number): boolean {
        if (this.state.isDragging) {
            this.state.dragCurrent.set(x, y, 0);
            this.applyTransform();
            return true;
        } else {
            // Update hovered axis for highlighting
            const previousHovered = this.hoveredAxis;
            this.hoveredAxis = this.hitTest(x, y);
            return previousHovered !== this.hoveredAxis;
        }
    }
    
    /**
     * Handles mouse up event
     */
    public onMouseUp(): boolean {
        if (this.state.isDragging) {
            this.state.isDragging = false;
            this.state.activeAxis = GizmoAxis.NONE;
            return true;
        }
        return false;
    }
    
    /**
     * Abstract method to test if a point hits any axis
     */
    protected abstract hitTest(x: number, y: number): GizmoAxis;
    
    /**
     * Abstract method to apply the transform based on drag
     */
    protected abstract applyTransform(): void;
    
    /**
     * Projects a 3D point to screen space
     */
    protected projectToScreen(worldPos: Vector3): Vector3 {
        if (!this.camera || !this.canvas) return new Vector3();
        
        // Get view-projection matrix
        const vpMatrix = this.camera.getViewProjectionMatrix();
        
        // Transform to clip space
        const clipPos = vpMatrix.multiplyVector4(new Vector4(worldPos.x, worldPos.y, worldPos.z, 1));
        
        // Perspective divide
        if (clipPos.w !== 0) {
            clipPos.x /= clipPos.w;
            clipPos.y /= clipPos.w;
            clipPos.z /= clipPos.w;
        }
        
        // Convert to screen space
        const screenX = (clipPos.x * 0.5 + 0.5) * this.canvas.width;
        const screenY = (1 - (clipPos.y * 0.5 + 0.5)) * this.canvas.height;
        
        return new Vector3(screenX, screenY, clipPos.z);
    }
    
    /**
     * Unprojects a screen point to world space
     */
    protected unprojectToWorld(screenX: number, screenY: number, depth: number): Vector3 {
        if (!this.camera || !this.canvas) return new Vector3();
        
        // Convert screen to NDC
        const ndcX = (screenX / this.canvas.width) * 2 - 1;
        const ndcY = 1 - (screenY / this.canvas.height) * 2;
        
        // Get inverse view-projection matrix
        const vpMatrix = this.camera.getViewProjectionMatrix();
        const invVpMatrix = vpMatrix.invert();
        
        // Unproject
        const worldPos = invVpMatrix.multiplyVector4(new Vector4(ndcX, ndcY, depth, 1));
        
        if (worldPos.w !== 0) {
            worldPos.x /= worldPos.w;
            worldPos.y /= worldPos.w;
            worldPos.z /= worldPos.w;
        }
        
        return new Vector3(worldPos.x, worldPos.y, worldPos.z);
    }
    
    /**
     * Draws a line in screen space
     */
    protected drawLine(start: Vector3, end: Vector3, color: string, lineWidth: number = 2): void {
        if (!this.ctx) return;
        
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = lineWidth;
        this.ctx.beginPath();
        this.ctx.moveTo(start.x, start.y);
        this.ctx.lineTo(end.x, end.y);
        this.ctx.stroke();
    }
    
    /**
     * Draws an arrow in screen space
     */
    protected drawArrow(start: Vector3, end: Vector3, color: string, headSize: number = 10): void {
        if (!this.ctx) return;
        
        // Draw line
        this.drawLine(start, end, color, 3);
        
        // Calculate arrow head
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const angle = Math.atan2(dy, dx);
        
        // Draw arrow head
        this.ctx.fillStyle = color;
        this.ctx.beginPath();
        this.ctx.moveTo(end.x, end.y);
        this.ctx.lineTo(
            end.x - headSize * Math.cos(angle - Math.PI / 6),
            end.y - headSize * Math.sin(angle - Math.PI / 6)
        );
        this.ctx.lineTo(
            end.x - headSize * Math.cos(angle + Math.PI / 6),
            end.y - headSize * Math.sin(angle + Math.PI / 6)
        );
        this.ctx.closePath();
        this.ctx.fill();
    }
    
    /**
     * Draws a circle in screen space
     */
    protected drawCircle(center: Vector3, radius: number, color: string, filled: boolean = false): void {
        if (!this.ctx) return;
        
        this.ctx.beginPath();
        this.ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
        
        if (filled) {
            this.ctx.fillStyle = color;
            this.ctx.fill();
        } else {
            this.ctx.strokeStyle = color;
            this.ctx.lineWidth = 2;
            this.ctx.stroke();
        }
    }
    
    /**
     * Gets the color for an axis based on state
     */
    protected getAxisColor(axis: GizmoAxis, baseColors: { normal: string; highlight: string }): string {
        if (this.state.activeAxis === axis) {
            return '#ffff00'; // Yellow when active
        } else if (this.hoveredAxis === axis) {
            return baseColors.highlight;
        } else {
            return baseColors.normal;
        }
    }
}
