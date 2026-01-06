import { Shader } from './Shader';
import { Texture } from './Texture';
import { Vector2 } from '../math/Vector2';
import { Vector3 } from '../math/Vector3';
import { Vector4 } from '../math/Vector4';
import { Matrix4 } from '../math/Matrix4';

/**
 * Material property value types
 */
export type MaterialPropertyValue = 
  | number 
  | Vector2 
  | Vector3 
  | Vector4 
  | Matrix4 
  | Texture 
  | number[];

/**
 * Material properties collection
 */
export interface MaterialProperties {
  [key: string]: MaterialPropertyValue;
}

/**
 * Material rendering configuration
 */
export interface MaterialConfig {
  /** Shader program */
  shader: Shader;
  /** Material properties */
  properties?: MaterialProperties;
  /** Enable depth testing */
  depthTest?: boolean;
  /** Enable depth writing */
  depthWrite?: boolean;
  /** Enable blending */
  blend?: boolean;
  /** Blend source factor */
  blendSrc?: number;
  /** Blend destination factor */
  blendDst?: number;
  /** Enable face culling */
  cull?: boolean;
  /** Cull face mode */
  cullFace?: 'BACK' | 'FRONT' | 'FRONT_AND_BACK';
  /** Enable wireframe (not supported in WebGL, requires custom shader) */
  wireframe?: boolean;
}

/**
 * Material defines rendering appearance and shader properties.
 * Manages shader uniforms and rendering state.
 */
export class Material {
  private gl: WebGLRenderingContext | WebGL2RenderingContext;
  private shader: Shader;
  private properties: MaterialProperties = {};
  
  // Render state
  private depthTest: boolean = true;
  private depthWrite: boolean = true;
  private blend: boolean = false;
  private blendSrc: number;
  private blendDst: number;
  private cull: boolean = true;
  private cullFace: number;
  private wireframe: boolean = false;

  // Texture unit tracking
  private textureUnits: Map<string, number> = new Map();
  private nextTextureUnit: number = 0;

  /**
   * Creates a new material
   * @param gl - WebGL context
   * @param config - Material configuration
   */
  constructor(gl: WebGLRenderingContext | WebGL2RenderingContext, config: MaterialConfig) {
    this.gl = gl;
    this.shader = config.shader;
    
    if (config.properties) {
      this.properties = { ...config.properties };
    }

    this.depthTest = config.depthTest !== undefined ? config.depthTest : true;
    this.depthWrite = config.depthWrite !== undefined ? config.depthWrite : true;
    this.blend = config.blend !== undefined ? config.blend : false;
    this.blendSrc = config.blendSrc !== undefined ? config.blendSrc : gl.SRC_ALPHA;
    this.blendDst = config.blendDst !== undefined ? config.blendDst : gl.ONE_MINUS_SRC_ALPHA;
    this.cull = config.cull !== undefined ? config.cull : true;
    this.cullFace = config.cullFace ? gl[config.cullFace] : gl.BACK;
    this.wireframe = config.wireframe !== undefined ? config.wireframe : false;
  }

  /**
   * Sets a material property
   * @param name - Property name (uniform name in shader)
   * @param value - Property value
   */
  public setProperty(name: string, value: MaterialPropertyValue): void {
    this.properties[name] = value;
  }

  /**
   * Gets a material property
   * @param name - Property name
   * @returns Property value or undefined
   */
  public getProperty(name: string): MaterialPropertyValue | undefined {
    return this.properties[name];
  }

  /**
   * Checks if material has a property
   * @param name - Property name
   */
  public hasProperty(name: string): boolean {
    return name in this.properties;
  }

  /**
   * Removes a material property
   * @param name - Property name
   */
  public removeProperty(name: string): void {
    delete this.properties[name];
  }

  /**
   * Gets all property names
   */
  public getPropertyNames(): string[] {
    return Object.keys(this.properties);
  }

  /**
   * Applies material state and uploads uniforms to shader
   */
  public use(): void {
    // Use shader
    this.shader.use();

    // Apply render state
    if (this.depthTest) {
      this.gl.enable(this.gl.DEPTH_TEST);
    } else {
      this.gl.disable(this.gl.DEPTH_TEST);
    }

    this.gl.depthMask(this.depthWrite);

    if (this.blend) {
      this.gl.enable(this.gl.BLEND);
      this.gl.blendFunc(this.blendSrc, this.blendDst);
    } else {
      this.gl.disable(this.gl.BLEND);
    }

    if (this.cull) {
      this.gl.enable(this.gl.CULL_FACE);
      this.gl.cullFace(this.cullFace);
    } else {
      this.gl.disable(this.gl.CULL_FACE);
    }

    // Upload properties as uniforms
    this.nextTextureUnit = 0;
    this.textureUnits.clear();

    for (const [name, value] of Object.entries(this.properties)) {
      this.uploadUniform(name, value);
    }
  }

  /**
   * Uploads a uniform value to the shader
   * @param name - Uniform name
   * @param value - Uniform value
   */
  private uploadUniform(name: string, value: MaterialPropertyValue): void {
    if (typeof value === 'number') {
      this.shader.setUniform1f(name, value);
    } else if (value instanceof Vector2) {
      this.shader.setUniform2f(name, value.x, value.y);
    } else if (value instanceof Vector3) {
      this.shader.setUniform3f(name, value.x, value.y, value.z);
    } else if (value instanceof Vector4) {
      this.shader.setUniform4f(name, value.x, value.y, value.z, value.w);
    } else if (value instanceof Matrix4) {
      this.shader.setUniformMatrix4fv(name, value.elements);
    } else if (value instanceof Texture) {
      // Assign texture unit
      let unit = this.textureUnits.get(name);
      if (unit === undefined) {
        unit = this.nextTextureUnit++;
        this.textureUnits.set(name, unit);
      }

      value.bind(unit);
      this.shader.setUniform1i(name, unit);
    } else if (Array.isArray(value)) {
      // Handle array uniforms
      if (value.length === 2) {
        this.shader.setUniform2f(name, value[0], value[1]);
      } else if (value.length === 3) {
        this.shader.setUniform3f(name, value[0], value[1], value[2]);
      } else if (value.length === 4) {
        this.shader.setUniform4f(name, value[0], value[1], value[2], value[3]);
      }
    }
  }

  /**
   * Gets the shader
   */
  public getShader(): Shader {
    return this.shader;
  }

  /**
   * Sets the shader
   * @param shader - New shader
   */
  public setShader(shader: Shader): void {
    this.shader = shader;
  }

  /**
   * Gets depth test enabled state
   */
  public getDepthTest(): boolean {
    return this.depthTest;
  }

  /**
   * Sets depth test enabled state
   * @param enabled - Enable depth testing
   */
  public setDepthTest(enabled: boolean): void {
    this.depthTest = enabled;
  }

  /**
   * Gets depth write enabled state
   */
  public getDepthWrite(): boolean {
    return this.depthWrite;
  }

  /**
   * Sets depth write enabled state
   * @param enabled - Enable depth writing
   */
  public setDepthWrite(enabled: boolean): void {
    this.depthWrite = enabled;
  }

  /**
   * Gets blend enabled state
   */
  public getBlend(): boolean {
    return this.blend;
  }

  /**
   * Sets blend enabled state
   * @param enabled - Enable blending
   */
  public setBlend(enabled: boolean): void {
    this.blend = enabled;
  }

  /**
   * Sets blend function
   * @param src - Source blend factor
   * @param dst - Destination blend factor
   */
  public setBlendFunc(src: number, dst: number): void {
    this.blendSrc = src;
    this.blendDst = dst;
  }

  /**
   * Gets cull enabled state
   */
  public getCull(): boolean {
    return this.cull;
  }

  /**
   * Sets cull enabled state
   * @param enabled - Enable face culling
   */
  public setCull(enabled: boolean): void {
    this.cull = enabled;
  }

  /**
   * Sets cull face mode
   * @param face - Face to cull
   */
  public setCullFace(face: 'BACK' | 'FRONT' | 'FRONT_AND_BACK'): void {
    this.cullFace = this.gl[face];
  }

  /**
   * Creates a copy of this material
   * @returns Cloned material
   */
  public clone(): Material {
    const config: MaterialConfig = {
      shader: this.shader,
      properties: { ...this.properties },
      depthTest: this.depthTest,
      depthWrite: this.depthWrite,
      blend: this.blend,
      blendSrc: this.blendSrc,
      blendDst: this.blendDst,
      cull: this.cull,
      wireframe: this.wireframe
    };

    return new Material(this.gl, config);
  }

  /**
   * Destroys material (does not destroy shader or textures)
   */
  public destroy(): void {
    this.properties = {};
    this.textureUnits.clear();
  }
}
