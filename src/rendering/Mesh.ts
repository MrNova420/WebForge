import { Buffer, BufferType, BufferUsage } from './Buffer';

/**
 * Vertex attribute descriptor
 */
export interface VertexAttribute {
  /** Attribute name (matches shader input) */
  name: string;
  /** Number of components (1-4) */
  size: number;
  /** Data type */
  type: 'FLOAT' | 'INT' | 'UNSIGNED_INT' | 'SHORT' | 'UNSIGNED_SHORT' | 'BYTE' | 'UNSIGNED_BYTE';
  /** Whether to normalize integer values */
  normalized: boolean;
  /** Byte stride between consecutive attributes */
  stride: number;
  /** Byte offset from start of buffer */
  offset: number;
}

/**
 * Mesh geometry data and vertex attribute configuration.
 * Manages vertex and index buffers for rendering.
 */
export class Mesh {
  private gl: WebGLRenderingContext | WebGL2RenderingContext;
  private vertexBuffer: Buffer | null = null;
  private indexBuffer: Buffer | null = null;
  private attributes: VertexAttribute[] = [];
  private vertexCount: number = 0;
  private indexCount: number = 0;
  private primitiveType: number;

  /**
   * Creates a new mesh
   * @param gl - WebGL context
   * @param primitiveType - GL primitive type (TRIANGLES, LINES, POINTS, etc.)
   */
  constructor(
    gl: WebGLRenderingContext | WebGL2RenderingContext,
    primitiveType: 'TRIANGLES' | 'LINES' | 'POINTS' | 'LINE_STRIP' | 'LINE_LOOP' | 'TRIANGLE_STRIP' | 'TRIANGLE_FAN' = 'TRIANGLES'
  ) {
    this.gl = gl;
    this.primitiveType = gl[primitiveType];
  }

  /**
   * Sets vertex data
   * @param data - Vertex data array
   * @param usage - Buffer usage hint
   */
  public setVertexData(data: Float32Array | number[], usage: 'STATIC' | 'DYNAMIC' | 'STREAM' = 'STATIC'): void {
    if (!this.vertexBuffer) {
      this.vertexBuffer = new Buffer(this.gl, BufferType.VERTEX, BufferUsage[usage]);
    }
    
    const typedArray = data instanceof Float32Array ? data : new Float32Array(data);
    this.vertexBuffer.setData(typedArray);
    
    // Calculate vertex count based on attributes
    if (this.attributes.length > 0) {
      const firstAttr = this.attributes[0];
      const stride = firstAttr.stride || firstAttr.size * 4; // 4 bytes per float
      this.vertexCount = Math.floor(typedArray.byteLength / stride);
    }
  }

  /**
   * Sets index data for indexed rendering
   * @param data - Index data array
   * @param usage - Buffer usage hint
   */
  public setIndexData(data: Uint16Array | Uint32Array | number[], usage: 'STATIC' | 'DYNAMIC' | 'STREAM' = 'STATIC'): void {
    if (!this.indexBuffer) {
      this.indexBuffer = new Buffer(this.gl, BufferType.INDEX, BufferUsage[usage]);
    }
    
    let typedArray: Uint16Array | Uint32Array;
    if (data instanceof Uint16Array || data instanceof Uint32Array) {
      typedArray = data;
    } else {
      // Find max value efficiently without spread operator
      let maxValue = 0;
      for (let i = 0; i < data.length; i++) {
        if (data[i] > maxValue) maxValue = data[i];
      }
      // Use Uint16Array for smaller indices, Uint32Array for larger
      typedArray = maxValue > 65535 ? new Uint32Array(data) : new Uint16Array(data);
    }
    
    this.indexBuffer.setData(typedArray);
    this.indexCount = typedArray.length;
  }

  /**
   * Adds a vertex attribute descriptor
   * @param attribute - Vertex attribute configuration
   */
  public addAttribute(attribute: VertexAttribute): void {
    this.attributes.push(attribute);
  }

  /**
   * Clears all vertex attributes
   */
  public clearAttributes(): void {
    this.attributes = [];
  }

  /**
   * Binds vertex buffer and sets up vertex attributes
   * @param shader - Shader program to bind attributes to
   */
  public bind(shader: { getAttribLocation(name: string): number }): void {
    if (!this.vertexBuffer) {
      console.warn('Mesh: No vertex buffer to bind');
      return;
    }

    this.vertexBuffer.bind();

    for (const attr of this.attributes) {
      const location = shader.getAttribLocation(attr.name);
      if (location === -1) {
        continue; // Attribute not used in shader
      }

      this.gl.enableVertexAttribArray(location);
      
      const type = this.gl[attr.type];
      this.gl.vertexAttribPointer(
        location,
        attr.size,
        type,
        attr.normalized,
        attr.stride,
        attr.offset
      );
    }

    if (this.indexBuffer) {
      this.indexBuffer.bind();
    }
  }

  /**
   * Unbinds vertex buffer and disables vertex attributes
   * @param shader - Shader program to unbind attributes from
   */
  public unbind(shader: { getAttribLocation(name: string): number }): void {
    for (const attr of this.attributes) {
      const location = shader.getAttribLocation(attr.name);
      if (location !== -1) {
        this.gl.disableVertexAttribArray(location);
      }
    }

    if (this.vertexBuffer) {
      this.vertexBuffer.unbind();
    }

    if (this.indexBuffer) {
      this.indexBuffer.unbind();
    }
  }

  /**
   * Draws the mesh
   * @param instanceCount - Number of instances for instanced rendering (WebGL2 only)
   */
  public draw(instanceCount?: number): void {
    if (!this.vertexBuffer) {
      console.warn('Mesh: No vertex buffer to draw');
      return;
    }

    if (this.indexBuffer && this.indexCount > 0) {
      // Indexed rendering
      const indexType = this.indexBuffer.getSize() === this.indexCount * 2 
        ? this.gl.UNSIGNED_SHORT 
        : this.gl.UNSIGNED_INT;

      if (instanceCount && instanceCount > 1 && 'drawElementsInstanced' in this.gl) {
        (this.gl as WebGL2RenderingContext).drawElementsInstanced(
          this.primitiveType,
          this.indexCount,
          indexType,
          0,
          instanceCount
        );
      } else {
        this.gl.drawElements(this.primitiveType, this.indexCount, indexType, 0);
      }
    } else if (this.vertexCount > 0) {
      // Non-indexed rendering
      if (instanceCount && instanceCount > 1 && 'drawArraysInstanced' in this.gl) {
        (this.gl as WebGL2RenderingContext).drawArraysInstanced(
          this.primitiveType,
          0,
          this.vertexCount,
          instanceCount
        );
      } else {
        this.gl.drawArrays(this.primitiveType, 0, this.vertexCount);
      }
    }
  }

  /**
   * Gets vertex count
   */
  public getVertexCount(): number {
    return this.vertexCount;
  }

  /**
   * Gets index count
   */
  public getIndexCount(): number {
    return this.indexCount;
  }

  /**
   * Gets primitive type
   */
  public getPrimitiveType(): number {
    return this.primitiveType;
  }

  /**
   * Gets vertex attributes
   */
  public getAttributes(): readonly VertexAttribute[] {
    return this.attributes;
  }

  /**
   * Destroys mesh and releases GPU resources
   */
  public destroy(): void {
    if (this.vertexBuffer) {
      this.vertexBuffer.destroy();
      this.vertexBuffer = null;
    }

    if (this.indexBuffer) {
      this.indexBuffer.destroy();
      this.indexBuffer = null;
    }

    this.attributes = [];
    this.vertexCount = 0;
    this.indexCount = 0;
  }
}

/**
 * Geometry generation utilities
 */
export class GeometryUtils {
  /**
   * Creates a cube mesh
   * @param gl - WebGL context
   * @param size - Cube size
   * @returns Configured mesh with position, normal, and UV attributes
   */
  public static createCube(gl: WebGLRenderingContext | WebGL2RenderingContext, size: number = 1): Mesh {
    const s = size / 2;

    // Vertex data: position (3), normal (3), uv (2)
    const vertices = new Float32Array([
      // Front face
      -s, -s,  s,  0,  0,  1,  0, 0,
       s, -s,  s,  0,  0,  1,  1, 0,
       s,  s,  s,  0,  0,  1,  1, 1,
      -s,  s,  s,  0,  0,  1,  0, 1,
      
      // Back face
       s, -s, -s,  0,  0, -1,  0, 0,
      -s, -s, -s,  0,  0, -1,  1, 0,
      -s,  s, -s,  0,  0, -1,  1, 1,
       s,  s, -s,  0,  0, -1,  0, 1,
      
      // Top face
      -s,  s,  s,  0,  1,  0,  0, 0,
       s,  s,  s,  0,  1,  0,  1, 0,
       s,  s, -s,  0,  1,  0,  1, 1,
      -s,  s, -s,  0,  1,  0,  0, 1,
      
      // Bottom face
      -s, -s, -s,  0, -1,  0,  0, 0,
       s, -s, -s,  0, -1,  0,  1, 0,
       s, -s,  s,  0, -1,  0,  1, 1,
      -s, -s,  s,  0, -1,  0,  0, 1,
      
      // Right face
       s, -s,  s,  1,  0,  0,  0, 0,
       s, -s, -s,  1,  0,  0,  1, 0,
       s,  s, -s,  1,  0,  0,  1, 1,
       s,  s,  s,  1,  0,  0,  0, 1,
      
      // Left face
      -s, -s, -s, -1,  0,  0,  0, 0,
      -s, -s,  s, -1,  0,  0,  1, 0,
      -s,  s,  s, -1,  0,  0,  1, 1,
      -s,  s, -s, -1,  0,  0,  0, 1,
    ]);

    const indices = new Uint16Array([
      0,  1,  2,    0,  2,  3,   // Front
      4,  5,  6,    4,  6,  7,   // Back
      8,  9, 10,    8, 10, 11,   // Top
      12, 13, 14,   12, 14, 15,  // Bottom
      16, 17, 18,   16, 18, 19,  // Right
      20, 21, 22,   20, 22, 23,  // Left
    ]);

    const mesh = new Mesh(gl, 'TRIANGLES');
    mesh.setVertexData(vertices);
    mesh.setIndexData(indices);

    mesh.addAttribute({
      name: 'aPosition',
      size: 3,
      type: 'FLOAT',
      normalized: false,
      stride: 8 * 4, // 8 floats per vertex
      offset: 0
    });

    mesh.addAttribute({
      name: 'aNormal',
      size: 3,
      type: 'FLOAT',
      normalized: false,
      stride: 8 * 4,
      offset: 3 * 4
    });

    mesh.addAttribute({
      name: 'aTexCoord',
      size: 2,
      type: 'FLOAT',
      normalized: false,
      stride: 8 * 4,
      offset: 6 * 4
    });

    return mesh;
  }

  /**
   * Creates a plane mesh
   * @param gl - WebGL context
   * @param width - Plane width
   * @param height - Plane height
   * @param widthSegments - Number of width segments
   * @param heightSegments - Number of height segments
   * @returns Configured mesh
   */
  public static createPlane(
    gl: WebGLRenderingContext | WebGL2RenderingContext,
    width: number = 1,
    height: number = 1,
    widthSegments: number = 1,
    heightSegments: number = 1
  ): Mesh {
    const w = width / 2;
    const h = height / 2;

    const vertices: number[] = [];
    const indices: number[] = [];

    // Generate vertices
    for (let y = 0; y <= heightSegments; y++) {
      for (let x = 0; x <= widthSegments; x++) {
        const u = x / widthSegments;
        const v = y / heightSegments;

        const px = u * width - w;
        const py = v * height - h;

        // Position
        vertices.push(px, py, 0);
        // Normal
        vertices.push(0, 0, 1);
        // UV
        vertices.push(u, v);
      }
    }

    // Generate indices
    for (let y = 0; y < heightSegments; y++) {
      for (let x = 0; x < widthSegments; x++) {
        const a = y * (widthSegments + 1) + x;
        const b = a + 1;
        const c = a + widthSegments + 1;
        const d = c + 1;

        indices.push(a, b, d);
        indices.push(a, d, c);
      }
    }

    const mesh = new Mesh(gl, 'TRIANGLES');
    mesh.setVertexData(new Float32Array(vertices));
    mesh.setIndexData(new Uint16Array(indices));

    mesh.addAttribute({
      name: 'aPosition',
      size: 3,
      type: 'FLOAT',
      normalized: false,
      stride: 8 * 4,
      offset: 0
    });

    mesh.addAttribute({
      name: 'aNormal',
      size: 3,
      type: 'FLOAT',
      normalized: false,
      stride: 8 * 4,
      offset: 3 * 4
    });

    mesh.addAttribute({
      name: 'aTexCoord',
      size: 2,
      type: 'FLOAT',
      normalized: false,
      stride: 8 * 4,
      offset: 6 * 4
    });

    return mesh;
  }

  /**
   * Creates a sphere mesh
   * @param gl - WebGL context
   * @param radius - Sphere radius
   * @param widthSegments - Number of horizontal segments
   * @param heightSegments - Number of vertical segments
   * @returns Configured mesh
   */
  public static createSphere(
    gl: WebGLRenderingContext | WebGL2RenderingContext,
    radius: number = 1,
    widthSegments: number = 32,
    heightSegments: number = 16
  ): Mesh {
    const vertices: number[] = [];
    const indices: number[] = [];

    // Generate vertices
    for (let y = 0; y <= heightSegments; y++) {
      const v = y / heightSegments;
      const phi = v * Math.PI;

      for (let x = 0; x <= widthSegments; x++) {
        const u = x / widthSegments;
        const theta = u * Math.PI * 2;

        const sinPhi = Math.sin(phi);
        const cosPhi = Math.cos(phi);
        const sinTheta = Math.sin(theta);
        const cosTheta = Math.cos(theta);

        const nx = sinPhi * cosTheta;
        const ny = cosPhi;
        const nz = sinPhi * sinTheta;

        // Position
        vertices.push(radius * nx, radius * ny, radius * nz);
        // Normal
        vertices.push(nx, ny, nz);
        // UV
        vertices.push(u, v);
      }
    }

    // Generate indices
    for (let y = 0; y < heightSegments; y++) {
      for (let x = 0; x < widthSegments; x++) {
        const a = y * (widthSegments + 1) + x;
        const b = a + 1;
        const c = a + widthSegments + 1;
        const d = c + 1;

        indices.push(a, b, d);
        indices.push(a, d, c);
      }
    }

    const mesh = new Mesh(gl, 'TRIANGLES');
    mesh.setVertexData(new Float32Array(vertices));
    mesh.setIndexData(new Uint16Array(indices));

    mesh.addAttribute({
      name: 'aPosition',
      size: 3,
      type: 'FLOAT',
      normalized: false,
      stride: 8 * 4,
      offset: 0
    });

    mesh.addAttribute({
      name: 'aNormal',
      size: 3,
      type: 'FLOAT',
      normalized: false,
      stride: 8 * 4,
      offset: 3 * 4
    });

    mesh.addAttribute({
      name: 'aTexCoord',
      size: 2,
      type: 'FLOAT',
      normalized: false,
      stride: 8 * 4,
      offset: 6 * 4
    });

    return mesh;
  }
}
