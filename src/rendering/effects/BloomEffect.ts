/**
 * @module rendering
 * @fileoverview Bloom post-processing effect
 */

import { BasePostEffect } from '../PostProcessing';
import { Framebuffer } from '../Framebuffer';
import { Texture } from '../Texture';
import { Shader } from '../Shader';

/**
 * Bloom effect configuration
 */
export interface BloomConfig {
  /** Brightness threshold for bloom */
  threshold?: number;
  /** Bloom intensity */
  intensity?: number;
  /** Number of blur passes */
  blurPasses?: number;
  /** Blur radius */
  blurRadius?: number;
}

/**
 * Bloom post-processing effect
 * Creates a glow effect for bright areas
 */
export class BloomEffect extends BasePostEffect {
  name = 'Bloom';
  
  private threshold: number;
  private intensity: number;
  private blurPasses: number;
  private blurRadius: number;
  
  // Shaders
  private brightnessShader: Shader | null = null;
  private blurShader: Shader | null = null;
  private combineShader: Shader | null = null;
  
  // Framebuffers for downsampling and blur
  private brightnessBuffer: Framebuffer | null = null;
  private blurBuffers: Framebuffer[] = [];
  private width: number;
  private height: number;

  /**
   * Creates a new bloom effect
   * @param gl - WebGL context
   * @param width - Render target width
   * @param height - Render target height
   * @param config - Bloom configuration
   */
  constructor(
    gl: WebGL2RenderingContext,
    width: number,
    height: number,
    config: BloomConfig = {}
  ) {
    super(gl);
    
    this.width = width;
    this.height = height;
    this.threshold = config.threshold !== undefined ? config.threshold : 0.8;
    this.intensity = config.intensity !== undefined ? config.intensity : 1.0;
    this.blurPasses = config.blurPasses !== undefined ? config.blurPasses : 3;
    this.blurRadius = config.blurRadius !== undefined ? config.blurRadius : 1.0;
    
    this.initializeShaders();
    this.initializeBuffers(width, height);
  }

  /**
   * Initializes bloom shaders
   */
  private initializeShaders(): void {
    // Brightness extraction shader
    const brightnessVertexShader = `#version 300 es
      in vec2 a_position;
      in vec2 a_texcoord;
      out vec2 v_texcoord;
      
      void main() {
        v_texcoord = a_texcoord;
        gl_Position = vec4(a_position, 0.0, 1.0);
      }
    `;
    
    const brightnessFragmentShader = `#version 300 es
      precision highp float;
      
      in vec2 v_texcoord;
      out vec4 fragColor;
      
      uniform sampler2D u_texture;
      uniform float u_threshold;
      
      void main() {
        vec3 color = texture(u_texture, v_texcoord).rgb;
        float brightness = dot(color, vec3(0.2126, 0.7152, 0.0722));
        
        if (brightness > u_threshold) {
          fragColor = vec4(color, 1.0);
        } else {
          fragColor = vec4(0.0, 0.0, 0.0, 1.0);
        }
      }
    `;
    
    this.brightnessShader = new Shader(this.gl);
    this.brightnessShader.compile(brightnessVertexShader, brightnessFragmentShader);
    
    // Gaussian blur shader
    const blurFragmentShader = `#version 300 es
      precision highp float;
      
      in vec2 v_texcoord;
      out vec4 fragColor;
      
      uniform sampler2D u_texture;
      uniform vec2 u_direction;
      
      void main() {
        vec2 texelSize = 1.0 / vec2(textureSize(u_texture, 0));
        vec3 result = vec3(0.0);
        float totalWeight = 0.0;
        
        // Simple 5-tap blur
        for (int i = -2; i <= 2; i++) {
          float weight = 1.0 / (abs(float(i)) + 1.0);
          vec2 offset = u_direction * texelSize * float(i);
          result += texture(u_texture, v_texcoord + offset).rgb * weight;
          totalWeight += weight;
        }
        
        fragColor = vec4(result / totalWeight, 1.0);
      }
    `;
    
    this.blurShader = new Shader(this.gl);
    this.blurShader.compile(brightnessVertexShader, blurFragmentShader);
    
    // Combine shader
    const combineFragmentShader = `#version 300 es
      precision highp float;
      
      in vec2 v_texcoord;
      out vec4 fragColor;
      
      uniform sampler2D u_sceneTexture;
      uniform sampler2D u_bloomTexture;
      uniform float u_intensity;
      
      void main() {
        vec3 scene = texture(u_sceneTexture, v_texcoord).rgb;
        vec3 bloom = texture(u_bloomTexture, v_texcoord).rgb;
        
        vec3 result = scene + bloom * u_intensity;
        fragColor = vec4(result, 1.0);
      }
    `;
    
    this.combineShader = new Shader(this.gl);
    this.combineShader.compile(brightnessVertexShader, combineFragmentShader);
  }

  /**
   * Initializes framebuffers for bloom
   */
  private initializeBuffers(width: number, height: number): void {
    // Brightness extraction buffer (half resolution)
    this.brightnessBuffer = new Framebuffer(this.gl, {
      width: Math.floor(width / 2),
      height: Math.floor(height / 2),
      hasDepth: false
    });
    
    // Create blur ping-pong buffers
    let w = Math.floor(width / 2);
    let h = Math.floor(height / 2);
    
    for (let i = 0; i < this.blurPasses; i++) {
      this.blurBuffers.push(
        new Framebuffer(this.gl, {
          width: w,
          height: h,
          hasDepth: false
        })
      );
      w = Math.max(1, Math.floor(w / 2));
      h = Math.max(1, Math.floor(h / 2));
    }
  }

  /**
   * Renders the bloom effect
   * @param input - Input texture
   * @param output - Output framebuffer
   */
  render(input: Texture, output: Framebuffer | null): void {
    if (!this.brightnessShader || !this.blurShader || !this.combineShader || !this.brightnessBuffer) {
      return;
    }
    
    // Extract bright areas would go here
    // Blur would go here
    // Combine would go here
    
    // For now, just pass through
    if (output) {
      output.bind();
    } else {
      this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
    }
    this.gl.viewport(0, 0, this.width, this.height);
  }

  /**
   * Sets the brightness threshold
   * @param threshold - Brightness threshold (0-1)
   */
  setThreshold(threshold: number): void {
    this.threshold = Math.max(0, Math.min(1, threshold));
  }

  /**
   * Sets the bloom intensity
   * @param intensity - Bloom intensity
   */
  setIntensity(intensity: number): void {
    this.intensity = Math.max(0, intensity);
  }

  /**
   * Disposes bloom resources
   */
  dispose(): void {
    super.dispose();
    
    if (this.brightnessBuffer) {
      this.brightnessBuffer.unbind();
    }
    
    this.blurBuffers.forEach(buffer => buffer.unbind());
    this.blurBuffers = [];
  }
}
