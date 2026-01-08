/**
 * @fileoverview Mirror modifier for symmetrical modeling
 * @module geometry/modifiers
 */

import { Modifier } from './Modifier';
import { MeshData } from '../MeshData';

/**
 * Mirrors mesh geometry across a specified axis
 */
export class MirrorModifier extends Modifier {
  private axis: 'X' | 'Y' | 'Z';
  private mergeThreshold: number;
  
  constructor(axis: 'X' | 'Y' | 'Z' = 'X', mergeThreshold: number = 0.001) {
    super('Mirror');
    this.axis = axis;
    this.mergeThreshold = mergeThreshold;
  }
  
  public apply(mesh: MeshData): MeshData {
    const originalPos = mesh.getPositions();
    const originalIdx = mesh.getIndices();
    const positions: number[] = [];
    const indices: number[] = [];
    
    // Add original vertices
    for (let i = 0; i < originalPos.length; i++) {
      positions.push(originalPos[i]);
    }
    
    // Add mirrored vertices
    const mirroredIndices: number[] = [];
    const vertexCount = originalPos.length / 3;
    
    for (let i = 0; i < vertexCount; i++) {
      const x = originalPos[i * 3];
      const y = originalPos[i * 3 + 1];
      const z = originalPos[i * 3 + 2];
      
      // Check if on mirror plane
      let onPlane = false;
      if (this.axis === 'X' && Math.abs(x) < this.mergeThreshold) onPlane = true;
      else if (this.axis === 'Y' && Math.abs(y) < this.mergeThreshold) onPlane = true;
      else if (this.axis === 'Z' && Math.abs(z) < this.mergeThreshold) onPlane = true;
      
      if (onPlane) {
        mirroredIndices.push(i);
      } else {
        // Add mirrored vertex
        mirroredIndices.push(positions.length / 3);
        if (this.axis === 'X') positions.push(-x, y, z);
        else if (this.axis === 'Y') positions.push(x, -y, z);
        else positions.push(x, y, -z);
      }
    }
    
    // Add original faces
    for (let i = 0; i < originalIdx.length; i++) {
      indices.push(originalIdx[i]);
    }
    
    // Add mirrored faces (reverse winding)
    for (let i = 0; i < originalIdx.length; i += 3) {
      const i0 = mirroredIndices[originalIdx[i]];
      const i1 = mirroredIndices[originalIdx[i + 1]];
      const i2 = mirroredIndices[originalIdx[i + 2]];
      indices.push(i0, i2, i1); // Reversed
    }
    
    const newMesh = new MeshData({ position: positions }, indices);
    newMesh.computeNormals();
    return newMesh;
  }
}
