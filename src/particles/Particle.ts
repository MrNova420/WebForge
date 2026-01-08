/**
 * @fileoverview Single particle data structure
 * @module particles/Particle
 */

import { Vector3 } from '../math/Vector3';
import { Vector4 } from '../math/Vector4';

/**
 * Individual particle in a particle system
 * 
 * Features:
 * - Position, velocity, acceleration
 * - Lifetime management
 * - Color, size, rotation animation
 * - Custom user data support
 * 
 * @example
 * ```typescript
 * const particle = new Particle();
 * particle.position.set(0, 0, 0);
 * particle.velocity.set(0, 1, 0);
 * particle.lifetime = 2.0;
 * ```
 */
export class Particle {
    /** Particle position in world space */
    public position: Vector3 = new Vector3();
    
    /** Particle velocity (units/second) */
    public velocity: Vector3 = new Vector3();
    
    /** Particle acceleration (units/second²) */
    public acceleration: Vector3 = new Vector3();
    
    /** Particle color (RGBA, 0-1 range) */
    public color: Vector4 = new Vector4(1, 1, 1, 1);
    
    /** Particle size */
    public size: number = 1.0;
    
    /** Particle rotation (radians) */
    public rotation: number = 0;
    
    /** Particle angular velocity (radians/second) */
    public angularVelocity: number = 0;
    
    /** Total lifetime (seconds) */
    public lifetime: number = 1.0;
    
    /** Current age (seconds) */
    public age: number = 0;
    
    /** Whether particle is alive */
    public alive: boolean = true;
    
    /** Custom user data */
    public userData: any = null;
    
    /**
     * Creates a new particle
     */
    constructor() {}
    
    /**
     * Updates particle state
     * 
     * @param deltaTime - Time step in seconds
     */
    public update(deltaTime: number): void {
        if (!this.alive) return;
        
        // Update age
        this.age += deltaTime;
        if (this.age >= this.lifetime) {
            this.alive = false;
            return;
        }
        
        // Update velocity from acceleration
        this.velocity.x += this.acceleration.x * deltaTime;
        this.velocity.y += this.acceleration.y * deltaTime;
        this.velocity.z += this.acceleration.z * deltaTime;
        
        // Update position from velocity
        this.position.x += this.velocity.x * deltaTime;
        this.position.y += this.velocity.y * deltaTime;
        this.position.z += this.velocity.z * deltaTime;
        
        // Update rotation
        this.rotation += this.angularVelocity * deltaTime;
    }
    
    /**
     * Gets normalized age (0-1)
     */
    public getNormalizedAge(): number {
        return this.age / this.lifetime;
    }
    
    /**
     * Resets particle to initial state
     */
    public reset(): void {
        this.position.set(0, 0, 0);
        this.velocity.set(0, 0, 0);
        this.acceleration.set(0, 0, 0);
        this.color.set(1, 1, 1, 1);
        this.size = 1.0;
        this.rotation = 0;
        this.angularVelocity = 0;
        this.lifetime = 1.0;
        this.age = 0;
        this.alive = true;
        this.userData = null;
    }
    
    /**
     * Clones the particle
     */
    public clone(): Particle {
        const clone = new Particle();
        clone.position.copy(this.position);
        clone.velocity.copy(this.velocity);
        clone.acceleration.copy(this.acceleration);
        clone.color.copy(this.color);
        clone.size = this.size;
        clone.rotation = this.rotation;
        clone.angularVelocity = this.angularVelocity;
        clone.lifetime = this.lifetime;
        clone.age = this.age;
        clone.alive = this.alive;
        clone.userData = this.userData;
        return clone;
    }
}
