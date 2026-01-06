/**
 * @module math
 * @fileoverview Vector3 class - 3D vector implementation with comprehensive operations
 */

/**
 * Represents a 3D vector with x, y, and z components.
 * Provides comprehensive vector operations for 3D mathematics.
 * 
 * @example
 * ```typescript
 * const v1 = new Vector3(1, 2, 3);
 * const v2 = new Vector3(4, 5, 6);
 * const sum = v1.add(v2);
 * const length = v1.length();
 * ```
 */
export class Vector3 {
  /**
   * Creates a new Vector3.
   * @param x - X component (default: 0)
   * @param y - Y component (default: 0)
   * @param z - Z component (default: 0)
   */
  constructor(
    public x: number = 0,
    public y: number = 0,
    public z: number = 0
  ) {}

  /**
   * Creates a new Vector3 with all components set to zero.
   * @returns A zero vector (0, 0, 0)
   */
  static zero(): Vector3 {
    return new Vector3(0, 0, 0);
  }

  /**
   * Creates a new Vector3 with all components set to one.
   * @returns A unit vector (1, 1, 1)
   */
  static one(): Vector3 {
    return new Vector3(1, 1, 1);
  }

  /**
   * Creates a unit vector pointing up (0, 1, 0).
   * @returns Up vector
   */
  static up(): Vector3 {
    return new Vector3(0, 1, 0);
  }

  /**
   * Creates a unit vector pointing down (0, -1, 0).
   * @returns Down vector
   */
  static down(): Vector3 {
    return new Vector3(0, -1, 0);
  }

  /**
   * Creates a unit vector pointing left (-1, 0, 0).
   * @returns Left vector
   */
  static left(): Vector3 {
    return new Vector3(-1, 0, 0);
  }

  /**
   * Creates a unit vector pointing right (1, 0, 0).
   * @returns Right vector
   */
  static right(): Vector3 {
    return new Vector3(1, 0, 0);
  }

  /**
   * Creates a unit vector pointing forward (0, 0, -1) (negative Z in WebGL).
   * @returns Forward vector
   */
  static forward(): Vector3 {
    return new Vector3(0, 0, -1);
  }

  /**
   * Creates a unit vector pointing back (0, 0, 1).
   * @returns Back vector
   */
  static back(): Vector3 {
    return new Vector3(0, 0, 1);
  }

  /**
   * Creates a copy of this vector.
   * @returns A new Vector3 with the same components
   */
  clone(): Vector3 {
    return new Vector3(this.x, this.y, this.z);
  }

  /**
   * Copies components from another vector.
   * @param v - Source vector
   * @returns This vector for chaining
   */
  copy(v: Vector3): Vector3 {
    this.x = v.x;
    this.y = v.y;
    this.z = v.z;
    return this;
  }

  /**
   * Sets the components of this vector.
   * @param x - X component
   * @param y - Y component
   * @param z - Z component
   * @returns This vector for chaining
   */
  set(x: number, y: number, z: number): Vector3 {
    this.x = x;
    this.y = y;
    this.z = z;
    return this;
  }

  /**
   * Adds another vector to this vector.
   * @param v - Vector to add
   * @returns A new vector containing the sum
   */
  add(v: Vector3): Vector3 {
    return new Vector3(this.x + v.x, this.y + v.y, this.z + v.z);
  }

  /**
   * Adds another vector to this vector (mutates this vector).
   * @param v - Vector to add
   * @returns This vector for chaining
   */
  addSelf(v: Vector3): Vector3 {
    this.x += v.x;
    this.y += v.y;
    this.z += v.z;
    return this;
  }

  /**
   * Subtracts another vector from this vector.
   * @param v - Vector to subtract
   * @returns A new vector containing the difference
   */
  subtract(v: Vector3): Vector3 {
    return new Vector3(this.x - v.x, this.y - v.y, this.z - v.z);
  }

  /**
   * Subtracts another vector from this vector (mutates this vector).
   * @param v - Vector to subtract
   * @returns This vector for chaining
   */
  subtractSelf(v: Vector3): Vector3 {
    this.x -= v.x;
    this.y -= v.y;
    this.z -= v.z;
    return this;
  }

  /**
   * Multiplies this vector by a scalar.
   * @param scalar - Scalar value
   * @returns A new scaled vector
   */
  multiplyScalar(scalar: number): Vector3 {
    return new Vector3(this.x * scalar, this.y * scalar, this.z * scalar);
  }

  /**
   * Multiplies this vector by a scalar (mutates this vector).
   * @param scalar - Scalar value
   * @returns This vector for chaining
   */
  multiplyScalarSelf(scalar: number): Vector3 {
    this.x *= scalar;
    this.y *= scalar;
    this.z *= scalar;
    return this;
  }

  /**
   * Component-wise multiplication with another vector.
   * @param v - Vector to multiply with
   * @returns A new vector with component-wise product
   */
  multiply(v: Vector3): Vector3 {
    return new Vector3(this.x * v.x, this.y * v.y, this.z * v.z);
  }

  /**
   * Component-wise multiplication with another vector (mutates this vector).
   * @param v - Vector to multiply with
   * @returns This vector for chaining
   */
  multiplySelf(v: Vector3): Vector3 {
    this.x *= v.x;
    this.y *= v.y;
    this.z *= v.z;
    return this;
  }

  /**
   * Divides this vector by a scalar.
   * @param scalar - Scalar value (must not be zero)
   * @returns A new divided vector
   */
  divideScalar(scalar: number): Vector3 {
    if (scalar === 0) {
      console.warn('Vector3.divideScalar: Division by zero');
      return new Vector3(0, 0, 0);
    }
    return new Vector3(this.x / scalar, this.y / scalar, this.z / scalar);
  }

  /**
   * Divides this vector by a scalar (mutates this vector).
   * @param scalar - Scalar value (must not be zero)
   * @returns This vector for chaining
   */
  divideScalarSelf(scalar: number): Vector3 {
    if (scalar === 0) {
      console.warn('Vector3.divideScalarSelf: Division by zero');
      return this;
    }
    this.x /= scalar;
    this.y /= scalar;
    this.z /= scalar;
    return this;
  }

  /**
   * Calculates the dot product with another vector.
   * @param v - Vector to dot with
   * @returns The dot product
   */
  dot(v: Vector3): number {
    return this.x * v.x + this.y * v.y + this.z * v.z;
  }

  /**
   * Calculates the cross product with another vector.
   * Returns a vector perpendicular to both vectors.
   * @param v - Vector to cross with
   * @returns A new vector containing the cross product
   */
  cross(v: Vector3): Vector3 {
    return new Vector3(
      this.y * v.z - this.z * v.y,
      this.z * v.x - this.x * v.z,
      this.x * v.y - this.y * v.x
    );
  }

  /**
   * Calculates the cross product with another vector (mutates this vector).
   * @param v - Vector to cross with
   * @returns This vector for chaining
   */
  crossSelf(v: Vector3): Vector3 {
    const x = this.y * v.z - this.z * v.y;
    const y = this.z * v.x - this.x * v.z;
    const z = this.x * v.y - this.y * v.x;
    this.x = x;
    this.y = y;
    this.z = z;
    return this;
  }

  /**
   * Calculates the length (magnitude) of this vector.
   * @returns The length
   */
  length(): number {
    return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
  }

  /**
   * Calculates the squared length of this vector.
   * Faster than length() as it avoids the square root.
   * @returns The squared length
   */
  lengthSquared(): number {
    return this.x * this.x + this.y * this.y + this.z * this.z;
  }

  /**
   * Normalizes this vector to unit length.
   * @returns A new normalized vector
   */
  normalize(): Vector3 {
    const len = this.length();
    if (len === 0) {
      console.warn('Vector3.normalize: Cannot normalize zero vector');
      return new Vector3(0, 0, 0);
    }
    return this.divideScalar(len);
  }

  /**
   * Normalizes this vector to unit length (mutates this vector).
   * @returns This vector for chaining
   */
  normalizeSelf(): Vector3 {
    const len = this.length();
    if (len === 0) {
      console.warn('Vector3.normalizeSelf: Cannot normalize zero vector');
      return this;
    }
    return this.divideScalarSelf(len);
  }

  /**
   * Calculates the distance to another vector.
   * @param v - Target vector
   * @returns The distance
   */
  distanceTo(v: Vector3): number {
    return this.subtract(v).length();
  }

  /**
   * Calculates the squared distance to another vector.
   * Faster than distanceTo() as it avoids the square root.
   * @param v - Target vector
   * @returns The squared distance
   */
  distanceToSquared(v: Vector3): number {
    return this.subtract(v).lengthSquared();
  }

  /**
   * Linearly interpolates between this vector and another.
   * @param v - Target vector
   * @param t - Interpolation factor (0-1)
   * @returns A new interpolated vector
   */
  lerp(v: Vector3, t: number): Vector3 {
    return new Vector3(
      this.x + (v.x - this.x) * t,
      this.y + (v.y - this.y) * t,
      this.z + (v.z - this.z) * t
    );
  }

  /**
   * Linearly interpolates between this vector and another (mutates this vector).
   * @param v - Target vector
   * @param t - Interpolation factor (0-1)
   * @returns This vector for chaining
   */
  lerpSelf(v: Vector3, t: number): Vector3 {
    this.x += (v.x - this.x) * t;
    this.y += (v.y - this.y) * t;
    this.z += (v.z - this.z) * t;
    return this;
  }

  /**
   * Negates this vector.
   * @returns A new negated vector
   */
  negate(): Vector3 {
    return new Vector3(-this.x, -this.y, -this.z);
  }

  /**
   * Negates this vector (mutates this vector).
   * @returns This vector for chaining
   */
  negateSelf(): Vector3 {
    this.x = -this.x;
    this.y = -this.y;
    this.z = -this.z;
    return this;
  }

  /**
   * Checks if this vector equals another vector (within epsilon tolerance).
   * @param v - Vector to compare with
   * @param epsilon - Tolerance for comparison (default: 1e-10)
   * @returns True if vectors are equal within tolerance
   */
  equals(v: Vector3, epsilon: number = 1e-10): boolean {
    return (
      Math.abs(this.x - v.x) < epsilon &&
      Math.abs(this.y - v.y) < epsilon &&
      Math.abs(this.z - v.z) < epsilon
    );
  }

  /**
   * Clamps this vector's components between min and max values.
   * @param min - Minimum vector
   * @param max - Maximum vector
   * @returns A new clamped vector
   */
  clamp(min: Vector3, max: Vector3): Vector3 {
    return new Vector3(
      Math.max(min.x, Math.min(max.x, this.x)),
      Math.max(min.y, Math.min(max.y, this.y)),
      Math.max(min.z, Math.min(max.z, this.z))
    );
  }

  /**
   * Clamps this vector's components between min and max values (mutates this vector).
   * @param min - Minimum vector
   * @param max - Maximum vector
   * @returns This vector for chaining
   */
  clampSelf(min: Vector3, max: Vector3): Vector3 {
    this.x = Math.max(min.x, Math.min(max.x, this.x));
    this.y = Math.max(min.y, Math.min(max.y, this.y));
    this.z = Math.max(min.z, Math.min(max.z, this.z));
    return this;
  }

  /**
   * Returns the minimum components from this vector and another.
   * @param v - Vector to compare with
   * @returns A new vector with minimum components
   */
  min(v: Vector3): Vector3 {
    return new Vector3(
      Math.min(this.x, v.x),
      Math.min(this.y, v.y),
      Math.min(this.z, v.z)
    );
  }

  /**
   * Returns the maximum components from this vector and another.
   * @param v - Vector to compare with
   * @returns A new vector with maximum components
   */
  max(v: Vector3): Vector3 {
    return new Vector3(
      Math.max(this.x, v.x),
      Math.max(this.y, v.y),
      Math.max(this.z, v.z)
    );
  }

  /**
   * Applies a function to each component.
   * @param fn - Function to apply
   * @returns A new vector with transformed components
   */
  map(fn: (value: number) => number): Vector3 {
    return new Vector3(fn(this.x), fn(this.y), fn(this.z));
  }

  /**
   * Converts this vector to an array.
   * @returns Array containing [x, y, z]
   */
  toArray(): [number, number, number] {
    return [this.x, this.y, this.z];
  }

  /**
   * Creates a vector from an array.
   * @param arr - Array containing [x, y, z]
   * @returns A new Vector3
   */
  static fromArray(arr: number[]): Vector3 {
    return new Vector3(arr[0] || 0, arr[1] || 0, arr[2] || 0);
  }

  /**
   * Converts this vector to a string representation.
   * @returns String representation
   */
  toString(): string {
    return `Vector3(${this.x.toFixed(3)}, ${this.y.toFixed(3)}, ${this.z.toFixed(3)})`;
  }

  /**
   * Converts this vector to a JSON-serializable object.
   * @returns Object with x, y, z properties
   */
  toJSON(): { x: number; y: number; z: number } {
    return { x: this.x, y: this.y, z: this.z };
  }

  /**
   * Creates a vector from a JSON object.
   * @param json - Object with x, y, z properties
   * @returns A new Vector3
   */
  static fromJSON(json: { x: number; y: number; z: number }): Vector3 {
    return new Vector3(json.x, json.y, json.z);
  }
}
