/**
 * WebForge Translate Gizmo
 * 
 * Gizmo for translating (moving) GameObjects in 3D space.
 * Displays X, Y, Z axes with arrows and allows dragging along each axis.
 */

import { Gizmo, GizmoAxis, GizmoColors } from './Gizmo';
import { Vector3 } from '../../math/Vector3';

/**
 * Translate gizmo for moving objects
 */
export class TranslateGizmo extends Gizmo {
    private axisLength: number = 80; // Length of axis arrows in pixels
    private axisHitRadius: number = 10; // Hit test radius for axes
    private planeSize: number = 20; // Size of plane handles
    
    /**
     * Renders the translate gizmo
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
        
        // Draw plane handles (small squares at intersections)
        this.drawPlaneHandle(screenPos, xDir, yDir, GizmoAxis.XY);
        this.drawPlaneHandle(screenPos, yDir, zDir, GizmoAxis.YZ);
        this.drawPlaneHandle(screenPos, xDir, zDir, GizmoAxis.XZ);
        
        // Draw axes (order matters for occlusion)
        // Draw from back to front based on camera view
        const axes = [
            { axis: GizmoAxis.X, start: screenPos, end: xAxisEnd, color: GizmoColors.X },
            { axis: GizmoAxis.Y, start: screenPos, end: yAxisEnd, color: GizmoColors.Y },
            { axis: GizmoAxis.Z, start: screenPos, end: zAxisEnd, color: GizmoColors.Z }
        ];
        
        // Sort by depth (z-coordinate in screen space)
        axes.sort((a, b) => a.end.z - b.end.z);
        
        // Draw axes
        axes.forEach(({ axis, start, end, color }) => {
            const axisColor = this.getAxisColor(axis, color);
            this.drawArrow(start, end, axisColor, 12);
        });
        
        // Draw center sphere
        this.drawCircle(screenPos, 6, this.getAxisColor(GizmoAxis.XYZ, GizmoColors.XYZ), true);
    }
    
    /**
     * Draws a plane handle
     */
    private drawPlaneHandle(center: Vector3, dir1: Vector3, dir2: Vector3, axis: GizmoAxis): void {
        if (!this.ctx) return;
        
        const offset = this.planeSize;
        const corner1 = new Vector3(
            center.x + dir1.x * offset,
            center.y + dir1.y * offset,
            0
        );
        const corner2 = new Vector3(
            corner1.x + dir2.x * offset,
            corner1.y + dir2.y * offset,
            0
        );
        const corner3 = new Vector3(
            center.x + dir2.x * offset,
            center.y + dir2.y * offset,
            0
        );
        
        const color = this.getAxisColor(axis, GizmoColors.Plane);
        
        this.ctx.fillStyle = color;
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = 2;
        
        this.ctx.beginPath();
        this.ctx.moveTo(center.x, center.y);
        this.ctx.lineTo(corner1.x, corner1.y);
        this.ctx.lineTo(corner2.x, corner2.y);
        this.ctx.lineTo(corner3.x, corner3.y);
        this.ctx.closePath();
        this.ctx.fill();
        this.ctx.stroke();
    }
    
    /**
     * Hit test to determine which axis is under the mouse
     */
    protected hitTest(x: number, y: number): GizmoAxis {
        if (!this.target || !this.camera) return GizmoAxis.NONE;
        
        const targetPos = this.target.transform.position;
        const screenPos = this.projectToScreen(targetPos);
        
        // Check center sphere first
        const distToCenter = Math.sqrt((x - screenPos.x) ** 2 + (y - screenPos.y) ** 2);
        if (distToCenter <= 8) {
            return GizmoAxis.XYZ;
        }
        
        // Check axes
        const axes = this.getAxisEndpoints(screenPos);
        
        for (const { axis, end } of axes) {
            const dist = this.distanceToLineSegment(
                new Vector3(x, y, 0),
                screenPos,
                end
            );
            
            if (dist <= this.axisHitRadius) {
                return axis;
            }
        }
        
        // Check plane handles
        const planes = this.getPlaneHandles(screenPos);
        
        for (const { axis, points } of planes) {
            if (this.pointInQuad(new Vector3(x, y, 0), points)) {
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
     * Gets plane handle corners
     */
    private getPlaneHandles(screenPos: Vector3): Array<{ axis: GizmoAxis; points: Vector3[] }> {
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
        
        const offset = this.planeSize;
        
        return [
            {
                axis: GizmoAxis.XY,
                points: this.getPlanePoints(screenPos, xDir, yDir, offset)
            },
            {
                axis: GizmoAxis.YZ,
                points: this.getPlanePoints(screenPos, yDir, zDir, offset)
            },
            {
                axis: GizmoAxis.XZ,
                points: this.getPlanePoints(screenPos, xDir, zDir, offset)
            }
        ];
    }
    
    /**
     * Gets the four corners of a plane handle
     */
    private getPlanePoints(center: Vector3, dir1: Vector3, dir2: Vector3, offset: number): Vector3[] {
        const corner1 = new Vector3(center.x + dir1.x * offset, center.y + dir1.y * offset, 0);
        const corner2 = new Vector3(corner1.x + dir2.x * offset, corner1.y + dir2.y * offset, 0);
        const corner3 = new Vector3(center.x + dir2.x * offset, center.y + dir2.y * offset, 0);
        
        return [center, corner1, corner2, corner3];
    }
    
    /**
     * Tests if a point is inside a quad
     */
    private pointInQuad(point: Vector3, quad: Vector3[]): boolean {
        // Simple point-in-polygon test using ray casting
        let inside = false;
        
        for (let i = 0, j = quad.length - 1; i < quad.length; j = i++) {
            const xi = quad[i].x, yi = quad[i].y;
            const xj = quad[j].x, yj = quad[j].y;
            
            const intersect = ((yi > point.y) !== (yj > point.y))
                && (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
            
            if (intersect) inside = !inside;
        }
        
        return inside;
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
     * Applies the translation transform
     */
    protected applyTransform(): void {
        if (!this.target || !this.camera || this.state.activeAxis === GizmoAxis.NONE) return;
        
        const dragDelta = new Vector3(
            this.state.dragCurrent.x - this.state.dragStart.x,
            this.state.dragCurrent.y - this.state.dragStart.y,
            0
        );
        
        // Calculate movement in world space based on active axis
        let worldDelta = new Vector3();
        
        const sensitivity = 0.01; // Pixels to world units
        
        switch (this.state.activeAxis) {
            case GizmoAxis.X:
                worldDelta = new Vector3(dragDelta.x * sensitivity, 0, 0);
                break;
            case GizmoAxis.Y:
                worldDelta = new Vector3(0, -dragDelta.y * sensitivity, 0);
                break;
            case GizmoAxis.Z:
                worldDelta = new Vector3(0, 0, dragDelta.x * sensitivity);
                break;
            case GizmoAxis.XY:
                worldDelta = new Vector3(dragDelta.x * sensitivity, -dragDelta.y * sensitivity, 0);
                break;
            case GizmoAxis.YZ:
                worldDelta = new Vector3(0, -dragDelta.y * sensitivity, dragDelta.x * sensitivity);
                break;
            case GizmoAxis.XZ:
                worldDelta = new Vector3(dragDelta.x * sensitivity, 0, dragDelta.y * sensitivity);
                break;
            case GizmoAxis.XYZ:
                // Free move in screen space
                worldDelta = new Vector3(dragDelta.x * sensitivity, -dragDelta.y * sensitivity, 0);
                break;
        }
        
        // Apply the transform
        const newPosition = this.state.objectStartTransform.position.clone().add(worldDelta);
        this.target.transform.position.copy(newPosition);
    }
}
