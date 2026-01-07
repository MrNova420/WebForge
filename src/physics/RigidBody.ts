/**
 * @module physics
 * @fileoverview Rigid body for physics simulation
 */

import { Vector3 } from '../math/Vector3';
import { Quaternion } from '../math/Quaternion';
import { Matrix4 } from '../math/Matrix4';
import { CollisionShape } from './CollisionShape';

/**
 * Rigid body type
 */
export enum RigidBodyType {
  /** Static body (infinite mass, doesn't move) */
  STATIC = 'static',
  /** Dynamic body (finite mass, affected by forces) */
  DYNAMIC = 'dynamic',
  /** Kinematic body (moved by animation, not forces) */
  KINEMATIC = 'kinematic'
}

/**
 * Rigid body configuration
 */
export interface RigidBodyConfig {
  /** Body type */
  type?: RigidBodyType;
  /** Mass (kg) */
  mass?: number;
  /** Collision shape */
  shape?: CollisionShape;
  /** Linear velocity */
  velocity?: Vector3;
  /** Angular velocity */
  angularVelocity?: Vector3;
  /** Restitution (bounciness, 0-1) */
  restitution?: number;
  /** Friction coefficient */
  friction?: number;
  /** Linear damping */
  linearDamping?: number;
  /** Angular damping */
  angularDamping?: number;
  /** Lock rotation axes */
  lockRotation?: { x?: boolean; y?: boolean; z?: boolean };
}

/**
 * Rigid body for physics simulation
 */
export class RigidBody {
  private type: RigidBodyType;
  private mass: number;
  private inverseMass: number;
  
  // Collision shape
  shape?: CollisionShape;
  
  // Transform
  private position: Vector3;
  private rotation: Quaternion;
  private scale: Vector3;
  
  // Velocity
  private velocity: Vector3;
  private angularVelocity: Vector3;
  
  // Forces and torques
  private force: Vector3;
  private torque: Vector3;
  
  // Material properties
  private restitution: number;
  private friction: number;
  private linearDamping: number;
  private angularDamping: number;
  
  // Rotation locks
  private lockRotationX: boolean;
  private lockRotationY: boolean;
  private lockRotationZ: boolean;
  
  // State
  private sleeping: boolean;
  private sleepThreshold: number;

  /**
   * Creates a new rigid body
   * @param config - Rigid body configuration
   */
  constructor(config: RigidBodyConfig = {}) {
    this.type = config.type || RigidBodyType.DYNAMIC;
    this.mass = config.mass !== undefined ? config.mass : 1.0;
    this.inverseMass = this.mass > 0 ? 1.0 / this.mass : 0;
    
    // Shape
    this.shape = config.shape;
    
    // Transform
    this.position = new Vector3();
    this.rotation = new Quaternion();
    this.scale = new Vector3(1, 1, 1);
    
    // Velocity
    this.velocity = config.velocity ? config.velocity.clone() : new Vector3();
    this.angularVelocity = config.angularVelocity ? config.angularVelocity.clone() : new Vector3();
    
    // Forces
    this.force = new Vector3();
    this.torque = new Vector3();
    
    // Material
    this.restitution = config.restitution !== undefined ? config.restitution : 0.5;
    this.friction = config.friction !== undefined ? config.friction : 0.5;
    this.linearDamping = config.linearDamping !== undefined ? config.linearDamping : 0.01;
    this.angularDamping = config.angularDamping !== undefined ? config.angularDamping : 0.05;
    
    // Rotation locks
    this.lockRotationX = config.lockRotation?.x || false;
    this.lockRotationY = config.lockRotation?.y || false;
    this.lockRotationZ = config.lockRotation?.z || false;
    
    // State
    this.sleeping = false;
    this.sleepThreshold = 0.01;
    
    // Static bodies have infinite mass
    if (this.type === RigidBodyType.STATIC) {
      this.inverseMass = 0;
    }
  }

  /**
   * Applies a force to the body
   * @param force - Force vector
   * @param point - Optional point of application (world space)
   */
  applyForce(force: Vector3, point?: Vector3): void {
    if (this.type !== RigidBodyType.DYNAMIC) return;
    
    this.force.add(force);
    
    if (point) {
      // Apply torque from offset force
      const offset = point.clone().subtract(this.position);
      const torque = offset.cross(force);
      this.torque.add(torque);
    }
    
    this.wakeUp();
  }

  /**
   * Applies an impulse to the body
   * @param impulse - Impulse vector
   * @param point - Optional point of application (world space)
   */
  applyImpulse(impulse: Vector3, point?: Vector3): void {
    if (this.type !== RigidBodyType.DYNAMIC) return;
    
    this.velocity.add(impulse.clone().multiplyScalar(this.inverseMass));
    
    if (point) {
      // Apply angular impulse from offset
      const offset = point.clone().subtract(this.position);
      const angularImpulse = offset.cross(impulse);
      this.angularVelocity.add(angularImpulse.multiplyScalar(this.inverseMass));
    }
    
    this.wakeUp();
  }

  /**
   * Applies a torque to the body
   * @param torque - Torque vector
   */
  applyTorque(torque: Vector3): void {
    if (this.type !== RigidBodyType.DYNAMIC) return;
    
    this.torque.add(torque);
    this.wakeUp();
  }

  /**
   * Integrates the body forward in time
   * @param dt - Delta time
   */
  integrate(dt: number): void {
    if (this.type !== RigidBodyType.DYNAMIC || this.sleeping) {
      return;
    }
    
    // Apply forces to velocity
    this.velocity.add(this.force.clone().multiplyScalar(this.inverseMass * dt));
    
    // Apply damping
    this.velocity.multiplyScalar(1 - this.linearDamping);
    
    // Integrate position
    this.position.add(this.velocity.clone().multiplyScalar(dt));
    
    // Apply torques to angular velocity
    this.angularVelocity.add(this.torque.clone().multiplyScalar(this.inverseMass * dt));
    
    // Apply angular damping
    this.angularVelocity.multiplyScalar(1 - this.angularDamping);
    
    // Apply rotation locks
    if (this.lockRotationX) this.angularVelocity.x = 0;
    if (this.lockRotationY) this.angularVelocity.y = 0;
    if (this.lockRotationZ) this.angularVelocity.z = 0;
    
    // Integrate rotation
    if (this.angularVelocity.lengthSquared() > 0) {
      const angle = this.angularVelocity.length() * dt;
      const axis = this.angularVelocity.clone().normalize();
      const deltaRotation = Quaternion.fromAxisAngle(axis, angle);
      this.rotation.multiply(deltaRotation).normalize();
    }
    
    // Clear forces and torques
    this.force.set(0, 0, 0);
    this.torque.set(0, 0, 0);
    
    // Check for sleep
    this.updateSleeping();
  }

  /**
   * Updates sleeping state based on velocity
   */
  private updateSleeping(): void {
    const speed = this.velocity.length() + this.angularVelocity.length();
    if (speed < this.sleepThreshold) {
      this.sleeping = true;
    }
  }

  /**
   * Wakes up the body
   */
  wakeUp(): void {
    this.sleeping = false;
  }

  /**
   * Gets the transform matrix
   * @returns Transform matrix
   */
  getTransformMatrix(): Matrix4 {
    // Create transformation matrix from position, rotation, and scale  
    // Start with scale
    const matrix = Matrix4.scaling(this.scale);
    
    // Apply rotation
    const rotationMatrix = this.rotation.toMatrix4();
    matrix.multiply(rotationMatrix);
    
    // Apply translation
    const translationMatrix = Matrix4.translation(this.position);
    return translationMatrix.multiply(matrix);
  }

  /**
   * Sets the position
   * @param position - New position
   */
  setPosition(position: Vector3): void {
    this.position.copy(position);
  }

  /**
   * Gets the position
   * @returns Position
   */
  getPosition(): Vector3 {
    return this.position.clone();
  }

  /**
   * Sets the rotation
   * @param rotation - New rotation
   */
  setRotation(rotation: Quaternion): void {
    this.rotation.copy(rotation);
  }

  /**
   * Gets the rotation
   * @returns Rotation quaternion
   */
  getRotation(): Quaternion {
    return this.rotation.clone();
  }

  /**
   * Sets the velocity
   * @param velocity - New velocity
   */
  setVelocity(velocity: Vector3): void {
    this.velocity.copy(velocity);
    this.wakeUp();
  }

  /**
   * Gets the velocity
   * @returns Velocity
   */
  getVelocity(): Vector3 {
    return this.velocity.clone();
  }

  /**
   * Sets the angular velocity
   * @param angularVelocity - New angular velocity
   */
  setAngularVelocity(angularVelocity: Vector3): void {
    this.angularVelocity.copy(angularVelocity);
    this.wakeUp();
  }

  /**
   * Gets the angular velocity
   * @returns Angular velocity
   */
  getAngularVelocity(): Vector3 {
    return this.angularVelocity.clone();
  }

  /**
   * Gets the mass
   * @returns Mass
   */
  getMass(): number {
    return this.mass;
  }

  /**
   * Gets the inverse mass
   * @returns Inverse mass
   */
  getInverseMass(): number {
    return this.inverseMass;
  }

  /**
   * Gets the body type
   * @returns Body type
   */
  getType(): RigidBodyType {
    return this.type;
  }

  /**
   * Sets the body type
   * @param type - New body type
   */
  setType(type: RigidBodyType): void {
    this.type = type;
    if (type === RigidBodyType.STATIC) {
      this.inverseMass = 0;
      this.velocity.set(0, 0, 0);
      this.angularVelocity.set(0, 0, 0);
    } else {
      this.inverseMass = this.mass > 0 ? 1.0 / this.mass : 0;
    }
  }

  /**
   * Gets the restitution
   * @returns Restitution coefficient
   */
  getRestitution(): number {
    return this.restitution;
  }

  /**
   * Gets the friction
   * @returns Friction coefficient
   */
  getFriction(): number {
    return this.friction;
  }

  /**
   * Checks if the body is sleeping
   * @returns True if sleeping
   */
  isSleeping(): boolean {
    return this.sleeping;
  }

  /**
   * Checks if the body is dynamic
   * @returns True if dynamic
   */
  isDynamic(): boolean {
    return this.type === RigidBodyType.DYNAMIC;
  }

  /**
   * Checks if the body is static
   * @returns True if static
   */
  isStatic(): boolean {
    return this.type === RigidBodyType.STATIC;
  }

  /**
   * Checks if the body is kinematic
   * @returns True if kinematic
   */
  isKinematic(): boolean {
    return this.type === RigidBodyType.KINEMATIC;
  }
}
