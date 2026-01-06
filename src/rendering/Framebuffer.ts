/**
 * @module rendering
 * @fileoverview Framebuffer class - WebGL framebuffer management for render targets
 */

import { Logger } from '../core/Logger';
import { Texture, TextureFormat, TextureType } from './Texture';

/**
 * Framebuffer attachment type.
 */
export enum AttachmentType {
  COLOR = 'color',
  DEPTH = 'depth',
  STENCIL = 'stencil',
  DEPTH_STENCIL = 'depthStencil'
}

/**
 * Framebuffer configuration.
 */
export interface FramebufferConfig {
  width: number;
  height: number;
  colorAttachments?: number;
  depthAttachment?: boolean;
  stencilAttachment?: boolean;
}

/**
 * WebGL framebuffer wrapper for off-screen rendering.
 * Supports multiple color attachments, depth, and stencil buffers.
 * 
 * @example
 * ```typescript
 * const fbo = new Framebuffer(gl, {
 *   width: 1024,
 *   height: 1024,
 *   colorAttachments: 1,
 *   depthAttachment: true
 * });
 * 
 * fbo.bind();
 * // Render to framebuffer
 * fbo.unbind();
 * 
 * const colorTexture = fbo.getColorTexture(0);
 * ```
 */
export class Framebuffer {
  private gl: WebGLRenderingContext | WebGL2RenderingContext;
  private framebuffer: WebGLFramebuffer | null;
  private colorTextures: Texture[];
  private depthTexture: Texture | null;
  private depthRenderbuffer: WebGLRenderbuffer | null;
  private stencilRenderbuffer: WebGLRenderbuffer | null;
  private width: number;
  private height: number;
  private logger: Logger;

  constructor(
    gl: WebGLRenderingContext | WebGL2RenderingContext,
    config: FramebufferConfig
  ) {
    this.gl = gl;
    this.width = config.width;
    this.height = config.height;
    this.colorTextures = [];
    this.depthTexture = null;
    this.depthRenderbuffer = null;
    this.stencilRenderbuffer = null;
    this.logger = new Logger('Framebuffer');
    
    this.framebuffer = gl.createFramebuffer();
    if (!this.framebuffer) {
      throw new Error('Failed to create framebuffer');
    }
    
    this.initialize(config);
  }

  /**
   * Initializes framebuffer attachments.
   */
  private initialize(config: FramebufferConfig): void {
    const gl = this.gl;
    
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
    
    // Create color attachments
    const numColorAttachments = config.colorAttachments ?? 1;
    for (let i = 0; i < numColorAttachments; i++) {
      const texture = new Texture(gl, {
        type: TextureType.TEXTURE_2D,
        format: TextureFormat.RGBA,
        generateMipmaps: false
      });
      texture.createEmpty(this.width, this.height);
      
      gl.framebufferTexture2D(
        gl.FRAMEBUFFER,
        gl.COLOR_ATTACHMENT0 + i,
        gl.TEXTURE_2D,
        texture.getTexture(),
        0
      );
      
      this.colorTextures.push(texture);
    }
    
    // Create depth attachment
    if (config.depthAttachment) {
      this.depthTexture = new Texture(gl, {
        type: TextureType.TEXTURE_2D,
        format: TextureFormat.DEPTH,
        generateMipmaps: false
      });
      this.depthTexture.createEmpty(this.width, this.height);
      
      gl.framebufferTexture2D(
        gl.FRAMEBUFFER,
        gl.DEPTH_ATTACHMENT,
        gl.TEXTURE_2D,
        this.depthTexture.getTexture(),
        0
      );
    }
    
    // Create stencil attachment
    if (config.stencilAttachment) {
      this.stencilRenderbuffer = gl.createRenderbuffer();
      if (this.stencilRenderbuffer) {
        gl.bindRenderbuffer(gl.RENDERBUFFER, this.stencilRenderbuffer);
        gl.renderbufferStorage(gl.RENDERBUFFER, gl.STENCIL_INDEX8, this.width, this.height);
        gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.STENCIL_ATTACHMENT, gl.RENDERBUFFER, this.stencilRenderbuffer);
      }
    }
    
    // Check framebuffer completeness
    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if (status !== gl.FRAMEBUFFER_COMPLETE) {
      throw new Error(`Framebuffer incomplete: ${this.getStatusString(status)}`);
    }
    
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    
    this.logger.info(`Framebuffer created: ${this.width}x${this.height} with ${numColorAttachments} color attachments`);
  }

  /**
   * Gets framebuffer status string.
   */
  private getStatusString(status: number): string {
    const gl = this.gl;
    switch (status) {
      case gl.FRAMEBUFFER_INCOMPLETE_ATTACHMENT:
        return 'FRAMEBUFFER_INCOMPLETE_ATTACHMENT';
      case gl.FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT:
        return 'FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT';
      case gl.FRAMEBUFFER_INCOMPLETE_DIMENSIONS:
        return 'FRAMEBUFFER_INCOMPLETE_DIMENSIONS';
      case gl.FRAMEBUFFER_UNSUPPORTED:
        return 'FRAMEBUFFER_UNSUPPORTED';
      default:
        return 'UNKNOWN_ERROR';
    }
  }

  /**
   * Binds the framebuffer for rendering.
   */
  bind(): void {
    if (!this.framebuffer) {
      throw new Error('Framebuffer not initialized');
    }
    
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
    gl.viewport(0, 0, this.width, this.height);
  }

  /**
   * Unbinds the framebuffer (returns to default framebuffer).
   */
  unbind(): void {
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
  }

  /**
   * Clears the framebuffer.
   * @param r - Red component
   * @param g - Green component
   * @param b - Blue component
   * @param a - Alpha component
   */
  clear(r: number = 0, g: number = 0, b: number = 0, a: number = 1): void {
    const gl = this.gl;
    this.bind();
    gl.clearColor(r, g, b, a);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
  }

  /**
   * Gets a color texture attachment.
   * @param index - Attachment index
   * @returns Color texture
   */
  getColorTexture(index: number = 0): Texture | null {
    return this.colorTextures[index] || null;
  }

  /**
   * Gets all color textures.
   * @returns Array of color textures
   */
  getAllColorTextures(): Texture[] {
    return this.colorTextures;
  }

  /**
   * Gets the depth texture.
   * @returns Depth texture or null
   */
  getDepthTexture(): Texture | null {
    return this.depthTexture;
  }

  /**
   * Gets framebuffer width.
   */
  getWidth(): number {
    return this.width;
  }

  /**
   * Gets framebuffer height.
   */
  getHeight(): number {
    return this.height;
  }

  /**
   * Resizes the framebuffer.
   * @param width - New width
   * @param height - New height
   */
  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    
    // Recreate color textures
    this.colorTextures.forEach(texture => {
      texture.createEmpty(width, height);
    });
    
    // Recreate depth texture
    if (this.depthTexture) {
      this.depthTexture.createEmpty(width, height);
    }
    
    // Recreate stencil renderbuffer
    if (this.stencilRenderbuffer) {
      const gl = this.gl;
      gl.bindRenderbuffer(gl.RENDERBUFFER, this.stencilRenderbuffer);
      gl.renderbufferStorage(gl.RENDERBUFFER, gl.STENCIL_INDEX8, width, height);
    }
    
    this.logger.debug(`Framebuffer resized to ${width}x${height}`);
  }

  /**
   * Destroys the framebuffer.
   */
  destroy(): void {
    const gl = this.gl;
    
    if (this.framebuffer) {
      gl.deleteFramebuffer(this.framebuffer);
      this.framebuffer = null;
    }
    
    this.colorTextures.forEach(texture => texture.destroy());
    this.colorTextures = [];
    
    if (this.depthTexture) {
      this.depthTexture.destroy();
      this.depthTexture = null;
    }
    
    if (this.depthRenderbuffer) {
      gl.deleteRenderbuffer(this.depthRenderbuffer);
      this.depthRenderbuffer = null;
    }
    
    if (this.stencilRenderbuffer) {
      gl.deleteRenderbuffer(this.stencilRenderbuffer);
      this.stencilRenderbuffer = null;
    }
  }
}
