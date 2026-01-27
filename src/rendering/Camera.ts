import { Matrix4 } from '../math/Matrix4';
import { Vector3 } from '../math/Vector3';
import { Transform } from '../math/Transform';

/**
 * Camera projection type
 */
export type ProjectionType = 'perspective' | 'orthographic';

/**
 * Camera for rendering scenes.
 * Manages view and projection matrices.
 */
export class Camera {
  private transform: Transform;
  private projectionType: ProjectionType = 'perspective';
  
  // Perspective parameters
  private fov: number = Math.PI / 4; // 45 degrees
  private aspect: number = 16 / 9;
  private near: number = 0.1;
  private far: number = 1000;
  
  // Orthographic parameters
  private left: number = -1;
  private right: number = 1;
  private bottom: number = -1;
  private top: number = 1;
  private orthoNear: number = 0.1;
  private orthoFar: number = 1000;

  // Cached matrices
  private viewMatrix: Matrix4;
  private projectionMatrix: Matrix4;
  private viewProjectionMatrix: Matrix4;
  
  private viewDirty: boolean = true;
  private projectionDirty: boolean = true;

  /**
   * Creates a new camera
   */
  constructor() {
    this.transform = new Transform();
    this.viewMatrix = new Matrix4();
    this.projectionMatrix = new Matrix4();
    this.viewProjectionMatrix = new Matrix4();

    // Set up transform change callback
    this.transform.onChange(() => {
      this.viewDirty = true;
    });

    this.updateProjectionMatrix();
  }

  /**
   * Gets camera transform
   */
  public getTransform(): Transform {
    return this.transform;
  }

  /**
   * Sets camera position
   * @param position - World position
   */
  public setPosition(position: Vector3): void {
    this.transform.position.copy(position);
  }

  /**
   * Gets camera position
   */
  public getPosition(): Vector3 {
    return this.transform.position;
  }

  /**
   * Makes camera look at a target
   * @param target - Target position
   * @param up - Up vector (default: Vector3.up())
   */
  public lookAt(target: Vector3, up: Vector3 = Vector3.up()): void {
    this.transform.lookAt(target, up);
  }

  /**
   * Sets perspective projection
   * @param fov - Field of view in radians
   * @param aspect - Aspect ratio (width / height)
   * @param near - Near clipping plane
   * @param far - Far clipping plane
   */
  public setPerspective(fov: number, aspect: number, near: number, far: number): void {
    this.projectionType = 'perspective';
    this.fov = fov;
    this.aspect = aspect;
    this.near = near;
    this.far = far;
    this.projectionDirty = true;
  }

  /**
   * Sets orthographic projection
   * @param left - Left clipping plane
   * @param right - Right clipping plane
   * @param bottom - Bottom clipping plane
   * @param top - Top clipping plane
   * @param near - Near clipping plane
   * @param far - Far clipping plane
   */
  public setOrthographic(
    left: number,
    right: number,
    bottom: number,
    top: number,
    near: number,
    far: number
  ): void {
    this.projectionType = 'orthographic';
    this.left = left;
    this.right = right;
    this.bottom = bottom;
    this.top = top;
    this.orthoNear = near;
    this.orthoFar = far;
    this.projectionDirty = true;
  }

  /**
   * Gets projection type
   */
  public getProjectionType(): ProjectionType {
    return this.projectionType;
  }

  /**
   * Gets field of view (perspective only)
   */
  public getFov(): number {
    return this.fov;
  }

  /**
   * Sets field of view (perspective only)
   * @param fov - Field of view in radians
   */
  public setFov(fov: number): void {
    this.fov = fov;
    if (this.projectionType === 'perspective') {
      this.projectionDirty = true;
    }
  }

  /**
   * Gets aspect ratio (perspective only)
   */
  public getAspect(): number {
    return this.aspect;
  }

  /**
   * Sets aspect ratio (perspective only)
   * @param aspect - Aspect ratio (width / height)
   */
  public setAspect(aspect: number): void {
    this.aspect = aspect;
    if (this.projectionType === 'perspective') {
      this.projectionDirty = true;
    }
  }

  /**
   * Gets near clipping plane
   */
  public getNear(): number {
    return this.projectionType === 'perspective' ? this.near : this.orthoNear;
  }

  /**
   * Gets far clipping plane
   */
  public getFar(): number {
    return this.projectionType === 'perspective' ? this.far : this.orthoFar;
  }

  /**
   * Gets view matrix
   */
  public getViewMatrix(): Matrix4 {
    if (this.viewDirty) {
      this.updateViewMatrix();
    }
    return this.viewMatrix;
  }

  /**
   * Gets projection matrix
   */
  public getProjectionMatrix(): Matrix4 {
    if (this.projectionDirty) {
      this.updateProjectionMatrix();
    }
    return this.projectionMatrix;
  }

  /**
   * Gets combined view-projection matrix
   */
  public getViewProjectionMatrix(): Matrix4 {
    if (this.viewDirty) {
      this.updateViewMatrix();
    }
    if (this.projectionDirty) {
      this.updateProjectionMatrix();
    }
    
    this.viewProjectionMatrix.copy(this.projectionMatrix);
    this.viewProjectionMatrix.multiplySelf(this.viewMatrix);
    
    return this.viewProjectionMatrix;
  }

  /**
   * Updates view matrix from transform
   */
  private updateViewMatrix(): void {
    const worldMatrix = this.transform.getWorldMatrix();
    this.viewMatrix = worldMatrix.invert();
    this.viewDirty = false;
  }

  /**
   * Updates projection matrix based on current parameters
   */
  private updateProjectionMatrix(): void {
    if (this.projectionType === 'perspective') {
      this.projectionMatrix = Matrix4.perspective(
        this.fov,
        this.aspect,
        this.near,
        this.far
      );
    } else {
      this.projectionMatrix = Matrix4.orthographic(
        this.left,
        this.right,
        this.bottom,
        this.top,
        this.orthoNear,
        this.orthoFar
      );
    }
    this.projectionDirty = false;
  }

  /**
   * Converts screen coordinates to world ray
   * @param screenX - Screen X coordinate (0-1)
   * @param screenY - Screen Y coordinate (0-1)
   * @returns Ray direction in world space
   */
  public screenToWorldRay(screenX: number, screenY: number): { origin: Vector3; direction: Vector3 } {
    // Convert screen coordinates to NDC
    const ndcX = screenX * 2 - 1;
    const ndcY = -(screenY * 2 - 1); // Flip Y

    // Get inverse view-projection matrix
    const viewProj = this.getViewProjectionMatrix();
    const invViewProj = viewProj.clone().invert();

    // Near and far points in NDC
    const nearNDC = new Vector3(ndcX, ndcY, -1);
    const farNDC = new Vector3(ndcX, ndcY, 1);

    // Transform to world space
    const nearWorld = invViewProj.transformPoint(nearNDC);
    const farWorld = invViewProj.transformPoint(farNDC);

    // Calculate ray direction
    const direction = farWorld.subtract(nearWorld).normalize();

    return {
      origin: nearWorld,
      direction
    };
  }

  /**
   * Creates a copy of this camera
   * @returns Cloned camera
   */
  public clone(): Camera {
    const camera = new Camera();
    
    camera.transform.position.copy(this.transform.position);
    camera.transform.rotation.copy(this.transform.rotation);
    camera.transform.scale.copy(this.transform.scale);
    
    camera.projectionType = this.projectionType;
    camera.fov = this.fov;
    camera.aspect = this.aspect;
    camera.near = this.near;
    camera.far = this.far;
    camera.left = this.left;
    camera.right = this.right;
    camera.bottom = this.bottom;
    camera.top = this.top;
    camera.orthoNear = this.orthoNear;
    camera.orthoFar = this.orthoFar;
    
    camera.projectionDirty = true;
    camera.viewDirty = true;
    
    return camera;
  }
}
