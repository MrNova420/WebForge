/**
 * @module rendering
 * @fileoverview Post-processing effects system
 */

import { WebGLContext } from './WebGLContext';
import { Framebuffer } from './Framebuffer';
import { Texture } from './Texture';
import { Shader } from './Shader';
import { Logger } from '../core/Logger';

/**
 * Post-processing effect interface
 */
export interface PostEffect {
  /** Effect name */
  name: string;
  /** Whether effect is enabled */
  enabled: boolean;
  /** Render the effect */
  render(input: Texture, output: Framebuffer | null): void;
  /** Dispose effect resources */
  dispose(): void;
}

/**
 * Post-processing pipeline configuration
 */
export interface PostProcessingConfig {
  /** Enable post-processing */
  enabled?: boolean;
  /** Enable bloom effect */
  bloom?: boolean;
  /** Enable tone mapping */
  toneMapping?: boolean;
  /** Enable SSAO */
  ssao?: boolean;
  /** Enable motion blur */
  motionBlur?: boolean;
  /** Enable depth of field */
  depthOfField?: boolean;
}

/**
 * Post-processing pipeline manager
 * Manages a stack of post-processing effects
 */
export class PostProcessing {
  private gl: WebGL2RenderingContext;
  private logger: Logger;
  
  private effects: PostEffect[] = [];
  private enabled: boolean;
  
  // Ping-pong buffers for multi-pass effects
  private bufferA: Framebuffer;
  private bufferB: Framebuffer;
  
  private width: number;
  private height: number;

  /**
   * Creates a new post-processing pipeline
   * @param context - WebGL context
   * @param width - Render target width
   * @param height - Render target height
   * @param config - Post-processing configuration
   */
  constructor(
    context: WebGLContext,
    width: number,
    height: number,
    config: PostProcessingConfig = {}
  ) {
    this.gl = context.gl as WebGL2RenderingContext;
    this.logger = new Logger('PostProcessing');
    
    this.width = width;
    this.height = height;
    this.enabled = config.enabled !== undefined ? config.enabled : true;
    
    // Create ping-pong buffers
    this.bufferA = new Framebuffer(this.gl, {
      width: this.width,
      height: this.height,
      colorAttachments: 1,
      depthAttachment: false
    });
    
    this.bufferB = new Framebuffer(this.gl, {
      width: this.width,
      height: this.height,
      colorAttachments: 1,
      depthAttachment: false
    });
    
    this.logger.info(`Post-processing pipeline created (${width}x${height})`);
  }

  /**
   * Adds a post-processing effect to the pipeline
   * @param effect - Effect to add
   */
  addEffect(effect: PostEffect): void {
    this.effects.push(effect);
    this.logger.info(`Added effect: ${effect.name}`);
  }

  /**
   * Removes a post-processing effect from the pipeline
   * @param effect - Effect to remove
   */
  removeEffect(effect: PostEffect): void {
    const index = this.effects.indexOf(effect);
    if (index !== -1) {
      this.effects.splice(index, 1);
      this.logger.info(`Removed effect: ${effect.name}`);
    }
  }

  /**
   * Removes a post-processing effect by name
   * @param name - Name of effect to remove
   */
  removeEffectByName(name: string): void {
    const effect = this.effects.find(e => e.name === name);
    if (effect) {
      this.removeEffect(effect);
    }
  }

  /**
   * Gets an effect by name
   * @param name - Effect name
   * @returns Effect or undefined
   */
  getEffect(name: string): PostEffect | undefined {
    return this.effects.find(e => e.name === name);
  }

  /**
   * Clears all effects
   */
  clearEffects(): void {
    this.effects.forEach(effect => effect.dispose());
    this.effects = [];
    this.logger.info('Cleared all effects');
  }

  /**
   * Processes the input texture through all effects
   * @param input - Input texture
   * @param output - Output framebuffer (null for screen)
   */
  process(input: Texture, output: Framebuffer | null = null): void {
    if (!this.enabled || this.effects.length === 0) {
      // No effects, just copy input to output
      this.copyTexture(input, output);
      return;
    }
    
    // Filter enabled effects
    const enabledEffects = this.effects.filter(e => e.enabled);
    if (enabledEffects.length === 0) {
      this.copyTexture(input, output);
      return;
    }
    
    // Process effects
    let currentInput = input;
    let useBufferA = true;
    
    for (let i = 0; i < enabledEffects.length; i++) {
      const effect = enabledEffects[i];
      const isLastEffect = i === enabledEffects.length - 1;
      
      // Determine output target
      const currentOutput = isLastEffect ? output : (useBufferA ? this.bufferA : this.bufferB);
      
      // Render effect
      effect.render(currentInput, currentOutput);
      
      // Swap buffers for next iteration
      if (!isLastEffect) {
        currentInput = useBufferA ? this.bufferA.getColorTexture()! : this.bufferB.getColorTexture()!;
        useBufferA = !useBufferA;
      }
    }
  }

  /**
   * Copies texture to output
   * @param _input - Input texture (unused for now)
   * @param output - Output framebuffer (null for screen)
   */
  private copyTexture(_input: Texture, output: Framebuffer | null): void {
    // Bind output
    if (output) {
      output.bind();
    } else {
      this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
    }
    
    // Set viewport
    this.gl.viewport(0, 0, this.width, this.height);
    
    // TODO: Implement simple copy shader
    // For now, just clear
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);
  }

  /**
   * Resizes the post-processing buffers
   * @param width - New width
   * @param height - New height
   */
  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    
    // Recreate buffers
    this.bufferA = new Framebuffer(this.gl, {
      width: this.width,
      height: this.height,
      colorAttachments: 1,
      depthAttachment: false
    });
    
    this.bufferB = new Framebuffer(this.gl, {
      width: this.width,
      height: this.height,
      colorAttachments: 1,
      depthAttachment: false
    });
    
    this.logger.info(`Resized to ${width}x${height}`);
  }

  /**
   * Enables post-processing
   */
  enable(): void {
    this.enabled = true;
  }

  /**
   * Disables post-processing
   */
  disable(): void {
    this.enabled = false;
  }

  /**
   * Checks if post-processing is enabled
   * @returns True if enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Gets all effects
   * @returns Array of effects
   */
  getEffects(): PostEffect[] {
    return [...this.effects];
  }

  /**
   * Disposes all resources
   */
  dispose(): void {
    this.effects.forEach(effect => effect.dispose());
    this.effects = [];
    
    this.bufferA.unbind();
    this.bufferB.unbind();
  }
}

/**
 * Base post-processing effect class
 */
export abstract class BasePostEffect implements PostEffect {
  abstract name: string;
  enabled: boolean = true;
  
  protected gl: WebGL2RenderingContext;
  protected shader: Shader | null = null;
  protected logger: Logger;
  
  // Full-screen quad for rendering
  protected quadVAO: WebGLVertexArrayObject | null = null;
  protected quadVBO: WebGLBuffer | null = null;

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    this.logger = new Logger('PostEffect');
    this.createQuad();
  }

  /**
   * Creates a full-screen quad for rendering
   */
  private createQuad(): void {
    // Quad vertices (position + texcoord)
    const vertices = new Float32Array([
      -1, -1, 0, 0,  // Bottom-left
       1, -1, 1, 0,  // Bottom-right
      -1,  1, 0, 1,  // Top-left
       1,  1, 1, 1   // Top-right
    ]);
    
    // Create VAO
    this.quadVAO = this.gl.createVertexArray();
    this.gl.bindVertexArray(this.quadVAO);
    
    // Create VBO
    this.quadVBO = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.quadVBO);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, vertices, this.gl.STATIC_DRAW);
    
    // Position attribute
    this.gl.enableVertexAttribArray(0);
    this.gl.vertexAttribPointer(0, 2, this.gl.FLOAT, false, 16, 0);
    
    // Texcoord attribute
    this.gl.enableVertexAttribArray(1);
    this.gl.vertexAttribPointer(1, 2, this.gl.FLOAT, false, 16, 8);
    
    this.gl.bindVertexArray(null);
  }

  /**
   * Renders the full-screen quad
   */
  protected renderQuad(): void {
    this.gl.bindVertexArray(this.quadVAO);
    this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
    this.gl.bindVertexArray(null);
  }

  abstract render(input: Texture, output: Framebuffer | null): void;

  /**
   * Disposes effect resources
   */
  dispose(): void {
    if (this.quadVAO) {
      this.gl.deleteVertexArray(this.quadVAO);
      this.quadVAO = null;
    }
    if (this.quadVBO) {
      this.gl.deleteBuffer(this.quadVBO);
      this.quadVBO = null;
    }
  }
}
