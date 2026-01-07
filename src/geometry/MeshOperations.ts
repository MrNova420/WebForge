/**
 * WebForge Mesh Operations
 * 
 * Common mesh editing operations like extrude, subdivide, merge, etc.
 */

import { MeshData } from './MeshData';
import { HalfEdgeMesh } from './HalfEdgeMesh';
import { Vector3 } from '../math/Vector3';

/**
 * Mesh operations class
 */
export class MeshOperations {
    /**
     * Extrudes selected faces
     */
    public static extrudeFaces(mesh: MeshData, faceIndices: number[], distance: number): MeshData {
        const result = mesh.clone();
        const halfEdge = HalfEdgeMesh.fromMeshData(result);
        
        // For each selected face
        for (const faceIndex of faceIndices) {
            const verts = halfEdge.getFaceVertices(faceIndex);
            
            // Calculate face normal
            const p0 = result.getVertex(verts[0]);
            const p1 = result.getVertex(verts[1]);
            const p2 = result.getVertex(verts[2]);
            
            const edge1 = p1.subtract(p0);
            const edge2 = p2.subtract(p0);
            const normal = edge1.cross(edge2).normalize();
            
            // Create new vertices
            const newVerts: number[] = [];
            for (const vertIndex of verts) {
                const pos = result.getVertex(vertIndex);
                const newPos = pos.add(normal.multiplyScalar(distance));
                const newIndex = result.addVertex(newPos);
                newVerts.push(newIndex);
            }
            
            // Create new faces (simplified)
            if (newVerts.length === 3) {
                result.addFace(newVerts[0], newVerts[1], newVerts[2]);
            }
        }
        
        result.computeNormals();
        return result;
    }
    
    /**
     * Subdivides mesh using simple subdivision
     */
    public static subdivide(mesh: MeshData): MeshData {
        const result = new MeshData({ position: [] }, []);
        
        // Add original vertices
        for (let i = 0; i < mesh.getVertexCount(); i++) {
            result.addVertex(mesh.getVertex(i));
        }
        
        // For each face, create 4 new faces
        const edgeMidpoints = new Map<string, number>();
        
        for (let i = 0; i < mesh.getFaceCount(); i++) {
            const [v0, v1, v2] = mesh.getFace(i);
            
            // Get or create edge midpoints
            const m01 = this.getOrCreateMidpoint(result, edgeMidpoints, v0, v1, mesh);
            const m12 = this.getOrCreateMidpoint(result, edgeMidpoints, v1, v2, mesh);
            const m20 = this.getOrCreateMidpoint(result, edgeMidpoints, v2, v0, mesh);
            
            // Create 4 new faces
            result.addFace(v0, m01, m20);
            result.addFace(v1, m12, m01);
            result.addFace(v2, m20, m12);
            result.addFace(m01, m12, m20);
        }
        
        result.computeNormals();
        return result;
    }
    
    /**
     * Gets or creates a midpoint vertex
     */
    private static getOrCreateMidpoint(
        mesh: MeshData,
        edgeMidpoints: Map<string, number>,
        v0: number,
        v1: number,
        originalMesh: MeshData
    ): number {
        const key = v0 < v1 ? `${v0}-${v1}` : `${v1}-${v0}`;
        
        if (edgeMidpoints.has(key)) {
            return edgeMidpoints.get(key)!;
        }
        
        const p0 = originalMesh.getVertex(v0);
        const p1 = originalMesh.getVertex(v1);
        const mid = new Vector3(
            (p0.x + p1.x) / 2,
            (p0.y + p1.y) / 2,
            (p0.z + p1.z) / 2
        );
        
        const index = mesh.addVertex(mid);
        edgeMidpoints.set(key, index);
        return index;
    }
    
    /**
     * Merges vertices within a threshold distance
     */
    public static mergeVertices(mesh: MeshData, threshold: number = 0.0001): MeshData {
        const result = mesh.clone();
        const vertexMap = new Map<number, number>();
        
        // Build vertex merge map
        for (let i = 0; i < result.getVertexCount(); i++) {
            if (vertexMap.has(i)) continue;
            
            const p1 = result.getVertex(i);
            
            for (let j = i + 1; j < result.getVertexCount(); j++) {
                if (vertexMap.has(j)) continue;
                
                const p2 = result.getVertex(j);
                const dist = p1.subtract(p2).length();
                
                if (dist < threshold) {
                    vertexMap.set(j, i);
                }
            }
        }
        
        // Remap indices
        const indices = result.getIndices();
        for (let i = 0; i < indices.length; i++) {
            const mapped = vertexMap.get(indices[i]);
            if (mapped !== undefined) {
                indices[i] = mapped;
            }
        }
        
        return result;
    }
    
    /**
     * Smooths mesh using Laplacian smoothing
     */
    public static smooth(mesh: MeshData, iterations: number = 1): MeshData {
        const result = mesh.clone();
        const halfEdge = HalfEdgeMesh.fromMeshData(result);
        
        for (let iter = 0; iter < iterations; iter++) {
            const newPositions: Vector3[] = [];
            
            for (let i = 0; i < result.getVertexCount(); i++) {
                const neighbors = halfEdge.getVertexNeighbors(i);
                
                if (neighbors.length === 0) {
                    newPositions.push(result.getVertex(i));
                    continue;
                }
                
                // Average neighbor positions
                let sum = new Vector3();
                for (const neighbor of neighbors) {
                    sum = sum.add(result.getVertex(neighbor));
                }
                
                const avg = sum.multiplyScalar(1 / neighbors.length);
                newPositions.push(avg);
            }
            
            // Apply new positions
            for (let i = 0; i < newPositions.length; i++) {
                result.setVertex(i, newPositions[i]);
            }
        }
        
        result.computeNormals();
        return result;
    }
}
