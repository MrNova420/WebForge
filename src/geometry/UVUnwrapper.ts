/**
 * @fileoverview UV unwrapping for texture mapping
 * @module geometry
 */

import { MeshData } from './MeshData';
import { Vector2 } from '../math/Vector2';

/**
 * UV unwrapping methods for texture mapping
 * 
 * Provides various projection methods for generating UV coordinates.
 * 
 * @example
 * ```typescript
 * const mesh = MeshData.createCube(1.0);
 * const unwrapped = UVUnwrapper.planarUnwrap(mesh, 'Z');
 * ```
 */
export class UVUnwrapper {
  /**
   * Planar UV projection
   * Projects mesh onto a plane along specified axis
   */
  public static planarUnwrap(mesh: MeshData, axis: 'X' | 'Y' | 'Z' = 'Z'): MeshData {
    const positions = mesh.getPositions();
    const indices = mesh.getIndices();
    const normals = mesh.getNormals();
    
    const uvs: number[] = [];
    const vertexCount = positions.length / 3;
    
    // Find bounds for normalization
    let minU = Infinity, maxU = -Infinity;
    let minV = Infinity, maxV = -Infinity;
    
    const tempUVs: Vector2[] = [];
    
    for (let i = 0; i < vertexCount; i++) {
      const x = positions[i * 3];
      const y = positions[i * 3 + 1];
      const z = positions[i * 3 + 2];
      
      let u = 0, v = 0;
      
      if (axis === 'X') {
        u = y;
        v = z;
      } else if (axis === 'Y') {
        u = x;
        v = z;
      } else { // Z
        u = x;
        v = y;
      }
      
      tempUVs.push(new Vector2(u, v));
      minU = Math.min(minU, u);
      maxU = Math.max(maxU, u);
      minV = Math.min(minV, v);
      maxV = Math.max(maxV, v);
    }
    
    // Normalize to [0, 1]
    const rangeU = maxU - minU || 1;
    const rangeV = maxV - minV || 1;
    
    for (const uv of tempUVs) {
      uvs.push((uv.x - minU) / rangeU, (uv.y - minV) / rangeV);
    }
    
    return new MeshData({
      position: positions,
      normal: normals,
      uv: uvs
    }, indices);
  }
  
  /**
   * Cylindrical UV projection
   * Wraps UVs around a cylinder
   */
  public static cylindricalUnwrap(mesh: MeshData, axis: 'X' | 'Y' | 'Z' = 'Y'): MeshData {
    const positions = mesh.getPositions();
    const indices = mesh.getIndices();
    const normals = mesh.getNormals();
    
    const uvs: number[] = [];
    const vertexCount = positions.length / 3;
    
    let minV = Infinity, maxV = -Infinity;
    
    for (let i = 0; i < vertexCount; i++) {
      const x = positions[i * 3];
      const y = positions[i * 3 + 1];
      const z = positions[i * 3 + 2];
      
      let u = 0, v = 0;
      
      if (axis === 'Y') {
        u = Math.atan2(z, x) / (2 * Math.PI) + 0.5;
        v = y;
        minV = Math.min(minV, v);
        maxV = Math.max(maxV, v);
      } else if (axis === 'X') {
        u = Math.atan2(y, z) / (2 * Math.PI) + 0.5;
        v = x;
        minV = Math.min(minV, v);
        maxV = Math.max(maxV, v);
      } else { // Z
        u = Math.atan2(y, x) / (2 * Math.PI) + 0.5;
        v = z;
        minV = Math.min(minV, v);
        maxV = Math.max(maxV, v);
      }
      
      uvs.push(u, v);
    }
    
    // Normalize V coordinate
    const rangeV = maxV - minV || 1;
    for (let i = 0; i < uvs.length; i += 2) {
      uvs[i + 1] = (uvs[i + 1] - minV) / rangeV;
    }
    
    return new MeshData({
      position: positions,
      normal: normals,
      uv: uvs
    }, indices);
  }
  
  /**
   * Spherical UV projection
   * Projects UVs onto a sphere
   */
  public static sphericalUnwrap(mesh: MeshData): MeshData {
    const positions = mesh.getPositions();
    const indices = mesh.getIndices();
    const normals = mesh.getNormals();
    
    const uvs: number[] = [];
    const vertexCount = positions.length / 3;
    
    for (let i = 0; i < vertexCount; i++) {
      const x = positions[i * 3];
      const y = positions[i * 3 + 1];
      const z = positions[i * 3 + 2];
      
      // Convert to spherical coordinates
      const len = Math.sqrt(x * x + y * y + z * z) || 1;
      const nx = x / len;
      const ny = y / len;
      const nz = z / len;
      
      const u = Math.atan2(nx, nz) / (2 * Math.PI) + 0.5;
      const v = Math.asin(ny) / Math.PI + 0.5;
      
      uvs.push(u, v);
    }
    
    return new MeshData({
      position: positions,
      normal: normals,
      uv: uvs
    }, indices);
  }
  
  /**
   * Box UV projection
   * Projects from 6 sides of a box
   */
  public static boxUnwrap(mesh: MeshData): MeshData {
    const positions = mesh.getPositions();
    const indices = mesh.getIndices();
    const normals = mesh.getNormals();
    
    const uvs: number[] = [];
    const vertexCount = positions.length / 3;
    
    for (let i = 0; i < vertexCount; i++) {
      const x = positions[i * 3];
      const y = positions[i * 3 + 1];
      const z = positions[i * 3 + 2];
      
      // Determine dominant axis from position
      const absX = Math.abs(x);
      const absY = Math.abs(y);
      const absZ = Math.abs(z);
      
      let u = 0, v = 0;
      
      if (absX > absY && absX > absZ) {
        // X dominant
        u = (z / absX + 1) / 2;
        v = (y / absX + 1) / 2;
      } else if (absY > absZ) {
        // Y dominant
        u = (x / absY + 1) / 2;
        v = (z / absY + 1) / 2;
      } else {
        // Z dominant
        u = (x / absZ + 1) / 2;
        v = (y / absZ + 1) / 2;
      }
      
      uvs.push(u, v);
    }
    
    return new MeshData({
      position: positions,
      normal: normals,
      uv: uvs
    }, indices);
  }
}
