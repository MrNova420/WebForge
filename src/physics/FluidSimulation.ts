/**
 * @module physics
 * @fileoverview SPH (Smoothed Particle Hydrodynamics) fluid simulation
 *
 * Implements a complete SPH fluid solver with Poly6, Spiky, and Viscosity
 * kernels for real-time fluid dynamics in the WebForge engine.
 */

import { Vector3 } from '../math/Vector3';
import { Logger } from '../core/Logger';
import { EventSystem } from '../core/EventSystem';

/**
 * Configuration for the SPH fluid simulation
 */
export interface FluidConfig {
  /** Radius of each fluid particle for rendering */
  particleRadius: number;
  /** Rest density of the fluid (kg/m³) */
  restDensity: number;
  /** Gas stiffness constant for pressure computation */
  gasStiffness: number;
  /** Viscosity coefficient */
  viscosity: number;
  /** Gravity vector */
  gravity: Vector3;
  /** Simulation time step (seconds) */
  timeStep: number;
  /** Smoothing kernel radius (support radius h) */
  kernelRadius: number;
  /** Damping factor when particles hit boundaries (0-1) */
  boundaryDamping: number;
  /** Maximum number of particles allowed */
  maxParticles: number;
}

/**
 * A single SPH fluid particle
 */
export interface FluidParticle {
  /** World-space position */
  position: Vector3;
  /** Velocity */
  velocity: Vector3;
  /** Accumulated acceleration for current step */
  acceleration: Vector3;
  /** Computed density at this particle's location */
  density: number;
  /** Computed pressure at this particle's location */
  pressure: number;
  /** Accumulated force for current step */
  force: Vector3;
  /** Particle mass */
  mass: number;
  /** Unique identifier */
  id: number;
}

/**
 * Statistics about the current simulation state
 */
export interface FluidStats {
  particleCount: number;
  averageDensity: number;
  averageVelocity: number;
  maxVelocity: number;
  maxDensity: number;
  kineticEnergy: number;
}

/**
 * Spatial hash grid for O(1) average-case neighbor lookups.
 * Divides space into uniform cells whose size matches the kernel radius.
 */
export class SpatialHashGrid {
  private _inverseCellSize: number;
  private _cells: Map<number, number[]>;

  constructor(cellSize: number) {
    this._inverseCellSize = 1 / cellSize;
    this._cells = new Map();
  }

  /**
   * Hashes a cell coordinate triplet into a single integer key.
   */
  private _hash(cx: number, cy: number, cz: number): number {
    // Large primes for spatial hashing to reduce collisions
    return ((cx * 73856093) ^ (cy * 19349663) ^ (cz * 83492791)) | 0;
  }

  /**
   * Inserts a particle index at the given world-space position.
   * @param index - Particle index
   * @param x - World X coordinate
   * @param y - World Y coordinate
   * @param z - World Z coordinate
   */
  insert(index: number, x: number, y: number, z: number): void {
    const cx = Math.floor(x * this._inverseCellSize);
    const cy = Math.floor(y * this._inverseCellSize);
    const cz = Math.floor(z * this._inverseCellSize);
    const key = this._hash(cx, cy, cz);
    const bucket = this._cells.get(key);
    if (bucket) {
      bucket.push(index);
    } else {
      this._cells.set(key, [index]);
    }
  }

  /**
   * Returns indices of all particles in neighboring cells (3×3×3 block).
   * @param x - World X coordinate
   * @param y - World Y coordinate
   * @param z - World Z coordinate
   * @param _radius - Unused (kept for API compatibility with tests)
   */
  query(x: number, y: number, z: number, _radius?: number): number[] {
    const cx = Math.floor(x * this._inverseCellSize);
    const cy = Math.floor(y * this._inverseCellSize);
    const cz = Math.floor(z * this._inverseCellSize);
    const result: number[] = [];

    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dz = -1; dz <= 1; dz++) {
          const key = this._hash(cx + dx, cy + dy, cz + dz);
          const bucket = this._cells.get(key);
          if (bucket) {
            for (let i = 0; i < bucket.length; i++) {
              result.push(bucket[i]);
            }
          }
        }
      }
    }

    return result;
  }

  /**
   * Removes all entries from the grid.
   */
  clear(): void {
    this._cells.clear();
  }
}

// ---------------------------------------------------------------------------
// SPH Kernel functions
// All kernels use the standard formulations with support radius h.
// ---------------------------------------------------------------------------

const PI = Math.PI;

/**
 * Poly6 kernel — used for density estimation.
 * W_poly6(r, h) = 315 / (64 π h⁹) · (h² - r²)³   for 0 ≤ r ≤ h
 */
function poly6(rSq: number, h: number, h9: number): number {
  const hSq = h * h;
  if (rSq >= hSq) return 0;
  const diff = hSq - rSq;
  return (315 / (64 * PI * h9)) * diff * diff * diff;
}

/**
 * Spiky kernel gradient magnitude — used for pressure forces.
 * ∇W_spiky(r, h) = -45 / (π h⁶) · (h - r)²  (directed along r̂)
 * Returns the scalar coefficient; caller multiplies by direction.
 */
function spikyGrad(r: number, h: number, h6: number): number {
  if (r >= h || r < 1e-10) return 0;
  const diff = h - r;
  return (-45 / (PI * h6)) * diff * diff;
}

/**
 * Viscosity kernel laplacian — used for viscosity forces.
 * ∇²W_visc(r, h) = 45 / (π h⁶) · (h - r)
 */
function viscosityLaplacian(r: number, h: number, h6: number): number {
  if (r >= h) return 0;
  return (45 / (PI * h6)) * (h - r);
}

/**
 * SPH Fluid Simulation
 *
 * Full SPH loop per frame:
 *  1. Build spatial hash grid
 *  2. Compute density and pressure for each particle
 *  3. Compute pressure forces (Spiky kernel gradient)
 *  4. Compute viscosity forces (Viscosity kernel laplacian)
 *  5. Apply gravity
 *  6. Enforce boundary conditions
 *  7. Symplectic Euler integration
 */
export class FluidSimulation {
  private _particles: FluidParticle[] = [];
  private _config: FluidConfig;
  private _grid: SpatialHashGrid;
  private _nextId: number = 0;
  private _logger: Logger;
  private _events: EventSystem;

  // Precomputed kernel constants
  private _h6: number;
  private _h9: number;

  // Boundary box (axis-aligned)
  private _boundaryMin: Vector3;
  private _boundaryMax: Vector3;

  constructor(config?: Partial<FluidConfig>, events?: EventSystem) {
    this._config = {
      particleRadius: 0.05,
      restDensity: 1000,
      gasStiffness: 2000,
      viscosity: 3.5,
      gravity: new Vector3(0, -9.81, 0),
      timeStep: 0.0008,
      kernelRadius: 0.2,
      boundaryDamping: 0.3,
      maxParticles: 10000,
      ...config
    };

    this._grid = new SpatialHashGrid(this._config.kernelRadius);
    this._logger = new Logger('FluidSimulation');
    this._events = events ?? new EventSystem();

    const h = this._config.kernelRadius;
    this._h6 = h * h * h * h * h * h;
    this._h9 = this._h6 * h * h * h;

    this._boundaryMin = new Vector3(-2, 0, -2);
    this._boundaryMax = new Vector3(2, 4, 2);

    this._logger.info(
      `Fluid simulation created (kernel h=${h}, rest density=${this._config.restDensity})`
    );
  }

  // ----- Particle management ------------------------------------------------

  /**
   * Adds a single particle at the given position.
   * @returns The new particle's id, or -1 if the limit is reached.
   */
  addParticle(position: Vector3): number {
    if (this._particles.length >= this._config.maxParticles) {
      this._logger.warn('Maximum particle count reached');
      return -1;
    }

    const id = this._nextId++;
    const particle: FluidParticle = {
      position: position.clone(),
      velocity: new Vector3(),
      acceleration: new Vector3(),
      density: this._config.restDensity,
      pressure: 0,
      force: new Vector3(),
      mass: 1.0,
      id
    };

    this._particles.push(particle);
    this._events.emit('fluid:particle-added', { id, position: position.clone() });
    return id;
  }

  /**
   * Removes a particle by id.
   * @returns True if found and removed.
   */
  removeParticle(id: number): boolean {
    const idx = this._particles.findIndex(p => p.id === id);
    if (idx === -1) return false;

    this._particles.splice(idx, 1);
    this._events.emit('fluid:particle-removed', { id });
    return true;
  }

  // ----- Simulation step ----------------------------------------------------

  /**
   * Advances the simulation by dt seconds (may sub-step internally).
   */
  update(dt: number): void {
    if (dt <= 0 || this._particles.length === 0) return;

    const step = this._config.timeStep;
    let remaining = dt;
    while (remaining > 0) {
      const subDt = Math.min(remaining, step);
      this._step(subDt);
      remaining -= subDt;
    }

    this._events.emit('fluid:updated', { particleCount: this._particles.length });
  }

  /**
   * Performs one full SPH sub-step.
   */
  private _step(dt: number): void {
    const particles = this._particles;
    const count = particles.length;
    const h = this._config.kernelRadius;
    const hSq = h * h;

    // 1. Build spatial hash grid
    this._grid.clear();
    for (let i = 0; i < count; i++) {
      const pos = particles[i].position;
      this._grid.insert(i, pos.x, pos.y, pos.z);
    }

    // 2. Compute density and pressure
    for (let i = 0; i < count; i++) {
      const pi = particles[i];
      let density = 0;
      const neighbors = this._grid.query(pi.position.x, pi.position.y, pi.position.z);

      for (let n = 0; n < neighbors.length; n++) {
        const pj = particles[neighbors[n]];
        const dx = pi.position.x - pj.position.x;
        const dy = pi.position.y - pj.position.y;
        const dz = pi.position.z - pj.position.z;
        const rSq = dx * dx + dy * dy + dz * dz;
        density += pj.mass * poly6(rSq, h, this._h9);
      }

      // Clamp density to avoid division by zero
      pi.density = Math.max(density, 1e-6);
      // Equation of state (ideal gas)
      pi.pressure = this._config.gasStiffness * (pi.density - this._config.restDensity);
    }

    // 3 & 4. Compute pressure and viscosity forces
    const viscosity = this._config.viscosity;
    for (let i = 0; i < count; i++) {
      const pi = particles[i];
      let fx = 0, fy = 0, fz = 0;
      const neighbors = this._grid.query(pi.position.x, pi.position.y, pi.position.z);

      for (let n = 0; n < neighbors.length; n++) {
        const j = neighbors[n];
        if (j === i) continue;
        const pj = particles[j];

        const dx = pi.position.x - pj.position.x;
        const dy = pi.position.y - pj.position.y;
        const dz = pi.position.z - pj.position.z;
        const rSq = dx * dx + dy * dy + dz * dz;
        if (rSq >= hSq || rSq < 1e-12) continue;

        const r = Math.sqrt(rSq);

        // --- Pressure force (Spiky kernel gradient) ---
        const pressureCoeff =
          -pj.mass *
          (pi.pressure + pj.pressure) /
          (2 * pj.density) *
          spikyGrad(r, h, this._h6);

        const invR = 1 / r;
        fx += pressureCoeff * dx * invR;
        fy += pressureCoeff * dy * invR;
        fz += pressureCoeff * dz * invR;

        // --- Viscosity force (Viscosity kernel laplacian) ---
        const viscCoeff =
          viscosity *
          pj.mass *
          viscosityLaplacian(r, h, this._h6) /
          pj.density;

        fx += viscCoeff * (pj.velocity.x - pi.velocity.x);
        fy += viscCoeff * (pj.velocity.y - pi.velocity.y);
        fz += viscCoeff * (pj.velocity.z - pi.velocity.z);
      }

      pi.force.set(fx, fy, fz);
    }

    // 5. Apply gravity
    const gx = this._config.gravity.x;
    const gy = this._config.gravity.y;
    const gz = this._config.gravity.z;

    // 6 & 7. Integration (Symplectic Euler) + boundary enforcement
    const damping = this._config.boundaryDamping;
    const bMin = this._boundaryMin;
    const bMax = this._boundaryMax;

    for (let i = 0; i < count; i++) {
      const p = particles[i];

      // Acceleration = force / density + gravity
      const invDensity = 1 / p.density;
      const ax = p.force.x * invDensity + gx;
      const ay = p.force.y * invDensity + gy;
      const az = p.force.z * invDensity + gz;

      p.acceleration.set(ax, ay, az);

      // Update velocity
      p.velocity.set(
        p.velocity.x + ax * dt,
        p.velocity.y + ay * dt,
        p.velocity.z + az * dt
      );

      // Update position
      p.position.set(
        p.position.x + p.velocity.x * dt,
        p.position.y + p.velocity.y * dt,
        p.position.z + p.velocity.z * dt
      );

      // Boundary enforcement (reflect velocity and clamp position)
      if (p.position.x < bMin.x) {
        p.position.x = bMin.x;
        p.velocity.x *= -damping;
      } else if (p.position.x > bMax.x) {
        p.position.x = bMax.x;
        p.velocity.x *= -damping;
      }

      if (p.position.y < bMin.y) {
        p.position.y = bMin.y;
        p.velocity.y *= -damping;
      } else if (p.position.y > bMax.y) {
        p.position.y = bMax.y;
        p.velocity.y *= -damping;
      }

      if (p.position.z < bMin.z) {
        p.position.z = bMin.z;
        p.velocity.z *= -damping;
      } else if (p.position.z > bMax.z) {
        p.position.z = bMax.z;
        p.velocity.z *= -damping;
      }
    }
  }

  // ----- Accessors ----------------------------------------------------------

  /**
   * Returns the full particle array (read-only usage expected).
   */
  getParticles(): FluidParticle[] {
    return this._particles;
  }

  /**
   * Returns all particle positions as a flat Float32Array (x,y,z per particle).
   */
  getParticlePositions(): Float32Array {
    const positions = new Float32Array(this._particles.length * 3);
    for (let i = 0; i < this._particles.length; i++) {
      const p = this._particles[i].position;
      positions[i * 3] = p.x;
      positions[i * 3 + 1] = p.y;
      positions[i * 3 + 2] = p.z;
    }
    return positions;
  }

  /**
   * Replaces the current config. Re-creates the spatial grid if kernelRadius changed.
   */
  setConfig(config: Partial<FluidConfig>): void {
    const oldKernel = this._config.kernelRadius;
    Object.assign(this._config, config);

    const h = this._config.kernelRadius;
    this._h6 = h * h * h * h * h * h;
    this._h9 = this._h6 * h * h * h;

    if (h !== oldKernel) {
      this._grid = new SpatialHashGrid(h);
    }

    this._logger.info('Fluid config updated');
  }

  /**
   * Returns a shallow copy of the current config.
   */
  getConfig(): FluidConfig {
    return { ...this._config };
  }

  /**
   * Sets the axis-aligned bounding box for particle confinement.
   */
  setBoundary(min: Vector3, max: Vector3): void {
    this._boundaryMin = min.clone();
    this._boundaryMax = max.clone();
  }

  // ----- Presets ------------------------------------------------------------

  /**
   * Creates a dam-break scenario: a column of particles on one side of the
   * boundary that collapses under gravity.
   *
   * @param countX - Particles along X axis
   * @param countY - Particles along Y axis
   * @param countZ - Particles along Z axis
   * @param spacing - Distance between particles (defaults to particleRadius * 2)
   */
  createDamBreak(
    countX: number = 10,
    countY: number = 20,
    countZ: number = 10,
    spacing?: number
  ): void {
    const sp = spacing ?? this._config.particleRadius * 2;
    const startX = this._boundaryMin.x + sp;
    const startY = this._boundaryMin.y + sp;
    const startZ = this._boundaryMin.z + sp;

    for (let x = 0; x < countX; x++) {
      for (let y = 0; y < countY; y++) {
        for (let z = 0; z < countZ; z++) {
          const pos = new Vector3(
            startX + x * sp,
            startY + y * sp,
            startZ + z * sp
          );
          if (this.addParticle(pos) === -1) return;
        }
      }
    }

    this._logger.info(
      `Dam break created: ${this._particles.length} particles`
    );
    this._events.emit('fluid:preset-created', { preset: 'damBreak' });
  }

  /**
   * Creates a spherical droplet of fluid particles centred at the given position.
   *
   * @param center - Center of the droplet
   * @param radius - Radius of the droplet
   * @param spacing - Distance between particles (defaults to particleRadius * 2)
   */
  createDroplet(
    center: Vector3 = new Vector3(0, 2, 0),
    radius: number = 0.5,
    spacing?: number
  ): void {
    const sp = spacing ?? this._config.particleRadius * 2;
    const radiusSq = radius * radius;
    const steps = Math.ceil((radius * 2) / sp);

    for (let x = 0; x <= steps; x++) {
      for (let y = 0; y <= steps; y++) {
        for (let z = 0; z <= steps; z++) {
          const px = center.x - radius + x * sp;
          const py = center.y - radius + y * sp;
          const pz = center.z - radius + z * sp;
          const dx = px - center.x;
          const dy = py - center.y;
          const dz = pz - center.z;
          if (dx * dx + dy * dy + dz * dz <= radiusSq) {
            if (this.addParticle(new Vector3(px, py, pz)) === -1) return;
          }
        }
      }
    }

    this._logger.info(
      `Droplet created: ${this._particles.length} particles`
    );
    this._events.emit('fluid:preset-created', { preset: 'droplet' });
  }

  /**
   * Removes all particles and resets the simulation state.
   */
  reset(): void {
    this._particles = [];
    this._nextId = 0;
    this._grid.clear();
    this._logger.info('Fluid simulation reset');
    this._events.emit('fluid:reset', {});
  }

  // ----- Statistics ---------------------------------------------------------

  /**
   * Computes aggregate statistics about the current simulation.
   */
  getStats(): FluidStats {
    const count = this._particles.length;
    if (count === 0) {
      return {
        particleCount: 0,
        averageDensity: 0,
        averageVelocity: 0,
        maxVelocity: 0,
        maxDensity: 0,
        kineticEnergy: 0
      };
    }

    let totalDensity = 0;
    let totalSpeed = 0;
    let maxSpeed = 0;
    let maxDensity = 0;
    let kineticEnergy = 0;

    for (let i = 0; i < count; i++) {
      const p = this._particles[i];
      totalDensity += p.density;
      if (p.density > maxDensity) maxDensity = p.density;

      const speed = p.velocity.length();
      totalSpeed += speed;
      if (speed > maxSpeed) maxSpeed = speed;

      kineticEnergy += 0.5 * p.mass * speed * speed;
    }

    return {
      particleCount: count,
      averageDensity: totalDensity / count,
      averageVelocity: totalSpeed / count,
      maxVelocity: maxSpeed,
      maxDensity,
      kineticEnergy
    };
  }
}
