import { WebGLContext } from './WebGLContext';
import { Shader } from './Shader';
import { Buffer, BufferType, BufferUsage } from './Buffer';
import { Camera } from './Camera';
import { Vector3 } from '../math/Vector3';
import { Logger } from '../core/Logger';

/**
 * Debug rendering utilities for visualizing geometry and transforms.
 * Provides immediate-mode style drawing of lines, boxes, spheres, etc.
 */
export class DebugRenderer {
  private gl: WebGLRenderingContext | WebGL2RenderingContext;
  private logger: Logger;

  private lineShader: Shader | null = null;
  private lineBuffer: Buffer | null = null;
  private lineVertices: number[] = [];

  private enabled: boolean = true;

  /**
   * Creates a new debug renderer
   * @param context - WebGL context
   */
  constructor(context: WebGLContext) {
    this.gl = context.getGL();
    this.logger = new Logger('DebugRenderer');

    this.initializeShader();
    this.initializeBuffers();

    this.logger.info('DebugRenderer initialized');
  }

  /**
   * Initializes line shader
   */
  private async initializeShader(): Promise<void> {
    const vertexShaderSource = `
      attribute vec3 aPosition;
      attribute vec3 aColor;
      
      uniform mat4 uViewProjectionMatrix;
      
      varying vec3 vColor;
      
      void main() {
        vColor = aColor;
        gl_Position = uViewProjectionMatrix * vec4(aPosition, 1.0);
      }
    `;

    const fragmentShaderSource = `
      precision mediump float;
      
      varying vec3 vColor;
      
      void main() {
        gl_FragColor = vec4(vColor, 1.0);
      }
    `;

    try {
      this.lineShader = new Shader(this.gl, vertexShaderSource, fragmentShaderSource);
      await this.lineShader.compile();
    } catch (error) {
      this.logger.error('Failed to create debug shader:', error);
    }
  }

  /**
   * Initializes line buffers
   */
  private initializeBuffers(): void {
    this.lineBuffer = new Buffer(this.gl, BufferType.VERTEX, BufferUsage.DYNAMIC);
  }

  /**
   * Enables or disables debug rendering
   * @param enabled - Enable state
   */
  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Checks if debug rendering is enabled
   */
  public isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Draws a line
   * @param start - Start position
   * @param end - End position
   * @param color - Line color (default: white)
   */
  public drawLine(start: Vector3, end: Vector3, color: Vector3 = new Vector3(1, 1, 1)): void {
    if (!this.enabled) return;

    this.lineVertices.push(
      start.x, start.y, start.z, color.x, color.y, color.z,
      end.x, end.y, end.z, color.x, color.y, color.z
    );
  }

  /**
   * Draws an axis-aligned bounding box
   * @param min - Minimum corner
   * @param max - Maximum corner
   * @param color - Box color (default: white)
   */
  public drawBox(min: Vector3, max: Vector3, color: Vector3 = new Vector3(1, 1, 1)): void {
    if (!this.enabled) return;

    // Bottom face
    this.drawLine(new Vector3(min.x, min.y, min.z), new Vector3(max.x, min.y, min.z), color);
    this.drawLine(new Vector3(max.x, min.y, min.z), new Vector3(max.x, min.y, max.z), color);
    this.drawLine(new Vector3(max.x, min.y, max.z), new Vector3(min.x, min.y, max.z), color);
    this.drawLine(new Vector3(min.x, min.y, max.z), new Vector3(min.x, min.y, min.z), color);

    // Top face
    this.drawLine(new Vector3(min.x, max.y, min.z), new Vector3(max.x, max.y, min.z), color);
    this.drawLine(new Vector3(max.x, max.y, min.z), new Vector3(max.x, max.y, max.z), color);
    this.drawLine(new Vector3(max.x, max.y, max.z), new Vector3(min.x, max.y, max.z), color);
    this.drawLine(new Vector3(min.x, max.y, max.z), new Vector3(min.x, max.y, min.z), color);

    // Vertical edges
    this.drawLine(new Vector3(min.x, min.y, min.z), new Vector3(min.x, max.y, min.z), color);
    this.drawLine(new Vector3(max.x, min.y, min.z), new Vector3(max.x, max.y, min.z), color);
    this.drawLine(new Vector3(max.x, min.y, max.z), new Vector3(max.x, max.y, max.z), color);
    this.drawLine(new Vector3(min.x, min.y, max.z), new Vector3(min.x, max.y, max.z), color);
  }

  /**
   * Draws a sphere wireframe
   * @param center - Sphere center
   * @param radius - Sphere radius
   * @param segments - Number of segments (default: 16)
   * @param color - Sphere color (default: white)
   */
  public drawSphere(
    center: Vector3,
    radius: number,
    segments: number = 16,
    color: Vector3 = new Vector3(1, 1, 1)
  ): void {
    if (!this.enabled) return;

    const angleStep = (Math.PI * 2) / segments;

    // XY circle
    for (let i = 0; i < segments; i++) {
      const angle1 = i * angleStep;
      const angle2 = (i + 1) * angleStep;

      const x1 = center.x + Math.cos(angle1) * radius;
      const y1 = center.y + Math.sin(angle1) * radius;
      const x2 = center.x + Math.cos(angle2) * radius;
      const y2 = center.y + Math.sin(angle2) * radius;

      this.drawLine(new Vector3(x1, y1, center.z), new Vector3(x2, y2, center.z), color);
    }

    // XZ circle
    for (let i = 0; i < segments; i++) {
      const angle1 = i * angleStep;
      const angle2 = (i + 1) * angleStep;

      const x1 = center.x + Math.cos(angle1) * radius;
      const z1 = center.z + Math.sin(angle1) * radius;
      const x2 = center.x + Math.cos(angle2) * radius;
      const z2 = center.z + Math.sin(angle2) * radius;

      this.drawLine(new Vector3(x1, center.y, z1), new Vector3(x2, center.y, z2), color);
    }

    // YZ circle
    for (let i = 0; i < segments; i++) {
      const angle1 = i * angleStep;
      const angle2 = (i + 1) * angleStep;

      const y1 = center.y + Math.cos(angle1) * radius;
      const z1 = center.z + Math.sin(angle1) * radius;
      const y2 = center.y + Math.cos(angle2) * radius;
      const z2 = center.z + Math.sin(angle2) * radius;

      this.drawLine(new Vector3(center.x, y1, z1), new Vector3(center.x, y2, z2), color);
    }
  }

  /**
   * Draws coordinate axes
   * @param origin - Origin position
   * @param size - Axis size (default: 1)
   */
  public drawAxes(origin: Vector3 = Vector3.zero(), size: number = 1): void {
    if (!this.enabled) return;

    // X axis (red)
    this.drawLine(origin, new Vector3(origin.x + size, origin.y, origin.z), new Vector3(1, 0, 0));
    // Y axis (green)
    this.drawLine(origin, new Vector3(origin.x, origin.y + size, origin.z), new Vector3(0, 1, 0));
    // Z axis (blue)
    this.drawLine(origin, new Vector3(origin.x, origin.y, origin.z + size), new Vector3(0, 0, 1));
  }

  /**
   * Draws a grid on the XZ plane
   * @param size - Grid size
   * @param divisions - Number of divisions
   * @param color - Grid color (default: gray)
   */
  public drawGrid(size: number = 10, divisions: number = 10, color: Vector3 = new Vector3(0.5, 0.5, 0.5)): void {
    if (!this.enabled) return;

    const halfSize = size / 2;
    const step = size / divisions;

    for (let i = 0; i <= divisions; i++) {
      const pos = -halfSize + i * step;

      // Lines parallel to X axis
      this.drawLine(
        new Vector3(-halfSize, 0, pos),
        new Vector3(halfSize, 0, pos),
        color
      );

      // Lines parallel to Z axis
      this.drawLine(
        new Vector3(pos, 0, -halfSize),
        new Vector3(pos, 0, halfSize),
        color
      );
    }
  }

  /**
   * Renders all queued debug geometry
   * @param camera - Camera to render with
   */
  public render(camera: Camera): void {
    if (!this.enabled || this.lineVertices.length === 0) return;
    if (!this.lineShader || !this.lineBuffer) return;

    // Upload line data
    this.lineBuffer.setData(new Float32Array(this.lineVertices));

    // Use shader
    this.lineShader.use();

    // Set view-projection matrix
    const viewProjectionMatrix = camera.getViewProjectionMatrix();
    this.lineShader.setUniformMatrix4fv('uViewProjectionMatrix', viewProjectionMatrix.elements);

    // Bind buffer and set up attributes
    this.lineBuffer.bind();

    const posLocation = this.lineShader.getAttribLocation('aPosition');
    const colorLocation = this.lineShader.getAttribLocation('aColor');

    if (posLocation !== -1) {
      this.gl.enableVertexAttribArray(posLocation);
      this.gl.vertexAttribPointer(posLocation, 3, this.gl.FLOAT, false, 6 * 4, 0);
    }

    if (colorLocation !== -1) {
      this.gl.enableVertexAttribArray(colorLocation);
      this.gl.vertexAttribPointer(colorLocation, 3, this.gl.FLOAT, false, 6 * 4, 3 * 4);
    }

    // Disable depth test for debug rendering
    this.gl.disable(this.gl.DEPTH_TEST);

    // Draw lines
    const lineCount = this.lineVertices.length / 6 / 2;
    this.gl.drawArrays(this.gl.LINES, 0, lineCount * 2);

    // Re-enable depth test
    this.gl.enable(this.gl.DEPTH_TEST);

    // Cleanup
    if (posLocation !== -1) {
      this.gl.disableVertexAttribArray(posLocation);
    }
    if (colorLocation !== -1) {
      this.gl.disableVertexAttribArray(colorLocation);
    }

    this.lineBuffer.unbind();
  }

  /**
   * Clears all queued debug geometry
   */
  public clear(): void {
    this.lineVertices = [];
  }

  /**
   * Destroys debug renderer and releases resources
   */
  public destroy(): void {
    if (this.lineShader) {
      this.lineShader.destroy();
      this.lineShader = null;
    }

    if (this.lineBuffer) {
      this.lineBuffer.destroy();
      this.lineBuffer = null;
    }

    this.lineVertices = [];
    this.logger.info('DebugRenderer destroyed');
  }
}
