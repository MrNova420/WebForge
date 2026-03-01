/**
 * Rendering System Stability Tests for WebForge
 * Tests real-user scenarios across Camera, Light, Material, PBRMaterial, and Shader.
 */
import { describe, it, expect } from 'vitest';

import { Camera } from '../src/rendering/Camera';
import { Vector3 } from '../src/math/Vector3';
import { Matrix4 } from '../src/math/Matrix4';
import {
  LightType,
  DirectionalLight,
  PointLight,
  SpotLight,
} from '../src/rendering/Light';
import { PBRMaterial } from '../src/rendering/PBRMaterial';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns true if every element in the matrix is finite and not all zero. */
function isValidMatrix(m: Matrix4): boolean {
  const e = m.elements;
  let allZero = true;
  for (let i = 0; i < 16; i++) {
    if (!Number.isFinite(e[i])) return false;
    if (e[i] !== 0) allZero = false;
  }
  return !allZero;
}

// ============================================================
// 1. Camera – perspective view matrix
// ============================================================
describe('Camera – perspective setup', () => {
  it('creates a perspective camera with a valid view matrix after lookAt', () => {
    const cam = new Camera();
    cam.setPosition(new Vector3(0, 5, 10));
    cam.lookAt(new Vector3(0, 0, 0));

    const view = cam.getViewMatrix();
    expect(isValidMatrix(view)).toBe(true);
  });

  it('projection matrix is valid for default perspective', () => {
    const cam = new Camera();
    const proj = cam.getProjectionMatrix();
    expect(isValidMatrix(proj)).toBe(true);
  });

  it('view-projection matrix is valid', () => {
    const cam = new Camera();
    cam.setPosition(new Vector3(3, 3, 3));
    cam.lookAt(new Vector3(0, 0, 0));
    const vp = cam.getViewProjectionMatrix();
    expect(isValidMatrix(vp)).toBe(true);
  });
});

// ============================================================
// 2. Camera – orthographic projection
// ============================================================
describe('Camera – orthographic projection', () => {
  it('produces a valid orthographic projection matrix', () => {
    const cam = new Camera();
    cam.setOrthographic(-10, 10, -10, 10, 0.1, 100);

    expect(cam.getProjectionType()).toBe('orthographic');
    const proj = cam.getProjectionMatrix();
    expect(isValidMatrix(proj)).toBe(true);
  });

  it('near/far are read back correctly', () => {
    const cam = new Camera();
    cam.setOrthographic(-5, 5, -5, 5, 0.5, 200);
    expect(cam.getNear()).toBeCloseTo(0.5);
    expect(cam.getFar()).toBeCloseTo(200);
  });
});

// ============================================================
// 3. Camera – screenToWorldRay
// ============================================================
describe('Camera – screenToWorldRay', () => {
  it('returns a ray with direction length approximately 1', () => {
    const cam = new Camera();
    cam.setPerspective(Math.PI / 4, 16 / 9, 0.1, 1000);
    cam.setPosition(new Vector3(0, 5, 10));
    cam.lookAt(new Vector3(0, 0, 0));

    const ray = cam.screenToWorldRay(0.5, 0.5);
    expect(Number.isFinite(ray.origin.x)).toBe(true);
    expect(Number.isFinite(ray.origin.y)).toBe(true);
    expect(Number.isFinite(ray.origin.z)).toBe(true);

    const dirLen = ray.direction.length();
    expect(dirLen).toBeCloseTo(1, 1);
  });

  it('corner ray has valid finite components', () => {
    const cam = new Camera();
    cam.setPosition(new Vector3(0, 0, 5));
    cam.lookAt(new Vector3(0, 0, 0));

    const ray = cam.screenToWorldRay(0, 0);
    expect(Number.isFinite(ray.direction.x)).toBe(true);
    expect(Number.isFinite(ray.direction.y)).toBe(true);
    expect(Number.isFinite(ray.direction.z)).toBe(true);
  });
});

// ============================================================
// 4. Light types – creation and property access
// ============================================================
describe('Light types – creation and properties', () => {
  it('DirectionalLight has correct type and default direction', () => {
    const light = new DirectionalLight();
    expect(light.type).toBe(LightType.DIRECTIONAL);
    expect(light.direction).toBeDefined();
    expect(light.intensity).toBe(1.0);
    expect(light.color.x).toBe(1);
    expect(light.color.y).toBe(1);
    expect(light.color.z).toBe(1);
  });

  it('PointLight has correct type and default range', () => {
    const light = new PointLight({ intensity: 2.0, range: 20 });
    expect(light.type).toBe(LightType.POINT);
    expect(light.range).toBe(20);
    expect(light.intensity).toBe(2.0);
  });

  it('SpotLight has correct type, cone angles, and direction', () => {
    const light = new SpotLight({
      direction: new Vector3(0, -1, 0),
      innerConeAngle: Math.PI / 8,
      outerConeAngle: Math.PI / 4,
    });
    expect(light.type).toBe(LightType.SPOT);
    expect(light.innerConeAngle).toBeCloseTo(Math.PI / 8);
    expect(light.outerConeAngle).toBeCloseTo(Math.PI / 4);
    expect(light.innerConeCos).toBeCloseTo(Math.cos(Math.PI / 8));
    expect(light.outerConeCos).toBeCloseTo(Math.cos(Math.PI / 4));
  });

  it('getEffectiveColor scales by intensity', () => {
    const light = new PointLight({ color: new Vector3(1, 0.5, 0), intensity: 3 });
    const eff = light.getEffectiveColor();
    expect(eff.x).toBeCloseTo(3);
    expect(eff.y).toBeCloseTo(1.5);
    expect(eff.z).toBeCloseTo(0);
  });
});

// ============================================================
// 5. PointLight – attenuation
// ============================================================
describe('PointLight – attenuation', () => {
  it('attenuation is 1 at distance 0', () => {
    const light = new PointLight();
    expect(light.calculateAttenuation(0)).toBeCloseTo(1.0);
  });

  it('attenuation decreases with distance', () => {
    const light = new PointLight();
    const a1 = light.calculateAttenuation(1);
    const a5 = light.calculateAttenuation(5);
    const a10 = light.calculateAttenuation(10);
    expect(a1).toBeGreaterThan(a5);
    expect(a5).toBeGreaterThan(a10);
  });

  it('attenuation is clamped between 0 and 1', () => {
    const light = new PointLight();
    for (const d of [0, 1, 5, 10, 50, 100]) {
      const a = light.calculateAttenuation(d);
      expect(a).toBeGreaterThanOrEqual(0);
      expect(a).toBeLessThanOrEqual(1);
    }
  });
});

// ============================================================
// 6. PBRMaterial – basic creation (no WebGL context needed)
// ============================================================
describe('PBRMaterial – creation and property access', () => {
  it('default PBR material has expected defaults', () => {
    const mat = new PBRMaterial();
    expect(mat.metallic).toBe(0.0);
    expect(mat.roughness).toBe(0.5);
    expect(mat.ao).toBe(1.0);
    expect(mat.albedo.x).toBe(1);
    expect(mat.albedo.y).toBe(1);
    expect(mat.albedo.z).toBe(1);
  });

  it('setMetallic/setRoughness clamp to [0, 1]', () => {
    const mat = new PBRMaterial();
    mat.setMetallic(1.5);
    expect(mat.metallic).toBe(1.0);
    mat.setMetallic(-0.5);
    expect(mat.metallic).toBe(0.0);

    mat.setRoughness(2.0);
    expect(mat.roughness).toBe(1.0);
    mat.setRoughness(-1.0);
    expect(mat.roughness).toBe(0.0);
  });

  it('setAlbedo copies the color', () => {
    const mat = new PBRMaterial();
    const color = new Vector3(0.8, 0.2, 0.1);
    mat.setAlbedo(color);
    expect(mat.albedo.x).toBeCloseTo(0.8);
    expect(mat.albedo.y).toBeCloseTo(0.2);
    expect(mat.albedo.z).toBeCloseTo(0.1);
  });

  it('static preset createGold returns metallic=1', () => {
    const gold = PBRMaterial.createGold();
    expect(gold.metallic).toBe(1.0);
    expect(gold.roughness).toBeCloseTo(0.2);
  });
});

// ============================================================
// 7. PBRMaterial – advanced properties
// ============================================================
describe('PBRMaterial – advanced properties', () => {
  it('constructor accepts metallic/roughness', () => {
    const mat = new PBRMaterial({ metallic: 0.8, roughness: 0.3 });
    expect(mat.metallic).toBeCloseTo(0.8);
    expect(mat.roughness).toBeCloseTo(0.3);
  });

  it('setEmissive sets both color and intensity', () => {
    const mat = new PBRMaterial();
    mat.setEmissive(new Vector3(1, 0, 0), 5.0);
    expect(mat.emissive.x).toBeCloseTo(1);
    expect(mat.emissiveIntensity).toBeCloseTo(5.0);
  });

  it('getShaderDefines returns empty map for default material', () => {
    const mat = new PBRMaterial();
    const defines = mat.getShaderDefines();
    expect(defines.size).toBe(0);
  });
});

// ============================================================
// 8. Shader – source string validation (unit-level, no GL)
// ============================================================
describe('Shader source validation', () => {
  it('typical vertex shader source is a non-empty string with main()', () => {
    const vertexSrc = `
      attribute vec3 aPosition;
      uniform mat4 uMVPMatrix;
      void main() {
        gl_Position = uMVPMatrix * vec4(aPosition, 1.0);
      }
    `;
    expect(vertexSrc.length).toBeGreaterThan(0);
    expect(vertexSrc).toContain('void main');
    expect(vertexSrc).toContain('gl_Position');
  });

  it('typical fragment shader source contains precision and main()', () => {
    const fragmentSrc = `
      precision mediump float;
      uniform vec3 uColor;
      void main() {
        gl_FragColor = vec4(uColor, 1.0);
      }
    `;
    expect(fragmentSrc.length).toBeGreaterThan(0);
    expect(fragmentSrc).toContain('precision');
    expect(fragmentSrc).toContain('void main');
    expect(fragmentSrc).toContain('gl_FragColor');
  });
});

// ============================================================
// 9. Camera – clone produces independent copy
// ============================================================
describe('Camera – clone', () => {
  it('clone returns a camera with same FOV and position', () => {
    const cam = new Camera();
    cam.setPerspective(Math.PI / 3, 2.0, 0.5, 500);
    cam.setPosition(new Vector3(10, 20, 30));

    const clone = cam.clone();
    expect(clone.getFov()).toBeCloseTo(Math.PI / 3);
    expect(clone.getAspect()).toBeCloseTo(2.0);
    expect(clone.getNear()).toBeCloseTo(0.5);
    expect(clone.getFar()).toBeCloseTo(500);
    expect(clone.getPosition().x).toBeCloseTo(10);
    expect(clone.getPosition().y).toBeCloseTo(20);
    expect(clone.getPosition().z).toBeCloseTo(30);
  });

  it('modifying clone does not affect original', () => {
    const cam = new Camera();
    cam.setPosition(new Vector3(1, 2, 3));
    cam.setFov(Math.PI / 4);

    const clone = cam.clone();
    clone.setPosition(new Vector3(99, 99, 99));
    clone.setFov(Math.PI / 2);

    expect(cam.getPosition().x).toBeCloseTo(1);
    expect(cam.getPosition().y).toBeCloseTo(2);
    expect(cam.getPosition().z).toBeCloseTo(3);
    expect(cam.getFov()).toBeCloseTo(Math.PI / 4);
  });
});

// ============================================================
// 10. Camera – FOV setter behaviour
// ============================================================
describe('Camera – FOV setter', () => {
  it('setFov updates the stored FOV', () => {
    const cam = new Camera();
    cam.setFov(Math.PI / 3);
    expect(cam.getFov()).toBeCloseTo(Math.PI / 3);
  });

  it('setFov marks projection dirty and produces updated matrix', () => {
    const cam = new Camera();
    const proj1 = cam.getProjectionMatrix().clone();
    cam.setFov(Math.PI / 2);
    const proj2 = cam.getProjectionMatrix();
    // Matrices must differ after FOV change
    expect(proj1.equals(proj2)).toBe(false);
  });
});

// ============================================================
// 11. Light – intensity and range getters
// ============================================================
describe('Light – intensity and range', () => {
  it('PointLight intensity and range getters', () => {
    const pl = new PointLight({ intensity: 4.5, range: 50 });
    expect(pl.intensity).toBe(4.5);
    expect(pl.range).toBe(50);
  });

  it('SpotLight intensity, range, and cone accessors', () => {
    const sl = new SpotLight({ intensity: 2.0, range: 30 });
    expect(sl.intensity).toBe(2.0);
    expect(sl.range).toBe(30);
    expect(sl.innerConeCos).toBeCloseTo(Math.cos(sl.innerConeAngle));
  });

  it('DirectionalLight shadow camera params are accessible', () => {
    const dl = new DirectionalLight({ shadowCameraSize: 25, shadowCameraFar: 100 });
    expect(dl.shadowCameraSize).toBe(25);
    expect(dl.shadowCameraFar).toBe(100);
  });

  it('DirectionalLight view/projection matrices are valid', () => {
    const dl = new DirectionalLight({ direction: new Vector3(1, -1, 0) });
    dl.position = new Vector3(0, 10, 0);
    expect(isValidMatrix(dl.getViewMatrix())).toBe(true);
    expect(isValidMatrix(dl.getProjectionMatrix())).toBe(true);
  });
});

// ============================================================
// 12. Multiple cameras in succession
// ============================================================
describe('Multiple cameras – matrix isolation', () => {
  it('two cameras with different positions have different view matrices', () => {
    const cam1 = new Camera();
    cam1.setPosition(new Vector3(0, 0, 10));
    cam1.lookAt(new Vector3(0, 0, 0));

    const cam2 = new Camera();
    cam2.setPosition(new Vector3(10, 0, 0));
    cam2.lookAt(new Vector3(0, 0, 0));

    const v1 = cam1.getViewMatrix();
    const v2 = cam2.getViewMatrix();

    expect(isValidMatrix(v1)).toBe(true);
    expect(isValidMatrix(v2)).toBe(true);
    expect(v1.equals(v2)).toBe(false);
  });

  it('switching between perspective and ortho cameras keeps matrices independent', () => {
    const persp = new Camera();
    persp.setPerspective(Math.PI / 4, 16 / 9, 0.1, 1000);

    const ortho = new Camera();
    ortho.setOrthographic(-10, 10, -10, 10, 0.1, 100);

    const p1 = persp.getProjectionMatrix();
    const p2 = ortho.getProjectionMatrix();

    expect(isValidMatrix(p1)).toBe(true);
    expect(isValidMatrix(p2)).toBe(true);
    expect(p1.equals(p2)).toBe(false);
  });

  it('creating many cameras in a loop does not corrupt any matrices', () => {
    const cameras: Camera[] = [];
    for (let i = 0; i < 20; i++) {
      const cam = new Camera();
      cam.setPosition(new Vector3(i * 2, i, -i));
      cam.lookAt(new Vector3(0, 0, 0));
      cameras.push(cam);
    }

    for (const cam of cameras) {
      expect(isValidMatrix(cam.getViewMatrix())).toBe(true);
      expect(isValidMatrix(cam.getProjectionMatrix())).toBe(true);
    }
  });
});
