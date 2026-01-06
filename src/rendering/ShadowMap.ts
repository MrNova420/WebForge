/**
 * @module rendering
 * @fileoverview Shadow mapping system for realistic shadow rendering
 */

import { WebGLContext } from './WebGLContext';
import { Framebuffer } from './Framebuffer';
import { Texture, TextureFormat, TextureFilter, TextureWrap } from './Texture';
import { Light, DirectionalLight } from './Light';
import { Matrix4 } from '../math/Matrix4';
import { Logger } from '../core/Logger';

/**
 * Shadow map configuration
 */
export interface ShadowMapConfig {
  /** Shadow map resolution (width and height) */
  resolution?: number;
  /** Enable PCF (Percentage Closer Filtering) */
  enablePCF?: boolean;
  /** PCF sample count (must be odd number, e.g., 3, 5, 7) */
  pcfSamples?: number;
  /** Enable VSM (Variance Shadow Maps) */
  enableVSM?: boolean;
  /** Shadow bias to prevent acne */
  bias?: number;
  /** Normal offset bias */
  normalBias?: number;
}

/**
 * Shadow map data for a single light
 */
export interface ShadowMap {
  /** Shadow framebuffer */
  framebuffer: Framebuffer;
  /** Shadow depth texture */
  depthTexture: Texture;
  /** Light view matrix */
  viewMatrix: Matrix4;
  /** Light projection matrix */
  projectionMatrix: Matrix4;
  /** Combined view-projection matrix */
  viewProjectionMatrix: Matrix4;
  /** Light index */
  lightIndex: number;
}

/**
 * Shadow map manager for creating and managing shadow maps
 */
export class ShadowMapManager {
  private context: WebGLContext;
  private logger: Logger;
  private gl: WebGL2RenderingContext;
  
  private shadowMaps: Map<Light, ShadowMap> = new Map();
  private resolution: number;
  private enablePCF: boolean;
  private pcfSamples: number;
  private enableVSM: boolean;
  private bias: number;
  private normalBias: number;

  /**
   * Creates a new shadow map manager
   * @param context - WebGL context
   * @param config - Shadow map configuration
   */
  constructor(context: WebGLContext, config: ShadowMapConfig = {}) {
    this.context = context;
    this.gl = context.gl as WebGL2RenderingContext;
    this.logger = new Logger('ShadowMap');
    
    this.resolution = config.resolution || 1024;
    this.enablePCF = config.enablePCF !== undefined ? config.enablePCF : true;
    this.pcfSamples = config.pcfSamples || 3;
    this.enableVSM = config.enableVSM || false;
    this.bias = config.bias !== undefined ? config.bias : 0.005;
    this.normalBias = config.normalBias !== undefined ? config.normalBias : 0.01;
  }

  /**
   * Creates or updates a shadow map for a light
   * @param light - Light to create shadow map for
   * @param lightIndex - Index of the light in the scene
   * @returns Shadow map data
   */
  createShadowMap(light: Light, lightIndex: number): ShadowMap {
    // Check if shadow map already exists
    let shadowMap = this.shadowMaps.get(light);
    
    if (!shadowMap) {
      // Create new shadow map
      const depthTexture = new Texture(
        this.gl,
        {
          format: TextureFormat.DEPTH,
          minFilter: TextureFilter.NEAREST,
          magFilter: TextureFilter.NEAREST,
          wrapS: TextureWrap.CLAMP_TO_EDGE,
          wrapT: TextureWrap.CLAMP_TO_EDGE
        }
      );
      
      // Allocate depth texture storage
      this.gl.bindTexture(this.gl.TEXTURE_2D, (depthTexture as any).texture);
      this.gl.texImage2D(
        this.gl.TEXTURE_2D,
        0,
        this.gl.DEPTH_COMPONENT24,
        this.resolution,
        this.resolution,
        0,
        this.gl.DEPTH_COMPONENT,
        this.gl.UNSIGNED_INT,
        null
      );
      
      const framebuffer = new Framebuffer(this.context.gl as WebGL2RenderingContext, {
        width: this.resolution,
        height: this.resolution
      });
      
      shadowMap = {
        framebuffer,
        depthTexture,
        viewMatrix: new Matrix4(),
        projectionMatrix: new Matrix4(),
        viewProjectionMatrix: new Matrix4(),
        lightIndex
      };
      
      this.shadowMaps.set(light, shadowMap);
      
      this.logger.info(`Created shadow map for light ${lightIndex} (${this.resolution}x${this.resolution})`);
    }
    
    // Update matrices
    this.updateShadowMapMatrices(light, shadowMap);
    
    return shadowMap;
  }

  /**
   * Updates shadow map matrices for a light
   * @param light - Light to update
   * @param shadowMap - Shadow map data
   */
  private updateShadowMapMatrices(light: Light, shadowMap: ShadowMap): void {
    // Get view and projection matrices from light
    shadowMap.viewMatrix = light.getViewMatrix();
    shadowMap.projectionMatrix = light.getProjectionMatrix();
    
    // Compute combined view-projection matrix
    shadowMap.viewProjectionMatrix = shadowMap.projectionMatrix.clone().multiply(shadowMap.viewMatrix);
  }

  /**
   * Gets the shadow map for a light
   * @param light - Light to get shadow map for
   * @returns Shadow map data or undefined
   */
  getShadowMap(light: Light): ShadowMap | undefined {
    return this.shadowMaps.get(light);
  }

  /**
   * Checks if a light has a shadow map
   * @param light - Light to check
   * @returns True if shadow map exists
   */
  hasShadowMap(light: Light): boolean {
    return this.shadowMaps.has(light);
  }

  /**
   * Removes the shadow map for a light
   * @param light - Light to remove shadow map for
   */
  removeShadowMap(light: Light): void {
    const shadowMap = this.shadowMaps.get(light);
    if (shadowMap) {
      shadowMap.framebuffer.unbind();
      this.shadowMaps.delete(light);
      this.logger.info(`Removed shadow map for light ${shadowMap.lightIndex}`);
    }
  }

  /**
   * Clears all shadow maps
   */
  clear(): void {
    for (const shadowMap of this.shadowMaps.values()) {
      shadowMap.framebuffer.unbind();
    }
    this.shadowMaps.clear();
    this.logger.info('Cleared all shadow maps');
  }

  /**
   * Begins shadow map rendering for a light
   * @param light - Light to render shadow map for
   * @returns Shadow map data
   */
  beginShadowPass(light: Light): ShadowMap | undefined {
    const shadowMap = this.shadowMaps.get(light);
    if (!shadowMap) {
      return undefined;
    }
    
    // Bind shadow map framebuffer
    shadowMap.framebuffer.bind();
    
    // Set viewport to shadow map resolution
    this.gl.viewport(0, 0, this.resolution, this.resolution);
    
    // Clear depth buffer
    this.gl.clear(this.gl.DEPTH_BUFFER_BIT);
    
    // Enable depth testing
    this.gl.enable(this.gl.DEPTH_TEST);
    this.gl.depthFunc(this.gl.LEQUAL);
    
    // Disable color writes (we only need depth)
    this.gl.colorMask(false, false, false, false);
    
    // Enable front face culling to reduce shadow acne
    this.gl.enable(this.gl.CULL_FACE);
    this.gl.cullFace(this.gl.FRONT);
    
    return shadowMap;
  }

  /**
   * Ends shadow map rendering
   */
  endShadowPass(): void {
    // Unbind framebuffer
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
    
    // Re-enable color writes
    this.gl.colorMask(true, true, true, true);
    
    // Reset culling to back face
    this.gl.cullFace(this.gl.BACK);
  }

  /**
   * Gets all active shadow maps
   * @returns Array of shadow maps
   */
  getAllShadowMaps(): ShadowMap[] {
    return Array.from(this.shadowMaps.values());
  }

  /**
   * Gets the shadow bias value
   * @returns Bias value
   */
  getBias(): number {
    return this.bias;
  }

  /**
   * Sets the shadow bias value
   * @param bias - New bias value
   */
  setBias(bias: number): void {
    this.bias = bias;
  }

  /**
   * Gets the normal bias value
   * @returns Normal bias value
   */
  getNormalBias(): number {
    return this.normalBias;
  }

  /**
   * Sets the normal bias value
   * @param bias - New normal bias value
   */
  setNormalBias(bias: number): void {
    this.normalBias = bias;
  }

  /**
   * Gets whether PCF is enabled
   * @returns True if PCF is enabled
   */
  isPCFEnabled(): boolean {
    return this.enablePCF;
  }

  /**
   * Sets whether PCF is enabled
   * @param enabled - Enable PCF
   */
  setPCFEnabled(enabled: boolean): void {
    this.enablePCF = enabled;
  }

  /**
   * Gets the PCF sample count
   * @returns Sample count
   */
  getPCFSamples(): number {
    return this.pcfSamples;
  }

  /**
   * Sets the PCF sample count
   * @param samples - Sample count (must be odd)
   */
  setPCFSamples(samples: number): void {
    this.pcfSamples = samples;
  }

  /**
   * Gets whether VSM is enabled
   * @returns True if VSM is enabled
   */
  isVSMEnabled(): boolean {
    return this.enableVSM;
  }

  /**
   * Gets the shadow map resolution
   * @returns Resolution
   */
  getResolution(): number {
    return this.resolution;
  }

  /**
   * Disposes all shadow maps
   */
  dispose(): void {
    this.clear();
  }
}

/**
 * Cascaded shadow map configuration for directional lights
 */
export interface CascadedShadowMapConfig extends ShadowMapConfig {
  /** Number of cascades */
  cascadeCount?: number;
  /** Cascade split lambda (0-1, affects distribution) */
  lambda?: number;
  /** Maximum shadow distance */
  maxDistance?: number;
}

/**
 * Cascaded shadow map for directional lights
 * Provides better shadow quality at varying distances
 */
export class CascadedShadowMap {
  private cascades: ShadowMap[] = [];
  private cascadeCount: number;
  private lambda: number;
  private maxDistance: number;
  private splitDistances: number[] = [];

  /**
   * Creates a new cascaded shadow map
   * @param manager - Shadow map manager
   * @param light - Directional light
   * @param config - CSM configuration
   */
  constructor(
    _manager: ShadowMapManager,
    _light: DirectionalLight,
    config: CascadedShadowMapConfig = {}
  ) {
    this.cascadeCount = config.cascadeCount || 4;
    this.lambda = config.lambda !== undefined ? config.lambda : 0.5;
    this.maxDistance = config.maxDistance || 100;
    
    this.initializeCascades();
  }

  /**
   * Initializes cascade splits
   */
  private initializeCascades(): void {
    // Calculate cascade split distances using practical split scheme
    this.splitDistances = [];
    const nearClip = 0.1;
    const farClip = this.maxDistance;
    
    for (let i = 0; i < this.cascadeCount; i++) {
      const p = (i + 1) / this.cascadeCount;
      const log = nearClip * Math.pow(farClip / nearClip, p);
      const uniform = nearClip + (farClip - nearClip) * p;
      const d = this.lambda * log + (1 - this.lambda) * uniform;
      this.splitDistances.push(d);
    }
  }

  /**
   * Gets the cascade split distances
   * @returns Array of split distances
   */
  getSplitDistances(): number[] {
    return [...this.splitDistances];
  }

  /**
   * Gets the number of cascades
   * @returns Cascade count
   */
  getCascadeCount(): number {
    return this.cascadeCount;
  }

  /**
   * Gets a specific cascade shadow map
   * @param index - Cascade index
   * @returns Shadow map or undefined
   */
  getCascade(index: number): ShadowMap | undefined {
    return this.cascades[index];
  }

  /**
   * Gets all cascade shadow maps
   * @returns Array of shadow maps
   */
  getAllCascades(): ShadowMap[] {
    return [...this.cascades];
  }
}
