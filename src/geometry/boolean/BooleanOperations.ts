/**
 * @fileoverview Boolean operations for mesh CSG (Constructive Solid Geometry)
 * @module geometry/boolean
 */

import { MeshData } from '../MeshData';
import { BSPNode, BSPTriangle } from './BSPTree';

/**
 * Performs boolean operations on meshes
 * 
 * Supports union, difference, and intersection using BSP trees.
 * 
 * @example
 * ```typescript
 * const cube = MeshData.createCube(1.0);
 * const sphere = createSphere();
 * 
 * const union = BooleanOperations.union(cube, sphere);
 * const diff = BooleanOperations.difference(cube, sphere);
 * const intersect = BooleanOperations.intersection(cube, sphere);
 * ```
 */
export class BooleanOperations {
  /**
   * Union: A ∪ B (combines both meshes)
   */
  public static union(meshA: MeshData, meshB: MeshData): MeshData {
    const trisA = this.meshToTriangles(meshA);
    const trisB = this.meshToTriangles(meshB);
    
    const treeA = new BSPNode();
    const treeB = new BSPNode();
    
    treeA.build(trisA);
    treeB.build(trisB);
    
    treeA.clipTo(treeB);
    treeB.clipTo(treeA);
    treeB.invert();
    treeB.clipTo(treeA);
    treeB.invert();
    
    const result = treeA.allTriangles().concat(treeB.allTriangles());
    return this.trianglesToMesh(result);
  }
  
  /**
   * Difference: A - B (subtracts B from A)
   */
  public static difference(meshA: MeshData, meshB: MeshData): MeshData {
    const trisA = this.meshToTriangles(meshA);
    const trisB = this.meshToTriangles(meshB);
    
    const treeA = new BSPNode();
    const treeB = new BSPNode();
    
    treeA.build(trisA);
    treeB.build(trisB);
    
    treeA.invert();
    treeA.clipTo(treeB);
    treeB.clipTo(treeA);
    treeB.invert();
    treeB.clipTo(treeA);
    treeB.invert();
    treeA.invert();
    
    const result = treeA.allTriangles().concat(treeB.allTriangles());
    return this.trianglesToMesh(result);
  }
  
  /**
   * Intersection: A ∩ B (only the overlapping part)
   */
  public static intersection(meshA: MeshData, meshB: MeshData): MeshData {
    const trisA = this.meshToTriangles(meshA);
    const trisB = this.meshToTriangles(meshB);
    
    const treeA = new BSPNode();
    const treeB = new BSPNode();
    
    treeA.build(trisA);
    treeB.build(trisB);
    
    treeA.invert();
    treeB.clipTo(treeA);
    treeB.invert();
    treeA.clipTo(treeB);
    treeB.clipTo(treeA);
    
    const result = treeA.allTriangles().concat(treeB.allTriangles());
    return this.trianglesToMesh(result);
  }
  
  /**
   * Convert MeshData to BSP triangles
   */
  private static meshToTriangles(mesh: MeshData): BSPTriangle[] {
    const triangles: BSPTriangle[] = [];
    const faceCount = mesh.getFaceCount();
    
    for (let i = 0; i < faceCount; i++) {
      const [i0, i1, i2] = mesh.getFace(i);
      const v0 = mesh.getVertex(i0);
      const v1 = mesh.getVertex(i1);
      const v2 = mesh.getVertex(i2);
      
      triangles.push(new BSPTriangle(v0, v1, v2));
    }
    
    return triangles;
  }
  
  /**
   * Convert BSP triangles back to MeshData
   */
  private static trianglesToMesh(triangles: BSPTriangle[]): MeshData {
    const positions: number[] = [];
    const indices: number[] = [];
    
    for (const tri of triangles) {
      const baseIdx = positions.length / 3;
      
      for (const v of tri.vertices) {
        positions.push(v.x, v.y, v.z);
      }
      
      indices.push(baseIdx, baseIdx + 1, baseIdx + 2);
    }
    
    const mesh = new MeshData({ position: positions }, indices);
    mesh.computeNormals();
    return mesh;
  }
}
