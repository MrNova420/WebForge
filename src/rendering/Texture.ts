/**
 * @module rendering
 * @fileoverview Texture class - WebGL texture management with comprehensive format support
 */

import { Logger } from '../core/Logger';
import { EventSystem } from '../core/EventSystem';

/**
 * Texture type enumeration.
 */
export enum TextureType {
  TEXTURE_2D = 'texture2d',
  TEXTURE_CUBE = 'textureCube'
}

/**
 * Texture format enumeration.
 */
export enum TextureFormat {
  RGB = 'rgb',
  RGBA = 'rgba',
  ALPHA = 'alpha',
  LUMINANCE = 'luminance',
  LUMINANCE_ALPHA = 'luminanceAlpha',
  DEPTH = 'depth'
}

/**
 * Texture filter mode.
 */
export enum TextureFilter {
  NEAREST = 'nearest',
  LINEAR = 'linear',
  NEAREST_MIPMAP_NEAREST = 'nearestMipmapNearest',
  LINEAR_MIPMAP_NEAREST = 'linearMipmapNearest',
  NEAREST_MIPMAP_LINEAR = 'nearestMipmapLinear',
  LINEAR_MIPMAP_LINEAR = 'linearMipmapLinear'
}

/**
 * Texture wrap mode.
 */
export enum TextureWrap {
  REPEAT = 'repeat',
  CLAMP_TO_EDGE = 'clampToEdge',
  MIRRORED_REPEAT = 'mirroredRepeat'
}

/**
 * Texture configuration.
 */
export interface TextureConfig {
  type?: TextureType;
  format?: TextureFormat;
  minFilter?: TextureFilter;
  magFilter?: TextureFilter;
  wrapS?: TextureWrap;
  wrapT?: TextureWrap;
  generateMipmaps?: boolean;
  flipY?: boolean;
  premultiplyAlpha?: boolean;
}

/**
 * WebGL texture wrapper with loading and configuration.
 * Supports 2D textures and cube maps with full format control.
 * 
 * @example
 * ```typescript
 * const texture = new Texture(gl, {
 *   format: TextureFormat.RGBA,
 *   minFilter: TextureFilter.LINEAR_MIPMAP_LINEAR,
 *   generateMipmaps: true
 * });
 * 
 * await texture.loadFromURL('texture.png');
 * texture.bind(0);
 * ```
 */
export class Texture {
  private gl: WebGLRenderingContext | WebGL2RenderingContext;
  private texture: WebGLTexture | null;
  private config: Required<TextureConfig>;
  private width: number;
  private height: number;
  private loaded: boolean;
  private events: EventSystem;
  private logger: Logger;

  constructor(
    gl: WebGLRenderingContext | WebGL2RenderingContext,
    config: TextureConfig = {}
  ) {
    this.gl = gl;
    this.config = {
      type: config.type ?? TextureType.TEXTURE_2D,
      format: config.format ?? TextureFormat.RGBA,
      minFilter: config.minFilter ?? TextureFilter.LINEAR,
      magFilter: config.magFilter ?? TextureFilter.LINEAR,
      wrapS: config.wrapS ?? TextureWrap.REPEAT,
      wrapT: config.wrapT ?? TextureWrap.REPEAT,
      generateMipmaps: config.generateMipmaps ?? false,
      flipY: config.flipY ?? true,
      premultiplyAlpha: config.premultiplyAlpha ?? false
    };
    this.width = 0;
    this.height = 0;
    this.loaded = false;
    this.events = new EventSystem();
    this.logger = new Logger('Texture');
    
    this.texture = gl.createTexture();
    if (!this.texture) {
      throw new Error('Failed to create texture');
    }
  }

  /**
   * Gets WebGL texture target.
   */
  private getTarget(): number {
    const gl = this.gl;
    return this.config.type === TextureType.TEXTURE_CUBE 
      ? gl.TEXTURE_CUBE_MAP 
      : gl.TEXTURE_2D;
  }

  /**
   * Gets WebGL format.
   */
  private getFormat(): number {
    const gl = this.gl;
    switch (this.config.format) {
      case TextureFormat.RGB: return gl.RGB;
      case TextureFormat.RGBA: return gl.RGBA;
      case TextureFormat.ALPHA: return gl.ALPHA;
      case TextureFormat.LUMINANCE: return gl.LUMINANCE;
      case TextureFormat.LUMINANCE_ALPHA: return gl.LUMINANCE_ALPHA;
      case TextureFormat.DEPTH: return gl.DEPTH_COMPONENT;
      default: return gl.RGBA;
    }
  }

  /**
   * Gets WebGL filter mode.
   */
  private getFilter(filter: TextureFilter): number {
    const gl = this.gl;
    switch (filter) {
      case TextureFilter.NEAREST: return gl.NEAREST;
      case TextureFilter.LINEAR: return gl.LINEAR;
      case TextureFilter.NEAREST_MIPMAP_NEAREST: return gl.NEAREST_MIPMAP_NEAREST;
      case TextureFilter.LINEAR_MIPMAP_NEAREST: return gl.LINEAR_MIPMAP_NEAREST;
      case TextureFilter.NEAREST_MIPMAP_LINEAR: return gl.NEAREST_MIPMAP_LINEAR;
      case TextureFilter.LINEAR_MIPMAP_LINEAR: return gl.LINEAR_MIPMAP_LINEAR;
      default: return gl.LINEAR;
    }
  }

  /**
   * Gets WebGL wrap mode.
   */
  private getWrap(wrap: TextureWrap): number {
    const gl = this.gl;
    switch (wrap) {
      case TextureWrap.REPEAT: return gl.REPEAT;
      case TextureWrap.CLAMP_TO_EDGE: return gl.CLAMP_TO_EDGE;
      case TextureWrap.MIRRORED_REPEAT: return gl.MIRRORED_REPEAT;
      default: return gl.REPEAT;
    }
  }

  /**
   * Applies texture parameters.
   */
  private applyParameters(): void {
    const gl = this.gl;
    const target = this.getTarget();
    
    gl.texParameteri(target, gl.TEXTURE_MIN_FILTER, this.getFilter(this.config.minFilter));
    gl.texParameteri(target, gl.TEXTURE_MAG_FILTER, this.getFilter(this.config.magFilter));
    gl.texParameteri(target, gl.TEXTURE_WRAP_S, this.getWrap(this.config.wrapS));
    gl.texParameteri(target, gl.TEXTURE_WRAP_T, this.getWrap(this.config.wrapT));
  }

  /**
   * Loads texture from image data.
   * @param image - Image element
   */
  loadFromImage(image: HTMLImageElement | HTMLCanvasElement | ImageBitmap): void {
    if (!this.texture) {
      throw new Error('Texture not initialized');
    }
    
    const gl = this.gl;
    const target = this.getTarget();
    const format = this.getFormat();
    
    gl.bindTexture(target, this.texture);
    
    // Set pixel store parameters
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, this.config.flipY);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, this.config.premultiplyAlpha);
    
    // Upload image data
    gl.texImage2D(target, 0, format, format, gl.UNSIGNED_BYTE, image);
    
    // Generate mipmaps if requested
    if (this.config.generateMipmaps) {
      gl.generateMipmap(target);
    }
    
    // Apply parameters
    this.applyParameters();
    
    this.width = image.width;
    this.height = image.height;
    this.loaded = true;
    
    this.events.emit('loaded', { width: this.width, height: this.height });
    this.logger.info(`Texture loaded: ${this.width}x${this.height}`);
  }

  /**
   * Loads texture from URL.
   * @param url - Image URL
   * @returns Promise that resolves when loaded
   */
  async loadFromURL(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.crossOrigin = 'anonymous';
      
      image.onload = () => {
        try {
          this.loadFromImage(image);
          resolve();
        } catch (error) {
          reject(error);
        }
      };
      
      image.onerror = () => {
        reject(new Error(`Failed to load texture from ${url}`));
      };
      
      image.src = url;
    });
  }

  /**
   * Creates empty texture with specified dimensions.
   * @param width - Texture width
   * @param height - Texture height
   */
  createEmpty(width: number, height: number): void {
    if (!this.texture) {
      throw new Error('Texture not initialized');
    }
    
    const gl = this.gl;
    const target = this.getTarget();
    const format = this.getFormat();
    
    gl.bindTexture(target, this.texture);
    gl.texImage2D(target, 0, format, width, height, 0, format, gl.UNSIGNED_BYTE, null);
    
    this.applyParameters();
    
    this.width = width;
    this.height = height;
    this.loaded = true;
    
    this.logger.debug(`Empty texture created: ${width}x${height}`);
  }

  /**
   * Binds texture to a texture unit.
   * @param unit - Texture unit (0-31)
   */
  bind(unit: number = 0): void {
    if (!this.texture) {
      throw new Error('Texture not initialized');
    }
    
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(this.getTarget(), this.texture);
  }

  /**
   * Unbinds texture.
   */
  unbind(): void {
    const gl = this.gl;
    gl.bindTexture(this.getTarget(), null);
  }

  /**
   * Gets texture width.
   */
  getWidth(): number {
    return this.width;
  }

  /**
   * Gets texture height.
   */
  getHeight(): number {
    return this.height;
  }

  /**
   * Checks if texture is loaded.
   */
  isLoaded(): boolean {
    return this.loaded;
  }

  /**
   * Gets WebGL texture.
   */
  getTexture(): WebGLTexture | null {
    return this.texture;
  }

  /**
   * Gets event system.
   */
  getEvents(): EventSystem {
    return this.events;
  }

  /**
   * Destroys the texture.
   */
  destroy(): void {
    if (this.texture) {
      this.gl.deleteTexture(this.texture);
      this.texture = null;
    }
    this.loaded = false;
    this.events.clear();
  }
}
