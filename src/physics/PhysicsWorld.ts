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
   * @returns Raycast result or null
   */
  raycast(_origin: Vector3, _direction: Vector3, _maxDistance: number = Infinity): RaycastResult | null {
    // TODO: Implement raycast
    return null;
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
