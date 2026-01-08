/**
 * WebForge Scale Gizmo
 * 
 * Gizmo for scaling GameObjects along X, Y, Z axes.
 * Displays colored lines with cubes at the ends for scaling handles.
 */

import { Gizmo, GizmoAxis, GizmoColors } from './Gizmo';
import { Vector3 } from '../../math/Vector3';

/**
 * Scale gizmo for scaling objects
 */
export class ScaleGizmo extends Gizmo {
    private axisLength: number = 80; // Length of axis lines in pixels
    private handleSize: number = 8; // Size of cube handles
    private axisHitRadius: number = 10; // Hit test radius for axes
    
    /**
     * Renders the scale gizmo
     */
    protected renderGizmo(): void {
        if (!this.target || !this.camera || !this.ctx) return;
        
        // Get target position in screen space
        const targetPos = this.target.transform.position;
        const screenPos = this.projectToScreen(targetPos);
        
        // Don't render if behind camera
        if (screenPos.z < 0 || screenPos.z > 1) return;
        
        // Calculate axis endpoints in world space
        const xEnd = targetPos.clone().add(new Vector3(1, 0, 0));
        const yEnd = targetPos.clone().add(new Vector3(0, 1, 0));
        const zEnd = targetPos.clone().add(new Vector3(0, 0, 1));
        
        // Project to screen space
        const xEndScreen = this.projectToScreen(xEnd);
        const yEndScreen = this.projectToScreen(yEnd);
        const zEndScreen = this.projectToScreen(zEnd);
        
        // Calculate normalized directions and scale to pixel length
        const xDir = new Vector3(xEndScreen.x - screenPos.x, xEndScreen.y - screenPos.y, 0).normalize();
        const yDir = new Vector3(yEndScreen.x - screenPos.x, yEndScreen.y - screenPos.y, 0).normalize();
        const zDir = new Vector3(zEndScreen.x - screenPos.x, zEndScreen.y - screenPos.y, 0).normalize();
        
        const xAxisEnd = new Vector3(
            screenPos.x + xDir.x * this.axisLength,
            screenPos.y + xDir.y * this.axisLength,
            0
        );
        const yAxisEnd = new Vector3(
            screenPos.x + yDir.x * this.axisLength,
            screenPos.y + yDir.y * this.axisLength,
            0
        );
        const zAxisEnd = new Vector3(
            screenPos.x + zDir.x * this.axisLength,
            screenPos.y + zDir.y * this.axisLength,
            0
        );
        
        // Draw axes (order matters for occlusion)
        const axes = [
            { axis: GizmoAxis.X, start: screenPos, end: xAxisEnd, color: GizmoColors.X },
            { axis: GizmoAxis.Y, start: screenPos, end: yAxisEnd, color: GizmoColors.Y },
            { axis: GizmoAxis.Z, start: screenPos, end: zAxisEnd, color: GizmoColors.Z }
        ];
        
        // Sort by depth
        axes.sort((a, b) => a.end.z - b.end.z);
        
        // Draw axes with cube handles
        axes.forEach(({ axis, start, end, color }) => {
            const axisColor = this.getAxisColor(axis, color);
            
            // Draw line
            this.drawLine(start, end, axisColor, 3);
            
            // Draw cube handle at end
            this.drawCube(end, this.handleSize, axisColor);
        });
        
        // Draw center cube for uniform scaling
        this.drawCube(screenPos, this.handleSize, this.getAxisColor(GizmoAxis.XYZ, GizmoColors.XYZ));
    }
    
    /**
     * Draws a cube at the specified position
     */
    private drawCube(center: Vector3, size: number, color: string): void {
        if (!this.ctx) return;
        
        const halfSize = size / 2;
        
        this.ctx.fillStyle = color;
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = 2;
        
        // Draw cube as a square (2D projection)
        this.ctx.fillRect(
            center.x - halfSize,
            center.y - halfSize,
            size,
            size
        );
        this.ctx.strokeRect(
            center.x - halfSize,
            center.y - halfSize,
            size,
            size
        );
    }
    
    /**
     * Hit test to determine which axis is under the mouse
     */
    protected hitTest(x: number, y: number): GizmoAxis {
        if (!this.target || !this.camera) return GizmoAxis.NONE;
        
        const targetPos = this.target.transform.position;
        const screenPos = this.projectToScreen(targetPos);
        
        // Check center cube first
        const halfSize = this.handleSize / 2;
        if (Math.abs(x - screenPos.x) <= halfSize && Math.abs(y - screenPos.y) <= halfSize) {
            return GizmoAxis.XYZ;
        }
        
        // Check axis handles
        const axes = this.getAxisEndpoints(screenPos);
        
        for (const { axis, end } of axes) {
            // Check handle cube at end
            if (Math.abs(x - end.x) <= halfSize && Math.abs(y - end.y) <= halfSize) {
                return axis;
            }
            
            // Check axis line
            const dist = this.distanceToLineSegment(
                new Vector3(x, y, 0),
                screenPos,
                end
            );
            
            if (dist <= this.axisHitRadius) {
                return axis;
            }
        }
        
        return GizmoAxis.NONE;
    }
    
    /**
     * Gets axis endpoints in screen space
     */
    private getAxisEndpoints(screenPos: Vector3): Array<{ axis: GizmoAxis; end: Vector3 }> {
        if (!this.target || !this.camera) return [];
        
        const targetPos = this.target.transform.position;
        
        const xEnd = targetPos.clone().add(new Vector3(1, 0, 0));
        const yEnd = targetPos.clone().add(new Vector3(0, 1, 0));
        const zEnd = targetPos.clone().add(new Vector3(0, 0, 1));
        
        const xEndScreen = this.projectToScreen(xEnd);
        const yEndScreen = this.projectToScreen(yEnd);
        const zEndScreen = this.projectToScreen(zEnd);
        
        const xDir = new Vector3(xEndScreen.x - screenPos.x, xEndScreen.y - screenPos.y, 0).normalize();
        const yDir = new Vector3(yEndScreen.x - screenPos.x, yEndScreen.y - screenPos.y, 0).normalize();
        const zDir = new Vector3(zEndScreen.x - screenPos.x, zEndScreen.y - screenPos.y, 0).normalize();
        
        return [
            {
                axis: GizmoAxis.X,
                end: new Vector3(screenPos.x + xDir.x * this.axisLength, screenPos.y + xDir.y * this.axisLength, 0)
            },
            {
                axis: GizmoAxis.Y,
                end: new Vector3(screenPos.x + yDir.x * this.axisLength, screenPos.y + yDir.y * this.axisLength, 0)
            },
            {
                axis: GizmoAxis.Z,
                end: new Vector3(screenPos.x + zDir.x * this.axisLength, screenPos.y + zDir.y * this.axisLength, 0)
            }
        ];
    }
    
    /**
     * Calculates distance from a point to a line segment
     */
    private distanceToLineSegment(point: Vector3, lineStart: Vector3, lineEnd: Vector3): number {
        const dx = lineEnd.x - lineStart.x;
        const dy = lineEnd.y - lineStart.y;
        const lengthSq = dx * dx + dy * dy;
        
        if (lengthSq === 0) {
            return Math.sqrt((point.x - lineStart.x) ** 2 + (point.y - lineStart.y) ** 2);
        }
        
        let t = ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / lengthSq;
        t = Math.max(0, Math.min(1, t));
        
        const projX = lineStart.x + t * dx;
        const projY = lineStart.y + t * dy;
        
        return Math.sqrt((point.x - projX) ** 2 + (point.y - projY) ** 2);
    }
    
    /**
     * Applies the scale transform
     */
    protected applyTransform(): void {
        if (!this.target || !this.camera || this.state.activeAxis === GizmoAxis.NONE) return;
        
        const dragDelta = new Vector3(
            this.state.dragCurrent.x - this.state.dragStart.x,
            this.state.dragCurrent.y - this.state.dragStart.y,
            0
        );
        
        // Calculate scale factor based on drag distance
        const sensitivity = 0.01;
        const scaleFactor = 1 + (dragDelta.x + dragDelta.y) * sensitivity;
        
        // Apply scale based on active axis
        const newScale = this.state.objectStartTransform.scale.clone();
        
        switch (this.state.activeAxis) {
            case GizmoAxis.X:
                newScale.x *= scaleFactor;
                break;
            case GizmoAxis.Y:
                newScale.y *= scaleFactor;
                break;
            case GizmoAxis.Z:
                newScale.z *= scaleFactor;
                break;
            case GizmoAxis.XYZ:
                // Uniform scaling
                newScale.multiplyScalar(scaleFactor);
                break;
        }
        
        // Clamp scale to prevent negative or zero values
        newScale.x = Math.max(0.01, newScale.x);
        newScale.y = Math.max(0.01, newScale.y);
        newScale.z = Math.max(0.01, newScale.z);
        
        // Apply the transform
        this.target.transform.scale.copy(newScale);
    }
}
