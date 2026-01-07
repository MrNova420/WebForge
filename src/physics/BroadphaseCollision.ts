/**
 * @module physics
 * @fileoverview Broadphase collision detection for efficient culling of collision pairs
 */

import { Vector3 } from '../math/Vector3';
import { BoundingBox } from '../optimization/FrustumCulling';

/**
 * Collision pair
 */
export interface CollisionPair {
  bodyA: any;
  bodyB: any;
}

/**
 * Base broadphase collision detection
 */
export abstract class Broadphase {
  /**
   * Updates the broadphase with current body positions
   * @param bodies - Array of rigid bodies
   */
  abstract update(bodies: any[]): void;

  /**
   * Gets potential collision pairs
   * @returns Array of collision pairs
   */
  abstract getPairs(): CollisionPair[];

  /**
   * Clears the broadphase
   */
  abstract clear(): void;
}

/**
 * Naive broadphase - tests all pairs (O(n²))
 * Use only for small numbers of bodies (< 100)
 */
export class NaiveBroadphase extends Broadphase {
  private pairs: CollisionPair[] = [];

  update(bodies: any[]): void {
    this.pairs = [];

    // Test all pairs
    for (let i = 0; i < bodies.length; i++) {
      for (let j = i + 1; j < bodies.length; j++) {
        const bodyA = bodies[i];
        const bodyB = bodies[j];

        // Skip if both are static
        if (bodyA.isStatic() && bodyB.isStatic()) {
          continue;
        }

        this.pairs.push({ bodyA, bodyB });
      }
    }
  }

  getPairs(): CollisionPair[] {
    return this.pairs;
  }

  clear(): void {
    this.pairs = [];
  }
}

/**
 * Sweep and Prune broadphase (O(n log n))
 * Efficient for bodies with coherent motion
 */
export class SweepAndPruneBroadphase extends Broadphase {
  private pairs: CollisionPair[] = [];
  private axis: 'x' | 'y' | 'z' = 'x';

  constructor(axis: 'x' | 'y' | 'z' = 'x') {
    super();
    this.axis = axis;
  }

  update(bodies: any[]): void {
    this.pairs = [];

    if (bodies.length === 0) return;

    // Create array of intervals (min, max) along the axis
    const intervals: Array<{ body: any; min: number; max: number }> = [];

    for (const body of bodies) {
      const pos = body.getPosition();
      const bounds = this.getBodyBounds(body);
      
      let min: number, max: number;
      if (this.axis === 'x') {
        min = pos.x + bounds.min.x;
        max = pos.x + bounds.max.x;
      } else if (this.axis === 'y') {
        min = pos.y + bounds.min.y;
        max = pos.y + bounds.max.y;
      } else {
        min = pos.z + bounds.min.z;
        max = pos.z + bounds.max.z;
      }

      intervals.push({ body, min, max });
    }

    // Sort by minimum value
    intervals.sort((a, b) => a.min - b.min);

    // Sweep and find overlaps
    for (let i = 0; i < intervals.length; i++) {
      const intervalA = intervals[i];
      
      for (let j = i + 1; j < intervals.length; j++) {
        const intervalB = intervals[j];

        // If B's min is beyond A's max, no more overlaps possible
        if (intervalB.min > intervalA.max) {
          break;
        }

        // Skip if both are static
        if (intervalA.body.isStatic() && intervalB.body.isStatic()) {
          continue;
        }

        // Found overlap
        this.pairs.push({ 
          bodyA: intervalA.body, 
          bodyB: intervalB.body 
        });
      }
    }
  }

  private getBodyBounds(body: any): BoundingBox {
    // Assume body has a shape with getBoundingBox method
    if (body.shape && body.shape.getBoundingBox) {
      return body.shape.getBoundingBox();
    }
    // Default small bounds
    return new BoundingBox(
      new Vector3(-0.5, -0.5, -0.5),
      new Vector3(0.5, 0.5, 0.5)
    );
  }

  getPairs(): CollisionPair[] {
    return this.pairs;
  }

  clear(): void {
    this.pairs = [];
  }

  /**
   * Sets the sorting axis
   * @param axis - Axis to sort along
   */
  setAxis(axis: 'x' | 'y' | 'z'): void {
    this.axis = axis;
  }
}

/**
 * Spatial hash grid broadphase (O(n))
 * Excellent for evenly distributed bodies
 */
export class SpatialHashBroadphase extends Broadphase {
  private cellSize: number;
  private grid: Map<string, any[]> = new Map();
  private pairs: CollisionPair[] = [];

  constructor(cellSize: number = 5.0) {
    super();
    this.cellSize = cellSize;
  }

  update(bodies: any[]): void {
    this.grid.clear();
    this.pairs = [];

    // Insert bodies into grid
    for (const body of bodies) {
      const pos = body.getPosition();
      const bounds = this.getBodyBounds(body);
      
      // Get min and max cells
      const minCell = this.worldToCell(
        new Vector3(
          pos.x + bounds.min.x,
          pos.y + bounds.min.y,
          pos.z + bounds.min.z
        )
      );
      const maxCell = this.worldToCell(
        new Vector3(
          pos.x + bounds.max.x,
          pos.y + bounds.max.y,
          pos.z + bounds.max.z
        )
      );

      // Add body to all cells it occupies
      for (let x = minCell.x; x <= maxCell.x; x++) {
        for (let y = minCell.y; y <= maxCell.y; y++) {
          for (let z = minCell.z; z <= maxCell.z; z++) {
            const key = `${x},${y},${z}`;
            let cell = this.grid.get(key);
            if (!cell) {
              cell = [];
              this.grid.set(key, cell);
            }
            cell.push(body);
          }
        }
      }
    }

    // Find pairs within each cell
    const testedPairs = new Set<string>();

    for (const cell of this.grid.values()) {
      for (let i = 0; i < cell.length; i++) {
        for (let j = i + 1; j < cell.length; j++) {
          const bodyA = cell[i];
          const bodyB = cell[j];

          // Skip if both are static
          if (bodyA.isStatic() && bodyB.isStatic()) {
            continue;
          }

          // Create unique pair ID (order-independent)
          const pairId = bodyA < bodyB 
            ? `${bodyA.id}:${bodyB.id}` 
            : `${bodyB.id}:${bodyA.id}`;

          // Skip if already tested
          if (testedPairs.has(pairId)) {
            continue;
          }

          testedPairs.add(pairId);
          this.pairs.push({ bodyA, bodyB });
        }
      }
    }
  }

  private worldToCell(pos: Vector3): { x: number; y: number; z: number } {
    return {
      x: Math.floor(pos.x / this.cellSize),
      y: Math.floor(pos.y / this.cellSize),
      z: Math.floor(pos.z / this.cellSize)
    };
  }

  private getBodyBounds(body: any): BoundingBox {
    if (body.shape && body.shape.getBoundingBox) {
      return body.shape.getBoundingBox();
    }
    return new BoundingBox(
      new Vector3(-0.5, -0.5, -0.5),
      new Vector3(0.5, 0.5, 0.5)
    );
  }

  getPairs(): CollisionPair[] {
    return this.pairs;
  }

  clear(): void {
    this.grid.clear();
    this.pairs = [];
  }

  /**
   * Sets the cell size
   * @param size - New cell size
   */
  setCellSize(size: number): void {
    this.cellSize = Math.max(0.1, size);
  }

  /**
   * Gets statistics about the grid
   * @returns Grid statistics
   */
  getStats(): { cells: number; maxBodiesPerCell: number; avgBodiesPerCell: number } {
    let maxBodies = 0;
    let totalBodies = 0;

    for (const cell of this.grid.values()) {
      maxBodies = Math.max(maxBodies, cell.length);
      totalBodies += cell.length;
    }

    return {
      cells: this.grid.size,
      maxBodiesPerCell: maxBodies,
      avgBodiesPerCell: this.grid.size > 0 ? totalBodies / this.grid.size : 0
    };
  }
}
