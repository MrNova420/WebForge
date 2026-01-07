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
  MESH = 'mesh'
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
