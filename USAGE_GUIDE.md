# 📘 WebForge Complete Usage Guide

**Your Complete Guide to Using WebForge - From First Install to Publishing Your Game**

---

## Table of Contents

1. [First-Time Setup](#first-time-setup)
2. [Understanding the Interface](#understanding-the-interface)
3. [Your First Project](#your-first-project)
4. [Working with Assets](#working-with-assets)
5. [Building and Testing](#building-and-testing)
6. [Using All Major Features](#using-all-major-features)
7. [Advanced Workflows](#advanced-workflows)
8. [Publishing Your Game](#publishing-your-game)
9. [Troubleshooting](#troubleshooting)
10. [Best Practices](#best-practices)

---

## 🚀 First-Time Setup

### Prerequisites

Before you start, ensure you have:
- **Node.js** version 16 or higher ([Download](https://nodejs.org/))
- **npm** (comes with Node.js)
- A modern web browser (Chrome, Firefox, Safari, or Edge)
- A text editor (VS Code recommended)

### Installation Steps

#### Option 1: Use NPM Package (Recommended for Beginners)

```bash
# Create a new project folder
mkdir my-webforge-game
cd my-webforge-game

# Install WebForge
npm install @webforge/platform

# Create an HTML file
echo '<!DOCTYPE html>
<html>
<head>
    <title>My WebForge Game</title>
</head>
<body>
    <canvas id="game-canvas"></canvas>
    <script type="module" src="game.js"></script>
</body>
</html>' > index.html

# Create your first game script
echo 'import { WebForge } from "@webforge/platform";

const engine = new WebForge("#game-canvas");
await engine.initialize();

const scene = engine.createScene();
const cube = scene.createMesh("cube");

engine.start();' > game.js

# Start development server
npx vite
```

#### Option 2: Clone from GitHub (For Contributors)

```bash
# Clone the repository
git clone https://github.com/MrNova420/WebForge.git
cd WebForge

# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Start development server
npm run dev

# Open your browser to http://localhost:5173
```

#### Option 3: CDN (Quick Prototyping)

Create a single HTML file:

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>WebForge Quick Start</title>
    <style>
        body { margin: 0; overflow: hidden; }
        canvas { display: block; width: 100%; height: 100vh; }
    </style>
</head>
<body>
    <canvas id="game"></canvas>
    <script type="module">
        import { WebForge } from 'https://unpkg.com/@webforge/platform';
        
        const engine = new WebForge('#game', { quality: 'high' });
        await engine.initialize();
        
        const scene = engine.createScene();
        
        // Add a cube
        const cube = scene.createMesh('cube');
        cube.position.set(0, 0, 0);
        
        // Add light
        const light = scene.createDirectionalLight();
        
        // Add camera
        const camera = scene.createCamera();
        camera.position.set(0, 2, 5);
        camera.lookAt(0, 0, 0);
        
        // Animate
        scene.onUpdate = (dt) => {
            cube.rotation.y += dt;
        };
        
        engine.start();
    </script>
</body>
</html>
```

### Verify Installation

Run this test to ensure everything works:

```bash
# Compile the project
npm run compile

# You should see: "Successfully compiled!"
# With zero errors
```

---

## 🎨 Understanding the Interface

### WebForge Editor Layout

When you open WebForge, you'll see these main panels:

```
┌─────────────────────────────────────────────────────┐
│  Menu Bar (File, Edit, View, Build, Help)          │
├──────────┬──────────────────────────┬───────────────┤
│          │                          │               │
│ Hierarchy│    Scene View (3D)       │  Inspector    │
│          │                          │               │
│ - Scene  │    [Your 3D World]       │  Properties   │
│   - Cube │                          │  - Position   │
│   - Light│    [Camera Controls]     │  - Rotation   │
│   - Cam  │                          │  - Scale      │
│          │                          │               │
├──────────┴──────────────────────────┴───────────────┤
│  Asset Browser (Models, Textures, Scripts)          │
│  [Thumbnails of all your assets]                    │
├──────────────────────────────────────────────────────┤
│  Console (Logs, Warnings, Errors)                   │
└──────────────────────────────────────────────────────┘
```

### Key Panels Explained

#### 1. **Hierarchy Panel** (Left)
- Shows all objects in your scene
- Drag objects to create parent-child relationships
- Right-click to add/delete objects
- Search bar at top for quick finding

#### 2. **Scene View** (Center)
- Your 3D world workspace
- **Left-click + drag**: Rotate camera
- **Middle-click + drag**: Pan camera
- **Scroll wheel**: Zoom in/out
- **Right-click**: Context menu
- **F key**: Focus on selected object
- **Q/W/E/R**: Gizmo tools (select/move/rotate/scale)

#### 3. **Inspector Panel** (Right)
- Shows properties of selected object
- Edit position, rotation, scale
- Modify materials and components
- Add/remove components

#### 4. **Asset Browser** (Bottom)
- All your project assets
- Import models, textures, audio
- Create new materials, scripts
- Organize with folders

#### 5. **Console** (Bottom)
- Displays messages, warnings, errors
- Click to view stack traces
- Filter by type

---

## 🎮 Your First Project

Let's create a simple game step-by-step!

### Project 1: Bouncing Ball

**Goal**: Create a ball that bounces on the ground with physics.

#### Step 1: Create the Scene

```typescript
import { WebForge } from '@webforge/platform';

// Initialize engine with physics enabled
const engine = new WebForge('#canvas', {
    physics: true,
    quality: 'high'
});

await engine.initialize();

// Create main scene
const scene = engine.createScene('BallGame');
```

#### Step 2: Add the Ground

```typescript
// Create ground plane
const ground = scene.createMesh('plane');
ground.scale.set(10, 1, 10);
ground.position.y = 0;

// Make ground a physics object (static)
engine.physics.addRigidBody(ground, {
    type: 'static',
    friction: 0.8,
    restitution: 0.3  // Bounciness
});

// Add material
ground.material = {
    color: { r: 0.2, g: 0.8, b: 0.2 },  // Green
    roughness: 0.9
};
```

#### Step 3: Add the Ball

```typescript
// Create sphere
const ball = scene.createMesh('sphere');
ball.position.set(0, 5, 0);  // Start 5 units high
ball.scale.set(0.5, 0.5, 0.5);  // Make it smaller

// Add physics (dynamic = affected by gravity)
engine.physics.addRigidBody(ball, {
    type: 'dynamic',
    mass: 1.0,
    friction: 0.5,
    restitution: 0.8  // Very bouncy!
});

// Red ball material
ball.material = {
    color: { r: 1, g: 0, b: 0 },
    metallic: 0.1,
    roughness: 0.3
};
```

#### Step 4: Add Lighting

```typescript
// Sun-like directional light
const sun = scene.createDirectionalLight();
sun.direction.set(-1, -2, -1);
sun.intensity = 1.0;

// Ambient light for overall brightness
const ambient = scene.createAmbientLight();
ambient.intensity = 0.3;
```

#### Step 5: Setup Camera

```typescript
const camera = scene.createCamera();
camera.position.set(5, 5, 10);
camera.lookAt(0, 1, 0);
```

#### Step 6: Add Interactivity

```typescript
// Click to add force to ball
canvas.addEventListener('click', () => {
    const force = { x: 0, y: 300, z: 0 };  // Upward force
    engine.physics.applyForce(ball, force);
});

// Spacebar to reset ball position
engine.input.onKeyPress('Space', () => {
    ball.position.set(0, 5, 0);
    engine.physics.setVelocity(ball, { x: 0, y: 0, z: 0 });
});
```

#### Step 7: Start the Game

```typescript
engine.start();

console.log('🎮 Ball game ready!');
console.log('Click to make ball jump');
console.log('Press SPACE to reset');
```

### Project 2: Character Movement

**Goal**: Control a character with keyboard (WASD).

```typescript
import { WebForge } from '@webforge/platform';

const engine = new WebForge({ physics: true });
await engine.initialize();

const scene = engine.createScene();

// Ground
const ground = scene.createMesh('plane');
ground.scale.set(20, 1, 20);
engine.physics.addRigidBody(ground, { type: 'static' });

// Player character
const player = scene.createMesh('capsule');
player.position.set(0, 1, 0);
player.scale.set(0.5, 1, 0.5);

// Player physics
const playerBody = engine.physics.addRigidBody(player, {
    type: 'dynamic',
    mass: 70,  // kg
    friction: 0.8,
    lockRotation: { x: true, z: true }  // Don't tip over
});

// Camera follows player
const camera = scene.createCamera();
camera.position.set(0, 5, 10);

// Movement speed
const speed = 5.0;

// Game loop
scene.onUpdate = (dt) => {
    // Get movement direction
    let moveX = 0;
    let moveZ = 0;
    
    if (engine.input.isKeyPressed('KeyW')) moveZ = -1;
    if (engine.input.isKeyPressed('KeyS')) moveZ = 1;
    if (engine.input.isKeyPressed('KeyA')) moveX = -1;
    if (engine.input.isKeyPressed('KeyD')) moveX = 1;
    
    // Normalize diagonal movement
    if (moveX !== 0 && moveZ !== 0) {
        moveX *= 0.707;  // 1/√2
        moveZ *= 0.707;
    }
    
    // Apply movement
    const velocity = engine.physics.getVelocity(player);
    velocity.x = moveX * speed;
    velocity.z = moveZ * speed;
    engine.physics.setVelocity(player, velocity);
    
    // Jump
    if (engine.input.isKeyPressed('Space') && isOnGround(player)) {
        velocity.y = 7;  // Jump force
        engine.physics.setVelocity(player, velocity);
    }
    
    // Camera follows player
    camera.position.x = player.position.x;
    camera.position.z = player.position.z + 10;
    camera.lookAt(player.position);
};

// Helper: Check if player is on ground
function isOnGround(obj) {
    // Raycast downward
    const hit = engine.physics.raycast(
        obj.position,
        { x: 0, y: -1, z: 0 },
        1.1  // Distance
    );
    return hit !== null;
}

engine.start();
```

---

## 📦 Working with Assets

### Importing 3D Models

#### Supported Formats
- **.glTF / .glb** (Recommended) - Best for web, smallest size
- **.fbx** - From Blender, Maya, 3ds Max
- **.obj** - Simple models without animations
- **.dae** (Collada) - With animations

#### Import Steps

```typescript
// Method 1: Async loading
const model = await engine.assets.loadModel('assets/character.glb');
scene.add(model);

// Method 2: With progress callback
await engine.assets.loadModel('assets/level.glb', (progress) => {
    console.log(`Loading: ${(progress * 100).toFixed(0)}%`);
});

// Method 3: Batch loading
await engine.assets.loadBatch([
    { type: 'model', url: 'assets/character.glb', name: 'player' },
    { type: 'model', url: 'assets/enemy.glb', name: 'enemy' },
    { type: 'model', url: 'assets/prop.glb', name: 'prop' }
], (overall, current) => {
    console.log(`Overall: ${overall * 100}%, Current: ${current * 100}%`);
});

// Access loaded model
const character = engine.assets.get('player');
scene.add(character);
```

### Working with Textures

```typescript
// Load texture
const diffuse = await engine.assets.loadTexture('assets/brick_diffuse.png');
const normal = await engine.assets.loadTexture('assets/brick_normal.png');
const roughness = await engine.assets.loadTexture('assets/brick_roughness.png');

// Apply to material
mesh.material = {
    albedoMap: diffuse,
    normalMap: normal,
    roughnessMap: roughness,
    metallic: 0.0,
    roughness: 1.0
};

// Texture settings
diffuse.wrapS = 'repeat';
diffuse.wrapT = 'repeat';
diffuse.repeat = { x: 4, y: 4 };
diffuse.anisotropy = 16;  // Better quality at angles
```

### Audio Assets

```typescript
// Background music
await engine.audio.loadSound('bgm', 'assets/music.mp3');
engine.audio.playSound('bgm', {
    loop: true,
    volume: 0.5,
    fadeIn: 2.0  // 2 second fade in
});

// Sound effects
await engine.audio.loadSound('jump', 'assets/jump.wav');
await engine.audio.loadSound('explosion', 'assets/explosion.wav');

// Play sound effect
engine.audio.playSound('jump', { volume: 0.8 });

// 3D positioned audio
const audioSource = scene.createAudioSource();
audioSource.position.set(10, 0, 0);
await audioSource.load('assets/waterfall.mp3');
audioSource.play({ loop: true, volume: 1.0 });
```

---

## 🔨 Building and Testing

### Development Workflow

#### 1. Start Development Server

```bash
npm run dev
```

This starts a local server at `http://localhost:5173` with:
- **Hot reload**: Changes appear instantly
- **Source maps**: Debug TypeScript directly
- **Fast refresh**: Updates without full reload

#### 2. Watch Mode (Auto-compile)

Open a second terminal:

```bash
npm run watch
```

Now TypeScript files compile automatically on save.

### Testing Your Game

#### Browser Testing

```typescript
// Enable debug mode
const engine = new WebForge({
    debug: true  // Shows FPS, draw calls, memory
});

// Performance profiling
engine.profiler.start();

// ... run your game for 60 seconds ...

const report = engine.profiler.stop();
console.log(`Avg FPS: ${report.avgFPS}`);
console.log(`Draw Calls: ${report.avgDrawCalls}`);
console.log(`Memory: ${report.peakMemory}MB`);
```

#### Multi-Device Testing

Test on different devices:

1. **Desktop (High-end)**
   - Set quality: `'ultra'`
   - Target: 144 FPS

2. **Desktop (Mid-range)**
   - Set quality: `'high'`
   - Target: 60 FPS

3. **Mobile (Modern)**
   - Set quality: `'medium'`
   - Target: 60 FPS

4. **Mobile (Old)**
   - Set quality: `'low'`
   - Target: 30 FPS

```typescript
// Auto-detect device capability
const engine = new WebForge({
    quality: 'auto'  // Automatically chooses best quality
});
```

### Building for Production

```bash
# Full production build
npm run build

# Output in dist/ folder:
dist/
├── index.html
├── assets/
│   ├── index-[hash].js     # Minified JS
│   ├── index-[hash].css    # Minified CSS
│   └── assets/             # Optimized assets
└── ...
```

The build process:
1. **Compiles** TypeScript to JavaScript
2. **Minifies** code (removes whitespace, shortens names)
3. **Tree-shakes** unused code
4. **Optimizes** assets (compresses images, models)
5. **Generates** source maps for debugging
6. **Creates** cache-friendly filenames

### Performance Optimization

```typescript
// Use LOD (Level of Detail) for far objects
mesh.generateLOD([
    0.75,  // 75% detail at medium distance
    0.5,   // 50% detail at far distance
    0.25   // 25% detail at very far distance
]);

// Enable frustum culling (don't render off-screen objects)
engine.renderer.frustumCulling = true;

// Enable occlusion culling (don't render hidden objects)
engine.renderer.occlusionCulling = true;

// Use instancing for repeated objects
const instances = [];
for (let i = 0; i < 1000; i++) {
    instances.push({
        position: { x: i * 2, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 }
    });
}
engine.renderer.createInstancedMesh(mesh, instances);
```

---

## 🎯 Using All Major Features

### 1. Physics System

```typescript
// Rigid bodies
const box = scene.createMesh('cube');
const boxBody = engine.physics.addRigidBody(box, {
    type: 'dynamic',  // 'static', 'dynamic', or 'kinematic'
    mass: 1.0,
    friction: 0.5,
    restitution: 0.3,  // Bounciness
    linearDamping: 0.1,  // Air resistance
    angularDamping: 0.1
});

// Apply forces
engine.physics.applyForce(box, { x: 0, y: 100, z: 0 });
engine.physics.applyImpulse(box, { x: 10, y: 0, z: 0 });
engine.physics.applyTorque(box, { x: 0, y: 50, z: 0 });

// Constraints (joints)
const hinge = engine.physics.createHingeConstraint(box1, box2, {
    pivotA: { x: 1, y: 0, z: 0 },
    pivotB: { x: -1, y: 0, z: 0 },
    axisA: { x: 0, y: 1, z: 0 },
    axisB: { x: 0, y: 1, z: 0 }
});
```

### 2. Animation System

```typescript
// Load animated model
const character = await engine.assets.loadModel('assets/character.glb');

// Play animation
character.animator.play('Walk', {
    loop: true,
    speed: 1.0,
    fadeIn: 0.2  // Blend time
});

// Animation state machine
character.animator.createStateMachine({
    states: {
        'Idle': { animation: 'Idle', loop: true },
        'Walk': { animation: 'Walk', loop: true },
        'Run': { animation: 'Run', loop: true },
        'Jump': { animation: 'Jump', loop: false }
    },
    transitions: [
        { from: 'Idle', to: 'Walk', condition: 'speed > 0.1' },
        { from: 'Walk', to: 'Run', condition: 'speed > 3.0' },
        { from: 'Walk', to: 'Idle', condition: 'speed < 0.1' },
        { from: 'any', to: 'Jump', trigger: 'jump' }
    ]
});

// Trigger transition
character.animator.setParameter('speed', 2.0);
character.animator.trigger('jump');
```

### 3. Particle System

```typescript
// Create emitter
const fire = engine.particles.createEmitter({
    position: { x: 0, y: 0, z: 0 },
    rate: 200,  // particles/second
    lifetime: 1.5,
    
    // Size over lifetime
    startSize: 0.2,
    endSize: 0.8,
    
    // Color over lifetime
    startColor: { r: 1, g: 1, b: 0, a: 1 },  // Yellow
    endColor: { r: 1, g: 0, b: 0, a: 0 },    // Red, faded
    
    // Motion
    velocity: { x: 0, y: 2, z: 0 },
    velocityVariance: 0.5,
    acceleration: { x: 0, y: 0.5, z: 0 },
    
    // GPU vs CPU
    useGPU: true  // Much faster for many particles
});

// Start/stop
fire.play();
fire.pause();
fire.stop();

// Burst emission
fire.burst(100);  // Emit 100 particles at once
```

### 4. Terrain System

```typescript
// Create terrain
const terrain = engine.terrain.create({
    size: 512,  // 512x512 vertices
    heightScale: 50,
    textureRepeat: 16
});

// Load heightmap
await terrain.loadHeightmap('assets/heightmap.png');

// Sculpting
terrain.sculpt({
    x: 256, z: 256,  // Position
    radius: 20,
    strength: 0.1,
    tool: 'raise'  // 'raise', 'lower', 'smooth', 'flatten'
});

// Texture splatting
terrain.addLayer({
    texture: grassTexture,
    normal: grassNormal,
    heightRange: [0, 20],  // Grass on low areas
    slopeRange: [0, 45]    // Not on steep slopes
});

terrain.addLayer({
    texture: rockTexture,
    normal: rockNormal,
    heightRange: [20, 100],
    slopeRange: [45, 90]  // Rock on steep slopes
});

// Foliage painting
terrain.paintFoliage({
    x: 100, z: 100,
    radius: 10,
    density: 0.5,
    mesh: grassMesh,
    scale: { min: 0.8, max: 1.2 },
    rotation: { min: 0, max: 360 }
});
```

### 5. Multiplayer

```typescript
// Host game (P2P)
const host = await engine.multiplayer.host({
    maxPlayers: 4,
    roomName: 'MyGame',
    password: 'secret123'
});

host.on('playerJoined', (player) => {
    console.log(`${player.name} joined!`);
});

// Join game
const client = await engine.multiplayer.join({
    roomName: 'MyGame',
    password: 'secret123',
    playerName: 'Alice'
});

// Sync object
engine.multiplayer.sync(player, {
    properties: ['position', 'rotation'],
    rate: 20  // Updates per second
});

// Send custom message
engine.multiplayer.send('chatMessage', {
    from: 'Alice',
    text: 'Hello!'
});

// Receive messages
engine.multiplayer.on('chatMessage', (data) => {
    console.log(`${data.from}: ${data.text}`);
});
```

### 6. Visual Scripting

```typescript
// Create node graph
const graph = engine.scripting.createGraph('GameLogic');

// Add nodes
const onUpdate = graph.addNode('Event.Update');
const getInput = graph.addNode('Input.GetAxis', { axis: 'Horizontal' });
const multiply = graph.addNode('Math.Multiply', { b: 5.0 });
const setPosition = graph.addNode('Transform.SetPosition');

// Connect nodes
graph.connect(onUpdate.out, getInput.in);
graph.connect(getInput.out, multiply.inA);
graph.connect(multiply.out, setPosition.inX);

// Assign to object
player.addComponent('ScriptGraph', { graph });
```

---

## 🚀 Advanced Workflows

### Custom Shaders

```typescript
// Create custom material
const customMaterial = engine.renderer.createMaterial({
    vertexShader: `
        attribute vec3 position;
        attribute vec2 uv;
        
        uniform mat4 modelMatrix;
        uniform mat4 viewMatrix;
        uniform mat4 projectionMatrix;
        
        varying vec2 vUV;
        
        void main() {
            vUV = uv;
            gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
        }
    `,
    
    fragmentShader: `
        precision mediump float;
        
        uniform float time;
        uniform vec3 color;
        varying vec2 vUV;
        
        void main() {
            vec3 c = color * (0.5 + 0.5 * sin(time + vUV.x * 10.0));
            gl_FragColor = vec4(c, 1.0);
        }
    `,
    
    uniforms: {
        time: 0.0,
        color: { r: 1, g: 0, b: 0 }
    }
});

// Update uniforms each frame
scene.onUpdate = (dt) => {
    customMaterial.uniforms.time += dt;
};

// Apply to mesh
mesh.material = customMaterial;
```

### Procedural Generation

```typescript
// Generate procedural dungeon
const dungeon = engine.procedural.generateDungeon({
    rooms: 20,
    minRoomSize: { x: 5, y: 5 },
    maxRoomSize: { x: 15, y: 15 },
    corridorWidth: 3,
    seed: 12345  // Reproducible
});

// Generate terrain
const terrain = engine.procedural.generateTerrain({
    size: 512,
    octaves: 6,
    persistence: 0.5,
    lacunarity: 2.0,
    scale: 100,
    seed: 67890
});

// Generate mesh
const mesh = engine.procedural.generateMesh({
    type: 'planet',
    radius: 10,
    detail: 5,
    seed: 11111
});
```

### AI and Pathfinding

```typescript
// Create navmesh
const navmesh = engine.ai.createNavMesh(terrainMesh, {
    cellSize: 0.3,
    cellHeight: 0.2,
    maxSlope: 45,
    maxClimb: 0.9
});

// Create AI agent
const enemy = scene.createMesh('capsule');
const agent = engine.ai.createAgent(enemy, {
    radius: 0.5,
    height: 2.0,
    maxSpeed: 3.5,
    maxAcceleration: 8.0
});

// Set destination
agent.setDestination(player.position);

// Behavior tree
const behaviorTree = engine.ai.createBehaviorTree({
    root: {
        type: 'Selector',
        children: [
            {
                type: 'Sequence',
                name: 'Attack',
                children: [
                    { type: 'Condition', check: 'isPlayerInRange' },
                    { type: 'Action', action: 'attack' }
                ]
            },
            {
                type: 'Sequence',
                name: 'Chase',
                children: [
                    { type: 'Condition', check: 'canSeePlayer' },
                    { type: 'Action', action: 'moveToPlayer' }
                ]
            },
            {
                type: 'Action',
                name: 'Patrol',
                action: 'patrol'
            }
        ]
    }
});

enemy.addComponent('AIBehavior', { tree: behaviorTree });
```

---

## 📤 Publishing Your Game

### Export to Web (PWA)

```typescript
import { ExportManager, ExportPlatform } from '@webforge/platform';

const exporter = new ExportManager();

await exporter.export({
    platform: ExportPlatform.PWA,
    outputPath: './dist/pwa',
    projectName: 'MyAwesomeGame',
    version: '1.0.0',
    appId: 'com.mycompany.mygame',
    optimize: true,
    minify: true,
    icons: {
        icon192: 'assets/icon-192.png',
        icon512: 'assets/icon-512.png'
    }
});

// Result includes:
// - manifest.json (PWA manifest)
// - service-worker.js (offline support)
// - Optimized assets
// - Install prompt
```

### Export to Desktop

```bash
# Windows
npm run export -- --platform windows

# macOS
npm run export -- --platform macos

# Linux
npm run export -- --platform linux
```

Or programmatically:

```typescript
// Electron export
await exporter.export({
    platform: ExportPlatform.ELECTRON_WINDOWS,
    outputPath: './dist/windows',
    projectName: 'MyGame',
    version: '1.0.0'
});

// Creates MyGame-Setup.exe (installer)
// And MyGame.exe (portable)
```

### Export to Mobile

```typescript
// iOS
await exporter.export({
    platform: ExportPlatform.CAPACITOR_IOS,
    outputPath: './dist/ios',
    projectName: 'MyGame',
    version: '1.0.0',
    appId: 'com.mycompany.mygame'
});

// Android
await exporter.export({
    platform: ExportPlatform.CAPACITOR_ANDROID,
    outputPath: './dist/android',
    projectName: 'MyGame',
    version: '1.0.0',
    appId: 'com.mycompany.mygame'
});

// Then open in Xcode (iOS) or Android Studio to build
```

### Hosting Options

#### 1. Static Hosting (Free)

**GitHub Pages:**
```bash
npm run build
git add dist -f
git commit -m "Deploy"
git subtree push --prefix dist origin gh-pages
# Visit: https://username.github.io/repo
```

**Netlify:**
```bash
# Install Netlify CLI
npm install -g netlify-cli

# Deploy
npm run build
netlify deploy --prod --dir=dist
```

**Vercel:**
```bash
npm install -g vercel
npm run build
vercel --prod
```

#### 2. Self-Hosting

```bash
# Build production
npm run build

# Upload dist/ folder to your server
scp -r dist/* user@yourserver.com:/var/www/html/

# Or use FTP, SFTP, rsync, etc.
```

---

## 🔧 Troubleshooting

### Common Issues

#### Issue: "Canvas not found"

```typescript
// ❌ Wrong
const engine = new WebForge('#canva');  // Typo

// ✅ Correct
const engine = new WebForge('#canvas');

// Or let it create canvas automatically
const engine = new WebForge();
```

#### Issue: "WebGL not supported"

```typescript
// Check WebGL support
if (!engine.renderer.isWebGLSupported()) {
    alert('Your browser does not support WebGL');
    // Show fallback content
}
```

#### Issue: Poor Performance

```typescript
// 1. Lower quality
const engine = new WebForge({ quality: 'low' });

// 2. Disable features
const engine = new WebForge({
    shadows: false,
    particles: false,
    postProcessing: false
});

// 3. Use LOD
mesh.generateLOD([0.75, 0.5, 0.25]);

// 4. Reduce draw calls
engine.renderer.batchDrawCalls = true;
```

#### Issue: Audio Won't Play

```typescript
// Audio requires user interaction
document.addEventListener('click', async () => {
    await engine.audio.unlock();
}, { once: true });
```

#### Issue: Assets Not Loading

```typescript
// Check path
console.log('Loading from:', window.location.origin + '/assets/model.glb');

// Use absolute path
const model = await engine.assets.loadModel('/assets/model.glb');

// Or relative to HTML file
const model = await engine.assets.loadModel('./assets/model.glb');
```

---

## 💡 Best Practices

### Performance

1. **Object Pooling**
```typescript
// Create pool
const bulletPool = engine.utils.createObjectPool(
    () => scene.createMesh('sphere'),  // Factory
    100  // Initial size
);

// Get from pool
const bullet = bulletPool.get();
bullet.position.set(0, 0, 0);

// Return to pool (don't destroy)
bulletPool.release(bullet);
```

2. **Lazy Loading**
```typescript
// Load assets on demand
async function enterLevel2() {
    const level2Assets = await engine.assets.loadBatch([
        { type: 'model', url: 'level2/environment.glb' },
        { type: 'texture', url: 'level2/textures.png' }
    ]);
    
    // Unload level 1
    engine.assets.unload('level1/*');
}
```

3. **Culling**
```typescript
// Enable all culling techniques
engine.renderer.frustumCulling = true;
engine.renderer.occlusionCulling = true;
engine.renderer.backfaceCulling = true;
```

### Code Organization

```
my-game/
├── src/
│   ├── main.ts               # Entry point
│   ├── scenes/
│   │   ├── MainMenu.ts
│   │   ├── Level1.ts
│   │   └── GameOver.ts
│   ├── entities/
│   │   ├── Player.ts
│   │   ├── Enemy.ts
│   │   └── Bullet.ts
│   ├── systems/
│   │   ├── MovementSystem.ts
│   │   ├── CombatSystem.ts
│   │   └── UISystem.ts
│   └── utils/
│       ├── Config.ts
│       └── Helpers.ts
├── assets/
│   ├── models/
│   ├── textures/
│   ├── audio/
│   └── scripts/
└── public/
    └── index.html
```

### Memory Management

```typescript
// Clean up when done
function cleanup() {
    // Stop engine
    engine.stop();
    
    // Dispose objects
    scene.dispose();
    
    // Clear assets
    engine.assets.clear();
    
    // Remove event listeners
    engine.input.removeAllListeners();
}

// Handle page unload
window.addEventListener('beforeunload', cleanup);
```

---

## 🎓 Learning Resources

### Documentation
- [COMPLETE_REFERENCE.md](./COMPLETE_REFERENCE.md) - Full API reference
- [ARCHITECTURE_DESIGN.md](./ARCHITECTURE_DESIGN.md) - System architecture
- [MASTER_PLAN.md](./MASTER_PLAN.md) - Project roadmap

### Examples
- See `/examples` folder for complete game examples
- Each example is fully commented and runnable

### Community
- GitHub Issues - Ask questions
- Discord (coming soon) - Real-time chat
- Forums (coming soon) - Discussions

---

## 🎉 You're Ready to Build!

You now have everything you need to create amazing games with WebForge!

**Next Steps:**
1. ✅ Try the examples in `/examples`
2. ✅ Build your first game
3. ✅ Share it with the community
4. ✅ Keep learning and experimenting

**Need Help?**
- Check the docs
- Open a GitHub issue
- Join the community

Happy game development! 🚀

---

**Made with ❤️ for game developers everywhere**
