/**
 * @fileoverview Modifier stack for managing multiple modifiers
 * @module geometry/modifiers
 */

import { Modifier } from './Modifier';
import { MeshData } from '../MeshData';

/**
 * Manages a stack of modifiers for sequential application
 * 
 * Allows building complex modifications by chaining multiple
 * modifiers in order. Each modifier uses the output of the
 * previous one as its input.
 * 
 * @example
 * ```typescript
 * const stack = new ModifierStack();
 * stack.addModifier(new MirrorModifier('X'));
 * stack.addModifier(new SubdivisionModifier(2));
 * stack.addModifier(new BevelModifier(0.05));
 * 
 * const result = stack.apply(mesh);
 * ```
 */
export class ModifierStack {
  private modifiers: Modifier[] = [];
  
  /**
   * Add a modifier to the stack
   * @param modifier - Modifier to add
   */
  public addModifier(modifier: Modifier): void {
    this.modifiers.push(modifier);
  }
  
  /**
   * Remove a modifier from the stack
   * @param modifier - Modifier to remove
   */
  public removeModifier(modifier: Modifier): void {
    const index = this.modifiers.indexOf(modifier);
    if (index !== -1) {
      this.modifiers.splice(index, 1);
    }
  }
  
  /**
   * Get modifier by index
   * @param index - Index of modifier
   * @returns Modifier at index or undefined
   */
  public getModifier(index: number): Modifier | undefined {
    return this.modifiers[index];
  }
  
  /**
   * Get modifier by name
   * @param name - Name of modifier
   * @returns First modifier with matching name or undefined
   */
  public getModifierByName(name: string): Modifier | undefined {
    return this.modifiers.find(m => m.getName() === name);
  }
  
  /**
   * Get number of modifiers in stack
   * @returns Modifier count
   */
  public getCount(): number {
    return this.modifiers.length;
  }
  
  /**
   * Move modifier to different position
   * @param fromIndex - Current index
   * @param toIndex - Target index
   */
  public moveModifier(fromIndex: number, toIndex: number): void {
    if (fromIndex < 0 || fromIndex >= this.modifiers.length) return;
    if (toIndex < 0 || toIndex >= this.modifiers.length) return;
    
    const modifier = this.modifiers.splice(fromIndex, 1)[0];
    this.modifiers.splice(toIndex, 0, modifier);
  }
  
  /**
   * Apply all modifiers in sequence
   * @param mesh - Input mesh
   * @returns Modified mesh after all modifiers
   */
  public apply(mesh: MeshData): MeshData {
    let result = mesh;
    
    for (const modifier of this.modifiers) {
      if (modifier.isEnabled()) {
        result = modifier.apply(result);
      }
    }
    
    return result;
  }
  
  /**
   * Clear all modifiers
   */
  public clear(): void {
    this.modifiers = [];
  }
}
