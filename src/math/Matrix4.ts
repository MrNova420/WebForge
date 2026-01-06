/**
 * @module math
 * @fileoverview Matrix4 class - 4x4 matrix for 3D transformations
 */

import { Vector3 } from './Vector3';
import { Vector4 } from './Vector4';

/**
 * Represents a 4x4 matrix stored in column-major order (OpenGL/WebGL convention).
 * Used for 3D transformations including translation, rotation, and scaling.
 * 
 * Matrix layout:
 * ```
 * [ m0  m4  m8  m12 ]   [ 0  4   8  12 ]
 * [ m1  m5  m9  m13 ] = [ 1  5   9  13 ]
 * [ m2  m6  m10 m14 ]   [ 2  6  10  14 ]
 * [ m3  m7  m11 m15 ]   [ 3  7  11  15 ]
 * ```
 * 
 * @example
 * ```typescript
 * const m = Matrix4.identity();
 * m.translate(new Vector3(10, 0, 0));
 * m.rotateY(Math.PI / 4);
 * const result = m.multiplyVector(new Vector3(1, 0, 0));
 * ```
 */
export class Matrix4 {
  /** Matrix elements in column-major order */
  public elements: Float32Array;

  /**
   * Creates a new Matrix4.
   * @param elements - Optional 16-element array (column-major order)
   */
  constructor(elements?: number[] | Float32Array) {
    if (elements) {
      this.elements = new Float32Array(elements);
    } else {
      this.elements = new Float32Array(16);
      this.identity();
    }
  }

  /**
   * Creates an identity matrix.
   * @returns A new identity matrix
   */
  static identity(): Matrix4 {
    const m = new Matrix4();
    m.identity();
    return m;
  }

  /**
   * Sets this matrix to the identity matrix.
   * @returns This matrix for chaining
   */
  identity(): Matrix4 {
    const e = this.elements;
    e[0] = 1; e[4] = 0; e[8]  = 0; e[12] = 0;
    e[1] = 0; e[5] = 1; e[9]  = 0; e[13] = 0;
    e[2] = 0; e[6] = 0; e[10] = 1; e[14] = 0;
    e[3] = 0; e[7] = 0; e[11] = 0; e[15] = 1;
    return this;
  }

  /**
   * Creates a copy of this matrix.
   * @returns A new Matrix4 with the same elements
   */
  clone(): Matrix4 {
    return new Matrix4(this.elements);
  }

  /**
   * Copies elements from another matrix.
   * @param m - Source matrix
   * @returns This matrix for chaining
   */
  copy(m: Matrix4): Matrix4 {
    this.elements.set(m.elements);
    return this;
  }

  /**
   * Sets all matrix elements.
   * @param n11-n44 - Matrix elements in row-major order for readability
   * @returns This matrix for chaining
   */
  set(
    n11: number, n12: number, n13: number, n14: number,
    n21: number, n22: number, n23: number, n24: number,
    n31: number, n32: number, n33: number, n34: number,
    n41: number, n42: number, n43: number, n44: number
  ): Matrix4 {
    const e = this.elements;
    e[0] = n11; e[4] = n12; e[8]  = n13; e[12] = n14;
    e[1] = n21; e[5] = n22; e[9]  = n23; e[13] = n24;
    e[2] = n31; e[6] = n32; e[10] = n33; e[14] = n34;
    e[3] = n41; e[7] = n42; e[11] = n43; e[15] = n44;
    return this;
  }

  /**
   * Multiplies this matrix by another matrix.
   * @param m - Matrix to multiply with
   * @returns A new matrix containing the product
   */
  multiply(m: Matrix4): Matrix4 {
    return this.clone().multiplySelf(m);
  }

  /**
   * Multiplies this matrix by another matrix (mutates this matrix).
   * @param m - Matrix to multiply with
   * @returns This matrix for chaining
   */
  multiplySelf(m: Matrix4): Matrix4 {
    const a = this.elements;
    const b = m.elements;
    const result = new Float32Array(16);

    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        result[i + j * 4] = 
          a[i + 0 * 4] * b[0 + j * 4] +
          a[i + 1 * 4] * b[1 + j * 4] +
          a[i + 2 * 4] * b[2 + j * 4] +
          a[i + 3 * 4] * b[3 + j * 4];
      }
    }

    this.elements.set(result);
    return this;
  }

  /**
   * Multiplies this matrix by a scalar.
   * @param scalar - Scalar value
   * @returns A new scaled matrix
   */
  multiplyScalar(scalar: number): Matrix4 {
    const result = this.clone();
    for (let i = 0; i < 16; i++) {
      result.elements[i] *= scalar;
    }
    return result;
  }

  /**
   * Multiplies a Vector3 by this matrix (treating it as a point with w=1).
   * @param v - Vector to transform
   * @returns Transformed vector
   */
  multiplyVector3(v: Vector3): Vector3 {
    const e = this.elements;
    const x = v.x, y = v.y, z = v.z;
    const w = e[3] * x + e[7] * y + e[11] * z + e[15];
    const invW = w !== 0 ? 1 / w : 1;

    return new Vector3(
      (e[0] * x + e[4] * y + e[8]  * z + e[12]) * invW,
      (e[1] * x + e[5] * y + e[9]  * z + e[13]) * invW,
      (e[2] * x + e[6] * y + e[10] * z + e[14]) * invW
    );
  }

  /**
   * Multiplies a Vector4 by this matrix.
   * @param v - Vector to transform
   * @returns Transformed vector
   */
  multiplyVector4(v: Vector4): Vector4 {
    const e = this.elements;
    const x = v.x, y = v.y, z = v.z, w = v.w;

    return new Vector4(
      e[0] * x + e[4] * y + e[8]  * z + e[12] * w,
      e[1] * x + e[5] * y + e[9]  * z + e[13] * w,
      e[2] * x + e[6] * y + e[10] * z + e[14] * w,
      e[3] * x + e[7] * y + e[11] * z + e[15] * w
    );
  }

  /**
   * Calculates the determinant of this matrix.
   * @returns The determinant
   */
  determinant(): number {
    const e = this.elements;

    const n11 = e[0], n12 = e[4], n13 = e[8],  n14 = e[12];
    const n21 = e[1], n22 = e[5], n23 = e[9],  n24 = e[13];
    const n31 = e[2], n32 = e[6], n33 = e[10], n34 = e[14];
    const n41 = e[3], n42 = e[7], n43 = e[11], n44 = e[15];

    return (
      n41 * (
        + n14 * n23 * n32
        - n13 * n24 * n32
        - n14 * n22 * n33
        + n12 * n24 * n33
        + n13 * n22 * n34
        - n12 * n23 * n34
      ) +
      n42 * (
        + n11 * n23 * n34
        - n11 * n24 * n33
        + n14 * n21 * n33
        - n13 * n21 * n34
        + n13 * n24 * n31
        - n14 * n23 * n31
      ) +
      n43 * (
        + n11 * n24 * n32
        - n11 * n22 * n34
        - n14 * n21 * n32
        + n12 * n21 * n34
        + n14 * n22 * n31
        - n12 * n24 * n31
      ) +
      n44 * (
        - n13 * n22 * n31
        - n11 * n23 * n32
        + n11 * n22 * n33
        + n13 * n21 * n32
        - n12 * n21 * n33
        + n12 * n23 * n31
      )
    );
  }

  /**
   * Transposes this matrix.
   * @returns A new transposed matrix
   */
  transpose(): Matrix4 {
    const e = this.elements;
    return new Matrix4().set(
      e[0], e[1], e[2],  e[3],
      e[4], e[5], e[6],  e[7],
      e[8], e[9], e[10], e[11],
      e[12], e[13], e[14], e[15]
    );
  }

  /**
   * Inverts this matrix.
   * @returns A new inverted matrix, or identity if not invertible
   */
  invert(): Matrix4 {
    const e = this.elements;
    const result = new Matrix4();
    const r = result.elements;

    const n11 = e[0], n12 = e[4], n13 = e[8],  n14 = e[12];
    const n21 = e[1], n22 = e[5], n23 = e[9],  n24 = e[13];
    const n31 = e[2], n32 = e[6], n33 = e[10], n34 = e[14];
    const n41 = e[3], n42 = e[7], n43 = e[11], n44 = e[15];

    r[0] = n23 * n34 * n42 - n24 * n33 * n42 + n24 * n32 * n43 - n22 * n34 * n43 - n23 * n32 * n44 + n22 * n33 * n44;
    r[4] = n14 * n33 * n42 - n13 * n34 * n42 - n14 * n32 * n43 + n12 * n34 * n43 + n13 * n32 * n44 - n12 * n33 * n44;
    r[8] = n13 * n24 * n42 - n14 * n23 * n42 + n14 * n22 * n43 - n12 * n24 * n43 - n13 * n22 * n44 + n12 * n23 * n44;
    r[12] = n14 * n23 * n32 - n13 * n24 * n32 - n14 * n22 * n33 + n12 * n24 * n33 + n13 * n22 * n34 - n12 * n23 * n34;

    const det = n11 * r[0] + n21 * r[4] + n31 * r[8] + n41 * r[12];

    if (det === 0) {
      console.warn('Matrix4.invert: Matrix is not invertible');
      return Matrix4.identity();
    }

    const detInv = 1 / det;

    r[0] *= detInv;
    r[4] *= detInv;
    r[8] *= detInv;
    r[12] *= detInv;

    r[1] = (n24 * n33 * n41 - n23 * n34 * n41 - n24 * n31 * n43 + n21 * n34 * n43 + n23 * n31 * n44 - n21 * n33 * n44) * detInv;
    r[5] = (n13 * n34 * n41 - n14 * n33 * n41 + n14 * n31 * n43 - n11 * n34 * n43 - n13 * n31 * n44 + n11 * n33 * n44) * detInv;
    r[9] = (n14 * n23 * n41 - n13 * n24 * n41 - n14 * n21 * n43 + n11 * n24 * n43 + n13 * n21 * n44 - n11 * n23 * n44) * detInv;
    r[13] = (n13 * n24 * n31 - n14 * n23 * n31 + n14 * n21 * n33 - n11 * n24 * n33 - n13 * n21 * n34 + n11 * n23 * n34) * detInv;

    r[2] = (n22 * n34 * n41 - n24 * n32 * n41 + n24 * n31 * n42 - n21 * n34 * n42 - n22 * n31 * n44 + n21 * n32 * n44) * detInv;
    r[6] = (n14 * n32 * n41 - n12 * n34 * n41 - n14 * n31 * n42 + n11 * n34 * n42 + n12 * n31 * n44 - n11 * n32 * n44) * detInv;
    r[10] = (n12 * n24 * n41 - n14 * n22 * n41 + n14 * n21 * n42 - n11 * n24 * n42 - n12 * n21 * n44 + n11 * n22 * n44) * detInv;
    r[14] = (n14 * n22 * n31 - n12 * n24 * n31 - n14 * n21 * n32 + n11 * n24 * n32 + n12 * n21 * n34 - n11 * n22 * n34) * detInv;

    r[3] = (n23 * n32 * n41 - n22 * n33 * n41 - n23 * n31 * n42 + n21 * n33 * n42 + n22 * n31 * n43 - n21 * n32 * n43) * detInv;
    r[7] = (n12 * n33 * n41 - n13 * n32 * n41 + n13 * n31 * n42 - n11 * n33 * n42 - n12 * n31 * n43 + n11 * n32 * n43) * detInv;
    r[11] = (n13 * n22 * n41 - n12 * n23 * n41 - n13 * n21 * n42 + n11 * n23 * n42 + n12 * n21 * n43 - n11 * n22 * n43) * detInv;
    r[15] = (n12 * n23 * n31 - n13 * n22 * n31 + n13 * n21 * n32 - n11 * n23 * n32 - n12 * n21 * n33 + n11 * n22 * n33) * detInv;

    return result;
  }

  /**
   * Creates a translation matrix.
   * @param v - Translation vector
   * @returns A new translation matrix
   */
  static translation(v: Vector3): Matrix4 {
    return new Matrix4().set(
      1, 0, 0, v.x,
      0, 1, 0, v.y,
      0, 0, 1, v.z,
      0, 0, 0, 1
    );
  }

  /**
   * Applies translation to this matrix.
   * @param v - Translation vector
   * @returns This matrix for chaining
   */
  translate(v: Vector3): Matrix4 {
    return this.multiplySelf(Matrix4.translation(v));
  }

  /**
   * Creates a scaling matrix.
   * @param v - Scale vector
   * @returns A new scaling matrix
   */
  static scaling(v: Vector3): Matrix4 {
    return new Matrix4().set(
      v.x, 0,   0,   0,
      0,   v.y, 0,   0,
      0,   0,   v.z, 0,
      0,   0,   0,   1
    );
  }

  /**
   * Applies scaling to this matrix.
   * @param v - Scale vector
   * @returns This matrix for chaining
   */
  scale(v: Vector3): Matrix4 {
    return this.multiplySelf(Matrix4.scaling(v));
  }

  /**
   * Creates a rotation matrix around the X axis.
   * @param angle - Rotation angle in radians
   * @returns A new rotation matrix
   */
  static rotationX(angle: number): Matrix4 {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    return new Matrix4().set(
      1, 0,  0, 0,
      0, c, -s, 0,
      0, s,  c, 0,
      0, 0,  0, 1
    );
  }

  /**
   * Applies rotation around the X axis to this matrix.
   * @param angle - Rotation angle in radians
   * @returns This matrix for chaining
   */
  rotateX(angle: number): Matrix4 {
    return this.multiplySelf(Matrix4.rotationX(angle));
  }

  /**
   * Creates a rotation matrix around the Y axis.
   * @param angle - Rotation angle in radians
   * @returns A new rotation matrix
   */
  static rotationY(angle: number): Matrix4 {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    return new Matrix4().set(
       c, 0, s, 0,
       0, 1, 0, 0,
      -s, 0, c, 0,
       0, 0, 0, 1
    );
  }

  /**
   * Applies rotation around the Y axis to this matrix.
   * @param angle - Rotation angle in radians
   * @returns This matrix for chaining
   */
  rotateY(angle: number): Matrix4 {
    return this.multiplySelf(Matrix4.rotationY(angle));
  }

  /**
   * Creates a rotation matrix around the Z axis.
   * @param angle - Rotation angle in radians
   * @returns A new rotation matrix
   */
  static rotationZ(angle: number): Matrix4 {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    return new Matrix4().set(
      c, -s, 0, 0,
      s,  c, 0, 0,
      0,  0, 1, 0,
      0,  0, 0, 1
    );
  }

  /**
   * Applies rotation around the Z axis to this matrix.
   * @param angle - Rotation angle in radians
   * @returns This matrix for chaining
   */
  rotateZ(angle: number): Matrix4 {
    return this.multiplySelf(Matrix4.rotationZ(angle));
  }

  /**
   * Creates a perspective projection matrix.
   * @param fov - Field of view in radians
   * @param aspect - Aspect ratio (width/height)
   * @param near - Near clipping plane
   * @param far - Far clipping plane
   * @returns A new perspective matrix
   */
  static perspective(fov: number, aspect: number, near: number, far: number): Matrix4 {
    const f = 1.0 / Math.tan(fov / 2);
    const rangeInv = 1.0 / (near - far);

    return new Matrix4().set(
      f / aspect, 0, 0, 0,
      0, f, 0, 0,
      0, 0, (near + far) * rangeInv, 2 * near * far * rangeInv,
      0, 0, -1, 0
    );
  }

  /**
   * Creates an orthographic projection matrix.
   * @param left - Left clipping plane
   * @param right - Right clipping plane
   * @param bottom - Bottom clipping plane
   * @param top - Top clipping plane
   * @param near - Near clipping plane
   * @param far - Far clipping plane
   * @returns A new orthographic matrix
   */
  static orthographic(
    left: number, right: number,
    bottom: number, top: number,
    near: number, far: number
  ): Matrix4 {
    const w = right - left;
    const h = top - bottom;
    const d = far - near;

    return new Matrix4().set(
      2 / w, 0, 0, -(right + left) / w,
      0, 2 / h, 0, -(top + bottom) / h,
      0, 0, -2 / d, -(far + near) / d,
      0, 0, 0, 1
    );
  }

  /**
   * Creates a look-at view matrix.
   * @param eye - Camera position
   * @param target - Point to look at
   * @param up - Up vector
   * @returns A new view matrix
   */
  static lookAt(eye: Vector3, target: Vector3, up: Vector3): Matrix4 {
    const z = eye.subtract(target).normalize();
    const x = up.cross(z).normalize();
    const y = z.cross(x);

    return new Matrix4().set(
      x.x, x.y, x.z, -x.dot(eye),
      y.x, y.y, y.z, -y.dot(eye),
      z.x, z.y, z.z, -z.dot(eye),
      0, 0, 0, 1
    );
  }

  /**
   * Extracts the position from this transformation matrix.
   * @returns Position vector
   */
  getPosition(): Vector3 {
    const e = this.elements;
    return new Vector3(e[12], e[13], e[14]);
  }

  /**
   * Extracts the scale from this transformation matrix.
   * @returns Scale vector
   */
  getScale(): Vector3 {
    const e = this.elements;
    const sx = new Vector3(e[0], e[1], e[2]).length();
    const sy = new Vector3(e[4], e[5], e[6]).length();
    const sz = new Vector3(e[8], e[9], e[10]).length();
    return new Vector3(sx, sy, sz);
  }

  /**
   * Checks if this matrix equals another matrix (within epsilon tolerance).
   * @param m - Matrix to compare with
   * @param epsilon - Tolerance for comparison (default: 1e-10)
   * @returns True if matrices are equal within tolerance
   */
  equals(m: Matrix4, epsilon: number = 1e-10): boolean {
    for (let i = 0; i < 16; i++) {
      if (Math.abs(this.elements[i] - m.elements[i]) >= epsilon) {
        return false;
      }
    }
    return true;
  }

  /**
   * Converts this matrix to an array.
   * @returns Array containing all 16 elements in column-major order
   */
  toArray(): Float32Array {
    return this.elements;
  }

  /**
   * Creates a matrix from an array.
   * @param arr - Array containing 16 elements
   * @returns A new Matrix4
   */
  static fromArray(arr: number[] | Float32Array): Matrix4 {
    return new Matrix4(arr);
  }

  /**
   * Converts this matrix to a string representation.
   * @returns String representation
   */
  toString(): string {
    const e = this.elements;
    return `Matrix4(\n` +
      `  [${e[0].toFixed(3)}, ${e[4].toFixed(3)}, ${e[8].toFixed(3)}, ${e[12].toFixed(3)}]\n` +
      `  [${e[1].toFixed(3)}, ${e[5].toFixed(3)}, ${e[9].toFixed(3)}, ${e[13].toFixed(3)}]\n` +
      `  [${e[2].toFixed(3)}, ${e[6].toFixed(3)}, ${e[10].toFixed(3)}, ${e[14].toFixed(3)}]\n` +
      `  [${e[3].toFixed(3)}, ${e[7].toFixed(3)}, ${e[11].toFixed(3)}, ${e[15].toFixed(3)}]\n` +
      `)`;
  }
}
