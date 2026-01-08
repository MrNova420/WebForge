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
import { GizmoManager } from '../gizmos/GizmoManager';
import { CameraController, ViewDirection } from '../camera/CameraController';

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
    private cameraController: CameraController | null = null;
    private scene: Scene | null = null;
    private renderer: Renderer | null = null;
    private gizmoManager: GizmoManager | null = null;
    protected content: HTMLElement | null = null;
    
    // Camera controls (legacy - kept for compatibility)
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
    
    // Keyboard state for fly mode
    private keysPressed: Set<string> = new Set();
    
    // Grid settings
    private showGrid: boolean = true;
    
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
        this.content = document.createElement('div');
        this.content.style.cssText = 'width: 100%; height: 100%; position: relative; overflow: hidden; background: #1a1a1a;';
        
        // Create canvas
        this.canvas = document.createElement('canvas');
        this.canvas.style.cssText = 'width: 100%; height: 100%; display: block;';
        this.content.appendChild(this.canvas);
        
        // Create gizmo manager
        this.gizmoManager = new GizmoManager(this.context, this.canvas);
        
        // Create toolbar
        const toolbar = this.createToolbar();
        this.content.appendChild(toolbar);
        
        // Setup canvas event listeners
        this.setupEventListeners();
        
        return this.content;
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
        
        // View shortcuts dropdown
        const viewMenu = this.createViewMenu();
        toolbar.appendChild(viewMenu);
        
        // Frame selected button
        const frameBtn = document.createElement('button');
        frameBtn.textContent = '🎯';
        frameBtn.title = 'Frame Selected (F)';
        frameBtn.style.cssText = `
            padding: 6px 12px;
            background: rgba(255, 255, 255, 0.1);
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 3px;
            color: white;
            cursor: pointer;
            font-size: 16px;
            margin-left: 8px;
        `;
        frameBtn.onclick = () => {
            this.frameSelected();
        };
        toolbar.appendChild(frameBtn);
        
        return toolbar;
    }
    
    /**
     * Creates the view menu
     */
    private createViewMenu(): HTMLElement {
        const container = document.createElement('div');
        container.style.cssText = 'position: relative; margin-left: 8px;';
        
        const btn = document.createElement('button');
        btn.textContent = '👁️';
        btn.title = 'View Options';
        btn.style.cssText = `
            padding: 6px 12px;
            background: rgba(255, 255, 255, 0.1);
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 3px;
            color: white;
            cursor: pointer;
            font-size: 16px;
        `;
        
        const menu = document.createElement('div');
        menu.style.cssText = `
            display: none;
            position: absolute;
            top: 100%;
            left: 0;
            margin-top: 4px;
            background: rgba(0, 0, 0, 0.9);
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 4px;
            padding: 4px;
            min-width: 150px;
            z-index: 1000;
        `;
        
        const views = [
            { name: 'Front', direction: ViewDirection.FRONT, key: '1' },
            { name: 'Back', direction: ViewDirection.BACK, key: '2' },
            { name: 'Top', direction: ViewDirection.TOP, key: '7' },
            { name: 'Bottom', direction: ViewDirection.BOTTOM, key: '8' },
            { name: 'Left', direction: ViewDirection.LEFT, key: '3' },
            { name: 'Right', direction: ViewDirection.RIGHT, key: '4' },
            { name: 'Perspective', direction: ViewDirection.PERSPECTIVE, key: '5' }
        ];
        
        views.forEach(({ name, direction, key }) => {
            const item = document.createElement('div');
            item.textContent = `${name} (${key})`;
            item.style.cssText = `
                padding: 8px 12px;
                cursor: pointer;
                color: white;
                font-size: 13px;
                border-radius: 3px;
            `;
            item.onmouseenter = () => {
                item.style.background = 'rgba(255, 255, 255, 0.1)';
            };
            item.onmouseleave = () => {
                item.style.background = 'transparent';
            };
            item.onclick = () => {
                this.setViewDirection(direction);
                menu.style.display = 'none';
            };
            menu.appendChild(item);
        });
        
        btn.onclick = () => {
            menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
        };
        
        // Close menu when clicking outside
        document.addEventListener('click', (e) => {
            if (!container.contains(e.target as Node)) {
                menu.style.display = 'none';
            }
        });
        
        container.appendChild(btn);
        container.appendChild(menu);
        
        return container;
    }
    
    /**
     * Frames the selected objects
     */
    private frameSelected(): void {
        if (!this.cameraController) return;
        
        const selected = this.context.getSelection();
        if (selected.length > 0) {
            this.cameraController.frameSelected(selected);
        }
    }
    
    /**
     * Sets the view direction
     */
    private setViewDirection(direction: ViewDirection): void {
        if (!this.cameraController) return;
        this.cameraController.setViewDirection(direction);
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
        
        // Keyboard events
        window.addEventListener('keydown', this.onKeyDown.bind(this));
        window.addEventListener('keyup', this.onKeyUp.bind(this));
        
        // Resize observer
        const resizeObserver = new ResizeObserver(() => {
            this.handleResize();
        });
        resizeObserver.observe(this.canvas);
    }
    
    /**
     * Handles keyboard down event
     */
    private onKeyDown(event: KeyboardEvent): void {
        // Only handle keys when this panel is focused
        if (!this.isFocused()) return;
        
        this.keysPressed.add(event.key.toLowerCase());
        
        // View shortcuts (numpad or number keys)
        const viewShortcuts: Record<string, ViewDirection> = {
            '1': ViewDirection.FRONT,
            '2': ViewDirection.BACK,
            '3': ViewDirection.LEFT,
            '4': ViewDirection.RIGHT,
            '5': ViewDirection.PERSPECTIVE,
            '7': ViewDirection.TOP,
            '8': ViewDirection.BOTTOM
        };
        
        if (viewShortcuts[event.key]) {
            this.setViewDirection(viewShortcuts[event.key]);
            event.preventDefault();
        }
        
        // Frame selected with 'F' key
        if (event.key.toLowerCase() === 'f') {
            this.frameSelected();
            event.preventDefault();
        }
    }
    
    /**
     * Handles keyboard up event
     */
    private onKeyUp(event: KeyboardEvent): void {
        this.keysPressed.delete(event.key.toLowerCase());
    }
    
    /**
     * Handles mouse down event
     */
    private onMouseDown(event: MouseEvent): void {
        if (!this.canvas) return;
        
        // Get mouse position relative to canvas
        const rect = this.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        
        // Check if gizmo handles the event
        if (this.gizmoManager && this.gizmoManager.onMouseDown(x, y)) {
            return; // Gizmo handled it
        }
        
        // Otherwise, handle camera controls
        this.isMouseDown = true;
        this.lastMouseX = event.clientX;
        this.lastMouseY = event.clientY;
        this.mouseButton = event.button;
    }
    
    /**
     * Handles mouse move event
     */
    private onMouseMove(event: MouseEvent): void {
        if (!this.canvas) return;
        
        // Get mouse position relative to canvas
        const rect = this.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        
        // Check if gizmo handles the event
        if (this.gizmoManager && this.gizmoManager.onMouseMove(x, y)) {
            return; // Gizmo handled it
        }
        
        // Handle camera controls
        if (!this.isMouseDown) return;
        
        const deltaX = event.clientX - this.lastMouseX;
        const deltaY = event.clientY - this.lastMouseY;
        
        // Use camera controller if available
        if (this.cameraController) {
            // Left mouse button - rotate/orbit
            if (this.mouseButton === 0) {
                if (this.cameraMode === CameraMode.ORBIT || this.cameraMode === CameraMode.FLY) {
                    this.cameraController.orbit(deltaX, deltaY);
                }
            }
            
            // Middle mouse button or right mouse button - pan
            if (this.mouseButton === 1 || this.mouseButton === 2) {
                this.cameraController.pan(deltaX, deltaY);
            }
        } else {
            // Legacy camera controls (fallback)
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
            
            this.updateCamera();
        }
        
        this.lastMouseX = event.clientX;
        this.lastMouseY = event.clientY;
    }
    
    /**
     * Handles mouse up event
     */
    private onMouseUp(_event: MouseEvent): void {
        // Check if gizmo handles the event
        if (this.gizmoManager && this.gizmoManager.onMouseUp()) {
            return; // Gizmo handled it
        }
        
        // Handle camera controls
        this.isMouseDown = false;
        this.mouseButton = -1;
    }
    
    /**
     * Handles mouse wheel event
     */
    private onMouseWheel(event: WheelEvent): void {
        event.preventDefault();
        
        if (this.cameraController) {
            // Use camera controller for zooming
            const delta = -event.deltaY * 0.001;
            this.cameraController.zoom(delta);
        } else {
            // Legacy zoom (fallback)
            const zoomSpeed = 0.1;
            this.cameraDistance *= (1 + event.deltaY * zoomSpeed * 0.01);
            this.cameraDistance = Math.max(1, Math.min(100, this.cameraDistance));
            this.updateCamera();
        }
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
        
        const transform = this.camera.getTransform();
        transform.position.set(x, y, z);
        this.camera.lookAt(this.cameraTarget);
    }
    
    /**
     * Handles canvas resize
     */
    private handleResize(): void {
        if (!this.canvas || !this.camera) return;
        
        const rect = this.canvas.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
        
        // Update camera aspect ratio through setter method
        this.camera.setAspect(rect.width / rect.height);
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
        
        // Create camera controller
        this.cameraController = new CameraController(camera);
        
        if (this.canvas) {
            this.handleResize();
        }
        
        // Update gizmo manager camera
        if (this.gizmoManager) {
            this.gizmoManager.setCamera(camera);
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
        
        // Update camera controller animation
        if (this.cameraController) {
            this.cameraController.update(0.016); // Assuming 60fps
        }
        
        // Handle WASD/arrow key fly mode
        if (this.cameraMode === CameraMode.FLY && this.cameraController) {
            let forward = 0;
            let right = 0;
            let up = 0;
            
            if (this.keysPressed.has('w') || this.keysPressed.has('arrowup')) forward = 1;
            if (this.keysPressed.has('s') || this.keysPressed.has('arrowdown')) forward = -1;
            if (this.keysPressed.has('a') || this.keysPressed.has('arrowleft')) right = -1;
            if (this.keysPressed.has('d') || this.keysPressed.has('arrowright')) right = 1;
            if (this.keysPressed.has('e')) up = 1;
            if (this.keysPressed.has('q')) up = -1;
            
            if (forward !== 0 || right !== 0 || up !== 0) {
                this.cameraController.fly(forward, right, up);
            }
        }
        
        // Render the scene
        this.renderer.render(this.scene, this.camera);
        
        // Render grid if enabled
        if (this.showGrid) {
            this.renderGrid();
        }
        
        // Render gizmos on top
        if (this.gizmoManager) {
            this.gizmoManager.render();
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
        this.showGrid = settings.visible;
    }
    
    /**
     * Called when panel is mounted
     */
    protected onMount(_container: HTMLElement): void {
        // Panel is already mounted through base class
        if (this.canvas) {
            this.handleResize();
        }
    }
    
    /**
     * Called when panel is unmounted
     */
    protected onUnmount(): void {
        // Cleanup event listeners
        this.context.off('viewportSettingsChanged', this.onViewportSettingsChanged.bind(this));
        this.context.off('gridSettingsChanged', this.onGridSettingsChanged.bind(this));
    }
}
