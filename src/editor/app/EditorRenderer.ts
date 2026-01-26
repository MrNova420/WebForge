/**
 * @fileoverview EditorRenderer - WebGL Rendering for the Editor
 * @module editor/app
 * 
 * Handles 3D rendering in the editor scene view including:
 * - Grid rendering
 * - Object rendering
 * - Gizmo rendering
 * - Selection highlighting
 * - Camera controls
 * 
 * @author MrNova420
 * @license MIT
 */

import { WebGLContext } from '../../rendering/WebGLContext';
import { Camera } from '../../rendering/Camera';
import { EditorContext } from '../EditorContext';
import { GameObject } from '../../scene/GameObject';
import { Vector3 } from '../../math/Vector3';
import { Matrix4 } from '../../math/Matrix4';
import { Logger } from '../../core/Logger';
import type { EditorScene } from './EditorScene';

/**
 * Render statistics
 */
export interface RenderStats {
    drawCalls: number;
    triangles: number;
    vertices: number;
}

/**
 * Camera view preset
 */
export type CameraView = 'top' | 'front' | 'right' | 'left' | 'back' | 'bottom' | 'perspective';

/**
 * Editor Renderer
 * 
 * Handles all WebGL rendering for the editor viewport.
 */
export class EditorRenderer {
    private glContext: WebGLContext;
    private context: EditorContext;
    private logger: Logger;
    
    // Camera
    private camera: Camera;
    private cameraTarget: Vector3 = new Vector3(0, 0, 0);
    private cameraDistance: number = 10;
    private cameraRotation: { theta: number; phi: number } = { theta: Math.PI / 4, phi: Math.PI / 4 };
    
    // WebGL resources
    private gridShader: WebGLProgram | null = null;
    private objectShader: WebGLProgram | null = null;
    private lineShader: WebGLProgram | null = null;
    private gridVAO: WebGLVertexArrayObject | null = null;
    private gridVertexCount: number = 0;
    
    // Primitive buffers
    private cubeVAO: WebGLVertexArrayObject | null = null;
    private sphereVAO: WebGLVertexArrayObject | null = null;
    private planeVAO: WebGLVertexArrayObject | null = null;
    
    // Settings
    private wireframe: boolean = false;
    private showGrid: boolean = true;
    private backgroundColor: [number, number, number, number] = [0.1, 0.1, 0.12, 1.0];
    
    // Statistics
    private stats: RenderStats = { drawCalls: 0, triangles: 0, vertices: 0 };
    
    // Input state
    private isDragging: boolean = false;
    private lastMouseX: number = 0;
    private lastMouseY: number = 0;
    private dragButton: number = -1;

    constructor(glContext: WebGLContext, context: EditorContext) {
        this.glContext = glContext;
        this.context = context;
        this.logger = new Logger('EditorRenderer');
        
        // Create camera
        const aspect = glContext.getWidth() / glContext.getHeight();
        this.camera = new Camera();
        this.camera.setPerspective(60 * Math.PI / 180, aspect, 0.1, 1000);
        this.camera.setPosition(new Vector3(5, 5, 5));
        this.camera.lookAt(this.cameraTarget);
        
        // Initialize WebGL resources
        this.initShaders();
        this.initGrid();
        this.initPrimitives();
        this.setupInputHandlers();
        
        this.logger.info('EditorRenderer initialized');
    }

    /**
     * Initialize shaders
     */
    private initShaders(): void {
        const gl = this.glContext.getGL() as WebGL2RenderingContext;
        
        // Grid shader
        const gridVS = `#version 300 es
            in vec3 aPosition;
            in vec3 aColor;
            out vec3 vColor;
            uniform mat4 uViewProjection;
            void main() {
                vColor = aColor;
                gl_Position = uViewProjection * vec4(aPosition, 1.0);
            }
        `;
        
        const gridFS = `#version 300 es
            precision highp float;
            in vec3 vColor;
            out vec4 fragColor;
            void main() {
                fragColor = vec4(vColor, 1.0);
            }
        `;
        
        this.gridShader = this.createProgram(gl, gridVS, gridFS);
        
        // Object shader (simple lit)
        const objectVS = `#version 300 es
            in vec3 aPosition;
            in vec3 aNormal;
            out vec3 vNormal;
            out vec3 vWorldPos;
            uniform mat4 uModel;
            uniform mat4 uViewProjection;
            uniform mat3 uNormalMatrix;
            void main() {
                vNormal = uNormalMatrix * aNormal;
                vec4 worldPos = uModel * vec4(aPosition, 1.0);
                vWorldPos = worldPos.xyz;
                gl_Position = uViewProjection * worldPos;
            }
        `;
        
        const objectFS = `#version 300 es
            precision highp float;
            in vec3 vNormal;
            in vec3 vWorldPos;
            out vec4 fragColor;
            uniform vec3 uColor;
            uniform vec3 uCameraPos;
            uniform bool uSelected;
            void main() {
                vec3 normal = normalize(vNormal);
                vec3 lightDir = normalize(vec3(1.0, 2.0, 1.5));
                float diffuse = max(dot(normal, lightDir), 0.0);
                float ambient = 0.3;
                vec3 color = uColor * (ambient + diffuse * 0.7);
                
                // Selection highlight
                if (uSelected) {
                    vec3 viewDir = normalize(uCameraPos - vWorldPos);
                    float fresnel = 1.0 - max(dot(normal, viewDir), 0.0);
                    color += vec3(0.0, 0.5, 1.0) * fresnel * 0.5;
                }
                
                fragColor = vec4(color, 1.0);
            }
        `;
        
        this.objectShader = this.createProgram(gl, objectVS, objectFS);
        
        // Line shader (for gizmos)
        const lineVS = `#version 300 es
            in vec3 aPosition;
            in vec3 aColor;
            out vec3 vColor;
            uniform mat4 uViewProjection;
            void main() {
                vColor = aColor;
                gl_Position = uViewProjection * vec4(aPosition, 1.0);
            }
        `;
        
        const lineFS = `#version 300 es
            precision highp float;
            in vec3 vColor;
            out vec4 fragColor;
            void main() {
                fragColor = vec4(vColor, 1.0);
            }
        `;
        
        this.lineShader = this.createProgram(gl, lineVS, lineFS);
    }

    /**
     * Create WebGL program
     */
    private createProgram(gl: WebGL2RenderingContext, vsSource: string, fsSource: string): WebGLProgram {
        const vertexShader = gl.createShader(gl.VERTEX_SHADER)!;
        gl.shaderSource(vertexShader, vsSource);
        gl.compileShader(vertexShader);
        
        if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
            throw new Error('Vertex shader compile error: ' + gl.getShaderInfoLog(vertexShader));
        }
        
        const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER)!;
        gl.shaderSource(fragmentShader, fsSource);
        gl.compileShader(fragmentShader);
        
        if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
            throw new Error('Fragment shader compile error: ' + gl.getShaderInfoLog(fragmentShader));
        }
        
        const program = gl.createProgram()!;
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);
        
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            throw new Error('Program link error: ' + gl.getProgramInfoLog(program));
        }
        
        gl.deleteShader(vertexShader);
        gl.deleteShader(fragmentShader);
        
        return program;
    }

    /**
     * Initialize grid geometry
     */
    private initGrid(): void {
        const gl = this.glContext.getGL();
        if (!gl) return;
        
        const gridSize = 20;
        const gridStep = 1;
        const vertices: number[] = [];
        
        const gridColor = [0.3, 0.3, 0.3];
        const axisXColor = [0.8, 0.2, 0.2];
        const axisZColor = [0.2, 0.2, 0.8];
        
        // Grid lines
        for (let i = -gridSize; i <= gridSize; i += gridStep) {
            const color = i === 0 ? axisZColor : gridColor;
            
            // X axis lines
            vertices.push(-gridSize, 0, i, ...color);
            vertices.push(gridSize, 0, i, ...color);
        }
        
        for (let i = -gridSize; i <= gridSize; i += gridStep) {
            const color = i === 0 ? axisXColor : gridColor;
            
            // Z axis lines
            vertices.push(i, 0, -gridSize, ...color);
            vertices.push(i, 0, gridSize, ...color);
        }
        
        this.gridVertexCount = vertices.length / 6;
        
        // Create VAO using WebGLContext (handles WebGL1/2 automatically)
        this.gridVAO = this.glContext.createVertexArray();
        this.glContext.bindVertexArray(this.gridVAO);
        
        const buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
        
        // Position attribute
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0);
        
        // Color attribute
        gl.enableVertexAttribArray(1);
        gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 24, 12);
        
        this.glContext.bindVertexArray(null);
    }

    /**
     * Initialize primitive geometries
     */
    private initPrimitives(): void {
        const gl = this.glContext.getGL() as WebGL2RenderingContext;
        
        // Cube
        this.cubeVAO = this.createCubeVAO(gl);
        
        // Sphere
        this.sphereVAO = this.createSphereVAO(gl, 16, 16);
        
        // Plane
        this.planeVAO = this.createPlaneVAO(gl);
    }

    /**
     * Create cube VAO
     */
    private createCubeVAO(gl: WebGL2RenderingContext): WebGLVertexArrayObject {
        const vertices = [
            // Front face
            -0.5, -0.5,  0.5,  0, 0, 1,
             0.5, -0.5,  0.5,  0, 0, 1,
             0.5,  0.5,  0.5,  0, 0, 1,
            -0.5,  0.5,  0.5,  0, 0, 1,
            // Back face
            -0.5, -0.5, -0.5,  0, 0, -1,
            -0.5,  0.5, -0.5,  0, 0, -1,
             0.5,  0.5, -0.5,  0, 0, -1,
             0.5, -0.5, -0.5,  0, 0, -1,
            // Top face
            -0.5,  0.5, -0.5,  0, 1, 0,
            -0.5,  0.5,  0.5,  0, 1, 0,
             0.5,  0.5,  0.5,  0, 1, 0,
             0.5,  0.5, -0.5,  0, 1, 0,
            // Bottom face
            -0.5, -0.5, -0.5,  0, -1, 0,
             0.5, -0.5, -0.5,  0, -1, 0,
             0.5, -0.5,  0.5,  0, -1, 0,
            -0.5, -0.5,  0.5,  0, -1, 0,
            // Right face
             0.5, -0.5, -0.5,  1, 0, 0,
             0.5,  0.5, -0.5,  1, 0, 0,
             0.5,  0.5,  0.5,  1, 0, 0,
             0.5, -0.5,  0.5,  1, 0, 0,
            // Left face
            -0.5, -0.5, -0.5, -1, 0, 0,
            -0.5, -0.5,  0.5, -1, 0, 0,
            -0.5,  0.5,  0.5, -1, 0, 0,
            -0.5,  0.5, -0.5, -1, 0, 0,
        ];
        
        const indices = [
            0, 1, 2,  0, 2, 3,    // front
            4, 5, 6,  4, 6, 7,    // back
            8, 9, 10, 8, 10, 11,  // top
            12, 13, 14, 12, 14, 15, // bottom
            16, 17, 18, 16, 18, 19, // right
            20, 21, 22, 20, 22, 23, // left
        ];
        
        return this.createVAO(gl, vertices, indices);
    }

    /**
     * Create sphere VAO
     */
    private createSphereVAO(gl: WebGL2RenderingContext, segments: number, rings: number): WebGLVertexArrayObject {
        const vertices: number[] = [];
        const indices: number[] = [];
        
        for (let y = 0; y <= rings; y++) {
            const phi = (y / rings) * Math.PI;
            const sinPhi = Math.sin(phi);
            const cosPhi = Math.cos(phi);
            
            for (let x = 0; x <= segments; x++) {
                const theta = (x / segments) * Math.PI * 2;
                const sinTheta = Math.sin(theta);
                const cosTheta = Math.cos(theta);
                
                const nx = cosTheta * sinPhi;
                const ny = cosPhi;
                const nz = sinTheta * sinPhi;
                
                vertices.push(nx * 0.5, ny * 0.5, nz * 0.5, nx, ny, nz);
            }
        }
        
        for (let y = 0; y < rings; y++) {
            for (let x = 0; x < segments; x++) {
                const first = y * (segments + 1) + x;
                const second = first + segments + 1;
                
                indices.push(first, second, first + 1);
                indices.push(second, second + 1, first + 1);
            }
        }
        
        return this.createVAO(gl, vertices, indices);
    }

    /**
     * Create plane VAO
     */
    private createPlaneVAO(gl: WebGL2RenderingContext): WebGLVertexArrayObject {
        const vertices = [
            -0.5, 0, -0.5,  0, 1, 0,
             0.5, 0, -0.5,  0, 1, 0,
             0.5, 0,  0.5,  0, 1, 0,
            -0.5, 0,  0.5,  0, 1, 0,
        ];
        
        const indices = [0, 1, 2, 0, 2, 3];
        
        return this.createVAO(gl, vertices, indices);
    }

    /**
     * Create generic VAO
     */
    private createVAO(gl: WebGL2RenderingContext, vertices: number[], indices: number[]): WebGLVertexArrayObject {
        const vao = this.glContext.createVertexArray()!;
        this.glContext.bindVertexArray(vao);
        
        // Vertex buffer
        const vbo = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
        
        // Index buffer
        const ebo = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ebo);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);
        
        // Position attribute
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0);
        
        // Normal attribute
        gl.enableVertexAttribArray(1);
        gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 24, 12);
        
        this.glContext.bindVertexArray(null);
        
        // Store index count on vao
        (vao as any).indexCount = indices.length;
        
        return vao;
    }

    /**
     * Setup input handlers for camera control
     */
    private setupInputHandlers(): void {
        const canvas = this.glContext.canvas;
        if (!canvas) return;
        
        canvas.addEventListener('mousedown', this.onMouseDown);
        canvas.addEventListener('mousemove', this.onMouseMove);
        canvas.addEventListener('mouseup', this.onMouseUp);
        canvas.addEventListener('wheel', this.onWheel);
        canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    private onMouseDown = (e: MouseEvent): void => {
        this.isDragging = true;
        this.dragButton = e.button;
        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;
    };

    private onMouseMove = (e: MouseEvent): void => {
        if (!this.isDragging) return;
        
        const dx = e.clientX - this.lastMouseX;
        const dy = e.clientY - this.lastMouseY;
        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;
        
        if (this.dragButton === 0 && e.altKey) {
            // Alt + Left click: Orbit
            this.cameraRotation.theta -= dx * 0.01;
            this.cameraRotation.phi = Math.max(0.1, Math.min(Math.PI - 0.1, this.cameraRotation.phi - dy * 0.01));
            this.updateCameraPosition();
        } else if (this.dragButton === 1 || (this.dragButton === 0 && e.shiftKey)) {
            // Middle click or Shift + Left: Pan
            const panSpeed = this.cameraDistance * 0.002;
            const right = this.camera.getTransform().right();
            
            this.cameraTarget.x -= right.x * dx * panSpeed;
            this.cameraTarget.z -= right.z * dx * panSpeed;
            this.cameraTarget.y += dy * panSpeed;
            this.updateCameraPosition();
        } else if (this.dragButton === 2) {
            // Right click: Orbit (alternative)
            this.cameraRotation.theta -= dx * 0.01;
            this.cameraRotation.phi = Math.max(0.1, Math.min(Math.PI - 0.1, this.cameraRotation.phi - dy * 0.01));
            this.updateCameraPosition();
        }
    };

    private onMouseUp = (): void => {
        this.isDragging = false;
        this.dragButton = -1;
    };

    private onWheel = (e: WheelEvent): void => {
        e.preventDefault();
        const zoomSpeed = 0.1;
        this.cameraDistance *= 1 + e.deltaY * zoomSpeed * 0.01;
        this.cameraDistance = Math.max(1, Math.min(100, this.cameraDistance));
        this.updateCameraPosition();
    };

    /**
     * Update camera position from spherical coordinates
     */
    private updateCameraPosition(): void {
        const x = this.cameraDistance * Math.sin(this.cameraRotation.phi) * Math.cos(this.cameraRotation.theta);
        const y = this.cameraDistance * Math.cos(this.cameraRotation.phi);
        const z = this.cameraDistance * Math.sin(this.cameraRotation.phi) * Math.sin(this.cameraRotation.theta);
        
        this.camera.setPosition(new Vector3(
            this.cameraTarget.x + x,
            this.cameraTarget.y + y,
            this.cameraTarget.z + z
        ));
        this.camera.lookAt(this.cameraTarget);
    }

    /**
     * Render the editor scene
     */
    render(scene: EditorScene, _deltaTime: number): void {
        const gl = this.glContext.getGL() as WebGL2RenderingContext;
        
        // Reset stats
        this.stats = { drawCalls: 0, triangles: 0, vertices: 0 };
        
        // Clear
        gl.clearColor(...this.backgroundColor);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        
        // Enable depth test
        gl.enable(gl.DEPTH_TEST);
        gl.depthFunc(gl.LEQUAL);
        
        // Enable backface culling
        gl.enable(gl.CULL_FACE);
        gl.cullFace(gl.BACK);
        
        // Get view-projection matrix
        const viewProj = this.camera.getViewProjectionMatrix();
        
        // Render grid
        if (this.showGrid) {
            this.renderGrid(gl, viewProj);
        }
        
        // Render scene objects
        this.renderObjects(gl, viewProj, scene);
        
        // Render gizmos for selected objects
        const selected = this.context.getSelection();
        if (selected.length > 0) {
            this.renderGizmos(gl, viewProj, selected);
        }
    }

    /**
     * Render grid
     */
    private renderGrid(gl: WebGL2RenderingContext, viewProj: Matrix4): void {
        if (!this.gridShader || !this.gridVAO) return;
        
        gl.useProgram(this.gridShader);
        gl.uniformMatrix4fv(gl.getUniformLocation(this.gridShader, 'uViewProjection'), false, viewProj.elements);
        
        this.glContext.bindVertexArray(this.gridVAO);
        gl.drawArrays(gl.LINES, 0, this.gridVertexCount);
        this.glContext.bindVertexArray(null);
        
        this.stats.drawCalls++;
        this.stats.vertices += this.gridVertexCount;
    }

    /**
     * Render scene objects
     */
    private renderObjects(gl: WebGL2RenderingContext, viewProj: Matrix4, scene: EditorScene): void {
        if (!this.objectShader) return;
        
        gl.useProgram(this.objectShader);
        gl.uniformMatrix4fv(gl.getUniformLocation(this.objectShader, 'uViewProjection'), false, viewProj.elements);
        gl.uniform3fv(gl.getUniformLocation(this.objectShader, 'uCameraPos'), this.camera.getPosition().toArray());
        
        const selected = this.context.getSelection();
        
        for (const obj of scene.getAllGameObjects()) {
            this.renderObject(gl, obj, selected.includes(obj));
        }
    }

    /**
     * Render single object
     */
    private renderObject(gl: WebGL2RenderingContext, obj: GameObject, isSelected: boolean): void {
        if (!this.objectShader) return;
        
        const modelMatrix = obj.transform.getWorldMatrix();
        gl.uniformMatrix4fv(gl.getUniformLocation(this.objectShader, 'uModel'), false, modelMatrix.elements);
        
        // Normal matrix
        const normalMatrix = modelMatrix.clone().invert().transpose();
        const normalMat3 = [
            normalMatrix.elements[0], normalMatrix.elements[1], normalMatrix.elements[2],
            normalMatrix.elements[4], normalMatrix.elements[5], normalMatrix.elements[6],
            normalMatrix.elements[8], normalMatrix.elements[9], normalMatrix.elements[10]
        ];
        gl.uniformMatrix3fv(gl.getUniformLocation(this.objectShader, 'uNormalMatrix'), false, normalMat3);
        
        // Get object color (from custom data or default)
        const color = (obj as any).editorColor || [0.4, 0.6, 0.8];
        gl.uniform3fv(gl.getUniformLocation(this.objectShader, 'uColor'), color);
        gl.uniform1i(gl.getUniformLocation(this.objectShader, 'uSelected'), isSelected ? 1 : 0);
        
        // Determine primitive type
        const primitiveType = (obj as any).primitiveType || 'cube';
        let vao: WebGLVertexArrayObject | null = null;
        
        switch (primitiveType) {
            case 'cube': vao = this.cubeVAO; break;
            case 'sphere': vao = this.sphereVAO; break;
            case 'plane': vao = this.planeVAO; break;
            default: vao = this.cubeVAO;
        }
        
        if (vao) {
            this.glContext.bindVertexArray(vao);
            const indexCount = (vao as any).indexCount || 36;
            
            if (this.wireframe) {
                gl.drawElements(gl.LINES, indexCount, gl.UNSIGNED_SHORT, 0);
            } else {
                gl.drawElements(gl.TRIANGLES, indexCount, gl.UNSIGNED_SHORT, 0);
            }
            
            this.glContext.bindVertexArray(null);
            
            this.stats.drawCalls++;
            this.stats.triangles += indexCount / 3;
            this.stats.vertices += indexCount;
        }
    }

    /**
     * Render transform gizmos
     */
    private renderGizmos(gl: WebGL2RenderingContext, viewProj: Matrix4, objects: GameObject[]): void {
        // Simplified gizmo rendering - axis lines at selection center
        if (objects.length === 0 || !this.lineShader) return;
        
        const center = this.getSelectionCenter(objects);
        const gizmoSize = this.cameraDistance * 0.1;
        
        // Draw axis lines
        gl.useProgram(this.lineShader);
        gl.uniformMatrix4fv(gl.getUniformLocation(this.lineShader, 'uViewProjection'), false, viewProj.elements);
        
        // Create temporary line buffer
        const lines = [
            // X axis (red)
            center.x, center.y, center.z, 1, 0.2, 0.2,
            center.x + gizmoSize, center.y, center.z, 1, 0.2, 0.2,
            // Y axis (green)
            center.x, center.y, center.z, 0.2, 1, 0.2,
            center.x, center.y + gizmoSize, center.z, 0.2, 1, 0.2,
            // Z axis (blue)
            center.x, center.y, center.z, 0.2, 0.2, 1,
            center.x, center.y, center.z + gizmoSize, 0.2, 0.2, 1,
        ];
        
        const lineVAO = this.glContext.createVertexArray();
        this.glContext.bindVertexArray(lineVAO);
        
        const lineBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, lineBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(lines), gl.DYNAMIC_DRAW);
        
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0);
        gl.enableVertexAttribArray(1);
        gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 24, 12);
        
        gl.lineWidth(2);
        gl.drawArrays(gl.LINES, 0, 6);
        
        this.glContext.bindVertexArray(null);
        this.glContext.deleteVertexArray(lineVAO);
        gl.deleteBuffer(lineBuffer);
        
        this.stats.drawCalls++;
    }

    /**
     * Get center of selected objects
     */
    private getSelectionCenter(objects: GameObject[]): Vector3 {
        if (objects.length === 0) return new Vector3();
        if (objects.length === 1) return objects[0].transform.position.clone();
        
        const center = new Vector3();
        for (const obj of objects) {
            center.add(obj.transform.position);
        }
        return center.multiplyScalar(1 / objects.length);
    }

    /**
     * Frame objects in view
     */
    frameObjects(objects: GameObject[]): void {
        if (objects.length === 0) return;
        
        const center = this.getSelectionCenter(objects);
        this.cameraTarget.copy(center);
        this.cameraDistance = 5; // Reset to default distance
        this.updateCameraPosition();
    }

    /**
     * Set camera view preset
     */
    setView(view: CameraView): void {
        switch (view) {
            case 'top':
                this.cameraRotation = { theta: 0, phi: 0.01 };
                break;
            case 'bottom':
                this.cameraRotation = { theta: 0, phi: Math.PI - 0.01 };
                break;
            case 'front':
                this.cameraRotation = { theta: 0, phi: Math.PI / 2 };
                break;
            case 'back':
                this.cameraRotation = { theta: Math.PI, phi: Math.PI / 2 };
                break;
            case 'right':
                this.cameraRotation = { theta: Math.PI / 2, phi: Math.PI / 2 };
                break;
            case 'left':
                this.cameraRotation = { theta: -Math.PI / 2, phi: Math.PI / 2 };
                break;
            case 'perspective':
                this.cameraRotation = { theta: Math.PI / 4, phi: Math.PI / 4 };
                break;
        }
        this.updateCameraPosition();
    }

    /**
     * Set wireframe mode
     */
    setWireframe(enabled: boolean): void {
        this.wireframe = enabled;
    }

    /**
     * Resize renderer
     */
    resize(width: number, height: number): void {
        this.camera.setAspect(width / height);
    }

    /**
     * Get render statistics
     */
    getStats(): RenderStats {
        return { ...this.stats };
    }

    /**
     * Dispose resources
     */
    dispose(): void {
        const canvas = this.glContext.canvas;
        if (canvas) {
            canvas.removeEventListener('mousedown', this.onMouseDown);
            canvas.removeEventListener('mousemove', this.onMouseMove);
            canvas.removeEventListener('mouseup', this.onMouseUp);
            canvas.removeEventListener('wheel', this.onWheel);
        }
        
        this.logger.info('EditorRenderer disposed');
    }
}
