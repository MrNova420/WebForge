/**
 * @module optimization
 * @fileoverview Level of Detail (LOD) system for performance optimization
 */

import { Vector3 } from '../math/Vector3';
import { Mesh } from '../rendering/Mesh';
import { Camera } from '../rendering/Camera';
import { Logger } from '../core/Logger';

/**
 * LOD level definition
 */
export interface LODLevel {
  /** Distance threshold for this LOD level */
  distance: number;
  /** Mesh for this LOD level */
  mesh: Mesh;
  /** Optional screen coverage threshold (0-1) */
  screenCoverage?: number;
}

/**
 * LOD configuration
 */
export interface LODConfig {
  /** LOD bias (multiplier for distances) */
  bias?: number;
  /** Enable fade transitions between LOD levels */
  fadeDuration?: number;
  /** Hysteresis factor to prevent LOD flickering */
  hysteresis?: number;
}

/**
 * LOD (Level of Detail) system
 * Automatically switches between mesh detail levels based on distance
 */
export class LODSystem {
  private logger: Logger;
  private lodBias: number;
  private _fadeDuration: number;
  private hysteresis: number;
  
  private lodGroups: Map<string, LODGroup> = new Map();

  /**
   * Creates a new LOD system
   * @param config - LOD configuration
   */
  constructor(config: LODConfig = {}) {
    this.logger = new Logger('LODSystem');
    this.lodBias = config.bias !== undefined ? config.bias : 1.0;
    this._fadeDuration = config.fadeDuration !== undefined ? config.fadeDuration : 0.0;
    this.hysteresis = config.hysteresis !== undefined ? config.hysteresis : 0.05;
  }

  /**
   * Creates a new LOD group
   * @param id - Unique identifier for the LOD group
   * @param position - World position of the object
   * @param levels - LOD levels
   * @returns LOD group
   */
  createLODGroup(id: string, position: Vector3, levels: LODLevel[]): LODGroup {
    const group = new LODGroup(id, position, levels, this.hysteresis);
    this.lodGroups.set(id, group);
    this.logger.info(`Created LOD group '${id}' with ${levels.length} levels`);
    return group;
  }

  /**
   * Removes a LOD group
   * @param id - LOD group identifier
   */
  removeLODGroup(id: string): void {
    if (this.lodGroups.delete(id)) {
      this.logger.info(`Removed LOD group '${id}'`);
    }
  }

  /**
   * Gets a LOD group by ID
   * @param id - LOD group identifier
   * @returns LOD group or undefined
   */
  getLODGroup(id: string): LODGroup | undefined {
    return this.lodGroups.get(id);
  }

  /**
   * Updates all LOD groups based on camera
   * @param camera - Active camera
   */
  update(camera: Camera): void {
    const cameraPosition = camera.getPosition();
    
    for (const group of this.lodGroups.values()) {
      group.update(cameraPosition, this.lodBias);
    }
  }

  /**
   * Sets the LOD bias
   * @param bias - LOD bias multiplier
   */
  setBias(bias: number): void {
    this.lodBias = Math.max(0.1, bias);
  }

  /**
   * Gets the LOD bias
   * @returns LOD bias
   */
  getBias(): number {
    return this.lodBias;
  }

  /**
   * Gets all LOD groups
   * @returns Array of LOD groups
   */
  getAllGroups(): LODGroup[] {
    return Array.from(this.lodGroups.values());
  }

  /**
   * Gets LOD statistics
   * @returns LOD statistics
   */
  getStatistics(): LODStatistics {
    let totalGroups = this.lodGroups.size;
    let levelCounts: number[] = [];
    
    for (const group of this.lodGroups.values()) {
      const level = group.getCurrentLevel();
      levelCounts[level] = (levelCounts[level] || 0) + 1;
    }
    
    return {
      totalGroups,
      levelCounts
    };
  }

  /**
   * Gets the fade duration
   * @returns Fade duration in seconds
   */
  getFadeDuration(): number {
    return this._fadeDuration;
  }

  /**
   * Clears all LOD groups
   */
  clear(): void {
    this.lodGroups.clear();
    this.logger.info('Cleared all LOD groups');
  }
}

/**
 * LOD group managing multiple detail levels for a single object
 */
export class LODGroup {
  private id: string;
  private position: Vector3;
  private levels: LODLevel[];
  private currentLevel: number = 0;
  private previousLevel: number = 0;
  private transitionTime: number = 0;
  private hysteresis: number;

  /**
   * Creates a new LOD group
   * @param id - Unique identifier
   * @param position - World position
   * @param levels - LOD levels (sorted by distance, closest first)
   * @param hysteresis - Hysteresis factor
   */
  constructor(id: string, position: Vector3, levels: LODLevel[], hysteresis: number = 0.05) {
    this.id = id;
    this.position = position.clone();
    this.levels = [...levels].sort((a, b) => a.distance - b.distance);
    this.hysteresis = hysteresis;
  }

  /**
   * Updates the LOD level based on distance to camera
   * @param cameraPosition - Camera world position
   * @param bias - LOD bias multiplier
   */
  update(cameraPosition: Vector3, bias: number = 1.0): void {
    const distance = this.position.distanceTo(cameraPosition) * bias;
    
    this.previousLevel = this.currentLevel;
    
    // Find appropriate LOD level with hysteresis
    for (let i = 0; i < this.levels.length; i++) {
      const level = this.levels[i];
      const threshold = level.distance;
      
      // Apply hysteresis to prevent flickering
      const adjustedThreshold = this.currentLevel > i 
        ? threshold * (1 - this.hysteresis)
        : threshold * (1 + this.hysteresis);
      
      if (distance < adjustedThreshold) {
        this.currentLevel = i;
        break;
      }
      
      // If we've passed all thresholds, use the last (lowest detail) level
      if (i === this.levels.length - 1) {
        this.currentLevel = i;
      }
    }
    
    // Track transition if level changed
    if (this.currentLevel !== this.previousLevel) {
      this.transitionTime = 0;
    }
  }

  /**
   * Gets the current LOD level index
   * @returns Current level index
   */
  getCurrentLevel(): number {
    return this.currentLevel;
  }

  /**
   * Gets the current LOD mesh
   * @returns Current mesh
   */
  getCurrentMesh(): Mesh {
    return this.levels[this.currentLevel].mesh;
  }

  /**
   * Gets all LOD levels
   * @returns LOD levels
   */
  getLevels(): LODLevel[] {
    return this.levels;
  }

  /**
   * Gets the world position
   * @returns Position
   */
  getPosition(): Vector3 {
    return this.position;
  }

  /**
   * Sets the world position
   * @param position - New position
   */
  setPosition(position: Vector3): void {
    this.position.copy(position);
  }

  /**
   * Gets the group ID
   * @returns ID
   */
  getId(): string {
    return this.id;
  }

  /**
   * Checks if currently transitioning between LOD levels
   * @returns True if transitioning
   */
  isTransitioning(): boolean {
    return this.currentLevel !== this.previousLevel;
  }

  /**
   * Gets the transition progress (0-1)
   * @returns Transition progress
   */
  getTransitionProgress(): number {
    return this.transitionTime;
  }
}

/**
 * LOD statistics
 */
export interface LODStatistics {
  /** Total number of LOD groups */
  totalGroups: number;
  /** Count of objects at each LOD level */
  levelCounts: number[];
}
