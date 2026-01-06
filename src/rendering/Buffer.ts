/**
 * @module rendering
 * @fileoverview Buffer class - WebGL buffer management (vertex, index, uniform)
 */

import { Logger } from '../core/Logger';

/**
 * Buffer type enumeration.
 */
export enum BufferType {
  VERTEX = 'vertex',
  INDEX = 'index',
  UNIFORM = 'uniform'
}

/**
 * Buffer usage hint.
 */
export enum BufferUsage {
  STATIC = 'static',
  DYNAMIC = 'dynamic',
  STREAM = 'stream'
}

/**
 * WebGL buffer wrapper with automatic management.
 * Handles vertex buffers, index buffers, and uniform buffers.
 * 
 * @example
 * ```typescript
 * const vertices = new Float32Array([...]);
 * const buffer = new Buffer(gl, BufferType.VERTEX, BufferUsage.STATIC);
 * buffer.setData(vertices);
 * buffer.bind();
 * ```
 */
export class Buffer {
  private gl: WebGLRenderingContext | WebGL2RenderingContext;
  private buffer: WebGLBuffer | null;
  private type: BufferType;
  private usage: BufferUsage;
  private size: number;
  private logger: Logger;

  constructor(
    gl: WebGLRenderingContext | WebGL2RenderingContext,
    type: BufferType,
    usage: BufferUsage = BufferUsage.STATIC
  ) {
    this.gl = gl;
    this.type = type;
    this.usage = usage;
    this.size = 0;
    this.logger = new Logger('Buffer');
    
    this.buffer = gl.createBuffer();
    if (!this.buffer) {
      throw new Error('Failed to create buffer');
    }
  }

  /**
   * Gets the WebGL buffer target.
   */
  private getTarget(): number {
    const gl = this.gl;
    switch (this.type) {
      case BufferType.VERTEX:
      case BufferType.UNIFORM:
        return gl.ARRAY_BUFFER;
      case BufferType.INDEX:
        return gl.ELEMENT_ARRAY_BUFFER;
      default:
        return gl.ARRAY_BUFFER;
    }
  }

  /**
   * Gets the WebGL usage hint.
   */
  private getUsage(): number {
    const gl = this.gl;
    switch (this.usage) {
      case BufferUsage.STATIC:
        return gl.STATIC_DRAW;
      case BufferUsage.DYNAMIC:
        return gl.DYNAMIC_DRAW;
      case BufferUsage.STREAM:
        return gl.STREAM_DRAW;
      default:
        return gl.STATIC_DRAW;
    }
  }

  /**
   * Sets buffer data.
   * @param data - Buffer data
   */
  setData(data: ArrayBuffer | ArrayBufferView): void {
    if (!this.buffer) {
      throw new Error('Buffer not initialized');
    }
    
    const gl = this.gl;
    const target = this.getTarget();
    const usage = this.getUsage();
    
    gl.bindBuffer(target, this.buffer);
    gl.bufferData(target, data, usage);
    
    // Calculate size in bytes
    if (data instanceof ArrayBuffer) {
      this.size = data.byteLength;
    } else {
      this.size = data.byteLength;
    }
    
    this.logger.debug(`Buffer data set: ${this.size} bytes`);
  }

  /**
   * Updates a portion of buffer data.
   * @param data - New data
   * @param offset - Byte offset
   */
  updateData(data: ArrayBuffer | ArrayBufferView, offset: number = 0): void {
    if (!this.buffer) {
      throw new Error('Buffer not initialized');
    }
    
    const gl = this.gl;
    const target = this.getTarget();
    
    gl.bindBuffer(target, this.buffer);
    gl.bufferSubData(target, offset, data);
  }

  /**
   * Binds the buffer.
   */
  bind(): void {
    if (!this.buffer) {
      throw new Error('Buffer not initialized');
    }
    
    const gl = this.gl;
    const target = this.getTarget();
    gl.bindBuffer(target, this.buffer);
  }

  /**
   * Unbinds the buffer.
   */
  unbind(): void {
    const gl = this.gl;
    const target = this.getTarget();
    gl.bindBuffer(target, null);
  }

  /**
   * Sets up a vertex attribute pointer.
   * @param location - Attribute location
   * @param size - Components per vertex (1-4)
   * @param type - Data type (default: FLOAT)
   * @param normalized - Whether to normalize (default: false)
   * @param stride - Byte stride (default: 0)
   * @param offset - Byte offset (default: 0)
   */
  setAttributePointer(
    location: number,
    size: number,
    type: number = this.gl.FLOAT,
    normalized: boolean = false,
    stride: number = 0,
    offset: number = 0
  ): void {
    if (this.type !== BufferType.VERTEX) {
      throw new Error('setAttributePointer can only be used with vertex buffers');
    }
    
    const gl = this.gl;
    this.bind();
    gl.enableVertexAttribArray(location);
    gl.vertexAttribPointer(location, size, type, normalized, stride, offset);
  }

  /**
   * Gets buffer size in bytes.
   */
  getSize(): number {
    return this.size;
  }

  /**
   * Gets buffer type.
   */
  getType(): BufferType {
    return this.type;
  }

  /**
   * Gets the WebGL buffer.
   */
  getBuffer(): WebGLBuffer | null {
    return this.buffer;
  }

  /**
   * Destroys the buffer.
   */
  destroy(): void {
    if (this.buffer) {
      this.gl.deleteBuffer(this.buffer);
      this.buffer = null;
    }
    this.size = 0;
  }
}
