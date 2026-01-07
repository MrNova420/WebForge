/**
 * @fileoverview Particle emitter for spawning particles
 * @module particles/ParticleEmitter
 */

import { Vector3 } from '../math/Vector3';
import { Particle } from './Particle';

/**
 * Emitter shape type
 */
export type EmitterShape = 'point' | 'sphere' | 'box' | 'cone' | 'circle';

/**
 * Particle emission configuration
 */
export interface EmitterConfig {
    /** Emission rate (particles/second) */
    rate: number;
    
    /** Maximum number of particles */
    maxParticles: number;
    
    /** Emitter shape */
    shape: EmitterShape;
    
    /** Shape parameters */
    shapeParams: {
        radius?: number;
        width?: number;
        height?: number;
        depth?: number;
        angle?: number;
    };
    
    /** Particle lifetime range [min, max] */
    lifetime: [number, number];
    
    /** Initial velocity range */
    velocity: {
        min: Vector3;
        max: Vector3;
    };
    
    /** Particle size range [min, max] */
    size: [number, number];
    
    /** Whether emitter is looping */
    loop: boolean;
    
    /** Duration for non-looping emitters */
    duration?: number;
}

/**
 * Particle emitter for spawning particles
 * 
 * Features:
 * - Multiple emission shapes (point, sphere, box, cone, circle)
 * - Configurable emission rate
 * - Particle lifetime and velocity ranges
 * - Looping and burst modes
 * - Object pooling for performance
 * 
 * @example
 * ```typescript
 * const emitter = new ParticleEmitter({
 *   rate: 10,
 *   maxParticles: 100,
 *   shape: 'sphere',
 *   shapeParams: { radius: 1 },
 *   lifetime: [1, 2],
 *   velocity: { min: new Vector3(-1, 0, -1), max: new Vector3(1, 2, 1) },
 *   size: [0.5, 1.5],
 *   loop: true
 * });
 * ```
 */
export class ParticleEmitter {
    private config: EmitterConfig;
    private particles: Particle[] = [];
    private pool: Particle[] = [];
    private accumulator: number = 0;
    private elapsedTime: number = 0;
    private active: boolean = true;
    
    /** Emitter position in world space */
    public position: Vector3 = new Vector3();
    
    /**
     * Creates a new particle emitter
     * 
     * @param config - Emission configuration
     */
    constructor(config: EmitterConfig) {
        this.config = config;
        this.initializePool();
    }
    
    /**
     * Initializes particle pool
     */
    private initializePool(): void {
        for (let i = 0; i < this.config.maxParticles; i++) {
            this.pool.push(new Particle());
        }
    }
    
    /**
     * Gets a particle from pool or creates new one
     */
    private acquireParticle(): Particle | null {
        if (this.pool.length > 0) {
            return this.pool.pop()!;
        }
        return null;
    }
    
    /**
     * Returns particle to pool
     */
    private releaseParticle(particle: Particle): void {
        particle.reset();
        this.pool.push(particle);
    }
    
    /**
     * Generates random number between min and max
     */
    private random(min: number, max: number): number {
        return min + Math.random() * (max - min);
    }
    
    /**
     * Generates random position based on emitter shape
     */
    private randomPosition(): Vector3 {
        const pos = new Vector3();
        
        switch (this.config.shape) {
            case 'point':
                // No offset
                break;
                
            case 'sphere': {
                const radius = this.config.shapeParams.radius || 1;
                const theta = Math.random() * Math.PI * 2;
                const phi = Math.acos(2 * Math.random() - 1);
                const r = Math.random() * radius;
                
                pos.x = r * Math.sin(phi) * Math.cos(theta);
                pos.y = r * Math.sin(phi) * Math.sin(theta);
                pos.z = r * Math.cos(phi);
                break;
            }
                
            case 'box': {
                const w = this.config.shapeParams.width || 1;
                const h = this.config.shapeParams.height || 1;
                const d = this.config.shapeParams.depth || 1;
                
                pos.x = this.random(-w / 2, w / 2);
                pos.y = this.random(-h / 2, h / 2);
                pos.z = this.random(-d / 2, d / 2);
                break;
            }
                
            case 'cone': {
                const radius = this.config.shapeParams.radius || 1;
                const angle = (this.config.shapeParams.angle || 30) * (Math.PI / 180);
                const theta = Math.random() * Math.PI * 2;
                const r = Math.random() * radius;
                const height = r * Math.tan(angle);
                
                pos.x = r * Math.cos(theta);
                pos.y = height;
                pos.z = r * Math.sin(theta);
                break;
            }
                
            case 'circle': {
                const radius = this.config.shapeParams.radius || 1;
                const theta = Math.random() * Math.PI * 2;
                const r = Math.random() * radius;
                
                pos.x = r * Math.cos(theta);
                pos.y = 0;
                pos.z = r * Math.sin(theta);
                break;
            }
        }
        
        return pos;
    }
    
    /**
     * Emits a single particle
     */
    private emit(): void {
        const particle = this.acquireParticle();
        if (!particle) return;
        
        // Set position
        const offset = this.randomPosition();
        particle.position.copy(this.position);
        particle.position.add(offset);
        
        // Set velocity
        particle.velocity.x = this.random(this.config.velocity.min.x, this.config.velocity.max.x);
        particle.velocity.y = this.random(this.config.velocity.min.y, this.config.velocity.max.y);
        particle.velocity.z = this.random(this.config.velocity.min.z, this.config.velocity.max.z);
        
        // Set lifetime
        particle.lifetime = this.random(this.config.lifetime[0], this.config.lifetime[1]);
        
        // Set size
        particle.size = this.random(this.config.size[0], this.config.size[1]);
        
        // Reset age
        particle.age = 0;
        particle.alive = true;
        
        this.particles.push(particle);
    }
    
    /**
     * Updates emitter and all particles
     * 
     * @param deltaTime - Time step in seconds
     */
    public update(deltaTime: number): void {
        if (!this.active) return;
        
        this.elapsedTime += deltaTime;
        
        // Check duration for non-looping emitters
        if (!this.config.loop && this.config.duration) {
            if (this.elapsedTime >= this.config.duration) {
                this.active = false;
            }
        }
        
        // Emit new particles
        if (this.active) {
            this.accumulator += deltaTime * this.config.rate;
            const toEmit = Math.floor(this.accumulator);
            this.accumulator -= toEmit;
            
            for (let i = 0; i < toEmit; i++) {
                this.emit();
            }
        }
        
        // Update existing particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const particle = this.particles[i];
            particle.update(deltaTime);
            
            if (!particle.alive) {
                this.particles.splice(i, 1);
                this.releaseParticle(particle);
            }
        }
    }
    
    /**
     * Gets all active particles
     */
    public getParticles(): Particle[] {
        return this.particles;
    }
    
    /**
     * Gets number of active particles
     */
    public getParticleCount(): number {
        return this.particles.length;
    }
    
    /**
     * Stops emitting new particles
     */
    public stop(): void {
        this.active = false;
    }
    
    /**
     * Starts emitting particles
     */
    public start(): void {
        this.active = true;
        this.elapsedTime = 0;
    }
    
    /**
     * Clears all active particles
     */
    public clear(): void {
        for (const particle of this.particles) {
            this.releaseParticle(particle);
        }
        this.particles = [];
    }
    
    /**
     * Updates emitter configuration
     */
    public setConfig(config: Partial<EmitterConfig>): void {
        Object.assign(this.config, config);
    }
}
