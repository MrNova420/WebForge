/**
 * @fileoverview Binary Space Partitioning tree for boolean operations
 * @module geometry/boolean
 */

import { Vector3 } from '../../math/Vector3';

/**
 * BSP Plane
 */
export class BSPPlane {
  public normal: Vector3;
  public distance: number;
  
  constructor(normal: Vector3, distance: number) {
    this.normal = normal.normalize();
    this.distance = distance;
  }
  
  public static fromPoints(p1: Vector3, p2: Vector3, p3: Vector3): BSPPlane {
    const edge1 = p2.subtract(p1);
    const edge2 = p3.subtract(p1);
    const normal = edge1.cross(edge2).normalize();
    const distance = normal.dot(p1);
    return new BSPPlane(normal, distance);
  }
  
  public classifyPoint(point: Vector3, epsilon: number = 0.001): 'FRONT' | 'BACK' | 'ON' {
    const dist = this.normal.dot(point) - this.distance;
    if (dist > epsilon) return 'FRONT';
    if (dist < -epsilon) return 'BACK';
    return 'ON';
  }
}

/**
 * BSP Triangle
 */
export class BSPTriangle {
  public vertices: [Vector3, Vector3, Vector3];
  
  constructor(v0: Vector3, v1: Vector3, v2: Vector3) {
    this.vertices = [v0, v1, v2];
  }
  
  public getPlane(): BSPPlane {
    return BSPPlane.fromPoints(this.vertices[0], this.vertices[1], this.vertices[2]);
  }
}

/**
 * BSP Node
 */
export class BSPNode {
  public plane?: BSPPlane;
  public front?: BSPNode;
  public back?: BSPNode;
  public triangles: BSPTriangle[] = [];
  
  public build(triangles: BSPTriangle[]): void {
    if (triangles.length === 0) return;
    
    if (!this.plane) {
      this.plane = triangles[0].getPlane();
    }
    
    const frontTris: BSPTriangle[] = [];
    const backTris: BSPTriangle[] = [];
    
    for (const tri of triangles) {
      this.splitTriangle(tri, frontTris, backTris);
    }
    
    if (frontTris.length > 0) {
      if (!this.front) this.front = new BSPNode();
      this.front.build(frontTris);
    }
    
    if (backTris.length > 0) {
      if (!this.back) this.back = new BSPNode();
      this.back.build(backTris);
    }
  }
  
  private splitTriangle(tri: BSPTriangle, front: BSPTriangle[], back: BSPTriangle[]): void {
    if (!this.plane) return;
    
    const types = tri.vertices.map(v => this.plane!.classifyPoint(v));
    
    const frontCount = types.filter(t => t === 'FRONT').length;
    const backCount = types.filter(t => t === 'BACK').length;
    
    if (backCount === 0) {
      front.push(tri);
    } else if (frontCount === 0) {
      back.push(tri);
    } else {
      // Triangle spans plane - add to both (simplified)
      front.push(tri);
      back.push(tri);
    }
  }
  
  public invert(): void {
    if (this.plane) {
      this.plane.normal = this.plane.normal.multiplyScalar(-1);
      this.plane.distance = -this.plane.distance;
    }
    
    for (const tri of this.triangles) {
      const temp = tri.vertices[1];
      tri.vertices[1] = tri.vertices[2];
      tri.vertices[2] = temp;
    }
    
    if (this.front) this.front.invert();
    if (this.back) this.back.invert();
    
    const temp = this.front;
    this.front = this.back;
    this.back = temp;
  }
  
  public clipTo(node: BSPNode): void {
    this.triangles = this.triangles.filter(tri => !node.clipTriangle(tri));
    if (this.front) this.front.clipTo(node);
    if (this.back) this.back.clipTo(node);
  }
  
  private clipTriangle(tri: BSPTriangle): boolean {
    if (!this.plane) return false;
    
    const types = tri.vertices.map(v => this.plane!.classifyPoint(v));
    const backCount = types.filter(t => t === 'BACK').length;
    
    if (backCount === 3) return true;
    if (backCount === 0) {
      if (this.front) return this.front.clipTriangle(tri);
      return false;
    }
    
    if (this.back) return this.back.clipTriangle(tri);
    return false;
  }
  
  public allTriangles(): BSPTriangle[] {
    let result = [...this.triangles];
    if (this.front) result = result.concat(this.front.allTriangles());
    if (this.back) result = result.concat(this.back.allTriangles());
    return result;
  }
}
