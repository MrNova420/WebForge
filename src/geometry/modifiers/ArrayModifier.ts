/**
 * @fileoverview Array modifier for instancing geometry
 * @module geometry/modifiers
 */

import { Modifier } from './Modifier';
import { MeshData } from '../MeshData';
import { Vector3 } from '../../math/Vector3';

/**
 * Creates multiple instances of mesh in a pattern
 */
export class ArrayModifier extends Modifier {
  private count: number;
  private offset?: Vector3;
  private radialAxis?: 'X' | 'Y' | 'Z';
  
  constructor(count: number = 2, offset?: Vector3, radialAxis?: 'X' | 'Y' | 'Z') {
    super('Array');
    this.count = Math.max(1, Math.min(100, count));
    this.offset = offset;
    this.radialAxis = radialAxis;
  }
  
  public apply(mesh: MeshData): MeshData {
    const originalPos = mesh.getPositions();
    const originalIdx = mesh.getIndices();
    const positions: number[] = [];
    const indices: number[] = [];
    
    const vertexCount = originalPos.length / 3;
    
    for (let inst = 0; inst < this.count; inst++) {
      const indexOffset = (positions.length / 3);
      
      // Calculate transform for this instance
      let tx = 0, ty = 0, tz = 0;
      
      if (this.radialAxis) {
        // Radial array
        const angle = (2 * Math.PI / this.count) * inst;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const radius = 2;
        
        if (this.radialAxis === 'Y') {
          tx = cos * radius;
          tz = sin * radius;
        } else if (this.radialAxis === 'X') {
          ty = cos * radius;
          tz = sin * radius;
        } else {
          tx = cos * radius;
          ty = sin * radius;
        }
      } else {
        // Linear array
        if (this.offset) {
          tx = this.offset.x * inst;
          ty = this.offset.y * inst;
          tz = this.offset.z * inst;
        } else {
          tx = inst * 2;
        }
      }
      
      // Add transformed vertices
      for (let i = 0; i < vertexCount; i++) {
        positions.push(
          originalPos[i * 3] + tx,
          originalPos[i * 3 + 1] + ty,
          originalPos[i * 3 + 2] + tz
        );
      }
      
      // Add faces with offset indices
      for (let i = 0; i < originalIdx.length; i++) {
        indices.push(originalIdx[i] + indexOffset);
      }
    }
    
    const newMesh = new MeshData({ position: positions }, indices);
    newMesh.computeNormals();
    return newMesh;
  }
}
