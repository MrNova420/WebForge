/**
 * WebForge Professional Debugger - Debug Draw
 * 
 * Visual debugging for physics colliders, nav meshes,
 * bounding boxes, rays, and other debug visualizations.
 */

import { Vector3 } from '../math/Vector3';

export interface DebugDrawConfig {
    enabled: boolean;
    showColliders: boolean;
    showBoundingBoxes: boolean;
    showNavMesh: boolean;
    showRays: boolean;
    showNormals: boolean;
    showVelocities: boolean;
    showJoints: boolean;
    showGrid: boolean;
    showAxes: boolean;
    colliderColor: string;
    boundingBoxColor: string;
    navMeshColor: string;
    rayColor: string;
    normalColor: string;
    velocityColor: string;
    jointColor: string;
    gridColor: string;
    lineWidth: number;
    opacity: number;
}

export interface DebugLine {
    id: string;
    start: Vector3;
    end: Vector3;
    color: string;
    duration: number;
    createdAt: number;
}

export interface DebugPoint {
    id: string;
    position: Vector3;
    color: string;
    size: number;
    duration: number;
    createdAt: number;
}

export interface DebugBox {
    id: string;
    min: Vector3;
    max: Vector3;
    color: string;
    wireframe: boolean;
    duration: number;
    createdAt: number;
}

export interface DebugSphere {
    id: string;
    center: Vector3;
    radius: number;
    color: string;
    segments: number;
    duration: number;
    createdAt: number;
}

export interface DebugText {
    id: string;
    position: Vector3;
    text: string;
    color: string;
    size: number;
    duration: number;
    createdAt: number;
}

const DEFAULT_CONFIG: DebugDrawConfig = {
    enabled: true,
    showColliders: true,
    showBoundingBoxes: false,
    showNavMesh: false,
    showRays: true,
    showNormals: false,
    showVelocities: false,
    showJoints: true,
    showGrid: false,
    showAxes: true,
    colliderColor: '#00ff00',
    boundingBoxColor: '#ffff00',
    navMeshColor: '#00ffff',
    rayColor: '#ff0000',
    normalColor: '#0000ff',
    velocityColor: '#ff00ff',
    jointColor: '#ffa500',
    gridColor: '#444444',
    lineWidth: 1,
    opacity: 0.8
};

export class DebugDraw {
    private config: DebugDrawConfig;
    private lines: Map<string, DebugLine> = new Map();
    private points: Map<string, DebugPoint> = new Map();
    private boxes: Map<string, DebugBox> = new Map();
    private spheres: Map<string, DebugSphere> = new Map();
    private texts: Map<string, DebugText> = new Map();
    private idCounter: number = 0;
    private persistentLines: Map<string, DebugLine> = new Map();
    private persistentBoxes: Map<string, DebugBox> = new Map();

    // Render callback (set by external renderer)
    public onRender: ((draw: DebugDraw) => void) | null = null;

    constructor(config: Partial<DebugDrawConfig> = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    /**
     * Draw a line
     */
    line(start: Vector3, end: Vector3, color?: string, duration: number = 0): string {
        const id = `line_${++this.idCounter}`;
        const line: DebugLine = {
            id,
            start: start.clone(),
            end: end.clone(),
            color: color ?? this.config.rayColor,
            duration,
            createdAt: performance.now()
        };

        if (duration === 0) {
            this.lines.set(id, line);
        } else if (duration < 0) {
            this.persistentLines.set(id, line);
        } else {
            this.lines.set(id, line);
        }

        return id;
    }

    /**
     * Draw a ray (line from origin in direction)
     */
    ray(origin: Vector3, direction: Vector3, length: number = 10, color?: string, duration: number = 0): string {
        const end = origin.clone().add(direction.clone().normalize().multiplyScalar(length));
        return this.line(origin, end, color ?? this.config.rayColor, duration);
    }

    /**
     * Draw a point
     */
    point(position: Vector3, color?: string, size: number = 5, duration: number = 0): string {
        const id = `point_${++this.idCounter}`;
        this.points.set(id, {
            id,
            position: position.clone(),
            color: color ?? '#ffffff',
            size,
            duration,
            createdAt: performance.now()
        });
        return id;
    }

    /**
     * Draw an axis-aligned bounding box
     */
    box(min: Vector3, max: Vector3, color?: string, wireframe: boolean = true, duration: number = 0): string {
        const id = `box_${++this.idCounter}`;
        const box: DebugBox = {
            id,
            min: min.clone(),
            max: max.clone(),
            color: color ?? this.config.boundingBoxColor,
            wireframe,
            duration,
            createdAt: performance.now()
        };

        if (duration < 0) {
            this.persistentBoxes.set(id, box);
        } else {
            this.boxes.set(id, box);
        }

        return id;
    }

    /**
     * Draw a box from center and size
     */
    boxFromCenter(center: Vector3, size: Vector3, color?: string, wireframe: boolean = true, duration: number = 0): string {
        const halfSize = size.clone().multiplyScalar(0.5);
        const min = center.clone().sub(halfSize);
        const max = center.clone().add(halfSize);
        return this.box(min, max, color, wireframe, duration);
    }

    /**
     * Draw a sphere
     */
    sphere(center: Vector3, radius: number, color?: string, segments: number = 16, duration: number = 0): string {
        const id = `sphere_${++this.idCounter}`;
        this.spheres.set(id, {
            id,
            center: center.clone(),
            radius,
            color: color ?? this.config.colliderColor,
            segments,
            duration,
            createdAt: performance.now()
        });
        return id;
    }

    /**
     * Draw a wireframe circle
     */
    circle(center: Vector3, radius: number, normal: Vector3, color?: string, segments: number = 32, duration: number = 0): string[] {
        const ids: string[] = [];
        
        // Create basis vectors perpendicular to normal
        const up = Math.abs(normal.y) < 0.99 ? new Vector3(0, 1, 0) : new Vector3(1, 0, 0);
        const tangent = up.clone().cross(normal).normalize();
        const bitangent = normal.clone().cross(tangent).normalize();

        for (let i = 0; i < segments; i++) {
            const angle1 = (i / segments) * Math.PI * 2;
            const angle2 = ((i + 1) / segments) * Math.PI * 2;

            const p1 = center.clone()
                .add(tangent.clone().multiplyScalar(Math.cos(angle1) * radius))
                .add(bitangent.clone().multiplyScalar(Math.sin(angle1) * radius));

            const p2 = center.clone()
                .add(tangent.clone().multiplyScalar(Math.cos(angle2) * radius))
                .add(bitangent.clone().multiplyScalar(Math.sin(angle2) * radius));

            ids.push(this.line(p1, p2, color, duration));
        }

        return ids;
    }

    /**
     * Draw an arrow
     */
    arrow(start: Vector3, end: Vector3, color?: string, headSize: number = 0.2, duration: number = 0): string[] {
        const ids: string[] = [];
        const arrowColor = color ?? this.config.rayColor;

        // Main line
        ids.push(this.line(start, end, arrowColor, duration));

        // Arrow head
        const direction = end.clone().sub(start).normalize();
        const length = end.clone().sub(start).length();
        const headLength = Math.min(headSize, length * 0.3);

        // Get perpendicular vectors
        const up = Math.abs(direction.y) < 0.99 ? new Vector3(0, 1, 0) : new Vector3(1, 0, 0);
        const right = up.clone().cross(direction).normalize().multiplyScalar(headLength * 0.5);
        const back = direction.clone().multiplyScalar(-headLength);

        const headBase = end.clone().add(back);
        ids.push(this.line(end, headBase.clone().add(right), arrowColor, duration));
        ids.push(this.line(end, headBase.clone().sub(right), arrowColor, duration));

        return ids;
    }

    /**
     * Draw coordinate axes at a position
     */
    axes(position: Vector3, scale: number = 1, duration: number = 0): string[] {
        const ids: string[] = [];

        ids.push(...this.arrow(position, position.clone().add(new Vector3(scale, 0, 0)), '#ff0000', scale * 0.1, duration));
        ids.push(...this.arrow(position, position.clone().add(new Vector3(0, scale, 0)), '#00ff00', scale * 0.1, duration));
        ids.push(...this.arrow(position, position.clone().add(new Vector3(0, 0, scale)), '#0000ff', scale * 0.1, duration));

        return ids.flat();
    }

    /**
     * Draw a grid on XZ plane
     */
    grid(center: Vector3, size: number = 10, divisions: number = 10, color?: string, duration: number = -1): string[] {
        const ids: string[] = [];
        const gridColor = color ?? this.config.gridColor;
        const halfSize = size / 2;
        const step = size / divisions;

        for (let i = 0; i <= divisions; i++) {
            const offset = -halfSize + i * step;

            // X-parallel lines
            ids.push(this.line(
                new Vector3(-halfSize + center.x, center.y, offset + center.z),
                new Vector3(halfSize + center.x, center.y, offset + center.z),
                gridColor,
                duration
            ));

            // Z-parallel lines
            ids.push(this.line(
                new Vector3(offset + center.x, center.y, -halfSize + center.z),
                new Vector3(offset + center.x, center.y, halfSize + center.z),
                gridColor,
                duration
            ));
        }

        return ids;
    }

    /**
     * Draw 3D text
     */
    text(position: Vector3, text: string, color: string = '#ffffff', size: number = 1, duration: number = 0): string {
        const id = `text_${++this.idCounter}`;
        this.texts.set(id, {
            id,
            position: position.clone(),
            text,
            color,
            size,
            duration,
            createdAt: performance.now()
        });
        return id;
    }

    /**
     * Draw a frustum (camera view)
     */
    frustum(
        position: Vector3,
        forward: Vector3,
        up: Vector3,
        fov: number,
        aspect: number,
        near: number,
        far: number,
        color?: string,
        duration: number = 0
    ): string[] {
        const ids: string[] = [];
        const frustumColor = color ?? '#ffff00';

        const right = forward.clone().cross(up).normalize();
        const realUp = right.clone().cross(forward).normalize();

        const halfFovRad = (fov * Math.PI / 180) / 2;
        const nearHeight = Math.tan(halfFovRad) * near;
        const nearWidth = nearHeight * aspect;
        const farHeight = Math.tan(halfFovRad) * far;
        const farWidth = farHeight * aspect;

        // Near plane corners
        const nearCenter = position.clone().add(forward.clone().multiplyScalar(near));
        const nTL = nearCenter.clone().add(realUp.clone().multiplyScalar(nearHeight)).sub(right.clone().multiplyScalar(nearWidth));
        const nTR = nearCenter.clone().add(realUp.clone().multiplyScalar(nearHeight)).add(right.clone().multiplyScalar(nearWidth));
        const nBL = nearCenter.clone().sub(realUp.clone().multiplyScalar(nearHeight)).sub(right.clone().multiplyScalar(nearWidth));
        const nBR = nearCenter.clone().sub(realUp.clone().multiplyScalar(nearHeight)).add(right.clone().multiplyScalar(nearWidth));

        // Far plane corners
        const farCenter = position.clone().add(forward.clone().multiplyScalar(far));
        const fTL = farCenter.clone().add(realUp.clone().multiplyScalar(farHeight)).sub(right.clone().multiplyScalar(farWidth));
        const fTR = farCenter.clone().add(realUp.clone().multiplyScalar(farHeight)).add(right.clone().multiplyScalar(farWidth));
        const fBL = farCenter.clone().sub(realUp.clone().multiplyScalar(farHeight)).sub(right.clone().multiplyScalar(farWidth));
        const fBR = farCenter.clone().sub(realUp.clone().multiplyScalar(farHeight)).add(right.clone().multiplyScalar(farWidth));

        // Near plane
        ids.push(this.line(nTL, nTR, frustumColor, duration));
        ids.push(this.line(nTR, nBR, frustumColor, duration));
        ids.push(this.line(nBR, nBL, frustumColor, duration));
        ids.push(this.line(nBL, nTL, frustumColor, duration));

        // Far plane
        ids.push(this.line(fTL, fTR, frustumColor, duration));
        ids.push(this.line(fTR, fBR, frustumColor, duration));
        ids.push(this.line(fBR, fBL, frustumColor, duration));
        ids.push(this.line(fBL, fTL, frustumColor, duration));

        // Connecting edges
        ids.push(this.line(nTL, fTL, frustumColor, duration));
        ids.push(this.line(nTR, fTR, frustumColor, duration));
        ids.push(this.line(nBL, fBL, frustumColor, duration));
        ids.push(this.line(nBR, fBR, frustumColor, duration));

        return ids;
    }

    /**
     * Draw a path (connected line segments)
     */
    path(points: Vector3[], color?: string, closed: boolean = false, duration: number = 0): string[] {
        const ids: string[] = [];
        const pathColor = color ?? '#ffffff';

        for (let i = 0; i < points.length - 1; i++) {
            ids.push(this.line(points[i], points[i + 1], pathColor, duration));
        }

        if (closed && points.length > 2) {
            ids.push(this.line(points[points.length - 1], points[0], pathColor, duration));
        }

        return ids;
    }

    /**
     * Remove a debug element
     */
    remove(id: string): void {
        this.lines.delete(id);
        this.points.delete(id);
        this.boxes.delete(id);
        this.spheres.delete(id);
        this.texts.delete(id);
        this.persistentLines.delete(id);
        this.persistentBoxes.delete(id);
    }

    /**
     * Clear all debug elements (except persistent)
     */
    clear(): void {
        this.lines.clear();
        this.points.clear();
        this.boxes.clear();
        this.spheres.clear();
        this.texts.clear();
    }

    /**
     * Clear everything including persistent
     */
    clearAll(): void {
        this.clear();
        this.persistentLines.clear();
        this.persistentBoxes.clear();
    }

    /**
     * Update (remove expired elements)
     */
    update(): void {
        const now = performance.now();

        for (const [id, line] of this.lines) {
            if (line.duration > 0 && now - line.createdAt > line.duration * 1000) {
                this.lines.delete(id);
            }
        }

        for (const [id, point] of this.points) {
            if (point.duration > 0 && now - point.createdAt > point.duration * 1000) {
                this.points.delete(id);
            }
        }

        for (const [id, box] of this.boxes) {
            if (box.duration > 0 && now - box.createdAt > box.duration * 1000) {
                this.boxes.delete(id);
            }
        }

        for (const [id, sphere] of this.spheres) {
            if (sphere.duration > 0 && now - sphere.createdAt > sphere.duration * 1000) {
                this.spheres.delete(id);
            }
        }

        for (const [id, text] of this.texts) {
            if (text.duration > 0 && now - text.createdAt > text.duration * 1000) {
                this.texts.delete(id);
            }
        }
    }

    /**
     * Get all elements for rendering
     */
    getElements(): {
        lines: DebugLine[];
        points: DebugPoint[];
        boxes: DebugBox[];
        spheres: DebugSphere[];
        texts: DebugText[];
    } {
        return {
            lines: [...this.lines.values(), ...this.persistentLines.values()],
            points: [...this.points.values()],
            boxes: [...this.boxes.values(), ...this.persistentBoxes.values()],
            spheres: [...this.spheres.values()],
            texts: [...this.texts.values()]
        };
    }

    /**
     * Get configuration
     */
    getConfig(): DebugDrawConfig {
        return { ...this.config };
    }

    /**
     * Update configuration
     */
    setConfig(config: Partial<DebugDrawConfig>): void {
        this.config = { ...this.config, ...config };
    }

    /**
     * Enable/disable debug draw
     */
    setEnabled(enabled: boolean): void {
        this.config.enabled = enabled;
    }

    /**
     * Check if enabled
     */
    isEnabled(): boolean {
        return this.config.enabled;
    }
}

// Global instance
export const debugDraw = new DebugDraw();
