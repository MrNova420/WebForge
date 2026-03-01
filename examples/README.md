# 🎮 WebForge Examples

Working examples demonstrating WebForge engine features.

## 📂 Examples

### ✅ Working Examples

1. **[Hello World](./hello-world/)** — Real WebForge engine running: Scene graph, GameObjects, Transforms, Physics, 3D wireframe rendering

### 🚧 Coming Soon

2. **Physics Playground** — Rigid bodies and collisions with PhysicsWorld
3. **Character Controller** — Third-person movement with Input system
4. **Particle Effects** — Fire, smoke, magic with ParticleSystem
5. **Terrain Generation** — Procedural landscapes with Terrain system
6. **Water Simulation** — FFT-based ocean rendering
7. **Animation Demo** — Skeletal animation with state machines
8. **Multiplayer** — Networked gameplay with WebRTC

## 🚀 Running Examples

1. Clone the repository
2. Install dependencies: `npm install`
3. Start dev server: `npm run dev`
4. Open `http://localhost:5173/examples/hello-world/`

## 📝 API Quick Reference

```typescript
import { WebForge, Vector3 } from '../../src/index.ts';

// Create engine
const engine = new WebForge({ antialias: true });
await engine.initialize();

// Create scene + objects
const scene = engine.createScene('MyScene');
const player = engine.createGameObject('Player');
player.transform.position.set(0, 1, 0);

// Start the loop
await engine.start();
```

All examples use the **real** WebForge API — no mocks or stubs.

## 🎓 Learn More

- **[Getting Started Guide](../docs/GETTING_STARTED.md)** — Basics
- **[Complete Reference](../docs/COMPLETE_REFERENCE.md)** — In-depth guide
- **[Architecture](../docs/ARCHITECTURE_DESIGN.md)** — System design

Happy coding! 🎮
