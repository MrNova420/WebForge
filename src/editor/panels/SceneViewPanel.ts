/**
 * WebForge Scene View Panel
 * 
 * 3D viewport for visualizing and manipulating the scene.
 * Provides camera controls, grid visualization, and gizmo rendering.
 */

import { Panel } from '../Panel';
import { EditorContext } from '../EditorContext';
import { Camera } from '../../rendering/Camera';
import { Scene } from '../../scene/Scene';
import { Renderer } from '../../rendering/Renderer';
import { Vector3 } from '../../math/Vector3';

/**
 * Camera control mode
 */
export enum CameraMode {
    ORBIT = 'orbit',
    FLY = 'fly',
    PAN = 'pan'
}

/**
 * Scene view panel for 3D viewport rendering
 */
export class SceneViewPanel extends Panel {
    private canvas: HTMLCanvasElement | null = null;
    private context: EditorContext;
    private camera: Camera | null = null;
    private scene: Scene | null = null;
    private renderer: Renderer | null = null;
    
    // Camera controls
    private cameraMode: CameraMode = CameraMode.ORBIT;
    private cameraDistance: number = 10;
    private cameraYaw: number = 0;
    private cameraPitch: number = 30;
    private cameraTarget: Vector3 = new Vector3(0, 0, 0);
    
    // Interaction state
    private isMouseDown: boolean = false;
    private lastMouseX: number = 0;
    private lastMouseY: number = 0;
    private mouseButton: number = -1;
    
    // Grid settings
    private showGrid: boolean = true;
    private gridSize: number = 20;
    private gridDivisions: number = 20;
    
    /**
     * Creates a new scene view panel
     * @param context - Editor context
     * @param id - Panel ID
     * @param title - Panel title
     */
    constructor(context: EditorContext, id: string = 'scene-view', title: string = 'Scene View') {
        super(id, title);
        this.context = context;
        
        // Listen to context changes
        this.context.on('viewportSettingsChanged', this.onViewportSettingsChanged.bind(this));
        this.context.on('gridSettingsChanged', this.onGridSettingsChanged.bind(this));
    }
    
    /**
     * Creates the panel content
     */
    protected createContent(): HTMLElement {
        const content = document.createElement('div');
        content.style.cssText = 'width: 100%; height: 100%; position: relative; overflow: hidden; background: #1a1a1a;';
        
        // Create canvas
        this.canvas = document.createElement('canvas');
        this.canvas.style.cssText = 'width: 100%; height: 100%; display: block;';
        content.appendChild(this.canvas);
        
        // Create toolbar
        const toolbar = this.createToolbar();
        content.appendChild(toolbar);
        
        // Setup canvas event listeners
        this.setupEventListeners();
        
        return content;
    }
    
    /**
     * Creates the scene view toolbar
     */
    private createToolbar(): HTMLElement {
        const toolbar = document.createElement('div');
        toolbar.style.cssText = `
            position: absolute;
            top: 10px;
            left: 10px;
            background: rgba(0, 0, 0, 0.7);
            padding: 8px;
            border-radius: 4px;
            display: flex;
            gap: 8px;
        `;
        
        // Camera mode buttons
        const modes = [
            { mode: CameraMode.ORBIT, icon: '🔄', title: 'Orbit Mode' },
            { mode: CameraMode.FLY, icon: '✈️', title: 'Fly Mode' },
            { mode: CameraMode.PAN, icon: '🖐️', title: 'Pan Mode' }
        ];
        
        modes.forEach(({ mode, icon, title }) => {
            const btn = document.createElement('button');
            btn.textContent = icon;
            btn.title = title;
            btn.style.cssText = `
                padding: 6px 12px;
                background: ${this.cameraMode === mode ? '#4a9eff' : 'rgba(255, 255, 255, 0.1)'};
                border: 1px solid rgba(255, 255, 255, 0.2);
                border-radius: 3px;
                color: white;
                cursor: pointer;
                font-size: 16px;
            `;
            btn.onclick = () => {
                this.cameraMode = mode;
                this.updateToolbar();
            };
            toolbar.appendChild(btn);
        });
        
        // Grid toggle button
        const gridBtn = document.createElement('button');
        gridBtn.textContent = this.showGrid ? '🟩' : '⬜';
        gridBtn.title = 'Toggle Grid';
        gridBtn.style.cssText = `
            padding: 6px 12px;
            background: rgba(255, 255, 255, 0.1);
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 3px;
            color: white;
            cursor: pointer;
            font-size: 16px;
            margin-left: 8px;
        `;
        gridBtn.onclick = () => {
            this.showGrid = !this.showGrid;
            gridBtn.textContent = this.showGrid ? '🟩' : '⬜';
        };
        toolbar.appendChild(gridBtn);
        
        return toolbar;
    }
    
    /**
     * Updates the toolbar UI
     */
    private updateToolbar(): void {
        const toolbar = this.content?.querySelector('div') as HTMLElement;
        if (toolbar && toolbar.children.length > 0) {
            // Update button states
            const buttons = Array.from(toolbar.children).slice(0, 3) as HTMLButtonElement[];
            buttons.forEach((btn, index) => {
                const modes = [CameraMode.ORBIT, CameraMode.FLY, CameraMode.PAN];
                btn.style.background = this.cameraMode === modes[index] 
                    ? '#4a9eff' 
                    : 'rgba(255, 255, 255, 0.1)';
            });
        }
    }
    
    /**
     * Sets up canvas event listeners
     */
    private setupEventListeners(): void {
        if (!this.canvas) return;
        
        // Mouse events
        this.canvas.addEventListener('mousedown', this.onMouseDown.bind(this));
        this.canvas.addEventListener('mousemove', this.onMouseMove.bind(this));
        this.canvas.addEventListener('mouseup', this.onMouseUp.bind(this));
        this.canvas.addEventListener('wheel', this.onMouseWheel.bind(this));
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
        
        // Resize observer
        const resizeObserver = new ResizeObserver(() => {
            this.handleResize();
        });
        resizeObserver.observe(this.canvas);
    }
    
    /**
     * Handles mouse down event
     */
    private onMouseDown(event: MouseEvent): void {
        this.isMouseDown = true;
        this.lastMouseX = event.clientX;
        this.lastMouseY = event.clientY;
        this.mouseButton = event.button;
    }
    
    /**
     * Handles mouse move event
     */
    private onMouseMove(event: MouseEvent): void {
        if (!this.isMouseDown) return;
        
        const deltaX = event.clientX - this.lastMouseX;
        const deltaY = event.clientY - this.lastMouseY;
        
        // Left mouse button - rotate/orbit
        if (this.mouseButton === 0) {
            if (this.cameraMode === CameraMode.ORBIT) {
                this.cameraYaw -= deltaX * 0.5;
                this.cameraPitch = Math.max(-89, Math.min(89, this.cameraPitch - deltaY * 0.5));
            } else if (this.cameraMode === CameraMode.FLY) {
                this.cameraYaw -= deltaX * 0.5;
                this.cameraPitch = Math.max(-89, Math.min(89, this.cameraPitch - deltaY * 0.5));
            }
        }
        
        // Middle mouse button or right mouse button - pan
        if (this.mouseButton === 1 || this.mouseButton === 2) {
            const panSpeed = 0.01 * this.cameraDistance;
            const right = new Vector3(1, 0, 0);
            const up = new Vector3(0, 1, 0);
            
            this.cameraTarget.x -= right.x * deltaX * panSpeed;
            this.cameraTarget.y += up.y * deltaY * panSpeed;
        }
        
        this.lastMouseX = event.clientX;
        this.lastMouseY = event.clientY;
        
        this.updateCamera();
    }
    
    /**
     * Handles mouse up event
     */
    private onMouseUp(event: MouseEvent): void {
        this.isMouseDown = false;
        this.mouseButton = -1;
    }
    
    /**
     * Handles mouse wheel event
     */
    private onMouseWheel(event: WheelEvent): void {
        event.preventDefault();
        
        const zoomSpeed = 0.1;
        this.cameraDistance *= (1 + event.deltaY * zoomSpeed * 0.01);
        this.cameraDistance = Math.max(1, Math.min(100, this.cameraDistance));
        
        this.updateCamera();
    }
    
    /**
     * Updates camera position based on controls
     */
    private updateCamera(): void {
        if (!this.camera) return;
        
        // Convert spherical coordinates to Cartesian
        const yawRad = this.cameraYaw * Math.PI / 180;
        const pitchRad = this.cameraPitch * Math.PI / 180;
        
        const x = this.cameraTarget.x + this.cameraDistance * Math.cos(pitchRad) * Math.sin(yawRad);
        const y = this.cameraTarget.y + this.cameraDistance * Math.sin(pitchRad);
        const z = this.cameraTarget.z + this.cameraDistance * Math.cos(pitchRad) * Math.cos(yawRad);
        
        this.camera.transform.setPosition(x, y, z);
        this.camera.lookAt(this.cameraTarget);
    }
    
    /**
     * Handles canvas resize
     */
    private handleResize(): void {
        if (!this.canvas) return;
        
        const rect = this.canvas.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
        
        if (this.camera) {
            this.camera.aspect = rect.width / rect.height;
            this.camera.updateProjectionMatrix();
        }
    }
    
    /**
     * Sets the scene to render
     */
    public setScene(scene: Scene): void {
        this.scene = scene;
    }
    
    /**
     * Sets the camera to use
     */
    public setCamera(camera: Camera): void {
        this.camera = camera;
        if (this.canvas) {
            this.handleResize();
        }
    }
    
    /**
     * Sets the renderer to use
     */
    public setRenderer(renderer: Renderer): void {
        this.renderer = renderer;
    }
    
    /**
     * Renders the scene
     */
    public render(): void {
        if (!this.renderer || !this.scene || !this.camera) return;
        
        // Render the scene
        this.renderer.render(this.scene, this.camera);
        
        // Render grid if enabled
        if (this.showGrid) {
            this.renderGrid();
        }
    }
    
    /**
     * Renders the grid
     */
    private renderGrid(): void {
        // Grid rendering would be done through the renderer's debug capabilities
        // This is a placeholder for the actual implementation
    }
    
    /**
     * Handles viewport settings changed
     */
    private onViewportSettingsChanged(): void {
        const settings = this.context.getViewportSettings();
        this.showGrid = settings.showGrid;
    }
    
    /**
     * Handles grid settings changed
     */
    private onGridSettingsChanged(): void {
        const settings = this.context.getGridSettings();
        this.gridSize = settings.size;
        this.gridDivisions = settings.divisions;
        this.showGrid = settings.visible;
    }
    
    /**
     * Called when panel is mounted
     */
    public onMount(): void {
        super.onMount();
        if (this.canvas) {
            this.handleResize();
        }
    }
    
    /**
     * Called when panel is unmounted
     */
    public onUnmount(): void {
        super.onUnmount();
        
        // Cleanup event listeners
        this.context.off('viewportSettingsChanged', this.onViewportSettingsChanged.bind(this));
        this.context.off('gridSettingsChanged', this.onGridSettingsChanged.bind(this));
    }
}
