/**
 * @module rendering
 * @fileoverview Motion blur post-processing effect
 */

import { BasePostEffect } from '../PostProcessing';
import { WebGLContext } from '../WebGLContext';
import { Framebuffer } from '../Framebuffer';
import { Texture } from '../Texture';
import { Shader } from '../Shader';
import { Matrix4 } from '../../math/Matrix4';

/**
 * Motion blur effect configuration
 */
export interface MotionBlurConfig {
  /** Number of motion blur samples */
  samples?: number;
  /** Motion blur strength/intensity */
  strength?: number;
}

/**
 * Motion blur post-processing effect
 * Creates motion blur based on velocity buffer
 */
export class MotionBlurEffect extends BasePostEffect {
  name = 'MotionBlur';
  
  private _samples: number;
  private _strength: number;
  
  private motionBlurShader: Shader | null = null;
  
  private currentViewProjection: Matrix4;
  private previousViewProjection: Matrix4;
  
  private width: number;
  private height: number;

  /**
   * Creates a new motion blur effect
   * @param context - WebGL context wrapper
   * @param width - Render target width
   * @param height - Render target height
   * @param config - Motion blur configuration
   */
  constructor(
    context: WebGLContext,
    width: number,
    height: number,
    config: MotionBlurConfig = {}
  ) {
    super(context);
    
    this.width = width;
    this.height = height;
    this._samples = config.samples || 16;
    this._strength = config.strength !== undefined ? config.strength : 1.0;
    
    this.currentViewProjection = new Matrix4();
    this.previousViewProjection = new Matrix4();
    
    this.initializeShaders();
  }

  /**
   * Initializes motion blur shaders
   */
  private initializeShaders(): void {
    const vertexShader = `#version 300 es
      in vec2 a_position;
      in vec2 a_texcoord;
      out vec2 v_texcoord;
      
      void main() {
        v_texcoord = a_texcoord;
        gl_Position = vec4(a_position, 0.0, 1.0);
      }
    `;
    
    const fragmentShader = `#version 300 es
      precision highp float;
      
      in vec2 v_texcoord;
      out vec4 fragColor;
      
      uniform sampler2D u_colorTexture;
      uniform sampler2D u_depthTexture;
      uniform sampler2D u_velocityTexture;
      uniform int u_samples;
      uniform float u_strength;
      
      void main() {
        // Get velocity from velocity buffer
        vec2 velocity = texture(u_velocityTexture, v_texcoord).xy;
        velocity *= u_strength;
        
        // Sample along motion vector
        vec4 color = texture(u_colorTexture, v_texcoord);
        vec2 texCoord = v_texcoord;
        
        for (int i = 1; i < u_samples; i++) {
          vec2 offset = velocity * (float(i) / float(u_samples - 1) - 0.5);
          color += texture(u_colorTexture, v_texcoord + offset);
        }
        
        color /= float(u_samples);
        fragColor = color;
      }
    `;
    
    this.motionBlurShader = new Shader(this.gl, vertexShader, fragmentShader);
  }

  /**
   * Updates the view-projection matrices for motion vectors
   * @param viewProjection - Current frame's view-projection matrix
   */
  updateViewProjection(viewProjection: Matrix4): void {
    this.previousViewProjection.copy(this.currentViewProjection);
    this.currentViewProjection.copy(viewProjection);
  }

  /**
   * Renders the motion blur effect
   * @param input - Input texture
   * @param output - Output framebuffer
   */
  render(input: Texture, output: Framebuffer | null): void {
    if (!this.motionBlurShader) {
      return;
    }
    
    // Bind output
    if (output) {
      output.bind();
    } else {
      this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
    }
    
    this.gl.viewport(0, 0, this.width, this.height);
    
    // For now, just pass through (full implementation requires velocity buffer)
    // Use shader
    this.motionBlurShader.use();
    this.motionBlurShader.setUniform('u_colorTexture', 0);
    this.motionBlurShader.setUniform('u_samples', this._samples);
    this.motionBlurShader.setUniform('u_strength', this._strength);
    
    // Bind input texture
    input.bind(0);
    
    // TODO: Bind depth and velocity textures when available
    
    // Render (would render quad in full implementation)
    // this.renderQuad();
  }

  /**
   * Sets the number of samples
   * @param samples - Number of samples
   */
  setSamples(samples: number): void {
    this._samples = Math.max(1, samples);
  }

  /**
   * Gets the number of samples
   */
  getSamples(): number {
    return this._samples;
  }

  /**
   * Sets the motion blur strength
   * @param strength - Motion blur strength
   */
  setStrength(strength: number): void {
    this._strength = Math.max(0, strength);
  }

  /**
   * Gets the motion blur strength
   */
  getStrength(): number {
    return this._strength;
  }

  /**
   * Gets the current view-projection matrix
   */
  getCurrentViewProjection(): Matrix4 {
    return this.currentViewProjection;
  }

  /**
   * Gets the previous view-projection matrix
   */
  getPreviousViewProjection(): Matrix4 {
    return this.previousViewProjection;
  }
}
