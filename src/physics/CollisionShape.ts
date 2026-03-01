/**
 * @module physics
 * @fileoverview Collision shapes for physics bodies
 */

import { Vector3 } from '../math/Vector3';
import { BoundingBox, BoundingSphere } from '../optimization/FrustumCulling';

/**
 * Collision shape type
 */
export enum CollisionShapeType {
  BOX = 'box',
  SPHERE = 'sphere',
  CAPSULE = 'capsule',
  CYLINDER = 'cylinder',
  PLANE = 'plane',
  MESH = 'mesh',
  COMPOUND = 'compound'
}

/**
 * Base collision shape
 */
export abstract class CollisionShape {
  abstract readonly type: CollisionShapeType;
  
  /**
   * Gets the bounding box
   */
  abstract getBoundingBox(): BoundingBox;
  
  /**
   * Gets the bounding sphere
   */
  abstract getBoundingSphere(): BoundingSphere;
  
  /**
   * Computes the inertia tensor
   * @param mass - Mass of the body
   */
  abstract computeInertia(mass: number): Vector3;
}

/**
 * Box collision shape
 */
export class BoxShape extends CollisionShape {
  readonly type = CollisionShapeType.BOX;
  
  /** Half extents of the box */
  halfExtents: Vector3;

  constructor(halfExtents: Vector3) {
    super();
    this.halfExtents = halfExtents.clone();
  }

  getBoundingBox(): BoundingBox {
    return new BoundingBox(
      this.halfExtents.clone().multiplyScalar(-1),
      this.halfExtents.clone()
    );
  }

  getBoundingSphere(): BoundingSphere {
    const radius = this.halfExtents.length();
    return new BoundingSphere(new Vector3(), radius);
  }

  computeInertia(mass: number): Vector3 {
    const x = this.halfExtents.x * 2;
    const y = this.halfExtents.y * 2;
    const z = this.halfExtents.z * 2;
    
    return new Vector3(
      (mass / 12) * (y * y + z * z),
      (mass / 12) * (x * x + z * z),
      (mass / 12) * (x * x + y * y)
    );
  }
}

/**
 * Sphere collision shape
 */
export class SphereShape extends CollisionShape {
  readonly type = CollisionShapeType.SPHERE;
  
  /** Radius of the sphere */
  radius: number;

  constructor(radius: number) {
    super();
    this.radius = radius;
  }

  getBoundingBox(): BoundingBox {
    const r = new Vector3(this.radius, this.radius, this.radius);
    return new BoundingBox(r.clone().multiplyScalar(-1), r);
  }

  getBoundingSphere(): BoundingSphere {
    return new BoundingSphere(new Vector3(), this.radius);
  }

  computeInertia(mass: number): Vector3 {
    const i = (2 / 5) * mass * this.radius * this.radius;
    return new Vector3(i, i, i);
  }
}

/**
 * Capsule collision shape
 */
export class CapsuleShape extends CollisionShape {
  readonly type = CollisionShapeType.CAPSULE;
  
  /** Radius of the capsule */
  radius: number;
  /** Height of the cylinder part (excluding hemispheres) */
  height: number;

  constructor(radius: number, height: number) {
    super();
    this.radius = radius;
    this.height = height;
  }

  getBoundingBox(): BoundingBox {
    const halfHeight = (this.height + this.radius * 2) / 2;
    return new BoundingBox(
      new Vector3(-this.radius, -halfHeight, -this.radius),
      new Vector3(this.radius, halfHeight, this.radius)
    );
  }

  getBoundingSphere(): BoundingSphere {
    const halfHeight = this.height / 2;
    const radius = Math.sqrt(this.radius * this.radius + halfHeight * halfHeight);
    return new BoundingSphere(new Vector3(), radius);
  }

  computeInertia(mass: number): Vector3 {
    // Approximation for capsule inertia
    const cylinderMass = mass * 0.7;
    const sphereMass = mass * 0.3;
    
    const cylinderI = (cylinderMass / 12) * (3 * this.radius * this.radius + this.height * this.height);
    const sphereI = (2 / 5) * sphereMass * this.radius * this.radius;
    
    const i = cylinderI + sphereI;
    return new Vector3(i, i, i);
  }
}

/**
 * Plane collision shape (infinite plane)
 */
export class PlaneShape extends CollisionShape {
  readonly type = CollisionShapeType.PLANE;
  
  /** Plane normal */
  normal: Vector3;
  /** Distance from origin */
  distance: number;

  constructor(normal: Vector3 = new Vector3(0, 1, 0), distance: number = 0) {
    super();
    this.normal = normal.clone().normalize();
    this.distance = distance;
  }

  getBoundingBox(): BoundingBox {
    // Infinite bounding box
    const inf = Infinity;
    return new BoundingBox(
      new Vector3(-inf, -inf, -inf),
      new Vector3(inf, inf, inf)
    );
  }

  getBoundingSphere(): BoundingSphere {
    // Infinite bounding sphere
    return new BoundingSphere(new Vector3(), Infinity);
  }

  computeInertia(_mass: number): Vector3 {
    // Infinite inertia (plane is always static)
    return new Vector3(Infinity, Infinity, Infinity);
  }
}

/**
 * Child shape in a compound shape
 */
export interface CompoundChild {
  shape: CollisionShape;
  offset: Vector3;
}

/**
 * Compound collision shape combining multiple child shapes
 */
export class CompoundShape extends CollisionShape {
  readonly type = CollisionShapeType.COMPOUND;
  
  /** Child shapes with local offsets */
  children: CompoundChild[] = [];

  constructor(children?: CompoundChild[]) {
    super();
    if (children) {
      this.children = children;
    }
  }

  /**
   * Adds a child shape at a local offset
   */
  addChild(shape: CollisionShape, offset: Vector3 = new Vector3()): void {
    this.children.push({ shape, offset: offset.clone() });
  }

  /**
   * Removes a child shape by index
   */
  removeChild(index: number): void {
    this.children.splice(index, 1);
  }

  getBoundingBox(): BoundingBox {
    if (this.children.length === 0) {
      return new BoundingBox(new Vector3(), new Vector3());
    }

    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

    for (const child of this.children) {
      const bb = child.shape.getBoundingBox();
      minX = Math.min(minX, bb.min.x + child.offset.x);
      minY = Math.min(minY, bb.min.y + child.offset.y);
      minZ = Math.min(minZ, bb.min.z + child.offset.z);
      maxX = Math.max(maxX, bb.max.x + child.offset.x);
      maxY = Math.max(maxY, bb.max.y + child.offset.y);
      maxZ = Math.max(maxZ, bb.max.z + child.offset.z);
    }

    return new BoundingBox(
      new Vector3(minX, minY, minZ),
      new Vector3(maxX, maxY, maxZ)
    );
  }

  getBoundingSphere(): BoundingSphere {
    if (this.children.length === 0) {
      return new BoundingSphere(new Vector3(), 0);
    }

    let maxRadius = 0;
    for (const child of this.children) {
      const bs = child.shape.getBoundingSphere();
      const dist = child.offset.length() + bs.radius;
      maxRadius = Math.max(maxRadius, dist);
    }

    return new BoundingSphere(new Vector3(), maxRadius);
  }

  computeInertia(mass: number): Vector3 {
    if (this.children.length === 0) {
      return new Vector3();
    }

    // Distribute mass equally among children and sum inertia using parallel axis theorem
    const childMass = mass / this.children.length;
    let totalIx = 0, totalIy = 0, totalIz = 0;

    for (const child of this.children) {
      const childInertia = child.shape.computeInertia(childMass);
      const d2 = child.offset.x * child.offset.x + child.offset.y * child.offset.y + child.offset.z * child.offset.z;
      totalIx += childInertia.x + childMass * (d2 - child.offset.x * child.offset.x);
      totalIy += childInertia.y + childMass * (d2 - child.offset.y * child.offset.y);
      totalIz += childInertia.z + childMass * (d2 - child.offset.z * child.offset.z);
    }

    return new Vector3(totalIx, totalIy, totalIz);
  }
}

/**
 * Trigger volume - detects overlaps without generating collision response
 */
export class TriggerVolume {
  /** Collision shape defining the trigger region */
  shape: CollisionShape;
  /** World position of the trigger */
  position: Vector3;
  /** Whether the trigger is active */
  enabled: boolean = true;
  /** Tag for identification */
  tag: string = '';
  /** Set of body IDs currently inside the trigger */
  private _overlapping: Set<string> = new Set();
  /** Callback when a body enters */
  onEnter?: (bodyId: string) => void;
  /** Callback when a body exits */
  onExit?: (bodyId: string) => void;
  /** Callback while a body stays inside */
  onStay?: (bodyId: string) => void;

  constructor(shape: CollisionShape, position: Vector3 = new Vector3(), tag: string = '') {
    this.shape = shape;
    this.position = position.clone();
    this.tag = tag;
  }

  /**
   * Updates overlap state for a body
   * @param bodyId - Unique body identifier
   * @param isOverlapping - Whether the body currently overlaps
   */
  updateOverlap(bodyId: string, isOverlapping: boolean): void {
    if (!this.enabled) return;

    const wasInside = this._overlapping.has(bodyId);

    if (isOverlapping && !wasInside) {
      this._overlapping.add(bodyId);
      this.onEnter?.(bodyId);
    } else if (!isOverlapping && wasInside) {
      this._overlapping.delete(bodyId);
      this.onExit?.(bodyId);
    } else if (isOverlapping && wasInside) {
      this.onStay?.(bodyId);
    }
  }

  /**
   * Gets all currently overlapping body IDs
   */
  getOverlapping(): string[] {
    return Array.from(this._overlapping);
  }

  /**
   * Checks if a specific body is inside the trigger
   */
  isOverlapping(bodyId: string): boolean {
    return this._overlapping.has(bodyId);
  }

  /**
   * Clears all overlap state
   */
  clear(): void {
    this._overlapping.clear();
  }
}
