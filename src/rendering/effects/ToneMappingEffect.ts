/**
 * @module rendering
 * @fileoverview Tone mapping post-processing effect
 */

import { BasePostEffect } from '../PostProcessing';
import { WebGLContext } from '../WebGLContext';
import { Framebuffer } from '../Framebuffer';
import { Texture } from '../Texture';
import { Shader } from '../Shader';

/**
 * Tone mapping operator type
 */
export enum ToneMappingOperator {
  LINEAR = 'linear',
  REINHARD = 'reinhard',
  ACES = 'aces',
  UNCHARTED2 = 'uncharted2',
  FILMIC = 'filmic'
}

/**
 * Tone mapping effect configuration
 */
export interface ToneMappingConfig {
  /** Tone mapping operator */
  operator?: ToneMappingOperator;
  /** Exposure adjustment */
  exposure?: number;
  /** White point for Reinhard tone mapping */
  whitePoint?: number;
}

/**
 * Tone mapping post-processing effect
 * Maps HDR colors to LDR display range
 */
export class ToneMappingEffect extends BasePostEffect {
  name = 'ToneMapping';
  
  private _operator: ToneMappingOperator;
  private _exposure: number;
  private _whitePoint: number;
  
  private toneMappingShader: Shader | null = null;
  private width: number;
  private height: number;

  /**
   * Creates a new tone mapping effect
   * @param context - WebGL context wrapper
   * @param width - Render target width
   * @param height - Render target height
   * @param config - Tone mapping configuration
   */
  constructor(
    context: WebGLContext,
    width: number,
    height: number,
    config: ToneMappingConfig = {}
  ) {
    super(context);
    
    this.width = width;
    this.height = height;
    this._operator = config.operator || ToneMappingOperator.ACES;
    this._exposure = config.exposure !== undefined ? config.exposure : 1.0;
    this._whitePoint = config.whitePoint !== undefined ? config.whitePoint : 11.2;
    
    this.initializeShaders();
  }

  /**
   * Initializes tone mapping shaders
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
      
      uniform sampler2D u_texture;
      uniform int u_operator;
      uniform float u_exposure;
      uniform float u_whitePoint;
      
      // ACES tone mapping (Narkowicz 2015)
      vec3 ACESFilm(vec3 x) {
        float a = 2.51;
        float b = 0.03;
        float c = 2.43;
        float d = 0.59;
        float e = 0.14;
        return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
      }
      
      // Reinhard tone mapping
      vec3 Reinhard(vec3 x, float whitePoint) {
        return (x * (1.0 + x / (whitePoint * whitePoint))) / (1.0 + x);
      }
      
      // Uncharted 2 tone mapping
      vec3 Uncharted2Tonemap(vec3 x) {
        float A = 0.15;
        float B = 0.50;
        float C = 0.10;
        float D = 0.20;
        float E = 0.02;
        float F = 0.30;
        return ((x * (A * x + C * B) + D * E) / (x * (A * x + B) + D * F)) - E / F;
      }
      
      vec3 Uncharted2(vec3 color) {
        float exposureBias = 2.0;
        vec3 curr = Uncharted2Tonemap(color * exposureBias);
        vec3 W = vec3(11.2);
        vec3 whiteScale = vec3(1.0) / Uncharted2Tonemap(W);
        return curr * whiteScale;
      }
      
      // Filmic tone mapping
      vec3 Filmic(vec3 x) {
        vec3 X = max(vec3(0.0), x - 0.004);
        return (X * (6.2 * X + 0.5)) / (X * (6.2 * X + 1.7) + 0.06);
      }
      
      void main() {
        vec3 color = texture(u_texture, v_texcoord).rgb;
        
        // Apply exposure
        color *= u_exposure;
        
        // Apply tone mapping
        vec3 mapped;
        if (u_operator == 0) {
          // Linear (no tone mapping)
          mapped = color;
        } else if (u_operator == 1) {
          // Reinhard
          mapped = Reinhard(color, u_whitePoint);
        } else if (u_operator == 2) {
          // ACES
          mapped = ACESFilm(color);
        } else if (u_operator == 3) {
          // Uncharted 2
          mapped = Uncharted2(color);
        } else {
          // Filmic
          mapped = Filmic(color);
        }
        
        // Gamma correction
        mapped = pow(mapped, vec3(1.0 / 2.2));
        
        fragColor = vec4(mapped, 1.0);
      }
    `;
    
    this.toneMappingShader = new Shader(this.gl, vertexShader, fragmentShader);
  }

  /**
   * Renders the tone mapping effect
   * @param input - Input texture
   * @param output - Output framebuffer
   */
  render(input: Texture, output: Framebuffer | null): void {
    if (!this.toneMappingShader) {
      return;
    }
    
    // Bind output
    if (output) {
      output.bind();
    } else {
      this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
    }
    
    this.gl.viewport(0, 0, this.width, this.height);
    
    // Use shader
    this.toneMappingShader.use();
    this.toneMappingShader.setUniform('u_texture', 0);
    this.toneMappingShader.setUniform('u_operator', this.getOperatorIndex());
    this.toneMappingShader.setUniform('u_exposure', this._exposure);
    this.toneMappingShader.setUniform('u_whitePoint', this._whitePoint);
    
    // Bind input texture
    input.bind(0);
    
    // Render
    this.renderQuad();
  }

  /**
   * Gets the operator index for shader
   */
  private getOperatorIndex(): number {
    switch (this._operator) {
      case ToneMappingOperator.LINEAR: return 0;
      case ToneMappingOperator.REINHARD: return 1;
      case ToneMappingOperator.ACES: return 2;
      case ToneMappingOperator.UNCHARTED2: return 3;
      case ToneMappingOperator.FILMIC: return 4;
      default: return 2; // ACES by default
    }
  }

  /**
   * Sets the tone mapping operator
   * @param operator - Tone mapping operator
   */
  setOperator(operator: ToneMappingOperator): void {
    this._operator = operator;
  }

  /**
   * Gets the tone mapping operator
   */
  getOperator(): ToneMappingOperator {
    return this._operator;
  }

  /**
   * Sets the exposure value
   * @param exposure - Exposure value
   */
  setExposure(exposure: number): void {
    this._exposure = Math.max(0, exposure);
  }

  /**
   * Gets the exposure value
   */
  getExposure(): number {
    return this._exposure;
  }

  /**
   * Sets the white point for Reinhard
   * @param whitePoint - White point value
   */
  setWhitePoint(whitePoint: number): void {
    this._whitePoint = Math.max(0, whitePoint);
  }

  /**
   * Gets the white point
   */
  getWhitePoint(): number {
    return this._whitePoint;
  }
}
