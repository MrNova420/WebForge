/**
 * @module rendering
 * @fileoverview Bloom post-processing effect
 */

import { BasePostEffect } from '../PostProcessing';
import { WebGLContext } from '../WebGLContext';
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
  
  private _threshold: number;
  private _intensity: number;
  private blurPasses: number;
  private _blurRadius: number;
  
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
   * @param context - WebGL context wrapper
   * @param width - Render target width
   * @param height - Render target height
   * @param config - Bloom configuration
   */
  constructor(
    context: WebGLContext,
    width: number,
    height: number,
    config: BloomConfig = {}
  ) {
    super(context);
    
    this.width = width;
    this.height = height;
    this._threshold = config.threshold !== undefined ? config.threshold : 0.8;
    this._intensity = config.intensity !== undefined ? config.intensity : 1.0;
    this.blurPasses = config.blurPasses !== undefined ? config.blurPasses : 3;
    this._blurRadius = config.blurRadius !== undefined ? config.blurRadius : 1.0;
    
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
    
    this.brightnessShader = new Shader(this.gl, brightnessVertexShader, brightnessFragmentShader);
    this.brightnessShader.compile().catch(() => { this.brightnessShader = null; });
    
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
    
    this.blurShader = new Shader(this.gl, brightnessVertexShader, blurFragmentShader);
    this.blurShader.compile().catch(() => { this.blurShader = null; });
    
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
    
    this.combineShader = new Shader(this.gl, brightnessVertexShader, combineFragmentShader);
    this.combineShader.compile().catch(() => { this.combineShader = null; });
  }

  /**
   * Initializes framebuffers for bloom
   */
  private initializeBuffers(width: number, height: number): void {
    // Brightness extraction buffer (half resolution)
    this.brightnessBuffer = new Framebuffer(this.gl, {
      width: Math.floor(width / 2),
      height: Math.floor(height / 2),
      colorAttachments: 1,
      depthAttachment: false
    });
    
    // Create blur ping-pong buffers
    let w = Math.floor(width / 2);
    let h = Math.floor(height / 2);
    
    for (let i = 0; i < this.blurPasses; i++) {
      this.blurBuffers.push(
        new Framebuffer(this.gl, {
          width: w,
          height: h,
          colorAttachments: 1,
          depthAttachment: false
        })
      );
      w = Math.max(1, Math.floor(w / 2));
      h = Math.max(1, Math.floor(h / 2));
    }
  }

  /**
   * Renders the bloom effect
   * @param input - Input scene texture
   * @param output - Output framebuffer (null for screen)
   */
  render(input: Texture, output: Framebuffer | null): void {
    if (!this.brightnessShader || !this.blurShader || !this.combineShader || !this.brightnessBuffer) {
      return;
    }
    
    const halfW = Math.floor(this.width / 2);
    const halfH = Math.floor(this.height / 2);
    
    // Step 1: Extract bright areas into brightnessBuffer
    this.brightnessBuffer.bind();
    this.gl.viewport(0, 0, halfW, halfH);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);
    
    this.brightnessShader.use();
    this.brightnessShader.setUniform('u_texture', 0);
    this.brightnessShader.setUniform('u_threshold', this._threshold);
    input.bind(0);
    this.renderQuad();
    
    // Step 2: Blur the bright areas (horizontal + vertical passes)
    if (this.blurBuffers.length >= 2) {
      for (let pass = 0; pass < this.blurPasses; pass++) {
        const srcBuffer = pass === 0 ? this.brightnessBuffer : this.blurBuffers[(pass - 1) % 2];
        const dstBuffer = this.blurBuffers[pass % 2];
        const srcTex = srcBuffer.getColorTexture();
        if (!srcTex) continue;
        
        dstBuffer.bind();
        const bw = Math.max(1, Math.floor(halfW / Math.pow(2, Math.floor(pass / 2))));
        const bh = Math.max(1, Math.floor(halfH / Math.pow(2, Math.floor(pass / 2))));
        this.gl.viewport(0, 0, bw, bh);
        this.gl.clear(this.gl.COLOR_BUFFER_BIT);
        
        this.blurShader.use();
        this.blurShader.setUniform('u_texture', 0);
        // Alternate horizontal/vertical
        const dir = pass % 2 === 0 ? [this._blurRadius, 0] : [0, this._blurRadius];
        this.blurShader.setUniform('u_direction', dir);
        srcTex.bind(0);
        this.renderQuad();
      }
    }
    
    // Step 3: Combine bloom with original scene
    if (output) {
      output.bind();
    } else {
      this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
    }
    this.gl.viewport(0, 0, this.width, this.height);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);
    
    this.combineShader.use();
    this.combineShader.setUniform('u_sceneTexture', 0);
    this.combineShader.setUniform('u_bloomTexture', 1);
    this.combineShader.setUniform('u_intensity', this._intensity);
    
    input.bind(0);
    // Bind the last blur result (guard against empty blur buffer array)
    const lastBlurIdx = this.blurBuffers.length > 0 ? Math.min(this.blurPasses - 1, this.blurBuffers.length - 1) : -1;
    const bloomTex = lastBlurIdx >= 0 ? this.blurBuffers[lastBlurIdx].getColorTexture() : null;
    if (bloomTex) {
      bloomTex.bind(1);
    }
    this.renderQuad();
  }

  /**
   * Sets the brightness threshold
   * @param threshold - Brightness threshold (0-1)
   */
  setThreshold(threshold: number): void {
    this._threshold = Math.max(0, Math.min(1, threshold));
  }

  /**
   * Gets the brightness threshold
   * @returns Brightness threshold
   */
  getThreshold(): number {
    return this._threshold;
  }

  /**
   * Sets the bloom intensity
   * @param intensity - Bloom intensity
   */
  setIntensity(intensity: number): void {
    this._intensity = Math.max(0, intensity);
  }

  /**
   * Gets the bloom intensity
   * @returns Bloom intensity
   */
  getIntensity(): number {
    return this._intensity;
  }

  /**
   * Gets the blur radius
   * @returns Blur radius
   */
  getBlurRadius(): number {
    return this._blurRadius;
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
