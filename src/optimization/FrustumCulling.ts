/**
 * @module optimization
 * @fileoverview Frustum culling system for performance optimization
 */

import { Vector3 } from '../math/Vector3';
import { Matrix4 } from '../math/Matrix4';
import { Camera } from '../rendering/Camera';

/**
 * Frustum plane
 */
export class Plane {
  normal: Vector3;
  distance: number;

  constructor(normal: Vector3 = new Vector3(), distance: number = 0) {
    this.normal = normal;
    this.distance = distance;
  }

  /**
   * Sets plane from normal and distance
   * @param normal - Plane normal
   * @param distance - Distance from origin
   */
  set(normal: Vector3, distance: number): this {
    this.normal.copy(normal);
    this.distance = distance;
    return this;
  }

  /**
   * Normalizes the plane
   */
  normalize(): this {
    const length = this.normal.length();
    if (length > 0) {
      this.normal.divideScalar(length);
      this.distance /= length;
    }
    return this;
  }

  /**
   * Calculates signed distance from point to plane
   * @param point - Point to test
   * @returns Signed distance
   */
  distanceToPoint(point: Vector3): number {
    return this.normal.dot(point) + this.distance;
  }
}

/**
 * Axis-Aligned Bounding Box (AABB)
 */
export class BoundingBox {
  min: Vector3;
  max: Vector3;

  constructor(min?: Vector3, max?: Vector3) {
    this.min = min ? min.clone() : new Vector3(Infinity, Infinity, Infinity);
    this.max = max ? max.clone() : new Vector3(-Infinity, -Infinity, -Infinity);
  }

  /**
   * Sets the bounding box
   * @param min - Minimum point
   * @param max - Maximum point
   */
  set(min: Vector3, max: Vector3): this {
    this.min.copy(min);
    this.max.copy(max);
    return this;
  }

  /**
   * Expands the box to include a point
   * @param point - Point to include
   */
  expandByPoint(point: Vector3): this {
    this.min.x = Math.min(this.min.x, point.x);
    this.min.y = Math.min(this.min.y, point.y);
    this.min.z = Math.min(this.min.z, point.z);
    
    this.max.x = Math.max(this.max.x, point.x);
    this.max.y = Math.max(this.max.y, point.y);
    this.max.z = Math.max(this.max.z, point.z);
    
    return this;
  }

  /**
   * Gets the center of the bounding box
   * @returns Center point
   */
  getCenter(): Vector3 {
    return new Vector3(
      (this.min.x + this.max.x) * 0.5,
      (this.min.y + this.max.y) * 0.5,
      (this.min.z + this.max.z) * 0.5
    );
  }

  /**
   * Gets the size of the bounding box
   * @returns Size vector
   */
  getSize(): Vector3 {
    return new Vector3(
      this.max.x - this.min.x,
      this.max.y - this.min.y,
      this.max.z - this.min.z
    );
  }

  /**
   * Checks if the box is empty
   * @returns True if empty
   */
  isEmpty(): boolean {
    return this.max.x < this.min.x || this.max.y < this.min.y || this.max.z < this.min.z;
  }

  /**
   * Clones the bounding box
   * @returns Cloned box
   */
  clone(): BoundingBox {
    return new BoundingBox(this.min, this.max);
  }
}

/**
 * Bounding sphere
 */
export class BoundingSphere {
  center: Vector3;
  radius: number;

  constructor(center?: Vector3, radius: number = 0) {
    this.center = center ? center.clone() : new Vector3();
    this.radius = radius;
  }

  /**
   * Sets the bounding sphere
   * @param center - Sphere center
   * @param radius - Sphere radius
   */
  set(center: Vector3, radius: number): this {
    this.center.copy(center);
    this.radius = radius;
    return this;
  }

  /**
   * Creates sphere from bounding box
   * @param box - Bounding box
   */
  setFromBox(box: BoundingBox): this {
    this.center = box.getCenter();
    this.radius = box.getSize().length() * 0.5;
    return this;
  }

  /**
   * Clones the bounding sphere
   * @returns Cloned sphere
   */
  clone(): BoundingSphere {
    return new BoundingSphere(this.center, this.radius);
  }
}

/**
 * View frustum for culling
 */
export class Frustum {
  planes: Plane[] = [];

  constructor() {
    for (let i = 0; i < 6; i++) {
      this.planes.push(new Plane());
    }
  }

  /**
   * Sets frustum from projection-view matrix
   * @param matrix - Combined projection-view matrix
   */
  setFromProjectionMatrix(matrix: Matrix4): this {
    const m = matrix.elements;
    
    // Right plane
    this.planes[0].set(
      new Vector3(m[3] - m[0], m[7] - m[4], m[11] - m[8]),
      m[15] - m[12]
    ).normalize();
    
    // Left plane
    this.planes[1].set(
      new Vector3(m[3] + m[0], m[7] + m[4], m[11] + m[8]),
      m[15] + m[12]
    ).normalize();
    
    // Bottom plane
    this.planes[2].set(
      new Vector3(m[3] + m[1], m[7] + m[5], m[11] + m[9]),
      m[15] + m[13]
    ).normalize();
    
    // Top plane
    this.planes[3].set(
      new Vector3(m[3] - m[1], m[7] - m[5], m[11] - m[9]),
      m[15] - m[13]
    ).normalize();
    
    // Far plane
    this.planes[4].set(
      new Vector3(m[3] - m[2], m[7] - m[6], m[11] - m[10]),
      m[15] - m[14]
    ).normalize();
    
    // Near plane
    this.planes[5].set(
      new Vector3(m[3] + m[2], m[7] + m[6], m[11] + m[10]),
      m[15] + m[14]
    ).normalize();
    
    return this;
  }

  /**
   * Tests if a sphere intersects the frustum
   * @param sphere - Bounding sphere
   * @returns True if visible
   */
  intersectsSphere(sphere: BoundingSphere): boolean {
    for (let i = 0; i < 6; i++) {
      const distance = this.planes[i].distanceToPoint(sphere.center);
      if (distance < -sphere.radius) {
        return false;
      }
    }
    return true;
  }

  /**
   * Tests if a box intersects the frustum
   * @param box - Bounding box
   * @returns True if visible
   */
  intersectsBox(box: BoundingBox): boolean {
    for (let i = 0; i < 6; i++) {
      const plane = this.planes[i];
      
      // Get positive vertex (corner furthest in plane normal direction)
      const pVertex = new Vector3(
        plane.normal.x > 0 ? box.max.x : box.min.x,
        plane.normal.y > 0 ? box.max.y : box.min.y,
        plane.normal.z > 0 ? box.max.z : box.min.z
      );
      
      if (plane.distanceToPoint(pVertex) < 0) {
        return false;
      }
    }
    return true;
  }

  /**
   * Tests if a point is inside the frustum
   * @param point - Point to test
   * @returns True if inside
   */
  containsPoint(point: Vector3): boolean {
    for (let i = 0; i < 6; i++) {
      if (this.planes[i].distanceToPoint(point) < 0) {
        return false;
      }
    }
    return true;
  }
}

/**
 * Frustum culling system
 */
export class FrustumCullingSystem {
  private frustum: Frustum;
  private culledCount: number = 0;
  private totalCount: number = 0;

  constructor() {
    this.frustum = new Frustum();
  }

  /**
   * Updates frustum from camera
   * @param camera - Active camera
   */
  updateFromCamera(camera: Camera): void {
    const projectionMatrix = camera.getProjectionMatrix();
    const viewMatrix = camera.getViewMatrix();
    const combined = projectionMatrix.clone().multiply(viewMatrix);
    this.frustum.setFromProjectionMatrix(combined);
  }

  /**
   * Tests if a sphere is visible
   * @param sphere - Bounding sphere
   * @returns True if visible
   */
  isSphereVisible(sphere: BoundingSphere): boolean {
    this.totalCount++;
    const visible = this.frustum.intersectsSphere(sphere);
    if (!visible) this.culledCount++;
    return visible;
  }

  /**
   * Tests if a box is visible
   * @param box - Bounding box
   * @returns True if visible
   */
  isBoxVisible(box: BoundingBox): boolean {
    this.totalCount++;
    const visible = this.frustum.intersectsBox(box);
    if (!visible) this.culledCount++;
    return visible;
  }

  /**
   * Tests if a point is visible
   * @param point - Point to test
   * @returns True if visible
   */
  isPointVisible(point: Vector3): boolean {
    this.totalCount++;
    const visible = this.frustum.containsPoint(point);
    if (!visible) this.culledCount++;
    return visible;
  }

  /**
   * Gets culling statistics
   * @returns Culling stats
   */
  getStatistics(): { culled: number; total: number; ratio: number } {
    return {
      culled: this.culledCount,
      total: this.totalCount,
      ratio: this.totalCount > 0 ? this.culledCount / this.totalCount : 0
    };
  }

  /**
   * Resets culling statistics
   */
  resetStatistics(): void {
    this.culledCount = 0;
    this.totalCount = 0;
  }

  /**
   * Gets the frustum
   * @returns Frustum
   */
  getFrustum(): Frustum {
    return this.frustum;
  }
}
