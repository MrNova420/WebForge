/**
 * WebForge Camera Controller
 * 
 * Maya-style camera controls for the 3D viewport.
 * Provides orbit, fly, pan modes with smooth transitions and advanced navigation.
 */

import { Camera } from '../../rendering/Camera';
import { Vector3 } from '../../math/Vector3';
import { GameObject } from '../../scene/GameObject';

/**
 * Camera control mode
 */
export enum CameraControlMode {
    ORBIT = 'orbit',
    FLY = 'fly',
    PAN = 'pan',
    FIRST_PERSON = 'first_person'
}

/**
 * Predefined view directions
 */
export enum ViewDirection {
    FRONT = 'front',
    BACK = 'back',
    TOP = 'top',
    BOTTOM = 'bottom',
    LEFT = 'left',
    RIGHT = 'right',
    PERSPECTIVE = 'perspective'
}

/**
 * Camera bookmark for saving/restoring views
 */
export interface CameraBookmark {
    name: string;
    position: Vector3;
    target: Vector3;
    distance: number;
    yaw: number;
    pitch: number;
}

/**
 * Camera controller settings
 */
export interface CameraControllerSettings {
    orbitSpeed: number;
    panSpeed: number;
    zoomSpeed: number;
    flySpeed: number;
    smoothing: number;
    invertY: boolean;
    enableDamping: boolean;
}

/**
 * Camera controller for advanced navigation
 */
export class CameraController {
    private camera: Camera;
    private mode: CameraControlMode = CameraControlMode.ORBIT;
    
    // Transform state
    private position: Vector3 = new Vector3(0, 5, 10);
    private target: Vector3 = new Vector3(0, 0, 0);
    private distance: number = 10;
    private yaw: number = 0;
    private pitch: number = 30;
    
    // Settings
    private settings: CameraControllerSettings = {
        orbitSpeed: 0.5,
        panSpeed: 0.01,
        zoomSpeed: 0.1,
        flySpeed: 0.05,
        smoothing: 0.15,
        invertY: false,
        enableDamping: true
    };
    
    // Camera bookmarks
    private bookmarks: Map<string, CameraBookmark> = new Map();
    
    // Animation state for transitions
    private isAnimating: boolean = false;
    private animationStartTime: number = 0;
    private animationDuration: number = 500; // ms
    private animationStartPosition: Vector3 = new Vector3();
    private animationStartTarget: Vector3 = new Vector3();
    private animationTargetPosition: Vector3 = new Vector3();
    private animationTargetTarget: Vector3 = new Vector3();
    
    /**
     * Creates a new camera controller
     * @param camera - Camera to control
     */
    constructor(camera: Camera) {
        this.camera = camera;
        this.updateCamera();
    }
    
    /**
     * Gets the camera
     */
    public getCamera(): Camera {
        return this.camera;
    }
    
    /**
     * Sets the camera control mode
     */
    public setMode(mode: CameraControlMode): void {
        this.mode = mode;
    }
    
    /**
     * Gets the current mode
     */
    public getMode(): CameraControlMode {
        return this.mode;
    }
    
    /**
     * Gets controller settings
     */
    public getSettings(): CameraControllerSettings {
        return { ...this.settings };
    }
    
    /**
     * Updates controller settings
     */
    public updateSettings(settings: Partial<CameraControllerSettings>): void {
        Object.assign(this.settings, settings);
    }
    
    /**
     * Orbits the camera around the target
     */
    public orbit(deltaX: number, deltaY: number): void {
        const speed = this.settings.orbitSpeed;
        const invertY = this.settings.invertY ? -1 : 1;
        
        this.yaw -= deltaX * speed;
        this.pitch += deltaY * speed * invertY;
        this.pitch = Math.max(-89, Math.min(89, this.pitch));
        
        this.updateCamera();
    }
    
    /**
     * Pans the camera in screen space
     */
    public pan(deltaX: number, deltaY: number): void {
        const speed = this.settings.panSpeed * this.distance;
        
        // Calculate right and up vectors
        const yawRad = this.yaw * Math.PI / 180;
        const right = new Vector3(Math.cos(yawRad), 0, -Math.sin(yawRad));
        const up = new Vector3(0, 1, 0);
        
        // Pan in screen space
        this.target.x -= right.x * deltaX * speed;
        this.target.z -= right.z * deltaX * speed;
        this.target.y += up.y * deltaY * speed;
        
        this.updateCamera();
    }
    
    /**
     * Zooms the camera in/out
     */
    public zoom(delta: number): void {
        const speed = this.settings.zoomSpeed;
        this.distance *= (1 + delta * speed);
        this.distance = Math.max(0.1, Math.min(1000, this.distance));
        
        this.updateCamera();
    }
    
    /**
     * Flies the camera in the view direction
     */
    public fly(forward: number, right: number, up: number): void {
        const speed = this.settings.flySpeed * this.distance;
        
        // Calculate direction vectors
        const yawRad = this.yaw * Math.PI / 180;
        const pitchRad = this.pitch * Math.PI / 180;
        
        const forwardDir = new Vector3(
            Math.sin(yawRad) * Math.cos(pitchRad),
            Math.sin(pitchRad),
            Math.cos(yawRad) * Math.cos(pitchRad)
        );
        
        const rightDir = new Vector3(
            Math.cos(yawRad),
            0,
            -Math.sin(yawRad)
        );
        
        const upDir = new Vector3(0, 1, 0);
        
        // Move camera
        this.position.x += forwardDir.x * forward * speed;
        this.position.y += forwardDir.y * forward * speed;
        this.position.z += forwardDir.z * forward * speed;
        
        this.position.x += rightDir.x * right * speed;
        this.position.z += rightDir.z * right * speed;
        
        this.position.y += upDir.y * up * speed;
        
        // Update target to follow
        this.target.x = this.position.x - forwardDir.x * this.distance;
        this.target.y = this.position.y - forwardDir.y * this.distance;
        this.target.z = this.position.z - forwardDir.z * this.distance;
        
        this.updateCameraDirectly();
    }
    
    /**
     * Frames the selected objects in view
     */
    public frameSelected(objects: GameObject[]): void {
        if (objects.length === 0) return;
        
        // Calculate bounding box of all objects
        let minBounds = new Vector3(Infinity, Infinity, Infinity);
        let maxBounds = new Vector3(-Infinity, -Infinity, -Infinity);
        
        objects.forEach(obj => {
            const pos = obj.transform.position;
            minBounds.x = Math.min(minBounds.x, pos.x);
            minBounds.y = Math.min(minBounds.y, pos.y);
            minBounds.z = Math.min(minBounds.z, pos.z);
            maxBounds.x = Math.max(maxBounds.x, pos.x);
            maxBounds.y = Math.max(maxBounds.y, pos.y);
            maxBounds.z = Math.max(maxBounds.z, pos.z);
        });
        
        // Calculate center and size
        const center = new Vector3(
            (minBounds.x + maxBounds.x) / 2,
            (minBounds.y + maxBounds.y) / 2,
            (minBounds.z + maxBounds.z) / 2
        );
        
        const size = new Vector3(
            maxBounds.x - minBounds.x,
            maxBounds.y - minBounds.y,
            maxBounds.z - minBounds.z
        );
        
        const maxSize = Math.max(size.x, size.y, size.z);
        const targetDistance = maxSize * 2;
        
        // Animate to new view
        this.animateToView(center, targetDistance);
    }
    
    /**
     * Sets view to a predefined direction
     */
    public setViewDirection(direction: ViewDirection): void {
        let targetYaw = 0;
        let targetPitch = 0;
        
        switch (direction) {
            case ViewDirection.FRONT:
                targetYaw = 0;
                targetPitch = 0;
                break;
            case ViewDirection.BACK:
                targetYaw = 180;
                targetPitch = 0;
                break;
            case ViewDirection.TOP:
                targetYaw = 0;
                targetPitch = 90;
                break;
            case ViewDirection.BOTTOM:
                targetYaw = 0;
                targetPitch = -90;
                break;
            case ViewDirection.LEFT:
                targetYaw = -90;
                targetPitch = 0;
                break;
            case ViewDirection.RIGHT:
                targetYaw = 90;
                targetPitch = 0;
                break;
            case ViewDirection.PERSPECTIVE:
                targetYaw = 45;
                targetPitch = 30;
                break;
        }
        
        this.animateToAngles(targetYaw, targetPitch);
    }
    
    /**
     * Saves current view as a bookmark
     */
    public saveBookmark(name: string): void {
        this.bookmarks.set(name, {
            name,
            position: this.position.clone(),
            target: this.target.clone(),
            distance: this.distance,
            yaw: this.yaw,
            pitch: this.pitch
        });
    }
    
    /**
     * Restores a saved bookmark
     */
    public restoreBookmark(name: string): void {
        const bookmark = this.bookmarks.get(name);
        if (!bookmark) return;
        
        this.animateToView(bookmark.target, bookmark.distance, bookmark.yaw, bookmark.pitch);
    }
    
    /**
     * Gets all bookmarks
     */
    public getBookmarks(): CameraBookmark[] {
        return Array.from(this.bookmarks.values());
    }
    
    /**
     * Deletes a bookmark
     */
    public deleteBookmark(name: string): void {
        this.bookmarks.delete(name);
    }
    
    /**
     * Animates to a new view
     */
    private animateToView(
        target: Vector3,
        distance?: number,
        yaw?: number,
        pitch?: number
    ): void {
        this.isAnimating = true;
        this.animationStartTime = Date.now();
        this.animationStartPosition.copy(this.position);
        this.animationStartTarget.copy(this.target);
        
        this.animationTargetTarget.copy(target);
        
        if (distance !== undefined) {
            this.distance = distance;
        }
        if (yaw !== undefined) {
            this.yaw = yaw;
        }
        if (pitch !== undefined) {
            this.pitch = pitch;
        }
        
        // Calculate target position based on angles
        const yawRad = this.yaw * Math.PI / 180;
        const pitchRad = this.pitch * Math.PI / 180;
        
        this.animationTargetPosition.set(
            target.x + this.distance * Math.cos(pitchRad) * Math.sin(yawRad),
            target.y + this.distance * Math.sin(pitchRad),
            target.z + this.distance * Math.cos(pitchRad) * Math.cos(yawRad)
        );
    }
    
    /**
     * Animates to new angles
     */
    private animateToAngles(yaw: number, pitch: number): void {
        this.animateToView(this.target, this.distance, yaw, pitch);
    }
    
    /**
     * Updates the camera transform
     */
    private updateCamera(): void {
        // Convert spherical to Cartesian
        const yawRad = this.yaw * Math.PI / 180;
        const pitchRad = this.pitch * Math.PI / 180;
        
        this.position.set(
            this.target.x + this.distance * Math.cos(pitchRad) * Math.sin(yawRad),
            this.target.y + this.distance * Math.sin(pitchRad),
            this.target.z + this.distance * Math.cos(pitchRad) * Math.cos(yawRad)
        );
        
        this.updateCameraDirectly();
    }
    
    /**
     * Updates camera directly from position
     */
    private updateCameraDirectly(): void {
        const transform = this.camera.getTransform();
        transform.position.copy(this.position);
        this.camera.lookAt(this.target);
    }
    
    /**
     * Updates animation and camera (call in render loop)
     */
    public update(_deltaTime: number): void {
        if (this.isAnimating) {
            const elapsed = Date.now() - this.animationStartTime;
            const t = Math.min(elapsed / this.animationDuration, 1);
            
            // Ease out cubic
            const eased = 1 - Math.pow(1 - t, 3);
            
            // Interpolate position and target
            this.position.x = this.animationStartPosition.x + (this.animationTargetPosition.x - this.animationStartPosition.x) * eased;
            this.position.y = this.animationStartPosition.y + (this.animationTargetPosition.y - this.animationStartPosition.y) * eased;
            this.position.z = this.animationStartPosition.z + (this.animationTargetPosition.z - this.animationStartPosition.z) * eased;
            
            this.target.x = this.animationStartTarget.x + (this.animationTargetTarget.x - this.animationStartTarget.x) * eased;
            this.target.y = this.animationStartTarget.y + (this.animationTargetTarget.y - this.animationStartTarget.y) * eased;
            this.target.z = this.animationStartTarget.z + (this.animationTargetTarget.z - this.animationStartTarget.z) * eased;
            
            this.updateCameraDirectly();
            
            if (t >= 1) {
                this.isAnimating = false;
            }
        }
    }
    
    /**
     * Gets the current target
     */
    public getTarget(): Vector3 {
        return this.target.clone();
    }
    
    /**
     * Gets the current distance
     */
    public getDistance(): number {
        return this.distance;
    }
    
    /**
     * Gets the current yaw
     */
    public getYaw(): number {
        return this.yaw;
    }
    
    /**
     * Gets the current pitch
     */
    public getPitch(): number {
        return this.pitch;
    }
}
