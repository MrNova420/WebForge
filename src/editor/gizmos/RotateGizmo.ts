/**
 * WebForge Rotate Gizmo
 * 
 * Gizmo for rotating GameObjects around X, Y, Z axes.
 * Displays colored circles for each axis and allows rotation by dragging.
 */

import { Gizmo, GizmoAxis, GizmoColors } from './Gizmo';
import { Vector3 } from '../../math/Vector3';
import { Quaternion } from '../../math/Quaternion';

/**
 * Rotate gizmo for rotating objects
 */
export class RotateGizmo extends Gizmo {
    private circleRadius: number = 70; // Radius of rotation circles in pixels
    private circleHitWidth: number = 8; // Hit test width for circles
    private rotationSpeed: number = 0.01; // Rotation speed multiplier
    
    /**
     * Renders the rotate gizmo
     */
    protected renderGizmo(): void {
        if (!this.target || !this.camera || !this.ctx) return;
        
        // Get target position in screen space
        const targetPos = this.target.transform.position;
        const screenPos = this.projectToScreen(targetPos);
        
        // Don't render if behind camera
        if (screenPos.z < 0 || screenPos.z > 1) return;
        
        // Draw rotation circles for each axis
        this.drawRotationCircle(screenPos, GizmoAxis.X, GizmoColors.X);
        this.drawRotationCircle(screenPos, GizmoAxis.Y, GizmoColors.Y);
        this.drawRotationCircle(screenPos, GizmoAxis.Z, GizmoColors.Z);
        
        // Draw center sphere
        this.drawCircle(screenPos, 6, this.getAxisColor(GizmoAxis.XYZ, GizmoColors.XYZ), true);
    }
    
    /**
     * Draws a rotation circle for an axis
     */
    private drawRotationCircle(center: Vector3, axis: GizmoAxis, colorScheme: { normal: string; highlight: string }): void {
        if (!this.ctx || !this.target || !this.camera) return;
        
        const color = this.getAxisColor(axis, colorScheme);
        const lineWidth = (this.state.activeAxis === axis || this.hoveredAxis === axis) ? 4 : 2;
        
        this.ctx.save();
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = lineWidth;
        
        // Draw circle based on axis orientation
        // For simplicity, we draw screen-space circles
        // In a full implementation, these would be perspective-correct 3D circles
        
        this.ctx.beginPath();
        
        if (axis === GizmoAxis.X) {
            // X-axis rotation (YZ plane)
            this.ctx.ellipse(center.x, center.y, this.circleRadius * 0.3, this.circleRadius, 0, 0, Math.PI * 2);
        } else if (axis === GizmoAxis.Y) {
            // Y-axis rotation (XZ plane)
            this.ctx.ellipse(center.x, center.y, this.circleRadius, this.circleRadius * 0.3, 0, 0, Math.PI * 2);
        } else if (axis === GizmoAxis.Z) {
            // Z-axis rotation (XY plane)
            this.ctx.arc(center.x, center.y, this.circleRadius, 0, Math.PI * 2);
        }
        
        this.ctx.stroke();
        this.ctx.restore();
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
        
        // Check Z-axis circle (XY plane) - perfect circle
        const distToZ = Math.abs(distToCenter - this.circleRadius);
        if (distToZ <= this.circleHitWidth) {
            return GizmoAxis.Z;
        }
        
        // Check Y-axis circle (XZ plane) - ellipse
        const yEllipseTest = this.testEllipse(
            x, y,
            screenPos.x, screenPos.y,
            this.circleRadius, this.circleRadius * 0.3,
            0
        );
        if (yEllipseTest) {
            return GizmoAxis.Y;
        }
        
        // Check X-axis circle (YZ plane) - ellipse
        const xEllipseTest = this.testEllipse(
            x, y,
            screenPos.x, screenPos.y,
            this.circleRadius * 0.3, this.circleRadius,
            0
        );
        if (xEllipseTest) {
            return GizmoAxis.X;
        }
        
        return GizmoAxis.NONE;
    }
    
    /**
     * Tests if a point is near an ellipse
     */
    private testEllipse(
        px: number, py: number,
        cx: number, cy: number,
        rx: number, ry: number,
        rotation: number
    ): boolean {
        // Translate point to ellipse center
        const dx = px - cx;
        const dy = py - cy;
        
        // Rotate point
        const cos = Math.cos(-rotation);
        const sin = Math.sin(-rotation);
        const x = dx * cos - dy * sin;
        const y = dx * sin + dy * cos;
        
        // Calculate distance from ellipse
        const ellipseValue = (x * x) / (rx * rx) + (y * y) / (ry * ry);
        const distance = Math.abs(Math.sqrt(ellipseValue) - 1) * Math.min(rx, ry);
        
        return distance <= this.circleHitWidth;
    }
    
    /**
     * Applies the rotation transform
     */
    protected applyTransform(): void {
        if (!this.target || !this.camera || this.state.activeAxis === GizmoAxis.NONE) return;
        
        const dragDelta = new Vector3(
            this.state.dragCurrent.x - this.state.dragStart.x,
            this.state.dragCurrent.y - this.state.dragStart.y,
            0
        );
        
        // Calculate rotation angle based on drag distance
        const dragDistance = Math.sqrt(dragDelta.x ** 2 + dragDelta.y ** 2);
        const angle = dragDistance * this.rotationSpeed;
        
        // Determine rotation direction
        let rotationAxis = new Vector3();
        
        switch (this.state.activeAxis) {
            case GizmoAxis.X:
                rotationAxis = new Vector3(1, 0, 0);
                break;
            case GizmoAxis.Y:
                rotationAxis = new Vector3(0, 1, 0);
                break;
            case GizmoAxis.Z:
                rotationAxis = new Vector3(0, 0, 1);
                // Determine rotation direction based on mouse movement
                const centerX = (this.canvas?.width || 0) / 2;
                const centerY = (this.canvas?.height || 0) / 2;
                const cross = (this.state.dragCurrent.x - centerX) * dragDelta.y - 
                              (this.state.dragCurrent.y - centerY) * dragDelta.x;
                if (cross < 0) {
                    rotationAxis = new Vector3(0, 0, -1);
                }
                break;
            case GizmoAxis.XYZ:
                // Free rotation - not implemented yet
                return;
        }
        
        // Create rotation quaternion
        const rotationQuat = Quaternion.fromAxisAngle(rotationAxis, angle);
        
        // Apply rotation to object
        const currentRotation = this.target.transform.rotation;
        const newRotation = currentRotation.multiply(rotationQuat);
        this.target.transform.rotation = newRotation;
        
        // Update drag start for continuous rotation
        this.state.dragStart.copy(this.state.dragCurrent);
    }
}
