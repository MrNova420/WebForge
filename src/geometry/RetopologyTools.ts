/**
 * WebForge Retopology Tools
 * 
 * Tools for creating optimized quad-based topology over high-resolution sculpts.
 * Provides automatic and manual retopology workflows.
 */

import { Vector3 } from '../math/Vector3';
import { MeshData } from './MeshData';
import { MeshQualityEnhancer } from './MeshQualityEnhancer';

/**
 * Edge flow quality metrics
 */
export interface EdgeFlowMetrics {
    quadPercentage: number;      // Percentage of quad faces
    triangleCount: number;        // Number of triangles
    nGonCount: number;            // Number of n-gons (5+ sides)
    averageValence: number;       // Average vertex valence
    optimalValence: number;       // Percentage of vertices with valence 4
}

/**
 * Retopology settings
 */
export interface RetopologySettings {
    targetFaceCount: number;      // Target number of faces
    preserveSharpEdges: boolean;  // Preserve sharp edges
    quadPreference: number;       // Preference for quads (0-1)
    smoothingIterations: number;  // Smoothing passes
}

/**
 * Retopology tools
 */
export class RetopologyTools {
    private sourceMesh: MeshData;
    
    constructor(sourceMesh: MeshData) {
        this.sourceMesh = sourceMesh;
    }
    
    /**
     * Automatic quad remeshing using edge collapse and vertex split
     */
    public autoRemesh(settings: RetopologySettings): MeshData {
        // Start with a copy of the source mesh
        let mesh = this.sourceMesh.clone();
        
        // Simplify to target face count
        mesh = this.simplifyMesh(mesh, settings.targetFaceCount);
        
        // Convert triangles to quads where possible
        if (settings.quadPreference > 0) {
            mesh = this.convertToQuads(mesh, settings.quadPreference);
        }
        
        // Smooth the result
        for (let i = 0; i < settings.smoothingIterations; i++) {
            mesh = this.smoothMesh(mesh);
        }
        
        return mesh;
    }
    
    /**
     * Simplify mesh to target face count using edge collapse
     */
    /**
     * Simplify mesh to target face count using edge collapse
     * Uses a cost-based approach where shorter edges are collapsed first
     */
    private simplifyMesh(mesh: MeshData, targetFaceCount: number): MeshData {
        const currentFaceCount = mesh.getFaceCount();
        
        if (currentFaceCount <= targetFaceCount) {
            return mesh;
        }
        
        // Use the MeshQualityEnhancer's LOD generation for simplification
        // The number of LOD levels correlates with reduction ratio
        const lodLevels = targetFaceCount < currentFaceCount / 2 ? 3 : 2;
        const lods = MeshQualityEnhancer.generateLODs(mesh, lodLevels);
        return lods.length > 1 ? lods[lods.length - 1] : mesh.clone();
    }
    
    /**
     * Convert triangles to quads where possible
     */
    private convertToQuads(mesh: MeshData, preference: number): MeshData {
        // Find pairs of triangles that can be merged into quads
        const indices = mesh.getIndices();
        const newIndices: number[] = [];
        const processed = new Set<number>();
        
        for (let i = 0; i < indices.length; i += 3) {
            if (processed.has(i)) continue;
            
            const tri1 = [indices[i], indices[i + 1], indices[i + 2]];
            
            // Try to find a neighboring triangle that shares an edge
            let foundQuad = false;
            for (let j = i + 3; j < indices.length && !foundQuad; j += 3) {
                if (processed.has(j)) continue;
                
                const tri2 = [indices[j], indices[j + 1], indices[j + 2]];
                
                // Check if triangles share an edge
                const sharedVerts = tri1.filter(v => tri2.includes(v));
                if (sharedVerts.length === 2) {
                    // Found a quad!
                    if (Math.random() < preference) {
                        // Merge into quad (store as two triangles for now)
                        newIndices.push(...tri1, ...tri2);
                        processed.add(i);
                        processed.add(j);
                        foundQuad = true;
                    }
                }
            }
            
            if (!foundQuad) {
                // Keep as triangle
                newIndices.push(...tri1);
                processed.add(i);
            }
        }
        
        // Create new mesh with updated indices
        const attributes = {
            position: mesh.getPositions(),
            normal: mesh.getNormals(),
            uv: mesh.getUVs()
        };
        
        const newMesh = new MeshData(attributes, newIndices);
        newMesh.computeNormals();
        return newMesh;
    }
    
    /**
     * Smooth mesh vertices
     */
    private smoothMesh(mesh: MeshData): MeshData {
        const newMesh = mesh.clone();
        
        for (let i = 0; i < mesh.getVertexCount(); i++) {
            const neighbors = this.getNeighborVertices(mesh, i);
            
            if (neighbors.length > 0) {
                let sum = new Vector3(0, 0, 0);
                for (const neighborIndex of neighbors) {
                    sum.addSelf(mesh.getVertex(neighborIndex));
                }
                
                const average = sum.divideScalar(neighbors.length);
                const current = mesh.getVertex(i);
                
                // Blend between current and average (0.5 = 50% smooth)
                const smoothed = current.lerp(average, 0.5);
                newMesh.setVertex(i, smoothed);
            }
        }
        
        newMesh.computeNormals();
        return newMesh;
    }
    
    /**
     * Get neighbor vertices for a vertex
     */
    private getNeighborVertices(mesh: MeshData, vertexIndex: number): number[] {
        const neighbors: number[] = [];
        const indices = mesh.getIndices();
        
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
     * Analyze edge flow quality
     */
    public analyzeEdgeFlow(mesh: MeshData): EdgeFlowMetrics {
        const indices = mesh.getIndices();
        const vertexCount = mesh.getVertexCount();
        
        // Count face types by analyzing shared edges between adjacent triangles
        const triangleCount = Math.floor(indices.length / 3);
        
        // Build edge-to-face adjacency for quad detection
        const edgeToFaces = new Map<string, number[]>();
        for (let f = 0; f < triangleCount; f++) {
            const tri = [indices[f * 3], indices[f * 3 + 1], indices[f * 3 + 2]];
            for (let e = 0; e < 3; e++) {
                const a = Math.min(tri[e], tri[(e + 1) % 3]);
                const b = Math.max(tri[e], tri[(e + 1) % 3]);
                const key = `${a}_${b}`;
                if (!edgeToFaces.has(key)) edgeToFaces.set(key, []);
                edgeToFaces.get(key)!.push(f);
            }
        }
        
        // Detect quads: pairs of triangles sharing an edge where the combined shape
        // is nearly planar (coplanar normals) and forms a valid quadrilateral
        const usedInQuad = new Set<number>();
        let quadCount = 0;
        
        for (const [, faces] of edgeToFaces) {
            if (faces.length !== 2) continue;
            const [f0, f1] = faces;
            if (usedInQuad.has(f0) || usedInQuad.has(f1)) continue;
            
            // Check if the two triangles are coplanar enough to form a quad
            const t0 = [indices[f0 * 3], indices[f0 * 3 + 1], indices[f0 * 3 + 2]];
            const t1 = [indices[f1 * 3], indices[f1 * 3 + 1], indices[f1 * 3 + 2]];
            
            const positions = mesh.getPositions();
            const p0 = new Vector3(positions[t0[0]*3], positions[t0[0]*3+1], positions[t0[0]*3+2]);
            const p1 = new Vector3(positions[t0[1]*3], positions[t0[1]*3+1], positions[t0[1]*3+2]);
            const p2 = new Vector3(positions[t0[2]*3], positions[t0[2]*3+1], positions[t0[2]*3+2]);
            const p3_candidates = t1.filter(v => !t0.includes(v));
            if (p3_candidates.length !== 1) continue;
            const p3v = p3_candidates[0];
            const p3 = new Vector3(positions[p3v*3], positions[p3v*3+1], positions[p3v*3+2]);
            
            // Check coplanarity by comparing normals
            const n0 = p1.subtract(p0).cross(p2.subtract(p0)).normalize();
            const n1 = p1.subtract(p3).cross(p2.subtract(p3)).normalize();
            const dotN = Math.abs(n0.dot(n1));
            
            if (dotN > 0.95) { // Nearly coplanar
                quadCount++;
                usedInQuad.add(f0);
                usedInQuad.add(f1);
            }
        }
        
        // N-gons: vertices with >6 adjacent faces suggest n-gon-like topology
        const vertFaceCount = new Array(vertexCount).fill(0);
        for (let f = 0; f < triangleCount; f++) {
            vertFaceCount[indices[f * 3]]++;
            vertFaceCount[indices[f * 3 + 1]]++;
            vertFaceCount[indices[f * 3 + 2]]++;
        }
        // Count vertices that are poles (>6 faces adjacent = likely n-gon center)
        const nGonCount = vertFaceCount.filter(c => c > 8).length;
        
        const totalFaces = triangleCount + quadCount + nGonCount;
        const quadPercentage = totalFaces > 0 ? (quadCount / totalFaces) * 100 : 0;
        
        // Calculate vertex valence (number of edges per vertex)
        const valence = new Array(vertexCount).fill(0);
        
        for (let i = 0; i < indices.length; i += 3) {
            const v0 = indices[i];
            const v1 = indices[i + 1];
            const v2 = indices[i + 2];
            
            valence[v0]++;
            valence[v1]++;
            valence[v2]++;
        }
        
        // Calculate average valence
        const totalValence = valence.reduce((sum, v) => sum + v, 0);
        const averageValence = totalValence / vertexCount;
        
        // Calculate percentage of optimal valence (4 for quad meshes, 6 for tri meshes)
        const optimalValenceTarget = 6; // For triangle meshes
        const optimalCount = valence.filter(v => v === optimalValenceTarget).length;
        const optimalValence = (optimalCount / vertexCount) * 100;
        
        return {
            quadPercentage,
            triangleCount,
            nGonCount,
            averageValence,
            optimalValence
        };
    }
    
    /**
     * Optimize edge flow by redistributing vertices and balancing valence
     */
    public optimizeEdgeFlow(mesh: MeshData, iterations: number = 10): MeshData {
        let optimizedMesh = mesh.clone();
        
        for (let iter = 0; iter < iterations; iter++) {
            // Smooth to improve edge flow
            optimizedMesh = this.smoothMesh(optimizedMesh);
            
            // Balance vertex valence by redistributing triangles around pole vertices
            optimizedMesh = this.balanceValence(optimizedMesh);
        }
        
        return optimizedMesh;
    }
    
    /**
     * Balance vertex valence by moving high-valence vertex neighbors slightly
     * toward ideal distribution. Pole vertices (valence >> 6) get their
     * neighbors smoothed more aggressively to reduce fan irregularity.
     */
    private balanceValence(mesh: MeshData): MeshData {
        const positions = mesh.getPositions();
        const indices = mesh.getIndices();
        const vertexCount = mesh.getVertexCount();
        
        if (vertexCount === 0 || indices.length === 0) return mesh;
        
        // Calculate valence per vertex
        const valence = new Array(vertexCount).fill(0);
        for (let i = 0; i < indices.length; i++) {
            valence[indices[i]]++;
        }
        
        // Build adjacency: vertex -> neighboring vertices
        const neighbors = new Map<number, Set<number>>();
        for (let i = 0; i < vertexCount; i++) {
            neighbors.set(i, new Set());
        }
        for (let i = 0; i < indices.length; i += 3) {
            const a = indices[i], b = indices[i+1], c = indices[i+2];
            neighbors.get(a)?.add(b); neighbors.get(a)?.add(c);
            neighbors.get(b)?.add(a); neighbors.get(b)?.add(c);
            neighbors.get(c)?.add(a); neighbors.get(c)?.add(b);
        }
        
        // Copy positions for output
        const newPositions = [...positions];
        const optimalValence = 6; // For triangle meshes
        
        for (let v = 0; v < vertexCount; v++) {
            const vertValence = valence[v];
            if (vertValence <= optimalValence) continue;
            
            // High-valence vertex: average neighbors slightly more
            const vNeighbors = neighbors.get(v);
            if (!vNeighbors || vNeighbors.size === 0) continue;
            
            const strength = Math.min(0.3, (vertValence - optimalValence) * 0.05);
            
            let avgX = 0, avgY = 0, avgZ = 0;
            for (const n of vNeighbors) {
                avgX += positions[n * 3];
                avgY += positions[n * 3 + 1];
                avgZ += positions[n * 3 + 2];
            }
            avgX /= vNeighbors.size;
            avgY /= vNeighbors.size;
            avgZ /= vNeighbors.size;
            
            // Move vertex toward neighbor average
            newPositions[v * 3] = positions[v * 3] * (1 - strength) + avgX * strength;
            newPositions[v * 3 + 1] = positions[v * 3 + 1] * (1 - strength) + avgY * strength;
            newPositions[v * 3 + 2] = positions[v * 3 + 2] * (1 - strength) + avgZ * strength;
        }
        
        const attrs: any = { position: newPositions };
        const normals = mesh.getNormals();
        const uvs = mesh.getUVs();
        if (normals) attrs.normal = [...normals];
        if (uvs) attrs.uv = [...uvs];
        
        return new MeshData(attrs, [...indices]);
    }
    
    /**
     * Create guide curves for manual retopology
     */
    public createGuideCurves(curvePoints: Vector3[]): Vector3[] {
        // Project curve points onto source mesh surface
        const projectedPoints: Vector3[] = [];
        
        for (const point of curvePoints) {
            // Find nearest point on mesh surface
            const nearestPoint = this.projectToSurface(point);
            projectedPoints.push(nearestPoint);
        }
        
        return projectedPoints;
    }
    
    /**
     * Project point to mesh surface
     */
    private projectToSurface(point: Vector3): Vector3 {
        let nearestPoint = point.clone();
        let nearestDistSq = Infinity;
        
        // Find nearest vertex (simplified - should raycast to surface)
        for (let i = 0; i < this.sourceMesh.getVertexCount(); i++) {
            const vertex = this.sourceMesh.getVertex(i);
            const distSq = point.distanceToSquared(vertex);
            
            if (distSq < nearestDistSq) {
                nearestDistSq = distSq;
                nearestPoint = vertex;
            }
        }
        
        return nearestPoint;
    }
}
