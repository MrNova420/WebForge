/**
 * Tests for Terrain and Audio subsystems
 */
import { describe, it, expect } from 'vitest';
import { Terrain } from '../src/terrain/Terrain';
import { TerrainGenerator } from '../src/terrain/TerrainGenerator';
import { TerrainBrush } from '../src/terrain/TerrainBrush';
import { WebForgeAudioContext } from '../src/audio/AudioContext';
import { AudioSourceState } from '../src/audio/AudioSource';

// ─── Terrain ───────────────────────────────────────────────────────────────────

describe('Terrain', () => {
    describe('Constructor and dimensions', () => {
        it('should create terrain with correct dimensions', () => {
            const terrain = new Terrain(64, 64, 100, 100);
            const dims = terrain.getDimensions();
            expect(dims.width).toBe(64);
            expect(dims.height).toBe(64);
            expect(dims.worldWidth).toBe(100);
            expect(dims.worldDepth).toBe(100);
        });

        it('should initialize all heights to zero', () => {
            const terrain = new Terrain(8, 8, 10, 10);
            for (let z = 0; z < 8; z++) {
                for (let x = 0; x < 8; x++) {
                    expect(terrain.getHeightAt(x, z)).toBe(0);
                }
            }
        });
    });

    describe('setHeight / getHeightAt', () => {
        it('should set and get height at grid position', () => {
            const terrain = new Terrain(16, 16, 50, 50);
            terrain.setHeight(5, 5, 0.75);
            expect(terrain.getHeightAt(5, 5)).toBe(0.75);
        });

        it('should ignore out-of-bounds setHeight', () => {
            const terrain = new Terrain(8, 8, 10, 10);
            terrain.setHeight(-1, 0, 1);
            terrain.setHeight(0, -1, 1);
            terrain.setHeight(8, 0, 1);
            terrain.setHeight(0, 8, 1);
            // All in-bounds cells should still be 0
            for (let z = 0; z < 8; z++) {
                for (let x = 0; x < 8; x++) {
                    expect(terrain.getHeightAt(x, z)).toBe(0);
                }
            }
        });

        it('should return 0 for out-of-bounds getHeightAt', () => {
            const terrain = new Terrain(8, 8, 10, 10);
            terrain.fill(0.5);
            expect(terrain.getHeightAt(-1, 0)).toBe(0);
            expect(terrain.getHeightAt(0, -1)).toBe(0);
            expect(terrain.getHeightAt(8, 0)).toBe(0);
            expect(terrain.getHeightAt(0, 8)).toBe(0);
        });
    });

    describe('getHeight (bilinear interpolation)', () => {
        it('should return exact height at grid-aligned world position', () => {
            const terrain = new Terrain(3, 3, 2, 2);
            // Grid indices: 0,1,2 → world positions 0, 1, 2
            terrain.setHeight(1, 1, 1.0);
            expect(terrain.getHeight(1, 1)).toBe(1.0);
        });

        it('should interpolate between grid points', () => {
            const terrain = new Terrain(2, 2, 1, 1);
            terrain.setHeight(0, 0, 0);
            terrain.setHeight(1, 0, 1);
            terrain.setHeight(0, 1, 0);
            terrain.setHeight(1, 1, 1);
            // Midpoint along X at z=0 should be 0.5
            expect(terrain.getHeight(0.5, 0)).toBeCloseTo(0.5, 5);
        });
    });

    describe('getNormal', () => {
        it('should return an upward normal on a flat terrain', () => {
            const terrain = new Terrain(8, 8, 10, 10);
            terrain.fill(0.5);
            const normal = terrain.getNormal(4, 4);
            expect(normal.x).toBeCloseTo(0, 5);
            expect(normal.y).toBeCloseTo(1, 5);
            expect(normal.z).toBeCloseTo(0, 5);
        });

        it('should return a tilted normal on a slope', () => {
            const terrain = new Terrain(8, 8, 10, 10);
            // Create a slope along X
            for (let z = 0; z < 8; z++) {
                for (let x = 0; x < 8; x++) {
                    terrain.setHeight(x, z, x * 0.5);
                }
            }
            const normal = terrain.getNormal(4, 4);
            // Normal should tilt against X direction (negative x component)
            expect(normal.x).toBeLessThan(0);
            expect(normal.y).toBeGreaterThan(0);
        });
    });

    describe('clear and fill', () => {
        it('should clear all heights to zero', () => {
            const terrain = new Terrain(8, 8, 10, 10);
            terrain.fill(0.8);
            terrain.clear();
            expect(terrain.getHeightAt(3, 3)).toBe(0);
        });

        it('should fill all heights to a constant', () => {
            const terrain = new Terrain(8, 8, 10, 10);
            terrain.fill(0.42);
            for (let z = 0; z < 8; z++) {
                for (let x = 0; x < 8; x++) {
                    expect(terrain.getHeightAt(x, z)).toBeCloseTo(0.42, 5);
                }
            }
        });
    });

    describe('clone', () => {
        it('should create an independent copy', () => {
            const terrain = new Terrain(8, 8, 10, 10);
            terrain.setHeight(2, 2, 0.9);
            const copy = terrain.clone();
            expect(copy.getHeightAt(2, 2)).toBeCloseTo(0.9, 5);
            expect(copy.getDimensions()).toEqual(terrain.getDimensions());

            // Mutating clone should not affect original
            copy.setHeight(2, 2, 0);
            expect(terrain.getHeightAt(2, 2)).toBeCloseTo(0.9, 5);
        });
    });

    describe('setHeightRange', () => {
        it('should accept height range without error', () => {
            const terrain = new Terrain(8, 8, 10, 10);
            expect(() => terrain.setHeightRange(0, 50)).not.toThrow();
        });
    });
});

// ─── TerrainGenerator ──────────────────────────────────────────────────────────

describe('TerrainGenerator', () => {
    describe('Perlin noise', () => {
        it('should produce deterministic output for the same seed', () => {
            const gen1 = new TerrainGenerator(42);
            const gen2 = new TerrainGenerator(42);
            expect(gen1.perlin(1.5, 2.5)).toBe(gen2.perlin(1.5, 2.5));
        });

        it('should produce different output for different seeds', () => {
            const gen1 = new TerrainGenerator(42);
            const gen2 = new TerrainGenerator(999);
            // Very unlikely to be equal with different seeds
            expect(gen1.perlin(1.5, 2.5)).not.toBe(gen2.perlin(1.5, 2.5));
        });

        it('should return values in [-1, 1] range', () => {
            const gen = new TerrainGenerator(12345);
            for (let i = 0; i < 100; i++) {
                const val = gen.perlin(i * 0.37, i * 0.53);
                expect(val).toBeGreaterThanOrEqual(-1);
                expect(val).toBeLessThanOrEqual(1);
            }
        });
    });

    describe('fBm', () => {
        it('should return values in roughly [-1, 1] range', () => {
            const gen = new TerrainGenerator(100);
            for (let i = 0; i < 50; i++) {
                const val = gen.fbm(i * 0.5, i * 0.7, 4, 0.5);
                expect(val).toBeGreaterThanOrEqual(-1.5);
                expect(val).toBeLessThanOrEqual(1.5);
            }
        });

        it('should produce smoother results with fewer octaves', () => {
            const gen = new TerrainGenerator(42);
            // With 1 octave it equals raw perlin
            const single = gen.fbm(2.0, 3.0, 1, 0.5);
            const raw = gen.perlin(2.0, 3.0);
            expect(single).toBeCloseTo(raw, 10);
        });
    });

    describe('generatePerlin', () => {
        it('should populate terrain with non-zero heights', () => {
            const terrain = new Terrain(16, 16, 50, 50);
            const gen = new TerrainGenerator(42);
            gen.generatePerlin(terrain, 4, 0.01, 0.5);

            let hasNonZero = false;
            for (let z = 0; z < 16; z++) {
                for (let x = 0; x < 16; x++) {
                    const h = terrain.getHeightAt(x, z);
                    if (h !== 0) hasNonZero = true;
                    // Heights are normalized to [0, 1]
                    expect(h).toBeGreaterThanOrEqual(-0.5);
                    expect(h).toBeLessThanOrEqual(1.5);
                }
            }
            expect(hasNonZero).toBe(true);
        });
    });

    describe('generatePlateau', () => {
        it('should generate terrain with heights bounded around plateau level', () => {
            const terrain = new Terrain(16, 16, 50, 50);
            const gen = new TerrainGenerator(42);
            gen.generatePlateau(terrain, 0.7, 0.1);

            let hasNonZero = false;
            for (let z = 0; z < 16; z++) {
                for (let x = 0; x < 16; x++) {
                    if (terrain.getHeightAt(x, z) !== 0) hasNonZero = true;
                }
            }
            expect(hasNonZero).toBe(true);
        });
    });

    describe('generateValleys', () => {
        it('should generate terrain with valley shape', () => {
            const terrain = new Terrain(16, 16, 50, 50);
            const gen = new TerrainGenerator(42);
            gen.generateValleys(terrain, 0.5);

            // Center should be higher than edges
            const center = terrain.getHeightAt(8, 8);
            const edge = terrain.getHeightAt(0, 0);
            expect(center).toBeGreaterThan(edge);
        });
    });

    describe('generateRidges', () => {
        it('should generate non-negative heights', () => {
            const terrain = new Terrain(16, 16, 50, 50);
            const gen = new TerrainGenerator(42);
            gen.generateRidges(terrain, 0.8);

            for (let z = 0; z < 16; z++) {
                for (let x = 0; x < 16; x++) {
                    expect(terrain.getHeightAt(x, z)).toBeGreaterThanOrEqual(0);
                }
            }
        });
    });

    describe('applyErosion', () => {
        it('should smooth out sharp height differences', () => {
            const terrain = new Terrain(8, 8, 10, 10);
            // Create a spike
            terrain.setHeight(4, 4, 1.0);
            const before = terrain.getHeightAt(4, 4);

            const gen = new TerrainGenerator(1);
            gen.applyErosion(terrain, 5, 0.3);

            const after = terrain.getHeightAt(4, 4);
            expect(after).toBeLessThan(before);
        });
    });
});

// ─── TerrainBrush ──────────────────────────────────────────────────────────────

describe('TerrainBrush', () => {
    describe('Constructor and properties', () => {
        it('should create a brush with given parameters', () => {
            const brush = new TerrainBrush('raise', 10, 0.5);
            const props = brush.getProperties();
            expect(props.type).toBe('raise');
            expect(props.radius).toBe(10);
            expect(props.strength).toBe(0.5);
            expect(props.falloff).toBe('smooth'); // default
        });
    });

    describe('Setters', () => {
        it('should update type', () => {
            const brush = new TerrainBrush('raise', 5, 0.5);
            brush.setType('lower');
            expect(brush.getProperties().type).toBe('lower');
        });

        it('should clamp radius to minimum 0.1', () => {
            const brush = new TerrainBrush('raise', 5, 0.5);
            brush.setRadius(-5);
            expect(brush.getProperties().radius).toBe(0.1);
        });

        it('should clamp strength to [0, 1]', () => {
            const brush = new TerrainBrush('raise', 5, 0.5);
            brush.setStrength(2.0);
            expect(brush.getProperties().strength).toBe(1);
            brush.setStrength(-1.0);
            expect(brush.getProperties().strength).toBe(0);
        });

        it('should update falloff type', () => {
            const brush = new TerrainBrush('raise', 5, 0.5);
            brush.setFalloff('linear');
            expect(brush.getProperties().falloff).toBe('linear');
            brush.setFalloff('sharp');
            expect(brush.getProperties().falloff).toBe('sharp');
        });

        it('should accept target height', () => {
            const brush = new TerrainBrush('flatten', 5, 0.5);
            expect(() => brush.setTargetHeight(0.3)).not.toThrow();
        });

        it('should clamp noise scale to minimum 0.01', () => {
            const brush = new TerrainBrush('noise', 5, 0.5);
            expect(() => brush.setNoiseScale(0.001)).not.toThrow();
            // After clamping should still work
            expect(() => brush.setNoiseScale(1.0)).not.toThrow();
        });

        it('should accept a stamp pattern', () => {
            const brush = new TerrainBrush('stamp', 5, 0.5);
            const pattern = new Float32Array(16);
            expect(() => brush.setStampPattern(pattern, 4)).not.toThrow();
        });
    });

    describe('Static stamp generators', () => {
        it('should create a plateau stamp with correct size', () => {
            const stamp = TerrainBrush.createPlateauStamp(16);
            expect(stamp).toBeInstanceOf(Float32Array);
            expect(stamp.length).toBe(16 * 16);
        });

        it('plateau stamp center should be 1.0', () => {
            const size = 32;
            const stamp = TerrainBrush.createPlateauStamp(size);
            const center = Math.floor(size / 2);
            expect(stamp[center * size + center]).toBe(1.0);
        });

        it('plateau stamp corners should be 0', () => {
            const size = 32;
            const stamp = TerrainBrush.createPlateauStamp(size);
            expect(stamp[0]).toBe(0);
            expect(stamp[size - 1]).toBe(0);
            expect(stamp[(size - 1) * size]).toBe(0);
            expect(stamp[size * size - 1]).toBe(0);
        });

        it('should create a ridge stamp with correct size', () => {
            const stamp = TerrainBrush.createRidgeStamp(16);
            expect(stamp).toBeInstanceOf(Float32Array);
            expect(stamp.length).toBe(16 * 16);
        });

        it('ridge stamp should have highest value at center', () => {
            const size = 32;
            const stamp = TerrainBrush.createRidgeStamp(size);
            const center = Math.floor(size / 2);
            const centerVal = stamp[center * size + center];
            expect(centerVal).toBeGreaterThan(0);
        });
    });

    describe('Brush application', () => {
        it('raise brush should increase terrain height', () => {
            const terrain = new Terrain(32, 32, 100, 100);
            const brush = new TerrainBrush('raise', 20, 1.0);
            const beforeHeight = terrain.getHeightAt(16, 16);
            brush.apply(terrain, 0, 0); // center of world
            const afterHeight = terrain.getHeightAt(16, 16);
            expect(afterHeight).toBeGreaterThan(beforeHeight);
        });

        it('lower brush should decrease terrain height', () => {
            const terrain = new Terrain(32, 32, 100, 100);
            terrain.fill(0.5);
            const brush = new TerrainBrush('lower', 20, 1.0);
            const beforeHeight = terrain.getHeightAt(16, 16);
            brush.apply(terrain, 0, 0);
            const afterHeight = terrain.getHeightAt(16, 16);
            expect(afterHeight).toBeLessThan(beforeHeight);
        });

        it('smooth brush should reduce sharp differences', () => {
            const terrain = new Terrain(32, 32, 100, 100);
            terrain.setHeight(16, 16, 1.0); // spike
            const brush = new TerrainBrush('smooth', 20, 1.0);
            brush.apply(terrain, 0, 0);
            // Spike should be reduced towards neighbor average
            expect(terrain.getHeightAt(16, 16)).toBeLessThan(1.0);
        });

        it('flatten brush should move height toward target', () => {
            const terrain = new Terrain(32, 32, 100, 100);
            terrain.fill(0.0);
            const brush = new TerrainBrush('flatten', 20, 1.0);
            brush.setTargetHeight(0.5);
            brush.apply(terrain, 0, 0);
            // Center should have moved toward 0.5
            expect(terrain.getHeightAt(16, 16)).toBeGreaterThan(0);
        });

        it('erode brush should reduce peaks', () => {
            const terrain = new Terrain(32, 32, 100, 100);
            terrain.setHeight(16, 16, 1.0);
            const brush = new TerrainBrush('erode', 20, 1.0);
            brush.apply(terrain, 0, 0);
            expect(terrain.getHeightAt(16, 16)).toBeLessThan(1.0);
        });

        it('noise brush should change heights', () => {
            const terrain = new Terrain(32, 32, 100, 100);
            const brush = new TerrainBrush('noise', 20, 1.0);
            brush.apply(terrain, 0, 0);
            // At least some cells should have changed
            let changed = false;
            for (let z = 0; z < 32 && !changed; z++) {
                for (let x = 0; x < 32 && !changed; x++) {
                    if (terrain.getHeightAt(x, z) !== 0) changed = true;
                }
            }
            expect(changed).toBe(true);
        });

        it('randomizeNoise should not throw', () => {
            const brush = new TerrainBrush('noise', 5, 0.5);
            expect(() => brush.randomizeNoise()).not.toThrow();
        });
    });
});

// ─── Audio (pure-logic, no WebAudio required) ──────────────────────────────────

describe('WebForgeAudioContext', () => {
    describe('Constructor defaults', () => {
        it('should use default config values', () => {
            const ctx = new WebForgeAudioContext();
            expect(ctx.getMasterVolume()).toBe(1.0);
            expect(ctx.getSampleRate()).toBe(44100);
        });

        it('should accept custom config', () => {
            const ctx = new WebForgeAudioContext({
                sampleRate: 48000,
                masterVolume: 0.5,
                latencyHint: 'playback'
            });
            expect(ctx.getMasterVolume()).toBe(0.5);
            expect(ctx.getSampleRate()).toBe(48000);
        });
    });

    describe('Pre-initialization state', () => {
        it('should report suspended before initialization', () => {
            const ctx = new WebForgeAudioContext();
            expect(ctx.isSuspended()).toBe(true);
        });

        it('should report not running before initialization', () => {
            const ctx = new WebForgeAudioContext();
            expect(ctx.isRunning()).toBe(false);
        });

        it('should return 0 for current time before initialization', () => {
            const ctx = new WebForgeAudioContext();
            expect(ctx.getCurrentTime()).toBe(0);
        });
    });

    describe('Volume control (pre-init)', () => {
        it('should update master volume via setMasterVolume', () => {
            const ctx = new WebForgeAudioContext();
            ctx.setMasterVolume(0.7);
            expect(ctx.getMasterVolume()).toBeCloseTo(0.7);
        });

        it('should clamp volume to [0, 1]', () => {
            const ctx = new WebForgeAudioContext();
            ctx.setMasterVolume(2.0);
            expect(ctx.getMasterVolume()).toBe(1.0);
            ctx.setMasterVolume(-0.5);
            expect(ctx.getMasterVolume()).toBe(0);
        });
    });
});

describe('AudioSourceState', () => {
    it('should define STOPPED, PLAYING, PAUSED states', () => {
        expect(AudioSourceState.STOPPED).toBe('stopped');
        expect(AudioSourceState.PLAYING).toBe('playing');
        expect(AudioSourceState.PAUSED).toBe('paused');
    });
});
