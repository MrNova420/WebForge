/**
 * @module rendering
 * @fileoverview SSAO (Screen Space Ambient Occlusion) post-processing effect
 */

import { BasePostEffect } from '../PostProcessing';
import { Framebuffer } from '../Framebuffer';
import { Texture } from '../Texture';
import { Shader } from '../Shader';
import { Vector3 } from '../../math/Vector3';

/**
 * SSAO effect configuration
 */
export interface SSAOConfig {
  /** Number of samples for SSAO */
  samples?: number;
  /** Sampling radius */
  radius?: number;
  /** Occlusion bias */
  bias?: number;
  /** Occlusion intensity */
  intensity?: number;
}

/**
 * SSAO (Screen Space Ambient Occlusion) effect
 * Provides contact shadows for better depth perception
 */
export class SSAOEffect extends BasePostEffect {
  name = 'SSAO';
  
  private _samples: number;
  private _radius: number;
  private _bias: number;
  private _intensity: number;
  
  private ssaoShader: Shader | null = null;
  private blurShader: Shader | null = null;
  
  private ssaoBuffer: Framebuffer | null = null;
  private blurBuffer: Framebuffer | null = null;
  
  private sampleKernel: Vector3[] = [];
  private _noiseTexture: Texture | null = null;
  
  private width: number;
  private height: number;

  /**
   * Creates a new SSAO effect
   * @param gl - WebGL context
   * @param width - Render target width
   * @param height - Render target height
   * @param config - SSAO configuration
   */
  constructor(
    gl: WebGL2RenderingContext,
    width: number,
    height: number,
    config: SSAOConfig = {}
  ) {
    super(gl);
    
    this.width = width;
    this.height = height;
    this._samples = config.samples || 64;
    this._radius = config.radius !== undefined ? config.radius : 0.5;
    this._bias = config.bias !== undefined ? config.bias : 0.025;
    this._intensity = config.intensity !== undefined ? config.intensity : 1.0;
    
    this.generateSampleKernel();
    this.generateNoiseTexture();
    this.initializeShaders();
    this.initializeBuffers();
  }

  /**
   * Generates sample kernel for SSAO
   */
  private generateSampleKernel(): void {
    for (let i = 0; i < this._samples; i++) {
      const sample = new Vector3(
        Math.random() * 2.0 - 1.0,
        Math.random() * 2.0 - 1.0,
        Math.random()
      );
      sample.normalize();
      
      // Scale samples
      let scale = i / this._samples;
      scale = 0.1 + scale * scale * 0.9; // Lerp between 0.1 and 1.0
      sample.multiplyScalar(scale);
      
      this.sampleKernel.push(sample);
    }
  }

  /**
   * Generates noise texture for SSAO
   */
  private generateNoiseTexture(): void {
    const noiseSize = 4;
    const noiseData = new Float32Array(noiseSize * noiseSize * 3);
    
    for (let i = 0; i < noiseSize * noiseSize; i++) {
      noiseData[i * 3 + 0] = Math.random() * 2.0 - 1.0;
      noiseData[i * 3 + 1] = Math.random() * 2.0 - 1.0;
      noiseData[i * 3 + 2] = 0.0;
    }
    
    // Create noise texture (simplified - would need proper implementation)
    this._noiseTexture = new Texture(this.gl, {});
  }

  /**
   * Gets the noise texture
   */
  getNoiseTexture(): Texture | null {
    return this._noiseTexture;
  }

  /**
   * Initializes SSAO shaders
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
    
    const ssaoFragmentShader = `#version 300 es
      precision highp float;
      
      in vec2 v_texcoord;
      out vec4 fragColor;
      
      uniform sampler2D u_positionTexture;
      uniform sampler2D u_normalTexture;
      uniform sampler2D u_noiseTexture;
      uniform vec3 u_samples[64];
      uniform mat4 u_projection;
      uniform float u_radius;
      uniform float u_bias;
      uniform int u_sampleCount;
      
      void main() {
        // Get position and normal from G-buffer
        vec3 fragPos = texture(u_positionTexture, v_texcoord).xyz;
        vec3 normal = normalize(texture(u_normalTexture, v_texcoord).rgb);
        
        // Get noise vector
        vec2 noiseScale = vec2(float(textureSize(u_positionTexture, 0).x) / 4.0,
                               float(textureSize(u_positionTexture, 0).y) / 4.0);
        vec3 randomVec = normalize(texture(u_noiseTexture, v_texcoord * noiseScale).xyz);
        
        // Create TBN matrix
        vec3 tangent = normalize(randomVec - normal * dot(randomVec, normal));
        vec3 bitangent = cross(normal, tangent);
        mat3 TBN = mat3(tangent, bitangent, normal);
        
        // Calculate occlusion
        float occlusion = 0.0;
        for (int i = 0; i < u_sampleCount; i++) {
          vec3 samplePos = TBN * u_samples[i];
          samplePos = fragPos + samplePos * u_radius;
          
          // Project sample position
          vec4 offset = vec4(samplePos, 1.0);
          offset = u_projection * offset;
          offset.xyz /= offset.w;
          offset.xyz = offset.xyz * 0.5 + 0.5;
          
          // Get sample depth
          float sampleDepth = texture(u_positionTexture, offset.xy).z;
          
          // Range check
          float rangeCheck = smoothstep(0.0, 1.0, u_radius / abs(fragPos.z - sampleDepth));
          occlusion += (sampleDepth >= samplePos.z + u_bias ? 1.0 : 0.0) * rangeCheck;
        }
        
        occlusion = 1.0 - (occlusion / float(u_sampleCount));
        fragColor = vec4(vec3(occlusion), 1.0);
      }
    `;
    
    const blurFragmentShader = `#version 300 es
      precision highp float;
      
      in vec2 v_texcoord;
      out vec4 fragColor;
      
      uniform sampler2D u_texture;
      
      void main() {
        vec2 texelSize = 1.0 / vec2(textureSize(u_texture, 0));
        float result = 0.0;
        
        // Simple box blur
        for (int x = -2; x <= 2; x++) {
          for (int y = -2; y <= 2; y++) {
            vec2 offset = vec2(float(x), float(y)) * texelSize;
            result += texture(u_texture, v_texcoord + offset).r;
          }
        }
        
        result /= 25.0;
        fragColor = vec4(vec3(result), 1.0);
      }
    `;
    
    this.ssaoShader = new Shader(this.gl, vertexShader, ssaoFragmentShader);
    this.blurShader = new Shader(this.gl, vertexShader, blurFragmentShader);
  }

  /**
   * Initializes SSAO buffers
   */
  private initializeBuffers(): void {
    this.ssaoBuffer = new Framebuffer(this.gl, {
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
   * Renders the SSAO effect
   * @param _input - Input texture (should be G-buffer) - unused for now
   * @param output - Output framebuffer
   */
  render(_input: Texture, output: Framebuffer | null): void {
    if (!this.ssaoShader || !this.blurShader || !this.ssaoBuffer || !this.blurBuffer) {
      return;
    }
    
    // For now, just pass through
    if (output) {
      output.bind();
    } else {
      this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
    }
    
    this.gl.viewport(0, 0, this.width, this.height);
    
    // TODO: Full SSAO implementation would require:
    // 1. Generate SSAO texture from G-buffer
    // 2. Blur SSAO texture
    // 3. Apply to final scene
  }

  /**
   * Sets the sample count
   * @param samples - Number of samples
   */
  setSamples(samples: number): void {
    this._samples = Math.max(1, Math.min(64, samples));
    this.generateSampleKernel();
  }

  /**
   * Gets the sample count
   */
  getSamples(): number {
    return this._samples;
  }

  /**
   * Sets the radius
   * @param radius - Sampling radius
   */
  setRadius(radius: number): void {
    this._radius = Math.max(0, radius);
  }

  /**
   * Gets the radius
   */
  getRadius(): number {
    return this._radius;
  }

  /**
   * Sets the bias
   * @param bias - Occlusion bias
   */
  setBias(bias: number): void {
    this._bias = Math.max(0, bias);
  }

  /**
   * Gets the bias
   */
  getBias(): number {
    return this._bias;
  }

  /**
   * Sets the intensity
   * @param intensity - Occlusion intensity
   */
  setIntensity(intensity: number): void {
    this._intensity = Math.max(0, intensity);
  }

  /**
   * Gets the intensity
   */
  getIntensity(): number {
    return this._intensity;
  }

  /**
   * Disposes SSAO resources
   */
  dispose(): void {
    super.dispose();
    
    if (this.ssaoBuffer) {
      this.ssaoBuffer.unbind();
    }
    
    if (this.blurBuffer) {
      this.blurBuffer.unbind();
    }
  }
}
