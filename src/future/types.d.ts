/**
 * Type declarations for Phase 17-18 Future Tech APIs
 * WebGPU, WebXR, and related browser APIs
 */

// WebGPU type stubs (simplified - real types would be much more extensive)
declare global {
    interface Navigator {
        gpu?: {
            requestAdapter(options?: any): Promise<GPUAdapter>;
            getPreferredCanvasFormat(): GPUTextureFormat;
        };
        xr?: {
            isSessionSupported(mode: string): Promise<boolean>;
            requestSession(mode: string, options?: any): Promise<XRSession>;
        };
    }
    
    interface HTMLCanvasElement {
        getContext(contextId: 'webgpu'): GPUCanvasContext | null;
    }
}

// WebGPU types
type GPUTextureFormat = string;
type GPUPowerPreference = 'low-power' | 'high-performance';

interface GPUAdapter {
    requestDevice(descriptor?: any): Promise<GPUDevice>;
    info?: any;
}

interface GPUDevice {
    createShaderModule(descriptor: any): GPUShaderModule;
    createComputePipeline(descriptor: any): GPUComputePipeline;
    createRenderPipeline(descriptor: any): GPURenderPipeline;
    createBuffer(descriptor: any): GPUBuffer;
    createTexture(descriptor: any): GPUTexture;
    createCommandEncoder(): GPUCommandEncoder;
    queue: GPUQueue;
    limits: any;
    destroy(): void;
}

interface GPUShaderModule {}

interface GPUComputePipeline {}

interface GPURenderPipeline {}

interface GPUBuffer {
    getMappedRange(): ArrayBuffer;
    unmap(): void;
    destroy(): void;
}

interface GPUTexture {
    createView(): GPUTextureView;
    destroy(): void;
}

interface GPUTextureView {}

interface GPUQueue {
    submit(commandBuffers: GPUCommandBuffer[]): void;
}

interface GPUCommandEncoder {
    beginComputePass(): GPUComputePassEncoder;
    beginRenderPass(descriptor: any): GPURenderPassEncoder;
    finish(): GPUCommandBuffer;
}

interface GPUCommandBuffer {}

interface GPUComputePassEncoder {
    setPipeline(pipeline: GPUComputePipeline): void;
    dispatchWorkgroups(x: number, y: number, z: number): void;
    end(): void;
}

interface GPURenderPassEncoder {
    setPipeline(pipeline: GPURenderPipeline): void;
    draw(vertexCount: number, instanceCount?: number): void;
    end(): void;
}

interface GPUCanvasContext {
    configure(configuration: any): void;
    getCurrentTexture(): GPUTexture;
}

interface GPUBindGroup {}

// WebXR types
interface XRSession {
    updateRenderState(state: any): Promise<void>;
    requestReferenceSpace(type: string): Promise<XRReferenceSpace>;
    requestAnimationFrame(callback: (time: number, frame: any) => void): number;
    end(): Promise<void>;
    addEventListener(type: string, listener: any): void;
    inputSources: XRInputSource[];
}

interface XRReferenceSpace {}

interface XRInputSource {
    handedness: string;
    gripSpace: XRSpace | null;
    gamepad?: {
        buttons: GamepadButton[];
        axes: number[];
        hapticActuators?: any[];
    };
}

interface XRSpace {}

interface XRRigidTransform {
    position: { x: number; y: number; z: number };
    orientation: { x: number; y: number; z: number; w: number };
    inverse: { matrix: Float32Array };
}

interface XRWebGLLayer {
    framebuffer: WebGLFramebuffer | null;
}

declare var XRWebGLLayer: {
    prototype: XRWebGLLayer;
    new(session: XRSession, gl: WebGLRenderingContext | WebGL2RenderingContext): XRWebGLLayer;
};

interface XRInputSourceChangeEvent extends Event {
    added: XRInputSource[];
    removed: XRInputSource[];
}

export {};
