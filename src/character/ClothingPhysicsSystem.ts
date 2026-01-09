/**
 * WebForge Clothing Physics System
 * 
 * Phase 13-14 (Week 89-96): Character Tech
 * Real-time cloth simulation with collision detection and constraints.
 */

import { Vector3 } from '../math/Vector3';

/**
 * Cloth particle (vertex)
 */
interface ClothParticle {
    position: Vector3;
    previousPosition: Vector3;
    velocity: Vector3;
    mass: number;
    pinned: boolean;
}

/**
 * Cloth constraint (spring/distance)
 */
interface ClothConstraint {
    particleA: number;
    particleB: number;
    restLength: number;
    stiffness: number;
}

/**
 * Clothing Physics System - Part of Phase 13-14 Character Tech
 * Simulates cloth behavior using Verlet integration and constraints
 */
export class ClothingPhysicsSystem {
    private particles: ClothParticle[] = [];
    private constraints: ClothConstraint[] = [];
    private gravity: Vector3 = new Vector3(0, -9.81, 0);
    private damping: number = 0.99;
    private constraintIterations: number = 3;
    private wind: Vector3 = new Vector3(0, 0, 0);
    
    constructor(width: number, height: number, segments: number) {
        this.initializeCloth(width, height, segments);
    }
    
    /**
     * Initialize cloth grid
     */
    private initializeCloth(width: number, height: number, segments: number): void {
        const stepX = width / segments;
        const stepY = height / segments;
        
        // Create particles
        for (let y = 0; y <= segments; y++) {
            for (let x = 0; x <= segments; x++) {
                const pos = new Vector3(x * stepX, -y * stepY, 0);
                this.particles.push({
                    position: pos.clone(),
                    previousPosition: pos.clone(),
                    velocity: new Vector3(0, 0, 0),
                    mass: 1.0,
                    pinned: y === 0  // Pin top row
                });
            }
        }
        
        // Create structural constraints (grid)
        for (let y = 0; y <= segments; y++) {
            for (let x = 0; x <= segments; x++) {
                const idx = y * (segments + 1) + x;
                
                // Horizontal
                if (x < segments) {
                    const idxRight = idx + 1;
                    this.addConstraint(idx, idxRight, stepX, 0.9);
                }
                
                // Vertical
                if (y < segments) {
                    const idxDown = idx + (segments + 1);
                    this.addConstraint(idx, idxDown, stepY, 0.9);
                }
                
                // Diagonal (shear)
                if (x < segments && y < segments) {
                    const idxDiag = (y + 1) * (segments + 1) + (x + 1);
                    this.addConstraint(idx, idxDiag, Math.sqrt(stepX * stepX + stepY * stepY), 0.5);
                }
            }
        }
        
        // Add bending constraints (connect particles 2 steps apart)
        for (let y = 0; y <= segments; y++) {
            for (let x = 0; x <= segments; x++) {
                const idx = y * (segments + 1) + x;
                
                if (x < segments - 1) {
                    const idx2 = idx + 2;
                    this.addConstraint(idx, idx2, stepX * 2, 0.2);
                }
                
                if (y < segments - 1) {
                    const idx2 = idx + 2 * (segments + 1);
                    this.addConstraint(idx, idx2, stepY * 2, 0.2);
                }
            }
        }
    }
    
    /**
     * Add constraint between particles
     */
    private addConstraint(a: number, b: number, restLength: number, stiffness: number): void {
        this.constraints.push({ particleA: a, particleB: b, restLength, stiffness });
    }
    
    /**
     * Update cloth simulation
     */
    public update(deltaTime: number): void {
        const dt = Math.min(deltaTime, 0.016);  // Cap at 60 FPS
        
        // Verlet integration
        for (const particle of this.particles) {
            if (particle.pinned) continue;
            
            // Store current position
            const temp = particle.position.clone();
            
            // Calculate acceleration (forces / mass)
            const acceleration = this.gravity.clone()
                .add(this.wind.multiplyScalar(0.1))
                .multiplyScalar(dt * dt);
            
            // Verlet integration: x(t+dt) = 2*x(t) - x(t-dt) + a*dt^2
            particle.position = particle.position.multiplyScalar(2)
                .subtract(particle.previousPosition)
                .add(acceleration)
                .multiplyScalar(this.damping);
            
            particle.previousPosition = temp;
            
            // Calculate velocity for other systems
            particle.velocity = particle.position.subtract(particle.previousPosition).multiplyScalar(1 / dt);
        }
        
        // Satisfy constraints
        for (let iter = 0; iter < this.constraintIterations; iter++) {
            for (const constraint of this.constraints) {
                this.satisfyConstraint(constraint);
            }
        }
    }
    
    /**
     * Satisfy distance constraint
     */
    private satisfyConstraint(constraint: ClothConstraint): void {
        const pA = this.particles[constraint.particleA];
        const pB = this.particles[constraint.particleB];
        
        const delta = pB.position.subtract(pA.position);
        const currentLength = delta.length();
        
        if (currentLength < 0.0001) return;
        
        const diff = (currentLength - constraint.restLength) / currentLength;
        const offset = delta.multiplyScalar(diff * constraint.stiffness * 0.5);
        
        if (!pA.pinned) {
            pA.position = pA.position.add(offset);
        }
        
        if (!pB.pinned) {
            pB.position = pB.position.subtract(offset);
        }
    }
    
    /**
     * Apply sphere collision
     */
    public applySphereCollision(center: Vector3, radius: number): void {
        for (const particle of this.particles) {
            if (particle.pinned) continue;
            
            const delta = particle.position.subtract(center);
            const dist = delta.length();
            
            if (dist < radius) {
                // Push particle out of sphere
                const correction = delta.normalize().multiplyScalar(radius - dist);
                particle.position = particle.position.add(correction);
            }
        }
    }
    
    /**
     * Apply capsule collision (character limbs)
     */
    public applyCapsuleCollision(pointA: Vector3, pointB: Vector3, radius: number): void {
        for (const particle of this.particles) {
            if (particle.pinned) continue;
            
            // Find closest point on line segment
            const ab = pointB.subtract(pointA);
            const ap = particle.position.subtract(pointA);
            const t = Math.max(0, Math.min(1, ap.dot(ab) / ab.dot(ab)));
            const closest = pointA.add(ab.multiplyScalar(t));
            
            const delta = particle.position.subtract(closest);
            const dist = delta.length();
            
            if (dist < radius) {
                const correction = delta.normalize().multiplyScalar(radius - dist);
                particle.position = particle.position.add(correction);
            }
        }
    }
    
    /**
     * Set wind force
     */
    public setWind(wind: Vector3): void {
        this.wind = wind;
    }
    
    /**
     * Set gravity
     */
    public setGravity(gravity: Vector3): void {
        this.gravity = gravity;
    }
    
    /**
     * Set damping (0-1)
     */
    public setDamping(damping: number): void {
        this.damping = Math.max(0, Math.min(1, damping));
    }
    
    /**
     * Pin particle at index
     */
    public pinParticle(index: number, pinned: boolean = true): void {
        if (index >= 0 && index < this.particles.length) {
            this.particles[index].pinned = pinned;
        }
    }
    
    /**
     * Get particle positions for rendering
     */
    public getParticlePositions(): Vector3[] {
        return this.particles.map(p => p.position);
    }
    
    /**
     * Get particle count
     */
    public getParticleCount(): number {
        return this.particles.length;
    }
    
    /**
     * Reset cloth to initial state
     */
    public reset(): void {
        for (const particle of this.particles) {
            particle.velocity = new Vector3(0, 0, 0);
            particle.previousPosition = particle.position.clone();
        }
    }
}
