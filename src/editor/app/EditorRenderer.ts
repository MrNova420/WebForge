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
import { PostProcessing, PostProcessingConfig } from '../../rendering/PostProcessing';
import { Framebuffer } from '../../rendering/Framebuffer';
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

// ─── Editor Renderer Constants ───────────────────────────────────────────────
/** Initial orbital distance from camera target (units) */
const DEFAULT_CAMERA_DISTANCE = 10;
/** Default camera orbit angle (radians) */
const DEFAULT_CAMERA_THETA = Math.PI / 4;
/** Default camera elevation angle (radians) */
const DEFAULT_CAMERA_PHI = Math.PI / 4;
/** Target camera elevation at start-up */
const DEFAULT_TARGET_PHI = Math.PI / 3;
/** Initial world extent in each direction (units) */
const INITIAL_WORLD_EXTENT = 100000;
/** Far plane multiplier relative to world extent */
const FAR_PLANE_MULTIPLIER = 10;
/** World expansion step (units added each time limits are reached) */
const WORLD_EXPANSION_SIZE = 100000;
/** Threshold (fraction of bounds) at which world auto-expands */
const WORLD_EXPANSION_THRESHOLD = 0.95;
/** Default background clear colour (RGBA) */
const DEFAULT_BACKGROUND_COLOR: [number, number, number, number] = [0.1, 0.1, 0.12, 1.0];
/** Camera smoothing factor – lower = smoother transitions */
const CAMERA_SMOOTHNESS = 0.15;
/** Default camera field-of-view (radians, ~60°) */
const DEFAULT_FOV = 60 * Math.PI / 180;
/** Near clipping plane distance */
const NEAR_PLANE = 0.1;
/** Initial camera position (units) */
const INITIAL_CAMERA_POS = 5;
/** Ray direction zero-check epsilon */
const RAY_EPSILON = 0.0001;
/** Camera orbit speed (radians per pixel) */
const ORBIT_SPEED = 0.008;
/** Camera pan speed multiplier (scaled by distance) */
const PAN_SPEED_FACTOR = 0.003;
/** Mouse-drag detection threshold (pixels) */
const DRAG_THRESHOLD = 2;
/** Maximum click duration for selection (ms) */
const CLICK_DURATION_MAX = 150;
/** Gizmo handle size relative to camera distance */
const GIZMO_SIZE_FACTOR = 0.15;
/** Gizmo handle hit radius (pixels) */
const GIZMO_HIT_RADIUS = 25;
/** Move speed when dragging along gizmo axis */
const TRANSLATE_SPEED_FACTOR = 0.005;
/** Rotation speed when dragging gizmo (radians per pixel) */
const ROTATE_SPEED = 0.01;
/** Scale speed when dragging gizmo (scale units per pixel) */
const SCALE_SPEED = 0.01;
/** Minimum allowed scale on any axis */
const MIN_SCALE = 0.01;
/** Zoom speed per wheel tick */
const ZOOM_SPEED = 0.1;
/** Zoom speed dampening factor */
const ZOOM_DAMPENING = 0.01;
/** Minimum camera orbit distance */
const MIN_CAMERA_DISTANCE = 0.5;
/** Maximum camera orbit distance */
const MAX_CAMERA_DISTANCE = 50000;
/** Minimum screen-space hit-box size for picking (pixels) */
const MIN_PICKABLE_SIZE = 20;
/** Extra padding added around screen-space hit boxes (pixels) */
const PICK_PADDING = 3;
/** Minimum bounding-box half-height for flat objects */
const MIN_HALF_HEIGHT = 0.1;
/** Minimum AABB half-height for raycast */
const MIN_RAYCAST_HALF_HEIGHT = 0.05;
/** Depth tolerance when comparing pick candidates */
const PICK_DEPTH_TOLERANCE = 0.5;
/** Screen-size tolerance when comparing pick candidates */
const PICK_SIZE_TOLERANCE = 100;
/** Phi clamp bounds for camera orbit (prevents gimbal flip) */
const PHI_MIN = 0.1;
/** Maximum phi (prevents going past nadir) */
const PHI_MAX = Math.PI - 0.1;

/**
 * Editor Renderer
 * 
 * Handles all WebGL rendering for the editor viewport.
 * Magic numbers extracted to named constants above for maintainability.
 */
export class EditorRenderer {
    private glContext: WebGLContext;
    private context: EditorContext;
    private logger: Logger;
    
    // Camera
    private camera: Camera;
    private cameraTarget: Vector3 = new Vector3(0, 0, 0);
    private cameraDistance: number = DEFAULT_CAMERA_DISTANCE;
    private cameraRotation: { theta: number; phi: number } = { theta: DEFAULT_CAMERA_THETA, phi: DEFAULT_CAMERA_PHI };
    
    // Dynamic world bounds - starts at 100k, extends 100k more when reached
    private worldBounds = { min: -INITIAL_WORLD_EXTENT, max: INITIAL_WORLD_EXTENT };
    private currentFarPlane: number = INITIAL_WORLD_EXTENT * FAR_PLANE_MULTIPLIER;
    private readonly EXPANSION_SIZE = WORLD_EXPANSION_SIZE;
    
    // WebGL resources
    private gridShader: WebGLProgram | null = null;
    private objectShader: WebGLProgram | null = null;
    private lineShader: WebGLProgram | null = null;
    private gridVAO: WebGLVertexArrayObject | null = null;
    private gridVertexCount: number = 0;
    
    // Drag/drop live preview
    private previewPosition: Vector3 | null = null;
    private previewType: string | null = null;
    
    // Primitive buffers
    private cubeVAO: WebGLVertexArrayObject | null = null;
    private sphereVAO: WebGLVertexArrayObject | null = null;
    private planeVAO: WebGLVertexArrayObject | null = null;
    private cylinderVAO: WebGLVertexArrayObject | null = null;
    private coneVAO: WebGLVertexArrayObject | null = null;
    
    // Terrain mesh cache (keyed by object name, rebuilt when heightmap changes)
    private terrainVAOs: Map<string, { vao: WebGLVertexArrayObject; indexCount: number; version: number }> = new Map();

    // Gizmo buffer (cached, reused each frame)
    private gizmoVAO: WebGLVertexArrayObject | null = null;
    private gizmoBuffer: WebGLBuffer | null = null;
    
    // Settings
    private wireframe: boolean = false;
    private showGrid: boolean = true;
    private backgroundColor: [number, number, number, number] = DEFAULT_BACKGROUND_COLOR;
    
    // Camera smoothing
    private cameraSmoothness: number = CAMERA_SMOOTHNESS;
    private targetCameraRotation = { theta: DEFAULT_CAMERA_THETA, phi: DEFAULT_TARGET_PHI };
    private targetCameraDistance: number = DEFAULT_CAMERA_DISTANCE;
    
    // Statistics
    private stats: RenderStats = { drawCalls: 0, triangles: 0, vertices: 0 };
    
    // Post-processing pipeline
    private postProcessing: PostProcessing | null = null;
    private sceneFramebuffer: Framebuffer | null = null;
    private postProcessEnabled: boolean = false;
    
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
        this.camera.setPerspective(DEFAULT_FOV, aspect, NEAR_PLANE, this.currentFarPlane);
        this.camera.setPosition(new Vector3(INITIAL_CAMERA_POS, INITIAL_CAMERA_POS, INITIAL_CAMERA_POS));
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
            uniform bool uIsPreview;
            void main() {
                vec3 normal = normalize(vNormal);
                vec3 lightDir = normalize(vec3(1.0, 2.0, 1.5));
                float diffuse = max(dot(normal, lightDir), 0.0);
                float ambient = 0.12;
                vec3 color = uColor * (ambient + diffuse * 0.7);
                
                // Selection highlight
                if (uSelected) {
                    vec3 viewDir = normalize(uCameraPos - vWorldPos);
                    float fresnel = 1.0 - max(dot(normal, viewDir), 0.0);
                    color += vec3(0.0, 0.5, 1.0) * fresnel * 0.5;
                }
                
                float alpha = uIsPreview ? 0.35 : 1.0;
                fragColor = vec4(color, alpha);
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
     * Build or rebuild a terrain mesh VAO from heightmap data.
     * Returns the cached entry (creates a new one when the heightmap version changes).
     */
    private getOrCreateTerrainVAO(
        gl: WebGL2RenderingContext,
        obj: GameObject
    ): { vao: WebGLVertexArrayObject; indexCount: number } | null {
        const terrainObj = obj as any;
        const heightData: Float32Array | undefined = terrainObj.terrainHeightData;
        if (!heightData) return null;

        const res: number = terrainObj.terrainResolution || 64;
        const version: number = terrainObj._terrainVersion ?? 0;
        const key = obj.name;

        const cached = this.terrainVAOs.get(key);
        if (cached && cached.version === version) {
            return cached;
        }

        // Build grid mesh: res × res vertices, (res-1)² × 2 triangles
        const vertCount = res * res;
        // 6 floats per vert: pos(3) + normal(3)
        const verts = new Float32Array(vertCount * 6);
        const idxCount = (res - 1) * (res - 1) * 6;
        // Use Uint32 for terrains larger than ~256 res
        const indices = vertCount > 65535 ? new Uint32Array(idxCount) : new Uint16Array(idxCount);

        // Fill vertices — positions in [-0.5, 0.5] range (model space, scaled by transform)
        for (let z = 0; z < res; z++) {
            for (let x = 0; x < res; x++) {
                const i = z * res + x;
                const base = i * 6;
                verts[base]     = (x / (res - 1)) - 0.5; // x in [-0.5, 0.5]
                verts[base + 1] = heightData[i];           // y = height
                verts[base + 2] = (z / (res - 1)) - 0.5; // z in [-0.5, 0.5]
                // placeholder normals — computed below
                verts[base + 3] = 0;
                verts[base + 4] = 1;
                verts[base + 5] = 0;
            }
        }

        // Compute face normals via finite differences
        for (let z = 0; z < res; z++) {
            for (let x = 0; x < res; x++) {
                const i = z * res + x;
                const h = heightData[i];
                const hL = x > 0 ? heightData[i - 1] : h;
                const hR = x < res - 1 ? heightData[i + 1] : h;
                const hD = z > 0 ? heightData[i - res] : h;
                const hU = z < res - 1 ? heightData[i + res] : h;
                // normal = normalize(cross(tangentX, tangentZ))
                const nx = hL - hR;
                const nz = hD - hU;
                const ny = 2.0 / res; // spacing between samples in model coords
                const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
                const base = i * 6;
                verts[base + 3] = nx / len;
                verts[base + 4] = ny / len;
                verts[base + 5] = nz / len;
            }
        }

        // Fill indices (two triangles per quad)
        let idx = 0;
        for (let z = 0; z < res - 1; z++) {
            for (let x = 0; x < res - 1; x++) {
                const tl = z * res + x;
                const tr = tl + 1;
                const bl = tl + res;
                const br = bl + 1;
                indices[idx++] = tl;
                indices[idx++] = bl;
                indices[idx++] = tr;
                indices[idx++] = tr;
                indices[idx++] = bl;
                indices[idx++] = br;
            }
        }

        // Delete old VAO if exists
        if (cached) {
            gl.deleteVertexArray(cached.vao);
        }

        const vao = this.glContext.createVertexArray()!;
        this.glContext.bindVertexArray(vao);

        const vbo = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
        gl.bufferData(gl.ARRAY_BUFFER, verts, gl.DYNAMIC_DRAW);

        const ebo = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ebo);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.DYNAMIC_DRAW);

        // pos
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0);
        // normal
        gl.enableVertexAttribArray(1);
        gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 24, 12);

        this.glContext.bindVertexArray(null);

        const entry = { vao, indexCount: idxCount, version };
        (vao as any).indexCount = idxCount;
        this.terrainVAOs.set(key, entry);
        return entry;
    }

    /**
     * Invalidate a terrain VAO so it will be rebuilt on next render.
     */
    invalidateTerrainVAO(objectName: string): void {
        const cached = this.terrainVAOs.get(objectName);
        if (cached) {
            cached.version = -1; // Force rebuild
        }
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
        if (e.button === 2 && e.altKey && selected.length > 0) {
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
            this.handleHoverDetection(canvas, mouseX, mouseY);
        }
        
        // Handle direct object dragging (Alt+drag) - FREE MOVEMENT like Unreal/Unity
        if (this.objectDragging) {
            this.handleObjectDragging(mouseX, mouseY);
            return;
        }
        
        // Handle gizmo dragging
        if (this.gizmoDragging && this.gizmoAxis) {
            this.handleGizmoDragging(mouseX, mouseY);
            return;
        }
        
        // Handle camera dragging
        this.handleCameraDragging(e);
    };

    /**
     * Updates hover state when cursor moves over objects
     */
    private handleHoverDetection(canvas: HTMLCanvasElement, mouseX: number, mouseY: number): void {
        const prevHovered = this.hoveredObject;
        this.hoveredObject = this.pickObject(mouseX, mouseY);
        
        if (this.hoveredObject !== prevHovered) {
            canvas.style.cursor = this.hoveredObject ? 'pointer' : 'default';
        }
    }

    /**
     * Handles free-form object dragging (Alt+drag) on a camera-perpendicular plane
     */
    private handleObjectDragging(mouseX: number, mouseY: number): void {
        const selected = this.context.getSelection();
        if (selected.length === 0) return;
        
        const obj = selected[0];
        const ray = this.screenToRay(mouseX, mouseY);
        if (!ray) return;
        
        const objPos = obj.transform.position;
        const cameraForward = this.camera.getTransform().forward();
        const planeNormal = cameraForward.clone().negate();
        const denom = planeNormal.dot(ray.direction);
        
        if (Math.abs(denom) > RAY_EPSILON) {
            const p0 = objPos.clone().subtract(ray.origin);
            const t = planeNormal.dot(p0) / denom;
            
            if (t >= 0) {
                const newPos = ray.origin.clone().add(ray.direction.clone().multiplyScalar(t));
                obj.transform.position.copy(newPos);
                obj.transform.markLocalDirty();
                this.context.setSelection(selected);
            }
        }
        
        this.lastMouseX = mouseX;
        this.lastMouseY = mouseY;
    }

    /**
     * Handles gizmo-axis-constrained dragging for translate/rotate/scale
     */
    private handleGizmoDragging(mouseX: number, mouseY: number): void {
        const selected = this.context.getSelection();
        const transformMode = this.context.getTransformMode();
        
        if (selected.length === 0) return;
        
        const obj = selected[0];
        const dx = mouseX - this.lastMouseX;
        const dy = mouseY - this.lastMouseY;
        
        let axisDir = new Vector3();
        switch (this.gizmoAxis) {
            case 'x': axisDir.set(1, 0, 0); break;
            case 'y': axisDir.set(0, 1, 0); break;
            case 'z': axisDir.set(0, 0, 1); break;
        }
        
        if (transformMode === TransformMode.TRANSLATE) {
            this.applyGizmoTranslate(obj, axisDir, dx, dy);
        } else if (transformMode === TransformMode.ROTATE) {
            this.applyGizmoRotate(obj, axisDir, dx, dy);
        } else if (transformMode === TransformMode.SCALE) {
            this.applyGizmoScale(obj, dx, dy);
        }
        
        this.context.setSelection(selected);
        this.lastMouseX = mouseX;
        this.lastMouseY = mouseY;
    }

    /**
     * Applies translation along a gizmo axis based on screen-space drag
     */
    private applyGizmoTranslate(obj: GameObject, axisDir: Vector3, dx: number, dy: number): void {
        const objPos = obj.transform.position;
        const screenStart = this.worldToScreen(objPos);
        const axisEnd = objPos.clone().add(axisDir);
        const screenEnd = this.worldToScreen(axisEnd);
        
        const screenAxisX = screenEnd.x - screenStart.x;
        const screenAxisY = screenEnd.y - screenStart.y;
        const screenAxisLen = Math.sqrt(screenAxisX * screenAxisX + screenAxisY * screenAxisY);
        
        if (screenAxisLen > 0.001) {
            const dot = (dx * screenAxisX + dy * screenAxisY) / screenAxisLen;
            const moveSpeed = this.cameraDistance * TRANSLATE_SPEED_FACTOR;
            const worldDelta = dot * moveSpeed / screenAxisLen;
            const movement = axisDir.clone().multiplyScalar(worldDelta);
            obj.transform.translate(movement);
            
            const snapSettings = this.context.getSnappingSettings();
            if (snapSettings.gridSnapping) {
                const gridSize = snapSettings.gridSize || 1.0;
                obj.transform.position.x = Math.round(obj.transform.position.x / gridSize) * gridSize;
                obj.transform.position.y = Math.round(obj.transform.position.y / gridSize) * gridSize;
                obj.transform.position.z = Math.round(obj.transform.position.z / gridSize) * gridSize;
                obj.transform.markLocalDirty();
            }
        }
    }

    /**
     * Applies rotation around a gizmo axis based on screen-space drag
     */
    private applyGizmoRotate(obj: GameObject, axisDir: Vector3, dx: number, dy: number): void {
        const angle = (dx + dy) * ROTATE_SPEED;
        const rotQuat = Quaternion.fromAxisAngle(axisDir, angle);
        obj.transform.rotation = obj.transform.rotation.multiply(rotQuat);
        obj.transform.markLocalDirty();
    }

    /**
     * Applies scale along the active gizmo axis
     */
    private applyGizmoScale(obj: GameObject, dx: number, dy: number): void {
        const scaleDelta = (dx + dy) * SCALE_SPEED;
        const currentScale = obj.transform.scale;
        switch (this.gizmoAxis) {
            case 'x': currentScale.x = Math.max(MIN_SCALE, currentScale.x + scaleDelta); break;
            case 'y': currentScale.y = Math.max(MIN_SCALE, currentScale.y + scaleDelta); break;
            case 'z': currentScale.z = Math.max(MIN_SCALE, currentScale.z + scaleDelta); break;
        }
        obj.transform.markLocalDirty();
    }

    /**
     * Handles camera orbit and pan via mouse dragging
     */
    private handleCameraDragging(e: MouseEvent): void {
        if (!this.isDragging) return;
        
        const dx = e.clientX - this.lastMouseX;
        const dy = e.clientY - this.lastMouseY;
        
        const totalMovement = Math.abs(dx) + Math.abs(dy);
        if (totalMovement > DRAG_THRESHOLD) {
            this.hasDragged = true;
            console.log('[EditorRenderer] Camera drag detected:', { dx, dy, totalMovement });
        }
        
        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;
        
        const orbitSpeed = ORBIT_SPEED;
        const panSpeed = this.cameraDistance * PAN_SPEED_FACTOR;
        
        if (this.dragButton === 1 || (this.dragButton === 0 && e.shiftKey)) {
            const right = this.camera.getTransform().right();
            const up = this.camera.getTransform().up();
            
            this.cameraTarget.x -= right.x * dx * panSpeed + up.x * dy * panSpeed;
            this.cameraTarget.y -= right.y * dx * panSpeed + up.y * dy * panSpeed;
            this.cameraTarget.z -= right.z * dx * panSpeed + up.z * dy * panSpeed;
        } else if (this.dragButton === 0 || this.dragButton === 2) {
            this.targetCameraRotation.theta -= dx * orbitSpeed;
            this.targetCameraRotation.phi = Math.max(PHI_MIN, Math.min(PHI_MAX, this.targetCameraRotation.phi - dy * orbitSpeed));
        }
    }

    private onMouseUp = (e: MouseEvent): void => {
        const clickDuration = Date.now() - this.dragStartTime;
        
        // Save the drag state BEFORE resetting
        const wasDragging = this.hasDragged;
        
        // ONLY allow selection if:
        // 1. Left click (button 0)
        // 2. Never moved mouse during this click session (wasDragged is false)
        // 3. Quick click (< 150ms)
        const canSelect = e.button === 0 && !wasDragging && clickDuration < CLICK_DURATION_MAX;
        
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
                // Multi-select: Ctrl+Click toggles object in selection set
                if (e.ctrlKey || e.metaKey) {
                    const current = this.context.getSelection();
                    const idx = current.indexOf(clickedObject);
                    if (idx >= 0) {
                        // Remove from selection
                        const updated = current.filter(o => o !== clickedObject);
                        this.context.setSelection(updated);
                    } else {
                        // Add to selection
                        this.context.setSelection([...current, clickedObject]);
                    }
                } else {
                    // Single-select: replace selection
                    this.context.setSelection([clickedObject]);
                }
                // Auto-switch to translate mode
                const transformMode = this.context.getTransformMode();
                if (transformMode === TransformMode.SELECT) {
                    this.context.setTransformMode(TransformMode.TRANSLATE);
                }
            } else {
                // Clicked empty space - clear selection (unless Ctrl held)
                if (!(e.ctrlKey || e.metaKey)) {
                    this.context.setSelection([]);
                }
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
        const zoomSpeed = ZOOM_SPEED;
        this.targetCameraDistance *= 1 + e.deltaY * zoomSpeed * ZOOM_DAMPENING;
        // Prevent going too close or too far (prevent grid breaking)
        this.targetCameraDistance = Math.max(MIN_CAMERA_DISTANCE, Math.min(MAX_CAMERA_DISTANCE, this.targetCameraDistance));
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
        if (maxDist > this.worldBounds.max * WORLD_EXPANSION_THRESHOLD) {
            // Expand bounds by adding 100k evenly
            this.worldBounds.max += this.EXPANSION_SIZE;
            this.worldBounds.min -= this.EXPANSION_SIZE;
            
            // Update far plane to 10x the new world bounds
            this.currentFarPlane = this.worldBounds.max * FAR_PLANE_MULTIPLIER;
            const aspect = this.glContext.getWidth() / this.glContext.getHeight();
            this.camera.setPerspective(DEFAULT_FOV, aspect, NEAR_PLANE, this.currentFarPlane);
            
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
        const gizmoSize = this.cameraDistance * GIZMO_SIZE_FACTOR;
        
        // Only check handle endpoints, not the lines - prevents blocking object selection
        const handleHitRadius = GIZMO_HIT_RADIUS;
        
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
            const halfY = Math.max(scale.y * 0.5, MIN_HALF_HEIGHT); // Min height for flat objects
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
            const minSize = MIN_PICKABLE_SIZE;
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
            const padding = PICK_PADDING;
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
            if (Math.abs(zDiff) > PICK_DEPTH_TOLERANCE) return zDiff;
            
            // For similar depths, prefer smaller objects (more precise clicks)
            const sizeDiff = a.boxSize - b.boxSize;
            if (Math.abs(sizeDiff) > PICK_SIZE_TOLERANCE) return sizeDiff;
            
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
            const halfY = Math.max(scale.y * 0.5, MIN_RAYCAST_HALF_HEIGHT); // Min height for flat objects
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
        if (Math.abs(direction.x) > RAY_EPSILON) {
            const t1 = (boxMin.x - origin.x) / direction.x;
            const t2 = (boxMax.x - origin.x) / direction.x;
            tmin = Math.max(tmin, Math.min(t1, t2));
            tmax = Math.min(tmax, Math.max(t1, t2));
        } else if (origin.x < boxMin.x || origin.x > boxMax.x) {
            return null;
        }
        
        // Check Y axis
        if (Math.abs(direction.y) > RAY_EPSILON) {
            const t1 = (boxMin.y - origin.y) / direction.y;
            const t2 = (boxMax.y - origin.y) / direction.y;
            tmin = Math.max(tmin, Math.min(t1, t2));
            tmax = Math.min(tmax, Math.max(t1, t2));
        } else if (origin.y < boxMin.y || origin.y > boxMax.y) {
            return null;
        }
        
        // Check Z axis
        if (Math.abs(direction.z) > RAY_EPSILON) {
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
        
        // If post-processing is enabled, render to offscreen framebuffer
        const usePostProcess = this.postProcessEnabled && this.postProcessing && this.sceneFramebuffer;
        if (usePostProcess && this.sceneFramebuffer) {
            this.sceneFramebuffer.bind();
        }
        
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
        
        // Render grid after objects so it respects depth
        if (this.showGrid) {
            this.renderGrid(gl, viewProj);
        }
        
        // Render live placement preview (during drag/drop) on top
        this.renderPreview(gl, viewProj);
        
        // Render gizmos for selected objects (only in transform modes, not select mode)
        const selected = this.context.getSelection();
        const transformMode = this.context.getTransformMode();
        if (selected.length > 0 && transformMode !== TransformMode.SELECT) {
            this.renderGizmos(gl, viewProj, selected);
        }
        
        // Apply post-processing if enabled
        if (usePostProcess && this.sceneFramebuffer && this.postProcessing) {
            this.sceneFramebuffer.unbind();
            const sceneTex = this.sceneFramebuffer.getColorTexture();
            if (sceneTex) {
                this.postProcessing.process(sceneTex, null);
            }
        }
    }

    /**
     * Render live placement preview as a wireframe box
     */
    private renderPreview(gl: WebGL2RenderingContext, viewProj: Matrix4): void {
        if (!this.previewPosition || !this.objectShader) return;

        // Choose geometry based on type
        const type = this.previewType || 'cube';
        let vao: WebGLVertexArrayObject | null = null;
        let color: [number, number, number] = [0.1, 0.8, 1.0];
        switch (type) {
            case 'sphere': vao = this.sphereVAO; color = [0.8, 0.4, 0.4]; break;
            case 'plane': vao = this.planeVAO; color = [0.5, 0.5, 0.5]; break;
            case 'cylinder': vao = this.cylinderVAO; color = [0.6, 0.8, 0.4]; break;
            case 'cone': vao = this.coneVAO; color = [0.8, 0.6, 0.4]; break;
            case 'capsule': vao = this.cylinderVAO; color = [0.4, 0.8, 0.6]; break;
            case 'light': vao = this.sphereVAO; color = [1.0, 0.9, 0.5]; break;
            case 'particles': vao = this.sphereVAO; color = [1.0, 0.6, 0.1]; break;
            case 'audio': vao = this.sphereVAO; color = [0.3, 0.8, 1.0]; break;
            case 'camera': vao = this.cubeVAO; color = [0.6, 0.6, 0.9]; break;
            default: vao = this.cubeVAO; color = [0.1, 0.8, 1.0];
        }
        if (!vao) return;

        gl.enable(gl.DEPTH_TEST);
        gl.depthMask(false);
        gl.enable(gl.BLEND);
        gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

        gl.useProgram(this.objectShader);
        gl.uniformMatrix4fv(gl.getUniformLocation(this.objectShader, 'uViewProjection'), false, viewProj.elements);
        gl.uniform3fv(gl.getUniformLocation(this.objectShader, 'uCameraPos'), this.camera.getPosition().toArray());

        const model = Matrix4.translation(this.previewPosition);
        gl.uniformMatrix4fv(gl.getUniformLocation(this.objectShader, 'uModel'), false, model.elements);
        const normalMatrix = model.clone().invert().transpose();
        const normalMat3 = [
            normalMatrix.elements[0], normalMatrix.elements[1], normalMatrix.elements[2],
            normalMatrix.elements[4], normalMatrix.elements[5], normalMatrix.elements[6],
            normalMatrix.elements[8], normalMatrix.elements[9], normalMatrix.elements[10]
        ];
        gl.uniformMatrix3fv(gl.getUniformLocation(this.objectShader, 'uNormalMatrix'), false, normalMat3);

        const previewColor: [number, number, number] = [
            color[0] * 0.6 + 0.2,
            color[1] * 0.6 + 0.2,
            color[2] * 0.6 + 0.2
        ];
        gl.uniform3fv(gl.getUniformLocation(this.objectShader, 'uColor'), previewColor);
        gl.uniform1i(gl.getUniformLocation(this.objectShader, 'uSelected'), 0);
        gl.uniform1i(gl.getUniformLocation(this.objectShader, 'uIsPreview'), 1);

        this.glContext.bindVertexArray(vao);
        const indexCount = (vao as any).indexCount || 36;
        gl.drawElements(gl.TRIANGLES, indexCount, gl.UNSIGNED_SHORT, 0);
        this.glContext.bindVertexArray(null);

        gl.uniform1i(gl.getUniformLocation(this.objectShader, 'uIsPreview'), 0);
        gl.disable(gl.BLEND);
        gl.depthMask(true);
        gl.depthMask(true);
    }

    /**
     * Render grid
     */
    private renderGrid(gl: WebGL2RenderingContext, _viewProj: Matrix4): void {
        if (!this.gridShader || !this.gridVAO) return;
        
        // Enable blending for grid transparency, but keep depth writes/tests so grid sits behind geometry
        gl.enable(gl.BLEND);
        gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        gl.depthMask(true);
        gl.enable(gl.DEPTH_TEST);
        gl.depthFunc(gl.LEQUAL);
        
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
        gl.depthMask(true);
        gl.depthMask(true);
        
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
        gl.uniform1i(gl.getUniformLocation(this.objectShader, 'uIsPreview'), 0);
        
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
            case 'terrain': {
                // Use dynamic heightmap mesh instead of flat plane
                const terrainEntry = this.getOrCreateTerrainVAO(gl, obj);
                vao = terrainEntry ? terrainEntry.vao : this.planeVAO;
                break;
            }
            case 'light': vao = this.sphereVAO; break; // Lights render as small spheres
            default: vao = this.cubeVAO;
        }
        
        if (vao) {
            this.glContext.bindVertexArray(vao);
            const indexCount = (vao as any).indexCount || 36;
            
            // Terrain with large index counts needs Uint32 indices
            const indexType = indexCount > 65535 ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT;
            
            if (this.wireframe) {
                gl.drawElements(gl.LINES, indexCount, indexType, 0);
            } else {
                gl.drawElements(gl.TRIANGLES, indexCount, indexType, 0);
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
            center.addSelf(obj.transform.position);
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
     * Update live preview position for drag-drop placement
     */
    setPreviewPosition(pos: { x: number; y: number; z: number } | null, type?: string): void {
        this.previewPosition = pos ? new Vector3(pos.x, pos.y, pos.z) : null;
        this.previewType = pos ? (type || null) : null;
    }

    /**
     * Clear placement preview
     */
    clearPreviewPosition(): void {
        this.previewPosition = null;
        this.previewType = null;
    }

    /**
     * Convert normalized screen coords (0-1) to ground plane hit (y=0)
     */
    screenToGround(normX: number, normY: number): Vector3 | null {
        const canvas = this.glContext.canvas as HTMLCanvasElement;
        const screenX = normX * canvas.width;
        const screenY = normY * canvas.height;
        const ray = this.screenToRay(screenX, screenY);
        if (!ray) return null;

        const denom = ray.direction.y;
        if (Math.abs(denom) < 1e-5) return null;

        const t = -ray.origin.y / denom;
        if (t < 0) return null;

        return ray.origin.clone().add(ray.direction.clone().multiplyScalar(t));
    }

    /**
     * Raycast to scene objects to place on surfaces; returns hit position or null
     */
    screenToSurface(normX: number, normY: number): { point: Vector3, normal: Vector3 } | null {
        const canvas = this.glContext.canvas as HTMLCanvasElement;
        const screenX = normX * canvas.width;
        const screenY = normY * canvas.height;
        const ray = this.screenToRay(screenX, screenY);
        if (!ray || !this.currentScene) return null;

        // Simple AABB intersection against objects
        let closest: { point: Vector3, normal: Vector3, t: number } | null = null;
        for (const obj of this.currentScene.getAllGameObjects()) {
            const pos = obj.transform.position;
            const scale = obj.transform.scale;
            const half = scale.clone().multiplyScalar(0.5);
            const min = pos.clone().subtract(half);
            const max = pos.clone().add(half);
            const t = this.rayIntersectAABB(ray.origin, ray.direction, min, max);
            if (t !== null && t >= 0 && t < (closest?.t ?? Infinity)) {
                const hitPoint = ray.origin.clone().add(ray.direction.clone().multiplyScalar(t));
                // Approximate normal by which face was hit
                const epsilon = 1e-4;
                let normal = new Vector3(0, 1, 0);
                const rel = hitPoint.clone().subtract(pos);
                if (Math.abs(Math.abs(rel.x) - half.x) < epsilon) normal = new Vector3(Math.sign(rel.x), 0, 0);
                else if (Math.abs(Math.abs(rel.y) - half.y) < epsilon) normal = new Vector3(0, Math.sign(rel.y), 0);
                else if (Math.abs(Math.abs(rel.z) - half.z) < epsilon) normal = new Vector3(0, 0, Math.sign(rel.z));

                closest = { point: hitPoint, normal, t };
            }
        }
        return closest ? { point: closest.point, normal: closest.normal } : null;
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
        if (this.postProcessing) {
            this.postProcessing.resize(width, height);
        }

        // Ensure the scene framebuffer matches the new dimensions when post-processing is enabled
        if (this.sceneFramebuffer) {
            this.sceneFramebuffer.destroy();
            const gl = this.glContext.getGL() as WebGL2RenderingContext;
            this.sceneFramebuffer = new Framebuffer(gl, {
                width,
                height,
                colorAttachments: 1,
                depthAttachment: true
            });
        }
    }

    /**
     * Get render statistics
     */
    getStats(): RenderStats {
        return { ...this.stats };
    }

    /**
     * Enable post-processing pipeline
     */
    enablePostProcessing(config?: PostProcessingConfig): void {
        if (this.postProcessing) {
            this.postProcessing.enable();
            this.postProcessEnabled = true;
            return;
        }
        
        const width = this.glContext.getWidth();
        const height = this.glContext.getHeight();
        
        this.postProcessing = new PostProcessing(this.glContext, width, height, config);
        this.sceneFramebuffer = new Framebuffer(this.glContext.getGL() as WebGL2RenderingContext, {
            width,
            height,
            colorAttachments: 1,
            depthAttachment: true
        });
        this.postProcessEnabled = true;
        this.logger.info('Post-processing enabled');
    }

    /**
     * Disable post-processing pipeline
     */
    disablePostProcessing(): void {
        if (this.postProcessing) {
            this.postProcessing.disable();
        }
        this.postProcessEnabled = false;
    }

    /**
     * Get post-processing pipeline
     */
    getPostProcessing(): PostProcessing | null {
        return this.postProcessing;
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
        
        if (this.postProcessing) {
            this.postProcessing.dispose();
            this.postProcessing = null;
        }

        if (this.sceneFramebuffer) {
            this.sceneFramebuffer.destroy();
            this.sceneFramebuffer = null;
        }
        
        this.logger.info('EditorRenderer disposed');
    }
}
