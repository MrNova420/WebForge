/**
 * @module physics
 * @fileoverview Narrowphase collision detection for precise collision tests
 */

import { Vector3 } from '../math/Vector3';
import { CollisionShape, CollisionShapeType, BoxShape, SphereShape, PlaneShape } from './CollisionShape';

/**
 * Contact point information
 */
export interface ContactPoint {
  /** Point on body A in world space */
  pointA: Vector3;
  /** Point on body B in world space */
  pointB: Vector3;
  /** Contact normal (from A to B) */
  normal: Vector3;
  /** Penetration depth */
  depth: number;
}

/**
 * Contact manifold (collection of contact points)
 */
export interface ContactManifold {
  bodyA: any;
  bodyB: any;
  contacts: ContactPoint[];
}

/**
 * Narrowphase collision detection
 */
export class Narrowphase {
  /**
   * Tests collision between two shapes
   * @param shapeA - First collision shape
   * @param posA - First shape position
   * @param shapeB - Second collision shape
   * @param posB - Second shape position
   * @returns Contact manifold or null if no collision
   */
  static testCollision(
    shapeA: CollisionShape,
    posA: Vector3,
    shapeB: CollisionShape,
    posB: Vector3
  ): ContactManifold | null {
    // Dispatch to appropriate test based on shape types
    if (shapeA.type === CollisionShapeType.SPHERE && shapeB.type === CollisionShapeType.SPHERE) {
      return this.testSphereSphere(shapeA as SphereShape, posA, shapeB as SphereShape, posB);
    }
    
    if (shapeA.type === CollisionShapeType.SPHERE && shapeB.type === CollisionShapeType.PLANE) {
      return this.testSpherePlane(shapeA as SphereShape, posA, shapeB as PlaneShape, posB);
    }
    
    if (shapeA.type === CollisionShapeType.PLANE && shapeB.type === CollisionShapeType.SPHERE) {
      const result = this.testSpherePlane(shapeB as SphereShape, posB, shapeA as PlaneShape, posA);
      if (result) {
        // Swap bodies and reverse normal
        const temp = result.bodyA;
        result.bodyA = result.bodyB;
        result.bodyB = temp;
        result.contacts.forEach(c => {
          c.normal.multiplyScalar(-1);
          const tempPoint = c.pointA;
          c.pointA = c.pointB;
          c.pointB = tempPoint;
        });
      }
      return result;
    }
    
    if (shapeA.type === CollisionShapeType.BOX && shapeB.type === CollisionShapeType.BOX) {
      return this.testBoxBox(shapeA as BoxShape, posA, shapeB as BoxShape, posB);
    }

    if (shapeA.type === CollisionShapeType.BOX && shapeB.type === CollisionShapeType.SPHERE) {
      return this.testBoxSphere(shapeA as BoxShape, posA, shapeB as SphereShape, posB);
    }

    if (shapeA.type === CollisionShapeType.SPHERE && shapeB.type === CollisionShapeType.BOX) {
      const result = this.testBoxSphere(shapeB as BoxShape, posB, shapeA as SphereShape, posA);
      if (result) {
        // Swap bodies and reverse normal
        const temp = result.bodyA;
        result.bodyA = result.bodyB;
        result.bodyB = temp;
        result.contacts.forEach(c => {
          c.normal.multiplyScalar(-1);
          const tempPoint = c.pointA;
          c.pointA = c.pointB;
          c.pointB = tempPoint;
        });
      }
      return result;
    }

    // Unsupported collision pair
    return null;
  }

  /**
   * Tests sphere-sphere collision
   */
  private static testSphereSphere(
    sphereA: SphereShape,
    posA: Vector3,
    sphereB: SphereShape,
    posB: Vector3
  ): ContactManifold | null {
    const delta = posB.clone().subtract(posA);
    const distanceSquared = delta.lengthSquared();
    const radiusSum = sphereA.radius + sphereB.radius;

    if (distanceSquared >= radiusSum * radiusSum) {
      return null; // No collision
    }

    const distance = Math.sqrt(distanceSquared);
    const depth = radiusSum - distance;

    // Normal from A to B
    const normal = distance > 0 
      ? delta.clone().divideScalar(distance)
      : new Vector3(0, 1, 0); // Arbitrary normal if spheres are at same position

    // Contact points
    const pointA = posA.clone().add(normal.clone().multiplyScalar(sphereA.radius));
    const pointB = posB.clone().add(normal.clone().multiplyScalar(-sphereB.radius));

    return {
      bodyA: null,
      bodyB: null,
      contacts: [{
        pointA,
        pointB,
        normal,
        depth
      }]
    };
  }

  /**
   * Tests sphere-plane collision
   */
  private static testSpherePlane(
    sphere: SphereShape,
    spherePos: Vector3,
    plane: PlaneShape,
    _planePos: Vector3
  ): ContactManifold | null {
    // Distance from sphere center to plane
    const distance = plane.normal.dot(spherePos) - plane.distance;

    if (distance >= sphere.radius) {
      return null; // No collision
    }

    const depth = sphere.radius - distance;
    const normal = plane.normal.clone();
    
    // Contact point on sphere
    const pointA = spherePos.clone().add(normal.clone().multiplyScalar(-sphere.radius));
    // Contact point on plane (projected)
    const pointB = spherePos.clone().add(normal.clone().multiplyScalar(-distance));

    return {
      bodyA: null,
      bodyB: null,
      contacts: [{
        pointA,
        pointB,
        normal,
        depth
      }]
    };
  }

  /**
   * Tests box-box collision using AABB (simplified)
   * TODO: Implement SAT for oriented boxes
   */
  private static testBoxBox(
    boxA: BoxShape,
    posA: Vector3,
    boxB: BoxShape,
    posB: Vector3
  ): ContactManifold | null {
    // AABB test (simplified - assumes axis-aligned)
    const minA = posA.clone().subtract(boxA.halfExtents);
    const maxA = posA.clone().add(boxA.halfExtents);
    const minB = posB.clone().subtract(boxB.halfExtents);
    const maxB = posB.clone().add(boxB.halfExtents);

    // Check overlap on all axes
    if (maxA.x < minB.x || minA.x > maxB.x) return null;
    if (maxA.y < minB.y || minA.y > maxB.y) return null;
    if (maxA.z < minB.z || minA.z > maxB.z) return null;

    // Calculate overlap on each axis
    const overlapX = Math.min(maxA.x - minB.x, maxB.x - minA.x);
    const overlapY = Math.min(maxA.y - minB.y, maxB.y - minA.y);
    const overlapZ = Math.min(maxA.z - minB.z, maxB.z - minA.z);

    // Find minimum overlap axis
    let depth: number;
    let normal: Vector3;

    if (overlapX < overlapY && overlapX < overlapZ) {
      depth = overlapX;
      normal = posB.x > posA.x ? new Vector3(1, 0, 0) : new Vector3(-1, 0, 0);
    } else if (overlapY < overlapZ) {
      depth = overlapY;
      normal = posB.y > posA.y ? new Vector3(0, 1, 0) : new Vector3(0, -1, 0);
    } else {
      depth = overlapZ;
      normal = posB.z > posA.z ? new Vector3(0, 0, 1) : new Vector3(0, 0, -1);
    }

    // Simple contact point (center of overlap)
    const center = new Vector3(
      (Math.max(minA.x, minB.x) + Math.min(maxA.x, maxB.x)) / 2,
      (Math.max(minA.y, minB.y) + Math.min(maxA.y, maxB.y)) / 2,
      (Math.max(minA.z, minB.z) + Math.min(maxA.z, maxB.z)) / 2
    );

    return {
      bodyA: null,
      bodyB: null,
      contacts: [{
        pointA: center,
        pointB: center,
        normal,
        depth
      }]
    };
  }

  /**
   * Tests box-sphere collision
   */
  private static testBoxSphere(
    box: BoxShape,
    boxPos: Vector3,
    sphere: SphereShape,
    spherePos: Vector3
  ): ContactManifold | null {
    // Find closest point on box to sphere center
    const boxMin = boxPos.clone().subtract(box.halfExtents);
    const boxMax = boxPos.clone().add(box.halfExtents);

    const closestPoint = new Vector3(
      Math.max(boxMin.x, Math.min(spherePos.x, boxMax.x)),
      Math.max(boxMin.y, Math.min(spherePos.y, boxMax.y)),
      Math.max(boxMin.z, Math.min(spherePos.z, boxMax.z))
    );

    // Check if closest point is within sphere
    const delta = spherePos.clone().subtract(closestPoint);
    const distanceSquared = delta.lengthSquared();

    if (distanceSquared >= sphere.radius * sphere.radius) {
      return null; // No collision
    }

    const distance = Math.sqrt(distanceSquared);
    const depth = sphere.radius - distance;

    // Normal from box to sphere
    const normal = distance > 0
      ? delta.clone().divideScalar(distance)
      : new Vector3(0, 1, 0); // Default if sphere center is on box surface

    const pointA = closestPoint;
    const pointB = spherePos.clone().add(normal.clone().multiplyScalar(-sphere.radius));

    return {
      bodyA: null,
      bodyB: null,
      contacts: [{
        pointA,
        pointB,
        normal,
        depth
      }]
    };
  }
}
