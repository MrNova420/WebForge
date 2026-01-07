/**
 * @module physics
 * @fileoverview Sequential impulse constraint solver
 */

import { Constraint } from './Constraint';
import { ContactManifold, ContactPoint } from './NarrowphaseCollision';
import { Vector3 } from '../math/Vector3';

/**
 * Contact constraint for collision resolution
 */
class ContactConstraint {
  bodyA: any;
  bodyB: any;
  contact: ContactPoint;
  
  constructor(bodyA: any, bodyB: any, contact: ContactPoint) {
    this.bodyA = bodyA;
    this.bodyB = bodyB;
    this.contact = contact;
  }
  
  solve(): void {
    const invMassA = this.bodyA.getInverseMass ? this.bodyA.getInverseMass() : 0;
    const invMassB = this.bodyB.getInverseMass ? this.bodyB.getInverseMass() : 0;
    
    if (invMassA === 0 && invMassB === 0) return;
    
    // Position correction
    const correction = this.contact.normal.clone().multiplyScalar(
      this.contact.depth / (invMassA + invMassB)
    );
    
    if (this.bodyA.getPosition && this.bodyA.setPosition && invMassA > 0) {
      const posA = this.bodyA.getPosition();
      this.bodyA.setPosition(posA.subtract(correction.clone().multiplyScalar(invMassA)));
    }
    
    if (this.bodyB.getPosition && this.bodyB.setPosition && invMassB > 0) {
      const posB = this.bodyB.getPosition();
      this.bodyB.setPosition(posB.add(correction.clone().multiplyScalar(invMassB)));
    }
    
    // Velocity correction
    if (this.bodyA.getVelocity && this.bodyB.getVelocity) {
      const velA = this.bodyA.getVelocity();
      const velB = this.bodyB.getVelocity();
      const relativeVel = velB.clone().subtract(velA);
      const velAlongNormal = relativeVel.dot(this.contact.normal);
      
      if (velAlongNormal < 0) {
        const restitution = Math.min(
          this.bodyA.getRestitution ? this.bodyA.getRestitution() : 0.5,
          this.bodyB.getRestitution ? this.bodyB.getRestitution() : 0.5
        );
        
        const j = -(1 + restitution) * velAlongNormal / (invMassA + invMassB);
        const impulse = this.contact.normal.clone().multiplyScalar(j);
        
        if (this.bodyA.applyImpulse && invMassA > 0) {
          this.bodyA.applyImpulse(impulse.clone().multiplyScalar(-1));
        }
        
        if (this.bodyB.applyImpulse && invMassB > 0) {
          this.bodyB.applyImpulse(impulse);
        }
        
        // Friction
        this.solveFriction(relativeVel, velAlongNormal, invMassA, invMassB);
      }
    }
  }
  
  private solveFriction(relativeVel: Vector3, velAlongNormal: number, invMassA: number, invMassB: number): void {
    // Tangent velocity (perpendicular to normal)
    const tangent = relativeVel.clone().subtract(
      this.contact.normal.clone().multiplyScalar(velAlongNormal)
    );
    
    const tangentLength = tangent.length();
    if (tangentLength < 0.001) return;
    
    tangent.divideScalar(tangentLength);
    
    // Friction coefficient
    const friction = Math.sqrt(
      (this.bodyA.getFriction ? this.bodyA.getFriction() : 0.5) *
      (this.bodyB.getFriction ? this.bodyB.getFriction() : 0.5)
    );
    
    // Friction impulse
    const jt = -tangentLength / (invMassA + invMassB);
    const frictionImpulse = tangent.clone().multiplyScalar(jt * friction);
    
    if (this.bodyA.applyImpulse && invMassA > 0) {
      this.bodyA.applyImpulse(frictionImpulse.clone().multiplyScalar(-1));
    }
    
    if (this.bodyB.applyImpulse && invMassB > 0) {
      this.bodyB.applyImpulse(frictionImpulse);
    }
  }
}

/**
 * Sequential impulse constraint solver
 */
export class ConstraintSolver {
  private constraints: Constraint[] = [];
  private contactConstraints: ContactConstraint[] = [];
  
  /** Number of solver iterations */
  iterations: number = 10;
  
  /** Positional correction bias */
  baumgarte: number = 0.2;

  /**
   * Adds a constraint
   * @param constraint - Constraint to add
   */
  addConstraint(constraint: Constraint): void {
    this.constraints.push(constraint);
  }

  /**
   * Removes a constraint
   * @param constraint - Constraint to remove
   */
  removeConstraint(constraint: Constraint): void {
    const index = this.constraints.indexOf(constraint);
    if (index !== -1) {
      this.constraints.splice(index, 1);
    }
  }

  /**
   * Clears all constraints
   */
  clear(): void {
    this.constraints = [];
    this.contactConstraints = [];
  }

  /**
   * Prepares contact constraints from manifolds
   * @param manifolds - Contact manifolds
   */
  prepareContacts(manifolds: ContactManifold[]): void {
    this.contactConstraints = [];
    
    for (const manifold of manifolds) {
      for (const contact of manifold.contacts) {
        this.contactConstraints.push(
          new ContactConstraint(manifold.bodyA, manifold.bodyB, contact)
        );
      }
    }
  }

  /**
   * Solves all constraints
   * @param dt - Delta time
   */
  solve(dt: number): void {
    // Solve user-defined constraints
    for (let iter = 0; iter < this.iterations; iter++) {
      for (const constraint of this.constraints) {
        if (constraint.enabled) {
          constraint.solve(dt);
        }
      }
    }
    
    // Solve contact constraints
    for (let iter = 0; iter < this.iterations; iter++) {
      for (const contact of this.contactConstraints) {
        contact.solve();
      }
    }
    
    // Remove broken constraints
    this.constraints = this.constraints.filter(c => c.enabled);
  }

  /**
   * Gets all constraints
   * @returns Array of constraints
   */
  getConstraints(): Constraint[] {
    return this.constraints;
  }

  /**
   * Gets constraint count
   * @returns Number of constraints
   */
  getConstraintCount(): number {
    return this.constraints.length;
  }

  /**
   * Gets contact constraint count
   * @returns Number of contact constraints
   */
  getContactConstraintCount(): number {
    return this.contactConstraints.length;
  }
}
