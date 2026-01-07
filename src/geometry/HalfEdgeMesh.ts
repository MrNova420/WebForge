/**
 * WebForge Half-Edge Mesh
 * 
 * Efficient half-edge data structure for mesh editing operations.
 * Provides O(1) topology queries for vertices, edges, and faces.
 */

import { Vector3 } from '../math/Vector3';
import { MeshData } from './MeshData';

/**
 * Half-edge structure
 */
export class HalfEdge {
    public vertex: number;          // Target vertex index
    public face: number;             // Adjacent face index
    public next: number;             // Next half-edge in face
    public prev: number;             // Previous half-edge in face
    public twin: number;             // Opposite half-edge (-1 if boundary)
    
    constructor(vertex: number, face: number) {
        this.vertex = vertex;
        this.face = face;
        this.next = -1;
        this.prev = -1;
        this.twin = -1;
    }
}

/**
 * Vertex structure
 */
export class Vertex {
    public position: Vector3;
    public halfEdge: number;         // One outgoing half-edge
    
    constructor(position: Vector3) {
        this.position = position;
        this.halfEdge = -1;
    }
}

/**
 * Face structure
 */
export class Face {
    public halfEdge: number;         // One half-edge of the face
    
    constructor() {
        this.halfEdge = -1;
    }
}

/**
 * Half-edge mesh for efficient topology operations
 */
export class HalfEdgeMesh {
    private vertices: Vertex[] = [];
    private halfEdges: HalfEdge[] = [];
    private faces: Face[] = [];
    
    /**
     * Creates from MeshData
     */
    public static fromMeshData(meshData: MeshData): HalfEdgeMesh {
        const mesh = new HalfEdgeMesh();
        
        // Create vertices
        for (let i = 0; i < meshData.getVertexCount(); i++) {
            mesh.vertices.push(new Vertex(meshData.getVertex(i)));
        }
        
        // Create faces and half-edges
        const edgeMap = new Map<string, number>();
        
        for (let i = 0; i < meshData.getFaceCount(); i++) {
            const [v0, v1, v2] = meshData.getFace(i);
            const face = new Face();
            const faceIndex = mesh.faces.length;
            mesh.faces.push(face);
            
            // Create three half-edges for the triangle
            const he0 = new HalfEdge(v1, faceIndex);
            const he1 = new HalfEdge(v2, faceIndex);
            const he2 = new HalfEdge(v0, faceIndex);
            
            const he0Index = mesh.halfEdges.length;
            const he1Index = he0Index + 1;
            const he2Index = he0Index + 2;
            
            // Set next/prev pointers
            he0.next = he1Index;
            he0.prev = he2Index;
            he1.next = he2Index;
            he1.prev = he0Index;
            he2.next = he0Index;
            he2.prev = he1Index;
            
            mesh.halfEdges.push(he0, he1, he2);
            
            // Set face's half-edge
            face.halfEdge = he0Index;
            
            // Set vertex half-edges
            if (mesh.vertices[v0].halfEdge === -1) mesh.vertices[v0].halfEdge = he2Index;
            if (mesh.vertices[v1].halfEdge === -1) mesh.vertices[v1].halfEdge = he0Index;
            if (mesh.vertices[v2].halfEdge === -1) mesh.vertices[v2].halfEdge = he1Index;
            
            // Build edge map for twin edges
            edgeMap.set(`${v0}-${v1}`, he0Index);
            edgeMap.set(`${v1}-${v2}`, he1Index);
            edgeMap.set(`${v2}-${v0}`, he2Index);
        }
        
        // Connect twin edges
        for (let i = 0; i < mesh.halfEdges.length; i++) {
            const he = mesh.halfEdges[i];
            const prevHe = mesh.halfEdges[he.prev];
            const key = `${he.vertex}-${prevHe.vertex}`;
            const twinIndex = edgeMap.get(key);
            if (twinIndex !== undefined) {
                he.twin = twinIndex;
            }
        }
        
        return mesh;
    }
    
    /**
     * Converts to MeshData
     */
    public toMeshData(): MeshData {
        const positions: number[] = [];
        const indices: number[] = [];
        
        // Add vertices
        for (const vertex of this.vertices) {
            positions.push(vertex.position.x, vertex.position.y, vertex.position.z);
        }
        
        // Add faces
        for (const face of this.faces) {
            const verts = this.getFaceVertices(this.faces.indexOf(face));
            if (verts.length >= 3) {
                indices.push(verts[0], verts[1], verts[2]);
            }
        }
        
        const meshData = new MeshData({ position: positions }, indices);
        meshData.computeNormals();
        return meshData;
    }
    
    /**
     * Gets vertices of a face
     */
    public getFaceVertices(faceIndex: number): number[] {
        const face = this.faces[faceIndex];
        const vertices: number[] = [];
        
        let heIndex = face.halfEdge;
        const startIndex = heIndex;
        
        do {
            const he = this.halfEdges[heIndex];
            const prevHe = this.halfEdges[he.prev];
            vertices.push(prevHe.vertex);
            heIndex = he.next;
        } while (heIndex !== startIndex && heIndex !== -1);
        
        return vertices;
    }
    
    /**
     * Gets faces adjacent to a vertex
     */
    public getVertexFaces(vertexIndex: number): number[] {
        const faces: number[] = [];
        const vertex = this.vertices[vertexIndex];
        
        if (vertex.halfEdge === -1) return faces;
        
        let heIndex = vertex.halfEdge;
        const startIndex = heIndex;
        
        do {
            const he = this.halfEdges[heIndex];
            faces.push(he.face);
            
            // Move to next outgoing half-edge
            if (he.twin !== -1) {
                heIndex = this.halfEdges[he.twin].next;
            } else {
                break;
            }
        } while (heIndex !== startIndex && heIndex !== -1);
        
        return faces;
    }
    
    /**
     * Gets edges connected to a vertex
     */
    public getVertexEdges(vertexIndex: number): number[] {
        const edges: number[] = [];
        const vertex = this.vertices[vertexIndex];
        
        if (vertex.halfEdge === -1) return edges;
        
        let heIndex = vertex.halfEdge;
        const startIndex = heIndex;
        
        do {
            edges.push(heIndex);
            const he = this.halfEdges[heIndex];
            
            if (he.twin !== -1) {
                heIndex = this.halfEdges[he.twin].next;
            } else {
                break;
            }
        } while (heIndex !== startIndex && heIndex !== -1);
        
        return edges;
    }
    
    /**
     * Gets neighboring vertices
     */
    public getVertexNeighbors(vertexIndex: number): number[] {
        const neighbors: number[] = [];
        const edges = this.getVertexEdges(vertexIndex);
        
        for (const edgeIndex of edges) {
            const he = this.halfEdges[edgeIndex];
            neighbors.push(he.vertex);
        }
        
        return neighbors;
    }
    
    /**
     * Subdivides a face
     */
    public subdivideFace(faceIndex: number): void {
        const verts = this.getFaceVertices(faceIndex);
        
        if (verts.length !== 3) return; // Only triangles for now
        
        // Calculate face center
        const p0 = this.vertices[verts[0]].position;
        const p1 = this.vertices[verts[1]].position;
        const p2 = this.vertices[verts[2]].position;
        
        const center = new Vector3(
            (p0.x + p1.x + p2.x) / 3,
            (p0.y + p1.y + p2.y) / 3,
            (p0.z + p1.z + p2.z) / 3
        );
        
        // Add center vertex
        this.vertices.push(new Vertex(center));
        
        // Create three new faces (simplified - full implementation would be more complex)
        // This is a placeholder for the actual subdivision logic
    }
    
    public getVertexCount(): number { return this.vertices.length; }
    public getFaceCount(): number { return this.faces.length; }
    public getHalfEdgeCount(): number { return this.halfEdges.length; }
    public getVertex(index: number): Vertex { return this.vertices[index]; }
    public getFace(index: number): Face { return this.faces[index]; }
    public getHalfEdge(index: number): HalfEdge { return this.halfEdges[index]; }
}
