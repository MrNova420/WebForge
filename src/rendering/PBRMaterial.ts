/**
 * @module rendering
 * @fileoverview Physically Based Rendering (PBR) material system
 */

import { Vector3 } from '../math/Vector3';
import { Texture } from './Texture';

/**
 * PBR material parameters following metallic-roughness workflow
 */
export interface PBRMaterialParams {
  /** Base color (albedo) */
  albedo?: Vector3;
  /** Metallic factor (0 = dielectric, 1 = metallic) */
  metallic?: number;
  /** Roughness factor (0 = smooth, 1 = rough) */
  roughness?: number;
  /** Ambient occlusion factor */
  ao?: number;
  /** Emissive color */
  emissive?: Vector3;
  /** Emissive intensity */
  emissiveIntensity?: number;
  
  // Texture maps
  /** Albedo/base color texture */
  albedoMap?: Texture | null;
  /** Metallic texture (grayscale) */
  metallicMap?: Texture | null;
  /** Roughness texture (grayscale) */
  roughnessMap?: Texture | null;
  /** Combined metallic-roughness texture (B = metallic, G = roughness) */
  metallicRoughnessMap?: Texture | null;
  /** Normal map texture */
  normalMap?: Texture | null;
  /** Normal map intensity */
  normalScale?: number;
  /** Ambient occlusion texture */
  aoMap?: Texture | null;
  /** Emissive texture */
  emissiveMap?: Texture | null;
  /** Height/displacement map */
  heightMap?: Texture | null;
  /** Height map scale */
  heightScale?: number;
  
  // Advanced PBR features
  /** Clear coat layer intensity (0-1) */
  clearCoat?: number;
  /** Clear coat roughness */
  clearCoatRoughness?: number;
  /** Anisotropy factor */
  anisotropy?: number;
  /** Anisotropy rotation */
  anisotropyRotation?: number;
  /** Sheen color (for cloth) */
  sheen?: Vector3;
  /** Sheen roughness */
  sheenRoughness?: number;
  /** Subsurface scattering color */
  subsurface?: Vector3;
  /** Subsurface scattering radius */
  subsurfaceRadius?: number;
  
  // IBL (Image-Based Lighting) settings
  /** Environment map for reflections */
  envMap?: Texture | null;
  /** Environment map intensity */
  envMapIntensity?: number;
  /** BRDF lookup texture */
  brdfLUT?: Texture | null;
}

/**
 * Physically Based Rendering (PBR) material
 * Implements metallic-roughness workflow
 */
export class PBRMaterial {
  // Base PBR properties
  albedo: Vector3;
  metallic: number;
  roughness: number;
  ao: number;
  emissive: Vector3;
  emissiveIntensity: number;
  
  // Texture maps
  albedoMap: Texture | null = null;
  metallicMap: Texture | null = null;
  roughnessMap: Texture | null = null;
  metallicRoughnessMap: Texture | null = null;
  normalMap: Texture | null = null;
  normalScale: number;
  aoMap: Texture | null = null;
  emissiveMap: Texture | null = null;
  heightMap: Texture | null = null;
  heightScale: number;
  
  // Advanced PBR features
  clearCoat: number;
  clearCoatRoughness: number;
  anisotropy: number;
  anisotropyRotation: number;
  sheen: Vector3;
  sheenRoughness: number;
  subsurface: Vector3;
  subsurfaceRadius: number;
  
  // IBL properties
  envMap: Texture | null = null;
  envMapIntensity: number;
  brdfLUT: Texture | null = null;

  /**
   * Creates a new PBR material
   * @param params - Material parameters
   */
  constructor(params: PBRMaterialParams = {}) {
    // Base PBR properties
    this.albedo = params.albedo || new Vector3(1, 1, 1);
    this.metallic = params.metallic !== undefined ? params.metallic : 0.0;
    this.roughness = params.roughness !== undefined ? params.roughness : 0.5;
    this.ao = params.ao !== undefined ? params.ao : 1.0;
    this.emissive = params.emissive || new Vector3(0, 0, 0);
    this.emissiveIntensity = params.emissiveIntensity !== undefined ? params.emissiveIntensity : 1.0;
    
    // Texture maps
    this.albedoMap = params.albedoMap || null;
    this.metallicMap = params.metallicMap || null;
    this.roughnessMap = params.roughnessMap || null;
    this.metallicRoughnessMap = params.metallicRoughnessMap || null;
    this.normalMap = params.normalMap || null;
    this.normalScale = params.normalScale !== undefined ? params.normalScale : 1.0;
    this.aoMap = params.aoMap || null;
    this.emissiveMap = params.emissiveMap || null;
    this.heightMap = params.heightMap || null;
    this.heightScale = params.heightScale !== undefined ? params.heightScale : 0.1;
    
    // Advanced features
    this.clearCoat = params.clearCoat !== undefined ? params.clearCoat : 0.0;
    this.clearCoatRoughness = params.clearCoatRoughness !== undefined ? params.clearCoatRoughness : 0.0;
    this.anisotropy = params.anisotropy !== undefined ? params.anisotropy : 0.0;
    this.anisotropyRotation = params.anisotropyRotation !== undefined ? params.anisotropyRotation : 0.0;
    this.sheen = params.sheen || new Vector3(0, 0, 0);
    this.sheenRoughness = params.sheenRoughness !== undefined ? params.sheenRoughness : 0.0;
    this.subsurface = params.subsurface || new Vector3(0, 0, 0);
    this.subsurfaceRadius = params.subsurfaceRadius !== undefined ? params.subsurfaceRadius : 0.0;
    
    // IBL properties
    this.envMap = params.envMap || null;
    this.envMapIntensity = params.envMapIntensity !== undefined ? params.envMapIntensity : 1.0;
    this.brdfLUT = params.brdfLUT || null;
  }

  /**
   * Sets the albedo color
   * @param color - Albedo color
   * @returns This material for chaining
   */
  setAlbedo(color: Vector3): this {
    this.albedo.copy(color);
    return this;
  }

  /**
   * Sets the metallic factor
   * @param metallic - Metallic value (0-1)
   * @returns This material for chaining
   */
  setMetallic(metallic: number): this {
    this.metallic = Math.max(0, Math.min(1, metallic));
    return this;
  }

  /**
   * Sets the roughness factor
   * @param roughness - Roughness value (0-1)
   * @returns This material for chaining
   */
  setRoughness(roughness: number): this {
    this.roughness = Math.max(0, Math.min(1, roughness));
    return this;
  }

  /**
   * Sets the emissive color and intensity
   * @param color - Emissive color
   * @param intensity - Emissive intensity
   * @returns This material for chaining
   */
  setEmissive(color: Vector3, intensity: number = 1.0): this {
    this.emissive.copy(color);
    this.emissiveIntensity = intensity;
    return this;
  }

  /**
   * Binds all textures to WebGL texture units
   * @param startUnit - Starting texture unit
   * @returns Number of texture units used
   */
  bindTextures(startUnit: number = 0): number {
    let unit = startUnit;
    
    if (this.albedoMap) {
      this.albedoMap.bind(unit++);
    }
    
    if (this.metallicRoughnessMap) {
      this.metallicRoughnessMap.bind(unit++);
    } else {
      if (this.metallicMap) {
        this.metallicMap.bind(unit++);
      }
      if (this.roughnessMap) {
        this.roughnessMap.bind(unit++);
      }
    }
    
    if (this.normalMap) {
      this.normalMap.bind(unit++);
    }
    
    if (this.aoMap) {
      this.aoMap.bind(unit++);
    }
    
    if (this.emissiveMap) {
      this.emissiveMap.bind(unit++);
    }
    
    if (this.heightMap) {
      this.heightMap.bind(unit++);
    }
    
    if (this.envMap) {
      this.envMap.bind(unit++);
    }
    
    if (this.brdfLUT) {
      this.brdfLUT.bind(unit++);
    }
    
    return unit - startUnit;
  }

  /**
   * Gets shader defines based on active features
   * @returns Map of shader defines
   */
  getShaderDefines(): Map<string, string | boolean> {
    const defines = new Map<string, string | boolean>();
    
    // Texture maps
    if (this.albedoMap) defines.set('USE_ALBEDO_MAP', true);
    if (this.metallicRoughnessMap) {
      defines.set('USE_METALLIC_ROUGHNESS_MAP', true);
    } else {
      if (this.metallicMap) defines.set('USE_METALLIC_MAP', true);
      if (this.roughnessMap) defines.set('USE_ROUGHNESS_MAP', true);
    }
    if (this.normalMap) defines.set('USE_NORMAL_MAP', true);
    if (this.aoMap) defines.set('USE_AO_MAP', true);
    if (this.emissiveMap) defines.set('USE_EMISSIVE_MAP', true);
    if (this.heightMap) defines.set('USE_HEIGHT_MAP', true);
    
    // Advanced features
    if (this.clearCoat > 0) defines.set('USE_CLEAR_COAT', true);
    if (this.anisotropy > 0) defines.set('USE_ANISOTROPY', true);
    if (this.sheen.length() > 0) defines.set('USE_SHEEN', true);
    if (this.subsurface.length() > 0) defines.set('USE_SUBSURFACE', true);
    
    // IBL
    if (this.envMap) defines.set('USE_IBL', true);
    
    return defines;
  }

  /**
   * Creates a metal material preset
   * @param color - Metal color
   * @param roughness - Surface roughness
   * @returns PBR material
   */
  static createMetal(color: Vector3, roughness: number = 0.3): PBRMaterial {
    return new PBRMaterial({
      albedo: color,
      metallic: 1.0,
      roughness: roughness
    });
  }

  /**
   * Creates a dielectric (non-metal) material preset
   * @param color - Base color
   * @param roughness - Surface roughness
   * @returns PBR material
   */
  static createDielectric(color: Vector3, roughness: number = 0.5): PBRMaterial {
    return new PBRMaterial({
      albedo: color,
      metallic: 0.0,
      roughness: roughness
    });
  }

  /**
   * Creates a plastic material preset
   * @param color - Plastic color
   * @returns PBR material
   */
  static createPlastic(color: Vector3): PBRMaterial {
    return new PBRMaterial({
      albedo: color,
      metallic: 0.0,
      roughness: 0.3
    });
  }

  /**
   * Creates a rubber material preset
   * @param color - Rubber color
   * @returns PBR material
   */
  static createRubber(color: Vector3): PBRMaterial {
    return new PBRMaterial({
      albedo: color,
      metallic: 0.0,
      roughness: 0.9
    });
  }

  /**
   * Creates a wood material preset
   * @param color - Wood color
   * @returns PBR material
   */
  static createWood(color: Vector3): PBRMaterial {
    return new PBRMaterial({
      albedo: color,
      metallic: 0.0,
      roughness: 0.7
    });
  }

  /**
   * Creates a glass material preset
   * @param color - Glass tint
   * @returns PBR material
   */
  static createGlass(color: Vector3): PBRMaterial {
    return new PBRMaterial({
      albedo: color,
      metallic: 0.0,
      roughness: 0.0
    });
  }

  /**
   * Creates a gold material preset
   * @returns PBR material
   */
  static createGold(): PBRMaterial {
    return PBRMaterial.createMetal(new Vector3(1.0, 0.766, 0.336), 0.2);
  }

  /**
   * Creates a silver material preset
   * @returns PBR material
   */
  static createSilver(): PBRMaterial {
    return PBRMaterial.createMetal(new Vector3(0.972, 0.960, 0.915), 0.15);
  }

  /**
   * Creates a copper material preset
   * @returns PBR material
   */
  static createCopper(): PBRMaterial {
    return PBRMaterial.createMetal(new Vector3(0.955, 0.637, 0.538), 0.25);
  }

  /**
   * Creates an iron material preset
   * @returns PBR material
   */
  static createIron(): PBRMaterial {
    return PBRMaterial.createMetal(new Vector3(0.560, 0.570, 0.580), 0.4);
  }
}
