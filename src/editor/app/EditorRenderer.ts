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
import { EditorContext, TransformMode } from '../EditorContext';
import { GameObject } from '../../scene/GameObject';
import { Vector3 } from '../../math/Vector3';
import { Matrix4 } from '../../math/Matrix4';
import { Quaternion } from '../../math/Quaternion';
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
    
    // Dynamic world bounds - starts at 100k, extends 100k more when reached
    private worldBounds = { min: -100000, max: 100000 };
    private currentFarPlane: number = 1000000; // 10x the initial bounds
    private readonly EXPANSION_SIZE = 100000; // Add 100k each time
    
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
    private cylinderVAO: WebGLVertexArrayObject | null = null;
    private coneVAO: WebGLVertexArrayObject | null = null;
    
    // Gizmo buffer (cached, reused each frame)
    private gizmoVAO: WebGLVertexArrayObject | null = null;
    private gizmoBuffer: WebGLBuffer | null = null;
    
    // Settings
    private wireframe: boolean = false;
    private showGrid: boolean = true;
    private backgroundColor: [number, number, number, number] = [0.1, 0.1, 0.12, 1.0];
    
    // Camera smoothing
    private cameraSmoothness: number = 0.15; // Lower = smoother
    private targetCameraRotation = { theta: Math.PI / 4, phi: Math.PI / 3 };
    private targetCameraDistance: number = 10;
    
    // Statistics
    private stats: RenderStats = { drawCalls: 0, triangles: 0, vertices: 0 };
    
    // Input state
    private isDragging: boolean = false;
    private hasDragged: boolean = false;
    private dragStartTime: number = 0;
    private lastMouseX: number = 0;
    private lastMouseY: number = 0;
    private dragButton: number = -1;
    
    // Gizmo interaction state
    private gizmoDragging: boolean = false;
    private gizmoAxis: 'x' | 'y' | 'z' | null = null;
    
    // Direct object dragging (without gizmo)
    private objectDragging: boolean = false;
    
    // Scene reference for picking
    private currentScene: EditorScene | null = null;
    
    // Hover state - tracks object under cursor
    private hoveredObject: GameObject | null = null;

    constructor(glContext: WebGLContext, context: EditorContext) {
        this.glContext = glContext;
        this.context = context;
        this.logger = new Logger('EditorRenderer');
        
        // Create camera with large far plane (10x world bounds)
        const aspect = glContext.getWidth() / glContext.getHeight();
        this.camera = new Camera();
        this.camera.setPerspective(60 * Math.PI / 180, aspect, 0.1, this.currentFarPlane);
        this.camera.setPosition(new Vector3(5, 5, 5));
        this.camera.lookAt(this.cameraTarget);
        
        // Initialize smoothing targets
        this.targetCameraRotation.theta = this.cameraRotation.theta;
        this.targetCameraRotation.phi = this.cameraRotation.phi;
        this.targetCameraDistance = this.cameraDistance;
        
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
        
        // Infinite Grid shader (like Unreal Engine)
        const gridVS = `#version 300 es
            in vec3 aPosition;
            out vec3 vNearPoint;
            out vec3 vFarPoint;
            out mat4 vView;
            out mat4 vProjection;
            
            uniform mat4 uView;
            uniform mat4 uProjection;
            
            vec3 unprojectPoint(float x, float y, float z, mat4 view, mat4 projection) {
                mat4 viewInv = inverse(view);
                mat4 projInv = inverse(projection);
                vec4 unprojectedPoint = viewInv * projInv * vec4(x, y, z, 1.0);
                return unprojectedPoint.xyz / unprojectedPoint.w;
            }
            
            void main() {
                vView = uView;
                vProjection = uProjection;
                vNearPoint = unprojectPoint(aPosition.x, aPosition.y, 0.0, uView, uProjection);
                vFarPoint = unprojectPoint(aPosition.x, aPosition.y, 1.0, uView, uProjection);
                gl_Position = vec4(aPosition, 1.0);
            }
        `;
        
        const gridFS = `#version 300 es
            precision highp float;
            
            in vec3 vNearPoint;
            in vec3 vFarPoint;
            in mat4 vView;
            in mat4 vProjection;
            
            out vec4 fragColor;
            
            uniform float uGridScale;
            uniform float uGridSize;
            
            vec4 grid(vec3 fragPos3D, float scale) {
                vec2 coord = fragPos3D.xz * scale;
                vec2 derivative = fwidth(coord);
                
                // Prevent breaking at far distances
                derivative = max(derivative, 0.0001);
                
                vec2 grid = abs(fract(coord - 0.5) - 0.5) / derivative;
                float line = min(grid.x, grid.y);
                
                // Clamp to prevent moire
                line = clamp(line, 0.0, 1.0);
                
                // Base grid color
                float gridStrength = 1.0 - line;
                vec4 color = vec4(0.3, 0.3, 0.3, gridStrength * 0.5);
                
                // X axis (red) - fixed width 0.1 units
                if(abs(fragPos3D.x) < 0.1)
                    color = vec4(0.8, 0.2, 0.2, 1.0);
                // Z axis (blue) - fixed width 0.1 units  
                if(abs(fragPos3D.z) < 0.1)
                    color = vec4(0.2, 0.2, 0.8, 1.0);
                
                return color;
            }
            
            vec4 gridMajor(vec3 fragPos3D, float scale) {
                vec2 coord = fragPos3D.xz * scale;
                vec2 derivative = fwidth(coord);
                
                // Prevent breaking
                derivative = max(derivative, 0.0001);
                
                vec2 grid = abs(fract(coord - 0.5) - 0.5) / derivative;
                float line = min(grid.x, grid.y);
                
                // Clamp to prevent moire
                line = clamp(line, 0.0, 1.0);
                
                // Major grid lines
                float gridStrength = 1.0 - line;
                vec4 color = vec4(0.15, 0.15, 0.15, gridStrength * 0.3);
                
                return color;
            }
            
            float computeDepth(vec3 pos) {
                vec4 clip_space_pos = vProjection * vView * vec4(pos.xyz, 1.0);
                return (clip_space_pos.z / clip_space_pos.w);
            }
            
            void main() {
                float t = -vNearPoint.y / (vFarPoint.y - vNearPoint.y);
                
                // Only draw grid on the ground plane (y=0)
                if(t <= 0.0) {
                    discard;
                }
                
                vec3 fragPos3D = vNearPoint + t * (vFarPoint - vNearPoint);
                
                // Distance-based culling with safety limits
                float distanceFromCamera = length(fragPos3D - inverse(vView)[3].xyz);
                
                // Max distance scales with grid scale, capped to prevent breaking
                float maxGridDistance = clamp(10000.0 / max(uGridScale, 0.0001), 1000.0, 50000.0);
                
                if (distanceFromCamera > maxGridDistance) {
                    discard;
                }
                
                gl_FragDepth = computeDepth(fragPos3D);
                
                // Multi-level grid with safety checks
                vec4 gridColor1 = grid(fragPos3D, max(uGridScale, 0.0001)) * float(t > 0.0);
                vec4 gridColor10 = gridMajor(fragPos3D, max(uGridScale, 0.0001) * 0.1) * float(t > 0.0);
                
                // Combine grids
                fragColor = gridColor1;
                fragColor = mix(fragColor, gridColor10, gridColor10.a);
                
                // Fade out as approaching max distance
                float fadeStart = maxGridDistance * 0.6;
                float fadeFactor = 1.0 - smoothstep(fadeStart, maxGridDistance, distanceFromCamera);
                
                // Ensure minimum visibility when close
                if (distanceFromCamera < 100.0) {
                    fadeFactor = max(fadeFactor, 0.5);
                }
                
                fragColor.a *= fadeFactor;
                
                if(fragColor.a < 0.02) {
                    discard;
                }
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
        
        // Create fullscreen quad for infinite grid shader
        const vertices = new Float32Array([
            // Two triangles forming a quad covering NDC space
            -1, -1, 0,  // Bottom-left
             1, -1, 0,  // Bottom-right
             1,  1, 0,  // Top-right
            -1, -1, 0,  // Bottom-left
             1,  1, 0,  // Top-right
            -1,  1, 0   // Top-left
        ]);
        
        this.gridVertexCount = 6;
        
        // Create VAO
        this.gridVAO = this.glContext.createVertexArray();
        this.glContext.bindVertexArray(this.gridVAO);
        
        const buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
        
        // Position attribute
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 12, 0);
        
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
        
        // Cylinder
        this.cylinderVAO = this.createCylinderVAO(gl, 16);
        
        // Cone
        this.coneVAO = this.createConeVAO(gl, 16);
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
     * Create plane VAO (double-sided)
     */
    private createPlaneVAO(gl: WebGL2RenderingContext): WebGLVertexArrayObject {
        const vertices = [
            // Top face (normal pointing up) - light side
            -0.5, 0, -0.5,  0, 1, 0,
             0.5, 0, -0.5,  0, 1, 0,
             0.5, 0,  0.5,  0, 1, 0,
            -0.5, 0,  0.5,  0, 1, 0,
            // Bottom face (normal pointing down) - dark side
            -0.5, 0, -0.5,  0, -1, 0,
             0.5, 0, -0.5,  0, -1, 0,
             0.5, 0,  0.5,  0, -1, 0,
            -0.5, 0,  0.5,  0, -1, 0,
        ];
        
        const indices = [
            0, 2, 1, 0, 3, 2,  // Top face (CCW when viewed from above)
            4, 5, 6, 4, 6, 7   // Bottom face (CCW when viewed from below)
        ];
        
        return this.createVAO(gl, vertices, indices);
    }

    /**
     * Create cylinder VAO
     */
    private createCylinderVAO(gl: WebGL2RenderingContext, segments: number): WebGLVertexArrayObject {
        const vertices: number[] = [];
        const indices: number[] = [];
        const height = 1;
        const radius = 0.5;
        
        // Side vertices
        for (let i = 0; i <= segments; i++) {
            const theta = (i / segments) * Math.PI * 2;
            const x = Math.cos(theta) * radius;
            const z = Math.sin(theta) * radius;
            const nx = Math.cos(theta);
            const nz = Math.sin(theta);
            
            // Bottom vertex
            vertices.push(x, -height/2, z, nx, 0, nz);
            // Top vertex
            vertices.push(x, height/2, z, nx, 0, nz);
        }
        
        // Side indices
        for (let i = 0; i < segments; i++) {
            const bottom = i * 2;
            const top = bottom + 1;
            const nextBottom = (i + 1) * 2;
            const nextTop = nextBottom + 1;
            indices.push(bottom, nextBottom, top);
            indices.push(top, nextBottom, nextTop);
        }
        
        // Top cap center
        const topCenter = vertices.length / 6;
        vertices.push(0, height/2, 0, 0, 1, 0);
        
        // Top cap vertices
        for (let i = 0; i <= segments; i++) {
            const theta = (i / segments) * Math.PI * 2;
            vertices.push(Math.cos(theta) * radius, height/2, Math.sin(theta) * radius, 0, 1, 0);
        }
        
        // Top cap indices
        for (let i = 0; i < segments; i++) {
            indices.push(topCenter, topCenter + 1 + i, topCenter + 2 + i);
        }
        
        // Bottom cap center
        const bottomCenter = vertices.length / 6;
        vertices.push(0, -height/2, 0, 0, -1, 0);
        
        // Bottom cap vertices
        for (let i = 0; i <= segments; i++) {
            const theta = (i / segments) * Math.PI * 2;
            vertices.push(Math.cos(theta) * radius, -height/2, Math.sin(theta) * radius, 0, -1, 0);
        }
        
        // Bottom cap indices (reverse winding)
        for (let i = 0; i < segments; i++) {
            indices.push(bottomCenter, bottomCenter + 2 + i, bottomCenter + 1 + i);
        }
        
        return this.createVAO(gl, vertices, indices);
    }

    /**
     * Create cone VAO
     */
    private createConeVAO(gl: WebGL2RenderingContext, segments: number): WebGLVertexArrayObject {
        const vertices: number[] = [];
        const indices: number[] = [];
        const height = 1;
        const radius = 0.5;
        
        // Apex vertex
        const apex = 0;
        vertices.push(0, height/2, 0, 0, 1, 0);
        
        // Base vertices (with side normals)
        for (let i = 0; i <= segments; i++) {
            const theta = (i / segments) * Math.PI * 2;
            const x = Math.cos(theta) * radius;
            const z = Math.sin(theta) * radius;
            // Normal points outward and slightly up
            const nx = Math.cos(theta);
            const nz = Math.sin(theta);
            const ny = radius / height;
            const len = Math.sqrt(nx*nx + ny*ny + nz*nz);
            vertices.push(x, -height/2, z, nx/len, ny/len, nz/len);
        }
        
        // Side indices
        for (let i = 0; i < segments; i++) {
            indices.push(apex, i + 1, i + 2);
        }
        
        // Base cap center
        const baseCenter = vertices.length / 6;
        vertices.push(0, -height/2, 0, 0, -1, 0);
        
        // Base cap vertices
        for (let i = 0; i <= segments; i++) {
            const theta = (i / segments) * Math.PI * 2;
            vertices.push(Math.cos(theta) * radius, -height/2, Math.sin(theta) * radius, 0, -1, 0);
        }
        
        // Base cap indices
        for (let i = 0; i < segments; i++) {
            indices.push(baseCenter, baseCenter + 2 + i, baseCenter + 1 + i);
        }
        
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
        const canvas = this.glContext.canvas as HTMLCanvasElement;
        const rect = canvas.getBoundingClientRect();
        
        // Convert mouse position to canvas coordinates (accounting for CSS vs canvas size)
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const mouseX = (e.clientX - rect.left) * scaleX;
        const mouseY = (e.clientY - rect.top) * scaleY;
        
        // Check for gizmo hit first (left click only, and only in transform modes)
        const transformMode = this.context.getTransformMode();
        const selected = this.context.getSelection();
        
        if (e.button === 0 && transformMode !== TransformMode.SELECT) {
            const gizmoHit = this.hitTestGizmo(mouseX, mouseY);
            if (gizmoHit) {
                this.gizmoDragging = true;
                this.gizmoAxis = gizmoHit;
                this.lastMouseX = mouseX;
                this.lastMouseY = mouseY;
                return;
            }
        }
        
        // Check for direct object dragging (Alt + Left click on selected object)
        if (e.button === 0 && e.altKey && selected.length > 0) {
            const clickedObj = this.raycastPick(mouseX, mouseY);
            if (clickedObj && selected.includes(clickedObj)) {
                this.objectDragging = true;
                this.lastMouseX = mouseX;
                this.lastMouseY = mouseY;
                return;
            }
        }
        
        // Start tracking for potential drag OR click
        this.isDragging = true;
        this.hasDragged = false;
        this.dragStartTime = Date.now();
        this.dragButton = e.button;
        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;
    };

    private onMouseMove = (e: MouseEvent): void => {
        const canvas = this.glContext.canvas as HTMLCanvasElement;
        const rect = canvas.getBoundingClientRect();
        
        // Convert mouse position to canvas coordinates
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const mouseX = (e.clientX - rect.left) * scaleX;
        const mouseY = (e.clientY - rect.top) * scaleY;
        
        // Always track what's under the cursor for hover detection (when not dragging)
        if (!this.isDragging && !this.gizmoDragging && !this.objectDragging) {
            const prevHovered = this.hoveredObject;
            this.hoveredObject = this.pickObject(mouseX, mouseY);
            
            // Update cursor when hovering over objects
            if (this.hoveredObject !== prevHovered) {
                canvas.style.cursor = this.hoveredObject ? 'pointer' : 'default';
            }
        }
        
        // Handle direct object dragging (Alt+drag) - FREE MOVEMENT like Unreal/Unity
        if (this.objectDragging) {
            const selected = this.context.getSelection();
            if (selected.length > 0) {
                const obj = selected[0];
                
                // Cast ray from mouse position
                const ray = this.screenToRay(mouseX, mouseY);
                if (!ray) return;
                
                // Create a plane perpendicular to camera view, passing through object
                // This allows free movement in screen space
                const objPos = obj.transform.position;
                
                // Use camera's forward direction as plane normal
                const cameraForward = this.camera.getTransform().forward();
                const planeNormal = cameraForward.clone().negate();
                
                // Plane equation: dot(planeNormal, point - objPos) = 0
                // Ray equation: point = rayOrigin + t * rayDirection
                // Solve for t: dot(planeNormal, rayOrigin + t * rayDirection - objPos) = 0
                const denom = planeNormal.dot(ray.direction);
                
                if (Math.abs(denom) > 0.0001) {
                    const p0 = objPos.clone().subtract(ray.origin);
                    const t = planeNormal.dot(p0) / denom;
                    
                    if (t >= 0) {
                        // Calculate new world position - free movement!
                        const newPos = ray.origin.clone().add(ray.direction.clone().multiplyScalar(t));
                        obj.transform.position.copy(newPos);
                        obj.transform.markLocalDirty();
                        
                        // Update inspector
                        this.context.setSelection(selected);
                    }
                }
                
                this.lastMouseX = mouseX;
                this.lastMouseY = mouseY;
            }
            return;
        }
        
        // Handle gizmo dragging
        if (this.gizmoDragging && this.gizmoAxis) {
            const selected = this.context.getSelection();
            const transformMode = this.context.getTransformMode();
            
            if (selected.length > 0) {
                const obj = selected[0];
                const dx = mouseX - this.lastMouseX;
                const dy = mouseY - this.lastMouseY;
                
                // Get axis direction
                let axisDir = new Vector3();
                switch (this.gizmoAxis) {
                    case 'x': axisDir.set(1, 0, 0); break;
                    case 'y': axisDir.set(0, 1, 0); break;
                    case 'z': axisDir.set(0, 0, 1); break;
                }
                
                if (transformMode === TransformMode.TRANSLATE) {
                    // Translate: move along axis
                    const objPos = obj.transform.position;
                    const screenStart = this.worldToScreen(objPos);
                    const axisEnd = objPos.clone().add(axisDir);
                    const screenEnd = this.worldToScreen(axisEnd);
                    
                    const screenAxisX = screenEnd.x - screenStart.x;
                    const screenAxisY = screenEnd.y - screenStart.y;
                    const screenAxisLen = Math.sqrt(screenAxisX * screenAxisX + screenAxisY * screenAxisY);
                    
                    if (screenAxisLen > 0.001) {
                        const dot = (dx * screenAxisX + dy * screenAxisY) / screenAxisLen;
                        const moveSpeed = this.cameraDistance * 0.005;
                        const worldDelta = dot * moveSpeed / screenAxisLen;
                        const movement = axisDir.clone().multiplyScalar(worldDelta);
                        obj.transform.translate(movement);
                        
                        // Apply grid snapping if enabled
                        const snapSettings = this.context.getSnappingSettings();
                        if (snapSettings.gridSnapping) {
                            const gridSize = snapSettings.gridSize || 1.0;
                            obj.transform.position.x = Math.round(obj.transform.position.x / gridSize) * gridSize;
                            obj.transform.position.y = Math.round(obj.transform.position.y / gridSize) * gridSize;
                            obj.transform.position.z = Math.round(obj.transform.position.z / gridSize) * gridSize;
                            obj.transform.markLocalDirty();
                        }
                    }
                } else if (transformMode === TransformMode.ROTATE) {
                    // Rotate: rotate around axis based on mouse drag
                    const rotateSpeed = 0.01;
                    const angle = (dx + dy) * rotateSpeed;
                    const rotQuat = Quaternion.fromAxisAngle(axisDir, angle);
                    obj.transform.rotation = obj.transform.rotation.multiply(rotQuat);
                    obj.transform.markLocalDirty();
                } else if (transformMode === TransformMode.SCALE) {
                    // Scale: scale along axis
                    const scaleSpeed = 0.01;
                    const scaleDelta = (dx + dy) * scaleSpeed;
                    
                    const currentScale = obj.transform.scale;
                    switch (this.gizmoAxis) {
                        case 'x': currentScale.x = Math.max(0.01, currentScale.x + scaleDelta); break;
                        case 'y': currentScale.y = Math.max(0.01, currentScale.y + scaleDelta); break;
                        case 'z': currentScale.z = Math.max(0.01, currentScale.z + scaleDelta); break;
                    }
                    obj.transform.markLocalDirty();
                }
                
                // Re-emit selection to update inspector
                this.context.setSelection(selected);
                
                this.lastMouseX = mouseX;
                this.lastMouseY = mouseY;
            }
            return;
        }
        
        // Handle camera dragging
        if (!this.isDragging) return;
        
        const dx = e.clientX - this.lastMouseX;
        const dy = e.clientY - this.lastMouseY;
        
        // If any movement, mark as dragged with threshold
        const totalMovement = Math.abs(dx) + Math.abs(dy);
        if (totalMovement > 2) {
            this.hasDragged = true;
            console.log('[EditorRenderer] Camera drag detected:', { dx, dy, totalMovement });
        }
        
        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;
        
        const orbitSpeed = 0.008;
        const panSpeed = this.cameraDistance * 0.003;
        
        if (this.dragButton === 1 || (this.dragButton === 0 && e.shiftKey)) {
            // Middle click OR Shift+Left click: Pan (move camera target)
            const right = this.camera.getTransform().right();
            const up = this.camera.getTransform().up();
            
            this.cameraTarget.x -= right.x * dx * panSpeed + up.x * dy * panSpeed;
            this.cameraTarget.y -= right.y * dx * panSpeed + up.y * dy * panSpeed;
            this.cameraTarget.z -= right.z * dx * panSpeed + up.z * dy * panSpeed;
        } else if (this.dragButton === 0 || this.dragButton === 2) {
            // Left click or Right click: Orbit around target
            this.targetCameraRotation.theta -= dx * orbitSpeed;
            this.targetCameraRotation.phi = Math.max(0.1, Math.min(Math.PI - 0.1, this.targetCameraRotation.phi - dy * orbitSpeed));
        }
    };

    private onMouseUp = (e: MouseEvent): void => {
        const clickDuration = Date.now() - this.dragStartTime;
        
        // Save the drag state BEFORE resetting
        const wasDragging = this.hasDragged;
        
        // ONLY allow selection if:
        // 1. Left click (button 0)
        // 2. Never moved mouse during this click session (wasDragged is false)
        // 3. Quick click (< 150ms)
        const canSelect = e.button === 0 && !wasDragging && clickDuration < 150;
        
        console.log('[EditorRenderer] MouseUp:', {
            button: e.button,
            wasDragging,
            duration: clickDuration,
            canSelect
        });
        
        if (canSelect) {
            const canvas = this.glContext.canvas as HTMLCanvasElement;
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            const mouseX = (e.clientX - rect.left) * scaleX;
            const mouseY = (e.clientY - rect.top) * scaleY;
            
            // Do raycast pick
            const clickedObject = this.raycastPick(mouseX, mouseY);
            console.log('[EditorRenderer] Selection:', clickedObject?.name || 'none');
            if (clickedObject) {
                this.context.setSelection([clickedObject]);
                // Auto-switch to translate mode
                const transformMode = this.context.getTransformMode();
                if (transformMode === TransformMode.SELECT) {
                    this.context.setTransformMode(TransformMode.TRANSLATE);
                }
            } else {
                // Clicked empty space - clear selection
                this.context.setSelection([]);
            }
        }
        
        // Reset drag state
        this.isDragging = false;
        this.hasDragged = false;
        this.dragButton = -1;
        this.gizmoDragging = false;
        this.gizmoAxis = null;
        this.objectDragging = false;
    };

    private onWheel = (e: WheelEvent): void => {
        e.preventDefault();
        const zoomSpeed = 0.1;
        this.targetCameraDistance *= 1 + e.deltaY * zoomSpeed * 0.01;
        // Prevent going too close or too far (prevent grid breaking)
        this.targetCameraDistance = Math.max(0.5, Math.min(50000, this.targetCameraDistance));
    };

    /**
     * Update camera with smoothing
     */
    private smoothCamera(): void {
        // Smooth rotation
        this.cameraRotation.theta += (this.targetCameraRotation.theta - this.cameraRotation.theta) * this.cameraSmoothness;
        this.cameraRotation.phi += (this.targetCameraRotation.phi - this.cameraRotation.phi) * this.cameraSmoothness;
        
        // Smooth distance
        this.cameraDistance += (this.targetCameraDistance - this.cameraDistance) * this.cameraSmoothness;
        
        // Update position
        this.updateCameraPosition();
    }

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
        
        // Auto-expand world bounds if camera goes beyond current limits
        this.updateWorldBounds();
    }

    /**
     * Dynamically expand world bounds when camera/objects approach the limit
     * Adds 100k units at a time for infinite scalability
     */
    private updateWorldBounds(): void {
        const camPos = this.camera.getPosition();
        const maxDist = Math.max(
            Math.abs(camPos.x),
            Math.abs(camPos.y),
            Math.abs(camPos.z),
            Math.abs(this.cameraTarget.x),
            Math.abs(this.cameraTarget.y),
            Math.abs(this.cameraTarget.z)
        );
        
        // If we're approaching 95% of current bounds, expand by 100k more
        if (maxDist > this.worldBounds.max * 0.95) {
            // Expand bounds by adding 100k evenly
            this.worldBounds.max += this.EXPANSION_SIZE;
            this.worldBounds.min -= this.EXPANSION_SIZE;
            
            // Update far plane to 10x the new world bounds
            this.currentFarPlane = this.worldBounds.max * 10;
            const aspect = this.glContext.getWidth() / this.glContext.getHeight();
            this.camera.setPerspective(60 * Math.PI / 180, aspect, 0.1, this.currentFarPlane);
            
            console.log(`[EditorRenderer] World bounds expanded to ±${this.worldBounds.max.toLocaleString()} units (far plane: ${this.currentFarPlane.toLocaleString()})`);
            this.logger.info(`World bounds expanded to ±${this.worldBounds.max.toLocaleString()} units`);
        }
    }

    /**
     * Hit test gizmo axes
     * Returns which axis was hit, or null if no hit
     */
    private hitTestGizmo(screenX: number, screenY: number): 'x' | 'y' | 'z' | null {
        const selected = this.context.getSelection();
        if (selected.length === 0) return null;
        
        const transformMode = this.context.getTransformMode();
        const center = this.getSelectionCenter(selected);
        const gizmoSize = this.cameraDistance * 0.15;
        
        // Only check handle endpoints, not the lines - prevents blocking object selection
        const handleHitRadius = 25; // Pixels for clickable handle area
        
        if (transformMode === TransformMode.ROTATE) {
            // For rotate mode, check spheres at cardinal points of each circle
            
            // X rotation - sphere at top of YZ circle
            const xHandlePos = center.clone().add(new Vector3(0, gizmoSize, 0));
            const xHandleScreen = this.worldToScreen(xHandlePos);
            if (xHandleScreen.z > 0 && Math.hypot(screenX - xHandleScreen.x, screenY - xHandleScreen.y) < handleHitRadius) {
                return 'x';
            }
            
            // Y rotation - sphere at front of XZ circle
            const yHandlePos = center.clone().add(new Vector3(0, 0, gizmoSize));
            const yHandleScreen = this.worldToScreen(yHandlePos);
            if (yHandleScreen.z > 0 && Math.hypot(screenX - yHandleScreen.x, screenY - yHandleScreen.y) < handleHitRadius) {
                return 'y';
            }
            
            // Z rotation - sphere at right of XY circle
            const zHandlePos = center.clone().add(new Vector3(gizmoSize, 0, 0));
            const zHandleScreen = this.worldToScreen(zHandlePos);
            if (zHandleScreen.z > 0 && Math.hypot(screenX - zHandleScreen.x, screenY - zHandleScreen.y) < handleHitRadius) {
                return 'z';
            }
        } else {
            // Translate/Scale: only check endpoint handles (arrows/boxes), not lines
            const xEnd = this.worldToScreen(center.clone().add(new Vector3(gizmoSize, 0, 0)));
            const yEnd = this.worldToScreen(center.clone().add(new Vector3(0, gizmoSize, 0)));
            const zEnd = this.worldToScreen(center.clone().add(new Vector3(0, 0, gizmoSize)));
            
            // Check X handle (red arrow/box)
            if (xEnd.z > 0 && Math.hypot(screenX - xEnd.x, screenY - xEnd.y) < handleHitRadius) {
                return 'x';
            }
            
            // Check Y handle (green arrow/box)
            if (yEnd.z > 0 && Math.hypot(screenX - yEnd.x, screenY - yEnd.y) < handleHitRadius) {
                return 'y';
            }
            
            // Check Z handle (blue arrow/box)
            if (zEnd.z > 0 && Math.hypot(screenX - zEnd.x, screenY - zEnd.y) < handleHitRadius) {
                return 'z';
            }
        }
        
        return null;
    }
    
    /**
     * Pick object at screen coordinates using actual bounding box
     * Uses distance to center as tiebreaker for overlapping objects
     */
    private pickObject(screenX: number, screenY: number): GameObject | null {
        if (!this.currentScene) return null;
        
        const objects = this.currentScene.getAllGameObjects();
        
        // Collect all hit candidates with their scores
        const candidates: { obj: GameObject, z: number, distToCenter: number, boxSize: number }[] = [];
        
        for (const obj of objects) {
            const pos = obj.transform.position;
            const scale = obj.transform.scale;
            
            // Get object's world-space bounding box corners based on scale
            const halfX = scale.x * 0.5;
            const halfY = Math.max(scale.y * 0.5, 0.1); // Min height for flat objects
            const halfZ = scale.z * 0.5;
            
            // 8 corners of the bounding box
            const corners = [
                new Vector3(pos.x - halfX, pos.y - halfY, pos.z - halfZ),
                new Vector3(pos.x + halfX, pos.y - halfY, pos.z - halfZ),
                new Vector3(pos.x - halfX, pos.y + halfY, pos.z - halfZ),
                new Vector3(pos.x + halfX, pos.y + halfY, pos.z - halfZ),
                new Vector3(pos.x - halfX, pos.y - halfY, pos.z + halfZ),
                new Vector3(pos.x + halfX, pos.y - halfY, pos.z + halfZ),
                new Vector3(pos.x - halfX, pos.y + halfY, pos.z + halfZ),
                new Vector3(pos.x + halfX, pos.y + halfY, pos.z + halfZ),
            ];
            
            // Project all corners to screen space and find bounding rect
            let minScreenX = Infinity, maxScreenX = -Infinity;
            let minScreenY = Infinity, maxScreenY = -Infinity;
            let minZ = Infinity;
            let behindCamera = false;
            
            for (const corner of corners) {
                const screenPos = this.worldToScreen(corner);
                if (screenPos.z < 0) {
                    behindCamera = true;
                    break;
                }
                minScreenX = Math.min(minScreenX, screenPos.x);
                maxScreenX = Math.max(maxScreenX, screenPos.x);
                minScreenY = Math.min(minScreenY, screenPos.y);
                maxScreenY = Math.max(maxScreenY, screenPos.y);
                minZ = Math.min(minZ, screenPos.z);
            }
            
            if (behindCamera) continue;
            
            // Calculate screen-space box size
            const boxWidth = maxScreenX - minScreenX;
            const boxHeight = maxScreenY - minScreenY;
            const boxSize = boxWidth * boxHeight;
            
            // Enforce minimum clickable size (expand small objects)
            const minSize = 20;
            if (boxWidth < minSize) {
                const expand = (minSize - boxWidth) / 2;
                minScreenX -= expand;
                maxScreenX += expand;
            }
            if (boxHeight < minSize) {
                const expand = (minSize - boxHeight) / 2;
                minScreenY -= expand;
                maxScreenY += expand;
            }
            
            // Add padding for easier clicking
            const padding = 3;
            minScreenX -= padding;
            maxScreenX += padding;
            minScreenY -= padding;
            maxScreenY += padding;
            
            // Check if mouse is inside the screen-space bounding box
            if (screenX >= minScreenX && screenX <= maxScreenX &&
                screenY >= minScreenY && screenY <= maxScreenY) {
                
                // Calculate distance from click to box center
                const centerX = (minScreenX + maxScreenX) / 2;
                const centerY = (minScreenY + maxScreenY) / 2;
                const distToCenter = Math.hypot(screenX - centerX, screenY - centerY);
                
                candidates.push({ obj, z: minZ, distToCenter, boxSize });
            }
        }
        
        if (candidates.length === 0) return null;
        
        // Sort candidates: prefer closer (smaller z), then smaller objects, then closer to center
        candidates.sort((a, b) => {
            // First by depth (closer objects first)
            const zDiff = a.z - b.z;
            if (Math.abs(zDiff) > 0.5) return zDiff;
            
            // For similar depths, prefer smaller objects (more precise clicks)
            const sizeDiff = a.boxSize - b.boxSize;
            if (Math.abs(sizeDiff) > 100) return sizeDiff;
            
            // Finally, prefer clicks closer to object center
            return a.distToCenter - b.distToCenter;
        });
        
        return candidates[0].obj;
    }

    /**
     * Raycast pick - cast ray from camera through screen point and find closest object
     * This is proper 3D picking like Unity/Unreal
     */
    private raycastPick(screenX: number, screenY: number): GameObject | null {
        if (!this.currentScene) return null;
        
        // Get ray from camera through screen point
        const ray = this.screenToRay(screenX, screenY);
        if (!ray) return null;
        
        const objects = this.currentScene.getAllGameObjects();
        let closestObj: GameObject | null = null;
        let closestT = Infinity;
        
        for (const obj of objects) {
            const pos = obj.transform.position;
            const scale = obj.transform.scale;
            
            // Create axis-aligned bounding box in world space
            const halfX = scale.x * 0.5;
            const halfY = Math.max(scale.y * 0.5, 0.05); // Min height for flat objects
            const halfZ = scale.z * 0.5;
            
            const boxMin = new Vector3(pos.x - halfX, pos.y - halfY, pos.z - halfZ);
            const boxMax = new Vector3(pos.x + halfX, pos.y + halfY, pos.z + halfZ);
            
            // Ray-AABB intersection test
            const t = this.rayIntersectAABB(ray.origin, ray.direction, boxMin, boxMax);
            
            if (t !== null && t < closestT) {
                closestT = t;
                closestObj = obj;
            }
        }
        
        return closestObj;
    }
    
    /**
     * Convert screen coordinates to a ray in world space
     */
    private screenToRay(screenX: number, screenY: number): { origin: Vector3, direction: Vector3 } | null {
        const canvas = this.glContext.canvas as HTMLCanvasElement;
        
        // Convert screen to NDC (-1 to 1)
        const ndcX = (screenX / canvas.width) * 2 - 1;
        const ndcY = 1 - (screenY / canvas.height) * 2; // Flip Y
        
        // Get inverse view-projection matrix
        const viewProj = this.camera.getViewProjectionMatrix();
        const invViewProj = viewProj.clone().invert();
        if (!invViewProj) return null;
        
        // Unproject near and far points
        const nearPoint = this.unproject(invViewProj, ndcX, ndcY, -1);
        const farPoint = this.unproject(invViewProj, ndcX, ndcY, 1);
        
        // Ray direction
        const direction = new Vector3(
            farPoint.x - nearPoint.x,
            farPoint.y - nearPoint.y,
            farPoint.z - nearPoint.z
        ).normalize();
        
        return { origin: nearPoint, direction };
    }
    
    /**
     * Unproject NDC coordinates to world space
     */
    private unproject(invViewProj: Matrix4, ndcX: number, ndcY: number, ndcZ: number): Vector3 {
        const m = invViewProj.elements;
        
        // Transform by inverse view-projection
        const x = m[0] * ndcX + m[4] * ndcY + m[8] * ndcZ + m[12];
        const y = m[1] * ndcX + m[5] * ndcY + m[9] * ndcZ + m[13];
        const z = m[2] * ndcX + m[6] * ndcY + m[10] * ndcZ + m[14];
        const w = m[3] * ndcX + m[7] * ndcY + m[11] * ndcZ + m[15];
        
        // Perspective divide
        return new Vector3(x / w, y / w, z / w);
    }
    
    /**
     * Ray-AABB intersection test
     * Returns distance t along ray if hit, null if no hit
     */
    private rayIntersectAABB(
        origin: Vector3, 
        direction: Vector3, 
        boxMin: Vector3, 
        boxMax: Vector3
    ): number | null {
        let tmin = -Infinity;
        let tmax = Infinity;
        
        // Check X axis
        if (Math.abs(direction.x) > 0.0001) {
            const t1 = (boxMin.x - origin.x) / direction.x;
            const t2 = (boxMax.x - origin.x) / direction.x;
            tmin = Math.max(tmin, Math.min(t1, t2));
            tmax = Math.min(tmax, Math.max(t1, t2));
        } else if (origin.x < boxMin.x || origin.x > boxMax.x) {
            return null;
        }
        
        // Check Y axis
        if (Math.abs(direction.y) > 0.0001) {
            const t1 = (boxMin.y - origin.y) / direction.y;
            const t2 = (boxMax.y - origin.y) / direction.y;
            tmin = Math.max(tmin, Math.min(t1, t2));
            tmax = Math.min(tmax, Math.max(t1, t2));
        } else if (origin.y < boxMin.y || origin.y > boxMax.y) {
            return null;
        }
        
        // Check Z axis
        if (Math.abs(direction.z) > 0.0001) {
            const t1 = (boxMin.z - origin.z) / direction.z;
            const t2 = (boxMax.z - origin.z) / direction.z;
            tmin = Math.max(tmin, Math.min(t1, t2));
            tmax = Math.min(tmax, Math.max(t1, t2));
        } else if (origin.z < boxMin.z || origin.z > boxMax.z) {
            return null;
        }
        
        // Check if valid intersection
        if (tmax < 0 || tmin > tmax) {
            return null;
        }
        
        return tmin >= 0 ? tmin : tmax;
    }

    /**
     * Convert world position to screen coordinates
     */
    private worldToScreen(pos: Vector3): Vector3 {
        const canvas = this.glContext.canvas as HTMLCanvasElement;
        const viewProj = this.camera.getViewProjectionMatrix();
        
        // Transform to clip space
        const clipX = viewProj.elements[0] * pos.x + viewProj.elements[4] * pos.y + viewProj.elements[8] * pos.z + viewProj.elements[12];
        const clipY = viewProj.elements[1] * pos.x + viewProj.elements[5] * pos.y + viewProj.elements[9] * pos.z + viewProj.elements[13];
        const clipW = viewProj.elements[3] * pos.x + viewProj.elements[7] * pos.y + viewProj.elements[11] * pos.z + viewProj.elements[15];
        
        // Perspective divide to NDC
        const ndcX = clipX / clipW;
        const ndcY = clipY / clipW;
        
        // NDC to screen
        const screenX = (ndcX + 1) * 0.5 * canvas.width;
        const screenY = (1 - ndcY) * 0.5 * canvas.height; // Flip Y
        
        return new Vector3(screenX, screenY, clipW);
    }

    /**
     * Convert screen coordinates to world position on a plane
     */
    /**
     * Render the editor scene
     */
    render(scene: EditorScene, _deltaTime: number): void {
        const gl = this.glContext.getGL() as WebGL2RenderingContext;
        
        // Smooth camera movement
        this.smoothCamera();
        
        // Store scene reference for picking
        this.currentScene = scene;
        
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
        
        // Render scene objects first
        this.renderObjects(gl, viewProj, scene);
        
        // Render grid AFTER objects so depth test works correctly
        if (this.showGrid) {
            this.renderGrid(gl, viewProj);
        }
        
        // Render gizmos for selected objects (only in transform modes, not select mode)
        const selected = this.context.getSelection();
        const transformMode = this.context.getTransformMode();
        if (selected.length > 0 && transformMode !== TransformMode.SELECT) {
            this.renderGizmos(gl, viewProj, selected);
        }
    }

    /**
     * Render grid
     */
    private renderGrid(gl: WebGL2RenderingContext, _viewProj: Matrix4): void {
        if (!this.gridShader || !this.gridVAO) return;
        
        // Enable blending for grid transparency
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        
        gl.useProgram(this.gridShader);
        
        // Get view and projection matrices separately
        const view = this.camera.getViewMatrix();
        const projection = this.camera.getProjectionMatrix();
        
        // Set uniforms - aggressive LOD to prevent breaking
        gl.uniformMatrix4fv(gl.getUniformLocation(this.gridShader, 'uView'), false, view.elements);
        gl.uniformMatrix4fv(gl.getUniformLocation(this.gridShader, 'uProjection'), false, projection.elements);
        
        // Aggressive adaptive grid scale based on camera distance
        let gridScale = 1.0; // 1m default
        const dist = this.cameraDistance;
        
        if (dist > 80) gridScale = 0.1;      // 10m squares
        if (dist > 300) gridScale = 0.01;    // 100m squares
        if (dist > 1500) gridScale = 0.001;  // 1000m squares
        if (dist > 8000) gridScale = 0.0001; // 10000m squares
        
        gl.uniform1f(gl.getUniformLocation(this.gridShader, 'uGridScale'), gridScale);
        gl.uniform1f(gl.getUniformLocation(this.gridShader, 'uGridSize'), this.worldBounds.max);
        
        this.glContext.bindVertexArray(this.gridVAO);
        gl.drawArrays(gl.TRIANGLES, 0, this.gridVertexCount);
        this.glContext.bindVertexArray(null);
        
        gl.disable(gl.BLEND);
        
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
            case 'cylinder': vao = this.cylinderVAO; break;
            case 'cone': vao = this.coneVAO; break;
            case 'capsule': vao = this.cylinderVAO; break; // Use cylinder for capsule
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
        if (objects.length === 0 || !this.lineShader) return;
        
        const transformMode = this.context.getTransformMode();
        const center = this.getSelectionCenter(objects);
        const gizmoSize = this.cameraDistance * 0.15;
        
        // Disable depth test so gizmos always render on top
        gl.disable(gl.DEPTH_TEST);
        
        gl.useProgram(this.lineShader);
        gl.uniformMatrix4fv(gl.getUniformLocation(this.lineShader, 'uViewProjection'), false, viewProj.elements);
        
        const lines: number[] = [];
        
        if (transformMode === TransformMode.TRANSLATE) {
            this.buildTranslateGizmoLines(lines, center, gizmoSize);
        } else if (transformMode === TransformMode.ROTATE) {
            this.buildRotateGizmoLines(lines, center, gizmoSize);
        } else if (transformMode === TransformMode.SCALE) {
            this.buildScaleGizmoLines(lines, center, gizmoSize);
        }
        
        if (lines.length === 0) {
            gl.enable(gl.DEPTH_TEST);
            return;
        }
        
        // Create or reuse gizmo VAO/buffer
        if (!this.gizmoVAO) {
            this.gizmoVAO = this.glContext.createVertexArray();
            this.gizmoBuffer = gl.createBuffer();
            
            this.glContext.bindVertexArray(this.gizmoVAO);
            gl.bindBuffer(gl.ARRAY_BUFFER, this.gizmoBuffer);
            
            gl.enableVertexAttribArray(0);
            gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0);
            gl.enableVertexAttribArray(1);
            gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 24, 12);
        }
        
        // Update buffer data
        this.glContext.bindVertexArray(this.gizmoVAO);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.gizmoBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(lines), gl.DYNAMIC_DRAW);
        
        gl.drawArrays(gl.LINES, 0, lines.length / 6);
        
        this.glContext.bindVertexArray(null);
        gl.enable(gl.DEPTH_TEST);
        
        this.stats.drawCalls++;
    }
    
    /**
     * Build translate gizmo lines (arrows)
     */
    private buildTranslateGizmoLines(lines: number[], center: Vector3, size: number): void {
        const headSize = size * 0.15;
        
        // X axis (red)
        lines.push(center.x, center.y, center.z, 1, 0.2, 0.2);
        lines.push(center.x + size, center.y, center.z, 1, 0.2, 0.2);
        lines.push(center.x + size, center.y, center.z, 1, 0.2, 0.2);
        lines.push(center.x + size - headSize, center.y + headSize * 0.5, center.z, 1, 0.2, 0.2);
        lines.push(center.x + size, center.y, center.z, 1, 0.2, 0.2);
        lines.push(center.x + size - headSize, center.y - headSize * 0.5, center.z, 1, 0.2, 0.2);
        
        // Y axis (green)
        lines.push(center.x, center.y, center.z, 0.2, 1, 0.2);
        lines.push(center.x, center.y + size, center.z, 0.2, 1, 0.2);
        lines.push(center.x, center.y + size, center.z, 0.2, 1, 0.2);
        lines.push(center.x + headSize * 0.5, center.y + size - headSize, center.z, 0.2, 1, 0.2);
        lines.push(center.x, center.y + size, center.z, 0.2, 1, 0.2);
        lines.push(center.x - headSize * 0.5, center.y + size - headSize, center.z, 0.2, 1, 0.2);
        
        // Z axis (blue)
        lines.push(center.x, center.y, center.z, 0.2, 0.2, 1);
        lines.push(center.x, center.y, center.z + size, 0.2, 0.2, 1);
        lines.push(center.x, center.y, center.z + size, 0.2, 0.2, 1);
        lines.push(center.x + headSize * 0.5, center.y, center.z + size - headSize, 0.2, 0.2, 1);
        lines.push(center.x, center.y, center.z + size, 0.2, 0.2, 1);
        lines.push(center.x - headSize * 0.5, center.y, center.z + size - headSize, 0.2, 0.2, 1);
    }
    
    /**
     * Build rotate gizmo lines (circles)
     */
    private buildRotateGizmoLines(lines: number[], center: Vector3, size: number): void {
        const segments = 32;
        const handleSize = size * 0.08;
        
        // X rotation circle (YZ plane) - Red
        for (let i = 0; i < segments; i++) {
            const a1 = (i / segments) * Math.PI * 2;
            const a2 = ((i + 1) / segments) * Math.PI * 2;
            lines.push(center.x, center.y + Math.cos(a1) * size, center.z + Math.sin(a1) * size, 1, 0.2, 0.2);
            lines.push(center.x, center.y + Math.cos(a2) * size, center.z + Math.sin(a2) * size, 1, 0.2, 0.2);
        }
        // X handle sphere at top of circle
        this.addWireSphere(lines, center.x, center.y + size, center.z, handleSize, [1, 0.3, 0.3]);
        
        // Y rotation circle (XZ plane) - Green
        for (let i = 0; i < segments; i++) {
            const a1 = (i / segments) * Math.PI * 2;
            const a2 = ((i + 1) / segments) * Math.PI * 2;
            lines.push(center.x + Math.cos(a1) * size, center.y, center.z + Math.sin(a1) * size, 0.2, 1, 0.2);
            lines.push(center.x + Math.cos(a2) * size, center.y, center.z + Math.sin(a2) * size, 0.2, 1, 0.2);
        }
        // Y handle sphere at front of circle
        this.addWireSphere(lines, center.x, center.y, center.z + size, handleSize, [0.3, 1, 0.3]);
        
        // Z rotation circle (XY plane) - Blue
        for (let i = 0; i < segments; i++) {
            const a1 = (i / segments) * Math.PI * 2;
            const a2 = ((i + 1) / segments) * Math.PI * 2;
            lines.push(center.x + Math.cos(a1) * size, center.y + Math.sin(a1) * size, center.z, 0.2, 0.2, 1);
            lines.push(center.x + Math.cos(a2) * size, center.y + Math.sin(a2) * size, center.z, 0.2, 0.2, 1);
        }
        // Z handle sphere at right of circle
        this.addWireSphere(lines, center.x + size, center.y, center.z, handleSize, [0.3, 0.3, 1]);
    }
    
    /**
     * Add wireframe sphere (3 circles) for rotation handles
     */
    private addWireSphere(lines: number[], x: number, y: number, z: number, radius: number, color: number[]): void {
        const [r, g, b] = color;
        const segments = 12;
        
        // XY circle
        for (let i = 0; i < segments; i++) {
            const a1 = (i / segments) * Math.PI * 2;
            const a2 = ((i + 1) / segments) * Math.PI * 2;
            lines.push(x + Math.cos(a1) * radius, y + Math.sin(a1) * radius, z, r, g, b);
            lines.push(x + Math.cos(a2) * radius, y + Math.sin(a2) * radius, z, r, g, b);
        }
        // XZ circle
        for (let i = 0; i < segments; i++) {
            const a1 = (i / segments) * Math.PI * 2;
            const a2 = ((i + 1) / segments) * Math.PI * 2;
            lines.push(x + Math.cos(a1) * radius, y, z + Math.sin(a1) * radius, r, g, b);
            lines.push(x + Math.cos(a2) * radius, y, z + Math.sin(a2) * radius, r, g, b);
        }
        // YZ circle
        for (let i = 0; i < segments; i++) {
            const a1 = (i / segments) * Math.PI * 2;
            const a2 = ((i + 1) / segments) * Math.PI * 2;
            lines.push(x, y + Math.cos(a1) * radius, z + Math.sin(a1) * radius, r, g, b);
            lines.push(x, y + Math.cos(a2) * radius, z + Math.sin(a2) * radius, r, g, b);
        }
    }
    
    /**
     * Build scale gizmo lines (boxes on ends)
     */
    private buildScaleGizmoLines(lines: number[], center: Vector3, size: number): void {
        const boxSize = size * 0.08;
        
        // X axis (red) with box
        lines.push(center.x, center.y, center.z, 1, 0.2, 0.2);
        lines.push(center.x + size, center.y, center.z, 1, 0.2, 0.2);
        this.addScaleBox(lines, center.x + size, center.y, center.z, boxSize, [1, 0.2, 0.2]);
        
        // Y axis (green) with box
        lines.push(center.x, center.y, center.z, 0.2, 1, 0.2);
        lines.push(center.x, center.y + size, center.z, 0.2, 1, 0.2);
        this.addScaleBox(lines, center.x, center.y + size, center.z, boxSize, [0.2, 1, 0.2]);
        
        // Z axis (blue) with box
        lines.push(center.x, center.y, center.z, 0.2, 0.2, 1);
        lines.push(center.x, center.y, center.z + size, 0.2, 0.2, 1);
        this.addScaleBox(lines, center.x, center.y, center.z + size, boxSize, [0.2, 0.2, 1]);
        
        // Center cube (white)
        this.addScaleBox(lines, center.x, center.y, center.z, boxSize * 0.8, [1, 1, 1]);
    }
    
    /**
     * Add a wireframe box to lines array
     */
    private addScaleBox(lines: number[], x: number, y: number, z: number, s: number, color: number[]): void {
        const h = s / 2;
        const [r, g, b] = color;
        
        // Bottom face
        lines.push(x - h, y - h, z - h, r, g, b); lines.push(x + h, y - h, z - h, r, g, b);
        lines.push(x + h, y - h, z - h, r, g, b); lines.push(x + h, y - h, z + h, r, g, b);
        lines.push(x + h, y - h, z + h, r, g, b); lines.push(x - h, y - h, z + h, r, g, b);
        lines.push(x - h, y - h, z + h, r, g, b); lines.push(x - h, y - h, z - h, r, g, b);
        
        // Top face
        lines.push(x - h, y + h, z - h, r, g, b); lines.push(x + h, y + h, z - h, r, g, b);
        lines.push(x + h, y + h, z - h, r, g, b); lines.push(x + h, y + h, z + h, r, g, b);
        lines.push(x + h, y + h, z + h, r, g, b); lines.push(x - h, y + h, z + h, r, g, b);
        lines.push(x - h, y + h, z + h, r, g, b); lines.push(x - h, y + h, z - h, r, g, b);
        
        // Vertical edges
        lines.push(x - h, y - h, z - h, r, g, b); lines.push(x - h, y + h, z - h, r, g, b);
        lines.push(x + h, y - h, z - h, r, g, b); lines.push(x + h, y + h, z - h, r, g, b);
        lines.push(x + h, y - h, z + h, r, g, b); lines.push(x + h, y + h, z + h, r, g, b);
        lines.push(x - h, y - h, z + h, r, g, b); lines.push(x - h, y + h, z + h, r, g, b);
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
     * Toggle grid visibility
     */
    toggleGrid(): void {
        this.showGrid = !this.showGrid;
    }

    /**
     * Check if grid is visible
     */
    isGridVisible(): boolean {
        return this.showGrid;
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
