/**
 * @module physics
 * @fileoverview Physics world managing simulation and rigid bodies
 */

import { Vector3 } from '../math/Vector3';
import { Logger } from '../core/Logger';

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
  private fixedStep(_dt: number): void {
    // TODO: Implement actual physics simulation
    // 1. Broadphase collision detection
    // 2. Narrowphase collision detection
    // 3. Contact generation
    // 4. Constraint solving
    // 5. Integration (apply forces, update velocities and positions)
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
   * Disposes the physics world
   */
  dispose(): void {
    this.clear();
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
