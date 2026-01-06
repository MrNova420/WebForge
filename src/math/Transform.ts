/**
 * @module math
 * @fileoverview Transform class - 3D transformation with parent-child hierarchy
 */

import { Vector3 } from './Vector3';
import { Quaternion } from './Quaternion';
import { Matrix4 } from './Matrix4';

/**
 * Represents a 3D transformation with position, rotation, and scale.
 * Supports parent-child hierarchies for scene graph transformations.
 * 
 * @example
 * ```typescript
 * const transform = new Transform();
 * transform.position.set(10, 0, 0);
 * transform.rotation = Quaternion.fromEuler(0, Math.PI / 4, 0);
 * transform.scale.set(2, 2, 2);
 * 
 * // Create hierarchy
 * const parent = new Transform();
 * const child = new Transform();
 * child.setParent(parent);
 * 
 * // Get world matrices
 * const worldMatrix = transform.getWorldMatrix();
 * ```
 */
export class Transform {
  /** Local position */
  public position: Vector3;
  
  /** Local rotation */
  public rotation: Quaternion;
  
  /** Local scale */
  public scale: Vector3;
  
  /** Parent transform */
  private _parent: Transform | null;
  
  /** Child transforms */
  private _children: Set<Transform>;
  
  /** Cached local matrix */
  private _localMatrix: Matrix4;
  
  /** Cached world matrix */
  private _worldMatrix: Matrix4;
  
  /** Dirty flag for local matrix */
  private _localDirty: boolean;
  
  /** Dirty flag for world matrix */
  private _worldDirty: boolean;

  /**
   * Creates a new Transform.
   * @param position - Initial position (default: origin)
   * @param rotation - Initial rotation (default: identity)
   * @param scale - Initial scale (default: uniform 1)
   */
  constructor(
    position?: Vector3,
    rotation?: Quaternion,
    scale?: Vector3
  ) {
    this.position = position ? position.clone() : Vector3.zero();
    this.rotation = rotation ? rotation.clone() : Quaternion.identity();
    this.scale = scale ? scale.clone() : Vector3.one();
    
    this._parent = null;
    this._children = new Set();
    
    this._localMatrix = Matrix4.identity();
    this._worldMatrix = Matrix4.identity();
    
    this._localDirty = true;
    this._worldDirty = true;
  }

  /**
   * Gets the parent transform.
   * @returns Parent transform or null
   */
  getParent(): Transform | null {
    return this._parent;
  }

  /**
   * Sets the parent transform.
   * @param parent - New parent transform or null to detach
   */
  setParent(parent: Transform | null): void {
    // Remove from old parent
    if (this._parent) {
      this._parent._children.delete(this);
    }
    
    // Set new parent
    this._parent = parent;
    
    // Add to new parent
    if (parent) {
      parent._children.add(this);
    }
    
    // Mark world matrix as dirty
    this.markWorldDirty();
  }

  /**
   * Gets all child transforms.
   * @returns Array of child transforms
   */
  getChildren(): Transform[] {
    return Array.from(this._children);
  }

  /**
   * Adds a child transform.
   * @param child - Child transform to add
   */
  addChild(child: Transform): void {
    child.setParent(this);
  }

  /**
   * Removes a child transform.
   * @param child - Child transform to remove
   */
  removeChild(child: Transform): void {
    if (this._children.has(child)) {
      child.setParent(null);
    }
  }

  /**
   * Removes all children.
   */
  removeAllChildren(): void {
    this._children.forEach(child => {
      child.setParent(null);
    });
  }

  /**
   * Marks the local matrix as dirty.
   */
  markLocalDirty(): void {
    this._localDirty = true;
    this.markWorldDirty();
  }

  /**
   * Marks the world matrix as dirty (propagates to children).
   */
  markWorldDirty(): void {
    if (this._worldDirty) return; // Already dirty
    
    this._worldDirty = true;
    
    // Propagate to children
    this._children.forEach(child => {
      child.markWorldDirty();
    });
  }

  /**
   * Updates the local matrix from position, rotation, and scale.
   */
  private updateLocalMatrix(): void {
    if (!this._localDirty) return;
    
    // Build transformation matrix: T * R * S
    const translation = Matrix4.translation(this.position);
    const rotation = this.rotation.toMatrix4();
    const scaling = Matrix4.scaling(this.scale);
    
    this._localMatrix = translation.multiply(rotation).multiply(scaling);
    this._localDirty = false;
  }

  /**
   * Updates the world matrix from local matrix and parent's world matrix.
   */
  private updateWorldMatrix(): void {
    if (!this._worldDirty) return;
    
    // Ensure local matrix is up to date
    this.updateLocalMatrix();
    
    // Calculate world matrix
    if (this._parent) {
      // World = Parent's World * Local
      const parentWorld = this._parent.getWorldMatrix();
      this._worldMatrix = parentWorld.multiply(this._localMatrix);
    } else {
      // No parent, world = local
      this._worldMatrix = this._localMatrix.clone();
    }
    
    this._worldDirty = false;
  }

  /**
   * Gets the local transformation matrix.
   * @returns Local matrix
   */
  getLocalMatrix(): Matrix4 {
    this.updateLocalMatrix();
    return this._localMatrix.clone();
  }

  /**
   * Gets the world transformation matrix.
   * @returns World matrix
   */
  getWorldMatrix(): Matrix4 {
    this.updateWorldMatrix();
    return this._worldMatrix.clone();
  }

  /**
   * Gets the world position.
   * @returns World position
   */
  getWorldPosition(): Vector3 {
    const worldMatrix = this.getWorldMatrix();
    return worldMatrix.getPosition();
  }

  /**
   * Gets the world scale.
   * @returns World scale
   */
  getWorldScale(): Vector3 {
    const worldMatrix = this.getWorldMatrix();
    return worldMatrix.getScale();
  }

  /**
   * Gets the world rotation.
   * @returns World rotation as quaternion
   */
  getWorldRotation(): Quaternion {
    if (this._parent) {
      const parentRotation = this._parent.getWorldRotation();
      return parentRotation.multiply(this.rotation);
    }
    return this.rotation.clone();
  }

  /**
   * Sets the world position (updates local position to achieve world position).
   * @param worldPosition - Desired world position
   */
  setWorldPosition(worldPosition: Vector3): void {
    if (this._parent) {
      const parentWorldMatrix = this._parent.getWorldMatrix();
      const parentWorldMatrixInv = parentWorldMatrix.invert();
      const localPosition = parentWorldMatrixInv.multiplyVector3(worldPosition);
      this.position.copy(localPosition);
    } else {
      this.position.copy(worldPosition);
    }
    this.markLocalDirty();
  }

  /**
   * Translates by a vector in local space.
   * @param offset - Translation offset
   */
  translate(offset: Vector3): void {
    this.position.addSelf(offset);
    this.markLocalDirty();
  }

  /**
   * Translates by a vector in world space.
   * @param offset - Translation offset
   */
  translateWorld(offset: Vector3): void {
    if (this._parent) {
      // Convert world offset to local space
      const parentRotation = this._parent.getWorldRotation();
      const localOffset = parentRotation.invert().multiplyVector(offset);
      this.position.addSelf(localOffset);
    } else {
      this.position.addSelf(offset);
    }
    this.markLocalDirty();
  }

  /**
   * Rotates by a quaternion in local space.
   * @param rotation - Rotation quaternion
   */
  rotate(rotation: Quaternion): void {
    this.rotation.multiplySelf(rotation);
    this.markLocalDirty();
  }

  /**
   * Rotates around an axis in local space.
   * @param axis - Rotation axis
   * @param angle - Rotation angle in radians
   */
  rotateAround(axis: Vector3, angle: number): void {
    const rotation = Quaternion.fromAxisAngle(axis, angle);
    this.rotate(rotation);
  }

  /**
   * Looks at a target position in world space.
   * @param target - Target position to look at
   * @param up - Up vector (default: world up) - reserved for future use
   */
  lookAt(target: Vector3, up: Vector3 = Vector3.up()): void {
    const worldPos = this.getWorldPosition();
    const direction = target.subtract(worldPos).normalize();
    
    // Calculate rotation to look at target
    const forward = Vector3.forward().negate(); // -Z is forward in OpenGL
    const axis = forward.cross(direction).normalize();
    const angle = Math.acos(forward.dot(direction));
    
    if (axis.lengthSquared() > 0.001) {
      this.rotation = Quaternion.fromAxisAngle(axis, angle);
      this.markLocalDirty();
    }
    
    // TODO: Use up vector for proper look-at calculation
    // Currently simplified version without up vector consideration
    void up; // Suppress unused parameter warning
  }

  /**
   * Transforms a point from local space to world space.
   * @param localPoint - Point in local space
   * @returns Point in world space
   */
  transformPoint(localPoint: Vector3): Vector3 {
    const worldMatrix = this.getWorldMatrix();
    return worldMatrix.multiplyVector3(localPoint);
  }

  /**
   * Transforms a direction from local space to world space (ignores translation).
   * @param localDirection - Direction in local space
   * @returns Direction in world space
   */
  transformDirection(localDirection: Vector3): Vector3 {
    const worldRotation = this.getWorldRotation();
    return worldRotation.multiplyVector(localDirection);
  }

  /**
   * Transforms a point from world space to local space.
   * @param worldPoint - Point in world space
   * @returns Point in local space
   */
  inverseTransformPoint(worldPoint: Vector3): Vector3 {
    const worldMatrix = this.getWorldMatrix();
    const inverseMatrix = worldMatrix.invert();
    return inverseMatrix.multiplyVector3(worldPoint);
  }

  /**
   * Transforms a direction from world space to local space (ignores translation).
   * @param worldDirection - Direction in world space
   * @returns Direction in local space
   */
  inverseTransformDirection(worldDirection: Vector3): Vector3 {
    const worldRotation = this.getWorldRotation();
    const inverseRotation = worldRotation.invert();
    return inverseRotation.multiplyVector(worldDirection);
  }

  /**
   * Resets transform to identity.
   */
  reset(): void {
    this.position.set(0, 0, 0);
    this.rotation.set(0, 0, 0, 1);
    this.scale.set(1, 1, 1);
    this.markLocalDirty();
  }

  /**
   * Creates a copy of this transform.
   * @returns Cloned transform
   */
  clone(): Transform {
    const clone = new Transform(
      this.position.clone(),
      this.rotation.clone(),
      this.scale.clone()
    );
    return clone;
  }

  /**
   * Copies values from another transform.
   * @param other - Source transform
   */
  copy(other: Transform): void {
    this.position.copy(other.position);
    this.rotation.copy(other.rotation);
    this.scale.copy(other.scale);
    this.markLocalDirty();
  }

  /**
   * Checks if this transform equals another transform.
   * @param other - Transform to compare with
   * @param epsilon - Tolerance for comparison
   * @returns True if equal within tolerance
   */
  equals(other: Transform, epsilon: number = 1e-10): boolean {
    return (
      this.position.equals(other.position, epsilon) &&
      this.rotation.equals(other.rotation, epsilon) &&
      this.scale.equals(other.scale, epsilon)
    );
  }

  /**
   * Gets the forward direction in world space.
   * @returns Forward direction
   */
  forward(): Vector3 {
    return this.transformDirection(Vector3.forward());
  }

  /**
   * Gets the right direction in world space.
   * @returns Right direction
   */
  right(): Vector3 {
    return this.transformDirection(Vector3.right());
  }

  /**
   * Gets the up direction in world space.
   * @returns Up direction
   */
  up(): Vector3 {
    return this.transformDirection(Vector3.up());
  }

  /**
   * Converts this transform to a string representation.
   * @returns String representation
   */
  toString(): string {
    return `Transform(pos: ${this.position.toString()}, rot: ${this.rotation.toString()}, scale: ${this.scale.toString()})`;
  }
}
