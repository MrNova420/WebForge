/**
 * @fileoverview Particle system with multiple emitters and forces
 * @module particles/ParticleSystem
 */

import { Vector3 } from '../math/Vector3';
import { Particle } from './Particle';
import { ParticleEmitter } from './ParticleEmitter';

/**
 * Force applied to particles
 */
export interface ParticleForce {
    /** Force name */
    name: string;
    
    /** Force function that modifies particle */
    apply: (particle: Particle, deltaTime: number) => void;
}

/**
 * Particle system managing multiple emitters and forces
 * 
 * Features:
 * - Multiple particle emitters
 * - Global and per-emitter forces
 * - Collision detection (optional)
 * - Sorting for transparency
 * - Performance statistics
 * 
 * @example
 * ```typescript
 * const system = new ParticleSystem();
 * 
 * // Add gravity
 * system.addForce({
 *   name: 'gravity',
 *   apply: (particle, dt) => {
 *     particle.acceleration.y = -9.81;
 *   }
 * });
 * 
 * // Add emitter
 * const emitter = new ParticleEmitter(config);
 * system.addEmitter('fire', emitter);
 * ```
 */
export class ParticleSystem {
    private emitters: Map<string, ParticleEmitter> = new Map();
    private forces: ParticleForce[] = [];
    private particleCount: number = 0;
    
    /**
     * Creates a new particle system
     */
    constructor() {}
    
    /**
     * Adds an emitter to the system
     * 
     * @param name - Emitter name
     * @param emitter - Particle emitter
     */
    public addEmitter(name: string, emitter: ParticleEmitter): void {
        this.emitters.set(name, emitter);
    }
    
    /**
     * Removes an emitter from the system
     * 
     * @param name - Emitter name
     */
    public removeEmitter(name: string): void {
        this.emitters.delete(name);
    }
    
    /**
     * Gets an emitter by name
     * 
     * @param name - Emitter name
     * @returns Emitter or undefined
     */
    public getEmitter(name: string): ParticleEmitter | undefined {
        return this.emitters.get(name);
    }
    
    /**
     * Adds a force to the system
     * 
     * @param force - Particle force
     */
    public addForce(force: ParticleForce): void {
        this.forces.push(force);
    }
    
    /**
     * Removes a force from the system
     * 
     * @param name - Force name
     */
    public removeForce(name: string): void {
        const index = this.forces.findIndex(f => f.name === name);
        if (index !== -1) {
            this.forces.splice(index, 1);
        }
    }
    
    /**
     * Updates all emitters and particles
     * 
     * @param deltaTime - Time step in seconds
     */
    public update(deltaTime: number): void {
        this.particleCount = 0;
        
        // Update all emitters
        for (const emitter of this.emitters.values()) {
            emitter.update(deltaTime);
            
            // Apply forces to particles
            const particles = emitter.getParticles();
            for (const particle of particles) {
                for (const force of this.forces) {
                    force.apply(particle, deltaTime);
                }
            }
            
            this.particleCount += particles.length;
        }
    }
    
    /**
     * Gets all active particles from all emitters
     */
    public getAllParticles(): Particle[] {
        const allParticles: Particle[] = [];
        
        for (const emitter of this.emitters.values()) {
            allParticles.push(...emitter.getParticles());
        }
        
        return allParticles;
    }
    
    /**
     * Sorts particles by distance from camera (for transparency)
     * 
     * @param cameraPosition - Camera world position
     */
    public sortParticles(cameraPosition: Vector3): void {
        const allParticles = this.getAllParticles();
        
        allParticles.sort((a, b) => {
            const distA = a.position.distanceTo(cameraPosition);
            const distB = b.position.distanceTo(cameraPosition);
            return distB - distA; // Far to near
        });
    }
    
    /**
     * Gets total number of active particles
     */
    public getParticleCount(): number {
        return this.particleCount;
    }
    
    /**
     * Gets number of emitters
     */
    public getEmitterCount(): number {
        return this.emitters.size;
    }
    
    /**
     * Clears all particles from all emitters
     */
    public clear(): void {
        for (const emitter of this.emitters.values()) {
            emitter.clear();
        }
    }
    
    /**
     * Stops all emitters
     */
    public stop(): void {
        for (const emitter of this.emitters.values()) {
            emitter.stop();
        }
    }
    
    /**
     * Starts all emitters
     */
    public start(): void {
        for (const emitter of this.emitters.values()) {
            emitter.start();
        }
    }
}

/**
 * Common particle forces
 */
export class ParticleForces {
    /**
     * Gravity force
     * 
     * @param strength - Gravity strength (default: -9.81)
     */
    public static gravity(strength: number = -9.81): ParticleForce {
        return {
            name: 'gravity',
            apply: (particle: Particle, _deltaTime: number) => {
                particle.acceleration.y = strength;
            }
        };
    }
    
    /**
     * Wind force
     * 
     * @param direction - Wind direction and strength
     */
    public static wind(direction: Vector3): ParticleForce {
        return {
            name: 'wind',
            apply: (particle: Particle, _deltaTime: number) => {
                particle.acceleration.add(direction);
            }
        };
    }
    
    /**
     * Drag force (air resistance)
     * 
     * @param coefficient - Drag coefficient (0-1)
     */
    public static drag(coefficient: number = 0.1): ParticleForce {
        return {
            name: 'drag',
            apply: (particle: Particle, _deltaTime: number) => {
                const drag = particle.velocity.clone().multiplyScalar(-coefficient);
                particle.acceleration.add(drag);
            }
        };
    }
    
    /**
     * Attractor force (pulls particles towards point)
     * 
     * @param position - Attractor position
     * @param strength - Attraction strength
     */
    public static attractor(position: Vector3, strength: number = 1.0): ParticleForce {
        return {
            name: 'attractor',
            apply: (particle: Particle, _deltaTime: number) => {
                const direction = position.clone().subtract(particle.position);
                const distance = direction.length();
                if (distance > 0.01) {
                    direction.normalize();
                    const force = direction.multiplyScalar(strength / (distance * distance));
                    particle.acceleration.add(force);
                }
            }
        };
    }
    
    /**
     * Vortex force (swirls particles around axis)
     * 
     * @param axis - Vortex axis (normalized)
     * @param position - Vortex center
     * @param strength - Vortex strength
     */
    public static vortex(axis: Vector3, position: Vector3, strength: number = 1.0): ParticleForce {
        return {
            name: 'vortex',
            apply: (particle: Particle, _deltaTime: number) => {
                const offset = particle.position.clone().subtract(position);
                const tangent = offset.cross(axis);
                tangent.normalize();
                particle.acceleration.add(tangent.multiplyScalar(strength));
            }
        };
    }
    
    /**
     * Color fade over lifetime
     * 
     * @param startColor - Start color (RGBA)
     * @param endColor - End color (RGBA)
     */
    public static colorOverLifetime(startColor: [number, number, number, number], endColor: [number, number, number, number]): ParticleForce {
        return {
            name: 'colorOverLifetime',
            apply: (particle: Particle, _deltaTime: number) => {
                const t = particle.getNormalizedAge();
                particle.color.x = startColor[0] + (endColor[0] - startColor[0]) * t;
                particle.color.y = startColor[1] + (endColor[1] - startColor[1]) * t;
                particle.color.z = startColor[2] + (endColor[2] - startColor[2]) * t;
                particle.color.w = startColor[3] + (endColor[3] - startColor[3]) * t;
            }
        };
    }
    
    /**
     * Size over lifetime
     * 
     * @param startSize - Start size
     * @param endSize - End size
     */
    public static sizeOverLifetime(startSize: number, endSize: number): ParticleForce {
        return {
            name: 'sizeOverLifetime',
            apply: (particle: Particle, _deltaTime: number) => {
                const t = particle.getNormalizedAge();
                particle.size = startSize + (endSize - startSize) * t;
            }
        };
    }
}
