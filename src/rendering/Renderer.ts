import { WebGLContext } from './WebGLContext';
import { Camera } from './Camera';
import { Mesh } from './Mesh';
import { Material } from './Material';
import { Scene } from '../scene/Scene';
import { Matrix4 } from '../math/Matrix4';
import { EventSystem } from '../core/EventSystem';
import { Logger } from '../core/Logger';

/**
 * Renderer configuration
 */
export interface RendererConfig {
  /** WebGL context */
  context: WebGLContext;
  /** Clear color */
  clearColor?: { r: number; g: number; b: number; a: number };
  /** Enable depth sorting */
  depthSort?: boolean;
}

/**
 * Renderable object interface
 */
export interface Renderable {
  /** Mesh to render */
  mesh: Mesh;
  /** Material for rendering */
  material: Material;
  /** World transform matrix */
  worldMatrix: Matrix4;
  /** Distance from camera (for sorting) */
  distance?: number;
}

/**
 * Forward renderer for rendering scenes.
 * Handles render queue, sorting, and draw calls.
 */
export class Renderer {
  private context: WebGLContext;
  private logger: Logger;
  private events: EventSystem;

  private clearColor: { r: number; g: number; b: number; a: number };
  private depthSort: boolean;

  private renderQueue: Renderable[] = [];
  private drawCalls: number = 0;
  private triangles: number = 0;

  /**
   * Creates a new renderer
   * @param config - Renderer configuration
   */
  constructor(config: RendererConfig) {
    this.context = config.context;
    this.logger = new Logger('Renderer');
    this.events = new EventSystem();

    this.clearColor = config.clearColor || { r: 0.2, g: 0.2, b: 0.2, a: 1.0 };
    this.depthSort = config.depthSort !== undefined ? config.depthSort : false;

    this.logger.info('Renderer initialized');
  }

  /**
   * Sets clear color
   * @param r - Red component (0-1)
   * @param g - Green component (0-1)
   * @param b - Blue component (0-1)
   * @param a - Alpha component (0-1)
   */
  public setClearColor(r: number, g: number, b: number, a: number): void {
    this.clearColor = { r, g, b, a };
  }

  /**
   * Enables or disables depth sorting
   * @param enabled - Enable depth sorting
   */
  public setDepthSort(enabled: boolean): void {
    this.depthSort = enabled;
  }

  /**
   * Renders a scene with a camera
   * @param scene - Scene to render
   * @param camera - Camera to render with
   */
  public render(scene: Scene, camera: Camera): void {
    this.events.emit('render:begin');

    // Clear buffers
    this.context.setClearColor(
      this.clearColor.r,
      this.clearColor.g,
      this.clearColor.b,
      this.clearColor.a
    );
    const gl = this.context.getGL();
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);

    // Reset statistics
    this.drawCalls = 0;
    this.triangles = 0;
    this.renderQueue = [];

    // Build render queue from scene
    this.buildRenderQueue(scene, camera);

    // Sort render queue if depth sorting enabled
    if (this.depthSort) {
      this.sortRenderQueue();
    }

    // Get view and projection matrices
    const viewMatrix = camera.getViewMatrix();
    const projectionMatrix = camera.getProjectionMatrix();
    const viewProjectionMatrix = camera.getViewProjectionMatrix();

    // Render all items in queue
    for (const renderable of this.renderQueue) {
      this.renderObject(renderable, viewMatrix, projectionMatrix, viewProjectionMatrix);
    }

    this.events.emit('render:end', {
      drawCalls: this.drawCalls,
      triangles: this.triangles
    });
  }

  /**
   * Builds render queue from scene game objects
   * @param scene - Scene to build queue from
   * @param camera - Camera for distance calculations
   */
  private buildRenderQueue(scene: Scene, camera: Camera): void {
    const gameObjects = scene.getAllObjects();
    const cameraPos = camera.getPosition();

    for (const obj of gameObjects) {
      // Type cast for component access
      const typedObj = obj as any;
      
      // Check if object has mesh and material components
      const mesh = typedObj.getComponent?.('Mesh') as Mesh | undefined;
      const material = typedObj.getComponent?.('Material') as Material | undefined;

      if (!mesh || !material) {
        continue;
      }

      // Calculate distance from camera
      const transform = typedObj.transform;
      if (!transform) continue;

      const worldPos = transform.getWorldPosition();
      const distance = cameraPos.distanceTo(worldPos);

      this.renderQueue.push({
        mesh,
        material,
        worldMatrix: transform.getWorldMatrix(),
        distance
      });
    }
  }

  /**
   * Sorts render queue by distance (back to front for transparency)
   */
  private sortRenderQueue(): void {
    this.renderQueue.sort((a, b) => {
      const distA = a.distance !== undefined ? a.distance : 0;
      const distB = b.distance !== undefined ? b.distance : 0;
      return distB - distA; // Back to front
    });
  }

  /**
   * Renders a single object
   * @param renderable - Renderable object
   * @param viewMatrix - View matrix
   * @param projectionMatrix - Projection matrix
   * @param viewProjectionMatrix - Combined view-projection matrix
   */
  private renderObject(
    renderable: Renderable,
    viewMatrix: Matrix4,
    projectionMatrix: Matrix4,
    viewProjectionMatrix: Matrix4
  ): void {
    const { mesh, material, worldMatrix } = renderable;

    // Apply material (sets up shader and render state)
    material.use();

    const shader = material.getShader();

    // Set common uniforms
    if (shader.hasUniform('uModelMatrix')) {
      shader.setUniformMatrix4fv('uModelMatrix', worldMatrix.elements);
    }

    if (shader.hasUniform('uViewMatrix')) {
      shader.setUniformMatrix4fv('uViewMatrix', viewMatrix.elements);
    }

    if (shader.hasUniform('uProjectionMatrix')) {
      shader.setUniformMatrix4fv('uProjectionMatrix', projectionMatrix.elements);
    }

    if (shader.hasUniform('uViewProjectionMatrix')) {
      shader.setUniformMatrix4fv('uViewProjectionMatrix', viewProjectionMatrix.elements);
    }

    // Calculate and set MVP matrix
    if (shader.hasUniform('uMVPMatrix')) {
      const mvp = viewProjectionMatrix.clone().multiply(worldMatrix);
      shader.setUniformMatrix4fv('uMVPMatrix', mvp.elements);
    }

    // Calculate and set normal matrix
    if (shader.hasUniform('uNormalMatrix')) {
      const normalMatrix = worldMatrix.clone().invert().transpose();
      shader.setUniformMatrix3fv('uNormalMatrix', [
        normalMatrix.elements[0], normalMatrix.elements[1], normalMatrix.elements[2],
        normalMatrix.elements[4], normalMatrix.elements[5], normalMatrix.elements[6],
        normalMatrix.elements[8], normalMatrix.elements[9], normalMatrix.elements[10]
      ]);
    }

    // Bind mesh and draw
    mesh.bind(shader);
    mesh.draw();
    mesh.unbind(shader);

    // Update statistics
    this.drawCalls++;
    this.triangles += mesh.getIndexCount() > 0 
      ? Math.floor(mesh.getIndexCount() / 3)
      : Math.floor(mesh.getVertexCount() / 3);
  }

  /**
   * Gets render statistics
   * @returns Render statistics
   */
  public getStats(): { drawCalls: number; triangles: number } {
    return {
      drawCalls: this.drawCalls,
      triangles: this.triangles
    };
  }

  /**
   * Gets event system
   */
  public getEvents(): EventSystem {
    return this.events;
  }

  /**
   * Gets WebGL context
   */
  public getContext(): WebGLContext {
    return this.context;
  }

  /**
   * Resizes renderer viewport
   * @param width - New width
   * @param height - New height
   */
  public resize(width: number, height: number): void {
    this.context.setViewport(0, 0, width, height);
    this.logger.info(`Renderer resized to ${width}x${height}`);
  }

  /**
   * Destroys renderer
   */
  public destroy(): void {
    this.renderQueue = [];
    this.logger.info('Renderer destroyed');
  }
}
