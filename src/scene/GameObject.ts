/**
 * @module scene
 * @fileoverview GameObject class - Base class for all scene objects with transform and components
 */

import { Transform } from '../math/Transform';
import { ISceneObject } from './Scene';
import { EventSystem } from '../core/EventSystem';

/**
 * Component interface - Base interface for GameObject components.
 */
export interface IComponent {
  gameObject: GameObject | null;
  enabled: boolean;
  awake(): void;
  start(): void;
  update(deltaTime: number): void;
  destroy(): void;
}

/**
 * GameObject class - Base class for all scene objects.
 * Provides transform, component system, and parent-child hierarchy.
 * 
 * @example
 * ```typescript
 * const player = new GameObject('Player');
 * player.transform.position.set(0, 0, 0);
 * 
 * // Add components
 * const renderer = new MeshRenderer();
 * player.addComponent(renderer);
 * 
 * // Parent-child hierarchy
 * const weapon = new GameObject('Weapon');
 * weapon.setParent(player);
 * 
 * // Update
 * player.update(deltaTime);
 * ```
 */
export class GameObject implements ISceneObject {
  /** Object name */
  public name: string;
  
  /** Whether object is active */
  public active: boolean;
  
  /** Transform component */
  public transform: Transform;
  
  /** Parent game object */
  private _parent: GameObject | null;
  
  /** Child game objects */
  private _children: Set<GameObject>;
  
  /** Components attached to this object */
  private components: Map<string, IComponent>;
  
  /** Tags for categorization */
  private tags: Set<string>;
  
  /** Event system */
  private events: EventSystem;
  
  /** Whether object has been started */
  private started: boolean;

  /**
   * Creates a new GameObject.
   * @param name - Object name
   */
  constructor(name: string = 'GameObject') {
    this.name = name;
    this.active = true;
    this.transform = new Transform();
    this._parent = null;
    this._children = new Set();
    this.components = new Map();
    this.tags = new Set();
    this.events = new EventSystem();
    this.started = false;
  }

  /**
   * Gets the parent GameObject.
   * @returns Parent or null
   */
  getParent(): GameObject | null {
    return this._parent;
  }

  /**
   * Sets the parent GameObject.
   * @param parent - New parent or null to detach
   */
  setParent(parent: GameObject | null): void {
    // Remove from old parent
    if (this._parent) {
      this._parent._children.delete(this);
    }
    
    // Set new parent
    this._parent = parent;
    
    // Add to new parent
    if (parent) {
      parent._children.add(this);
      this.transform.setParent(parent.transform);
    } else {
      this.transform.setParent(null);
    }
    
    this.events.emit('parent:changed', { parent });
  }

  /**
   * Gets all child GameObjects.
   * @returns Array of children
   */
  getChildren(): GameObject[] {
    return Array.from(this._children);
  }

  /**
   * Adds a child GameObject.
   * @param child - Child to add
   */
  addChild(child: GameObject): void {
    child.setParent(this);
  }

  /**
   * Removes a child GameObject.
   * @param child - Child to remove
   */
  removeChild(child: GameObject): void {
    if (this._children.has(child)) {
      child.setParent(null);
    }
  }

  /**
   * Finds a child by name (recursive).
   * @param name - Child name
   * @returns Child or null if not found
   */
  findChild(name: string): GameObject | null {
    for (const child of this._children) {
      if (child.name === name) {
        return child;
      }
      
      const found = child.findChild(name);
      if (found) {
        return found;
      }
    }
    
    return null;
  }

  /**
   * Adds a component to this GameObject.
   * @param component - Component to add
   * @returns The added component
   */
  addComponent<T extends IComponent>(component: T): T {
    const typeName = component.constructor.name;
    
    if (this.components.has(typeName)) {
      throw new Error(`Component "${typeName}" already exists on GameObject "${this.name}"`);
    }
    
    component.gameObject = this;
    this.components.set(typeName, component);
    
    // Call awake if object is already started
    if (this.started) {
      component.awake();
      component.start();
    }
    
    this.events.emit('component:added', { component, typeName });
    
    return component;
  }

  /**
   * Gets a component by type.
   * @param typeName - Component type name
   * @returns Component or null if not found
   */
  getComponent<T extends IComponent>(typeName: string): T | null;
  getComponent<T extends IComponent>(type: new (...args: any[]) => T): T | null;
  getComponent<T extends IComponent>(typeOrName: string | (new (...args: any[]) => T)): T | null {
    const typeName = typeof typeOrName === 'string' ? typeOrName : typeOrName.name;
    return (this.components.get(typeName) as T) || null;
  }

  /**
   * Gets all components.
   * @returns Array of all components
   */
  getAllComponents(): IComponent[] {
    return Array.from(this.components.values());
  }

  /**
   * Removes a component.
   * @param component - Component to remove
   */
  removeComponent(component: IComponent): void {
    const typeName = component.constructor.name;
    
    if (this.components.has(typeName)) {
      component.destroy();
      component.gameObject = null;
      this.components.delete(typeName);
      this.events.emit('component:removed', { component, typeName });
    }
  }

  /**
   * Checks if this GameObject has a specific component.
   * @param typeName - Component type name
   * @returns True if component exists
   */
  hasComponent(typeName: string): boolean {
    return this.components.has(typeName);
  }

  /**
   * Adds a tag to this GameObject.
   * @param tag - Tag to add
   */
  addTag(tag: string): void {
    this.tags.add(tag);
  }

  /**
   * Removes a tag from this GameObject.
   * @param tag - Tag to remove
   */
  removeTag(tag: string): void {
    this.tags.delete(tag);
  }

  /**
   * Checks if this GameObject has a specific tag.
   * @param tag - Tag to check
   * @returns True if tag exists
   */
  hasTag(tag: string): boolean {
    return this.tags.has(tag);
  }

  /**
   * Gets all tags.
   * @returns Array of tags
   */
  getTags(): string[] {
    return Array.from(this.tags);
  }

  /**
   * Called when GameObject is first created (before first update).
   */
  private awake(): void {
    // Call awake on all components
    for (const component of this.components.values()) {
      if (component.enabled) {
        component.awake();
      }
    }
  }

  /**
   * Called before first update.
   */
  private start(): void {
    if (this.started) return;
    
    this.awake();
    
    // Call start on all components
    for (const component of this.components.values()) {
      if (component.enabled) {
        component.start();
      }
    }
    
    this.started = true;
    this.events.emit('started');
  }

  /**
   * Updates this GameObject and its components.
   * @param deltaTime - Time since last frame in seconds
   */
  update(deltaTime: number): void {
    if (!this.active) return;
    
    // Start if not started yet
    if (!this.started) {
      this.start();
    }
    
    // Update all components
    for (const component of this.components.values()) {
      if (component.enabled) {
        component.update(deltaTime);
      }
    }
    
    // Update children
    for (const child of this._children) {
      if (child.active) {
        child.update(deltaTime);
      }
    }
  }

  /**
   * Destroys this GameObject and all its components and children.
   */
  destroy(): void {
    // Destroy children
    for (const child of this._children) {
      child.destroy();
    }
    this._children.clear();
    
    // Destroy components
    for (const component of this.components.values()) {
      component.destroy();
      component.gameObject = null;
    }
    this.components.clear();
    
    // Detach from parent
    if (this._parent) {
      this._parent.removeChild(this);
    }
    
    this.events.emit('destroyed');
    this.events.clear();
  }

  /**
   * Clones this GameObject (deep copy).
   * @returns Cloned GameObject
   */
  clone(): GameObject {
    const clone = new GameObject(this.name + '_Clone');
    clone.active = this.active;
    clone.transform.copy(this.transform);
    
    // Clone tags
    this.tags.forEach(tag => clone.addTag(tag));
    
    // Clone simple metadata used by editor (primitive type, color, light data, custom fields)
    (clone as any).primitiveType = (this as any).primitiveType;
    (clone as any).editorColor = (this as any).editorColor;
    (clone as any).lightType = (this as any).lightType;
    (clone as any).lightColor = (this as any).lightColor ? [...(this as any).lightColor] : undefined;
    (clone as any).lightIntensity = (this as any).lightIntensity;
    (clone as any).lightRange = (this as any).lightRange;
    (clone as any).lightAngle = (this as any).lightAngle;
    
    // Components are not cloned by default as they may have complex state.
    return clone;
  }

  /**
   * Gets the event system.
   * @returns Event system
   */
  getEvents(): EventSystem {
    return this.events;
  }

  /**
   * Converts this GameObject to a string representation.
   * @returns String representation
   */
  toString(): string {
    return `GameObject("${this.name}", active: ${this.active}, components: ${this.components.size}, children: ${this._children.size})`;
  }
}
