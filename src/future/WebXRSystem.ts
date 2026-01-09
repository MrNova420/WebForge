/**
 * WebXR System - Virtual Reality and Augmented Reality support
 * Provides immersive VR and AR experiences through WebXR API
 */

/// <reference path="./types.d.ts" />

import { Vector3 } from '../math/Vector3';
import { Quaternion } from '../math/Quaternion';
import { Matrix4 } from '../math/Matrix4';

export interface XRSessionConfig {
    mode: 'immersive-vr' | 'immersive-ar' | 'inline';
    requiredFeatures?: string[];
    optionalFeatures?: string[];
}

export interface XRPose {
    position: Vector3;
    orientation: Quaternion;
    linearVelocity?: Vector3;
    angularVelocity?: Vector3;
}

export interface XRController {
    hand: 'left' | 'right';
    pose: XRPose;
    buttons: boolean[];
    axes: number[];
    hapticActuator?: any;
}

export interface XRFrame {
    time: number;
    viewerPose: XRPose;
    controllers: XRController[];
    views: XRView[];
}

export interface XRView {
    eye: 'left' | 'right' | 'center';
    projectionMatrix: Matrix4;
    viewMatrix: Matrix4;
    viewport: { x: number; y: number; width: number; height: number };
}

/**
 * WebXR System for VR and AR
 */
export class WebXRSystem {
    private xrSession: any | null = null;
    private xrReferenceSpace: any | null = null;
    private gl: WebGLRenderingContext | WebGL2RenderingContext | null = null;
    private xrFrameCallback: ((frame: XRFrame) => void) | null = null;
    
    private isVRSupported: boolean = false;
    private isARSupported: boolean = false;
    private sessionMode: 'immersive-vr' | 'immersive-ar' | 'inline' | null = null;
    
    private controllers: Map<any, XRController> = new Map();
    private hapticFeedbackEnabled: boolean = true;
    
    /**
     * Initialize WebXR system
     */
    async initialize(canvas: HTMLCanvasElement): Promise<void> {
        if (!('xr' in navigator)) {
            console.warn('WebXR is not supported in this browser');
            return;
        }
        
        // Check VR support
        this.isVRSupported = await navigator.xr!.isSessionSupported('immersive-vr');
        console.log(`VR supported: ${this.isVRSupported}`);
        
        // Check AR support
        this.isARSupported = await navigator.xr!.isSessionSupported('immersive-ar');
        console.log(`AR supported: ${this.isARSupported}`);
        
        // Get WebGL context
        this.gl = canvas.getContext('webgl2', { xrCompatible: true }) as WebGL2RenderingContext | null;
        if (!this.gl) {
            this.gl = canvas.getContext('webgl', { xrCompatible: true }) as WebGLRenderingContext | null;
        }
        
        if (!this.gl) {
            throw new Error('Failed to get WebGL context for XR');
        }
    }
    
    /**
     * Check if VR is supported
     */
    isVRAvailable(): boolean {
        return this.isVRSupported;
    }
    
    /**
     * Check if AR is supported
     */
    isARAvailable(): boolean {
        return this.isARSupported;
    }
    
    /**
     * Start XR session
     */
    async startSession(config: XRSessionConfig): Promise<void> {
        if (!navigator.xr) {
            throw new Error('WebXR not available');
        }
        
        if (!this.gl) {
            throw new Error('WebGL context not initialized');
        }
        
        this.sessionMode = config.mode;
        
        // Request session
        this.xrSession = await navigator.xr.requestSession(config.mode, {
            requiredFeatures: config.requiredFeatures || ['local-floor'],
            optionalFeatures: config.optionalFeatures || ['hand-tracking', 'bounded-floor', 'hit-test']
        });
        
        // Set up XR layer
        const xrLayer: any = new (window as any).XRWebGLLayer(this.xrSession, this.gl);
        await this.xrSession.updateRenderState({ baseLayer: xrLayer });
        
        // Get reference space
        this.xrReferenceSpace = await this.xrSession.requestReferenceSpace('local-floor');
        
        // Set up input sources
        this.xrSession.addEventListener('inputsourceschange', (event: any) => {
            this.handleInputSourcesChange(event);
        });
        
        // Set up session end
        this.xrSession.addEventListener('end', () => {
            this.xrSession = null;
            this.xrReferenceSpace = null;
            console.log('XR session ended');
        });
        
        // Start render loop
        this.xrSession.requestAnimationFrame((time: number, frame: any) => this.onXRFrame(time, frame));
        
        console.log(`XR session started: ${config.mode}`);
    }
    
    /**
     * End XR session
     */
    async endSession(): Promise<void> {
        if (this.xrSession) {
            await this.xrSession.end();
        }
    }
    
    /**
     * Set frame callback
     */
    setFrameCallback(callback: (frame: XRFrame) => void): void {
        this.xrFrameCallback = callback;
    }
    
    /**
     * XR frame handler
     */
    private onXRFrame(time: number, frame: any): void {
        if (!this.xrSession || !this.xrReferenceSpace) return;
        
        // Request next frame
        this.xrSession.requestAnimationFrame((t: number, f: any) => this.onXRFrame(t, f));
        
        // Get viewer pose
        const pose = frame.getViewerPose ? frame.getViewerPose(this.xrReferenceSpace) : frame.viewerPose;
        if (!pose) return;
        
        // Update controllers
        this.updateControllers(frame);
        
        // Build frame data
        const xrFrameData: XRFrame = {
            time,
            viewerPose: this.poseToXRPose(pose.transform),
            controllers: Array.from(this.controllers.values()),
            views: pose.views ? pose.views.map((view: any) => this.convertXRView(view)) : []
        };
        
        // Call frame callback
        if (this.xrFrameCallback) {
            this.xrFrameCallback(xrFrameData);
        }
    }
    
    /**
     * Convert XRPose to our format
     */
    private poseToXRPose(transform: any): XRPose {
        return {
            position: new Vector3(
                transform.position.x,
                transform.position.y,
                transform.position.z
            ),
            orientation: new Quaternion(
                transform.orientation.x,
                transform.orientation.y,
                transform.orientation.z,
                transform.orientation.w
            )
        };
    }
    
    /**
     * Convert XR view to our format
     */
    private convertXRView(view: any): XRView {
        const projMatrix = Matrix4.fromArray(view.projectionMatrix);
        const viewMatrix = Matrix4.fromArray(view.transform.inverse.matrix);
        
        return {
            eye: view.eye || 'center',
            projectionMatrix: projMatrix,
            viewMatrix: viewMatrix,
            viewport: {
                x: view.viewport.x,
                y: view.viewport.y,
                width: view.viewport.width,
                height: view.viewport.height
            }
        };
    }
    
    /**
     * Update controller states
     */
    private updateControllers(frame: any): void {
        if (!this.xrSession || !this.xrReferenceSpace) return;
        
        const inputSources = this.xrSession.inputSources;
        
        for (const inputSource of inputSources) {
            const pose = frame.getPose ? frame.getPose(inputSource.gripSpace!, this.xrReferenceSpace) : null;
            if (!pose) continue;
            
            const controller: XRController = {
                hand: inputSource.handedness as 'left' | 'right',
                pose: this.poseToXRPose(pose.transform),
                buttons: inputSource.gamepad ? Array.from(inputSource.gamepad.buttons).map((b: any) => b.pressed) : [],
                axes: inputSource.gamepad ? Array.from(inputSource.gamepad.axes) : [],
                hapticActuator: inputSource.gamepad?.hapticActuators?.[0]
            };
            
            this.controllers.set(inputSource, controller);
        }
    }
    
    /**
     * Handle input source changes
     */
    private handleInputSourcesChange(event: any): void {
        // Remove disconnected controllers
        for (const removed of event.removed) {
            this.controllers.delete(removed);
        }
        
        console.log(`Controllers: ${this.controllers.size}`);
    }
    
    /**
     * Trigger haptic feedback on controller
     */
    async triggerHaptic(hand: 'left' | 'right', intensity: number, duration: number): Promise<void> {
        if (!this.hapticFeedbackEnabled) return;
        
        for (const controller of this.controllers.values()) {
            if (controller.hand === hand && controller.hapticActuator) {
                try {
                    await controller.hapticActuator.pulse(intensity, duration);
                } catch (e) {
                    console.warn('Haptic feedback failed:', e);
                }
            }
        }
    }
    
    /**
     * Get controller by hand
     */
    getController(hand: 'left' | 'right'): XRController | null {
        for (const controller of this.controllers.values()) {
            if (controller.hand === hand) {
                return controller;
            }
        }
        return null;
    }
    
    /**
     * Check if in XR session
     */
    isInSession(): boolean {
        return this.xrSession !== null;
    }
    
    /**
     * Get current session mode
     */
    getSessionMode(): string | null {
        return this.sessionMode;
    }
    
    /**
     * Enable/disable haptic feedback
     */
    setHapticFeedbackEnabled(enabled: boolean): void {
        this.hapticFeedbackEnabled = enabled;
    }
    
    /**
     * Clean up
     */
    destroy(): void {
        if (this.xrSession) {
            this.xrSession.end();
        }
        
        this.controllers.clear();
        this.xrFrameCallback = null;
        this.gl = null;
    }
}
