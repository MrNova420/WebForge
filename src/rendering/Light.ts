/**
 * @module rendering
 * @fileoverview Light system for scene lighting
 */

import { Vector3 } from '../math/Vector3';
import { Matrix4 } from '../math/Matrix4';

/**
 * Light type enumeration
 */
export enum LightType {
  DIRECTIONAL = 'directional',
  POINT = 'point',
  SPOT = 'spot',
  AREA = 'area'
}

/**
 * Base light configuration
 */
export interface LightConfig {
  /** Light color */
  color?: Vector3;
  /** Light intensity */
  intensity?: number;
  /** Enable shadow casting */
  castShadow?: boolean;
  /** Shadow map resolution */
  shadowMapSize?: number;
  /** Shadow bias to prevent acne */
  shadowBias?: number;
}

/**
 * Base light class
 */
export abstract class Light {
  /** Light type */
  abstract readonly type: LightType;
  
  /** Light position in world space */
  position: Vector3 = new Vector3();
  
  /** Light color (RGB) */
  color: Vector3;
  
  /** Light intensity multiplier */
  intensity: number;
  
  /** Whether this light casts shadows */
  castShadow: boolean;
  
  /** Shadow map resolution (power of 2) */
  shadowMapSize: number;
  
  /** Shadow bias to prevent shadow acne */
  shadowBias: number;
  
  /** Whether this light is enabled */
  enabled: boolean = true;

  /**
   * Creates a new light
   * @param config - Light configuration
   */
  constructor(config: LightConfig = {}) {
    this.color = config.color || new Vector3(1, 1, 1);
    this.intensity = config.intensity !== undefined ? config.intensity : 1.0;
    this.castShadow = config.castShadow || false;
    this.shadowMapSize = config.shadowMapSize || 1024;
    this.shadowBias = config.shadowBias || 0.005;
  }

  /**
   * Gets the light's view matrix (for shadow mapping)
   * @returns View matrix
   */
  abstract getViewMatrix(): Matrix4;

  /**
   * Gets the light's projection matrix (for shadow mapping)
   * @returns Projection matrix
   */
  abstract getProjectionMatrix(): Matrix4;

  /**
   * Gets the effective light color (color * intensity)
   * @returns Effective color
   */
  getEffectiveColor(): Vector3 {
    return this.color.clone().multiplyScalar(this.intensity);
  }
}

/**
 * Directional light configuration
 */
export interface DirectionalLightConfig extends LightConfig {
  /** Light direction */
  direction?: Vector3;
  /** Shadow camera size */
  shadowCameraSize?: number;
  /** Near plane for shadow camera */
  shadowCameraNear?: number;
  /** Far plane for shadow camera */
  shadowCameraFar?: number;
}

/**
 * Directional light (sun-like, parallel rays)
 */
export class DirectionalLight extends Light {
  readonly type = LightType.DIRECTIONAL;
  
  /** Light direction (normalized) */
  direction: Vector3;
  
  /** Shadow camera orthographic size */
  shadowCameraSize: number;
  
  /** Shadow camera near plane */
  shadowCameraNear: number;
  
  /** Shadow camera far plane */
  shadowCameraFar: number;

  /**
   * Creates a new directional light
   * @param config - Light configuration
   */
  constructor(config: DirectionalLightConfig = {}) {
    super(config);
    this.direction = (config.direction || new Vector3(0, -1, 0)).normalize();
    this.shadowCameraSize = config.shadowCameraSize || 10;
    this.shadowCameraNear = config.shadowCameraNear || 0.5;
    this.shadowCameraFar = config.shadowCameraFar || 50;
  }

  /**
   * Sets the light direction
   * @param direction - New direction vector
   */
  setDirection(direction: Vector3): this {
    this.direction.copy(direction).normalize();
    return this;
  }

  /**
   * Gets the view matrix for shadow mapping
   * @returns View matrix
   */
  getViewMatrix(): Matrix4 {
    const target = new Vector3().copy(this.position).add(this.direction);
    return Matrix4.lookAt(this.position, target, new Vector3(0, 1, 0));
  }

  /**
   * Gets the projection matrix for shadow mapping
   * @returns Orthographic projection matrix
   */
  getProjectionMatrix(): Matrix4 {
    const size = this.shadowCameraSize;
    return Matrix4.orthographic(
      -size, size,
      -size, size,
      this.shadowCameraNear,
      this.shadowCameraFar
    );
  }
}

/**
 * Point light configuration
 */
export interface PointLightConfig extends LightConfig {
  /** Light range/radius */
  range?: number;
  /** Attenuation constant */
  constant?: number;
  /** Attenuation linear factor */
  linear?: number;
  /** Attenuation quadratic factor */
  quadratic?: number;
}

/**
 * Point light (omni-directional)
 */
export class PointLight extends Light {
  readonly type: LightType.POINT = LightType.POINT;
  
  /** Maximum light range */
  range: number;
  
  /** Constant attenuation factor */
  constant: number;
  
  /** Linear attenuation factor */
  linear: number;
  
  /** Quadratic attenuation factor */
  quadratic: number;

  /**
   * Creates a new point light
   * @param config - Light configuration
   */
  constructor(config: PointLightConfig = {}) {
    super(config);
    this.range = config.range || 10;
    this.constant = config.constant !== undefined ? config.constant : 1.0;
    this.linear = config.linear !== undefined ? config.linear : 0.09;
    this.quadratic = config.quadratic !== undefined ? config.quadratic : 0.032;
  }

  /**
   * Calculates attenuation at a given distance
   * @param distance - Distance from light
   * @returns Attenuation factor (0-1)
   */
  calculateAttenuation(distance: number): number {
    const attenuation = 1.0 / (
      this.constant +
      this.linear * distance +
      this.quadratic * distance * distance
    );
    return Math.max(0, Math.min(1, attenuation));
  }

  /**
   * Gets the view matrix for shadow mapping (one face of cubemap)
   * @param face - Cubemap face index (0-5)
   * @returns View matrix
   */
  getViewMatrix(face: number = 0): Matrix4 {
    const targets = [
      new Vector3(1, 0, 0),   // +X
      new Vector3(-1, 0, 0),  // -X
      new Vector3(0, 1, 0),   // +Y
      new Vector3(0, -1, 0),  // -Y
      new Vector3(0, 0, 1),   // +Z
      new Vector3(0, 0, -1)   // -Z
    ];
    
    const ups = [
      new Vector3(0, -1, 0),  // +X
      new Vector3(0, -1, 0),  // -X
      new Vector3(0, 0, 1),   // +Y
      new Vector3(0, 0, -1),  // -Y
      new Vector3(0, -1, 0),  // +Z
      new Vector3(0, -1, 0)   // -Z
    ];
    
    const target = new Vector3().copy(this.position).add(targets[face]);
    return Matrix4.lookAt(this.position, target, ups[face]);
  }

  /**
   * Gets the projection matrix for shadow mapping
   * @returns Perspective projection matrix
   */
  getProjectionMatrix(): Matrix4 {
    return Matrix4.perspective(
      Math.PI / 2,  // 90 degrees FOV for cubemap face
      1.0,          // Square aspect ratio
      0.1,          // Near plane
      this.range    // Far plane
    );
  }
}

/**
 * Spot light configuration
 */
export interface SpotLightConfig extends PointLightConfig {
  /** Light direction */
  direction?: Vector3;
  /** Inner cone angle (radians) */
  innerConeAngle?: number;
  /** Outer cone angle (radians) */
  outerConeAngle?: number;
}

/**
 * Spot light (cone-shaped)
 */
export class SpotLight extends Light {
  readonly type: LightType.SPOT = LightType.SPOT;
  
  /** Light direction (normalized) */
  direction: Vector3;
  
  /** Maximum light range */
  range: number;
  
  /** Constant attenuation factor */
  constant: number;
  
  /** Linear attenuation factor */
  linear: number;
  
  /** Quadratic attenuation factor */
  quadratic: number;
  
  /** Inner cone angle in radians */
  innerConeAngle: number;
  
  /** Outer cone angle in radians */
  outerConeAngle: number;

  /**
   * Creates a new spot light
   * @param config - Light configuration
   */
  constructor(config: SpotLightConfig = {}) {
    super(config);
    this.direction = (config.direction || new Vector3(0, -1, 0)).normalize();
    this.range = config.range || 10;
    this.constant = config.constant !== undefined ? config.constant : 1.0;
    this.linear = config.linear !== undefined ? config.linear : 0.09;
    this.quadratic = config.quadratic !== undefined ? config.quadratic : 0.032;
    this.innerConeAngle = config.innerConeAngle || Math.PI / 6;  // 30 degrees
    this.outerConeAngle = config.outerConeAngle || Math.PI / 4;  // 45 degrees
  }

  /**
   * Sets the light direction
   * @param direction - New direction vector
   */
  setDirection(direction: Vector3): this {
    this.direction.copy(direction).normalize();
    return this;
  }

  /**
   * Calculates spot light intensity based on angle
   * @param lightToFragment - Direction from light to fragment
   * @returns Intensity factor (0-1)
   */
  calculateSpotIntensity(lightToFragment: Vector3): number {
    const theta = Math.acos(this.direction.dot(lightToFragment.normalize()));
    const epsilon = this.innerConeAngle - this.outerConeAngle;
    const intensity = (theta - this.outerConeAngle) / epsilon;
    return Math.max(0, Math.min(1, intensity));
  }

  /**
   * Gets the view matrix for shadow mapping
   * @returns View matrix
   */
  getViewMatrix(): Matrix4 {
    const target = new Vector3().copy(this.position).add(this.direction);
    return Matrix4.lookAt(this.position, target, new Vector3(0, 1, 0));
  }

  /**
   * Gets the projection matrix for shadow mapping
   * @returns Perspective projection matrix
   */
  getProjectionMatrix(): Matrix4 {
    return Matrix4.perspective(
      this.outerConeAngle * 2,  // FOV based on outer cone
      1.0,                       // Square aspect ratio
      0.1,                       // Near plane
      this.range                 // Far plane
    );
  }

  /**
   * Gets the cosine of the inner cone angle
   */
  get innerConeCos(): number {
    return Math.cos(this.innerConeAngle);
  }

  /**
   * Gets the cosine of the outer cone angle
   */
  get outerConeCos(): number {
    return Math.cos(this.outerConeAngle);
  }
}

/**
 * Area light configuration
 */
export interface AreaLightConfig extends LightConfig {
  /** Width of the light */
  width?: number;
  /** Height of the light */
  height?: number;
  /** Light direction */
  direction?: Vector3;
}

/**
 * Area light (rectangular emissive surface)
 */
export class AreaLight extends Light {
  readonly type = LightType.AREA;
  
  /** Width of the rectangular light */
  width: number;
  
  /** Height of the rectangular light */
  height: number;
  
  /** Light direction (surface normal) */
  direction: Vector3;

  /**
   * Creates a new area light
   * @param config - Light configuration
   */
  constructor(config: AreaLightConfig = {}) {
    super(config);
    this.width = config.width || 1;
    this.height = config.height || 1;
    this.direction = (config.direction || new Vector3(0, -1, 0)).normalize();
  }

  /**
   * Sets the light direction
   * @param direction - New direction vector
   */
  setDirection(direction: Vector3): this {
    this.direction.copy(direction).normalize();
    return this;
  }

  /**
   * Gets the view matrix (not typically used for area lights)
   * @returns View matrix
   */
  getViewMatrix(): Matrix4 {
    const target = new Vector3().copy(this.position).add(this.direction);
    return Matrix4.lookAt(this.position, target, new Vector3(0, 1, 0));
  }

  /**
   * Gets the projection matrix (not typically used for area lights)
   * @returns Orthographic projection matrix
   */
  getProjectionMatrix(): Matrix4 {
    return Matrix4.orthographic(
      -this.width / 2, this.width / 2,
      -this.height / 2, this.height / 2,
      0.1, 10
    );
  }

  /**
   * Gets the area of the light
   */
  get area(): number {
    return this.width * this.height;
  }
}
