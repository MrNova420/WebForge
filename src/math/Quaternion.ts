/**
 * @module math
 * @fileoverview Quaternion class - 4D rotation representation
 */

import { Vector3 } from './Vector3';
import { Matrix4 } from './Matrix4';

/**
 * Represents a quaternion for 3D rotations.
 * Quaternions are more efficient than matrices for rotations and avoid gimbal lock.
 * Stored as (x, y, z, w) where w is the scalar component.
 * 
 * @example
 * ```typescript
 * const q = Quaternion.fromAxisAngle(Vector3.up(), Math.PI / 2);
 * const v = new Vector3(1, 0, 0);
 * const rotated = q.multiplyVector(v);
 * ```
 */
export class Quaternion {
  /**
   * Creates a new Quaternion.
   * @param x - X component (default: 0)
   * @param y - Y component (default: 0)
   * @param z - Z component (default: 0)
   * @param w - W component (scalar, default: 1)
   */
  constructor(
    public x: number = 0,
    public y: number = 0,
    public z: number = 0,
    public w: number = 1
  ) {}

  /**
   * Creates an identity quaternion (no rotation).
   * @returns Identity quaternion (0, 0, 0, 1)
   */
  static identity(): Quaternion {
    return new Quaternion(0, 0, 0, 1);
  }

  /**
   * Creates a copy of this quaternion.
   * @returns A new Quaternion with the same components
   */
  clone(): Quaternion {
    return new Quaternion(this.x, this.y, this.z, this.w);
  }

  /**
   * Copies components from another quaternion.
   * @param q - Source quaternion
   * @returns This quaternion for chaining
   */
  copy(q: Quaternion): Quaternion {
    this.x = q.x;
    this.y = q.y;
    this.z = q.z;
    this.w = q.w;
    return this;
  }

  /**
   * Sets the components of this quaternion.
   * @param x - X component
   * @param y - Y component
   * @param z - Z component
   * @param w - W component
   * @returns This quaternion for chaining
   */
  set(x: number, y: number, z: number, w: number): Quaternion {
    this.x = x;
    this.y = y;
    this.z = z;
    this.w = w;
    return this;
  }

  /**
   * Creates a quaternion from an axis and angle.
   * @param axis - Rotation axis (should be normalized)
   * @param angle - Rotation angle in radians
   * @returns A new Quaternion representing the rotation
   */
  static fromAxisAngle(axis: Vector3, angle: number): Quaternion {
    const halfAngle = angle / 2;
    const s = Math.sin(halfAngle);
    const axisNorm = axis.normalize();
    
    return new Quaternion(
      axisNorm.x * s,
      axisNorm.y * s,
      axisNorm.z * s,
      Math.cos(halfAngle)
    );
  }

  /**
   * Converts this quaternion to an axis and angle.
   * @returns Object with axis (Vector3) and angle (number in radians)
   */
  toAxisAngle(): { axis: Vector3; angle: number } {
    const quaternion = this.w > 1 ? this.normalize() : this.clone();
    const angle = 2 * Math.acos(quaternion.w);
    const s = Math.sqrt(1 - quaternion.w * quaternion.w);
    
    if (s < 0.001) {
      return {
        axis: new Vector3(1, 0, 0),
        angle: 0
      };
    }
    
    return {
      axis: new Vector3(
        quaternion.x / s,
        quaternion.y / s,
        quaternion.z / s
      ),
      angle: angle
    };
  }

  /**
   * Creates a quaternion from Euler angles (X, Y, Z order).
   * @param x - Rotation around X axis in radians
   * @param y - Rotation around Y axis in radians
   * @param z - Rotation around Z axis in radians
   * @returns A new Quaternion
   */
  static fromEuler(x: number, y: number, z: number): Quaternion {
    const c1 = Math.cos(x / 2);
    const c2 = Math.cos(y / 2);
    const c3 = Math.cos(z / 2);
    const s1 = Math.sin(x / 2);
    const s2 = Math.sin(y / 2);
    const s3 = Math.sin(z / 2);

    return new Quaternion(
      s1 * c2 * c3 + c1 * s2 * s3,
      c1 * s2 * c3 - s1 * c2 * s3,
      c1 * c2 * s3 + s1 * s2 * c3,
      c1 * c2 * c3 - s1 * s2 * s3
    );
  }

  /**
   * Converts this quaternion to Euler angles (X, Y, Z order).
   * @returns Vector3 with Euler angles in radians
   */
  toEuler(): Vector3 {
    const sinr_cosp = 2 * (this.w * this.x + this.y * this.z);
    const cosr_cosp = 1 - 2 * (this.x * this.x + this.y * this.y);
    const x = Math.atan2(sinr_cosp, cosr_cosp);

    const sinp = 2 * (this.w * this.y - this.z * this.x);
    let y: number;
    if (Math.abs(sinp) >= 1) {
      y = Math.sign(sinp) * Math.PI / 2;
    } else {
      y = Math.asin(sinp);
    }

    const siny_cosp = 2 * (this.w * this.z + this.x * this.y);
    const cosy_cosp = 1 - 2 * (this.y * this.y + this.z * this.z);
    const z = Math.atan2(siny_cosp, cosy_cosp);

    return new Vector3(x, y, z);
  }

  /**
   * Creates a quaternion from a rotation matrix.
   * @param m - Rotation matrix
   * @returns A new Quaternion
   */
  static fromMatrix4(m: Matrix4): Quaternion {
    const e = m.elements;
    const trace = e[0] + e[5] + e[10];

    if (trace > 0) {
      const s = 0.5 / Math.sqrt(trace + 1.0);
      return new Quaternion(
        (e[6] - e[9]) * s,
        (e[8] - e[2]) * s,
        (e[1] - e[4]) * s,
        0.25 / s
      );
    } else if (e[0] > e[5] && e[0] > e[10]) {
      const s = 2.0 * Math.sqrt(1.0 + e[0] - e[5] - e[10]);
      return new Quaternion(
        0.25 * s,
        (e[4] + e[1]) / s,
        (e[8] + e[2]) / s,
        (e[6] - e[9]) / s
      );
    } else if (e[5] > e[10]) {
      const s = 2.0 * Math.sqrt(1.0 + e[5] - e[0] - e[10]);
      return new Quaternion(
        (e[4] + e[1]) / s,
        0.25 * s,
        (e[9] + e[6]) / s,
        (e[8] - e[2]) / s
      );
    } else {
      const s = 2.0 * Math.sqrt(1.0 + e[10] - e[0] - e[5]);
      return new Quaternion(
        (e[8] + e[2]) / s,
        (e[9] + e[6]) / s,
        0.25 * s,
        (e[1] - e[4]) / s
      );
    }
  }

  /**
   * Converts this quaternion to a rotation matrix.
   * @returns A new Matrix4
   */
  toMatrix4(): Matrix4 {
    const x = this.x, y = this.y, z = this.z, w = this.w;
    const x2 = x + x, y2 = y + y, z2 = z + z;
    const xx = x * x2, xy = x * y2, xz = x * z2;
    const yy = y * y2, yz = y * z2, zz = z * z2;
    const wx = w * x2, wy = w * y2, wz = w * z2;

    return new Matrix4().set(
      1 - (yy + zz), xy - wz, xz + wy, 0,
      xy + wz, 1 - (xx + zz), yz - wx, 0,
      xz - wy, yz + wx, 1 - (xx + yy), 0,
      0, 0, 0, 1
    );
  }

  /**
   * Multiplies this quaternion by another (combines rotations).
   * @param q - Quaternion to multiply with
   * @returns A new Quaternion
   */
  multiply(q: Quaternion): Quaternion {
    const ax = this.x, ay = this.y, az = this.z, aw = this.w;
    const bx = q.x, by = q.y, bz = q.z, bw = q.w;

    return new Quaternion(
      ax * bw + aw * bx + ay * bz - az * by,
      ay * bw + aw * by + az * bx - ax * bz,
      az * bw + aw * bz + ax * by - ay * bx,
      aw * bw - ax * bx - ay * by - az * bz
    );
  }

  /**
   * Multiplies this quaternion by another (mutates this quaternion).
   * @param q - Quaternion to multiply with
   * @returns This quaternion for chaining
   */
  multiplySelf(q: Quaternion): Quaternion {
    const ax = this.x, ay = this.y, az = this.z, aw = this.w;
    const bx = q.x, by = q.y, bz = q.z, bw = q.w;

    this.x = ax * bw + aw * bx + ay * bz - az * by;
    this.y = ay * bw + aw * by + az * bx - ax * bz;
    this.z = az * bw + aw * bz + ax * by - ay * bx;
    this.w = aw * bw - ax * bx - ay * by - az * bz;

    return this;
  }

  /**
   * Rotates a vector by this quaternion.
   * @param v - Vector to rotate
   * @returns Rotated vector
   */
  multiplyVector(v: Vector3): Vector3 {
    const qv = new Quaternion(v.x, v.y, v.z, 0);
    const qInv = this.conjugate();
    const result = this.multiply(qv).multiply(qInv);
    return new Vector3(result.x, result.y, result.z);
  }

  /**
   * Calculates the dot product with another quaternion.
   * @param q - Quaternion to dot with
   * @returns The dot product
   */
  dot(q: Quaternion): number {
    return this.x * q.x + this.y * q.y + this.z * q.z + this.w * q.w;
  }

  /**
   * Calculates the length (magnitude) of this quaternion.
   * @returns The length
   */
  length(): number {
    return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z + this.w * this.w);
  }

  /**
   * Calculates the squared length of this quaternion.
   * @returns The squared length
   */
  lengthSquared(): number {
    return this.x * this.x + this.y * this.y + this.z * this.z + this.w * this.w;
  }

  /**
   * Normalizes this quaternion to unit length.
   * @returns A new normalized quaternion
   */
  normalize(): Quaternion {
    const len = this.length();
    if (len === 0) {
      console.warn('Quaternion.normalize: Cannot normalize zero quaternion');
      return Quaternion.identity();
    }
    return new Quaternion(
      this.x / len,
      this.y / len,
      this.z / len,
      this.w / len
    );
  }

  /**
   * Normalizes this quaternion to unit length (mutates this quaternion).
   * @returns This quaternion for chaining
   */
  normalizeSelf(): Quaternion {
    const len = this.length();
    if (len === 0) {
      console.warn('Quaternion.normalizeSelf: Cannot normalize zero quaternion');
      return this;
    }
    this.x /= len;
    this.y /= len;
    this.z /= len;
    this.w /= len;
    return this;
  }

  /**
   * Returns the conjugate of this quaternion.
   * @returns A new conjugated quaternion
   */
  conjugate(): Quaternion {
    return new Quaternion(-this.x, -this.y, -this.z, this.w);
  }

  /**
   * Conjugates this quaternion (mutates this quaternion).
   * @returns This quaternion for chaining
   */
  conjugateSelf(): Quaternion {
    this.x = -this.x;
    this.y = -this.y;
    this.z = -this.z;
    return this;
  }

  /**
   * Returns the inverse of this quaternion.
   * @returns A new inverted quaternion
   */
  invert(): Quaternion {
    const lengthSq = this.lengthSquared();
    if (lengthSq === 0) {
      console.warn('Quaternion.invert: Cannot invert zero quaternion');
      return Quaternion.identity();
    }
    const invLengthSq = 1 / lengthSq;
    return new Quaternion(
      -this.x * invLengthSq,
      -this.y * invLengthSq,
      -this.z * invLengthSq,
      this.w * invLengthSq
    );
  }

  /**
   * Inverts this quaternion (mutates this quaternion).
   * @returns This quaternion for chaining
   */
  invertSelf(): Quaternion {
    const lengthSq = this.lengthSquared();
    if (lengthSq === 0) {
      console.warn('Quaternion.invertSelf: Cannot invert zero quaternion');
      return this;
    }
    const invLengthSq = 1 / lengthSq;
    this.x *= -invLengthSq;
    this.y *= -invLengthSq;
    this.z *= -invLengthSq;
    this.w *= invLengthSq;
    return this;
  }

  /**
   * Spherical linear interpolation between this quaternion and another.
   * @param q - Target quaternion
   * @param t - Interpolation factor (0-1)
   * @returns A new interpolated quaternion
   */
  slerp(q: Quaternion, t: number): Quaternion {
    if (t === 0) return this.clone();
    if (t === 1) return q.clone();

    let cosHalfTheta = this.dot(q);
    let qb = q.clone();

    if (cosHalfTheta < 0) {
      qb.x = -qb.x;
      qb.y = -qb.y;
      qb.z = -qb.z;
      qb.w = -qb.w;
      cosHalfTheta = -cosHalfTheta;
    }

    if (cosHalfTheta >= 1.0) {
      return this.clone();
    }

    const halfTheta = Math.acos(cosHalfTheta);
    const sinHalfTheta = Math.sqrt(1.0 - cosHalfTheta * cosHalfTheta);

    if (Math.abs(sinHalfTheta) < 0.001) {
      return new Quaternion(
        this.x * 0.5 + qb.x * 0.5,
        this.y * 0.5 + qb.y * 0.5,
        this.z * 0.5 + qb.z * 0.5,
        this.w * 0.5 + qb.w * 0.5
      );
    }

    const ratioA = Math.sin((1 - t) * halfTheta) / sinHalfTheta;
    const ratioB = Math.sin(t * halfTheta) / sinHalfTheta;

    return new Quaternion(
      this.x * ratioA + qb.x * ratioB,
      this.y * ratioA + qb.y * ratioB,
      this.z * ratioA + qb.z * ratioB,
      this.w * ratioA + qb.w * ratioB
    );
  }

  /**
   * Spherical linear interpolation (mutates this quaternion).
   * @param q - Target quaternion
   * @param t - Interpolation factor (0-1)
   * @returns This quaternion for chaining
   */
  slerpSelf(q: Quaternion, t: number): Quaternion {
    const result = this.slerp(q, t);
    return this.copy(result);
  }

  /**
   * Checks if this quaternion equals another quaternion (within epsilon tolerance).
   * @param q - Quaternion to compare with
   * @param epsilon - Tolerance for comparison (default: 1e-10)
   * @returns True if quaternions are equal within tolerance
   */
  equals(q: Quaternion, epsilon: number = 1e-10): boolean {
    return (
      Math.abs(this.x - q.x) < epsilon &&
      Math.abs(this.y - q.y) < epsilon &&
      Math.abs(this.z - q.z) < epsilon &&
      Math.abs(this.w - q.w) < epsilon
    );
  }

  /**
   * Converts this quaternion to an array.
   * @returns Array containing [x, y, z, w]
   */
  toArray(): [number, number, number, number] {
    return [this.x, this.y, this.z, this.w];
  }

  /**
   * Creates a quaternion from an array.
   * @param arr - Array containing [x, y, z, w]
   * @returns A new Quaternion
   */
  static fromArray(arr: number[]): Quaternion {
    return new Quaternion(arr[0] || 0, arr[1] || 0, arr[2] || 0, arr[3] || 1);
  }

  /**
   * Converts this quaternion to a string representation.
   * @returns String representation
   */
  toString(): string {
    return `Quaternion(${this.x.toFixed(3)}, ${this.y.toFixed(3)}, ${this.z.toFixed(3)}, ${this.w.toFixed(3)})`;
  }

  /**
   * Converts this quaternion to a JSON-serializable object.
   * @returns Object with x, y, z, w properties
   */
  toJSON(): { x: number; y: number; z: number; w: number } {
    return { x: this.x, y: this.y, z: this.z, w: this.w };
  }

  /**
   * Creates a quaternion from a JSON object.
   * @param json - Object with x, y, z, w properties
   * @returns A new Quaternion
   */
  static fromJSON(json: { x: number; y: number; z: number; w: number }): Quaternion {
    return new Quaternion(json.x, json.y, json.z, json.w);
  }
}
