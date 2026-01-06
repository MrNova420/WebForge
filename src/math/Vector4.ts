/**
 * @module math
 * @fileoverview Vector4 class - 4D vector implementation with comprehensive operations
 */

/**
 * Represents a 4D vector with x, y, z, and w components.
 * Commonly used for homogeneous coordinates and RGBA colors.
 * 
 * @example
 * ```typescript
 * const v1 = new Vector4(1, 2, 3, 1);
 * const v2 = new Vector4(4, 5, 6, 1);
 * const sum = v1.add(v2);
 * const length = v1.length();
 * ```
 */
export class Vector4 {
  /**
   * Creates a new Vector4.
   * @param x - X component (default: 0)
   * @param y - Y component (default: 0)
   * @param z - Z component (default: 0)
   * @param w - W component (default: 1)
   */
  constructor(
    public x: number = 0,
    public y: number = 0,
    public z: number = 0,
    public w: number = 1
  ) {}

  /**
   * Creates a new Vector4 with all components set to zero.
   * @returns A zero vector (0, 0, 0, 0)
   */
  static zero(): Vector4 {
    return new Vector4(0, 0, 0, 0);
  }

  /**
   * Creates a new Vector4 with all components set to one.
   * @returns A unit vector (1, 1, 1, 1)
   */
  static one(): Vector4 {
    return new Vector4(1, 1, 1, 1);
  }

  /**
   * Creates a copy of this vector.
   * @returns A new Vector4 with the same components
   */
  clone(): Vector4 {
    return new Vector4(this.x, this.y, this.z, this.w);
  }

  /**
   * Copies components from another vector.
   * @param v - Source vector
   * @returns This vector for chaining
   */
  copy(v: Vector4): Vector4 {
    this.x = v.x;
    this.y = v.y;
    this.z = v.z;
    this.w = v.w;
    return this;
  }

  /**
   * Sets the components of this vector.
   * @param x - X component
   * @param y - Y component
   * @param z - Z component
   * @param w - W component
   * @returns This vector for chaining
   */
  set(x: number, y: number, z: number, w: number): Vector4 {
    this.x = x;
    this.y = y;
    this.z = z;
    this.w = w;
    return this;
  }

  /**
   * Adds another vector to this vector.
   * @param v - Vector to add
   * @returns A new vector containing the sum
   */
  add(v: Vector4): Vector4 {
    return new Vector4(this.x + v.x, this.y + v.y, this.z + v.z, this.w + v.w);
  }

  /**
   * Adds another vector to this vector (mutates this vector).
   * @param v - Vector to add
   * @returns This vector for chaining
   */
  addSelf(v: Vector4): Vector4 {
    this.x += v.x;
    this.y += v.y;
    this.z += v.z;
    this.w += v.w;
    return this;
  }

  /**
   * Subtracts another vector from this vector.
   * @param v - Vector to subtract
   * @returns A new vector containing the difference
   */
  subtract(v: Vector4): Vector4 {
    return new Vector4(this.x - v.x, this.y - v.y, this.z - v.z, this.w - v.w);
  }

  /**
   * Subtracts another vector from this vector (mutates this vector).
   * @param v - Vector to subtract
   * @returns This vector for chaining
   */
  subtractSelf(v: Vector4): Vector4 {
    this.x -= v.x;
    this.y -= v.y;
    this.z -= v.z;
    this.w -= v.w;
    return this;
  }

  /**
   * Multiplies this vector by a scalar.
   * @param scalar - Scalar value
   * @returns A new scaled vector
   */
  multiplyScalar(scalar: number): Vector4 {
    return new Vector4(this.x * scalar, this.y * scalar, this.z * scalar, this.w * scalar);
  }

  /**
   * Multiplies this vector by a scalar (mutates this vector).
   * @param scalar - Scalar value
   * @returns This vector for chaining
   */
  multiplyScalarSelf(scalar: number): Vector4 {
    this.x *= scalar;
    this.y *= scalar;
    this.z *= scalar;
    this.w *= scalar;
    return this;
  }

  /**
   * Component-wise multiplication with another vector.
   * @param v - Vector to multiply with
   * @returns A new vector with component-wise product
   */
  multiply(v: Vector4): Vector4 {
    return new Vector4(this.x * v.x, this.y * v.y, this.z * v.z, this.w * v.w);
  }

  /**
   * Component-wise multiplication with another vector (mutates this vector).
   * @param v - Vector to multiply with
   * @returns This vector for chaining
   */
  multiplySelf(v: Vector4): Vector4 {
    this.x *= v.x;
    this.y *= v.y;
    this.z *= v.z;
    this.w *= v.w;
    return this;
  }

  /**
   * Divides this vector by a scalar.
   * @param scalar - Scalar value (must not be zero)
   * @returns A new divided vector
   */
  divideScalar(scalar: number): Vector4 {
    if (scalar === 0) {
      console.warn('Vector4.divideScalar: Division by zero');
      return new Vector4(0, 0, 0, 0);
    }
    return new Vector4(this.x / scalar, this.y / scalar, this.z / scalar, this.w / scalar);
  }

  /**
   * Divides this vector by a scalar (mutates this vector).
   * @param scalar - Scalar value (must not be zero)
   * @returns This vector for chaining
   */
  divideScalarSelf(scalar: number): Vector4 {
    if (scalar === 0) {
      console.warn('Vector4.divideScalarSelf: Division by zero');
      return this;
    }
    this.x /= scalar;
    this.y /= scalar;
    this.z /= scalar;
    this.w /= scalar;
    return this;
  }

  /**
   * Calculates the dot product with another vector.
   * @param v - Vector to dot with
   * @returns The dot product
   */
  dot(v: Vector4): number {
    return this.x * v.x + this.y * v.y + this.z * v.z + this.w * v.w;
  }

  /**
   * Calculates the length (magnitude) of this vector.
   * @returns The length
   */
  length(): number {
    return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z + this.w * this.w);
  }

  /**
   * Calculates the squared length of this vector.
   * Faster than length() as it avoids the square root.
   * @returns The squared length
   */
  lengthSquared(): number {
    return this.x * this.x + this.y * this.y + this.z * this.z + this.w * this.w;
  }

  /**
   * Normalizes this vector to unit length.
   * @returns A new normalized vector
   */
  normalize(): Vector4 {
    const len = this.length();
    if (len === 0) {
      console.warn('Vector4.normalize: Cannot normalize zero vector');
      return new Vector4(0, 0, 0, 0);
    }
    return this.divideScalar(len);
  }

  /**
   * Normalizes this vector to unit length (mutates this vector).
   * @returns This vector for chaining
   */
  normalizeSelf(): Vector4 {
    const len = this.length();
    if (len === 0) {
      console.warn('Vector4.normalizeSelf: Cannot normalize zero vector');
      return this;
    }
    return this.divideScalarSelf(len);
  }

  /**
   * Calculates the distance to another vector.
   * @param v - Target vector
   * @returns The distance
   */
  distanceTo(v: Vector4): number {
    return this.subtract(v).length();
  }

  /**
   * Calculates the squared distance to another vector.
   * Faster than distanceTo() as it avoids the square root.
   * @param v - Target vector
   * @returns The squared distance
   */
  distanceToSquared(v: Vector4): number {
    return this.subtract(v).lengthSquared();
  }

  /**
   * Linearly interpolates between this vector and another.
   * @param v - Target vector
   * @param t - Interpolation factor (0-1)
   * @returns A new interpolated vector
   */
  lerp(v: Vector4, t: number): Vector4 {
    return new Vector4(
      this.x + (v.x - this.x) * t,
      this.y + (v.y - this.y) * t,
      this.z + (v.z - this.z) * t,
      this.w + (v.w - this.w) * t
    );
  }

  /**
   * Linearly interpolates between this vector and another (mutates this vector).
   * @param v - Target vector
   * @param t - Interpolation factor (0-1)
   * @returns This vector for chaining
   */
  lerpSelf(v: Vector4, t: number): Vector4 {
    this.x += (v.x - this.x) * t;
    this.y += (v.y - this.y) * t;
    this.z += (v.z - this.z) * t;
    this.w += (v.w - this.w) * t;
    return this;
  }

  /**
   * Negates this vector.
   * @returns A new negated vector
   */
  negate(): Vector4 {
    return new Vector4(-this.x, -this.y, -this.z, -this.w);
  }

  /**
   * Negates this vector (mutates this vector).
   * @returns This vector for chaining
   */
  negateSelf(): Vector4 {
    this.x = -this.x;
    this.y = -this.y;
    this.z = -this.z;
    this.w = -this.w;
    return this;
  }

  /**
   * Checks if this vector equals another vector (within epsilon tolerance).
   * @param v - Vector to compare with
   * @param epsilon - Tolerance for comparison (default: 1e-10)
   * @returns True if vectors are equal within tolerance
   */
  equals(v: Vector4, epsilon: number = 1e-10): boolean {
    return (
      Math.abs(this.x - v.x) < epsilon &&
      Math.abs(this.y - v.y) < epsilon &&
      Math.abs(this.z - v.z) < epsilon &&
      Math.abs(this.w - v.w) < epsilon
    );
  }

  /**
   * Clamps this vector's components between min and max values.
   * @param min - Minimum vector
   * @param max - Maximum vector
   * @returns A new clamped vector
   */
  clamp(min: Vector4, max: Vector4): Vector4 {
    return new Vector4(
      Math.max(min.x, Math.min(max.x, this.x)),
      Math.max(min.y, Math.min(max.y, this.y)),
      Math.max(min.z, Math.min(max.z, this.z)),
      Math.max(min.w, Math.min(max.w, this.w))
    );
  }

  /**
   * Clamps this vector's components between min and max values (mutates this vector).
   * @param min - Minimum vector
   * @param max - Maximum vector
   * @returns This vector for chaining
   */
  clampSelf(min: Vector4, max: Vector4): Vector4 {
    this.x = Math.max(min.x, Math.min(max.x, this.x));
    this.y = Math.max(min.y, Math.min(max.y, this.y));
    this.z = Math.max(min.z, Math.min(max.z, this.z));
    this.w = Math.max(min.w, Math.min(max.w, this.w));
    return this;
  }

  /**
   * Returns the minimum components from this vector and another.
   * @param v - Vector to compare with
   * @returns A new vector with minimum components
   */
  min(v: Vector4): Vector4 {
    return new Vector4(
      Math.min(this.x, v.x),
      Math.min(this.y, v.y),
      Math.min(this.z, v.z),
      Math.min(this.w, v.w)
    );
  }

  /**
   * Returns the maximum components from this vector and another.
   * @param v - Vector to compare with
   * @returns A new vector with maximum components
   */
  max(v: Vector4): Vector4 {
    return new Vector4(
      Math.max(this.x, v.x),
      Math.max(this.y, v.y),
      Math.max(this.z, v.z),
      Math.max(this.w, v.w)
    );
  }

  /**
   * Applies a function to each component.
   * @param fn - Function to apply
   * @returns A new vector with transformed components
   */
  map(fn: (value: number) => number): Vector4 {
    return new Vector4(fn(this.x), fn(this.y), fn(this.z), fn(this.w));
  }

  /**
   * Converts this vector to an array.
   * @returns Array containing [x, y, z, w]
   */
  toArray(): [number, number, number, number] {
    return [this.x, this.y, this.z, this.w];
  }

  /**
   * Creates a vector from an array.
   * @param arr - Array containing [x, y, z, w]
   * @returns A new Vector4
   */
  static fromArray(arr: number[]): Vector4 {
    return new Vector4(arr[0] || 0, arr[1] || 0, arr[2] || 0, arr[3] || 1);
  }

  /**
   * Converts this vector to a string representation.
   * @returns String representation
   */
  toString(): string {
    return `Vector4(${this.x.toFixed(3)}, ${this.y.toFixed(3)}, ${this.z.toFixed(3)}, ${this.w.toFixed(3)})`;
  }

  /**
   * Converts this vector to a JSON-serializable object.
   * @returns Object with x, y, z, w properties
   */
  toJSON(): { x: number; y: number; z: number; w: number } {
    return { x: this.x, y: this.y, z: this.z, w: this.w };
  }

  /**
   * Creates a vector from a JSON object.
   * @param json - Object with x, y, z, w properties
   * @returns A new Vector4
   */
  static fromJSON(json: { x: number; y: number; z: number; w: number }): Vector4 {
    return new Vector4(json.x, json.y, json.z, json.w);
  }
}
