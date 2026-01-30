# WebForge Copilot Instructions

## Project Overview

WebForge is an all-in-one web game development platform built with TypeScript, WebGL, and modern web APIs. It combines a game engine, visual editor, and 3D modeling tools into a browser-based development environment. The goal is to provide AAA-quality game development capabilities without requiring any software installation.

## Build, Test, and Lint

### Development
```bash
npm run dev              # Start dev server (http://localhost:5173)
npm run dev:editor       # Start with editor.html open
npm run compile:watch    # TypeScript watch mode
```

### Build & Check
```bash
npm run build            # Full TypeScript + Vite build
npm run compile          # TypeScript compile only
npm run lint             # Type-check without emit
npm run check            # Run lint + tests
npm run health           # Full health check
```

### Testing
```bash
npm test                 # Run all 105 tests
npm run test:watch       # Watch mode
npm run test:ui          # Vitest UI
npm run test:coverage    # With coverage report

# Run a specific test file
npx vitest tests/math.test.ts
npx vitest tests/eventSystem.test.ts

# Run a specific test by name pattern
npx vitest -t "Vector3"
```

**Test environment:** Vitest with happy-dom (browser-like environment without a real browser)  
**Test timeout:** 10 seconds (configurable in vitest.config.ts)  
**Current status:** 105 tests passing across 6 test files

## Architecture

### Core Design Patterns

**Component-Based Architecture**
- `GameObject` is the base entity with Transform and component system
- Components implement `IComponent` interface with lifecycle hooks: `awake()`, `start()`, `update(deltaTime)`, `destroy()`
- Scene graph hierarchy with parent-child relationships and inherited transformations

**Event-Driven Communication**
- `EventSystem` provides pub-sub pattern for decoupled system communication
- Use `engine.events.on(eventType, handler)` for listening, `emit(eventType, data)` for publishing
- Events enable inter-system communication without tight coupling

**Manager Pattern**
- Each subsystem (Audio, Particles, Physics, Rendering) is managed independently
- Managers have lifecycle methods aligned with engine loop
- Access via facade: `engine.audio`, `engine.particles`, etc.

**Engine Loop Structure**
```
Initialize → [
  Fixed Update (Physics) → 
  Variable Update (Animation, Scene) → 
  Render
] → Cleanup
```

### Module Organization

```
src/
├── core/               # Engine lifecycle, events, input, time, resources
│   ├── Engine.ts       # Core engine with fixed/variable timestep
│   ├── EventSystem.ts  # Pub-sub event system
│   ├── Time.ts         # Delta time tracking
│   ├── Input.ts        # Keyboard, mouse, gamepad
│   └── ResourceManager.ts
├── math/               # Vector2/3/4, Matrix4, Quaternion, Transform
├── scene/              # GameObject, Scene (hierarchy management)
├── rendering/          # WebGL renderer, materials, shaders, lighting
│   ├── Renderer.ts     # Forward renderer
│   ├── Camera.ts       # Perspective/orthographic cameras
│   ├── Material.ts     # Standard materials
│   ├── PBRMaterial.ts  # Physically-based materials
│   └── effects/        # Post-processing (bloom, SSAO, DOF, etc.)
├── physics/            # Rigid body dynamics, collision detection
│   ├── PhysicsWorld.ts # Main simulation loop
│   ├── RigidBody.ts    # Physics objects
│   └── GJK.ts          # Collision algorithm
├── animation/          # Skeletal animation, state machines, IK, blend trees
├── audio/              # 3D spatial audio, effects, music system
├── particles/          # CPU/GPU particle systems
├── terrain/            # Heightmap terrain, LOD, painting, generation
├── ai/                 # NavMesh, behavior trees, steering behaviors
├── editor/             # Visual editor UI (panels, gizmos, commands)
│   ├── app/            # EditorApplication, scene, renderer
│   ├── panels/         # Inspector, hierarchy, asset browser, etc.
│   └── gizmos/         # Translate/rotate/scale gizmos
├── debug/              # LiveDebugger, breakpoints, profiling, console
├── network/            # WebRTC P2P and WebSocket networking
├── scripting/          # Visual scripting (node graph system)
└── WebForge.ts         # Simplified facade over Engine.ts
```

### Key Architectural Concepts

**Transform Hierarchy**
- Every GameObject has a Transform with local and world matrices
- World transforms calculated lazily with dirty-flag tracking
- Parent transforms automatically propagate to children

**Resource Management**
- `ResourceManager` handles loading and caching of assets
- Use `engine.resources.load(url)` for async loading
- Resources are reference-counted for automatic cleanup

**Physics Integration**
- Physics runs on fixed timestep (separate from render loop)
- Broadphase (sweep-and-prune) → Narrowphase (GJK) → Constraint solving
- RigidBody components automatically sync with GameObject transforms

**Rendering Pipeline**
- Forward rendering with multiple render passes
- PBR materials with metallic/roughness workflow
- Post-processing stack with customizable effects
- Shadow mapping with cascaded shadow maps (CSM)

## Conventions

### TypeScript Patterns

**Strict Mode Enabled**
- All code must pass strict TypeScript checks
- No implicit any, unused parameters, or unhandled returns
- Use `?` for optional parameters, not `| undefined`

**Class Organization**
```typescript
export class MyClass {
    // 1. Public properties
    public name: string;
    
    // 2. Private properties
    private _data: number;
    
    // 3. Constructor
    constructor() { }
    
    // 4. Public methods
    public update(dt: number): void { }
    
    // 5. Private methods
    private initialize(): void { }
}
```

**Component Implementation**
```typescript
export class MyComponent implements IComponent {
    public enabled = true;
    
    awake?(): void {
        // Called when component is added
    }
    
    start?(): void {
        // Called on first frame
    }
    
    update(deltaTime: number): void {
        if (!this.enabled) return;
        // Update logic here
    }
    
    destroy?(): void {
        // Cleanup
    }
}
```

### Math and Transforms

**Vector Operations**
- All Vector2/3/4 classes are **immutable by default**
- Methods return new instances: `v1.add(v2)` returns new vector
- Use in-place methods for performance: `v1.addInPlace(v2)` modifies v1
- Chain operations: `vec.normalize().scale(5).add(offset)`

**Transform Usage**
```typescript
// Local space (relative to parent)
gameObject.transform.position.set(0, 5, 0);
gameObject.transform.rotation.fromEuler(0, Math.PI, 0);
gameObject.transform.scale.set(2, 2, 2);

// World space (absolute)
const worldPos = gameObject.transform.getWorldPosition();
const worldRot = gameObject.transform.getWorldRotation();
```

### Naming Conventions

- **Classes/Interfaces:** PascalCase (`GameObject`, `IComponent`)
- **Methods/Variables:** camelCase (`deltaTime`, `updatePhysics`)
- **Private members:** Prefix with `_` (`_velocity`, `_mesh`)
- **Constants:** UPPER_SNAKE_CASE (`MAX_PARTICLES`, `GRAVITY`)
- **Files:** Match class name (`GameObject.ts`, `Vector3.ts`)

### Event System Usage

```typescript
// Subscribe to events
engine.events.on('collision', (data) => {
    console.log('Collision:', data);
});

// Emit events (use for inter-system communication)
engine.events.emit('player-died', { playerId: 123 });

// Unsubscribe when done
const handler = (data) => { /* ... */ };
engine.events.on('update', handler);
engine.events.off('update', handler);
```

### Debugging and Profiling

**LiveDebugger**
- Automatically active in development builds
- Access via Ctrl+Shift+D or F12
- Captures errors, performance issues, and warnings

**Debug Drawing**
```typescript
import { DebugDraw } from './debug/DebugDraw';

// Draw helpers for visualization
DebugDraw.line(start, end, color);
DebugDraw.sphere(center, radius, color);
DebugDraw.box(min, max, color);
```

**Profiling**
```typescript
import { Profiler } from './utils/Profiler';

Profiler.begin('my-section');
// ... expensive code ...
Profiler.end('my-section');

// Check results
const stats = Profiler.getStats();
```

### Scene Management

**Creating Scenes**
```typescript
const scene = new Scene('MyScene');
const gameObject = new GameObject('Player');
scene.add(gameObject);

// Hierarchy
const child = new GameObject('Weapon');
child.setParent(gameObject);  // Automatically updates scene graph

// Finding objects
const player = scene.findByName('Player');
const enemies = scene.findByTag('enemy');
```

### Editor Integration

**Editor vs Runtime**
- `WebForge.ts` = simplified API for games
- `Engine.ts` = full engine for editor
- Editor files in `src/editor/` are independent from core engine
- Use `EditorApplication` for editor-specific functionality

**Gizmos**
- Extend `Gizmo` base class for custom editor visualizations
- Register with `GizmoManager` to enable in editor

## Documentation

All comprehensive documentation is in the `docs/` folder:
- [COMPLETE_REFERENCE.md](../docs/COMPLETE_REFERENCE.md) - All-in-one guide
- [ARCHITECTURE_DESIGN.md](../docs/ARCHITECTURE_DESIGN.md) - System architecture
- [DEVELOPMENT_METHODOLOGY.md](../docs/DEVELOPMENT_METHODOLOGY.md) - Coding standards
- [DEBUG_SYSTEM.md](../docs/DEBUG_SYSTEM.md) - Debugging tools guide
- [PERFORMANCE_OPTIMIZATION.md](../docs/PERFORMANCE_OPTIMIZATION.md) - Optimization strategies

## Common Patterns

### Object Pooling
```typescript
import { ObjectPool } from './utils/ObjectPool';

const bulletPool = new ObjectPool(() => new Bullet(), 100);
const bullet = bulletPool.get();
// ... use bullet ...
bulletPool.release(bullet);
```

### Adding Features
1. Identify the appropriate subsystem (rendering, physics, etc.)
2. Create component implementing `IComponent` if needed
3. Use `EventSystem` for communication with other systems
4. Add tests in `tests/` directory
5. Update relevant documentation

### Performance Considerations
- Use object pooling for frequently created/destroyed objects
- Batch similar rendering operations
- Enable frustum culling for large scenes
- Use LOD system for distant objects
- Profile with `Profiler` before optimizing

---

*Generated for WebForge v1.0.0 - The Ultimate Web Game Development Platform*
