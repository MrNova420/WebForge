/**
 * Tests for Vector3 math module
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { Vector3 } from '../src/math/Vector3';

describe('Vector3', () => {
    describe('Constructor', () => {
        it('should create a zero vector by default', () => {
            const v = new Vector3();
            expect(v.x).toBe(0);
            expect(v.y).toBe(0);
            expect(v.z).toBe(0);
        });

        it('should create a vector with specified values', () => {
            const v = new Vector3(1, 2, 3);
            expect(v.x).toBe(1);
            expect(v.y).toBe(2);
            expect(v.z).toBe(3);
        });
    });

    describe('Static factories', () => {
        it('should create a zero vector', () => {
            const v = Vector3.zero();
            expect(v.x).toBe(0);
            expect(v.y).toBe(0);
            expect(v.z).toBe(0);
        });

        it('should create a one vector', () => {
            const v = Vector3.one();
            expect(v.x).toBe(1);
            expect(v.y).toBe(1);
            expect(v.z).toBe(1);
        });

        it('should create an up vector', () => {
            const v = Vector3.up();
            expect(v.x).toBe(0);
            expect(v.y).toBe(1);
            expect(v.z).toBe(0);
        });

        it('should create a right vector', () => {
            const v = Vector3.right();
            expect(v.x).toBe(1);
            expect(v.y).toBe(0);
            expect(v.z).toBe(0);
        });
    });

    describe('Operations', () => {
        let v1: Vector3;
        let v2: Vector3;

        beforeEach(() => {
            v1 = new Vector3(1, 2, 3);
            v2 = new Vector3(4, 5, 6);
        });

        it('should add vectors', () => {
            const result = v1.clone().add(v2);
            expect(result.x).toBe(5);
            expect(result.y).toBe(7);
            expect(result.z).toBe(9);
        });

        it('should subtract vectors', () => {
            const result = v1.clone().sub(v2);
            expect(result.x).toBe(-3);
            expect(result.y).toBe(-3);
            expect(result.z).toBe(-3);
        });

        it('should multiply by scalar', () => {
            const result = v1.clone().multiplyScalar(2);
            expect(result.x).toBe(2);
            expect(result.y).toBe(4);
            expect(result.z).toBe(6);
        });

        it('should divide by scalar', () => {
            const result = v1.clone().divideScalar(2);
            expect(result.x).toBe(0.5);
            expect(result.y).toBe(1);
            expect(result.z).toBe(1.5);
        });

        it('should calculate length', () => {
            const v = new Vector3(3, 4, 0);
            expect(v.length()).toBe(5);
        });

        it('should calculate squared length', () => {
            const v = new Vector3(3, 4, 0);
            expect(v.lengthSquared()).toBe(25);
        });

        it('should normalize a vector', () => {
            const v = new Vector3(3, 0, 0).normalize();
            expect(v.x).toBeCloseTo(1);
            expect(v.y).toBeCloseTo(0);
            expect(v.z).toBeCloseTo(0);
            expect(v.length()).toBeCloseTo(1);
        });

        it('should calculate dot product', () => {
            const dot = v1.dot(v2);
            expect(dot).toBe(32); // 1*4 + 2*5 + 3*6
        });

        it('should calculate cross product', () => {
            const a = new Vector3(1, 0, 0);
            const b = new Vector3(0, 1, 0);
            const cross = a.clone().cross(b);
            expect(cross.x).toBeCloseTo(0);
            expect(cross.y).toBeCloseTo(0);
            expect(cross.z).toBeCloseTo(1);
        });

        it('should clone a vector', () => {
            const clone = v1.clone();
            expect(clone.x).toBe(v1.x);
            expect(clone.y).toBe(v1.y);
            expect(clone.z).toBe(v1.z);
            expect(clone).not.toBe(v1);
        });

        it('should negate a vector', () => {
            const result = v1.clone().negate();
            expect(result.x).toBe(-1);
            expect(result.y).toBe(-2);
            expect(result.z).toBe(-3);
        });

        it('should calculate distance between vectors', () => {
            const a = new Vector3(0, 0, 0);
            const b = new Vector3(3, 4, 0);
            expect(a.distanceTo(b)).toBe(5);
        });

        it('should lerp between vectors', () => {
            const a = new Vector3(0, 0, 0);
            const b = new Vector3(10, 10, 10);
            const result = a.clone().lerp(b, 0.5);
            expect(result.x).toBe(5);
            expect(result.y).toBe(5);
            expect(result.z).toBe(5);
        });

        it('should check equality', () => {
            const a = new Vector3(1, 2, 3);
            const b = new Vector3(1, 2, 3);
            const c = new Vector3(1, 2, 4);
            expect(a.equals(b)).toBe(true);
            expect(a.equals(c)).toBe(false);
        });
    });

    describe('Edge cases', () => {
        it('should handle normalizing zero vector', () => {
            const v = new Vector3(0, 0, 0);
            const result = v.normalize();
            // Should not be NaN
            expect(isNaN(result.x)).toBe(false);
        });

        it('should handle very small vectors', () => {
            const v = new Vector3(1e-10, 1e-10, 1e-10);
            const length = v.length();
            expect(length).toBeGreaterThan(0);
        });

        it('should handle very large vectors', () => {
            const v = new Vector3(1e10, 1e10, 1e10);
            const length = v.length();
            expect(isFinite(length)).toBe(true);
        });
    });
});
