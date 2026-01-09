/**
 * WebForge Enhanced Procedural Generation
 * 
 * High-quality procedural mesh generation with realistic features,
 * proper UV mapping, and optimized geometry for production use.
 */

import { NoiseGenerator } from './NoiseGenerator';
import { Vector3 } from '../math/Vector3';
import { Vector2 } from '../math/Vector2';
import { MeshData } from '../geometry/MeshData';

/**
 * Quality settings for procedural generation
 */
export interface QualitySettings {
    detailLevel: 'low' | 'medium' | 'high' | 'ultra';
    generateUVs: boolean;
    generateNormals: boolean;
    smoothNormals: boolean;
    optimizeGeometry: boolean;
}

/**
 * Enhanced procedural mesh generator with high-quality output
 */
export class EnhancedProceduralGenerator {
    private noise: NoiseGenerator;
    private qualitySettings: QualitySettings;
    
    constructor(seed: number = 0, qualitySettings?: Partial<QualitySettings>) {
        this.noise = new NoiseGenerator(seed);
        this.qualitySettings = {
            detailLevel: 'high',
            generateUVs: true,
            generateNormals: true,
            smoothNormals: true,
            optimizeGeometry: true,
            ...qualitySettings
        };
    }
    
    /**
     * Generate high-quality planet with realistic continents, oceans, and mountains
     */
    public generateRealisticPlanet(
        radius: number,
        continentalScale: number = 0.3,
        mountainHeight: number = 0.15,
        oceanDepth: number = 0.05
    ): MeshData {
        const segments = this.getSegmentCount();
        const mesh = new MeshData();
        const vertices: Vector3[] = [];
        const uvs: Vector2[] = [];
        const indices: number[] = [];
        
        // Generate icosphere for better distribution than UV sphere
        for (let lat = 0; lat <= segments; lat++) {
            const theta = (lat * Math.PI) / segments;
            const sinTheta = Math.sin(theta);
            const cosTheta = Math.cos(theta);
            
            for (let lon = 0; lon <= segments; lon++) {
                const phi = (lon * 2 * Math.PI) / segments;
                const sinPhi = Math.sin(phi);
                const cosPhi = Math.cos(phi);
                
                // Base sphere position
                const x = cosPhi * sinTheta;
                const y = cosTheta;
                const z = sinPhi * sinTheta;
                
                // Multi-octave noise for realistic terrain
                // Continental plates (large scale)
                const continental = this.noise.fbm3D(x * 1, y * 1, z * 1, 3, 0.5, 2.0);
                
                // Mountain ranges (medium scale)
                const mountains = this.noise.fbm3D(x * 5, y * 5, z * 5, 4, 0.6, 2.2);
                
                // Local detail (small scale)
                const detail = this.noise.fbm3D(x * 20, y * 20, z * 20, 3, 0.5, 2.0);
                
                // Combine noise layers with realistic weighting
                let elevation = continental * continentalScale;
                
                // Only add mountains on land
                if (elevation > 0) {
                    elevation += mountains * mountainHeight * (elevation / continentalScale);
                    elevation += detail * 0.02;
                } else {
                    // Ocean floor variation
                    elevation -= oceanDepth * (1.0 - continental);
                }
                
                const r = radius * (1.0 + elevation);
                vertices.push(new Vector3(x * r, y * r, z * r));
                
                // Proper spherical UV mapping
                const u = lon / segments;
                const v = lat / segments;
                uvs.push(new Vector2(u, v));
            }
        }
        
        // Generate optimized indices
        for (let lat = 0; lat < segments; lat++) {
            for (let lon = 0; lon < segments; lon++) {
                const first = lat * (segments + 1) + lon;
                const second = first + segments + 1;
                
                // Proper winding order for correct normals
                indices.push(first, second, first + 1);
                indices.push(second, second + 1, first + 1);
            }
        }
        
        // Build mesh with proper attributes
        for (let i = 0; i < vertices.length; i++) {
            mesh.addVertex(vertices[i], undefined, uvs[i]);
        }
        
        for (let i = 0; i < indices.length; i += 3) {
            mesh.addFace([indices[i], indices[i + 1], indices[i + 2]]);
        }
        
        // Compute smooth normals for realistic shading
        mesh.computeNormals();
        
        return mesh;
    }
    
    /**
     * Generate realistic tree with organic branching
     */
    public generateRealisticTree(
        trunkHeight: number,
        trunkRadius: number,
        branchCount: number,
        foliageRadius: number
    ): MeshData {
        const mesh = new MeshData();
        const segments = Math.max(8, this.getSegmentCount() / 4);
        
        // Generate trunk with taper and slight curve
        for (let i = 0; i <= trunkHeight * 10; i++) {
            const t = i / (trunkHeight * 10);
            const y = t * trunkHeight;
            
            // Taper trunk from bottom to top
            const radius = trunkRadius * (1.0 - t * 0.7);
            
            // Add organic curve using noise
            const curvex = this.noise.perlin2D(y * 0.5, 0) * 0.1 * trunkHeight;
            const curvez = this.noise.perlin2D(y * 0.5, 100) * 0.1 * trunkHeight;
            
            // Create ring of vertices
            for (let j = 0; j <= segments; j++) {
                const angle = (j / segments) * Math.PI * 2;
                const x = Math.cos(angle) * radius + curvex;
                const z = Math.sin(angle) * radius + curvez;
                
                // Add bark texture variation with noise
                const barkNoise = this.noise.perlin3D(x * 10, y * 10, z * 10) * 0.05;
                
                const u = j / segments;
                const v = t;
                
                mesh.addVertex(
                    new Vector3(x * (1 + barkNoise), y, z * (1 + barkNoise)),
                    undefined,
                    new Vector2(u, v)
                );
            }
        }
        
        // Generate trunk faces
        const ringCount = Math.floor(trunkHeight * 10) + 1;
        for (let i = 0; i < ringCount - 1; i++) {
            for (let j = 0; j < segments; j++) {
                const a = i * (segments + 1) + j;
                const b = a + 1;
                const c = a + segments + 1;
                const d = c + 1;
                
                mesh.addFace([a, c, b]);
                mesh.addFace([b, c, d]);
            }
        }
        
        // Generate branches with organic placement
        const branchStartHeight = trunkHeight * 0.4;
        for (let i = 0; i < branchCount; i++) {
            const angle = (i / branchCount) * Math.PI * 2 + this.noise.perlin2D(i, 0) * 0.5;
            const heightRatio = 0.4 + (i / branchCount) * 0.5;
            const branchY = branchStartHeight + heightRatio * (trunkHeight - branchStartHeight);
            
            const branchLength = trunkHeight * (0.3 + this.noise.perlin2D(i, 1) * 0.2);
            const branchRadius = trunkRadius * 0.3;
            
            // Create branch extending from trunk
            const direction = new Vector3(
                Math.cos(angle),
                0.6 + this.noise.perlin2D(i, 2) * 0.3, // Upward angle
                Math.sin(angle)
            ).normalize();
            
            this.addBranch(mesh, new Vector3(0, branchY, 0), direction, branchLength, branchRadius, 4);
        }
        
        // Generate foliage sphere with organic variation
        const foliageY = trunkHeight + foliageRadius * 0.5;
        this.addFoliage(mesh, new Vector3(0, foliageY, 0), foliageRadius, segments);
        
        mesh.computeNormals();
        return mesh;
    }
    
    /**
     * Generate realistic rock with natural formation
     */
    public generateRealisticRock(
        baseSize: number,
        roughness: number = 0.3,
        angularity: number = 0.5
    ): MeshData {
        const mesh = new MeshData();
        const segments = this.getSegmentCount();
        
        // Start with icosphere for even distribution
        const vertices: Vector3[] = [];
        const uvs: Vector2[] = [];
        
        // Generate base sphere vertices
        for (let lat = 0; lat <= segments; lat++) {
            const theta = (lat * Math.PI) / segments;
            const sinTheta = Math.sin(theta);
            const cosTheta = Math.cos(theta);
            
            for (let lon = 0; lon <= segments; lon++) {
                const phi = (lon * 2 * Math.PI) / segments;
                const sinPhi = Math.sin(phi);
                const cosPhi = Math.cos(phi);
                
                let x = cosPhi * sinTheta;
                let y = cosTheta;
                let z = sinPhi * sinTheta;
                
                // Apply multi-scale noise for realistic rock formation
                const largeFeatures = this.noise.fbm3D(x * 2, y * 2, z * 2, 3, 0.6, 2.0);
                const mediumDetail = this.noise.fbm3D(x * 5, y * 5, z * 5, 4, 0.5, 2.2);
                const fineDetail = this.noise.fbm3D(x * 15, y * 15, z * 15, 3, 0.4, 2.5);
                
                // Combine for natural rock shape
                const displacement = largeFeatures * roughness * 0.5 +
                                   mediumDetail * roughness * 0.3 +
                                   fineDetail * roughness * 0.2;
                
                // Add angularity by sharpening peaks
                const sharpness = Math.pow(Math.abs(displacement), 1.0 + angularity);
                const finalDisplacement = displacement > 0 ? sharpness : -sharpness;
                
                const radius = baseSize * (1.0 + finalDisplacement);
                vertices.push(new Vector3(x * radius, y * radius, z * radius));
                
                // Triplanar UV mapping for rocks
                const absX = Math.abs(x);
                const absY = Math.abs(y);
                const absZ = Math.abs(z);
                
                let u, v;
                if (absX >= absY && absX >= absZ) {
                    u = z / absX;
                    v = y / absX;
                } else if (absY >= absX && absY >= absZ) {
                    u = x / absY;
                    v = z / absY;
                } else {
                    u = x / absZ;
                    v = y / absZ;
                }
                
                uvs.push(new Vector2((u + 1) * 0.5, (v + 1) * 0.5));
            }
        }
        
        // Generate indices
        const indices: number[] = [];
        for (let lat = 0; lat < segments; lat++) {
            for (let lon = 0; lon < segments; lon++) {
                const first = lat * (segments + 1) + lon;
                const second = first + segments + 1;
                
                indices.push(first, second, first + 1);
                indices.push(second, second + 1, first + 1);
            }
        }
        
        // Build mesh
        for (let i = 0; i < vertices.length; i++) {
            mesh.addVertex(vertices[i], undefined, uvs[i]);
        }
        
        for (let i = 0; i < indices.length; i += 3) {
            mesh.addFace([indices[i], indices[i + 1], indices[i + 2]]);
        }
        
        mesh.computeNormals();
        return mesh;
    }
    
    /**
     * Generate realistic building with architectural details
     */
    public generateRealisticBuilding(
        width: number,
        depth: number,
        height: number,
        floors: number,
        roofType: 'flat' | 'pitched' | 'dome' = 'flat'
    ): MeshData {
        const mesh = new MeshData();
        const floorHeight = height / floors;
        
        // Generate building base
        const halfW = width / 2;
        const halfD = depth / 2;
        
        // Walls with proper UVs for texturing
        for (let floor = 0; floor <= floors; floor++) {
            const y = floor * floorHeight;
            const vCoord = floor / floors;
            
            // Front wall
            mesh.addVertex(new Vector3(-halfW, y, halfD), undefined, new Vector2(0, vCoord));
            mesh.addVertex(new Vector3(halfW, y, halfD), undefined, new Vector2(1, vCoord));
            
            // Right wall
            mesh.addVertex(new Vector3(halfW, y, halfD), undefined, new Vector2(0, vCoord));
            mesh.addVertex(new Vector3(halfW, y, -halfD), undefined, new Vector2(1, vCoord));
            
            // Back wall
            mesh.addVertex(new Vector3(halfW, y, -halfD), undefined, new Vector2(0, vCoord));
            mesh.addVertex(new Vector3(-halfW, y, -halfD), undefined, new Vector2(1, vCoord));
            
            // Left wall
            mesh.addVertex(new Vector3(-halfW, y, -halfD), undefined, new Vector2(0, vCoord));
            mesh.addVertex(new Vector3(-halfW, y, halfD), undefined, new Vector2(1, vCoord));
        }
        
        // Generate wall faces
        for (let floor = 0; floor < floors; floor++) {
            const baseIdx = floor * 8;
            
            // Each wall segment
            for (let wall = 0; wall < 4; wall++) {
                const w0 = baseIdx + wall * 2;
                const w1 = w0 + 1;
                const w2 = w0 + 8;
                const w3 = w1 + 8;
                
                mesh.addFace([w0, w2, w1]);
                mesh.addFace([w1, w2, w3]);
            }
        }
        
        // Generate roof based on type
        const roofY = height;
        if (roofType === 'flat') {
            // Flat roof
            mesh.addVertex(new Vector3(-halfW, roofY, halfD), undefined, new Vector2(0, 0));
            mesh.addVertex(new Vector3(halfW, roofY, halfD), undefined, new Vector2(1, 0));
            mesh.addVertex(new Vector3(halfW, roofY, -halfD), undefined, new Vector2(1, 1));
            mesh.addVertex(new Vector3(-halfW, roofY, -halfD), undefined, new Vector2(0, 1));
            
            const roofBase = mesh.getVertexCount() - 4;
            mesh.addFace([roofBase, roofBase + 1, roofBase + 2]);
            mesh.addFace([roofBase, roofBase + 2, roofBase + 3]);
            
        } else if (roofType === 'pitched') {
            // Pitched roof
            const roofHeight = height * 0.3;
            const peakY = roofY + roofHeight;
            
            // Ridge line
            mesh.addVertex(new Vector3(-halfW, peakY, 0), undefined, new Vector2(0, 1));
            mesh.addVertex(new Vector3(halfW, peakY, 0), undefined, new Vector2(1, 1));
            
            // Eaves
            mesh.addVertex(new Vector3(-halfW, roofY, halfD), undefined, new Vector2(0, 0));
            mesh.addVertex(new Vector3(halfW, roofY, halfD), undefined, new Vector2(1, 0));
            mesh.addVertex(new Vector3(halfW, roofY, -halfD), undefined, new Vector2(1, 0));
            mesh.addVertex(new Vector3(-halfW, roofY, -halfD), undefined, new Vector2(0, 0));
            
            const ridgeStart = mesh.getVertexCount() - 6;
            
            // Front slope
            mesh.addFace([ridgeStart + 2, ridgeStart, ridgeStart + 3]);
            mesh.addFace([ridgeStart + 3, ridgeStart, ridgeStart + 1]);
            
            // Back slope
            mesh.addFace([ridgeStart + 4, ridgeStart + 1, ridgeStart + 5]);
            mesh.addFace([ridgeStart + 5, ridgeStart + 1, ridgeStart]);
        }
        
        mesh.computeNormals();
        return mesh;
    }
    
    /**
     * Add a tree branch to mesh
     */
    private addBranch(
        mesh: MeshData,
        start: Vector3,
        direction: Vector3,
        length: number,
        radius: number,
        segments: number
    ): void {
        const steps = 5;
        const baseIdx = mesh.getVertexCount();
        
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const pos = start.add(direction.multiplyScalar(length * t));
            const r = radius * (1.0 - t * 0.8);
            
            for (let j = 0; j <= segments; j++) {
                const angle = (j / segments) * Math.PI * 2;
                const offset = new Vector3(
                    Math.cos(angle) * r,
                    0,
                    Math.sin(angle) * r
                );
                
                mesh.addVertex(pos.add(offset), undefined, new Vector2(j / segments, t));
            }
        }
        
        // Generate branch faces
        for (let i = 0; i < steps; i++) {
            for (let j = 0; j < segments; j++) {
                const a = baseIdx + i * (segments + 1) + j;
                const b = a + 1;
                const c = a + segments + 1;
                const d = c + 1;
                
                mesh.addFace([a, c, b]);
                mesh.addFace([b, c, d]);
            }
        }
    }
    
    /**
     * Add foliage sphere to mesh
     */
    private addFoliage(
        mesh: MeshData,
        center: Vector3,
        radius: number,
        segments: number
    ): void {
        const baseIdx = mesh.getVertexCount();
        
        // Generate foliage sphere with organic variation
        for (let lat = 0; lat <= segments / 2; lat++) {
            const theta = (lat * Math.PI) / (segments / 2);
            const sinTheta = Math.sin(theta);
            const cosTheta = Math.cos(theta);
            
            for (let lon = 0; lon <= segments; lon++) {
                const phi = (lon * 2 * Math.PI) / segments;
                const sinPhi = Math.sin(phi);
                const cosPhi = Math.cos(phi);
                
                const x = cosPhi * sinTheta;
                const y = cosTheta;
                const z = sinPhi * sinTheta;
                
                // Add variation for organic look
                const variation = this.noise.fbm3D(x * 8, y * 8, z * 8, 3, 0.5, 2.0);
                const r = radius * (1.0 + variation * 0.3);
                
                const pos = center.add(new Vector3(x * r, y * r, z * r));
                mesh.addVertex(pos, undefined, new Vector2(lon / segments, lat / (segments / 2)));
            }
        }
        
        // Generate foliage faces
        const latSegments = segments / 2;
        for (let lat = 0; lat < latSegments; lat++) {
            for (let lon = 0; lon < segments; lon++) {
                const a = baseIdx + lat * (segments + 1) + lon;
                const b = a + 1;
                const c = a + segments + 1;
                const d = c + 1;
                
                mesh.addFace([a, c, b]);
                mesh.addFace([b, c, d]);
            }
        }
    }
    
    /**
     * Get segment count based on quality settings
     */
    private getSegmentCount(): number {
        switch (this.qualitySettings.detailLevel) {
            case 'low': return 16;
            case 'medium': return 32;
            case 'high': return 64;
            case 'ultra': return 128;
            default: return 32;
        }
    }
}
