/**
 * @module rendering
 * @fileoverview Shadow mapping shader source code
 */

/**
 * Shadow map depth vertex shader
 */
export const shadowDepthVertexShader = `#version 300 es
precision highp float;

in vec3 a_position;

uniform mat4 u_lightSpaceMatrix;
uniform mat4 u_modelMatrix;

void main() {
  gl_Position = u_lightSpaceMatrix * u_modelMatrix * vec4(a_position, 1.0);
}
`;

/**
 * Shadow map depth fragment shader
 */
export const shadowDepthFragmentShader = `#version 300 es
precision highp float;

void main() {
  // Depth is automatically written to depth buffer
  // No color output needed
}
`;

/**
 * PCF (Percentage Closer Filtering) shadow sampling function
 * To be included in main shaders
 */
export const shadowPCFFunction = `
// Shadow map sampling with PCF
float sampleShadowMapPCF(sampler2D shadowMap, vec4 shadowCoord, float bias) {
  // Perspective divide
  vec3 projCoords = shadowCoord.xyz / shadowCoord.w;
  
  // Transform to [0,1] range
  projCoords = projCoords * 0.5 + 0.5;
  
  // Check if outside shadow map bounds
  if (projCoords.z > 1.0 || projCoords.x < 0.0 || projCoords.x > 1.0 || 
      projCoords.y < 0.0 || projCoords.y > 1.0) {
    return 1.0; // Not in shadow
  }
  
  float currentDepth = projCoords.z;
  
  // PCF filtering
  float shadow = 0.0;
  vec2 texelSize = 1.0 / vec2(textureSize(shadowMap, 0));
  
  for (int x = -1; x <= 1; ++x) {
    for (int y = -1; y <= 1; ++y) {
      float pcfDepth = texture(shadowMap, projCoords.xy + vec2(x, y) * texelSize).r;
      shadow += currentDepth - bias > pcfDepth ? 1.0 : 0.0;
    }
  }
  shadow /= 9.0;
  
  return 1.0 - shadow;
}
`;

/**
 * Basic shadow sampling function (no PCF)
 */
export const shadowBasicFunction = `
// Basic shadow map sampling
float sampleShadowMap(sampler2D shadowMap, vec4 shadowCoord, float bias) {
  // Perspective divide
  vec3 projCoords = shadowCoord.xyz / shadowCoord.w;
  
  // Transform to [0,1] range
  projCoords = projCoords * 0.5 + 0.5;
  
  // Check if outside shadow map bounds
  if (projCoords.z > 1.0 || projCoords.x < 0.0 || projCoords.x > 1.0 || 
      projCoords.y < 0.0 || projCoords.y > 1.0) {
    return 1.0; // Not in shadow
  }
  
  float closestDepth = texture(shadowMap, projCoords.xy).r;
  float currentDepth = projCoords.z;
  
  float shadow = currentDepth - bias > closestDepth ? 1.0 : 0.0;
  
  return 1.0 - shadow;
}
`;

/**
 * Cascaded shadow map sampling function
 */
export const shadowCSMFunction = `
// Cascaded shadow map sampling
float sampleCascadedShadowMap(
  sampler2D shadowMap0,
  sampler2D shadowMap1,
  sampler2D shadowMap2,
  sampler2D shadowMap3,
  vec4 shadowCoords[4],
  float viewZ,
  vec4 cascadeSplits,
  float bias
) {
  int cascadeIndex = 0;
  
  // Determine which cascade to use based on view depth
  if (viewZ < cascadeSplits.x) {
    cascadeIndex = 0;
  } else if (viewZ < cascadeSplits.y) {
    cascadeIndex = 1;
  } else if (viewZ < cascadeSplits.z) {
    cascadeIndex = 2;
  } else {
    cascadeIndex = 3;
  }
  
  vec4 shadowCoord;
  float shadow = 0.0;
  
  // Sample appropriate cascade
  if (cascadeIndex == 0) {
    shadow = sampleShadowMapPCF(shadowMap0, shadowCoords[0], bias);
  } else if (cascadeIndex == 1) {
    shadow = sampleShadowMapPCF(shadowMap1, shadowCoords[1], bias);
  } else if (cascadeIndex == 2) {
    shadow = sampleShadowMapPCF(shadowMap2, shadowCoords[2], bias);
  } else {
    shadow = sampleShadowMapPCF(shadowMap3, shadowCoords[3], bias);
  }
  
  return shadow;
}
`;

/**
 * Variance shadow map sampling function
 */
export const shadowVSMFunction = `
// Variance Shadow Map sampling
float sampleVSM(sampler2D shadowMap, vec4 shadowCoord, float bias) {
  vec3 projCoords = shadowCoord.xyz / shadowCoord.w;
  projCoords = projCoords * 0.5 + 0.5;
  
  if (projCoords.z > 1.0 || projCoords.x < 0.0 || projCoords.x > 1.0 || 
      projCoords.y < 0.0 || projCoords.y > 1.0) {
    return 1.0;
  }
  
  vec2 moments = texture(shadowMap, projCoords.xy).xy;
  
  float p = smoothstep(projCoords.z - bias, projCoords.z, moments.x);
  float variance = max(moments.y - moments.x * moments.x, 0.00002);
  
  float d = projCoords.z - moments.x;
  float p_max = variance / (variance + d * d);
  
  return max(p, p_max);
}
`;
