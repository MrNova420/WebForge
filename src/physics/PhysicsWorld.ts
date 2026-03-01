/**
 * @module physics
 * @fileoverview Physics world managing simulation and rigid bodies
 */

import { Vector3 } from '../math/Vector3';
import { Logger } from '../core/Logger';
import { Broadphase, SweepAndPruneBroadphase } from './BroadphaseCollision';
import { Narrowphase, ContactManifold } from './NarrowphaseCollision';
import { ConstraintSolver } from './ConstraintSolver';
import { Constraint } from './Constraint';
import { CollisionShape } from './CollisionShape';

/**
 * Physics world configuration
 */
export interface PhysicsWorldConfig {
  /** Gravity vector */
  gravity?: Vector3;
  /** Fixed timestep for physics simulation */
  fixedTimestep?: number;
  /** Maximum substeps per frame */
  maxSubsteps?: number;
  /** Enable continuous collision detection */
  enableCCD?: boolean;
}

/**
 * Physics world managing rigid body simulation
 */
export class PhysicsWorld {
  private gravity: Vector3;
  private fixedTimestep: number;
  private maxSubsteps: number;
  private _enableCCD: boolean;
  
  private bodies: Set<any> = new Set(); // Will be RigidBody when implemented
  private accumulator: number = 0;
  
  private broadphase: Broadphase;
  private manifolds: ContactManifold[] = [];
  private solver: ConstraintSolver;
  
  private logger: Logger;

  /**
   * Creates a new physics world
   * @param config - Physics world configuration
   */
  constructor(config: PhysicsWorldConfig = {}) {
    this.gravity = config.gravity ? config.gravity.clone() : new Vector3(0, -9.81, 0);
    this.fixedTimestep = config.fixedTimestep || 1/60; // 60 Hz
    this.maxSubsteps = config.maxSubsteps || 10;
    this._enableCCD = config.enableCCD !== undefined ? config.enableCCD : true;
    
    this.broadphase = new SweepAndPruneBroadphase();
    this.solver = new ConstraintSolver();
    
    this.logger = new Logger('PhysicsWorld');
    this.logger.info(`Physics world created (gravity: ${this.gravity.y}, timestep: ${this.fixedTimestep}s)`);
  }

  /**
   * Steps the physics simulation
   * @param deltaTime - Time since last frame
   */
  step(deltaTime: number): void {
    // Accumulate time
    this.accumulator += deltaTime;
    
    // Clamp accumulator to prevent spiral of death
    if (this.accumulator > this.fixedTimestep * this.maxSubsteps) {
      this.accumulator = this.fixedTimestep * this.maxSubsteps;
    }
    
    // Fixed timestep loop
    let steps = 0;
    while (this.accumulator >= this.fixedTimestep && steps < this.maxSubsteps) {
      this.fixedStep(this.fixedTimestep);
      this.accumulator -= this.fixedTimestep;
      steps++;
    }
  }

  /**
   * Performs a single fixed timestep
   * @param dt - Fixed delta time
   */
  private fixedStep(dt: number): void {
    const bodiesArray = Array.from(this.bodies);
    
    // 1. Apply gravity to dynamic bodies
    for (const body of bodiesArray) {
      if (body.isDynamic && body.isDynamic()) {
        const gravityForce = this.gravity.clone().multiplyScalar(body.getMass ? body.getMass() : 1);
        if (body.applyForce) {
          body.applyForce(gravityForce);
        }
      }
    }
    
    // 2. Broadphase collision detection
    this.broadphase.update(bodiesArray);
    const pairs = this.broadphase.getPairs();
    
    // 3. Narrowphase collision detection
    this.manifolds = [];
    for (const pair of pairs) {
      if (pair.bodyA.shape && pair.bodyB.shape) {
        const manifold = Narrowphase.testCollision(
          pair.bodyA.shape,
          pair.bodyA.getPosition(),
          pair.bodyB.shape,
          pair.bodyB.getPosition()
        );
        
        if (manifold) {
          manifold.bodyA = pair.bodyA;
          manifold.bodyB = pair.bodyB;
          this.manifolds.push(manifold);
        }
      }
    }
    
    // 4. Constraint solving (contact resolution)
    this.solver.prepareContacts(this.manifolds);
    this.solver.solve(dt);
    
    // 5. Integration (apply forces, update velocities and positions)
    for (const body of bodiesArray) {
      if (body.integrate) {
        body.integrate(dt);
      }
    }
  }

  /**
   * Adds a rigid body to the world
   * @param body - Rigid body to add
   */
  addBody(body: any): void {
    this.bodies.add(body);
  }

  /**
   * Removes a rigid body from the world
   * @param body - Rigid body to remove
   */
  removeBody(body: any): void {
    this.bodies.delete(body);
  }

  /**
   * Gets all bodies in the world
   * @returns Array of rigid bodies
   */
  getBodies(): any[] {
    return Array.from(this.bodies);
  }

  /**
   * Gets the number of bodies
   * @returns Body count
   */
  getBodyCount(): number {
    return this.bodies.size;
  }

  /**
   * Sets the gravity
   * @param gravity - New gravity vector
   */
  setGravity(gravity: Vector3): void {
    this.gravity.copy(gravity);
  }

  /**
   * Gets the gravity
   * @returns Gravity vector
   */
  getGravity(): Vector3 {
    return this.gravity.clone();
  }

  /**
   * Sets the fixed timestep
   * @param timestep - New timestep in seconds
   */
  setFixedTimestep(timestep: number): void {
    this.fixedTimestep = Math.max(0.001, timestep);
  }

  /**
   * Gets the fixed timestep
   * @returns Timestep in seconds
   */
  getFixedTimestep(): number {
    return this.fixedTimestep;
  }

  /**
   * Checks if CCD is enabled
   * @returns True if CCD is enabled
   */
  isCCDEnabled(): boolean {
    return this._enableCCD;
  }

  /**
   * Clears all bodies from the world
   */
  clear(): void {
    this.bodies.clear();
    this.accumulator = 0;
  }

  /**
   * Performs a raycast in the physics world
   * @param origin - Ray origin
   * @param direction - Ray direction (normalized)
   * @param maxDistance - Maximum ray distance
   * @returns Raycast result or null (closest hit)
   */
  raycast(origin: Vector3, direction: Vector3, maxDistance: number = Infinity): RaycastResult | null {
    const dir = direction.clone().normalize();
    let closest: RaycastResult | null = null;

    for (const body of this.bodies) {
      if (!body.shape) continue;

      const bodyPos = body.getPosition ? body.getPosition() : new Vector3();
      const result = this.raycastShape(origin, dir, body.shape, bodyPos, maxDistance);
      
      if (result && result.distance < (closest ? closest.distance : maxDistance)) {
        closest = { body, point: result.point, normal: result.normal, distance: result.distance };
      }
    }

    return closest;
  }

  /**
   * Performs a raycast against all bodies, returning all hits
   * @param origin - Ray origin
   * @param direction - Ray direction (normalized)
   * @param maxDistance - Maximum ray distance
   * @returns Array of raycast results sorted by distance
   */
  raycastAll(origin: Vector3, direction: Vector3, maxDistance: number = Infinity): RaycastResult[] {
    const dir = direction.clone().normalize();
    const results: RaycastResult[] = [];

    for (const body of this.bodies) {
      if (!body.shape) continue;

      const bodyPos = body.getPosition ? body.getPosition() : new Vector3();
      const result = this.raycastShape(origin, dir, body.shape, bodyPos, maxDistance);
      
      if (result) {
        results.push({ body, point: result.point, normal: result.normal, distance: result.distance });
      }
    }

    return results.sort((a, b) => a.distance - b.distance);
  }

  /**
   * Tests a ray against a collision shape
   */
  private raycastShape(
    origin: Vector3, 
    direction: Vector3, 
    shape: CollisionShape, 
    position: Vector3,
    maxDistance: number
  ): { point: Vector3; normal: Vector3; distance: number } | null {
    switch (shape.type) {
      case 'sphere': {
        const s = shape as import('./CollisionShape').SphereShape;
        return this.raySphereIntersect(origin, direction, position, s.radius, maxDistance);
      }
      case 'box': {
        const b = shape as import('./CollisionShape').BoxShape;
        return this.rayBoxIntersect(origin, direction, position, b.halfExtents, maxDistance);
      }
      case 'plane': {
        const p = shape as import('./CollisionShape').PlaneShape;
        return this.rayPlaneIntersect(origin, direction, p.normal, p.distance, maxDistance);
      }
      case 'capsule': {
        const c = shape as import('./CollisionShape').CapsuleShape;
        return this.rayCapsuleIntersect(origin, direction, position, c.radius, c.height, maxDistance);
      }
      default: {
        // Fallback: test against bounding sphere
        const bs = shape.getBoundingSphere();
        return this.raySphereIntersect(origin, direction, position, bs.radius, maxDistance);
      }
    }
  }

  /**
   * Ray-Sphere intersection test
   */
  private raySphereIntersect(
    origin: Vector3, direction: Vector3, 
    center: Vector3, radius: number, maxDistance: number
  ): { point: Vector3; normal: Vector3; distance: number } | null {
    const oc = origin.clone().subtract(center);
    const a = direction.dot(direction);
    const b = 2.0 * oc.dot(direction);
    const c = oc.dot(oc) - radius * radius;
    const discriminant = b * b - 4 * a * c;

    if (discriminant < 0) return null;

    const sqrtD = Math.sqrt(discriminant);
    let t = (-b - sqrtD) / (2 * a);
    
    // If nearest intersection is behind ray origin, try the far one
    if (t < 0) t = (-b + sqrtD) / (2 * a);
    if (t < 0 || t > maxDistance) return null;

    const point = origin.clone().add(direction.clone().multiplyScalar(t));
    const normal = point.clone().subtract(center).normalize();

    return { point, normal, distance: t };
  }

  /**
   * Ray-AABB (Axis-Aligned Bounding Box) intersection test
   */
  private rayBoxIntersect(
    origin: Vector3, direction: Vector3,
    center: Vector3, halfExtents: Vector3, maxDistance: number
  ): { point: Vector3; normal: Vector3; distance: number } | null {
    const min = center.clone().subtract(halfExtents);
    const max = center.clone().add(halfExtents);

    let tmin = -Infinity;
    let tmax = Infinity;
    let normalAxis = 0;
    let normalSign = 1;

    // Test X slab
    if (Math.abs(direction.x) > 1e-8) {
      const t1 = (min.x - origin.x) / direction.x;
      const t2 = (max.x - origin.x) / direction.x;
      const tNear = Math.min(t1, t2);
      const tFar = Math.max(t1, t2);
      if (tNear > tmin) { tmin = tNear; normalAxis = 0; normalSign = t1 < t2 ? -1 : 1; }
      if (tFar < tmax) tmax = tFar;
    } else if (origin.x < min.x || origin.x > max.x) {
      return null;
    }

    // Test Y slab
    if (Math.abs(direction.y) > 1e-8) {
      const t1 = (min.y - origin.y) / direction.y;
      const t2 = (max.y - origin.y) / direction.y;
      const tNear = Math.min(t1, t2);
      const tFar = Math.max(t1, t2);
      if (tNear > tmin) { tmin = tNear; normalAxis = 1; normalSign = t1 < t2 ? -1 : 1; }
      if (tFar < tmax) tmax = tFar;
    } else if (origin.y < min.y || origin.y > max.y) {
      return null;
    }

    // Test Z slab
    if (Math.abs(direction.z) > 1e-8) {
      const t1 = (min.z - origin.z) / direction.z;
      const t2 = (max.z - origin.z) / direction.z;
      const tNear = Math.min(t1, t2);
      const tFar = Math.max(t1, t2);
      if (tNear > tmin) { tmin = tNear; normalAxis = 2; normalSign = t1 < t2 ? -1 : 1; }
      if (tFar < tmax) tmax = tFar;
    } else if (origin.z < min.z || origin.z > max.z) {
      return null;
    }

    if (tmin > tmax || tmax < 0) return null;
    
    const t = tmin >= 0 ? tmin : tmax;
    if (t > maxDistance) return null;

    const point = origin.clone().add(direction.clone().multiplyScalar(t));
    const normal = new Vector3();
    if (normalAxis === 0) normal.x = normalSign;
    else if (normalAxis === 1) normal.y = normalSign;
    else normal.z = normalSign;

    return { point, normal, distance: t };
  }

  /**
   * Ray-Plane intersection test
   */
  private rayPlaneIntersect(
    origin: Vector3, direction: Vector3,
    planeNormal: Vector3, planeDistance: number, maxDistance: number
  ): { point: Vector3; normal: Vector3; distance: number } | null {
    const denom = planeNormal.dot(direction);
    if (Math.abs(denom) < 1e-8) return null; // Ray is parallel to plane

    const t = -(planeNormal.dot(origin) + planeDistance) / denom;
    if (t < 0 || t > maxDistance) return null;

    const point = origin.clone().add(direction.clone().multiplyScalar(t));
    const normal = denom < 0 ? planeNormal.clone() : planeNormal.clone().multiplyScalar(-1);

    return { point, normal, distance: t };
  }

  /**
   * Ray-Capsule intersection test (approximated as sphere + cylinder + sphere)
   */
  private rayCapsuleIntersect(
    origin: Vector3, direction: Vector3,
    center: Vector3, radius: number, height: number, maxDistance: number
  ): { point: Vector3; normal: Vector3; distance: number } | null {
    const halfHeight = height / 2;

    // Test against top sphere
    const topCenter = center.clone().add(new Vector3(0, halfHeight, 0));
    const topResult = this.raySphereIntersect(origin, direction, topCenter, radius, maxDistance);

    // Test against bottom sphere
    const bottomCenter = center.clone().add(new Vector3(0, -halfHeight, 0));
    const bottomResult = this.raySphereIntersect(origin, direction, bottomCenter, radius, maxDistance);

    // Test against cylinder (infinite cylinder in Y, then clamp)
    const cylinderResult = this.rayCylinderYIntersect(origin, direction, center, radius, halfHeight, maxDistance);

    // Find closest hit
    let best: { point: Vector3; normal: Vector3; distance: number } | null = null;
    for (const result of [topResult, bottomResult, cylinderResult]) {
      if (result && (!best || result.distance < best.distance)) {
        best = result;
      }
    }

    return best;
  }

  /**
   * Ray-Cylinder intersection test (Y-axis aligned)
   */
  private rayCylinderYIntersect(
    origin: Vector3, direction: Vector3,
    center: Vector3, radius: number, halfHeight: number, maxDistance: number
  ): { point: Vector3; normal: Vector3; distance: number } | null {
    // 2D circle test in XZ plane
    const ox = origin.x - center.x;
    const oz = origin.z - center.z;
    const dx = direction.x;
    const dz = direction.z;

    const a = dx * dx + dz * dz;
    if (a < 1e-8) return null; // Ray is parallel to Y axis

    const b = 2 * (ox * dx + oz * dz);
    const c = ox * ox + oz * oz - radius * radius;
    const discriminant = b * b - 4 * a * c;

    if (discriminant < 0) return null;

    const sqrtD = Math.sqrt(discriminant);
    let t = (-b - sqrtD) / (2 * a);
    if (t < 0) t = (-b + sqrtD) / (2 * a);
    if (t < 0 || t > maxDistance) return null;

    const point = origin.clone().add(direction.clone().multiplyScalar(t));
    const relY = point.y - center.y;
    
    // Check if hit is within cylinder height
    if (relY < -halfHeight || relY > halfHeight) return null;

    const normal = new Vector3(point.x - center.x, 0, point.z - center.z).normalize();
    return { point, normal, distance: t };
  }

  /**
   * Adds a constraint to the world
   * @param constraint - Constraint to add
   */
  addConstraint(constraint: Constraint): void {
    this.solver.addConstraint(constraint);
  }

  /**
   * Removes a constraint from the world
   * @param constraint - Constraint to remove
   */
  removeConstraint(constraint: Constraint): void {
    this.solver.removeConstraint(constraint);
  }

  /**
   * Gets all constraints
   * @returns Array of constraints
   */
  getConstraints(): Constraint[] {
    return this.solver.getConstraints();
  }

  /**
   * Gets the current contact manifolds
   * @returns Array of contact manifolds
   */
  getManifolds(): ContactManifold[] {
    return this.manifolds;
  }

  /**
   * Gets collision statistics
   * @returns Collision statistics
   */
  getCollisionStats(): { pairs: number; contacts: number; constraints: number } {
    return {
      pairs: this.manifolds.length,
      contacts: this.manifolds.reduce((sum, m) => sum + m.contacts.length, 0),
      constraints: this.solver.getConstraintCount()
    };
  }

  /**
   * Disposes the physics world
   */
  dispose(): void {
    this.clear();
    this.broadphase.clear();
    this.solver.clear();
    this.manifolds = [];
    this.logger.info('Physics world disposed');
  }
}

/**
 * Raycast result
 */
export interface RaycastResult {
  /** Hit body */
  body: any;
  /** Hit point in world space */
  point: Vector3;
  /** Hit normal */
  normal: Vector3;
  /** Hit distance */
  distance: number;
}
