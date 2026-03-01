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
        if (faceIndex < 0 || faceIndex >= this.faces.length) return;
        
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
        const centerIndex = this.vertices.length;
        const centerVertex = new Vertex(center);
        this.vertices.push(centerVertex);
        
        const v0 = verts[0];
        const v1 = verts[1];
        const v2 = verts[2];
        
        // Reuse the original face for the first triangle (v0, v1, center)
        const face0 = this.faces[faceIndex];
        
        // Create two new faces
        const face1 = new Face(); // (v1, v2, center)
        const face1Index = this.faces.length;
        this.faces.push(face1);
        
        const face2 = new Face(); // (v2, v0, center)
        const face2Index = this.faces.length;
        this.faces.push(face2);
        
        // Create half-edges for face0: v0 -> v1 -> center -> v0
        const he0a = new HalfEdge(v1, faceIndex);
        const he0b = new HalfEdge(centerIndex, faceIndex);
        const he0c = new HalfEdge(v0, faceIndex);
        
        const he0aIdx = this.halfEdges.length;
        const he0bIdx = he0aIdx + 1;
        const he0cIdx = he0aIdx + 2;
        
        he0a.next = he0bIdx; he0a.prev = he0cIdx;
        he0b.next = he0cIdx; he0b.prev = he0aIdx;
        he0c.next = he0aIdx; he0c.prev = he0bIdx;
        
        this.halfEdges.push(he0a, he0b, he0c);
        face0.halfEdge = he0aIdx;
        
        // Create half-edges for face1: v1 -> v2 -> center -> v1
        const he1a = new HalfEdge(v2, face1Index);
        const he1b = new HalfEdge(centerIndex, face1Index);
        const he1c = new HalfEdge(v1, face1Index);
        
        const he1aIdx = this.halfEdges.length;
        const he1bIdx = he1aIdx + 1;
        const he1cIdx = he1aIdx + 2;
        
        he1a.next = he1bIdx; he1a.prev = he1cIdx;
        he1b.next = he1cIdx; he1b.prev = he1aIdx;
        he1c.next = he1aIdx; he1c.prev = he1bIdx;
        
        this.halfEdges.push(he1a, he1b, he1c);
        face1.halfEdge = he1aIdx;
        
        // Create half-edges for face2: v2 -> v0 -> center -> v2
        const he2a = new HalfEdge(v0, face2Index);
        const he2b = new HalfEdge(centerIndex, face2Index);
        const he2c = new HalfEdge(v2, face2Index);
        
        const he2aIdx = this.halfEdges.length;
        const he2bIdx = he2aIdx + 1;
        const he2cIdx = he2aIdx + 2;
        
        he2a.next = he2bIdx; he2a.prev = he2cIdx;
        he2b.next = he2cIdx; he2b.prev = he2aIdx;
        he2c.next = he2aIdx; he2c.prev = he2bIdx;
        
        this.halfEdges.push(he2a, he2b, he2c);
        face2.halfEdge = he2aIdx;
        
        // Connect twin edges between the three new internal edges
        // he0b (v1->center) <-> he1c (center->v1)
        he0b.twin = he1cIdx;
        he1c.twin = he0bIdx;
        
        // he1b (v2->center) <-> he2c (center->v2)
        he1b.twin = he2cIdx;
        he2c.twin = he1bIdx;
        
        // he2b (v0->center) <-> he0c (center->v0)
        he2b.twin = he0cIdx;
        he0c.twin = he2bIdx;
        
        // Set center vertex's half-edge
        centerVertex.halfEdge = he0cIdx;

        // Ensure original corner vertices point to valid outgoing half-edges
        if (v0 >= 0 && v0 < this.vertices.length) {
            // he2b is the half-edge from v0 to the new center vertex
            this.vertices[v0].halfEdge = he2bIdx;
        }
        if (v1 >= 0 && v1 < this.vertices.length) {
            // he0b is the half-edge from v1 to the new center vertex
            this.vertices[v1].halfEdge = he0bIdx;
        }
        if (v2 >= 0 && v2 < this.vertices.length) {
            // he1b is the half-edge from v2 to the new center vertex
            this.vertices[v2].halfEdge = he1bIdx;
        }
    }
    
    public getVertexCount(): number { return this.vertices.length; }
    public getFaceCount(): number { return this.faces.length; }
    public getHalfEdgeCount(): number { return this.halfEdges.length; }
    public getVertex(index: number): Vertex { return this.vertices[index]; }
    public getFace(index: number): Face { return this.faces[index]; }
    public getHalfEdge(index: number): HalfEdge { return this.halfEdges[index]; }
}
