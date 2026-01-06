/**
 * @module rendering
 * @fileoverview Shader class - WebGL shader compilation, linking, and management
 */

import { Logger } from '../core/Logger';
import { EventSystem } from '../core/EventSystem';

export enum ShaderType {
  VERTEX = 'vertex',
  FRAGMENT = 'fragment'
}

export type UniformValue = number | number[] | Float32Array | Int32Array;

/**
 * Shader program wrapper with uniform management.
 */
export class Shader {
  private gl: WebGLRenderingContext | WebGL2RenderingContext;
  private vertexSource: string;
  private fragmentSource: string;
  private vertexShader: WebGLShader | null;
  private fragmentShader: WebGLShader | null;
  private program: WebGLProgram | null;
  private uniforms: Map<string, WebGLUniformLocation | null>;
  private attributes: Map<string, number>;
  private compiled: boolean;
  private events: EventSystem;
  private logger: Logger;

  constructor(
    gl: WebGLRenderingContext | WebGL2RenderingContext,
    vertexSource: string,
    fragmentSource: string
  ) {
    this.gl = gl;
    this.vertexSource = vertexSource;
    this.fragmentSource = fragmentSource;
    this.vertexShader = null;
    this.fragmentShader = null;
    this.program = null;
    this.uniforms = new Map();
    this.attributes = new Map();
    this.compiled = false;
    this.events = new EventSystem();
    this.logger = new Logger('Shader');
  }

  async compile(): Promise<void> {
    const gl = this.gl;
    try {
      this.vertexShader = this.compileShader(this.vertexSource, gl.VERTEX_SHADER);
      this.fragmentShader = this.compileShader(this.fragmentSource, gl.FRAGMENT_SHADER);
      
      this.program = gl.createProgram();
      if (!this.program) {
        throw new Error('Failed to create shader program');
      }
      
      gl.attachShader(this.program, this.vertexShader);
      gl.attachShader(this.program, this.fragmentShader);
      gl.linkProgram(this.program);
      
      if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
        const info = gl.getProgramInfoLog(this.program);
        throw new Error(`Shader program linking failed: ${info}`);
      }
      
      this.cacheLocations();
      this.compiled = true;
      this.events.emit('compiled');
      this.logger.info('Shader compiled successfully');
    } catch (error) {
      this.cleanup();
      this.logger.error('Shader compilation failed', error);
      throw error;
    }
  }

  private compileShader(source: string, type: number): WebGLShader {
    const gl = this.gl;
    const shader = gl.createShader(type);
    if (!shader) {
      throw new Error('Failed to create shader');
    }
    
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const info = gl.getShaderInfoLog(shader);
      const typeName = type === gl.VERTEX_SHADER ? 'vertex' : 'fragment';
      gl.deleteShader(shader);
      throw new Error(`${typeName} shader compilation failed: ${info}`);
    }
    
    return shader;
  }

  private cacheLocations(): void {
    if (!this.program) return;
    const gl = this.gl;
    
    const numUniforms = gl.getProgramParameter(this.program, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < numUniforms; i++) {
      const info = gl.getActiveUniform(this.program, i);
      if (info) {
        const location = gl.getUniformLocation(this.program, info.name);
        this.uniforms.set(info.name, location);
      }
    }
    
    const numAttributes = gl.getProgramParameter(this.program, gl.ACTIVE_ATTRIBUTES);
    for (let i = 0; i < numAttributes; i++) {
      const info = gl.getActiveAttrib(this.program, i);
      if (info) {
        const location = gl.getAttribLocation(this.program, info.name);
        this.attributes.set(info.name, location);
      }
    }
  }

  use(): void {
    if (!this.compiled || !this.program) {
      throw new Error('Shader not compiled');
    }
    this.gl.useProgram(this.program);
  }

  private getUniformLocation(name: string): WebGLUniformLocation | null {
    if (!this.uniforms.has(name)) {
      if (this.program) {
        const location = this.gl.getUniformLocation(this.program, name);
        this.uniforms.set(name, location);
        return location;
      }
      return null;
    }
    return this.uniforms.get(name) || null;
  }

  setUniform(name: string, value: UniformValue): void {
    const location = this.getUniformLocation(name);
    if (!location) return;
    
    const gl = this.gl;
    if (typeof value === 'number') {
      gl.uniform1f(location, value);
    } else if (Array.isArray(value) || value instanceof Float32Array) {
      const arr = value instanceof Float32Array ? value : new Float32Array(value);
      switch (arr.length) {
        case 1: gl.uniform1fv(location, arr); break;
        case 2: gl.uniform2fv(location, arr); break;
        case 3: gl.uniform3fv(location, arr); break;
        case 4: gl.uniform4fv(location, arr); break;
        case 9: gl.uniformMatrix3fv(location, false, arr); break;
        case 16: gl.uniformMatrix4fv(location, false, arr); break;
      }
    } else if (value instanceof Int32Array) {
      switch (value.length) {
        case 1: gl.uniform1iv(location, value); break;
        case 2: gl.uniform2iv(location, value); break;
        case 3: gl.uniform3iv(location, value); break;
        case 4: gl.uniform4iv(location, value); break;
      }
    }
  }

  setUniforms(uniforms: Record<string, UniformValue>): void {
    Object.entries(uniforms).forEach(([name, value]) => {
      this.setUniform(name, value);
    });
  }

  getAttributeLocation(name: string): number {
    if (!this.attributes.has(name)) {
      if (this.program) {
        const location = this.gl.getAttribLocation(this.program, name);
        this.attributes.set(name, location);
        return location;
      }
      return -1;
    }
    return this.attributes.get(name) || -1;
  }

  isCompiled(): boolean {
    return this.compiled;
  }

  getProgram(): WebGLProgram | null {
    return this.program;
  }

  getEvents(): EventSystem {
    return this.events;
  }

  private cleanup(): void {
    const gl = this.gl;
    if (this.vertexShader) {
      gl.deleteShader(this.vertexShader);
      this.vertexShader = null;
    }
    if (this.fragmentShader) {
      gl.deleteShader(this.fragmentShader);
      this.fragmentShader = null;
    }
    if (this.program) {
      gl.deleteProgram(this.program);
      this.program = null;
    }
  }

  destroy(): void {
    this.cleanup();
    this.uniforms.clear();
    this.attributes.clear();
    this.compiled = false;
    this.events.clear();
  }
}
