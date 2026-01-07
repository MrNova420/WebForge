/**
 * WebForge Mesh Data
 * 
 * Core mesh representation with vertices, UVs, normals, and indices.
 * Provides the foundational data structure for 3D geometry.
 */

import { Vector3 } from '../math/Vector3';
import { Vector2 } from '../math/Vector2';

/**
 * Mesh attribute data
 */
export interface MeshAttributes {
    position: number[];     // Vertex positions (x, y, z)
    normal?: number[];      // Vertex normals (x, y, z)
    uv?: number[];          // UV coordinates (u, v)
    color?: number[];       // Vertex colors (r, g, b, a)
}

/**
 * Mesh data structure
 */
export class MeshData {
    private attributes: MeshAttributes;
    private indices: number[];
    private vertexCount: number;
    private faceCount: number;
    
    /**
     * Creates a new mesh data
     */
    constructor(attributes: MeshAttributes, indices: number[]) {
        this.attributes = attributes;
        this.indices = indices;
        this.vertexCount = attributes.position.length / 3;
        this.faceCount = indices.length / 3;
    }
    
    public getPositions(): number[] { return this.attributes.position; }
    public getNormals(): number[] | undefined { return this.attributes.normal; }
    public getUVs(): number[] | undefined { return this.attributes.uv; }
    public getColors(): number[] | undefined { return this.attributes.color; }
    public getIndices(): number[] { return this.indices; }
    public getVertexCount(): number { return this.vertexCount; }
    public getFaceCount(): number { return this.faceCount; }
    
    /**
     * Gets a vertex position
     */
    public getVertex(index: number): Vector3 {
        const i = index * 3;
        return new Vector3(
            this.attributes.position[i],
            this.attributes.position[i + 1],
            this.attributes.position[i + 2]
        );
    }
    
    /**
     * Sets a vertex position
     */
    public setVertex(index: number, position: Vector3): void {
        const i = index * 3;
        this.attributes.position[i] = position.x;
        this.attributes.position[i + 1] = position.y;
        this.attributes.position[i + 2] = position.z;
    }
    
    /**
     * Gets a face (triangle)
     */
    public getFace(index: number): [number, number, number] {
        const i = index * 3;
        return [this.indices[i], this.indices[i + 1], this.indices[i + 2]];
    }
    
    /**
     * Adds a vertex
     */
    public addVertex(position: Vector3, normal?: Vector3, uv?: Vector2): number {
        const index = this.vertexCount;
        this.attributes.position.push(position.x, position.y, position.z);
        
        if (normal && this.attributes.normal) {
            this.attributes.normal.push(normal.x, normal.y, normal.z);
        }
        if (uv && this.attributes.uv) {
            this.attributes.uv.push(uv.x, uv.y);
        }
        
        this.vertexCount++;
        return index;
    }
    
    /**
     * Adds a face
     */
    public addFace(v0: number, v1: number, v2: number): number {
        const index = this.faceCount;
        this.indices.push(v0, v1, v2);
        this.faceCount++;
        return index;
    }
    
    /**
     * Computes vertex normals from face data
     */
    public computeNormals(): void {
        const normals = new Array(this.vertexCount * 3).fill(0);
        
        for (let i = 0; i < this.faceCount; i++) {
            const [v0, v1, v2] = this.getFace(i);
            const p0 = this.getVertex(v0);
            const p1 = this.getVertex(v1);
            const p2 = this.getVertex(v2);
            
            const edge1 = p1.subtract(p0);
            const edge2 = p2.subtract(p0);
            const faceNormal = edge1.cross(edge2);
            
            normals[v0 * 3] += faceNormal.x;
            normals[v0 * 3 + 1] += faceNormal.y;
            normals[v0 * 3 + 2] += faceNormal.z;
            
            normals[v1 * 3] += faceNormal.x;
            normals[v1 * 3 + 1] += faceNormal.y;
            normals[v1 * 3 + 2] += faceNormal.z;
            
            normals[v2 * 3] += faceNormal.x;
            normals[v2 * 3 + 1] += faceNormal.y;
            normals[v2 * 3 + 2] += faceNormal.z;
        }
        
        for (let i = 0; i < this.vertexCount; i++) {
            const normal = new Vector3(
                normals[i * 3],
                normals[i * 3 + 1],
                normals[i * 3 + 2]
            ).normalize();
            
            normals[i * 3] = normal.x;
            normals[i * 3 + 1] = normal.y;
            normals[i * 3 + 2] = normal.z;
        }
        
        this.attributes.normal = normals;
    }
    
    /**
     * Clones the mesh data
     */
    public clone(): MeshData {
        const attributesCopy: MeshAttributes = {
            position: [...this.attributes.position]
        };
        if (this.attributes.normal) attributesCopy.normal = [...this.attributes.normal];
        if (this.attributes.uv) attributesCopy.uv = [...this.attributes.uv];
        if (this.attributes.color) attributesCopy.color = [...this.attributes.color];
        
        return new MeshData(attributesCopy, [...this.indices]);
    }
    
    /**
     * Creates a cube mesh
     */
    public static createCube(size: number = 1): MeshData {
        const half = size / 2;
        const positions = [
            -half, -half, half,  half, -half, half,  half, half, half,  -half, half, half,
            -half, -half, -half,  -half, half, -half,  half, half, -half,  half, -half, -half,
            -half, half, -half,  -half, half, half,  half, half, half,  half, half, -half,
            -half, -half, -half,  half, -half, -half,  half, -half, half,  -half, -half, half,
            half, -half, -half,  half, half, -half,  half, half, half,  half, -half, half,
            -half, -half, -half,  -half, -half, half,  -half, half, half,  -half, half, -half
        ];
        
        const indices = [
            0, 1, 2,  0, 2, 3,    4, 5, 6,  4, 6, 7,
            8, 9, 10,  8, 10, 11, 12, 13, 14,  12, 14, 15,
            16, 17, 18,  16, 18, 19, 20, 21, 22,  20, 22, 23
        ];
        
        const mesh = new MeshData({ position: positions }, indices);
        mesh.computeNormals();
        return mesh;
    }
}
