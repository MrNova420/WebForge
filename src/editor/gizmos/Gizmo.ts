/**
 * WebForge Gizmo Base Class
 * 
 * Base class for all transform gizmos (translate, rotate, scale).
 * Handles common gizmo functionality like selection, highlighting, and rendering.
 * Uses cached view-projection matrices and batched draw calls for efficiency.
 */

import { Vector3 } from '../../math/Vector3';
import { Vector4 } from '../../math/Vector4';
import { Matrix4 } from '../../math/Matrix4';
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

/** Arrow head half-angle (radians) */
const ARROW_HEAD_ANGLE = Math.PI / 6;

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
 * Batched line segment for efficient gizmo rendering
 */
interface GizmoLineBatch {
    segments: Array<{ sx: number; sy: number; ex: number; ey: number; color: string; width: number }>;
    fills: Array<{ path: Array<{ x: number; y: number }>; color: string }>;
    circles: Array<{ cx: number; cy: number; radius: number; color: string; filled: boolean }>;
}

/**
 * Base gizmo class with VP matrix caching and batched rendering
 */
export abstract class Gizmo {
    protected target: GameObject | null = null;
    protected camera: Camera | null = null;
    protected canvas: HTMLCanvasElement | null = null;
    protected ctx: CanvasRenderingContext2D | null = null;
    
    protected size: number = 100; // Gizmo size in pixels
    protected hoveredAxis: GizmoAxis = GizmoAxis.NONE;
    
    /** Cached view-projection matrix (refreshed each render) */
    protected cachedVPMatrix: Matrix4 | null = null;
    /** Cached inverse VP matrix (lazily computed) */
    private cachedInvVPMatrix: Matrix4 | null = null;
    /** Dirty flag for VP matrix cache */
    protected vpMatrixDirty: boolean = true;
    /** Draw batch for the current frame */
    protected batch: GizmoLineBatch = { segments: [], fills: [], circles: [] };
    
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
     * @param target - The GameObject to transform, or null to clear
     */
    public setTarget(target: GameObject | null): void {
        this.target = target;
    }
    
    /**
     * Gets the target GameObject
     * @returns The current target or null
     */
    public getTarget(): GameObject | null {
        return this.target;
    }
    
    /**
     * Sets the camera for projection and invalidates the VP cache
     * @param camera - The rendering camera
     */
    public setCamera(camera: Camera): void {
        this.camera = camera;
        this.vpMatrixDirty = true;
    }
    
    /**
     * Sets the gizmo size in pixels
     * @param size - Visual size of the gizmo handles
     */
    public setSize(size: number): void {
        this.size = size;
    }
    
    /**
     * Renders the gizmo using batched draw calls.
     * Refreshes the VP matrix cache, collects all draw primitives,
     * then flushes them in a single canvas pass.
     */
    public render(): void {
        if (!this.target || !this.camera || !this.ctx || !this.canvas) return;
        
        // Refresh VP cache
        this.refreshVPCache();
        
        // Clear batch
        this.batch = { segments: [], fills: [], circles: [] };
        
        this.ctx.save();
        
        // Subclass populates the batch
        this.renderGizmo();
        
        // Flush all batched draw calls in one pass
        this.flushBatch();
        
        this.ctx.restore();
    }
    
    /**
     * Refreshes the cached view-projection matrix from the camera
     */
    private refreshVPCache(): void {
        if (!this.camera) return;
        this.cachedVPMatrix = this.camera.getViewProjectionMatrix();
        this.cachedInvVPMatrix = null; // Invalidate inverse
        this.vpMatrixDirty = false;
    }
    
    /**
     * Gets the cached inverse VP matrix (computed lazily)
     * @returns The inverse view-projection matrix
     */
    protected getInverseVPMatrix(): Matrix4 {
        if (!this.cachedInvVPMatrix) {
            if (this.cachedVPMatrix) {
                this.cachedInvVPMatrix = this.cachedVPMatrix.clone().invert();
            } else {
                this.cachedInvVPMatrix = new Matrix4();
            }
        }
        return this.cachedInvVPMatrix;
    }
    
    /**
     * Flushes the batched draw operations to the canvas in a single pass
     */
    private flushBatch(): void {
        if (!this.ctx) return;
        
        // Draw all line segments (grouped by color+width for fewer state changes)
        const lineGroups = new Map<string, typeof this.batch.segments>();
        for (const seg of this.batch.segments) {
            const key = `${seg.color}|${seg.width}`;
            let group = lineGroups.get(key);
            if (!group) { group = []; lineGroups.set(key, group); }
            group.push(seg);
        }
        
        for (const [key, segs] of lineGroups) {
            const [color, widthStr] = key.split('|');
            this.ctx.strokeStyle = color;
            this.ctx.lineWidth = parseFloat(widthStr);
            this.ctx.beginPath();
            for (const seg of segs) {
                this.ctx.moveTo(seg.sx, seg.sy);
                this.ctx.lineTo(seg.ex, seg.ey);
            }
            this.ctx.stroke();
        }
        
        // Draw all fills
        for (const fill of this.batch.fills) {
            this.ctx.fillStyle = fill.color;
            this.ctx.beginPath();
            if (fill.path.length > 0) {
                this.ctx.moveTo(fill.path[0].x, fill.path[0].y);
                for (let i = 1; i < fill.path.length; i++) {
                    this.ctx.lineTo(fill.path[i].x, fill.path[i].y);
                }
            }
            this.ctx.closePath();
            this.ctx.fill();
        }
        
        // Draw all circles
        for (const c of this.batch.circles) {
            this.ctx.beginPath();
            this.ctx.arc(c.cx, c.cy, c.radius, 0, Math.PI * 2);
            if (c.filled) {
                this.ctx.fillStyle = c.color;
                this.ctx.fill();
            } else {
                this.ctx.strokeStyle = c.color;
                this.ctx.lineWidth = 2;
                this.ctx.stroke();
            }
        }
    }
    
    /**
     * Abstract method to render the specific gizmo type.
     * Implementations should use the batched draw helpers.
     */
    protected abstract renderGizmo(): void;
    
    /**
     * Handles mouse down event on the gizmo
     * @param x - Screen X coordinate
     * @param y - Screen Y coordinate
     * @returns true if the gizmo captured the event
     */
    public onMouseDown(x: number, y: number): boolean {
        if (!this.target) return false;
        
        const axis = this.hitTest(x, y);
        
        if (axis !== GizmoAxis.NONE) {
            this.state.isDragging = true;
            this.state.activeAxis = axis;
            this.state.dragStart.set(x, y, 0);
            this.state.dragCurrent.set(x, y, 0);
            
            this.state.objectStartTransform.position.copy(this.target.transform.position);
            this.state.objectStartTransform.rotation.copy(this.target.transform.rotation.toEuler());
            this.state.objectStartTransform.scale.copy(this.target.transform.scale);
            
            return true;
        }
        
        return false;
    }
    
    /**
     * Handles mouse move event
     * @param x - Screen X coordinate
     * @param y - Screen Y coordinate
     * @returns true if the gizmo handled the event
     */
    public onMouseMove(x: number, y: number): boolean {
        if (this.state.isDragging) {
            this.state.dragCurrent.set(x, y, 0);
            this.applyTransform();
            return true;
        } else {
            const previousHovered = this.hoveredAxis;
            this.hoveredAxis = this.hitTest(x, y);
            return previousHovered !== this.hoveredAxis;
        }
    }
    
    /**
     * Handles mouse up event
     * @returns true if the gizmo was actively dragging
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
     * @param x - Screen X coordinate
     * @param y - Screen Y coordinate
     * @returns The axis that was hit, or NONE
     */
    protected abstract hitTest(x: number, y: number): GizmoAxis;
    
    /**
     * Abstract method to apply the transform based on drag
     */
    protected abstract applyTransform(): void;
    
    /**
     * Projects a 3D point to screen space using the cached VP matrix
     * @param worldPos - Position in world space
     * @returns Screen-space position (x, y = pixels, z = clip-space depth)
     */
    protected projectToScreen(worldPos: Vector3): Vector3 {
        if (!this.canvas) return new Vector3();
        
        const vpMatrix = this.cachedVPMatrix || (this.camera ? this.camera.getViewProjectionMatrix() : null);
        if (!vpMatrix) return new Vector3();
        
        const clipPos = vpMatrix.multiplyVector4(new Vector4(worldPos.x, worldPos.y, worldPos.z, 1));
        
        if (clipPos.w !== 0) {
            clipPos.x /= clipPos.w;
            clipPos.y /= clipPos.w;
            clipPos.z /= clipPos.w;
        }
        
        const screenX = (clipPos.x * 0.5 + 0.5) * this.canvas.width;
        const screenY = (1 - (clipPos.y * 0.5 + 0.5)) * this.canvas.height;
        
        return new Vector3(screenX, screenY, clipPos.z);
    }
    
    /**
     * Unprojects a screen point to world space using the cached inverse VP matrix
     * @param screenX - Screen X coordinate
     * @param screenY - Screen Y coordinate
     * @param depth - NDC depth (-1 = near, 1 = far)
     * @returns World-space position
     */
    protected unprojectToWorld(screenX: number, screenY: number, depth: number): Vector3 {
        if (!this.canvas) return new Vector3();
        
        const ndcX = (screenX / this.canvas.width) * 2 - 1;
        const ndcY = 1 - (screenY / this.canvas.height) * 2;
        
        const invVpMatrix = this.getInverseVPMatrix();
        const worldPos = invVpMatrix.multiplyVector4(new Vector4(ndcX, ndcY, depth, 1));
        
        if (worldPos.w !== 0) {
            worldPos.x /= worldPos.w;
            worldPos.y /= worldPos.w;
            worldPos.z /= worldPos.w;
        }
        
        return new Vector3(worldPos.x, worldPos.y, worldPos.z);
    }
    
    /**
     * Adds a line to the draw batch
     * @param start - Start position in screen space
     * @param end - End position in screen space
     * @param color - CSS color string
     * @param lineWidth - Line width in pixels
     */
    protected drawLine(start: Vector3, end: Vector3, color: string, lineWidth: number = 2): void {
        this.batch.segments.push({ sx: start.x, sy: start.y, ex: end.x, ey: end.y, color, width: lineWidth });
    }
    
    /**
     * Adds an arrow (line + head) to the draw batch
     * @param start - Start position in screen space
     * @param end - End position (tip) in screen space
     * @param color - CSS color string
     * @param headSize - Arrow head size in pixels
     */
    protected drawArrow(start: Vector3, end: Vector3, color: string, headSize: number = 10): void {
        // Line
        this.batch.segments.push({ sx: start.x, sy: start.y, ex: end.x, ey: end.y, color, width: 3 });
        
        // Arrow head
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const angle = Math.atan2(dy, dx);
        
        this.batch.fills.push({
            color,
            path: [
                { x: end.x, y: end.y },
                { x: end.x - headSize * Math.cos(angle - ARROW_HEAD_ANGLE), y: end.y - headSize * Math.sin(angle - ARROW_HEAD_ANGLE) },
                { x: end.x - headSize * Math.cos(angle + ARROW_HEAD_ANGLE), y: end.y - headSize * Math.sin(angle + ARROW_HEAD_ANGLE) }
            ]
        });
    }
    
    /**
     * Adds a circle to the draw batch
     * @param center - Center in screen space
     * @param radius - Radius in pixels
     * @param color - CSS color string
     * @param filled - Whether to fill or stroke
     */
    protected drawCircle(center: Vector3, radius: number, color: string, filled: boolean = false): void {
        this.batch.circles.push({ cx: center.x, cy: center.y, radius, color, filled });
    }
    
    /**
     * Gets the color for an axis based on interaction state
     * @param axis - The axis to color
     * @param baseColors - Normal and highlight colors
     * @returns CSS color string
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
