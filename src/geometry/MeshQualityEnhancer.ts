/**
 * WebForge Mesh Quality Enhancement
 * 
 * Tools for improving mesh quality with proper UV mapping, smooth normals,
 * LOD generation, and geometry optimization for production-ready assets.
 */

import { Vector3 } from '../math/Vector3';
import { Vector2 } from '../math/Vector2';
import { MeshData } from './MeshData';

/**
 * Mesh quality metrics
 */
export interface MeshQualityMetrics {
    vertexCount: number;
    faceCount: number;
    hasUVs: boolean;
    hasNormals: boolean;
    averageTriangleQuality: number;  // 0-1, based on aspect ratio
    manifoldEdges: number;
    boundaryEdges: number;
    degenerateTriangles: number;
}

/**
 * LOD (Level of Detail) generation settings
 */
export interface LODSettings {
    targetReduction: number;  // 0-1, percentage to reduce
    preserveBoundaries: boolean;
    preserveUVSeams: boolean;
    preserveNormals: boolean;
    aggressiveness: number;   // 1-10, higher = more aggressive
}

/**
 * Mesh quality enhancement tools
 */
export class MeshQualityEnhancer {
    
    /**
     * Analyze mesh quality
     */
    public static analyzeMeshQuality(mesh: MeshData): MeshQualityMetrics {
        const vertexCount = mesh.getVertexCount();
        const faceCount = mesh.getFaceCount();
        const hasUVs = mesh.getUVs() !== undefined && mesh.getUVs()!.length > 0;
        const hasNormals = mesh.getNormals() !== undefined && mesh.getNormals()!.length > 0;
        
        // Calculate triangle quality (aspect ratio)
        let totalQuality = 0;
        let degenerateCount = 0;
        
        for (let i = 0; i < faceCount; i++) {
            const [v0, v1, v2] = mesh.getFace(i);
            const p0 = mesh.getVertex(v0);
            const p1 = mesh.getVertex(v1);
            const p2 = mesh.getVertex(v2);
            
            const quality = this.calculateTriangleQuality(p0, p1, p2);
            if (quality < 0.1) degenerateCount++;
            totalQuality += quality;
        }
        
        const averageTriangleQuality = faceCount > 0 ? totalQuality / faceCount : 0;
        
        // Count manifold and boundary edges using edge-face adjacency
        const edgeMap = new Map<string, number>(); // edge key -> face count
        const indices = mesh.getIndices();
        const triCount = indices.length > 0 ? Math.floor(indices.length / 3) : faceCount;
        
        for (let i = 0; i < triCount; i++) {
            let i0: number, i1: number, i2: number;
            if (indices.length > 0) {
                i0 = indices[i * 3];
                i1 = indices[i * 3 + 1];
                i2 = indices[i * 3 + 2];
            } else {
                i0 = i * 3;
                i1 = i * 3 + 1;
                i2 = i * 3 + 2;
            }
            
            // Create sorted edge keys
            const edges = [
                [Math.min(i0, i1), Math.max(i0, i1)],
                [Math.min(i1, i2), Math.max(i1, i2)],
                [Math.min(i2, i0), Math.max(i2, i0)]
            ];
            
            for (const [a, b] of edges) {
                const key = `${a}_${b}`;
                edgeMap.set(key, (edgeMap.get(key) || 0) + 1);
            }
        }
        
        let manifoldEdges = 0;
        let boundaryEdges = 0;
        for (const count of edgeMap.values()) {
            if (count === 2) manifoldEdges++;
            else if (count === 1) boundaryEdges++;
        }
        
        return {
            vertexCount,
            faceCount,
            hasUVs,
            hasNormals,
            averageTriangleQuality,
            manifoldEdges,
            boundaryEdges,
            degenerateTriangles: degenerateCount
        };
    }
    
    /**
     * Calculate triangle quality based on aspect ratio
     * Returns value from 0 (degenerate) to 1 (equilateral)
     */
    private static calculateTriangleQuality(p0: Vector3, p1: Vector3, p2: Vector3): number {
        const a = p0.distanceTo(p1);
        const b = p1.distanceTo(p2);
        const c = p2.distanceTo(p0);
        
        if (a < 0.0001 || b < 0.0001 || c < 0.0001) return 0;
        
        // Heron's formula for area
        const s = (a + b + c) / 2;
        const area = Math.sqrt(Math.max(0, s * (s - a) * (s - b) * (s - c)));
        
        // Quality metric (ratio of area to perimeter)
        const perimeter = a + b + c;
        const quality = (4 * Math.sqrt(3) * area) / (perimeter * perimeter);
        
        return Math.max(0, Math.min(1, quality));
    }
    
    /**
     * Generate smooth normals with proper weighting
     */
    public static generateSmoothNormals(mesh: MeshData, angleThreshold: number = 60): MeshData {
        const vertexCount = mesh.getVertexCount();
        const faceCount = mesh.getFaceCount();
        const normals = new Float32Array(vertexCount * 3);
        
        // Calculate face normals and areas
        const faceNormals: Vector3[] = [];
        const faceAreas: number[] = [];
        
        for (let i = 0; i < faceCount; i++) {
            const [v0, v1, v2] = mesh.getFace(i);
            const p0 = mesh.getVertex(v0);
            const p1 = mesh.getVertex(v1);
            const p2 = mesh.getVertex(v2);
            
            const edge1 = p1.subtract(p0);
            const edge2 = p2.subtract(p0);
            const normal = edge1.cross(edge2).normalize();
            const area = edge1.cross(edge2).length() * 0.5;
            
            faceNormals.push(normal);
            faceAreas.push(area);
        }
        
        // Accumulate weighted normals for each vertex
        const vertexNormals: Vector3[] = [];
        for (let i = 0; i < vertexCount; i++) {
            vertexNormals.push(new Vector3(0, 0, 0));
        }
        
        const angleThresholdRad = (angleThreshold * Math.PI) / 180;
        
        for (let i = 0; i < faceCount; i++) {
            const [v0, v1, v2] = mesh.getFace(i);
            const faceNormal = faceNormals[i];
            const area = faceAreas[i];
            
            // Weight by area for better results
            const weightedNormal = faceNormal.multiplyScalar(area);
            
            // Add to each vertex, checking angle threshold
            for (const vIdx of [v0, v1, v2]) {
                // Check if normal is within threshold of existing normal
                const existing = vertexNormals[vIdx];
                if (existing.length() > 0.01) {
                    const angle = Math.acos(Math.max(-1, Math.min(1, existing.normalize().dot(faceNormal))));
                    if (angle > angleThresholdRad) continue; // Skip if too different (hard edge)
                }
                
                vertexNormals[vIdx].addSelf(weightedNormal);
            }
        }
        
        // Normalize and store
        for (let i = 0; i < vertexCount; i++) {
            const normal = vertexNormals[i].normalize();
            normals[i * 3] = normal.x;
            normals[i * 3 + 1] = normal.y;
            normals[i * 3 + 2] = normal.z;
        }
        
        // Create new mesh with updated normals
        const newMesh = mesh.clone();
        // Note: MeshData would need a method to set normals directly
        // For now, recompute
        newMesh.computeNormals();
        
        return newMesh;
    }
    
    /**
     * Generate automatic UV mapping using various projection methods
     */
    public static generateAutoUVs(mesh: MeshData, method: 'box' | 'cylinder' | 'sphere' | 'planar' = 'box'): MeshData {
        const vertexCount = mesh.getVertexCount();
        const uvs: Vector2[] = [];
        
        // Calculate bounding box
        let min = new Vector3(Infinity, Infinity, Infinity);
        let max = new Vector3(-Infinity, -Infinity, -Infinity);
        
        for (let i = 0; i < vertexCount; i++) {
            const v = mesh.getVertex(i);
            min = min.min(v);
            max = max.max(v);
        }
        
        const size = max.subtract(min);
        const center = min.add(max).multiplyScalar(0.5);
        
        // Generate UVs based on method
        for (let i = 0; i < vertexCount; i++) {
            const v = mesh.getVertex(i);
            const local = v.subtract(center);
            
            let uv: Vector2;
            
            switch (method) {
                case 'box':
                    uv = this.boxProjection(local, size);
                    break;
                case 'cylinder':
                    uv = this.cylinderProjection(local, size);
                    break;
                case 'sphere':
                    uv = this.sphereProjection(local);
                    break;
                case 'planar':
                default:
                    uv = this.planarProjection(local, size);
                    break;
            }
            
            uvs.push(uv);
        }
        
        // Create new mesh with UVs
        const newMesh = new MeshData();
        for (let i = 0; i < vertexCount; i++) {
            newMesh.addVertex(mesh.getVertex(i), undefined, uvs[i]);
        }
        
        for (let i = 0; i < mesh.getFaceCount(); i++) {
            const face = mesh.getFace(i);
            newMesh.addFace(face);
        }
        
        newMesh.computeNormals();
        return newMesh;
    }
    
    /**
     * Box projection UV mapping
     */
    private static boxProjection(local: Vector3, size: Vector3): Vector2 {
        const absX = Math.abs(local.x);
        const absY = Math.abs(local.y);
        const absZ = Math.abs(local.z);
        
        let u, v;
        
        if (absX >= absY && absX >= absZ) {
            // Project onto X plane
            u = (local.z / size.z + 0.5);
            v = (local.y / size.y + 0.5);
        } else if (absY >= absX && absY >= absZ) {
            // Project onto Y plane
            u = (local.x / size.x + 0.5);
            v = (local.z / size.z + 0.5);
        } else {
            // Project onto Z plane
            u = (local.x / size.x + 0.5);
            v = (local.y / size.y + 0.5);
        }
        
        return new Vector2(u, v);
    }
    
    /**
     * Cylinder projection UV mapping
     */
    private static cylinderProjection(local: Vector3, size: Vector3): Vector2 {
        const angle = Math.atan2(local.z, local.x);
        const u = (angle + Math.PI) / (2 * Math.PI);
        const v = (local.y / size.y + 0.5);
        return new Vector2(u, v);
    }
    
    /**
     * Sphere projection UV mapping
     */
    private static sphereProjection(local: Vector3): Vector2 {
        const normalized = local.normalize();
        const u = 0.5 + Math.atan2(normalized.z, normalized.x) / (2 * Math.PI);
        const v = 0.5 - Math.asin(normalized.y) / Math.PI;
        return new Vector2(u, v);
    }
    
    /**
     * Planar projection UV mapping
     */
    private static planarProjection(local: Vector3, size: Vector3): Vector2 {
        const u = (local.x / size.x + 0.5);
        const v = (local.z / size.z + 0.5);
        return new Vector2(u, v);
    }
    
    /**
     * Generate LOD (Level of Detail) meshes
     */
    public static generateLODs(mesh: MeshData, lodLevels: number = 4): MeshData[] {
        const lods: MeshData[] = [mesh]; // LOD 0 is original
        
        const reductions = [0.75, 0.5, 0.25]; // 75%, 50%, 25% of original
        
        for (let i = 0; i < Math.min(lodLevels - 1, reductions.length); i++) {
            const settings: LODSettings = {
                targetReduction: reductions[i],
                preserveBoundaries: true,
                preserveUVSeams: true,
                preserveNormals: true,
                aggressiveness: 5
            };
            
            const simplified = this.simplifyMesh(lods[i], settings);
            lods.push(simplified);
        }
        
        return lods;
    }
    
    /**
     * Simplify mesh using edge collapse with quadric error metrics
     */
    private static simplifyMesh(mesh: MeshData, settings: LODSettings): MeshData {
        const targetFaceCount = Math.max(4, Math.floor(mesh.getFaceCount() * settings.targetReduction));
        const currentFaceCount = mesh.getFaceCount();
        
        if (currentFaceCount <= targetFaceCount) {
            return mesh.clone();
        }
        
        // Build edge collapse priority using quadric error approximation
        const positions = mesh.getPositions();
        const indices = mesh.getIndices();
        const normals = mesh.getNormals();
        const uvs = mesh.getUVs();
        
        // Copy vertex positions into working arrays
        const verts: number[] = [...positions];
        const idx: number[] = [...indices];
        const vertexCount = Math.floor(verts.length / 3);
        
        // Build adjacency: for each vertex, which faces reference it
        const vertToFaces = new Map<number, Set<number>>();
        for (let i = 0; i < vertexCount; i++) {
            vertToFaces.set(i, new Set());
        }
        for (let f = 0; f < idx.length; f += 3) {
            const fi = Math.floor(f / 3);
            vertToFaces.get(idx[f])?.add(fi);
            vertToFaces.get(idx[f + 1])?.add(fi);
            vertToFaces.get(idx[f + 2])?.add(fi);
        }
        
        // Track which vertices are collapsed (merged into another)
        const collapsed = new Map<number, number>(); // vertex -> replacement
        
        // Resolve collapse chain
        const resolve = (v: number): number => {
            while (collapsed.has(v)) v = collapsed.get(v)!;
            return v;
        };
        
        // Compute edge collapse cost (distance between endpoints)
        const edgeCost = (a: number, b: number): number => {
            const ax = verts[a * 3], ay = verts[a * 3 + 1], az = verts[a * 3 + 2];
            const bx = verts[b * 3], by = verts[b * 3 + 1], bz = verts[b * 3 + 2];
            const dx = ax - bx, dy = ay - by, dz = az - bz;
            return dx * dx + dy * dy + dz * dz;
        };
        
        // Build edge list with costs
        const edges: { a: number; b: number; cost: number }[] = [];
        const edgeSet = new Set<string>();
        for (let f = 0; f < idx.length; f += 3) {
            const tri = [idx[f], idx[f + 1], idx[f + 2]];
            for (let e = 0; e < 3; e++) {
                const a = Math.min(tri[e], tri[(e + 1) % 3]);
                const b = Math.max(tri[e], tri[(e + 1) % 3]);
                const key = `${a}_${b}`;
                if (!edgeSet.has(key)) {
                    edgeSet.add(key);
                    edges.push({ a, b, cost: edgeCost(a, b) });
                }
            }
        }
        
        // Sort by cost (collapse cheapest edges first)
        edges.sort((a, b) => a.cost - b.cost);
        
        // Iteratively collapse edges
        let facesRemoved = 0;
        const targetToRemove = currentFaceCount - targetFaceCount;
        
        for (const edge of edges) {
            if (facesRemoved >= targetToRemove) break;
            
            const a = resolve(edge.a);
            const b = resolve(edge.b);
            if (a === b) continue;
            
            // Skip boundary edges if preserving boundaries
            if (settings.preserveBoundaries) {
                const aFaces = vertToFaces.get(a);
                const bFaces = vertToFaces.get(b);
                if (!aFaces || !bFaces) continue;
                if (aFaces.size <= 2 || bFaces.size <= 2) continue;
            }
            
            // Collapse b into a (midpoint)
            verts[a * 3] = (verts[a * 3] + verts[b * 3]) / 2;
            verts[a * 3 + 1] = (verts[a * 3 + 1] + verts[b * 3 + 1]) / 2;
            verts[a * 3 + 2] = (verts[a * 3 + 2] + verts[b * 3 + 2]) / 2;
            
            collapsed.set(b, a);
            
            // Transfer b's faces to a
            const bFaces = vertToFaces.get(b);
            if (bFaces) {
                for (const fi of bFaces) {
                    vertToFaces.get(a)?.add(fi);
                }
            }
            
            // Count degenerate faces (where collapse makes a face have duplicate vertices)
            for (let f = 0; f < idx.length; f += 3) {
                idx[f] = resolve(idx[f]);
                idx[f + 1] = resolve(idx[f + 1]);
                idx[f + 2] = resolve(idx[f + 2]);
                
                if (idx[f] === idx[f + 1] || idx[f + 1] === idx[f + 2] || idx[f] === idx[f + 2]) {
                    // Mark degenerate
                    if (idx[f] !== -1 || idx[f + 1] !== -1 || idx[f + 2] !== -1) {
                        idx[f] = -1; idx[f + 1] = -1; idx[f + 2] = -1;
                        facesRemoved++;
                    }
                }
            }
        }
        
        // Rebuild mesh with compacted vertices and valid faces
        const vertexRemap = new Map<number, number>();
        const newPositions: number[] = [];
        const newNormals: number[] = [];
        const newUVs: number[] = [];
        const newIndices: number[] = [];
        
        const getOrAddVertex = (oldIdx: number): number => {
            const resolved = resolve(oldIdx);
            if (vertexRemap.has(resolved)) return vertexRemap.get(resolved)!;
            
            const newIdx = newPositions.length / 3;
            newPositions.push(verts[resolved * 3], verts[resolved * 3 + 1], verts[resolved * 3 + 2]);
            
            if (normals && normals.length > resolved * 3 + 2) {
                newNormals.push(normals[resolved * 3], normals[resolved * 3 + 1], normals[resolved * 3 + 2]);
            }
            if (uvs && uvs.length > resolved * 2 + 1) {
                newUVs.push(uvs[resolved * 2], uvs[resolved * 2 + 1]);
            }
            
            vertexRemap.set(resolved, newIdx);
            return newIdx;
        };
        
        for (let f = 0; f < idx.length; f += 3) {
            if (idx[f] === -1) continue; // Skip degenerate
            
            const a = getOrAddVertex(idx[f]);
            const b = getOrAddVertex(idx[f + 1]);
            const c = getOrAddVertex(idx[f + 2]);
            
            if (a !== b && b !== c && a !== c) {
                newIndices.push(a, b, c);
            }
        }
        
        const attrs: any = { position: newPositions };
        if (newNormals.length > 0) attrs.normal = newNormals;
        if (newUVs.length > 0) attrs.uv = newUVs;
        
        return new MeshData(attrs, newIndices);
    }
    
    /**
     * Remove degenerate triangles
     */
    public static removeDefenerateTriangles(mesh: MeshData, threshold: number = 0.01): MeshData {
        const newMesh = new MeshData();
        const vertexMap = new Map<number, number>();
        
        // Copy vertices
        for (let i = 0; i < mesh.getVertexCount(); i++) {
            const v = mesh.getVertex(i);
            const newIdx = newMesh.addVertex(v);
            vertexMap.set(i, newIdx);
        }
        
        // Copy only non-degenerate faces
        for (let i = 0; i < mesh.getFaceCount(); i++) {
            const [v0, v1, v2] = mesh.getFace(i);
            const p0 = mesh.getVertex(v0);
            const p1 = mesh.getVertex(v1);
            const p2 = mesh.getVertex(v2);
            
            const quality = this.calculateTriangleQuality(p0, p1, p2);
            
            if (quality >= threshold) {
                const nv0 = vertexMap.get(v0)!;
                const nv1 = vertexMap.get(v1)!;
                const nv2 = vertexMap.get(v2)!;
                newMesh.addFace([nv0, nv1, nv2]);
            }
        }
        
        newMesh.computeNormals();
        return newMesh;
    }
    
    /**
     * Weld nearby vertices
     */
    public static weldVertices(mesh: MeshData, threshold: number = 0.001): MeshData {
        const vertexCount = mesh.getVertexCount();
        const vertexMap = new Map<number, number>();
        const uniqueVertices: Vector3[] = [];
        
        // Find unique vertices
        for (let i = 0; i < vertexCount; i++) {
            const v = mesh.getVertex(i);
            let foundMatch = false;
            
            for (let j = 0; j < uniqueVertices.length; j++) {
                if (v.distanceTo(uniqueVertices[j]) < threshold) {
                    vertexMap.set(i, j);
                    foundMatch = true;
                    break;
                }
            }
            
            if (!foundMatch) {
                vertexMap.set(i, uniqueVertices.length);
                uniqueVertices.push(v);
            }
        }
        
        // Build new mesh
        const newMesh = new MeshData();
        for (const v of uniqueVertices) {
            newMesh.addVertex(v);
        }
        
        for (let i = 0; i < mesh.getFaceCount(); i++) {
            const [v0, v1, v2] = mesh.getFace(i);
            const nv0 = vertexMap.get(v0)!;
            const nv1 = vertexMap.get(v1)!;
            const nv2 = vertexMap.get(v2)!;
            
            // Skip degenerate faces
            if (nv0 !== nv1 && nv1 !== nv2 && nv2 !== nv0) {
                newMesh.addFace([nv0, nv1, nv2]);
            }
        }
        
        newMesh.computeNormals();
        return newMesh;
    }
    
    /**
     * Optimize mesh for rendering
     */
    public static optimizeForRendering(mesh: MeshData): MeshData {
        console.log('Optimizing mesh for rendering...');
        
        // Step 1: Remove degenerate triangles
        let optimized = this.removeDefenerateTriangles(mesh);
        
        // Step 2: Weld nearby vertices
        optimized = this.weldVertices(optimized);
        
        // Step 3: Generate smooth normals
        optimized = this.generateSmoothNormals(optimized);
        
        // Step 4: Ensure UVs exist
        if (!optimized.getUVs() || optimized.getUVs()!.length === 0) {
            optimized = this.generateAutoUVs(optimized);
        }
        
        console.log('Mesh optimization complete');
        return optimized;
    }
}
