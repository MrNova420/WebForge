/**
 * @module math
 * @fileoverview Vector2 class - 2D vector implementation with comprehensive operations
 */

/**
 * Represents a 2D vector with x and y components.
 * Provides comprehensive vector operations for 2D mathematics.
 * 
 * @example
 * ```typescript
 * const v1 = new Vector2(1, 2);
 * const v2 = new Vector2(3, 4);
 * const sum = v1.add(v2);
 * const length = v1.length();
 * ```
 */
export class Vector2 {
  /**
   * Creates a new Vector2.
   * @param x - X component (default: 0)
   * @param y - Y component (default: 0)
   */
  constructor(
    public x: number = 0,
    public y: number = 0
  ) {}

  /**
   * Creates a new Vector2 with all components set to zero.
   * @returns A zero vector (0, 0)
   */
  static zero(): Vector2 {
    return new Vector2(0, 0);
  }

  /**
   * Creates a new Vector2 with all components set to one.
   * @returns A unit vector (1, 1)
   */
  static one(): Vector2 {
    return new Vector2(1, 1);
  }

  /**
   * Creates a unit vector pointing up (0, 1).
   * @returns Up vector
   */
  static up(): Vector2 {
    return new Vector2(0, 1);
  }

  /**
   * Creates a unit vector pointing down (0, -1).
   * @returns Down vector
   */
  static down(): Vector2 {
    return new Vector2(0, -1);
  }

  /**
   * Creates a unit vector pointing left (-1, 0).
   * @returns Left vector
   */
  static left(): Vector2 {
    return new Vector2(-1, 0);
  }

  /**
   * Creates a unit vector pointing right (1, 0).
   * @returns Right vector
   */
  static right(): Vector2 {
    return new Vector2(1, 0);
  }

  /**
   * Creates a copy of this vector.
   * @returns A new Vector2 with the same components
   */
  clone(): Vector2 {
    return new Vector2(this.x, this.y);
  }

  /**
   * Copies components from another vector.
   * @param v - Source vector
   * @returns This vector for chaining
   */
  copy(v: Vector2): Vector2 {
    this.x = v.x;
    this.y = v.y;
    return this;
  }

  /**
   * Sets the components of this vector.
   * @param x - X component
   * @param y - Y component
   * @returns This vector for chaining
   */
  set(x: number, y: number): Vector2 {
    this.x = x;
    this.y = y;
    return this;
  }

  /**
   * Adds another vector to this vector.
   * @param v - Vector to add
   * @returns A new vector containing the sum
   */
  add(v: Vector2): Vector2 {
    return new Vector2(this.x + v.x, this.y + v.y);
  }

  /**
   * Adds another vector to this vector (mutates this vector).
   * @param v - Vector to add
   * @returns This vector for chaining
   */
  addSelf(v: Vector2): Vector2 {
    this.x += v.x;
    this.y += v.y;
    return this;
  }

  /**
   * Subtracts another vector from this vector.
   * @param v - Vector to subtract
   * @returns A new vector containing the difference
   */
  subtract(v: Vector2): Vector2 {
    return new Vector2(this.x - v.x, this.y - v.y);
  }

  /**
   * Subtracts another vector from this vector (mutates this vector).
   * @param v - Vector to subtract
   * @returns This vector for chaining
   */
  subtractSelf(v: Vector2): Vector2 {
    this.x -= v.x;
    this.y -= v.y;
    return this;
  }

  /**
   * Multiplies this vector by a scalar.
   * @param scalar - Scalar value
   * @returns A new scaled vector
   */
  multiplyScalar(scalar: number): Vector2 {
    return new Vector2(this.x * scalar, this.y * scalar);
  }

  /**
   * Multiplies this vector by a scalar (mutates this vector).
   * @param scalar - Scalar value
   * @returns This vector for chaining
   */
  multiplyScalarSelf(scalar: number): Vector2 {
    this.x *= scalar;
    this.y *= scalar;
    return this;
  }

  /**
   * Component-wise multiplication with another vector.
   * @param v - Vector to multiply with
   * @returns A new vector with component-wise product
   */
  multiply(v: Vector2): Vector2 {
    return new Vector2(this.x * v.x, this.y * v.y);
  }

  /**
   * Component-wise multiplication with another vector (mutates this vector).
   * @param v - Vector to multiply with
   * @returns This vector for chaining
   */
  multiplySelf(v: Vector2): Vector2 {
    this.x *= v.x;
    this.y *= v.y;
    return this;
  }

  /**
   * Divides this vector by a scalar.
   * @param scalar - Scalar value (must not be zero)
   * @returns A new divided vector
   */
  divideScalar(scalar: number): Vector2 {
    if (scalar === 0) {
      console.warn('Vector2.divideScalar: Division by zero');
      return new Vector2(0, 0);
    }
    return new Vector2(this.x / scalar, this.y / scalar);
  }

  /**
   * Divides this vector by a scalar (mutates this vector).
   * @param scalar - Scalar value (must not be zero)
   * @returns This vector for chaining
   */
  divideScalarSelf(scalar: number): Vector2 {
    if (scalar === 0) {
      console.warn('Vector2.divideScalarSelf: Division by zero');
      return this;
    }
    this.x /= scalar;
    this.y /= scalar;
    return this;
  }

  /**
   * Calculates the dot product with another vector.
   * @param v - Vector to dot with
   * @returns The dot product
   */
  dot(v: Vector2): number {
    return this.x * v.x + this.y * v.y;
  }

  /**
   * Calculates the 2D cross product (scalar value).
   * Returns the z-component of the 3D cross product.
   * @param v - Vector to cross with
   * @returns The cross product scalar
   */
  cross(v: Vector2): number {
    return this.x * v.y - this.y * v.x;
  }

  /**
   * Calculates the length (magnitude) of this vector.
   * @returns The length
   */
  length(): number {
    return Math.sqrt(this.x * this.x + this.y * this.y);
  }

  /**
   * Calculates the squared length of this vector.
   * Faster than length() as it avoids the square root.
   * @returns The squared length
   */
  lengthSquared(): number {
    return this.x * this.x + this.y * this.y;
  }

  /**
   * Normalizes this vector to unit length.
   * @returns A new normalized vector
   */
  normalize(): Vector2 {
    const len = this.length();
    if (len === 0) {
      console.warn('Vector2.normalize: Cannot normalize zero vector');
      return new Vector2(0, 0);
    }
    return this.divideScalar(len);
  }

  /**
   * Normalizes this vector to unit length (mutates this vector).
   * @returns This vector for chaining
   */
  normalizeSelf(): Vector2 {
    const len = this.length();
    if (len === 0) {
      console.warn('Vector2.normalizeSelf: Cannot normalize zero vector');
      return this;
    }
    return this.divideScalarSelf(len);
  }

  /**
   * Calculates the distance to another vector.
   * @param v - Target vector
   * @returns The distance
   */
  distanceTo(v: Vector2): number {
    return this.subtract(v).length();
  }

  /**
   * Calculates the squared distance to another vector.
   * Faster than distanceTo() as it avoids the square root.
   * @param v - Target vector
   * @returns The squared distance
   */
  distanceToSquared(v: Vector2): number {
    return this.subtract(v).lengthSquared();
  }

  /**
   * Calculates the angle of this vector in radians.
   * @returns Angle in radians
   */
  angle(): number {
    return Math.atan2(this.y, this.x);
  }

  /**
   * Calculates the angle between this vector and another in radians.
   * @param v - Target vector
   * @returns Angle in radians
   */
  angleTo(v: Vector2): number {
    const dot = this.dot(v);
    const len = this.length() * v.length();
    if (len === 0) return 0;
    return Math.acos(Math.max(-1, Math.min(1, dot / len)));
  }

  /**
   * Rotates this vector by an angle in radians.
   * @param angle - Rotation angle in radians
   * @returns A new rotated vector
   */
  rotate(angle: number): Vector2 {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return new Vector2(
      this.x * cos - this.y * sin,
      this.x * sin + this.y * cos
    );
  }

  /**
   * Rotates this vector by an angle in radians (mutates this vector).
   * @param angle - Rotation angle in radians
   * @returns This vector for chaining
   */
  rotateSelf(angle: number): Vector2 {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const x = this.x * cos - this.y * sin;
    const y = this.x * sin + this.y * cos;
    this.x = x;
    this.y = y;
    return this;
  }

  /**
   * Linearly interpolates between this vector and another.
   * @param v - Target vector
   * @param t - Interpolation factor (0-1)
   * @returns A new interpolated vector
   */
  lerp(v: Vector2, t: number): Vector2 {
    return new Vector2(
      this.x + (v.x - this.x) * t,
      this.y + (v.y - this.y) * t
    );
  }

  /**
   * Linearly interpolates between this vector and another (mutates this vector).
   * @param v - Target vector
   * @param t - Interpolation factor (0-1)
   * @returns This vector for chaining
   */
  lerpSelf(v: Vector2, t: number): Vector2 {
    this.x += (v.x - this.x) * t;
    this.y += (v.y - this.y) * t;
    return this;
  }

  /**
   * Negates this vector.
   * @returns A new negated vector
   */
  negate(): Vector2 {
    return new Vector2(-this.x, -this.y);
  }

  /**
   * Negates this vector (mutates this vector).
   * @returns This vector for chaining
   */
  negateSelf(): Vector2 {
    this.x = -this.x;
    this.y = -this.y;
    return this;
  }

  /**
   * Returns a perpendicular vector (rotated 90 degrees counter-clockwise).
   * @returns A new perpendicular vector
   */
  perpendicular(): Vector2 {
    return new Vector2(-this.y, this.x);
  }

  /**
   * Checks if this vector equals another vector (within epsilon tolerance).
   * @param v - Vector to compare with
   * @param epsilon - Tolerance for comparison (default: 1e-10)
   * @returns True if vectors are equal within tolerance
   */
  equals(v: Vector2, epsilon: number = 1e-10): boolean {
    return (
      Math.abs(this.x - v.x) < epsilon &&
      Math.abs(this.y - v.y) < epsilon
    );
  }

  /**
   * Clamps this vector's components between min and max values.
   * @param min - Minimum vector
   * @param max - Maximum vector
   * @returns A new clamped vector
   */
  clamp(min: Vector2, max: Vector2): Vector2 {
    return new Vector2(
      Math.max(min.x, Math.min(max.x, this.x)),
      Math.max(min.y, Math.min(max.y, this.y))
    );
  }

  /**
   * Clamps this vector's components between min and max values (mutates this vector).
   * @param min - Minimum vector
   * @param max - Maximum vector
   * @returns This vector for chaining
   */
  clampSelf(min: Vector2, max: Vector2): Vector2 {
    this.x = Math.max(min.x, Math.min(max.x, this.x));
    this.y = Math.max(min.y, Math.min(max.y, this.y));
    return this;
  }

  /**
   * Returns the minimum components from this vector and another.
   * @param v - Vector to compare with
   * @returns A new vector with minimum components
   */
  min(v: Vector2): Vector2 {
    return new Vector2(
      Math.min(this.x, v.x),
      Math.min(this.y, v.y)
    );
  }

  /**
   * Returns the maximum components from this vector and another.
   * @param v - Vector to compare with
   * @returns A new vector with maximum components
   */
  max(v: Vector2): Vector2 {
    return new Vector2(
      Math.max(this.x, v.x),
      Math.max(this.y, v.y)
    );
  }

  /**
   * Applies a function to each component.
   * @param fn - Function to apply
   * @returns A new vector with transformed components
   */
  map(fn: (value: number) => number): Vector2 {
    return new Vector2(fn(this.x), fn(this.y));
  }

  /**
   * Converts this vector to an array.
   * @returns Array containing [x, y]
   */
  toArray(): [number, number] {
    return [this.x, this.y];
  }

  /**
   * Creates a vector from an array.
   * @param arr - Array containing [x, y]
   * @returns A new Vector2
   */
  static fromArray(arr: number[]): Vector2 {
    return new Vector2(arr[0] || 0, arr[1] || 0);
  }

  /**
   * Creates a vector from an angle and length.
   * @param angle - Angle in radians
   * @param length - Length of vector (default: 1)
   * @returns A new Vector2
   */
  static fromAngle(angle: number, length: number = 1): Vector2 {
    return new Vector2(Math.cos(angle) * length, Math.sin(angle) * length);
  }

  /**
   * Converts this vector to a string representation.
   * @returns String representation
   */
  toString(): string {
    return `Vector2(${this.x.toFixed(3)}, ${this.y.toFixed(3)})`;
  }

  /**
   * Converts this vector to a JSON-serializable object.
   * @returns Object with x, y properties
   */
  toJSON(): { x: number; y: number } {
    return { x: this.x, y: this.y };
  }

  /**
   * Creates a vector from a JSON object.
   * @param json - Object with x, y properties
   * @returns A new Vector2
   */
  static fromJSON(json: { x: number; y: number }): Vector2 {
    return new Vector2(json.x, json.y);
  }
}
