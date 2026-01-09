/**
 * WebForge Weight Painting System
 * 
 * Paint vertex weights for skeletal rigging and deformation.
 * Supports multiple bone influences and weight normalization.
 */

import { Vector3 } from '../math/Vector3';
import { MeshData } from './MeshData';

/**
 * Vertex weight for a single bone
 */
export interface BoneWeight {
    boneIndex: number;
    weight: number;
}

/**
 * Vertex weight data (up to 4 bone influences per vertex)
 */
export interface VertexWeights {
    weights: BoneWeight[];
}

/**
 * Weight paint brush settings
 */
export interface WeightBrushSettings {
    radius: number;          // Brush radius
    strength: number;        // Brush strength (0-1)
    falloff: 'linear' | 'smooth' | 'sharp';
    mode: 'add' | 'subtract' | 'replace' | 'smooth';
    activeBoneIndex: number; // Bone being painted
}

/**
 * Weight painting system
 */
export class WeightPaintingSystem {
    private mesh: MeshData;
    private vertexWeights: Map<number, VertexWeights>; // vertex index -> weights
    private boneNames: string[];
    private settings: WeightBrushSettings;
    // @ts-expect-error - Used for brush stroke continuity (future enhancement)
    private _previousPosition: Vector3 | null = null;
    
    constructor(mesh: MeshData, boneNames: string[] = []) {
        this.mesh = mesh;
        this.boneNames = boneNames;
        this.vertexWeights = new Map();
        
        // Initialize weights for all vertices
        for (let i = 0; i < mesh.getVertexCount(); i++) {
            this.vertexWeights.set(i, { weights: [] });
        }
        
        this.settings = {
            radius: 1.0,
            strength: 0.5,
            falloff: 'smooth',
            mode: 'replace',
            activeBoneIndex: 0
        };
    }
    
    /**
     * Add a bone
     */
    public addBone(boneName: string): number {
        this.boneNames.push(boneName);
        return this.boneNames.length - 1;
    }
    
    /**
     * Get all bone names
     */
    public getBoneNames(): string[] {
        return [...this.boneNames];
    }
    
    /**
     * Update brush settings
     */
    public updateSettings(settings: Partial<WeightBrushSettings>): void {
        this.settings = { ...this.settings, ...settings };
    }
    
    /**
     * Get current settings
     */
    public getSettings(): WeightBrushSettings {
        return { ...this.settings };
    }
    
    /**
     * Paint weights at 3D position
     */
    public paintAt(position: Vector3): void {
        const affectedVertices = this.getAffectedVertices(position);
        
        for (const [vertexIndex, falloffWeight] of affectedVertices) {
            const paintStrength = falloffWeight * this.settings.strength;
            
            switch (this.settings.mode) {
                case 'add':
                    this.addWeight(vertexIndex, this.settings.activeBoneIndex, paintStrength);
                    break;
                case 'subtract':
                    this.subtractWeight(vertexIndex, this.settings.activeBoneIndex, paintStrength);
                    break;
                case 'replace':
                    this.replaceWeight(vertexIndex, this.settings.activeBoneIndex, paintStrength);
                    break;
                case 'smooth':
                    this.smoothWeights(vertexIndex, paintStrength);
                    break;
            }
            
            // Normalize weights to sum to 1.0
            this.normalizeVertexWeights(vertexIndex);
        }
        
        this._previousPosition = position.clone();
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
                const t = distance / this.settings.radius;
                const falloff = this.calculateFalloff(t);
                affected.set(i, falloff);
            }
        }
        
        return affected;
    }
    
    /**
     * Calculate falloff weight
     */
    private calculateFalloff(t: number): number {
        switch (this.settings.falloff) {
            case 'linear':
                return 1.0 - t;
            case 'smooth':
                return 1.0 - (3.0 * t * t - 2.0 * t * t * t);
            case 'sharp':
                return (1.0 - t) * (1.0 - t);
            default:
                return 1.0 - t;
        }
    }
    
    /**
     * Add weight to vertex
     */
    private addWeight(vertexIndex: number, boneIndex: number, weight: number): void {
        const vertexWeights = this.vertexWeights.get(vertexIndex);
        if (!vertexWeights) return;
        
        const existing = vertexWeights.weights.find(w => w.boneIndex === boneIndex);
        if (existing) {
            existing.weight = Math.min(1.0, existing.weight + weight);
        } else if (vertexWeights.weights.length < 4) {
            vertexWeights.weights.push({ boneIndex, weight });
        } else {
            // Replace lowest weight if new weight is higher
            const minWeight = Math.min(...vertexWeights.weights.map(w => w.weight));
            if (weight > minWeight) {
                const minIndex = vertexWeights.weights.findIndex(w => w.weight === minWeight);
                vertexWeights.weights[minIndex] = { boneIndex, weight };
            }
        }
    }
    
    /**
     * Subtract weight from vertex
     */
    private subtractWeight(vertexIndex: number, boneIndex: number, weight: number): void {
        const vertexWeights = this.vertexWeights.get(vertexIndex);
        if (!vertexWeights) return;
        
        const existing = vertexWeights.weights.find(w => w.boneIndex === boneIndex);
        if (existing) {
            existing.weight = Math.max(0.0, existing.weight - weight);
            
            // Remove if weight is too small
            if (existing.weight < 0.001) {
                vertexWeights.weights = vertexWeights.weights.filter(w => w.boneIndex !== boneIndex);
            }
        }
    }
    
    /**
     * Replace weight (set to specific value)
     */
    private replaceWeight(vertexIndex: number, boneIndex: number, weight: number): void {
        const vertexWeights = this.vertexWeights.get(vertexIndex);
        if (!vertexWeights) return;
        
        const existing = vertexWeights.weights.find(w => w.boneIndex === boneIndex);
        if (existing) {
            existing.weight = weight;
        } else if (vertexWeights.weights.length < 4) {
            vertexWeights.weights.push({ boneIndex, weight });
        }
    }
    
    /**
     * Smooth weights by averaging with neighbors
     */
    private smoothWeights(vertexIndex: number, strength: number): void {
        const neighbors = this.getNeighborVertices(vertexIndex);
        if (neighbors.length === 0) return;
        
        const vertexWeights = this.vertexWeights.get(vertexIndex);
        if (!vertexWeights) return;
        
        // Collect all bone indices from this vertex and neighbors
        const allBoneIndices = new Set<number>();
        vertexWeights.weights.forEach(w => allBoneIndices.add(w.boneIndex));
        
        for (const neighborIndex of neighbors) {
            const neighborWeights = this.vertexWeights.get(neighborIndex);
            if (neighborWeights) {
                neighborWeights.weights.forEach(w => allBoneIndices.add(w.boneIndex));
            }
        }
        
        // Calculate average weight for each bone
        const averagedWeights: BoneWeight[] = [];
        for (const boneIndex of allBoneIndices) {
            let totalWeight = 0;
            let count = 0;
            
            // Add current vertex weight
            const currentWeight = vertexWeights.weights.find(w => w.boneIndex === boneIndex);
            if (currentWeight) {
                totalWeight += currentWeight.weight;
                count++;
            }
            
            // Add neighbor weights
            for (const neighborIndex of neighbors) {
                const neighborWeights = this.vertexWeights.get(neighborIndex);
                if (neighborWeights) {
                    const neighborWeight = neighborWeights.weights.find(w => w.boneIndex === boneIndex);
                    if (neighborWeight) {
                        totalWeight += neighborWeight.weight;
                        count++;
                    }
                }
            }
            
            if (count > 0) {
                const averageWeight = totalWeight / count;
                averagedWeights.push({ boneIndex, weight: averageWeight });
            }
        }
        
        // Blend between current and averaged weights
        for (const averaged of averagedWeights) {
            const current = vertexWeights.weights.find(w => w.boneIndex === averaged.boneIndex);
            if (current) {
                current.weight = current.weight * (1.0 - strength) + averaged.weight * strength;
            } else if (vertexWeights.weights.length < 4) {
                vertexWeights.weights.push({ boneIndex: averaged.boneIndex, weight: averaged.weight * strength });
            }
        }
    }
    
    /**
     * Normalize vertex weights to sum to 1.0
     */
    private normalizeVertexWeights(vertexIndex: number): void {
        const vertexWeights = this.vertexWeights.get(vertexIndex);
        if (!vertexWeights || vertexWeights.weights.length === 0) return;
        
        const totalWeight = vertexWeights.weights.reduce((sum, w) => sum + w.weight, 0);
        
        if (totalWeight > 0.001) {
            for (const weight of vertexWeights.weights) {
                weight.weight /= totalWeight;
            }
        }
        
        // Sort by weight (descending) and keep top 4
        vertexWeights.weights.sort((a, b) => b.weight - a.weight);
        if (vertexWeights.weights.length > 4) {
            vertexWeights.weights = vertexWeights.weights.slice(0, 4);
        }
    }
    
    /**
     * Get neighbor vertices
     */
    private getNeighborVertices(vertexIndex: number): number[] {
        const neighbors: number[] = [];
        const indices = this.mesh.getIndices();
        
        for (let i = 0; i < indices.length; i += 3) {
            const v0 = indices[i];
            const v1 = indices[i + 1];
            const v2 = indices[i + 2];
            
            if (v0 === vertexIndex) {
                if (!neighbors.includes(v1)) neighbors.push(v1);
                if (!neighbors.includes(v2)) neighbors.push(v2);
            } else if (v1 === vertexIndex) {
                if (!neighbors.includes(v0)) neighbors.push(v0);
                if (!neighbors.includes(v2)) neighbors.push(v2);
            } else if (v2 === vertexIndex) {
                if (!neighbors.includes(v0)) neighbors.push(v0);
                if (!neighbors.includes(v1)) neighbors.push(v1);
            }
        }
        
        return neighbors;
    }
    
    /**
     * Get weights for a vertex
     */
    public getVertexWeights(vertexIndex: number): VertexWeights | undefined {
        return this.vertexWeights.get(vertexIndex);
    }
    
    /**
     * Set weights for a vertex
     */
    public setVertexWeights(vertexIndex: number, weights: VertexWeights): void {
        this.vertexWeights.set(vertexIndex, weights);
        this.normalizeVertexWeights(vertexIndex);
    }
    
    /**
     * Auto-weight vertices based on bone proximity
     */
    public autoWeight(bonePositions: Vector3[]): void {
        for (let i = 0; i < this.mesh.getVertexCount(); i++) {
            const vertex = this.mesh.getVertex(i);
            const weights: BoneWeight[] = [];
            
            // Calculate distance to each bone
            const distances = bonePositions.map((bonePos, boneIndex) => ({
                boneIndex,
                distance: vertex.distanceTo(bonePos)
            }));
            
            // Sort by distance
            distances.sort((a, b) => a.distance - b.distance);
            
            // Use closest 4 bones
            const maxBones = Math.min(4, distances.length);
            let totalInvDist = 0;
            
            for (let j = 0; j < maxBones; j++) {
                const invDist = 1.0 / (distances[j].distance + 0.001);
                totalInvDist += invDist;
                weights.push({ boneIndex: distances[j].boneIndex, weight: invDist });
            }
            
            // Normalize weights
            for (const weight of weights) {
                weight.weight /= totalInvDist;
            }
            
            this.vertexWeights.set(i, { weights });
        }
    }
    
    /**
     * Export weights as arrays (for GPU skinning)
     */
    public exportWeights(): { indices: number[], weights: number[] } {
        const indices: number[] = [];
        const weights: number[] = [];
        
        for (let i = 0; i < this.mesh.getVertexCount(); i++) {
            const vertexWeights = this.vertexWeights.get(i);
            
            // Pad to 4 influences
            for (let j = 0; j < 4; j++) {
                if (vertexWeights && j < vertexWeights.weights.length) {
                    indices.push(vertexWeights.weights[j].boneIndex);
                    weights.push(vertexWeights.weights[j].weight);
                } else {
                    indices.push(0);
                    weights.push(0);
                }
            }
        }
        
        return { indices, weights };
    }
    
    /**
     * Reset stroke
     */
    public resetStroke(): void {
        this._previousPosition = null;
    }
}
