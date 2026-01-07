/**
 * @module physics
 * @fileoverview Constraint system for physics simulation
 */

import { Vector3 } from '../math/Vector3';
import { RigidBody } from './RigidBody';

/**
 * Base constraint interface
 */
export abstract class Constraint {
  bodyA: RigidBody;
  bodyB: RigidBody | null;
  
  /** Constraint breaking threshold */
  breakForce: number = Infinity;
  
  /** Whether constraint is enabled */
  enabled: boolean = true;

  constructor(bodyA: RigidBody, bodyB: RigidBody | null = null) {
    this.bodyA = bodyA;
    this.bodyB = bodyB;
  }

  /**
   * Solves the constraint
   * @param dt - Delta time
   */
  abstract solve(dt: number): void;

  /**
   * Checks if constraint should break
   * @param force - Applied force magnitude
   * @returns True if should break
   */
  shouldBreak(force: number): boolean {
    return force > this.breakForce;
  }
}

/**
 * Distance constraint - keeps bodies at fixed distance
 */
export class DistanceConstraint extends Constraint {
  /** Target distance */
  distance: number;
  
  /** Constraint stiffness (0-1) */
  stiffness: number;

  constructor(
    bodyA: RigidBody,
    bodyB: RigidBody,
    distance?: number,
    stiffness: number = 1.0
  ) {
    super(bodyA, bodyB);
    
    if (distance !== undefined) {
      this.distance = distance;
    } else {
      // Calculate initial distance
      const posA = bodyA.getPosition();
      const posB = bodyB.getPosition();
      this.distance = posA.clone().subtract(posB).length();
    }
    
    this.stiffness = Math.max(0, Math.min(1, stiffness));
  }

  solve(_dt: number): void {
    if (!this.enabled || !this.bodyB) return;

    const posA = this.bodyA.getPosition();
    const posB = this.bodyB.getPosition();
    
    const delta = posB.clone().subtract(posA);
    const currentDistance = delta.length();
    
    if (currentDistance === 0) return;
    
    const difference = currentDistance - this.distance;
    const direction = delta.clone().divideScalar(currentDistance);
    
    // Calculate correction
    const invMassA = this.bodyA.getInverseMass();
    const invMassB = this.bodyB.getInverseMass();
    const totalInvMass = invMassA + invMassB;
    
    if (totalInvMass === 0) return;
    
    const correction = direction.clone().multiplyScalar(
      difference * this.stiffness / totalInvMass
    );
    
    // Apply position correction
    if (invMassA > 0) {
      this.bodyA.setPosition(posA.add(correction.clone().multiplyScalar(invMassA)));
    }
    
    if (invMassB > 0) {
      this.bodyB.setPosition(posB.subtract(correction.clone().multiplyScalar(invMassB)));
    }
  }
}

/**
 * Hinge constraint - rotates around an axis
 */
export class HingeConstraint extends Constraint {
  /** Anchor point on body A (local space) */
  anchorA: Vector3;
  
  /** Anchor point on body B (local space) */
  anchorB: Vector3;
  
  /** Hinge axis (world space) */
  axis: Vector3;
  
  /** Minimum angle limit (radians) */
  minAngle: number;
  
  /** Maximum angle limit (radians) */
  maxAngle: number;

  constructor(
    bodyA: RigidBody,
    bodyB: RigidBody,
    anchorA: Vector3,
    anchorB: Vector3,
    axis: Vector3,
    minAngle: number = -Math.PI,
    maxAngle: number = Math.PI
  ) {
    super(bodyA, bodyB);
    this.anchorA = anchorA.clone();
    this.anchorB = anchorB.clone();
    this.axis = axis.clone().normalize();
    this.minAngle = minAngle;
    this.maxAngle = maxAngle;
  }

  solve(_dt: number): void {
    if (!this.enabled || !this.bodyB) return;

    // Get world space anchor points
    const posA = this.bodyA.getPosition();
    const posB = this.bodyB.getPosition();
    
    const worldAnchorA = posA.clone().add(this.anchorA);
    const worldAnchorB = posB.clone().add(this.anchorB);
    
    // Solve position constraint (keep anchors together)
    const delta = worldAnchorB.clone().subtract(worldAnchorA);
    const distance = delta.length();
    
    if (distance > 0.001) {
      const direction = delta.clone().divideScalar(distance);
      
      const invMassA = this.bodyA.getInverseMass();
      const invMassB = this.bodyB.getInverseMass();
      const totalInvMass = invMassA + invMassB;
      
      if (totalInvMass > 0) {
        const correction = direction.clone().multiplyScalar(distance / totalInvMass);
        
        if (invMassA > 0) {
          this.bodyA.setPosition(posA.add(correction.clone().multiplyScalar(invMassA)));
        }
        
        if (invMassB > 0) {
          this.bodyB.setPosition(posB.subtract(correction.clone().multiplyScalar(invMassB)));
        }
      }
    }
    
    // TODO: Solve angular constraint (limit rotation to axis)
  }
}

/**
 * Slider constraint - allows sliding along an axis
 */
export class SliderConstraint extends Constraint {
  /** Slider axis (world space) */
  axis: Vector3;
  
  /** Minimum distance */
  minDistance: number;
  
  /** Maximum distance */
  maxDistance: number;

  constructor(
    bodyA: RigidBody,
    bodyB: RigidBody,
    axis: Vector3,
    minDistance: number = -Infinity,
    maxDistance: number = Infinity
  ) {
    super(bodyA, bodyB);
    this.axis = axis.clone().normalize();
    this.minDistance = minDistance;
    this.maxDistance = maxDistance;
  }

  solve(_dt: number): void {
    if (!this.enabled || !this.bodyB) return;

    const posA = this.bodyA.getPosition();
    const posB = this.bodyB.getPosition();
    
    const delta = posB.clone().subtract(posA);
    const projectionLength = delta.dot(this.axis);
    
    // Clamp to limits
    let correction = 0;
    if (projectionLength < this.minDistance) {
      correction = this.minDistance - projectionLength;
    } else if (projectionLength > this.maxDistance) {
      correction = this.maxDistance - projectionLength;
    }
    
    if (Math.abs(correction) > 0.001) {
      const invMassA = this.bodyA.getInverseMass();
      const invMassB = this.bodyB.getInverseMass();
      const totalInvMass = invMassA + invMassB;
      
      if (totalInvMass > 0) {
        const correctionVec = this.axis.clone().multiplyScalar(correction / totalInvMass);
        
        if (invMassA > 0) {
          this.bodyA.setPosition(posA.add(correctionVec.clone().multiplyScalar(invMassA)));
        }
        
        if (invMassB > 0) {
          this.bodyB.setPosition(posB.subtract(correctionVec.clone().multiplyScalar(invMassB)));
        }
      }
    }
    
    // Constrain perpendicular motion
    const perpendicular = delta.clone().subtract(
      this.axis.clone().multiplyScalar(projectionLength)
    );
    
    const perpDistance = perpendicular.length();
    if (perpDistance > 0.001) {
      const invMassA = this.bodyA.getInverseMass();
      const invMassB = this.bodyB.getInverseMass();
      const totalInvMass = invMassA + invMassB;
      
      if (totalInvMass > 0) {
        const correctionVec = perpendicular.clone().divideScalar(perpDistance * totalInvMass);
        
        if (invMassA > 0) {
          this.bodyA.setPosition(posA.add(correctionVec.clone().multiplyScalar(invMassA)));
        }
        
        if (invMassB > 0) {
          this.bodyB.setPosition(posB.subtract(correctionVec.clone().multiplyScalar(invMassB)));
        }
      }
    }
  }
}

/**
 * Ball-socket (point-to-point) constraint
 */
export class BallSocketConstraint extends Constraint {
  /** Anchor point on body A (local space) */
  anchorA: Vector3;
  
  /** Anchor point on body B (local space) */
  anchorB: Vector3;

  constructor(
    bodyA: RigidBody,
    bodyB: RigidBody,
    anchorA: Vector3,
    anchorB: Vector3
  ) {
    super(bodyA, bodyB);
    this.anchorA = anchorA.clone();
    this.anchorB = anchorB.clone();
  }

  solve(_dt: number): void {
    if (!this.enabled || !this.bodyB) return;

    const posA = this.bodyA.getPosition();
    const posB = this.bodyB.getPosition();
    
    // World space anchors
    const worldAnchorA = posA.clone().add(this.anchorA);
    const worldAnchorB = posB.clone().add(this.anchorB);
    
    const delta = worldAnchorB.clone().subtract(worldAnchorA);
    const distance = delta.length();
    
    if (distance > 0.001) {
      const direction = delta.clone().divideScalar(distance);
      
      const invMassA = this.bodyA.getInverseMass();
      const invMassB = this.bodyB.getInverseMass();
      const totalInvMass = invMassA + invMassB;
      
      if (totalInvMass > 0) {
        const correction = direction.clone().multiplyScalar(distance / totalInvMass);
        
        if (invMassA > 0) {
          this.bodyA.setPosition(posA.add(correction.clone().multiplyScalar(invMassA)));
        }
        
        if (invMassB > 0) {
          this.bodyB.setPosition(posB.subtract(correction.clone().multiplyScalar(invMassB)));
        }
      }
    }
  }
}

/**
 * Spring constraint - elastic connection
 */
export class SpringConstraint extends Constraint {
  /** Rest length */
  restLength: number;
  
  /** Spring stiffness */
  stiffness: number;
  
  /** Damping coefficient */
  damping: number;

  constructor(
    bodyA: RigidBody,
    bodyB: RigidBody,
    restLength?: number,
    stiffness: number = 100.0,
    damping: number = 1.0
  ) {
    super(bodyA, bodyB);
    
    if (restLength !== undefined) {
      this.restLength = restLength;
    } else {
      // Calculate initial distance
      const posA = bodyA.getPosition();
      const posB = bodyB.getPosition();
      this.restLength = posA.clone().subtract(posB).length();
    }
    
    this.stiffness = stiffness;
    this.damping = damping;
  }

  solve(dt: number): void {
    if (!this.enabled || !this.bodyB) return;

    const posA = this.bodyA.getPosition();
    const posB = this.bodyB.getPosition();
    
    const delta = posB.clone().subtract(posA);
    const currentLength = delta.length();
    
    if (currentLength === 0) return;
    
    const direction = delta.clone().divideScalar(currentLength);
    
    // Spring force: F = -k * (x - x0)
    const displacement = currentLength - this.restLength;
    const springForce = -this.stiffness * displacement;
    
    // Damping force: F = -c * v
    const velA = this.bodyA.getVelocity();
    const velB = this.bodyB.getVelocity();
    const relativeVel = velB.clone().subtract(velA);
    const dampingForce = -this.damping * relativeVel.dot(direction);
    
    // Total force
    const totalForce = springForce + dampingForce;
    const force = direction.clone().multiplyScalar(totalForce * dt);
    
    // Apply forces
    if (this.bodyA.isDynamic()) {
      this.bodyA.applyImpulse(force.clone().multiplyScalar(-1));
    }
    
    if (this.bodyB.isDynamic()) {
      this.bodyB.applyImpulse(force);
    }
  }
}
