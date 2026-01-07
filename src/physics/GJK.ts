/**
 * @module physics
 * @fileoverview GJK (Gilbert-Johnson-Keerthi) algorithm for convex collision detection
 */

import { Vector3 } from '../math/Vector3';

/**
 * Simplex for GJK
 */
class Simplex {
  points: Vector3[] = [];
  
  add(point: Vector3): void {
    this.points.push(point);
  }
  
  get size(): number {
    return this.points.length;
  }
  
  get(index: number): Vector3 {
    return this.points[index];
  }
  
  set(index: number, point: Vector3): void {
    this.points[index] = point;
  }
  
  clear(): void {
    this.points = [];
  }
}

/**
 * GJK collision detection algorithm
 * Detects collision between convex shapes using Minkowski difference
 */
export class GJK {
  private static readonly MAX_ITERATIONS = 32;

  /**
   * Tests if two convex shapes intersect
   * @param supportA - Support function for shape A
   * @param supportB - Support function for shape B
   * @returns True if shapes intersect
   */
  static testIntersection(
    supportA: (direction: Vector3) => Vector3,
    supportB: (direction: Vector3) => Vector3
  ): boolean {
    // Initial direction
    let direction = new Vector3(1, 0, 0);
    
    // Initial simplex
    const simplex = new Simplex();
    
    // Get first point
    let support = this.support(supportA, supportB, direction);
    simplex.add(support);
    
    // New direction towards origin
    direction = support.clone().multiplyScalar(-1);
    
    // Iterate
    for (let i = 0; i < this.MAX_ITERATIONS; i++) {
      support = this.support(supportA, supportB, direction);
      
      // If support point is not past origin, no intersection
      if (support.dot(direction) <= 0) {
        return false;
      }
      
      simplex.add(support);
      
      // Check if origin is in simplex and update direction
      if (this.containsOrigin(simplex, direction)) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Computes support point in Minkowski difference
   * @param supportA - Support function for shape A
   * @param supportB - Support function for shape B
   * @param direction - Search direction
   * @returns Support point
   */
  private static support(
    supportA: (direction: Vector3) => Vector3,
    supportB: (direction: Vector3) => Vector3,
    direction: Vector3
  ): Vector3 {
    const pointA = supportA(direction);
    const pointB = supportB(direction.clone().multiplyScalar(-1));
    return pointA.clone().subtract(pointB);
  }

  /**
   * Checks if simplex contains origin and updates direction
   * @param simplex - Current simplex
   * @param direction - Direction to update
   * @returns True if origin is in simplex
   */
  private static containsOrigin(simplex: Simplex, direction: Vector3): boolean {
    const a = simplex.get(simplex.size - 1);
    const ao = a.clone().multiplyScalar(-1);
    
    if (simplex.size === 2) {
      // Line case
      const b = simplex.get(0);
      const ab = b.clone().subtract(a);
      
      if (ab.dot(ao) > 0) {
        // Origin is towards B
        direction.copy(ab.cross(ao).cross(ab));
      } else {
        // Origin is towards A
        simplex.points = [a];
        direction.copy(ao);
      }
      return false;
    }
    
    if (simplex.size === 3) {
      // Triangle case
      const b = simplex.get(1);
      const c = simplex.get(0);
      const ab = b.clone().subtract(a);
      const ac = c.clone().subtract(a);
      const abc = ab.cross(ac);
      
      // Test regions
      const abPerp = abc.cross(ab);
      if (abPerp.dot(ao) > 0) {
        // Region AB
        if (ab.dot(ao) > 0) {
          simplex.points = [b, a];
          direction.copy(ab.cross(ao).cross(ab));
        } else {
          simplex.points = [a];
          direction.copy(ao);
        }
        return false;
      }
      
      const acPerp = ac.cross(abc);
      if (acPerp.dot(ao) > 0) {
        // Region AC
        if (ac.dot(ao) > 0) {
          simplex.points = [c, a];
          direction.copy(ac.cross(ao).cross(ac));
        } else {
          simplex.points = [a];
          direction.copy(ao);
        }
        return false;
      }
      
      // Origin is above or below triangle
      if (abc.dot(ao) > 0) {
        direction.copy(abc);
      } else {
        simplex.points = [c, b, a];
        direction.copy(abc.multiplyScalar(-1));
      }
      return false;
    }
    
    if (simplex.size === 4) {
      // Tetrahedron case
      const b = simplex.get(2);
      const c = simplex.get(1);
      const d = simplex.get(0);
      const ab = b.clone().subtract(a);
      const ac = c.clone().subtract(a);
      const ad = d.clone().subtract(a);
      
      // Test each face
      const abc = ab.cross(ac);
      if (abc.dot(ao) > 0) {
        simplex.points = [c, b, a];
        direction.copy(abc);
        return false;
      }
      
      const acd = ac.cross(ad);
      if (acd.dot(ao) > 0) {
        simplex.points = [d, c, a];
        direction.copy(acd);
        return false;
      }
      
      const adb = ad.cross(ab);
      if (adb.dot(ao) > 0) {
        simplex.points = [b, d, a];
        direction.copy(adb);
        return false;
      }
      
      // Origin is inside tetrahedron
      return true;
    }
    
    return false;
  }

  /**
   * Gets distance between two shapes (EPA - Expanding Polytope Algorithm)
   * This is a simplified version
   * @param supportA - Support function for shape A
   * @param supportB - Support function for shape B
   * @returns Penetration depth or 0 if not intersecting
   */
  static getPenetrationDepth(
    supportA: (direction: Vector3) => Vector3,
    supportB: (direction: Vector3) => Vector3
  ): number {
    // First check if shapes intersect
    if (!this.testIntersection(supportA, supportB)) {
      return 0;
    }
    
    // Simplified EPA: just return a small default penetration
    // Full EPA implementation would expand the simplex to find exact penetration
    return 0.01;
  }
}

/**
 * Support function factory for common shapes
 */
export class SupportFunctions {
  /**
   * Creates support function for a box
   * @param halfExtents - Half extents of the box
   * @param position - Position of the box
   * @returns Support function
   */
  static box(halfExtents: Vector3, position: Vector3): (direction: Vector3) => Vector3 {
    return (direction: Vector3) => {
      const result = new Vector3(
        direction.x > 0 ? halfExtents.x : -halfExtents.x,
        direction.y > 0 ? halfExtents.y : -halfExtents.y,
        direction.z > 0 ? halfExtents.z : -halfExtents.z
      );
      return result.add(position);
    };
  }

  /**
   * Creates support function for a sphere
   * @param radius - Radius of the sphere
   * @param position - Position of the sphere
   * @returns Support function
   */
  static sphere(radius: number, position: Vector3): (direction: Vector3) => Vector3 {
    return (direction: Vector3) => {
      const normalized = direction.clone().normalize();
      return position.clone().add(normalized.multiplyScalar(radius));
    };
  }
}
