# 🚀 Getting Started with WebForge

Welcome to WebForge! This guide will help you create your first game in minutes.

## 📦 Installation

### Option 1: NPM (Recommended)

```bash
npm install @webforge/platform
```

### Option 2: CDN

```html
<script type="module">
  import { WebForge } from 'https://unpkg.com/@webforge/platform';
  // Your code here
</script>
```

### Option 3: Download

Download the latest release from GitHub and include it in your project.

## 🎯 Hello World

Create a spinning cube in under 20 lines:

```typescript
import { WebForge } from '@webforge/platform';

// Create engine
const engine = new WebForge('#canvas', {
    quality: 'high'
});

// Initialize
await engine.initialize();

// Create scene
const scene = engine.createScene();

// Add cube
const cube = scene.createMesh('cube');
cube.position.set(0, 0, 0);

// Add light
const light = scene.createDirectionalLight();
light.intensity = 1.0;

// Animate
engine.start();
scene.onUpdate = (dt) => {
    cube.rotation.y += dt;
};
```

## 📖 Basic Concepts

### Engine

The main entry point. Manages all subsystems and the render loop.

```typescript
const engine = new WebForge('#canvas', {
    quality: 'high',      // low, medium, high, ultra, auto
    physics: true,        // Enable physics simulation
    audio: true,          // Enable audio system
    particles: true,      // Enable particle effects
    animations: true,     // Enable animation system
    debug: false,         // Enable debug mode
    targetFPS: 60        // Target frame rate
});

await engine.initialize();
engine.start();
```

### Scene

Container for all game objects.

```typescript
const scene = engine.createScene('MainScene');

// Add objects
const mesh = scene.createMesh('cube');
const light = scene.createLight('point');
const camera = scene.createCamera();

// Scene update callback
scene.onUpdate = (deltaTime) => {
    // Update logic here
};
```

### Objects

Everything in the scene is an object.

```typescript
// Create mesh
const cube = scene.createMesh('cube');
cube.position.set(0, 1, 0);
cube.rotation.set(0, 0, 0);
cube.scale.set(1, 1, 1);

// Set material
cube.material = {
    color: { r: 1, g: 0, b: 0 },
    metallic: 0.5,
    roughness: 0.5
};
```

### Camera

Controls the viewpoint.

```typescript
const camera = scene.createCamera();
camera.position.set(0, 5, 10);
camera.lookAt(0, 0, 0);
camera.fov = 75;
camera.near = 0.1;
camera.far = 1000;
```

### Lighting

Illuminates the scene.

```typescript
// Directional light (sun)
const sun = scene.createDirectionalLight();
sun.intensity = 1.0;
sun.direction.set(-1, -1, -1);

// Point light (bulb)
const bulb = scene.createPointLight();
bulb.position.set(0, 2, 0);
bulb.range = 10;

// Spot light (flashlight)
const spot = scene.createSpotLight();
spot.angle = 45;
```

## 🎮 Complete Examples

### 1. Physics Playground

```typescript
import { WebForge } from '@webforge/platform';

const engine = new WebForge({ physics: true });
await engine.initialize();

const scene = engine.createScene();

// Ground
const ground = scene.createMesh('plane');
ground.scale.set(10, 1, 10);
engine.physics.addRigidBody(ground, { type: 'static' });

// Falling cubes
for (let i = 0; i < 10; i++) {
    const cube = scene.createMesh('cube');
    cube.position.set(
        Math.random() * 4 - 2,
        5 + i * 2,
        Math.random() * 4 - 2
    );
    engine.physics.addRigidBody(cube, {
        type: 'dynamic',
        mass: 1.0
    });
}

engine.start();
```

### 2. Character Controller

```typescript
const engine = new WebForge({ physics: true });
await engine.initialize();

const scene = engine.createScene();
const camera = scene.createCamera();

// Character
const character = scene.createMesh('capsule');
character.position.set(0, 1, 0);

// Input handling
scene.onUpdate = (dt) => {
    const speed = 5.0;
    
    if (engine.input.isKeyPressed('KeyW')) {
        character.position.z -= speed * dt;
    }
    if (engine.input.isKeyPressed('KeyS')) {
        character.position.z += speed * dt;
    }
    if (engine.input.isKeyPressed('KeyA')) {
        character.position.x -= speed * dt;
    }
    if (engine.input.isKeyPressed('KeyD')) {
        character.position.x += speed * dt;
    }
    
    // Camera follows character
    camera.position.set(
        character.position.x,
        character.position.y + 5,
        character.position.z + 10
    );
    camera.lookAt(character.position);
};

engine.start();
```

### 3. Particle Effects

```typescript
const engine = new WebForge({ particles: true });
await engine.initialize();

const scene = engine.createScene();

// Create particle emitter
const particles = engine.particles.createEmitter({
    position: { x: 0, y: 0, z: 0 },
    rate: 100,                    // Particles per second
    lifetime: 2.0,                // Seconds
    startSize: 0.1,
    endSize: 0.5,
    startColor: { r: 1, g: 0.5, b: 0, a: 1 },
    endColor: { r: 1, g: 0, b: 0, a: 0 },
    velocity: { x: 0, y: 2, z: 0 },
    velocityVariance: 1.0
});

engine.start();
```

### 4. Audio System

```typescript
const engine = new WebForge({ audio: true });
await engine.initialize();

// Background music
await engine.audio.loadSound('music', 'assets/music.mp3');
engine.audio.playSound('music', { loop: true, volume: 0.5 });

// 3D positioned sound
const audioSource = scene.createAudioSource();
audioSource.position.set(5, 0, 0);
audioSource.load('assets/ambient.mp3');
audioSource.play({ loop: true });

// Sound effects
await engine.audio.loadSound('explosion', 'assets/explosion.mp3');
engine.audio.playSound('explosion', { volume: 1.0 });
```

### 5. Asset Loading

```typescript
const engine = new WebForge();
await engine.initialize();

// Load 3D model
const model = await engine.assets.loadModel('assets/character.gltf');
scene.add(model);

// Load texture
const texture = await engine.assets.loadTexture('assets/diffuse.png');
mesh.material.albedoMap = texture;

// Load multiple assets
await engine.assets.loadBatch([
    { type: 'model', url: 'assets/level.gltf' },
    { type: 'texture', url: 'assets/skybox.png' },
    { type: 'audio', url: 'assets/music.mp3' }
], (progress) => {
    console.log(`Loading: ${progress * 100}%`);
});
```

## 🎨 Materials and Shaders

```typescript
// PBR Material
mesh.material = {
    albedo: { r: 1, g: 1, b: 1 },
    metallic: 0.0,
    roughness: 0.5,
    emissive: { r: 0, g: 0, b: 0 },
    albedoMap: texture,
    normalMap: normalTexture,
    metallicMap: metallicTexture,
    roughnessMap: roughnessTexture
};

// Custom shader
const customMaterial = engine.renderer.createMaterial({
    vertexShader: `...`,
    fragmentShader: `...`,
    uniforms: {
        time: 0.0,
        color: { r: 1, g: 0, b: 0 }
    }
});
```

## 🚀 Building for Production

### Development

```bash
npm run dev
```

### Production Build

```bash
npm run build
```

This creates an optimized build in `dist/`:

```
dist/
├── index.html
├── assets/
│   ├── models/
│   ├── textures/
│   └── audio/
└── webforge.min.js
```

### Export to Multiple Platforms

```typescript
import { MultiPlatformExport, Platform } from '@webforge/platform';

const exporter = new MultiPlatformExport({
    platform: Platform.PWA,
    appName: 'MyGame',
    version: '1.0.0',
    outputDir: './dist'
});

await exporter.export();
```

Supports:
- 🌐 **Web** - Static files or PWA
- 💻 **Desktop** - Windows, macOS, Linux (Electron)
- 📱 **Mobile** - iOS, Android (Capacitor)

## 📚 Next Steps

- **[API Reference](./docs/API_REFERENCE.md)** - Complete API documentation
- **[Examples](./examples/)** - More complete examples
- **[COMPLETE_REFERENCE.md](./COMPLETE_REFERENCE.md)** - In-depth feature guide
- **[ARCHITECTURE_DESIGN.md](./ARCHITECTURE_DESIGN.md)** - System architecture

## 🐛 Troubleshooting

### Canvas not found

```typescript
// Create canvas automatically
const engine = new WebForge(); // Creates canvas in body

// Or specify canvas
const engine = new WebForge('#myCanvas');

// Or pass element directly
const canvas = document.getElementById('myCanvas');
const engine = new WebForge(canvas);
```

### Poor performance

```typescript
// Use lower quality preset
const engine = new WebForge({ quality: 'medium' });

// Disable features you don't need
const engine = new WebForge({
    physics: false,
    particles: false,
    shadows: false
});

// Use LOD system
mesh.generateLOD([0.75, 0.5, 0.25]);
```

### Audio not playing

```typescript
// Initialize audio on user interaction
document.addEventListener('click', async () => {
    await engine.audio.initialize();
}, { once: true });
```

## 💡 Tips

1. **Always call `initialize()`** before `start()`
2. **Use `await`** for async operations (loading assets, audio init)
3. **Enable debug mode** during development: `{ debug: true }`
4. **Use quality presets** for different devices
5. **Profile your game** with built-in profilers

## 🎉 You're Ready!

Start building amazing games with WebForge!

Need help? Check the [examples](./examples/) or read the [complete reference](./COMPLETE_REFERENCE.md).

Happy coding! 🚀
