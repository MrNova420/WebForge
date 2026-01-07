/**
 * @module rendering
 * @fileoverview Depth of Field (DOF) post-processing effect
 */

import { BasePostEffect } from '../PostProcessing';
import { Framebuffer } from '../Framebuffer';
import { Texture } from '../Texture';
import { Shader } from '../Shader';

/**
 * Depth of field effect configuration
 */
export interface DepthOfFieldConfig {
  /** Focus distance */
  focusDistance?: number;
  /** Focus range (depth range in focus) */
  focusRange?: number;
  /** Bokeh size (blur amount) */
  bokehSize?: number;
  /** Maximum blur amount */
  maxBlur?: number;
}

/**
 * Depth of Field (DOF) post-processing effect
 * Creates realistic camera focus with bokeh blur
 */
export class DepthOfFieldEffect extends BasePostEffect {
  name = 'DepthOfField';
  
  private _focusDistance: number;
  private _focusRange: number;
  private _bokehSize: number;
  private _maxBlur: number;
  
  private dofShader: Shader | null = null;
  private blurShader: Shader | null = null;
  
  private cocBuffer: Framebuffer | null = null; // Circle of Confusion
  private blurBuffer: Framebuffer | null = null;
  
  private width: number;
  private height: number;

  /**
   * Creates a new DOF effect
   * @param gl - WebGL context
   * @param width - Render target width
   * @param height - Render target height
   * @param config - DOF configuration
   */
  constructor(
    gl: WebGL2RenderingContext,
    width: number,
    height: number,
    config: DepthOfFieldConfig = {}
  ) {
    super(gl);
    
    this.width = width;
    this.height = height;
    this._focusDistance = config.focusDistance !== undefined ? config.focusDistance : 10.0;
    this._focusRange = config.focusRange !== undefined ? config.focusRange : 5.0;
    this._bokehSize = config.bokehSize !== undefined ? config.bokehSize : 1.0;
    this._maxBlur = config.maxBlur !== undefined ? config.maxBlur : 20.0;
    
    this.initializeShaders();
    this.initializeBuffers();
  }

  /**
   * Initializes DOF shaders
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
    
    // Circle of Confusion calculation
    const cocFragmentShader = `#version 300 es
      precision highp float;
      
      in vec2 v_texcoord;
      out vec4 fragColor;
      
      uniform sampler2D u_depthTexture;
      uniform float u_focusDistance;
      uniform float u_focusRange;
      uniform float u_maxBlur;
      
      void main() {
        float depth = texture(u_depthTexture, v_texcoord).r;
        
        // Calculate circle of confusion
        float focusStart = u_focusDistance - u_focusRange * 0.5;
        float focusEnd = u_focusDistance + u_focusRange * 0.5;
        
        float coc;
        if (depth < focusStart) {
          // Near blur
          coc = (focusStart - depth) / focusStart;
        } else if (depth > focusEnd) {
          // Far blur
          coc = (depth - focusEnd) / (100.0 - focusEnd);
        } else {
          // In focus
          coc = 0.0;
        }
        
        coc = clamp(coc, 0.0, 1.0) * u_maxBlur;
        fragColor = vec4(vec3(coc), 1.0);
      }
    `;
    
    // Bokeh blur shader
    const bokehFragmentShader = `#version 300 es
      precision highp float;
      
      in vec2 v_texcoord;
      out vec4 fragColor;
      
      uniform sampler2D u_colorTexture;
      uniform sampler2D u_cocTexture;
      uniform vec2 u_direction;
      uniform float u_bokehSize;
      
      void main() {
        vec2 texelSize = 1.0 / vec2(textureSize(u_colorTexture, 0));
        float coc = texture(u_cocTexture, v_texcoord).r;
        
        if (coc < 0.1) {
          // Sharp, no blur needed
          fragColor = texture(u_colorTexture, v_texcoord);
          return;
        }
        
        // Sample with bokeh kernel
        vec4 color = vec4(0.0);
        float totalWeight = 0.0;
        
        int samples = int(coc * u_bokehSize);
        samples = max(1, min(samples, 20));
        
        for (int i = -samples; i <= samples; i++) {
          vec2 offset = u_direction * texelSize * float(i) * coc * u_bokehSize;
          vec4 sample = texture(u_colorTexture, v_texcoord + offset);
          float weight = 1.0 - abs(float(i)) / float(samples);
          
          color += sample * weight;
          totalWeight += weight;
        }
        
        fragColor = color / totalWeight;
      }
    `;
    
    this.dofShader = new Shader(this.gl, vertexShader, cocFragmentShader);
    this.blurShader = new Shader(this.gl, vertexShader, bokehFragmentShader);
  }

  /**
   * Initializes DOF buffers
   */
  private initializeBuffers(): void {
    this.cocBuffer = new Framebuffer(this.gl, {
      width: this.width,
      height: this.height,
      colorAttachments: 1,
      depthAttachment: false
    });
    
    this.blurBuffer = new Framebuffer(this.gl, {
      width: this.width,
      height: this.height,
      colorAttachments: 1,
      depthAttachment: false
    });
  }

  /**
   * Renders the DOF effect
   * @param _input - Input texture (unused for now)
   * @param output - Output framebuffer
   */
  render(_input: Texture, output: Framebuffer | null): void {
    if (!this.dofShader || !this.blurShader || !this.cocBuffer || !this.blurBuffer) {
      return;
    }
    
    // For now, just pass through (full implementation requires depth buffer)
    if (output) {
      output.bind();
    } else {
      this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
    }
    
    this.gl.viewport(0, 0, this.width, this.height);
    
    // TODO: Full DOF implementation:
    // 1. Calculate Circle of Confusion from depth buffer
    // 2. Horizontal bokeh blur pass
    // 3. Vertical bokeh blur pass
    // 4. Composite with original based on CoC
  }

  /**
   * Sets the focus distance
   * @param distance - Focus distance
   */
  setFocusDistance(distance: number): void {
    this._focusDistance = Math.max(0, distance);
  }

  /**
   * Gets the focus distance
   */
  getFocusDistance(): number {
    return this._focusDistance;
  }

  /**
   * Sets the focus range
   * @param range - Focus range
   */
  setFocusRange(range: number): void {
    this._focusRange = Math.max(0, range);
  }

  /**
   * Gets the focus range
   */
  getFocusRange(): number {
    return this._focusRange;
  }

  /**
   * Sets the bokeh size
   * @param size - Bokeh size
   */
  setBokehSize(size: number): void {
    this._bokehSize = Math.max(0, size);
  }

  /**
   * Gets the bokeh size
   */
  getBokehSize(): number {
    return this._bokehSize;
  }

  /**
   * Sets the maximum blur amount
   * @param blur - Maximum blur
   */
  setMaxBlur(blur: number): void {
    this._maxBlur = Math.max(0, blur);
  }

  /**
   * Gets the maximum blur amount
   */
  getMaxBlur(): number {
    return this._maxBlur;
  }

  /**
   * Disposes DOF resources
   */
  dispose(): void {
    super.dispose();
    
    if (this.cocBuffer) {
      this.cocBuffer.unbind();
    }
    
    if (this.blurBuffer) {
      this.blurBuffer.unbind();
    }
  }
}
