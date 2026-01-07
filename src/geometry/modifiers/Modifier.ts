/**
 * @fileoverview Abstract base class for mesh modifiers
 * Provides non-destructive editing workflow for mesh operations
 * @module geometry/modifiers
 */

import { MeshData } from '../MeshData';

/**
 * Abstract base class for all mesh modifiers
 * 
 * Modifiers transform mesh geometry in a non-destructive way, allowing
 * the original mesh to be preserved and modifications to be applied,
 * reverted, or stacked in any order.
 * 
 * @example
 * ```typescript
 * class MyModifier extends Modifier {
 *   public apply(mesh: MeshData): MeshData {
 *     // Transform mesh and return modified copy
 *     return modifiedMesh;
 *   }
 * }
 * 
 * const modifier = new MyModifier();
 * const result = modifier.apply(originalMesh);
 * ```
 */
export abstract class Modifier {
  /** Modifier name for identification */
  protected name: string;
  
  /** Whether this modifier is enabled */
  protected enabled: boolean = true;
  
  /**
   * Create a new modifier
   * @param name - Identifier for this modifier
   */
  constructor(name: string) {
    this.name = name;
  }
  
  /**
   * Get the modifier name
   * @returns The modifier identifier
   */
  public getName(): string {
    return this.name;
  }
  
  /**
   * Check if the modifier is enabled
   * @returns True if enabled
   */
  public isEnabled(): boolean {
    return this.enabled;
  }
  
  /**
   * Enable or disable the modifier
   * @param enabled - Whether to enable the modifier
   */
  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }
  
  /**
   * Apply the modifier to a mesh
   * 
   * This method should create a new MeshData instance with the
   * modifications applied, leaving the input mesh unchanged.
   * 
   * @param mesh - Input mesh to modify
   * @returns New mesh with modifications applied
   */
  public abstract apply(mesh: MeshData): MeshData;
  
  /**
   * Revert the modifier (returns original mesh)
   * 
   * Default implementation simply returns the input mesh.
   * Subclasses can override if they need cleanup.
   * 
   * @param mesh - Mesh to revert
   * @returns Original unmodified mesh
   */
  public revert(mesh: MeshData): MeshData {
    return mesh;
  }
}
