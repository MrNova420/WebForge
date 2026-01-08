# High-Quality Asset Generation Guide

This guide demonstrates how to use WebForge's enhanced production-quality systems for creating realistic, professional-grade 3D assets.

## Enhanced Procedural Generation

### Realistic Planet Generation

```typescript
import { EnhancedProceduralGenerator } from './procedural';

// Create generator with high quality settings
const generator = new EnhancedProceduralGenerator(12345, {
    detailLevel: 'high',  // 'low' | 'medium' | 'high' | 'ultra'
    generateUVs: true,
    smoothNormals: true,
    optimizeGeometry: true
});

// Generate realistic planet with continents and mountains
const planet = generator.generateRealisticPlanet(
    10,    // radius
    0.3,   // continental scale (land mass size)
    0.15,  // mountain height
    0.05   // ocean depth
);

// Result: Production-ready planet mesh with:
// - Multi-octave terrain (continental plates + mountains + detail)
// - Proper spherical UV mapping
// - Smooth normals for realistic lighting
// - Natural terrain distribution
```

### Realistic Tree Generation

```typescript
// Generate organic tree with natural branching
const tree = generator.generateRealisticTree(
    5.0,  // trunk height
    0.3,  // trunk radius
    8,    // branch count
    2.0   // foliage radius
);

// Features:
// - Trunk taper and organic curve
// - Bark texture variation using noise
// - Natural branch angles (upward 60-90°)
// - Organic foliage sphere with variation
// - Full UV mapping for texturing
```

### Realistic Rock Generation

```typescript
// Generate natural rock formation
const rock = generator.generateRealisticRock(
    2.0,  // base size
    0.3,  // roughness (0-1)
    0.5   // angularity (0-1, sharp vs smooth)
);

// Features:
// - Multi-scale noise (large features + medium + fine detail)
// - Natural rock shape with realistic surface
// - Triplanar UV mapping (perfect for rocks)
// - Configurable roughness and sharpness
```

### Realistic Building Generation

```typescript
// Generate architectural building
const building = generator.generateRealisticBuilding(
    10,        // width
    8,         // depth
    15,        // height
    5,         // number of floors
    'pitched'  // roof type: 'flat' | 'pitched' | 'dome'
);

// Features:
// - Proper wall geometry with floors
// - UV mapping for wall textures
// - Multiple roof types
// - Ready for texture application
```

## Enhanced Terrain Generation

### Generate Realistic Terrain with Erosion

```typescript
import { EnhancedTerrainGenerator } from './terrain';

// Create terrain generator with parameters
const terrainGen = new EnhancedTerrainGenerator({
    seed: 42,
    width: 256,
    depth: 256,
    heightScale: 100,
    waterLevel: 0.3,
    erosionIterations: 50,
    generateBiomes: true,
    hydraulicErosion: true,
    thermalErosion: true
});

// Generate complete terrain system
const result = terrainGen.generateRealisticTerrain();

// Returns:
// - heightmap: Float32Array with realistic height values
// - biomes: Uint8Array with biome IDs (0-7)
// - moisture: Float32Array with moisture values (0-1)
// - temperature: Float32Array with temperature values (0-1)
```

### Understanding Biomes

```typescript
// Biome types (0-7):
// 0 = Ocean (deep water)
// 1 = Beach (shallow water edge)
// 2 = Plains (flat grassland)
// 3 = Forest (trees)
// 4 = Desert (dry, sandy)
// 5 = Tundra (cold, sparse)
// 6 = Mountain (rocky, high altitude)
// 7 = Snow Peak (highest peaks)

// Get biome color for visualization
const biomeIndex = result.biomes[z * 256 + x];
const color = EnhancedTerrainGenerator.getBiomeColor(biomeIndex);
// Returns: { r, g, b } values 0-1
```

### Erosion Features

**Hydraulic Erosion** simulates realistic water flow:
- Water accumulation and flow downhill
- Sediment pickup and transport
- Deposition in flat areas
- Creates river valleys and natural drainage

**Thermal Erosion** simulates weathering:
- Material sliding down steep slopes
- Maintains stable talus angles
- Smooths sharp peaks naturally
- Creates realistic rock formations

## Mesh Quality Enhancement

### Analyze Mesh Quality

```typescript
import { MeshQualityEnhancer } from './geometry';

// Analyze existing mesh
const metrics = MeshQualityEnhancer.analyzeMeshQuality(mesh);

console.log(`Vertices: ${metrics.vertexCount}`);
console.log(`Faces: ${metrics.faceCount}`);
console.log(`Has UVs: ${metrics.hasUVs}`);
console.log(`Has Normals: ${metrics.hasNormals}`);
console.log(`Avg Triangle Quality: ${metrics.averageTriangleQuality.toFixed(2)}`);
console.log(`Degenerate Triangles: ${metrics.degenerateTriangles}`);
```

### Generate Smooth Normals

```typescript
// Generate area-weighted smooth normals
const smoothed = MeshQualityEnhancer.generateSmoothNormals(
    mesh,
    60  // angle threshold in degrees (hard edge detection)
);

// Features:
// - Area-weighted for better results
// - Preserves hard edges above threshold
// - Professional lighting quality
```

### Auto-Generate UVs

```typescript
// Automatic UV mapping with different projection methods

// Box projection (good for buildings, cubes)
const boxUV = MeshQualityEnhancer.generateAutoUVs(mesh, 'box');

// Cylinder projection (good for trees, columns)
const cylinderUV = MeshQualityEnhancer.generateAutoUVs(mesh, 'cylinder');

// Sphere projection (good for planets, balls)
const sphereUV = MeshQualityEnhancer.generateAutoUVs(mesh, 'sphere');

// Planar projection (good for flat terrain)
const planarUV = MeshQualityEnhancer.generateAutoUVs(mesh, 'planar');
```

### Generate LOD Levels

```typescript
// Generate 4 LOD levels automatically
const lods = MeshQualityEnhancer.generateLODs(mesh, 4);

// lods[0] = 100% detail (original)
// lods[1] = 75% detail
// lods[2] = 50% detail
// lods[3] = 25% detail

// Use in game:
// - Close: LOD 0 (full detail)
// - Medium: LOD 1 (75%)
// - Far: LOD 2 (50%)
// - Very Far: LOD 3 (25%)
```

### Optimize Mesh for Production

```typescript
// Complete optimization pipeline
const optimized = MeshQualityEnhancer.optimizeForRendering(mesh);

// Performs:
// 1. Remove degenerate triangles (bad geometry)
// 2. Weld nearby vertices (eliminate duplicates)
// 3. Generate smooth normals
// 4. Ensure UVs exist (auto-generate if missing)

// Result: Production-ready mesh
```

## Complete Workflow Example

```typescript
import { EnhancedProceduralGenerator, MeshQualityEnhancer } from './webforge';

// 1. Create generator
const generator = new EnhancedProceduralGenerator(42, {
    detailLevel: 'high',
    generateUVs: true,
    smoothNormals: true,
    optimizeGeometry: true
});

// 2. Generate high-quality asset
const tree = generator.generateRealisticTree(5, 0.3, 8, 2);

// 3. Further optimization (optional, already optimized by generator)
const optimized = MeshQualityEnhancer.optimizeForRendering(tree);

// 4. Generate LODs for performance
const treeLODs = MeshQualityEnhancer.generateLODs(optimized, 4);

// 5. Use in game
// - treeLODs[0] for close view
// - treeLODs[1] for medium distance
// - treeLODs[2] for far distance
// - treeLODs[3] for very far distance

// Result: Professional game-ready asset with:
// - Realistic appearance
// - Proper UVs for texturing
// - Smooth normals for lighting
// - Multiple LODs for performance
// - Optimized geometry
```

## Quality Settings Impact

### Low Quality (Fast)
- 16 segments
- Quick generation
- Good for prototyping
- ~1,000 triangles

### Medium Quality (Balanced)
- 32 segments
- Balanced detail/speed
- Good for most games
- ~4,000 triangles

### High Quality (Detailed)
- 64 segments
- High detail
- Good for close-ups
- ~16,000 triangles

### Ultra Quality (Maximum)
- 128 segments
- Maximum detail
- Good for hero assets
- ~64,000 triangles

## Performance Tips

1. **Use LODs** - Generate multiple detail levels for different distances
2. **Optimize geometry** - Run optimizer to remove duplicates and bad triangles
3. **Quality settings** - Use lower quality for background objects
4. **Batch generation** - Generate assets once, reuse many times
5. **Caching** - Store generated meshes to avoid regeneration

## Production Checklist

✅ Mesh has proper UVs  
✅ Normals are smooth and correct  
✅ No degenerate triangles  
✅ No duplicate vertices  
✅ Multiple LOD levels generated  
✅ Triangle quality > 0.5 average  
✅ Realistic appearance  
✅ Optimized for rendering  

All enhanced systems in WebForge ensure production-quality assets automatically!
