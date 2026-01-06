/**
 * @module scene
 * @fileoverview Scene class - Container for game objects and scene management
 */

import { EventSystem } from '../core/EventSystem';
import { Logger } from '../core/Logger';

/**
 * Scene interface - Base interface for scene objects.
 */
export interface ISceneObject {
  name: string;
  active: boolean;
  update(deltaTime: number): void;
  destroy(): void;
}

/**
 * Scene class - Container and manager for game objects.
 * Provides lifecycle management, updates, and scene graph functionality.
 * 
 * @example
 * ```typescript
 * const scene = new Scene('MainScene');
 * 
 * // Add objects
 * const player = new GameObject('Player');
 * scene.add(player);
 * 
 * // Update all objects
 * scene.update(deltaTime);
 * 
 * // Find objects
 * const enemy = scene.findByName('Enemy');
 * const enemies = scene.findByTag('enemy');
 * ```
 */
export class Scene {
  /** Scene name */
  public name: string;
  
  /** Whether scene is active */
  public active: boolean;
  
  /** Scene objects */
  private objects: Set<ISceneObject>;
  
  /** Objects by name lookup */
  private objectsByName: Map<string, ISceneObject>;
  
  /** Objects by tag lookup */
  private objectsByTag: Map<string, Set<ISceneObject>>;
  
  /** Event system */
  private events: EventSystem;
  
  /** Logger */
  private logger: Logger;
  
  /** Objects to add next frame */
  private toAdd: ISceneObject[];
  
  /** Objects to remove next frame */
  private toRemove: ISceneObject[];

  /**
   * Creates a new Scene.
   * @param name - Scene name
   */
  constructor(name: string = 'Scene') {
    this.name = name;
    this.active = true;
    this.objects = new Set();
    this.objectsByName = new Map();
    this.objectsByTag = new Map();
    this.events = new EventSystem();
    this.logger = new Logger(`Scene:${name}`);
    this.toAdd = [];
    this.toRemove = [];
  }

  /**
   * Adds an object to the scene.
   * @param object - Object to add
   */
  add(object: ISceneObject): void {
    if (this.objects.has(object)) {
      this.logger.warn(`Object "${object.name}" is already in scene`);
      return;
    }
    
    this.toAdd.push(object);
  }

  /**
   * Removes an object from the scene.
   * @param object - Object to remove
   */
  remove(object: ISceneObject): void {
    if (!this.objects.has(object)) {
      this.logger.warn(`Object "${object.name}" is not in scene`);
      return;
    }
    
    this.toRemove.push(object);
  }

  /**
   * Processes pending additions and removals.
   */
  private processPendingChanges(): void {
    // Process additions
    for (const object of this.toAdd) {
      this.objects.add(object);
      this.objectsByName.set(object.name, object);
      this.events.emit('object:added', object);
    }
    this.toAdd = [];
    
    // Process removals
    for (const object of this.toRemove) {
      this.objects.delete(object);
      this.objectsByName.delete(object.name);
      
      // Remove from tag map
      this.objectsByTag.forEach(set => set.delete(object));
      
      this.events.emit('object:removed', object);
    }
    this.toRemove = [];
  }

  /**
   * Updates all active objects in the scene.
   * @param deltaTime - Time since last frame in seconds
   */
  update(deltaTime: number): void {
    if (!this.active) return;
    
    // Process pending changes first
    this.processPendingChanges();
    
    // Update all objects
    for (const object of this.objects) {
      if (object.active) {
        try {
          object.update(deltaTime);
        } catch (error) {
          this.logger.error(`Error updating object "${object.name}"`, error);
        }
      }
    }
  }

  /**
   * Finds an object by name.
   * @param name - Object name
   * @returns Object or null if not found
   */
  findByName(name: string): ISceneObject | null {
    return this.objectsByName.get(name) || null;
  }

  /**
   * Finds all objects with a specific tag.
   * @param tag - Tag to search for
   * @returns Array of objects with the tag
   */
  findByTag(tag: string): ISceneObject[] {
    const set = this.objectsByTag.get(tag);
    return set ? Array.from(set) : [];
  }

  /**
   * Tags an object.
   * @param object - Object to tag
   * @param tag - Tag to add
   */
  tagObject(object: ISceneObject, tag: string): void {
    if (!this.objects.has(object)) {
      this.logger.warn(`Cannot tag object "${object.name}" - not in scene`);
      return;
    }
    
    if (!this.objectsByTag.has(tag)) {
      this.objectsByTag.set(tag, new Set());
    }
    
    this.objectsByTag.get(tag)!.add(object);
  }

  /**
   * Removes a tag from an object.
   * @param object - Object to untag
   * @param tag - Tag to remove
   */
  untagObject(object: ISceneObject, tag: string): void {
    const set = this.objectsByTag.get(tag);
    if (set) {
      set.delete(object);
      if (set.size === 0) {
        this.objectsByTag.delete(tag);
      }
    }
  }

  /**
   * Gets all objects in the scene.
   * @returns Array of all objects
   */
  getAllObjects(): ISceneObject[] {
    return Array.from(this.objects);
  }

  /**
   * Gets the number of objects in the scene.
   * @returns Object count
   */
  getObjectCount(): number {
    return this.objects.size;
  }

  /**
   * Clears all objects from the scene.
   */
  clear(): void {
    // Destroy all objects
    for (const object of this.objects) {
      object.destroy();
    }
    
    this.objects.clear();
    this.objectsByName.clear();
    this.objectsByTag.clear();
    this.toAdd = [];
    this.toRemove = [];
    
    this.events.emit('scene:cleared');
    this.logger.info('Scene cleared');
  }

  /**
   * Destroys the scene and all its objects.
   */
  destroy(): void {
    this.clear();
    this.events.clear();
    this.logger.info('Scene destroyed');
  }

  /**
   * Gets the scene's event system.
   * @returns Event system
   */
  getEvents(): EventSystem {
    return this.events;
  }

  /**
   * Enables the scene.
   */
  enable(): void {
    this.active = true;
    this.events.emit('scene:enabled');
  }

  /**
   * Disables the scene (stops updates).
   */
  disable(): void {
    this.active = false;
    this.events.emit('scene:disabled');
  }
}
