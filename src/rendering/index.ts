/**
 * @module rendering
 * @fileoverview WebForge Rendering - WebGL rendering system
 */

export { WebGLContext } from './WebGLContext';
export type { WebGLContextConfig } from './WebGLContext';

export { Shader, ShaderType } from './Shader';
export type { UniformValue } from './Shader';

export { Buffer, BufferType, BufferUsage } from './Buffer';

export { Texture, TextureType, TextureFormat, TextureFilter, TextureWrap } from './Texture';

export { Framebuffer } from './Framebuffer';

export { Mesh, GeometryUtils } from './Mesh';
export type { VertexAttribute } from './Mesh';

export { Material } from './Material';
export type { MaterialConfig, MaterialProperties, MaterialPropertyValue } from './Material';

export { Camera } from './Camera';
export type { ProjectionType } from './Camera';

export { Renderer } from './Renderer';
export type { RendererConfig, Renderable } from './Renderer';

export { DebugRenderer } from './DebugRenderer';

export { Light, DirectionalLight, PointLight, SpotLight, AreaLight, LightType } from './Light';
export type { LightConfig, DirectionalLightConfig, PointLightConfig, SpotLightConfig, AreaLightConfig } from './Light';

export { PBRMaterial } from './PBRMaterial';
export type { PBRMaterialParams } from './PBRMaterial';

export { pbrVertexShader, simplePBRFragmentShader } from './shaders/PBRShaders';

export { ShadowMapManager, CascadedShadowMap } from './ShadowMap';
export type { ShadowMapConfig, ShadowMap, CascadedShadowMapConfig } from './ShadowMap';

export { 
  shadowDepthVertexShader, 
  shadowDepthFragmentShader,
  shadowPCFFunction,
  shadowBasicFunction,
  shadowCSMFunction,
  shadowVSMFunction
} from './shaders/ShadowShaders';

export { PostProcessing, BasePostEffect } from './PostProcessing';
export type { PostEffect, PostProcessingConfig } from './PostProcessing';

export { BloomEffect } from './effects/BloomEffect';
export type { BloomConfig } from './effects/BloomEffect';

export { ToneMappingEffect, ToneMappingOperator } from './effects/ToneMappingEffect';
export type { ToneMappingConfig } from './effects/ToneMappingEffect';

export { SSAOEffect } from './effects/SSAOEffect';
export type { SSAOConfig } from './effects/SSAOEffect';
