/**
 * @module rendering
 * @fileoverview PBR shader source code
 */

/**
 * PBR vertex shader
 */
export const pbrVertexShader = `#version 300 es
precision highp float;

// Attributes
in vec3 a_position;
in vec3 a_normal;
in vec2 a_texcoord;
in vec3 a_tangent;
in vec3 a_bitangent;

// Uniforms
uniform mat4 u_modelMatrix;
uniform mat4 u_viewMatrix;
uniform mat4 u_projectionMatrix;
uniform mat3 u_normalMatrix;

// Outputs to fragment shader
out vec3 v_worldPosition;
out vec3 v_normal;
out vec2 v_texcoord;
out mat3 v_TBN;

void main() {
  // Transform position
  vec4 worldPos = u_modelMatrix * vec4(a_position, 1.0);
  v_worldPosition = worldPos.xyz;
  gl_Position = u_projectionMatrix * u_viewMatrix * worldPos;
  
  // Transform normal
  v_normal = normalize(u_normalMatrix * a_normal);
  
  // Pass texture coordinates
  v_texcoord = a_texcoord;
  
  // Compute TBN matrix for normal mapping
  vec3 T = normalize(u_normalMatrix * a_tangent);
  vec3 B = normalize(u_normalMatrix * a_bitangent);
  vec3 N = v_normal;
  v_TBN = mat3(T, B, N);
}
`;

/**
 * Simple PBR shader for basic rendering (fewer features, better performance)
 */
export const simplePBRFragmentShader = `#version 300 es
precision mediump float;

in vec3 v_worldPosition;
in vec3 v_normal;
in vec2 v_texcoord;

out vec4 fragColor;

uniform vec3 u_albedo;
uniform float u_metallic;
uniform float u_roughness;
uniform vec3 u_cameraPosition;
uniform vec3 u_lightDirection;
uniform vec3 u_lightColor;

#define PI 3.14159265359

vec3 fresnelSchlick(float cosTheta, vec3 F0) {
  return F0 + (1.0 - F0) * pow(1.0 - cosTheta, 5.0);
}

float DistributionGGX(vec3 N, vec3 H, float roughness) {
  float a = roughness * roughness;
  float a2 = a * a;
  float NdotH = max(dot(N, H), 0.0);
  float NdotH2 = NdotH * NdotH;
  
  float denom = (NdotH2 * (a2 - 1.0) + 1.0);
  return a2 / (PI * denom * denom);
}

float GeometrySchlickGGX(float NdotV, float roughness) {
  float r = (roughness + 1.0);
  float k = (r * r) / 8.0;
  return NdotV / (NdotV * (1.0 - k) + k);
}

void main() {
  vec3 N = normalize(v_normal);
  vec3 V = normalize(u_cameraPosition - v_worldPosition);
  vec3 L = normalize(-u_lightDirection);
  vec3 H = normalize(V + L);
  
  vec3 F0 = mix(vec3(0.04), u_albedo, u_metallic);
  vec3 F = fresnelSchlick(max(dot(H, V), 0.0), F0);
  
  float NDF = DistributionGGX(N, H, u_roughness);
  float G = GeometrySchlickGGX(max(dot(N, V), 0.0), u_roughness) * 
            GeometrySchlickGGX(max(dot(N, L), 0.0), u_roughness);
  
  vec3 numerator = NDF * G * F;
  float denominator = 4.0 * max(dot(N, V), 0.0) * max(dot(N, L), 0.0);
  vec3 specular = numerator / max(denominator, 0.001);
  
  vec3 kD = (vec3(1.0) - F) * (1.0 - u_metallic);
  
  float NdotL = max(dot(N, L), 0.0);
  vec3 Lo = (kD * u_albedo / PI + specular) * u_lightColor * NdotL;
  
  vec3 ambient = vec3(0.03) * u_albedo;
  vec3 color = ambient + Lo;
  
  // Tone mapping
  color = color / (color + vec3(1.0));
  // Gamma correction
  color = pow(color, vec3(1.0 / 2.2));
  
  fragColor = vec4(color, 1.0);
}
`;
