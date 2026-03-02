/**
 * @module physics
 * @fileoverview Soft body simulation using mass-spring systems
 * 
 * Position-Based Dynamics (PBD) approach for deformable objects,
 * cloth, and soft body physics.
 */

import { Vector3 } from '../math/Vector3';

/**
 * Particle in the soft body system
 */
export interface SoftBodyParticle {
  position: Vector3;
  previousPosition: Vector3;
  velocity: Vector3;
  inverseMass: number;
  /** Whether particle is pinned (immovable) */
  pinned: boolean;
}

/**
 * Distance constraint between two particles
 */
export interface SoftBodyDistanceConstraint {
  particleA: number;
  particleB: number;
  restLength: number;
  stiffness: number;
}

/**
 * Volume conservation constraint
 */
export interface VolumeConstraint {
  particles: number[];
  restVolume: number;
  stiffness: number;
}

/**
 * Soft body configuration
 */
export interface SoftBodyConfig {
  /** Solver iterations per step */
  iterations: number;
  /** Global damping factor (0-1) */
  damping: number;
  /** Constraint stiffness (0-1) */
  stiffness: number;
  /** Gravity vector */
  gravity: Vector3;
  /** Enable self-collision */
  selfCollision: boolean;
  /** Collision margin */
  collisionMargin: number;
}

/**
 * Soft body simulation using Position-Based Dynamics
 */
export class SoftBody {
  /** All particles */
  particles: SoftBodyParticle[] = [];
  /** Distance constraints */
  distanceConstraints: SoftBodyDistanceConstraint[] = [];
  /** Volume constraints */
  volumeConstraints: VolumeConstraint[] = [];
  /** Configuration */
  config: SoftBodyConfig;

  constructor(config?: Partial<SoftBodyConfig>) {
    this.config = {
      iterations: 4,
      damping: 0.99,
      stiffness: 0.8,
      gravity: new Vector3(0, -9.81, 0),
      selfCollision: false,
      collisionMargin: 0.01,
      ...config
    };
  }

  /**
   * Adds a particle to the simulation
   * @returns Particle index
   */
  addParticle(position: Vector3, mass: number = 1.0, pinned: boolean = false): number {
    const index = this.particles.length;
    this.particles.push({
      position: position.clone(),
      previousPosition: position.clone(),
      velocity: new Vector3(),
      inverseMass: pinned ? 0 : (mass > 0 ? 1 / mass : 0),
      pinned
    });
    return index;
  }

  /**
   * Adds a distance constraint between two particles
   */
  addDistanceConstraint(a: number, b: number, stiffness?: number): void {
    const restLength = this.particles[a].position.clone().subtract(this.particles[b].position).length();
    this.distanceConstraints.push({
      particleA: a,
      particleB: b,
      restLength,
      stiffness: stiffness ?? this.config.stiffness
    });
  }

  /**
   * Adds a volume constraint for a set of particles (tetrahedron)
   */
  addVolumeConstraint(particles: number[], stiffness?: number): void {
    const restVolume = this.computeVolume(particles);
    this.volumeConstraints.push({
      particles: [...particles],
      restVolume,
      stiffness: stiffness ?? this.config.stiffness
    });
  }

  /**
   * Pins a particle to its current position
   */
  pinParticle(index: number): void {
    if (index >= 0 && index < this.particles.length) {
      this.particles[index].pinned = true;
      this.particles[index].inverseMass = 0;
    }
  }

  /**
   * Unpins a particle
   */
  unpinParticle(index: number, mass: number = 1.0): void {
    if (index >= 0 && index < this.particles.length) {
      this.particles[index].pinned = false;
      this.particles[index].inverseMass = mass > 0 ? 1 / mass : 0;
    }
  }

  /**
   * Steps the simulation
   * @param dt - Delta time in seconds
   */
  update(dt: number): void {
    if (dt <= 0 || this.particles.length === 0) return;

    // Apply external forces (gravity) and predict positions
    for (const p of this.particles) {
      if (p.pinned) continue;

      p.velocity = p.velocity.add(this.config.gravity.clone().multiplyScalar(dt));
      p.velocity = p.velocity.multiplyScalar(this.config.damping);
      p.previousPosition = p.position.clone();
      p.position = p.position.add(p.velocity.clone().multiplyScalar(dt));
    }

    // Solve constraints iteratively
    for (let iter = 0; iter < this.config.iterations; iter++) {
      this.solveDistanceConstraints();
      this.solveVolumeConstraints();
      this.solveCollisionConstraints();
    }

    // Update velocities from position changes
    const invDt = dt > 0 ? 1 / dt : 0;
    for (const p of this.particles) {
      if (p.pinned) continue;
      p.velocity = p.position.clone().subtract(p.previousPosition).multiplyScalar(invDt);
    }
  }

  /**
   * Solves distance constraints (Jakobsen method)
   */
  private solveDistanceConstraints(): void {
    for (const c of this.distanceConstraints) {
      const pA = this.particles[c.particleA];
      const pB = this.particles[c.particleB];
      
      const delta = pB.position.clone().subtract(pA.position);
      const length = delta.length();
      if (length < 1e-3) continue;

      const diff = (length - c.restLength) / length;
      const totalInvMass = pA.inverseMass + pB.inverseMass;
      if (totalInvMass < 1e-3) continue;

      const correction = delta.clone().multiplyScalar(diff * c.stiffness / totalInvMass);
      
      if (!pA.pinned) {
        pA.position = pA.position.add(correction.clone().multiplyScalar(pA.inverseMass));
      }
      if (!pB.pinned) {
        pB.position = pB.position.subtract(correction.clone().multiplyScalar(pB.inverseMass));
      }
    }
  }

  /**
   * Solves volume constraints
   */
  private solveVolumeConstraints(): void {
    for (const c of this.volumeConstraints) {
      if (c.particles.length < 4) continue;
      
      const currentVolume = this.computeVolume(c.particles);
      if (Math.abs(c.restVolume) < 0.0001) continue;

      const safeVolume = Math.abs(currentVolume) < 1e-3 ? Math.sign(currentVolume || 1) * 1e-3 : currentVolume;
      const ratio = c.restVolume / safeVolume;
      const scale = (ratio - 1.0) * c.stiffness * 0.25;

      // Compute centroid
      const centroid = new Vector3();
      for (const idx of c.particles) {
        centroid.x += this.particles[idx].position.x;
        centroid.y += this.particles[idx].position.y;
        centroid.z += this.particles[idx].position.z;
      }
      centroid.x /= c.particles.length;
      centroid.y /= c.particles.length;
      centroid.z /= c.particles.length;

      // Push particles outward to restore volume
      for (const idx of c.particles) {
        const p = this.particles[idx];
        if (p.pinned) continue;
        
        const dir = p.position.clone().subtract(centroid);
        p.position = p.position.add(dir.clone().multiplyScalar(scale));
      }
    }
  }

  /**
   * Solves ground collision constraints
   */
  private solveCollisionConstraints(): void {
    for (const p of this.particles) {
      if (p.pinned) continue;

      // Ground plane collision at y=0
      if (p.position.y < this.config.collisionMargin) {
        p.position.y = this.config.collisionMargin;
      }
    }
  }

  /**
   * Computes volume of a set of particles (using centroid tetrahedralization)
   */
  private computeVolume(particleIndices: number[]): number {
    if (particleIndices.length < 4) return 0;

    // Compute centroid
    const centroid = new Vector3();
    for (const idx of particleIndices) {
      centroid.x += this.particles[idx].position.x;
      centroid.y += this.particles[idx].position.y;
      centroid.z += this.particles[idx].position.z;
    }
    centroid.x /= particleIndices.length;
    centroid.y /= particleIndices.length;
    centroid.z /= particleIndices.length;

    // Sum signed volumes of tetrahedra formed with centroid
    let volume = 0;
    for (let i = 0; i < particleIndices.length - 2; i += 3) {
      const a = this.particles[particleIndices[i]].position;
      const b = this.particles[particleIndices[i + 1]].position;
      const c = this.particles[particleIndices[i + 2]].position;

      // Tet volume = (1/6) * |det([a-d, b-d, c-d])|
      const ad = a.clone().subtract(centroid);
      const bd = b.clone().subtract(centroid);
      const cd = c.clone().subtract(centroid);
      
      volume += Math.abs(
        ad.x * (bd.y * cd.z - bd.z * cd.y) -
        ad.y * (bd.x * cd.z - bd.z * cd.x) +
        ad.z * (bd.x * cd.y - bd.y * cd.x)
      ) / 6;
    }

    return volume;
  }

  /**
   * Gets all particle positions as a flat array
   */
  getPositions(): Float32Array {
    const positions = new Float32Array(this.particles.length * 3);
    for (let i = 0; i < this.particles.length; i++) {
      positions[i * 3] = this.particles[i].position.x;
      positions[i * 3 + 1] = this.particles[i].position.y;
      positions[i * 3 + 2] = this.particles[i].position.z;
    }
    return positions;
  }

  /**
   * Gets the particle count
   */
  getParticleCount(): number {
    return this.particles.length;
  }

  /**
   * Creates a soft body cloth from a grid
   */
  static createCloth(width: number, height: number, segmentsX: number, segmentsY: number, mass: number = 1.0): SoftBody {
    const body = new SoftBody({ stiffness: 0.9, iterations: 8 });
    const particleMass = mass / ((segmentsX + 1) * (segmentsY + 1));
    const dx = width / segmentsX;
    const dy = height / segmentsY;

    // Create particles in a grid
    const indices: number[][] = [];
    for (let y = 0; y <= segmentsY; y++) {
      indices[y] = [];
      for (let x = 0; x <= segmentsX; x++) {
        const pos = new Vector3(x * dx - width / 2, 2, y * dy - height / 2);
        const idx = body.addParticle(pos, particleMass);
        indices[y][x] = idx;
      }
    }

    // Pin top row
    for (let x = 0; x <= segmentsX; x++) {
      body.pinParticle(indices[0][x]);
    }

    // Create structural constraints
    for (let y = 0; y <= segmentsY; y++) {
      for (let x = 0; x <= segmentsX; x++) {
        // Horizontal
        if (x < segmentsX) {
          body.addDistanceConstraint(indices[y][x], indices[y][x + 1]);
        }
        // Vertical
        if (y < segmentsY) {
          body.addDistanceConstraint(indices[y][x], indices[y + 1][x]);
        }
        // Shear diagonals
        if (x < segmentsX && y < segmentsY) {
          body.addDistanceConstraint(indices[y][x], indices[y + 1][x + 1]);
          body.addDistanceConstraint(indices[y + 1][x], indices[y][x + 1]);
        }
        // Bend constraints (skip one)
        if (x < segmentsX - 1) {
          body.addDistanceConstraint(indices[y][x], indices[y][x + 2], 0.5);
        }
        if (y < segmentsY - 1) {
          body.addDistanceConstraint(indices[y][x], indices[y + 2][x], 0.5);
        }
      }
    }

    return body;
  }

  /**
   * Creates a soft body sphere
   */
  static createSphere(radius: number, segments: number = 8, mass: number = 1.0): SoftBody {
    const body = new SoftBody({ stiffness: 0.7, iterations: 6 });
    const particleMass = mass / (segments * segments);
    const particleIndices: number[] = [];

    // Generate sphere particles
    for (let lat = 0; lat <= segments; lat++) {
      const theta = (lat / segments) * Math.PI;
      for (let lon = 0; lon < segments; lon++) {
        const phi = (lon / segments) * Math.PI * 2;
        const x = radius * Math.sin(theta) * Math.cos(phi);
        const y = radius * Math.cos(theta) + radius + 1;
        const z = radius * Math.sin(theta) * Math.sin(phi);
        const idx = body.addParticle(new Vector3(x, y, z), particleMass);
        particleIndices.push(idx);
      }
    }

    // Connect neighbors with distance constraints
    for (let lat = 0; lat <= segments; lat++) {
      for (let lon = 0; lon < segments; lon++) {
        const current = lat * segments + lon;
        const right = lat * segments + ((lon + 1) % segments);
        const below = (lat + 1) * segments + lon;

        if (current < particleIndices.length && right < particleIndices.length) {
          body.addDistanceConstraint(particleIndices[current], particleIndices[right]);
        }
        if (current < particleIndices.length && below < particleIndices.length) {
          body.addDistanceConstraint(particleIndices[current], particleIndices[below]);
        }
      }
    }

    // Add volume constraint
    if (particleIndices.length >= 4) {
      body.addVolumeConstraint(particleIndices, 0.5);
    }

    return body;
  }
}
