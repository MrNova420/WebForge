/**
 * PresenceIndicators - Visual indicators for collaborative users
 * 
 * Renders user cursors, selections, and viewport indicators in 3D space
 * 
 * @module collaboration
 */

import { Vector3 } from '../math/Vector3';
import { CollaborativeUser } from './CollaborationManager';

/**
 * Cursor representation in 3D space
 */
export interface Cursor3D {
    userId: string;
    position: Vector3;
    color: string;
    label: string;
    visible: boolean;
}

/**
 * Selection box representation
 */
export interface SelectionBox {
    userId: string;
    objectIds: string[];
    color: string;
    visible: boolean;
}

/**
 * Viewport frustum representation
 */
export interface ViewportFrustum {
    userId: string;
    position: Vector3;
    rotation: Vector3;
    color: string;
    visible: boolean;
}

/**
 * PresenceIndicators - Manages visual indicators for collaborative users
 */
export class PresenceIndicators {
    private cursors: Map<string, Cursor3D>;
    private selections: Map<string, SelectionBox>;
    private viewports: Map<string, ViewportFrustum>;
    private _cursorSize: number;
    private _selectionThickness: number;
    private _viewportOpacity: number;

    constructor() {
        this.cursors = new Map();
        this.selections = new Map();
        this.viewports = new Map();
        this._cursorSize = 0.5;
        this._selectionThickness = 0.05;
        this._viewportOpacity = 0.3;
    }

    /**
     * Update cursor position for user
     */
    public updateCursor(user: CollaborativeUser): void {
        const cursor: Cursor3D = {
            userId: user.id,
            position: new Vector3(
                user.cursorPosition.x,
                user.cursorPosition.y,
                user.cursorPosition.z
            ),
            color: user.color,
            label: user.name,
            visible: user.isActive
        };

        this.cursors.set(user.id, cursor);
    }

    /**
     * Update selection for user
     */
    public updateSelection(user: CollaborativeUser): void {
        const selection: SelectionBox = {
            userId: user.id,
            objectIds: [...user.selectedObjects],
            color: user.color,
            visible: user.isActive && user.selectedObjects.length > 0
        };

        this.selections.set(user.id, selection);
    }

    /**
     * Update viewport frustum for user
     */
    public updateViewport(user: CollaborativeUser): void {
        const viewport: ViewportFrustum = {
            userId: user.id,
            position: new Vector3(
                user.viewportCamera.position.x,
                user.viewportCamera.position.y,
                user.viewportCamera.position.z
            ),
            rotation: new Vector3(
                user.viewportCamera.rotation.x,
                user.viewportCamera.rotation.y,
                user.viewportCamera.rotation.z
            ),
            color: user.color,
            visible: user.isActive
        };

        this.viewports.set(user.id, viewport);
    }

    /**
     * Remove user indicators
     */
    public removeUser(userId: string): void {
        this.cursors.delete(userId);
        this.selections.delete(userId);
        this.viewports.delete(userId);
    }

    /**
     * Render cursor in 3D scene
     */
    public renderCursor(cursor: Cursor3D, context: CanvasRenderingContext2D, screenPos: { x: number; y: number }): void {
        if (!cursor.visible) return;

        context.save();

        // Draw cursor pointer
        context.fillStyle = cursor.color;
        context.beginPath();
        context.moveTo(screenPos.x, screenPos.y);
        context.lineTo(screenPos.x, screenPos.y + 15);
        context.lineTo(screenPos.x + 4, screenPos.y + 11);
        context.lineTo(screenPos.x + 7, screenPos.y + 18);
        context.lineTo(screenPos.x + 10, screenPos.y + 16);
        context.lineTo(screenPos.x + 7, screenPos.y + 9);
        context.lineTo(screenPos.x + 12, screenPos.y + 9);
        context.closePath();
        context.fill();

        // Draw cursor outline
        context.strokeStyle = '#000';
        context.lineWidth = 1;
        context.stroke();

        // Draw label
        context.font = '12px Arial';
        context.fillStyle = '#fff';
        context.fillText(cursor.label, screenPos.x + 15, screenPos.y + 5);

        // Draw label background
        const textMetrics = context.measureText(cursor.label);
        context.fillStyle = cursor.color;
        context.globalAlpha = 0.8;
        context.fillRect(screenPos.x + 14, screenPos.y - 8, textMetrics.width + 4, 16);
        context.globalAlpha = 1.0;

        // Draw label text again on top
        context.fillStyle = '#fff';
        context.fillText(cursor.label, screenPos.x + 15, screenPos.y + 5);

        context.restore();
    }

    /**
     * Render selection box
     */
    public renderSelection(selection: SelectionBox, _context: WebGLRenderingContext, _gl: WebGLRenderingContext): void {
        if (!selection.visible) return;

        // Implementation would use WebGL to render colored outlines
        // around selected objects in the scene
        // This is a placeholder for the actual WebGL rendering code
    }

    /**
     * Render viewport frustum
     */
    public renderViewport(viewport: ViewportFrustum, _context: WebGLRenderingContext, _gl: WebGLRenderingContext): void {
        if (!viewport.visible) return;

        // Implementation would use WebGL to render a wireframe frustum
        // showing where another user is looking
        // This is a placeholder for the actual WebGL rendering code
    }

    /**
     * Get all cursors
     */
    public getCursors(): Cursor3D[] {
        return Array.from(this.cursors.values());
    }

    /**
     * Get all selections
     */
    public getSelections(): SelectionBox[] {
        return Array.from(this.selections.values());
    }

    /**
     * Get all viewports
     */
    public getViewports(): ViewportFrustum[] {
        return Array.from(this.viewports.values());
    }

    /**
     * Set cursor size
     */
    public setCursorSize(size: number): void {
        this._cursorSize = size;
    }

    /**
     * Set selection thickness
     */
    public setSelectionThickness(thickness: number): void {
        this._selectionThickness = thickness;
    }

    /**
     * Set viewport opacity
     */
    public setViewportOpacity(opacity: number): void {
        this._viewportOpacity = Math.max(0, Math.min(1, opacity));
    }

    /**
     * Get cursor size
     */
    public getCursorSize(): number {
        return this._cursorSize;
    }

    /**
     * Get selection thickness
     */
    public getSelectionThickness(): number {
        return this._selectionThickness;
    }

    /**
     * Get viewport opacity
     */
    public getViewportOpacity(): number {
        return this._viewportOpacity;
    }

    /**
     * Clear all indicators
     */
    public clear(): void {
        this.cursors.clear();
        this.selections.clear();
        this.viewports.clear();
    }
}
