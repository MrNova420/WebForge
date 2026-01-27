import { describe, it, expect } from 'vitest';
import { Camera } from '../src/rendering/Camera';
import { Vector3 } from '../src/math/Vector3';
import { Vector4 } from '../src/math/Vector4';
import { Matrix4 } from '../src/math/Matrix4';
import { Transform } from '../src/math/Transform';

describe('Rendering Debug Tests', () => {
    it('Camera viewProjection matrix should be valid', () => {
        const camera = new Camera();
        camera.setPerspective(60 * Math.PI / 180, 800 / 600, 0.1, 1000);
        camera.setPosition(new Vector3(5, 5, 5));
        camera.lookAt(new Vector3(0, 0, 0));
        
        const viewProj = camera.getViewProjectionMatrix();
        
        // Check that matrix is not identity or all zeros
        let hasNonZero = false;
        let hasNonOne = false;
        for (let i = 0; i < 16; i++) {
            if (Math.abs(viewProj.elements[i]) > 0.001) hasNonZero = true;
            if (Math.abs(viewProj.elements[i] - 1) > 0.001) hasNonOne = true;
        }
        
        expect(hasNonZero).toBe(true);
        expect(hasNonOne).toBe(true);
        
        // Test point projection - origin should project somewhere visible
        const origin = new Vector4(0, 0, 0, 1);
        const projected = viewProj.multiplyVector4(origin);
        
        console.log('Projected origin:', projected);
        
        // Check no NaN
        expect(isNaN(projected.x)).toBe(false);
        expect(isNaN(projected.w)).toBe(false);
        
        // After perspective divide, should be within clip space [-1, 1]
        const clipX = projected.x / projected.w;
        const clipY = projected.y / projected.w;
        const clipZ = projected.z / projected.w;
        
        console.log('Clip coords:', { clipX, clipY, clipZ });
        
        expect(Math.abs(clipX)).toBeLessThan(2);
        expect(Math.abs(clipY)).toBeLessThan(2);
    });
    
    it('Transform lookAt should face toward target', () => {
        // NOTE: Transform.lookAt uses OpenGL convention where -Z is forward
        // So transform.forward() returns the -Z axis direction in world space
        const transform = new Transform();
        transform.position.set(0, 0, 5);
        transform.lookAt(new Vector3(0, 0, 0));
        
        // The -Z axis (forward in OpenGL) should point toward the target (0,0,0)
        // From position (0,0,5), that means forward should be (0,0,-1)
        const forward = transform.forward();
        console.log('Forward direction:', forward.toString());
        
        // Forward should point toward negative Z (toward origin from z=5)
        const expectedDir = new Vector3(0, 0, -1);
        console.log('Expected direction:', expectedDir.toString());
        
        // Allow some tolerance
        expect(forward.dot(expectedDir)).toBeGreaterThan(0.9);
    });
    
    it('View matrix should correctly transform world points', () => {
        const camera = new Camera();
        camera.setPosition(new Vector3(0, 0, 5));
        camera.lookAt(new Vector3(0, 0, 0));
        
        const viewMatrix = camera.getViewMatrix();
        console.log('View matrix:', viewMatrix.elements);
        
        // Origin should appear at z=-5 in view space (5 units in front of camera)
        const origin = viewMatrix.multiplyVector3(new Vector3(0, 0, 0));
        console.log('Origin in view space:', origin.toString());
        
        expect(origin.z).toBeCloseTo(-5, 1);
    });
    
    it('Matrix4.perspective should produce valid projection', () => {
        const proj = Matrix4.perspective(Math.PI / 3, 1.333, 0.1, 100);
        
        console.log('Projection matrix:', proj.elements);
        
        // Check key elements
        expect(proj.elements[0]).toBeGreaterThan(0);  // Should have positive X scale
        expect(proj.elements[5]).toBeGreaterThan(0);  // Should have positive Y scale
        expect(proj.elements[11]).toBe(-1);            // Perspective divide indicator
    });
    
    it('Matrix4.lookAt should work correctly', () => {
        const eye = new Vector3(0, 0, 5);
        const target = new Vector3(0, 0, 0);
        const up = new Vector3(0, 1, 0);
        
        const view = Matrix4.lookAt(eye, target, up);
        console.log('LookAt matrix:', view.elements);
        
        // Transform origin - should be at z = -5 (in front of camera)
        const origin = view.multiplyVector3(new Vector3(0, 0, 0));
        console.log('Origin transformed:', origin.toString());
        
        expect(origin.z).toBeCloseTo(-5, 1);
    });
});
