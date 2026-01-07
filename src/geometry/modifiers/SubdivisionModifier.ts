/**
 * @fileoverview Catmull-Clark subdivision surface modifier
 * @module geometry/modifiers
 */

import { Modifier } from './Modifier';
import { MeshData } from '../MeshData';

/**
 * Subdivision surface modifier using simplified algorithm
 */
export class SubdivisionModifier extends Modifier {
  private iterations: number;
  
  constructor(iterations: number = 1) {
    super('Subdivision');
    this.iterations = Math.max(1, Math.min(4, iterations));
  }
  
  public apply(mesh: MeshData): MeshData {
    let result = mesh;
    for (let i = 0; i < this.iterations; i++) {
      result = this.subdivide(result);
    }
    return result;
  }
  
  private subdivide(mesh: MeshData): MeshData {
    const positions: number[] = [];
    const indices: number[] = [];
    
    const originalPos = mesh.getPositions();
    const originalIdx = mesh.getIndices();
    const faceCount = mesh.getFaceCount();
    
    // Add original vertices
    for (let i = 0; i < originalPos.length; i++) {
      positions.push(originalPos[i]);
    }
    
    // For each face, add centroid and create 4 sub-faces
    for (let f = 0; f < faceCount; f++) {
      const i0 = originalIdx[f * 3];
      const i1 = originalIdx[f * 3 + 1];
      const i2 = originalIdx[f * 3 + 2];
      
      const v0 = mesh.getVertex(i0);
      const v1 = mesh.getVertex(i1);
      const v2 = mesh.getVertex(i2);
      
      // Centroid
      const cx = (v0.x + v1.x + v2.x) / 3;
      const cy = (v0.y + v1.y + v2.y) / 3;
      const cz = (v0.z + v1.z + v2.z) / 3;
      positions.push(cx, cy, cz);
      
      // Edge midpoints
      const m01x = (v0.x + v1.x) / 2, m01y = (v0.y + v1.y) / 2, m01z = (v0.z + v1.z) / 2;
      const m01Idx = positions.length / 3;
      positions.push(m01x, m01y, m01z);
      
      const m12x = (v1.x + v2.x) / 2, m12y = (v1.y + v2.y) / 2, m12z = (v1.z + v2.z) / 2;
      const m12Idx = positions.length / 3;
      positions.push(m12x, m12y, m12z);
      
      const m20x = (v2.x + v0.x) / 2, m20y = (v2.y + v0.y) / 2, m20z = (v2.z + v0.z) / 2;
      const m20Idx = positions.length / 3;
      positions.push(m20x, m20y, m20z);
      
      // Create 4 sub-faces
      indices.push(i0, m01Idx, m20Idx);
      indices.push(i1, m12Idx, m01Idx);
      indices.push(i2, m20Idx, m12Idx);
      indices.push(m01Idx, m12Idx, m20Idx);
    }
    
    const newMesh = new MeshData({ position: positions }, indices);
    newMesh.computeNormals();
    return newMesh;
  }
}
