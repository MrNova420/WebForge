/**
 * @fileoverview Bevel modifier for edge smoothing
 * @module geometry/modifiers
 */

import { Modifier } from './Modifier';
import { MeshData } from '../MeshData';

/**
 * Bevels edges to create smooth corners
 */
export class BevelModifier extends Modifier {
  private width: number;
  
  constructor(width: number = 0.1, _segments: number = 1) {
    super('Bevel');
    this.width = width;
  }
  
  public apply(mesh: MeshData): MeshData {
    const originalPos = mesh.getPositions();
    const originalIdx = mesh.getIndices();
    const positions: number[] = [];
    const indices: number[] = [];
    
    const vertexCount = originalPos.length / 3;
    
    // Add scaled vertices
    for (let i = 0; i < vertexCount; i++) {
      const x = originalPos[i * 3];
      const y = originalPos[i * 3 + 1];
      const z = originalPos[i * 3 + 2];
      const scale = 1 - this.width;
      positions.push(x * scale, y * scale, z * scale);
    }
    
    // Add original faces with scaled vertices
    for (let i = 0; i < originalIdx.length; i++) {
      indices.push(originalIdx[i]);
    }
    
    // Add bevel faces between scaled and original edges
    const faceCount = originalIdx.length / 3;
    for (let f = 0; f < faceCount; f++) {
      const i0 = originalIdx[f * 3];
      const i1 = originalIdx[f * 3 + 1];
      const i2 = originalIdx[f * 3 + 2];
      
      // Add original vertices
      const v0Idx = positions.length / 3;
      positions.push(originalPos[i0 * 3], originalPos[i0 * 3 + 1], originalPos[i0 * 3 + 2]);
      const v1Idx = positions.length / 3;
      positions.push(originalPos[i1 * 3], originalPos[i1 * 3 + 1], originalPos[i1 * 3 + 2]);
      const v2Idx = positions.length / 3;
      positions.push(originalPos[i2 * 3], originalPos[i2 * 3 + 1], originalPos[i2 * 3 + 2]);
      
      // Add bevel quads
      indices.push(i0, i1, v1Idx);
      indices.push(i0, v1Idx, v0Idx);
      
      indices.push(i1, i2, v2Idx);
      indices.push(i1, v2Idx, v1Idx);
      
      indices.push(i2, i0, v0Idx);
      indices.push(i2, v0Idx, v2Idx);
    }
    
    const newMesh = new MeshData({ position: positions }, indices);
    newMesh.computeNormals();
    return newMesh;
  }
}
