# 🏛️ WebForge Architecture Design

## Technical Architecture for a World-Class Web Game Engine

**Mission:** Design a scalable, maintainable, and high-performance architecture that supports all features while remaining flexible for future expansion.

---

## 🎯 Architecture Principles

### **1. Separation of Concerns**
- Clear boundaries between modules
- Single Responsibility Principle
- Loose coupling, high cohesion

### **2. Performance First**
- Data-oriented design where appropriate
- Cache-friendly memory layout
- Minimize allocations
- Batch operations

### **3. Extensibility**
- Plugin architecture
- Event-driven communication
- Dependency injection
- Open for extension, closed for modification

### **4. Type Safety**
- TypeScript strict mode
- Comprehensive type definitions
- Generic programming
- Runtime validation where necessary

---

## 🏗️ System Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      APPLICATION LAYER                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │   Editor    │  │    Game     │  │   Runtime   │        │
│  │     UI      │  │   Runtime   │  │   Player    │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                       GAME ENGINE CORE                       │
│  ┌──────────┬──────────┬──────────┬──────────┬──────────┐  │
│  │  Scene   │  Entity  │  Event   │  Input   │  Time    │  │
│  │  Graph   │  System  │  System  │  Manager │  System  │  │
│  └──────────┴──────────┴──────────┴──────────┴──────────┘  │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                      SUBSYSTEMS LAYER                        │
│  ┌──────────┬──────────┬──────────┬──────────┬──────────┐  │
│  │ Render   │ Physics  │  Audio   │Animation │  Asset   │  │
│  │ System   │ System   │  System  │  System  │  Manager │  │
│  └──────────┴──────────┴──────────┴──────────┴──────────┘  │
│  ┌──────────┬──────────┬──────────┬──────────┬──────────┐  │
│  │ Network  │  UI      │Particles │ Terrain  │ Script   │  │
│  │ System   │ System   │  System  │  System  │  Engine  │  │
│  └──────────┴──────────┴──────────┴──────────┴──────────┘  │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                    FOUNDATION LAYER                          │
│  ┌──────────┬──────────┬──────────┬──────────┬──────────┐  │
│  │   Math   │  Memory  │  Logger  │ Profiler │  Utils   │  │
│  │ Library  │  Pool    │          │          │          │  │
│  └──────────┴──────────┴──────────┴──────────┴──────────┘  │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                     PLATFORM LAYER                           │
│  ┌──────────┬──────────┬──────────┬──────────┬──────────┐  │
│  │  WebGL   │ WebGPU   │ Web Audio│ WebRTC   │  DOM     │  │
│  │   2.0    │          │    API   │          │   APIs   │  │
│  └──────────┴──────────┴──────────┴──────────┴──────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎨 Rendering System Architecture

### **Rendering Pipeline Flow**

```
Scene → Culling → Sorting → Batching → Rendering → Post-Processing → Display

1. Scene Graph Traversal
   ↓
2. Frustum Culling (skip invisible objects)
   ↓
3. Occlusion Culling (skip hidden objects)
   ↓
4. LOD Selection (pick detail level)
   ↓
5. Material Sorting (minimize state changes)
   ↓
6. Render Queue:
   - Skybox (background)
   - Opaque geometry (front-to-back)
   - Transparent geometry (back-to-front)
   - Overlay/UI (screen-space)
   ↓
7. Shadow Pass (render to shadow maps)
   ↓
8. Lighting Pass (compute lighting)
   ↓
9. Post-Processing (effects)
   ↓
10. Present to screen
```

### **Renderer Architecture**

```typescript
interface Renderer {
  // Main render loop
  render(scene: Scene, camera: Camera): void;
}

class WebGLRenderer implements Renderer {
  // Core systems
  private renderQueue: RenderQueue;
  private materialManager: MaterialManager;
  private shaderManager: ShaderManager;
  private textureManager: TextureManager;
  private frameBufferManager: FrameBufferManager;
  
  // Render passes
  private shadowPass: ShadowPass;
  private geometryPass: GeometryPass;
  private lightingPass: LightingPass;
  private postProcessPass: PostProcessPass;
  
  render(scene: Scene, camera: Camera): void {
    // Update camera matrices
    camera.updateMatrices();
    
    // Frustum culling
    const visibleObjects = this.cullScene(scene, camera);
    
    // Build render queue
    this.renderQueue.clear();
    this.renderQueue.addObjects(visibleObjects);
    this.renderQueue.sort();
    
    // Shadow pass
    this.shadowPass.render(scene, this.renderQueue);
    
    // Main geometry pass
    this.geometryPass.render(this.renderQueue, camera);
    
    // Lighting pass (deferred)
    this.lightingPass.render(scene.lights, camera);
    
    // Post-processing
    this.postProcessPass.render(this.finalFramebuffer);
    
    // Present
    this.present();
  }
}
```

### **Material System**

```typescript
interface Material {
  shader: Shader;
  properties: Map<string, any>;
  renderQueue: number;
  depthTest: boolean;
  depthWrite: boolean;
  blending: BlendMode;
}

class PBRMaterial implements Material {
  // PBR properties
  albedoColor: Color = new Color(1, 1, 1);
  albedoMap: Texture | null = null;
  
  metallic: number = 0;
  metallicMap: Texture | null = null;
  
  roughness: number = 0.5;
  roughnessMap: Texture | null = null;
  
  normalMap: Texture | null = null;
  normalStrength: number = 1;
  
  occlusionMap: Texture | null = null;
  occlusionStrength: number = 1;
  
  emissiveColor: Color = new Color(0, 0, 0);
  emissiveMap: Texture | null = null;
  emissiveIntensity: number = 1;
  
  // Compile shader variant based on enabled features
  getShaderVariant(): ShaderVariant {
    const defines: string[] = [];
    
    if (this.albedoMap) defines.push('USE_ALBEDO_MAP');
    if (this.normalMap) defines.push('USE_NORMAL_MAP');
    if (this.metallicMap) defines.push('USE_METALLIC_MAP');
    if (this.roughnessMap) defines.push('USE_ROUGHNESS_MAP');
    // ...
    
    return this.shader.getVariant(defines);
  }
}
```

### **Shader System**

```typescript
class ShaderManager {
  private shaders: Map<string, Shader> = new Map();
  private variants: Map<string, ShaderVariant> = new Map();
  
  // Load shader from source
  load(name: string, vertexSrc: string, fragmentSrc: string): Shader {
    const shader = new Shader(name, vertexSrc, fragmentSrc);
    this.shaders.set(name, shader);
    return shader;
  }
  
  // Get compiled variant with preprocessor defines
  getVariant(shader: Shader, defines: string[]): ShaderVariant {
    const key = this.makeVariantKey(shader, defines);
    
    if (!this.variants.has(key)) {
      const variant = this.compileVariant(shader, defines);
      this.variants.set(key, variant);
    }
    
    return this.variants.get(key)!;
  }
  
  private compileVariant(shader: Shader, defines: string[]): ShaderVariant {
    // Add #define directives
    let vertexSrc = defines.map(d => `#define ${d}`).join('\n') + '\n' + shader.vertexSrc;
    let fragmentSrc = defines.map(d => `#define ${d}`).join('\n') + '\n' + shader.fragmentSrc;
    
    // Compile WebGL program
    const program = this.compileProgram(vertexSrc, fragmentSrc);
    
    return new ShaderVariant(program, this.extractUniforms(program));
  }
}
```

---

## ⚡ Physics System Architecture

### **Physics World Structure**

```typescript
class PhysicsWorld {
  // Configuration
  private gravity: Vector3 = new Vector3(0, -9.81, 0);
  private timeStep: number = 1/60;  // Fixed timestep
  
  // Rigid bodies
  private bodies: RigidBody[] = [];
  private staticBodies: RigidBody[] = [];
  
  // Spatial partitioning
  private broadphase: Broadphase;
  
  // Collision detection
  private narrowphase: Narrowphase;
  
  // Constraint solver
  private solver: ConstraintSolver;
  
  // Main simulation step
  step(deltaTime: number): void {
    // Accumulate time
    this.accumulator += deltaTime;
    
    // Fixed timestep loop
    while (this.accumulator >= this.timeStep) {
      this.stepInternal(this.timeStep);
      this.accumulator -= this.timeStep;
    }
  }
  
  private stepInternal(dt: number): void {
    // 1. Broadphase: Find potential collision pairs
    const pairs = this.broadphase.detectPairs(this.bodies);
    
    // 2. Narrowphase: Detailed collision detection
    const contacts = this.narrowphase.detectContacts(pairs);
    
    // 3. Integrate forces (F = ma)
    for (const body of this.bodies) {
      if (body.isDynamic()) {
        this.integrateForces(body, dt);
      }
    }
    
    // 4. Solve constraints and contacts
    this.solver.solve(contacts, dt);
    
    // 5. Integrate velocities (update positions)
    for (const body of this.bodies) {
      if (body.isDynamic()) {
        this.integrateVelocities(body, dt);
      }
    }
    
    // 6. Update transforms
    this.syncTransforms();
  }
}
```

### **Collision Detection Pipeline**

```typescript
// Broadphase: Quick rejection of distant objects
interface Broadphase {
  detectPairs(bodies: RigidBody[]): CollisionPair[];
}

class SpatialHashBroadphase implements Broadphase {
  private cellSize: number = 10;
  private grid: Map<string, RigidBody[]> = new Map();
  
  detectPairs(bodies: RigidBody[]): CollisionPair[] {
    // Clear grid
    this.grid.clear();
    
    // Insert bodies into grid cells
    for (const body of bodies) {
      const cells = this.getCells(body.bounds);
      for (const cell of cells) {
        if (!this.grid.has(cell)) {
          this.grid.set(cell, []);
        }
        this.grid.get(cell)!.push(body);
      }
    }
    
    // Find pairs in same cells
    const pairs: CollisionPair[] = [];
    for (const [cell, bodiesInCell] of this.grid) {
      for (let i = 0; i < bodiesInCell.length; i++) {
        for (let j = i + 1; j < bodiesInCell.length; j++) {
          pairs.push({ bodyA: bodiesInCell[i], bodyB: bodiesInCell[j] });
        }
      }
    }
    
    return pairs;
  }
}

// Narrowphase: Precise collision detection
interface Narrowphase {
  detectContacts(pairs: CollisionPair[]): Contact[];
}

class GJKNarrowphase implements Narrowphase {
  detectContacts(pairs: CollisionPair[]): Contact[] {
    const contacts: Contact[] = [];
    
    for (const pair of pairs) {
      // GJK (Gilbert-Johnson-Keerthi) algorithm
      if (this.gjkIntersection(pair.bodyA, pair.bodyB)) {
        // EPA (Expanding Polytope Algorithm) for contact info
        const contact = this.epaContactInfo(pair.bodyA, pair.bodyB);
        contacts.push(contact);
      }
    }
    
    return contacts;
  }
  
  private gjkIntersection(a: RigidBody, b: RigidBody): boolean {
    // GJK implementation
    // ...
  }
  
  private epaContactInfo(a: RigidBody, b: RigidBody): Contact {
    // EPA implementation
    // Returns: contact point, normal, penetration depth
    // ...
  }
}
```

---

## 🎬 Animation System Architecture

### **Animation State Machine**

```typescript
interface AnimationState {
  clip: AnimationClip;
  speed: number;
  loop: boolean;
  transitions: AnimationTransition[];
}

interface AnimationTransition {
  targetState: string;
  conditions: Condition[];
  blendTime: number;
  exitTime: number;  // Normalized time to allow exit
}

class AnimationStateMachine {
  private states: Map<string, AnimationState> = new Map();
  private currentState: string;
  private transitionState: TransitionState | null = null;
  
  // Parameters for conditions
  private parameters: Map<string, number | boolean | string> = new Map();
  
  update(deltaTime: number): Pose {
    // Check for transitions
    if (this.transitionState === null) {
      const transition = this.checkTransitions();
      if (transition) {
        this.startTransition(transition);
      }
    }
    
    // Update current state
    const currentPose = this.updateState(this.currentState, deltaTime);
    
    // Handle transition blending
    if (this.transitionState) {
      const targetPose = this.updateState(this.transitionState.targetState, deltaTime);
      
      this.transitionState.progress += deltaTime / this.transitionState.blendTime;
      
      if (this.transitionState.progress >= 1) {
        // Transition complete
        this.currentState = this.transitionState.targetState;
        this.transitionState = null;
        return targetPose;
      } else {
        // Blend poses
        return this.blendPoses(
          currentPose,
          targetPose,
          this.transitionState.progress
        );
      }
    }
    
    return currentPose;
  }
  
  private checkTransitions(): AnimationTransition | null {
    const state = this.states.get(this.currentState)!;
    
    for (const transition of state.transitions) {
      if (this.evaluateConditions(transition.conditions)) {
        return transition;
      }
    }
    
    return null;
  }
  
  private evaluateConditions(conditions: Condition[]): boolean {
    for (const condition of conditions) {
      const value = this.parameters.get(condition.parameter);
      
      switch (condition.type) {
        case 'Greater':
          if (!(value as number > condition.threshold)) return false;
          break;
        case 'Less':
          if (!(value as number < condition.threshold)) return false;
          break;
        case 'Equals':
          if (value !== condition.value) return false;
          break;
        // ...
      }
    }
    
    return true;
  }
}
```

### **Skeletal Animation**

```typescript
class Skeleton {
  bones: Bone[] = [];
  rootBone: Bone;
  
  // Bone hierarchy
  private boneMap: Map<string, Bone> = new Map();
  
  // Bind pose (rest pose)
  private bindPose: Pose;
  
  // Inverse bind matrices (for skinning)
  private inverseBindMatrices: Matrix4[] = [];
}

class Pose {
  // Local transforms per bone
  localTransforms: Transform[] = [];
  
  // World transforms per bone (computed)
  worldTransforms: Matrix4[] = [];
  
  // Update world transforms from local + hierarchy
  updateWorldTransforms(skeleton: Skeleton): void {
    for (let i = 0; i < skeleton.bones.length; i++) {
      const bone = skeleton.bones[i];
      const local = this.localTransforms[i].toMatrix();
      
      if (bone.parent !== null) {
        const parentWorld = this.worldTransforms[bone.parent.index];
        this.worldTransforms[i] = parentWorld.multiply(local);
      } else {
        this.worldTransforms[i] = local;
      }
    }
  }
}

class SkinnedMeshRenderer {
  skeleton: Skeleton;
  mesh: Mesh;
  
  render(renderer: Renderer, pose: Pose): void {
    // Compute skinning matrices
    const skinningMatrices: Matrix4[] = [];
    
    for (let i = 0; i < this.skeleton.bones.length; i++) {
      // Skinning matrix = worldTransform * inverseBindMatrix
      skinningMatrices[i] = pose.worldTransforms[i]
        .multiply(this.skeleton.inverseBindMatrices[i]);
    }
    
    // Upload to GPU
    const uniformBuffer = this.createUniformBuffer(skinningMatrices);
    
    // Vertex shader will apply skinning
    renderer.drawMesh(this.mesh, uniformBuffer);
  }
}
```

---

## 🎮 Entity Component System (ECS)

### **ECS Architecture**

```typescript
// Entity: Just an ID
type EntityID = number;

// Component: Pure data
interface Component {
  // Marker interface
}

// Example components
interface TransformComponent extends Component {
  position: Vector3;
  rotation: Quaternion;
  scale: Vector3;
}

interface MeshComponent extends Component {
  geometry: Geometry;
  material: Material;
}

interface RigidBodyComponent extends Component {
  mass: number;
  velocity: Vector3;
  angularVelocity: Vector3;
}

// Component storage (Structure of Arrays for cache efficiency)
class ComponentArray<T extends Component> {
  private data: T[] = [];
  private entityToIndex: Map<EntityID, number> = new Map();
  private indexToEntity: Map<number, EntityID> = new Map();
  
  add(entity: EntityID, component: T): void {
    const index = this.data.length;
    this.data.push(component);
    this.entityToIndex.set(entity, index);
    this.indexToEntity.set(index, entity);
  }
  
  remove(entity: EntityID): void {
    const index = this.entityToIndex.get(entity)!;
    
    // Swap with last element
    const lastIndex = this.data.length - 1;
    if (index !== lastIndex) {
      this.data[index] = this.data[lastIndex];
      const lastEntity = this.indexToEntity.get(lastIndex)!;
      this.entityToIndex.set(lastEntity, index);
      this.indexToEntity.set(index, lastEntity);
    }
    
    this.data.pop();
    this.entityToIndex.delete(entity);
    this.indexToEntity.delete(lastIndex);
  }
  
  get(entity: EntityID): T | undefined {
    const index = this.entityToIndex.get(entity);
    return index !== undefined ? this.data[index] : undefined;
  }
  
  getAll(): T[] {
    return this.data;
  }
}

// System: Logic operating on components
interface System {
  update(deltaTime: number): void;
}

class RenderSystem implements System {
  private world: World;
  private renderer: Renderer;
  private camera: Camera;
  
  update(deltaTime: number): void {
    // Query entities with Transform + Mesh components
    const transforms = this.world.getComponents(TransformComponent);
    const meshes = this.world.getComponents(MeshComponent);
    
    // Render each entity
    for (let i = 0; i < transforms.length; i++) {
      this.renderer.drawMesh(
        meshes[i],
        transforms[i].toMatrix(),
        this.camera
      );
    }
  }
}

class PhysicsSystem implements System {
  private physicsWorld: PhysicsWorld;
  
  update(deltaTime: number): void {
    // Sync Transform → RigidBody
    const entities = this.world.queryEntities([TransformComponent, RigidBodyComponent]);
    
    for (const entity of entities) {
      const transform = this.world.getComponent(entity, TransformComponent);
      const rigidBody = this.world.getComponent(entity, RigidBodyComponent);
      
      rigidBody.position.copy(transform.position);
      rigidBody.rotation.copy(transform.rotation);
    }
    
    // Simulate physics
    this.physicsWorld.step(deltaTime);
    
    // Sync RigidBody → Transform
    for (const entity of entities) {
      const transform = this.world.getComponent(entity, TransformComponent);
      const rigidBody = this.world.getComponent(entity, RigidBodyComponent);
      
      transform.position.copy(rigidBody.position);
      transform.rotation.copy(rigidBody.rotation);
    }
  }
}

// World: Manages entities, components, and systems
class World {
  private nextEntityID: EntityID = 0;
  private entities: Set<EntityID> = new Set();
  private componentArrays: Map<Function, ComponentArray<any>> = new Map();
  private systems: System[] = [];
  
  createEntity(): EntityID {
    const id = this.nextEntityID++;
    this.entities.add(id);
    return id;
  }
  
  destroyEntity(entity: EntityID): void {
    // Remove all components
    for (const array of this.componentArrays.values()) {
      array.remove(entity);
    }
    this.entities.delete(entity);
  }
  
  addComponent<T extends Component>(entity: EntityID, component: T): void {
    const type = component.constructor;
    
    if (!this.componentArrays.has(type)) {
      this.componentArrays.set(type, new ComponentArray<T>());
    }
    
    this.componentArrays.get(type)!.add(entity, component);
  }
  
  getComponent<T extends Component>(entity: EntityID, type: Function): T | undefined {
    const array = this.componentArrays.get(type);
    return array ? array.get(entity) : undefined;
  }
  
  // Main update loop
  update(deltaTime: number): void {
    for (const system of this.systems) {
      system.update(deltaTime);
    }
  }
}
```

---

## 📦 Asset Management Architecture

### **Resource Loading System**

```typescript
class AssetManager {
  private cache: Map<string, Asset> = new Map();
  private loaders: Map<string, AssetLoader> = new Map();
  private loading: Map<string, Promise<Asset>> = new Map();
  
  // Reference counting
  private refCounts: Map<string, number> = new Map();
  
  registerLoader(extension: string, loader: AssetLoader): void {
    this.loaders.set(extension, loader);
  }
  
  async load<T extends Asset>(url: string): Promise<T> {
    // Return cached asset
    if (this.cache.has(url)) {
      this.addRef(url);
      return this.cache.get(url) as T;
    }
    
    // Wait for in-flight load
    if (this.loading.has(url)) {
      this.addRef(url);
      return this.loading.get(url) as Promise<T>;
    }
    
    // Start new load
    const extension = this.getExtension(url);
    const loader = this.loaders.get(extension);
    
    if (!loader) {
      throw new Error(`No loader for extension: ${extension}`);
    }
    
    const promise = loader.load(url);
    this.loading.set(url, promise);
    
    const asset = await promise;
    this.cache.set(url, asset);
    this.loading.delete(url);
    this.addRef(url);
    
    return asset as T;
  }
  
  unload(url: string): void {
    this.removeRef(url);
    
    if (this.refCounts.get(url) === 0) {
      const asset = this.cache.get(url);
      if (asset) {
        asset.dispose();
        this.cache.delete(url);
        this.refCounts.delete(url);
      }
    }
  }
  
  private addRef(url: string): void {
    const count = this.refCounts.get(url) || 0;
    this.refCounts.set(url, count + 1);
  }
  
  private removeRef(url: string): void {
    const count = this.refCounts.get(url) || 0;
    if (count > 0) {
      this.refCounts.set(url, count - 1);
    }
  }
}
```

---

## 🌐 Multiplayer Architecture

### **Network Synchronization**

```typescript
class NetworkManager {
  // Connection
  private connection: NetworkConnection;
  
  // Synchronized objects
  private networkObjects: Map<number, NetworkObject> = new Map();
  
  // Replication
  private replicationRate: number = 20;  // 20 updates/sec
  private lastReplicationTime: number = 0;
  
  update(deltaTime: number): void {
    this.lastReplicationTime += deltaTime;
    
    if (this.lastReplicationTime >= 1 / this.replicationRate) {
      this.replicateState();
      this.lastReplicationTime = 0;
    }
  }
  
  private replicateState(): void {
    const snapshot = this.createSnapshot();
    this.connection.send('STATE_UPDATE', snapshot);
  }
  
  private createSnapshot(): NetworkSnapshot {
    const snapshot: NetworkSnapshot = {
      timestamp: Date.now(),
      objects: []
    };
    
    for (const [id, obj] of this.networkObjects) {
      if (obj.isDirty()) {
        snapshot.objects.push({
          id: id,
          data: obj.serialize()
        });
      }
    }
    
    return snapshot;
  }
  
  receiveSnapshot(snapshot: NetworkSnapshot): void {
    for (const objData of snapshot.objects) {
      const obj = this.networkObjects.get(objData.id);
      if (obj) {
        obj.deserialize(objData.data);
      }
    }
  }
}
```

---

**"Great architecture is the foundation of great software."**

---

**Last Updated:** 2026-01-06  
**Version:** 1.0  
**Status:** Complete architecture specification
