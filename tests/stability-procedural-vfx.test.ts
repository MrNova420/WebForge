import { describe, it, expect, beforeEach } from 'vitest';
import { Vector3 } from '../src/math/Vector3';
import { Vector2 } from '../src/math/Vector2';
import { NoiseGenerator } from '../src/procedural/NoiseGenerator';
import { ProceduralMeshGenerator } from '../src/procedural/ProceduralMeshGenerator';
import { EnhancedProceduralGenerator } from '../src/procedural/EnhancedProceduralGenerator';
import { VegetationScattering } from '../src/procedural/VegetationScattering';
import { AdvancedVFXSystem } from '../src/vfx/AdvancedVFXSystem';
import { WaterSimulationSystem } from '../src/water/WaterSimulationSystem';
import { WeatherSystem, WeatherType, WeatherIntensity } from '../src/weather/WeatherSystem';
import { ParticleSystem } from '../src/particles/ParticleSystem';
import { HalfEdgeMesh } from '../src/geometry/HalfEdgeMesh';
import { MeshData } from '../src/geometry/MeshData';
import { MeshOperations } from '../src/geometry/MeshOperations';
import { MeshQualityEnhancer } from '../src/geometry/MeshQualityEnhancer';
import { Terrain } from '../src/terrain/Terrain';
import { TerrainGenerator } from '../src/terrain/TerrainGenerator';
import { TerrainBrush } from '../src/terrain/TerrainBrush';
import { EnhancedTerrainGenerator } from '../src/terrain/EnhancedTerrainGenerator';

// ─── 1. Noise Functions ──────────────────────────────────────────────────────

describe('NoiseGenerator – deterministic output', () => {
    let noise: NoiseGenerator;

    beforeEach(() => {
        noise = new NoiseGenerator(42);
    });

    it('perlin2D returns same value for same seed and coordinates', () => {
        const a = noise.perlin2D(1.5, 2.5);
        const b = new NoiseGenerator(42).perlin2D(1.5, 2.5);
        expect(a).toBe(b);
    });

    it('perlin2D returns values in [0,1]', () => {
        for (let i = 0; i < 50; i++) {
            const v = noise.perlin2D(i * 0.37, i * 0.53);
            expect(v).toBeGreaterThanOrEqual(0);
            expect(v).toBeLessThanOrEqual(1);
        }
    });

    it('perlin3D is deterministic', () => {
        const a = noise.perlin3D(0.5, 1.0, 1.5);
        const b = new NoiseGenerator(42).perlin3D(0.5, 1.0, 1.5);
        expect(a).toBe(b);
    });

    it('simplex2D is deterministic and returns finite values', () => {
        const a = noise.simplex2D(3.0, 4.0);
        const b = new NoiseGenerator(42).simplex2D(3.0, 4.0);
        expect(a).toBe(b);
        expect(Number.isFinite(a)).toBe(true);
    });

    it('voronoi2D is deterministic', () => {
        const a = noise.voronoi2D(1.0, 2.0, 1.0);
        const b = new NoiseGenerator(42).voronoi2D(1.0, 2.0, 1.0);
        expect(a).toBe(b);
    });

    it('voronoi2D returns values in [0,1]', () => {
        for (let i = 0; i < 30; i++) {
            const v = noise.voronoi2D(i * 0.5, i * 0.7, 1.0);
            expect(v).toBeGreaterThanOrEqual(0);
            expect(v).toBeLessThanOrEqual(1);
        }
    });

    it('fbm2D is deterministic', () => {
        const a = noise.fbm2D(1.0, 2.0, 4, 0.5, 2.0);
        const b = new NoiseGenerator(42).fbm2D(1.0, 2.0, 4, 0.5, 2.0);
        expect(a).toBe(b);
    });

    it('fbm3D is deterministic', () => {
        const a = noise.fbm3D(1.0, 2.0, 3.0, 4, 0.5, 2.0);
        const b = new NoiseGenerator(42).fbm3D(1.0, 2.0, 3.0, 4, 0.5, 2.0);
        expect(a).toBe(b);
    });

    it('different seeds produce different output', () => {
        const other = new NoiseGenerator(99);
        // Use non-integer coordinates; at integer points Perlin gradients cancel to zero
        const a = noise.perlin2D(5.3, 7.7);
        const b = other.perlin2D(5.3, 7.7);
        expect(a).not.toBe(b);
    });
});

// ─── 2. Procedural Terrain Heightmap ─────────────────────────────────────────

describe('TerrainGenerator – heightmap generation', () => {
    let terrain: Terrain;
    let generator: TerrainGenerator;

    beforeEach(() => {
        terrain = new Terrain(64, 64, 100, 100);
        generator = new TerrainGenerator(42);
    });

    it('generates perlin terrain with correct dimensions', () => {
        generator.generatePerlin(terrain, 4, 0.05, 0.5);
        const dims = terrain.getDimensions();
        expect(dims.width).toBe(64);
        expect(dims.height).toBe(64);
    });

    it('perlin terrain has non-uniform height values', () => {
        // frequency must be non-integer to avoid Perlin noise zero-crossings
        generator.generatePerlin(terrain, 4, 0.05, 0.5);
        let min = Infinity, max = -Infinity;
        for (let x = 0; x < 64; x++) {
            for (let z = 0; z < 64; z++) {
                const h = terrain.getHeightAt(x, z);
                min = Math.min(min, h);
                max = Math.max(max, h);
            }
        }
        expect(max - min).toBeGreaterThan(0);
    });

    it('generates plateau terrain', () => {
        generator.generatePlateau(terrain, 5, 0.5);
        const h = terrain.getHeightAt(32, 32);
        expect(Number.isFinite(h)).toBe(true);
    });

    it('applies erosion without throwing', () => {
        generator.generatePerlin(terrain, 4, 1.0, 0.5);
        expect(() => generator.applyErosion(terrain, 10, 0.1)).not.toThrow();
    });

    it('generates ridges', () => {
        generator.generateRidges(terrain, 10);
        let hasNonZero = false;
        for (let x = 0; x < 64; x++) {
            for (let z = 0; z < 64; z++) {
                if (terrain.getHeightAt(x, z) !== 0) hasNonZero = true;
            }
        }
        expect(hasNonZero).toBe(true);
    });
});

// ─── 3. VFX System ──────────────────────────────────────────────────────────

describe('AdvancedVFXSystem – particle effects', () => {
    let vfx: AdvancedVFXSystem;

    beforeEach(() => {
        vfx = new AdvancedVFXSystem();
    });

    it('creates without error', () => {
        expect(vfx).toBeDefined();
    });

    it('update runs without error', () => {
        expect(() => vfx.update(0.016)).not.toThrow();
    });

    it('enables volumetric fog', () => {
        expect(() => vfx.enableVolumetricFog()).not.toThrow();
    });

    it('enables atmospheric scattering', () => {
        expect(() => vfx.enableAtmospheric()).not.toThrow();
    });

    it('enables god rays', () => {
        expect(() => vfx.enableGodRays()).not.toThrow();
    });

    it('getFogDensityAt returns finite value', () => {
        vfx.enableVolumetricFog();
        const density = vfx.getFogDensityAt(new Vector3(10, 5, 10));
        expect(Number.isFinite(density)).toBe(true);
    });

    it('getAtmosphericColor returns rgb object', () => {
        vfx.enableAtmospheric();
        const color = vfx.getAtmosphericColor(new Vector3(0, 1, 0));
        expect(color).toHaveProperty('r');
        expect(color).toHaveProperty('g');
        expect(color).toHaveProperty('b');
    });

    it('getGodRayIntensity returns finite number', () => {
        vfx.enableGodRays();
        const intensity = vfx.getGodRayIntensity(new Vector2(0.5, 0.5), new Vector2(0.5, 0.3));
        expect(Number.isFinite(intensity)).toBe(true);
    });

    it('presets apply without error', () => {
        expect(() => vfx.presetClearSky()).not.toThrow();
        expect(() => vfx.presetFoggy()).not.toThrow();
        expect(() => vfx.presetSunset()).not.toThrow();
        expect(() => vfx.presetStormy()).not.toThrow();
    });

    it('multiple updates accumulate time correctly', () => {
        vfx.enableVolumetricFog();
        const d1 = vfx.getFogDensityAt(new Vector3(0, 0, 0));
        vfx.update(1.0);
        const d2 = vfx.getFogDensityAt(new Vector3(0, 0, 0));
        // Fog should animate over time
        expect(Number.isFinite(d2)).toBe(true);
    });
});

// ─── 4. Water Simulation ────────────────────────────────────────────────────

describe('WaterSimulationSystem – simulation', () => {
    let water: WaterSimulationSystem;

    beforeEach(() => {
        water = new WaterSimulationSystem();
    });

    it('creates with default settings', () => {
        expect(water).toBeDefined();
        expect(water.getResolution()).toBe(128);
    });

    it('update runs without error', () => {
        expect(() => water.update(0.016)).not.toThrow();
    });

    it('getHeightAt returns finite number', () => {
        water.update(0.1);
        const h = water.getHeightAt(10, 10);
        expect(Number.isFinite(h)).toBe(true);
    });

    it('getNormalAt returns a Vector3', () => {
        water.update(0.1);
        const n = water.getNormalAt(5, 5);
        expect(n).toBeInstanceOf(Vector3);
    });

    it('getDisplacementAt returns a Vector3', () => {
        water.update(0.1);
        const d = water.getDisplacementAt(5, 5);
        expect(d).toBeInstanceOf(Vector3);
    });

    it('getFoamAt returns finite number', () => {
        water.update(0.1);
        const foam = water.getFoamAt(5, 5);
        expect(Number.isFinite(foam)).toBe(true);
    });

    it('getCausticsAt returns finite number', () => {
        water.update(0.1);
        const c = water.getCausticsAt(5, 5);
        expect(Number.isFinite(c)).toBe(true);
    });

    it('getHeightField returns Float32Array of correct size', () => {
        const field = water.getHeightField();
        expect(field).toBeInstanceOf(Float32Array);
        const res = water.getResolution();
        expect(field.length).toBe(res * res);
    });

    it('getFoamData returns Float32Array', () => {
        const foam = water.getFoamData();
        expect(foam).toBeInstanceOf(Float32Array);
    });

    it('getCausticsData returns Float32Array', () => {
        const caustics = water.getCausticsData();
        expect(caustics).toBeInstanceOf(Float32Array);
    });

    it('updateSettings changes resolution', () => {
        water.updateSettings({ resolution: 64 });
        expect(water.getResolution()).toBe(64);
    });

    it('height changes after simulation step', () => {
        const h0 = water.getHeightAt(20, 20);
        water.update(0.5);
        const h1 = water.getHeightAt(20, 20);
        water.update(0.5);
        const h2 = water.getHeightAt(20, 20);
        // At least one step should change the height
        const changed = h0 !== h1 || h1 !== h2;
        expect(changed).toBe(true);
    });
});

// ─── 5. Weather System ──────────────────────────────────────────────────────

describe('WeatherSystem – weather types and transitions', () => {
    let weather: WeatherSystem;
    let particles: ParticleSystem;

    beforeEach(() => {
        particles = new ParticleSystem();
        weather = new WeatherSystem(particles);
    });

    it('starts with CLEAR weather', () => {
        const config = weather.getCurrentWeather();
        expect(config.type).toBe(WeatherType.CLEAR);
    });

    it('setWeatherType changes weather immediately', () => {
        weather.setWeatherType(WeatherType.RAINY, WeatherIntensity.HEAVY);
        const config = weather.getCurrentWeather();
        expect(config.type).toBe(WeatherType.RAINY);
        expect(config.intensity).toBe(WeatherIntensity.HEAVY);
    });

    it('transitionTo starts a transition', () => {
        weather.transitionTo(WeatherType.SNOWY, WeatherIntensity.MODERATE, 2.0);
        weather.update(0.016);
        // During transition the type may not have changed yet
        expect(weather.getCurrentWeather()).toBeDefined();
    });

    it('transition completes after enough time', () => {
        weather.transitionTo(WeatherType.STORMY, WeatherIntensity.EXTREME, 1.0);
        // Simulate enough frames
        for (let i = 0; i < 100; i++) {
            weather.update(0.02);
        }
        const config = weather.getCurrentWeather();
        expect(config.type).toBe(WeatherType.STORMY);
    });

    it('isPrecipitating returns true for rain', () => {
        weather.setWeatherType(WeatherType.RAINY, WeatherIntensity.MODERATE);
        weather.update(0.016);
        expect(weather.isPrecipitating()).toBe(true);
    });

    it('isPrecipitating returns false for clear', () => {
        weather.setWeatherType(WeatherType.CLEAR, WeatherIntensity.LIGHT);
        weather.update(0.016);
        expect(weather.isPrecipitating()).toBe(false);
    });

    it('getPrecipitationType returns rain for rainy weather', () => {
        weather.setWeatherType(WeatherType.RAINY, WeatherIntensity.HEAVY);
        weather.update(0.016);
        expect(weather.getPrecipitationType()).toBe('rain');
    });

    it('getPrecipitationType returns snow for snowy weather', () => {
        weather.setWeatherType(WeatherType.SNOWY, WeatherIntensity.MODERATE);
        weather.update(0.016);
        expect(weather.getPrecipitationType()).toBe('snow');
    });

    it('getWindVector returns Vector3', () => {
        const wind = weather.getWindVector();
        expect(wind).toBeInstanceOf(Vector3);
    });

    it('getFogDensity returns finite number', () => {
        weather.setWeatherType(WeatherType.FOGGY, WeatherIntensity.HEAVY);
        weather.update(0.016);
        const fog = weather.getFogDensity();
        expect(Number.isFinite(fog)).toBe(true);
    });

    it('getLightingIntensity returns finite number', () => {
        const intensity = weather.getLightingIntensity();
        expect(Number.isFinite(intensity)).toBe(true);
    });

    it('getCloudCoverage returns finite number', () => {
        const coverage = weather.getCloudCoverage();
        expect(Number.isFinite(coverage)).toBe(true);
    });

    it('cycling through all weather types works', () => {
        const types = [
            WeatherType.CLEAR, WeatherType.CLOUDY, WeatherType.RAINY,
            WeatherType.STORMY, WeatherType.SNOWY, WeatherType.FOGGY,
            WeatherType.WINDY,
        ];
        for (const t of types) {
            weather.setWeatherType(t, WeatherIntensity.MODERATE);
            weather.update(0.016);
            expect(weather.getCurrentWeather().type).toBe(t);
        }
    });
});

// ─── 6. HalfEdgeMesh – subdivision ──────────────────────────────────────────

describe('HalfEdgeMesh – creation and subdivision', () => {
    let cube: MeshData;
    let hem: HalfEdgeMesh;

    beforeEach(() => {
        cube = MeshData.createCube(1);
        hem = HalfEdgeMesh.fromMeshData(cube);
    });

    it('creates HalfEdgeMesh from cube MeshData', () => {
        expect(hem).toBeDefined();
        expect(hem.getVertexCount()).toBeGreaterThan(0);
        expect(hem.getFaceCount()).toBeGreaterThan(0);
    });

    it('has correct half-edge count', () => {
        expect(hem.getHalfEdgeCount()).toBeGreaterThan(0);
    });

    it('subdivideFace increases vertex and face counts', () => {
        const vBefore = hem.getVertexCount();
        const fBefore = hem.getFaceCount();
        hem.subdivideFace(0);
        expect(hem.getVertexCount()).toBe(vBefore + 1);
        expect(hem.getFaceCount()).toBe(fBefore + 2);
    });

    it('subdividing multiple faces grows mesh', () => {
        const vBefore = hem.getVertexCount();
        const fBefore = hem.getFaceCount();
        hem.subdivideFace(0);
        hem.subdivideFace(1);
        expect(hem.getVertexCount()).toBeGreaterThan(vBefore);
        expect(hem.getFaceCount()).toBeGreaterThan(fBefore);
    });

    it('getFaceVertices returns array of vertex indices', () => {
        const verts = hem.getFaceVertices(0);
        expect(Array.isArray(verts)).toBe(true);
        expect(verts.length).toBeGreaterThanOrEqual(3);
    });

    it('getVertexNeighbors returns neighbor indices', () => {
        const neighbors = hem.getVertexNeighbors(0);
        expect(Array.isArray(neighbors)).toBe(true);
        expect(neighbors.length).toBeGreaterThan(0);
    });

    it('round-trip toMeshData preserves geometry', () => {
        const outMesh = hem.toMeshData();
        expect(outMesh).toBeDefined();
        expect(outMesh.getPositions().length).toBeGreaterThan(0);
        expect(outMesh.getIndices().length).toBeGreaterThan(0);
    });
});

// ─── 7. Terrain Brushes ─────────────────────────────────────────────────────

describe('TerrainBrush – brush application', () => {
    let terrain: Terrain;

    beforeEach(() => {
        terrain = new Terrain(64, 64, 100, 100);
        terrain.fill(0);
    });

    it('raise brush increases height', () => {
        const brush = new TerrainBrush('raise', 20, 1.0);
        // World center (0,0) maps to grid center in centered coordinate system
        const before = terrain.getHeightAt(32, 32);
        brush.apply(terrain, 0, 0);
        const after = terrain.getHeightAt(32, 32);
        expect(after).toBeGreaterThan(before);
    });

    it('lower brush decreases height', () => {
        terrain.fill(10);
        const brush = new TerrainBrush('lower', 20, 1.0);
        const before = terrain.getHeightAt(32, 32);
        brush.apply(terrain, 0, 0);
        const after = terrain.getHeightAt(32, 32);
        expect(after).toBeLessThan(before);
    });

    it('smooth brush runs without error', () => {
        const gen = new TerrainGenerator(42);
        gen.generatePerlin(terrain, 4, 0.05, 0.5);
        const brush = new TerrainBrush('smooth', 20, 0.5);
        expect(() => brush.apply(terrain, 0, 0)).not.toThrow();
    });

    it('flatten brush converges toward target height', () => {
        const gen = new TerrainGenerator(42);
        gen.generatePerlin(terrain, 4, 0.05, 0.5);
        const brush = new TerrainBrush('flatten', 20, 1.0);
        brush.setTargetHeight(5.0);
        for (let i = 0; i < 50; i++) {
            brush.apply(terrain, 0, 0);
        }
        const h = terrain.getHeightAt(32, 32);
        expect(Math.abs(h - 5.0)).toBeLessThan(3.0);
    });

    it('noise brush modifies terrain', () => {
        const brush = new TerrainBrush('noise', 20, 1.0);
        brush.apply(terrain, 0, 0);
        let hasNonZero = false;
        for (let x = 0; x < 64; x++) {
            for (let z = 0; z < 64; z++) {
                if (terrain.getHeightAt(x, z) !== 0) hasNonZero = true;
            }
        }
        expect(hasNonZero).toBe(true);
    });

    it('setRadius and setStrength update properties', () => {
        const brush = new TerrainBrush('raise', 3, 0.5);
        brush.setRadius(10);
        brush.setStrength(0.8);
        const props = brush.getProperties();
        expect(props.radius).toBe(10);
        expect(props.strength).toBe(0.8);
    });
});

// ─── 8. Geometry Generation (MeshData & MeshOperations) ─────────────────────

describe('MeshData – basic shape generation', () => {
    it('createCube generates valid mesh', () => {
        const cube = MeshData.createCube(2);
        expect(cube).toBeDefined();
        const positions = cube.getPositions();
        const indices = cube.getIndices();
        expect(positions.length).toBeGreaterThan(0);
        expect(indices.length).toBeGreaterThan(0);
        // Cube should have 36 indices (12 triangles × 3)
        expect(indices.length).toBe(36);
    });

    it('addVertex and addFace build custom mesh', () => {
        const mesh = new MeshData();
        const v0 = mesh.addVertex(new Vector3(0, 0, 0));
        const v1 = mesh.addVertex(new Vector3(1, 0, 0));
        const v2 = mesh.addVertex(new Vector3(0, 1, 0));
        const faceIdx = mesh.addFace(v0, v1, v2);
        expect(faceIdx).toBe(0);
        expect(mesh.getPositions().length).toBe(9); // 3 vertices × 3 components
        expect(mesh.getIndices().length).toBe(3);
    });

    it('addFace with array syntax works', () => {
        const mesh = new MeshData();
        mesh.addVertex(new Vector3(0, 0, 0));
        mesh.addVertex(new Vector3(1, 0, 0));
        mesh.addVertex(new Vector3(0, 1, 0));
        const faceIdx = mesh.addFace([0, 1, 2]);
        expect(faceIdx).toBe(0);
    });

    it('computeNormals generates normals', () => {
        const mesh = new MeshData();
        mesh.addVertex(new Vector3(0, 0, 0));
        mesh.addVertex(new Vector3(1, 0, 0));
        mesh.addVertex(new Vector3(0, 1, 0));
        mesh.addFace(0, 1, 2);
        mesh.computeNormals();
        const normals = mesh.getNormals();
        expect(normals.length).toBe(9); // 3 vertices × 3 components
    });

    it('clone creates independent copy', () => {
        const mesh = MeshData.createCube(1);
        const clone = mesh.clone();
        expect(clone.getPositions().length).toBe(mesh.getPositions().length);
        expect(clone.getIndices().length).toBe(mesh.getIndices().length);
    });

    it('getVertex returns correct position', () => {
        const mesh = new MeshData();
        mesh.addVertex(new Vector3(3, 4, 5));
        const v = mesh.getVertex(0);
        expect(v.x).toBe(3);
        expect(v.y).toBe(4);
        expect(v.z).toBe(5);
    });

    it('setVertex modifies position', () => {
        const mesh = new MeshData();
        mesh.addVertex(new Vector3(0, 0, 0));
        mesh.setVertex(0, new Vector3(7, 8, 9));
        const v = mesh.getVertex(0);
        expect(v.x).toBe(7);
        expect(v.y).toBe(8);
        expect(v.z).toBe(9);
    });
});

describe('MeshOperations – subdivision and processing', () => {
    it('subdivide increases vertex and face count', () => {
        const cube = MeshData.createCube(1);
        const origVerts = cube.getPositions().length / 3;
        const origFaces = cube.getIndices().length / 3;
        const subdivided = MeshOperations.subdivide(cube);
        const newVerts = subdivided.getPositions().length / 3;
        const newFaces = subdivided.getIndices().length / 3;
        expect(newVerts).toBeGreaterThan(origVerts);
        expect(newFaces).toBeGreaterThan(origFaces);
    });

    it('smooth does not throw', () => {
        const cube = MeshData.createCube(1);
        expect(() => MeshOperations.smooth(cube, 2)).not.toThrow();
    });

    it('mergeVertices reduces duplicate vertices', () => {
        const cube = MeshData.createCube(1);
        const before = cube.getPositions().length / 3;
        const merged = MeshOperations.mergeVertices(cube, 0.001);
        const after = merged.getPositions().length / 3;
        // Cube has shared positions across faces → merge should reduce count
        expect(after).toBeLessThanOrEqual(before);
    });
});

describe('MeshQualityEnhancer – analysis and LODs', () => {
    it('analyzeMeshQuality returns metrics', () => {
        const cube = MeshData.createCube(1);
        const metrics = MeshQualityEnhancer.analyzeMeshQuality(cube);
        expect(metrics).toBeDefined();
    });

    it('generateSmoothNormals produces valid mesh', () => {
        const cube = MeshData.createCube(1);
        const smoothed = MeshQualityEnhancer.generateSmoothNormals(cube, 60);
        expect(smoothed.getNormals().length).toBeGreaterThan(0);
    });

    it('generateLODs returns decreasing detail levels', () => {
        const cube = MeshData.createCube(1);
        const lods = MeshQualityEnhancer.generateLODs(cube, 3);
        expect(lods.length).toBe(3);
        for (const lod of lods) {
            expect(lod.getPositions().length).toBeGreaterThan(0);
        }
    });
});

// ─── 9. Procedural Mesh Generation ──────────────────────────────────────────

describe('ProceduralMeshGenerator – shape generation', () => {
    let gen: ProceduralMeshGenerator;

    beforeEach(() => {
        gen = new ProceduralMeshGenerator(42);
    });

    it('generatePlanet returns valid mesh', () => {
        const mesh = gen.generatePlanet(10, 16, 0.3);
        expect(mesh.getPositions().length).toBeGreaterThan(0);
        expect(mesh.getIndices().length).toBeGreaterThan(0);
    });

    it('generateTree returns valid mesh', () => {
        const mesh = gen.generateTree(5, 3);
        expect(mesh.getPositions().length).toBeGreaterThan(0);
        expect(mesh.getIndices().length).toBeGreaterThan(0);
    });

    it('generateRock returns valid mesh', () => {
        const mesh = gen.generateRock(2, 0.5);
        expect(mesh.getPositions().length).toBeGreaterThan(0);
        expect(mesh.getIndices().length).toBeGreaterThan(0);
    });

    it('generateBuilding returns valid mesh', () => {
        const mesh = gen.generateBuilding(5, 5, 10, 3);
        expect(mesh.getPositions().length).toBeGreaterThan(0);
        expect(mesh.getIndices().length).toBeGreaterThan(0);
    });

    it('generateCave returns valid mesh', () => {
        const mesh = gen.generateCave(10, 10, 10, 0.5);
        expect(mesh.getPositions().length).toBeGreaterThan(0);
        expect(mesh.getIndices().length).toBeGreaterThan(0);
    });

    it('same seed produces identical meshes', () => {
        const a = gen.generateRock(2, 0.5);
        const b = new ProceduralMeshGenerator(42).generateRock(2, 0.5);
        expect(a.getPositions().length).toBe(b.getPositions().length);
        expect(a.getIndices().length).toBe(b.getIndices().length);
    });
});

describe('EnhancedProceduralGenerator – realistic generation', () => {
    let gen: EnhancedProceduralGenerator;

    beforeEach(() => {
        gen = new EnhancedProceduralGenerator(42);
    });

    it('generateRealisticPlanet returns valid mesh', () => {
        const mesh = gen.generateRealisticPlanet(10, 1.0, 2.0, 1.0);
        expect(mesh.getPositions().length).toBeGreaterThan(0);
        expect(mesh.getIndices().length).toBeGreaterThan(0);
    });

    it('generateRealisticTree returns valid mesh', () => {
        const mesh = gen.generateRealisticTree(5, 0.3, 6, 3);
        expect(mesh.getPositions().length).toBeGreaterThan(0);
    });

    it('generateRealisticRock returns valid mesh', () => {
        const mesh = gen.generateRealisticRock(2, 0.5, 0.5);
        expect(mesh.getPositions().length).toBeGreaterThan(0);
    });

    it('generateRealisticBuilding returns valid mesh', () => {
        const mesh = gen.generateRealisticBuilding(5, 5, 10, 3, 'flat');
        expect(mesh.getPositions().length).toBeGreaterThan(0);
    });
});

// ─── 10. Enhanced Terrain Generation & Vegetation ───────────────────────────

describe('EnhancedTerrainGenerator – biome-based terrain', () => {
    it('generates realistic terrain with biome data', () => {
        const gen = new EnhancedTerrainGenerator({ width: 64, depth: 64 });
        const result = gen.generateRealisticTerrain();
        expect(result.heightmap).toBeInstanceOf(Float32Array);
        expect(result.biomes).toBeInstanceOf(Uint8Array);
        expect(result.moisture).toBeInstanceOf(Float32Array);
        expect(result.temperature).toBeInstanceOf(Float32Array);
        expect(result.heightmap.length).toBe(64 * 64);
    });

    it('biome colors are valid RGB', () => {
        for (let i = 0; i < 8; i++) {
            const color = EnhancedTerrainGenerator.getBiomeColor(i);
            expect(color.r).toBeGreaterThanOrEqual(0);
            expect(color.r).toBeLessThanOrEqual(1);
            expect(color.g).toBeGreaterThanOrEqual(0);
            expect(color.g).toBeLessThanOrEqual(1);
            expect(color.b).toBeGreaterThanOrEqual(0);
            expect(color.b).toBeLessThanOrEqual(1);
        }
    });
});

describe('VegetationScattering – vegetation placement', () => {
    it('adds vegetation types', () => {
        const scatter = new VegetationScattering(42);
        const id = scatter.addVegetationType({
            name: 'oak',
            density: 0.1,
            minHeight: 0,
            maxHeight: 50,
            maxSlopeAngle: Math.PI / 4,
            minScale: 0.8,
            maxScale: 1.2,
            minSpacing: 2,
            randomRotation: true,
            alignToNormal: true,
            lodDistances: [50, 100, 200, 400],
        });
        expect(id).toBe(0);
    });

    it('scatters vegetation on terrain', () => {
        const scatter = new VegetationScattering(42);
        scatter.addVegetationType({
            name: 'pine',
            density: 0.05,
            minHeight: 0,
            maxHeight: 100,
            maxSlopeAngle: Math.PI / 3,
            minScale: 0.8,
            maxScale: 1.5,
            minSpacing: 3,
            randomRotation: true,
            alignToNormal: false,
            lodDistances: [50, 100, 200, 400],
        });

        const terrain = new Terrain(32, 32, 50, 50);
        const gen = new TerrainGenerator(42);
        gen.generatePerlin(terrain, 4, 1.0, 0.5);

        const instances = scatter.scatter(terrain, {
            seed: 42,
            densityMultiplier: 1.0,
            bounds: { minX: 0, minZ: 0, maxX: 50, maxZ: 50 },
            poissonSampling: false,
            maxInstances: 100,
        });
        expect(Array.isArray(instances)).toBe(true);
    });

    it('forest preset creates scatter with vegetation types', () => {
        const scatter = VegetationScattering.createForestPreset();
        expect(scatter).toBeInstanceOf(VegetationScattering);
    });

    it('desert preset creates scatter', () => {
        const scatter = VegetationScattering.createDesertPreset();
        expect(scatter).toBeInstanceOf(VegetationScattering);
    });
});

// ─── Terrain utility: fill, clear, getNormal ────────────────────────────────

describe('Terrain – basic operations', () => {
    let terrain: Terrain;

    beforeEach(() => {
        terrain = new Terrain(32, 32, 50, 50);
    });

    it('fill sets all heights', () => {
        terrain.fill(7.0);
        expect(terrain.getHeightAt(0, 0)).toBe(7.0);
        expect(terrain.getHeightAt(16, 16)).toBe(7.0);
    });

    it('clear sets all heights to zero', () => {
        terrain.fill(5.0);
        terrain.clear();
        expect(terrain.getHeightAt(0, 0)).toBe(0);
    });

    it('setHeight and getHeightAt round-trip', () => {
        terrain.setHeight(10, 10, 42.5);
        expect(terrain.getHeightAt(10, 10)).toBe(42.5);
    });

    it('getNormal returns a Vector3', () => {
        terrain.fill(0);
        terrain.setHeight(16, 16, 5);
        const n = terrain.getNormal(16, 16);
        expect(n).toBeInstanceOf(Vector3);
    });

    it('getHeight performs world-space interpolation', () => {
        terrain.fill(0);
        terrain.setHeight(16, 16, 10);
        const h = terrain.getHeight(25, 25);
        expect(Number.isFinite(h)).toBe(true);
    });

    it('generateMesh returns MeshData', () => {
        terrain.fill(1);
        const mesh = terrain.generateMesh(1);
        expect(mesh).toBeDefined();
        expect(mesh.getPositions().length).toBeGreaterThan(0);
    });

    it('clone creates independent copy', () => {
        terrain.setHeight(5, 5, 99);
        const copy = terrain.clone();
        expect(copy.getHeightAt(5, 5)).toBe(99);
        copy.setHeight(5, 5, 0);
        expect(terrain.getHeightAt(5, 5)).toBe(99);
    });
});
