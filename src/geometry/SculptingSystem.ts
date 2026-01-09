/**
 * WebForge Sculpting System
 * 
 * Advanced sculpting tools for organic modeling with dynamic mesh detail.
 * Provides multiple brush types with falloff curves and symmetry support.
 */

import { Vector3 } from '../math/Vector3';
import { MeshData } from './MeshData';

/**
 * Brush types for sculpting
 */
export enum BrushType {
    DRAW = 'draw',           // Push/pull vertices along normal
    SMOOTH = 'smooth',       // Average vertex positions
    GRAB = 'grab',           // Move vertices with brush
    INFLATE = 'inflate',     // Expand/contract uniformly
    FLATTEN = 'flatten',     // Flatten to average plane
    PINCH = 'pinch',         // Pull vertices toward center
    CREASE = 'crease'        // Create sharp edges
}

/**
 * Falloff curve types
 */
export enum FalloffType {
    LINEAR = 'linear',       // Linear falloff
    SMOOTH = 'smooth',       // Smooth cubic falloff
    SHARP = 'sharp',         // Sharp quadratic falloff
    CONSTANT = 'constant'    // Constant strength
}

/**
 * Brush settings
 */
export interface BrushSettings {
    type: BrushType;
    radius: number;          // Brush radius
    strength: number;        // Brush strength (0-1)
    falloff: FalloffType;
    symmetry: boolean;       // X-axis symmetry
    dynamicTopology: boolean; // Enable dynamic tessellation
}

/**
 * Sculpting system
 */
export class SculptingSystem {
    private mesh: MeshData;
    private settings: BrushSettings;
    private previousPosition: Vector3 | null = null;
    
    constructor(mesh: MeshData) {
        this.mesh = mesh;
        this.settings = {
            type: BrushType.DRAW,
            radius: 1.0,
            strength: 0.5,
            falloff: FalloffType.SMOOTH,
            symmetry: false,
            dynamicTopology: false
        };
    }
    
    /**
     * Update brush settings
     */
    public updateSettings(settings: Partial<BrushSettings>): void {
        this.settings = { ...this.settings, ...settings };
    }
    
    /**
     * Get current settings
     */
    public getSettings(): BrushSettings {
        return { ...this.settings };
    }
    
    /**
     * Apply brush stroke at position
     */
    public applyBrush(position: Vector3, normal: Vector3): void {
        const affectedVertices = this.getAffectedVertices(position);
        
        switch (this.settings.type) {
            case BrushType.DRAW:
                this.applyDraw(affectedVertices, position, normal);
                break;
            case BrushType.SMOOTH:
                this.applySmooth(affectedVertices);
                break;
            case BrushType.GRAB:
                this.applyGrab(affectedVertices, position);
                break;
            case BrushType.INFLATE:
                this.applyInflate(affectedVertices);
                break;
            case BrushType.FLATTEN:
                this.applyFlatten(affectedVertices, position, normal);
                break;
            case BrushType.PINCH:
                this.applyPinch(affectedVertices, position);
                break;
            case BrushType.CREASE:
                this.applyCrease(affectedVertices, position, normal);
                break;
        }
        
        // Apply symmetry if enabled
        if (this.settings.symmetry) {
            this.applySymmetry(affectedVertices);
        }
        
        // Dynamic topology (subdivision) if enabled
        if (this.settings.dynamicTopology) {
            this.applyDynamicTopology(affectedVertices);
        }
        
        // Recompute normals after sculpting
        this.mesh.computeNormals();
        
        this.previousPosition = position.clone();
    }
    
    /**
     * Get vertices affected by brush
     */
    private getAffectedVertices(position: Vector3): Map<number, number> {
        const affected = new Map<number, number>();
        const radiusSq = this.settings.radius * this.settings.radius;
        
        for (let i = 0; i < this.mesh.getVertexCount(); i++) {
            const vertex = this.mesh.getVertex(i);
            const distSq = vertex.distanceToSquared(position);
            
            if (distSq <= radiusSq) {
                const distance = Math.sqrt(distSq);
                const weight = this.calculateFalloff(distance / this.settings.radius);
                affected.set(i, weight * this.settings.strength);
            }
        }
        
        return affected;
    }
    
    /**
     * Calculate falloff weight based on distance ratio (0-1)
     */
    private calculateFalloff(t: number): number {
        switch (this.settings.falloff) {
            case FalloffType.LINEAR:
                return 1.0 - t;
            case FalloffType.SMOOTH:
                // Smooth cubic falloff
                return 1.0 - (3.0 * t * t - 2.0 * t * t * t);
            case FalloffType.SHARP:
                // Sharp quadratic falloff
                return (1.0 - t) * (1.0 - t);
            case FalloffType.CONSTANT:
                return 1.0;
            default:
                return 1.0 - t;
        }
    }
    
    /**
     * Apply draw brush (push/pull along normal)
     */
    private applyDraw(affected: Map<number, number>, _position: Vector3, normal: Vector3): void {
        for (const [index, weight] of affected) {
            const vertex = this.mesh.getVertex(index);
            const offset = normal.multiplyScalar(weight);
            this.mesh.setVertex(index, vertex.add(offset));
        }
    }
    
    /**
     * Apply smooth brush
     */
    private applySmooth(affected: Map<number, number>): void {
        const smoothed = new Map<number, Vector3>();
        
        // Calculate smoothed positions (average of neighbors)
        for (const [index, weight] of affected) {
            const vertex = this.mesh.getVertex(index);
            const neighbors = this.getNeighborVertices(index);
            
            if (neighbors.length > 0) {
                let sum = new Vector3(0, 0, 0);
                for (const neighbor of neighbors) {
                    sum.addSelf(this.mesh.getVertex(neighbor));
                }
                const average = sum.divideScalar(neighbors.length);
                smoothed.set(index, vertex.lerp(average, weight));
            }
        }
        
        // Apply smoothed positions
        for (const [index, position] of smoothed) {
            this.mesh.setVertex(index, position);
        }
    }
    
    /**
     * Apply grab brush
     */
    private applyGrab(affected: Map<number, number>, position: Vector3): void {
        if (!this.previousPosition) {
            this.previousPosition = position.clone();
            return;
        }
        
        const delta = position.subtract(this.previousPosition);
        
        for (const [index, weight] of affected) {
            const vertex = this.mesh.getVertex(index);
            const offset = delta.multiplyScalar(weight);
            this.mesh.setVertex(index, vertex.add(offset));
        }
    }
    
    /**
     * Apply inflate brush
     */
    private applyInflate(affected: Map<number, number>): void {
        for (const [index, weight] of affected) {
            const vertex = this.mesh.getVertex(index);
            const normal = this.getVertexNormal(index);
            const offset = normal.multiplyScalar(weight);
            this.mesh.setVertex(index, vertex.add(offset));
        }
    }
    
    /**
     * Apply flatten brush
     */
    private applyFlatten(affected: Map<number, number>, position: Vector3, normal: Vector3): void {
        // Create plane at brush position
        for (const [index, weight] of affected) {
            const vertex = this.mesh.getVertex(index);
            const toPlane = position.subtract(vertex);
            const distance = toPlane.dot(normal);
            const offset = normal.multiplyScalar(distance * weight);
            this.mesh.setVertex(index, vertex.add(offset));
        }
    }
    
    /**
     * Apply pinch brush
     */
    private applyPinch(affected: Map<number, number>, position: Vector3): void {
        for (const [index, weight] of affected) {
            const vertex = this.mesh.getVertex(index);
            const toCenter = position.subtract(vertex);
            const offset = toCenter.multiplyScalar(weight);
            this.mesh.setVertex(index, vertex.add(offset));
        }
    }
    
    /**
     * Apply crease brush
     */
    private applyCrease(affected: Map<number, number>, _position: Vector3, normal: Vector3): void {
        // Similar to draw but with sharper falloff and stronger effect
        for (const [index, weight] of affected) {
            const vertex = this.mesh.getVertex(index);
            const sharpWeight = weight * weight; // Sharpen falloff
            const offset = normal.multiplyScalar(sharpWeight * 2.0);
            this.mesh.setVertex(index, vertex.add(offset));
        }
    }
    
    /**
     * Apply X-axis symmetry
     */
    private applySymmetry(affected: Map<number, number>): void {
        const mirrored = new Map<number, Vector3>();
        
        for (const [index] of affected) {
            const vertex = this.mesh.getVertex(index);
            
            // Find mirrored vertex on opposite side of X-axis
            const mirrorVertex = new Vector3(-vertex.x, vertex.y, vertex.z);
            const mirrorIndex = this.findNearestVertex(mirrorVertex);
            
            if (mirrorIndex !== -1 && mirrorIndex !== index) {
                const mirroredPos = this.mesh.getVertex(index);
                mirrored.set(mirrorIndex, new Vector3(-mirroredPos.x, mirroredPos.y, mirroredPos.z));
            }
        }
        
        // Apply mirrored positions
        for (const [index, position] of mirrored) {
            this.mesh.setVertex(index, position);
        }
    }
    
    /**
     * Apply dynamic topology (simple subdivision of affected triangles)
     */
    private applyDynamicTopology(_affected: Map<number, number>): void {
        // TODO: Implement dynamic tessellation
        // This would subdivide triangles in high-detail areas
        // For now, this is a placeholder
        console.warn('Dynamic topology not yet implemented');
    }
    
    /**
     * Get neighbor vertices for a vertex
     */
    private getNeighborVertices(index: number): number[] {
        const neighbors: number[] = [];
        const indices = this.mesh.getIndices();
        
        // Find all triangles that use this vertex
        for (let i = 0; i < indices.length; i += 3) {
            const v0 = indices[i];
            const v1 = indices[i + 1];
            const v2 = indices[i + 2];
            
            if (v0 === index) {
                if (!neighbors.includes(v1)) neighbors.push(v1);
                if (!neighbors.includes(v2)) neighbors.push(v2);
            } else if (v1 === index) {
                if (!neighbors.includes(v0)) neighbors.push(v0);
                if (!neighbors.includes(v2)) neighbors.push(v2);
            } else if (v2 === index) {
                if (!neighbors.includes(v0)) neighbors.push(v0);
                if (!neighbors.includes(v1)) neighbors.push(v1);
            }
        }
        
        return neighbors;
    }
    
    /**
     * Get vertex normal
     */
    private getVertexNormal(index: number): Vector3 {
        const normals = this.mesh.getNormals();
        if (!normals) {
            return new Vector3(0, 1, 0);
        }
        
        const i = index * 3;
        return new Vector3(normals[i], normals[i + 1], normals[i + 2]).normalize();
    }
    
    /**
     * Find nearest vertex to position
     */
    private findNearestVertex(position: Vector3, threshold: number = 0.01): number {
        let nearestIndex = -1;
        let nearestDistSq = threshold * threshold;
        
        for (let i = 0; i < this.mesh.getVertexCount(); i++) {
            const vertex = this.mesh.getVertex(i);
            const distSq = vertex.distanceToSquared(position);
            
            if (distSq < nearestDistSq) {
                nearestDistSq = distSq;
                nearestIndex = i;
            }
        }
        
        return nearestIndex;
    }
    
    /**
     * Reset previous position (call when starting new stroke)
     */
    public resetStroke(): void {
        this.previousPosition = null;
    }
}
