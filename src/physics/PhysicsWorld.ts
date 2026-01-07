/**
 * @module physics
 * @fileoverview Physics world managing simulation and rigid bodies
 */

import { Vector3 } from '../math/Vector3';
import { Logger } from '../core/Logger';
import { Broadphase, SweepAndPruneBroadphase } from './BroadphaseCollision';
import { Narrowphase, ContactManifold } from './NarrowphaseCollision';

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
    this.resolveContacts();
    
    // 5. Integration (apply forces, update velocities and positions)
    for (const body of bodiesArray) {
      if (body.integrate) {
        body.integrate(dt);
      }
    }
  }

  /**
   * Resolves contact constraints
   */
  private resolveContacts(): void {
    for (const manifold of this.manifolds) {
      for (const contact of manifold.contacts) {
        const bodyA = manifold.bodyA;
        const bodyB = manifold.bodyB;
        
        if (!bodyA || !bodyB) continue;
        
        // Get properties
        const invMassA = bodyA.getInverseMass ? bodyA.getInverseMass() : 0;
        const invMassB = bodyB.getInverseMass ? bodyB.getInverseMass() : 0;
        
        if (invMassA === 0 && invMassB === 0) continue;
        
        // Position correction (push bodies apart)
        const correction = contact.normal.clone().multiplyScalar(
          contact.depth / (invMassA + invMassB)
        );
        
        if (bodyA.getPosition && bodyA.setPosition && invMassA > 0) {
          const posA = bodyA.getPosition();
          bodyA.setPosition(posA.subtract(correction.clone().multiplyScalar(invMassA)));
        }
        
        if (bodyB.getPosition && bodyB.setPosition && invMassB > 0) {
          const posB = bodyB.getPosition();
          bodyB.setPosition(posB.add(correction.clone().multiplyScalar(invMassB)));
        }
        
        // Velocity correction (impulse resolution)
        if (bodyA.getVelocity && bodyB.getVelocity) {
          const velA = bodyA.getVelocity();
          const velB = bodyB.getVelocity();
          const relativeVel = velB.clone().subtract(velA);
          const velAlongNormal = relativeVel.dot(contact.normal);
          
          // Only resolve if objects are moving towards each other
          if (velAlongNormal < 0) {
            const restitution = Math.min(
              bodyA.getRestitution ? bodyA.getRestitution() : 0.5,
              bodyB.getRestitution ? bodyB.getRestitution() : 0.5
            );
            
            const j = -(1 + restitution) * velAlongNormal / (invMassA + invMassB);
            const impulse = contact.normal.clone().multiplyScalar(j);
            
            if (bodyA.applyImpulse && invMassA > 0) {
              bodyA.applyImpulse(impulse.clone().multiplyScalar(-1));
            }
            
            if (bodyB.applyImpulse && invMassB > 0) {
              bodyB.applyImpulse(impulse);
            }
          }
        }
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
   * @returns Raycast result or null
   */
  raycast(_origin: Vector3, _direction: Vector3, _maxDistance: number = Infinity): RaycastResult | null {
    // TODO: Implement raycast
    return null;
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
  getCollisionStats(): { pairs: number; contacts: number } {
    return {
      pairs: this.manifolds.length,
      contacts: this.manifolds.reduce((sum, m) => sum + m.contacts.length, 0)
    };
  }

  /**
   * Disposes the physics world
   */
  dispose(): void {
    this.clear();
    this.broadphase.clear();
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
