/**
 * WebGPU Renderer - Next-generation GPU API for high-performance rendering
 * Provides compute shaders, bindless resources, and modern GPU features
 */

/// <reference path="./types.d.ts" />

export interface WebGPUConfig {
    powerPreference?: 'low-power' | 'high-performance';
    limits?: {
        maxTextureDimension2D?: number;
        maxBufferSize?: number;
        maxBindGroups?: number;
    };
}

export interface ComputeShaderConfig {
    code: string;
    entryPoint: string;
    workgroupSize: [number, number, number];
}

export interface RenderPipelineConfig {
    vertexShader: string;
    fragmentShader: string;
    vertexBuffers: VertexBufferLayout[];
    targets: ColorTargetState[];
    depthStencil?: DepthStencilState;
    primitive?: PrimitiveState;
}

export interface VertexBufferLayout {
    arrayStride: number;
    stepMode: 'vertex' | 'instance';
    attributes: WebGPUVertexAttribute[];
}

export interface WebGPUVertexAttribute {
    format: string;
    offset: number;
    shaderLocation: number;
}

export interface ColorTargetState {
    format: string;
    blend?: BlendState;
    writeMask?: number;
}

export interface BlendState {
    color: BlendComponent;
    alpha: BlendComponent;
}

export interface BlendComponent {
    srcFactor: string;
    dstFactor: string;
    operation: string;
}

export interface DepthStencilState {
    format: string;
    depthWriteEnabled: boolean;
    depthCompare: string;
}

export interface PrimitiveState {
    topology: string;
    cullMode?: string;
    frontFace?: string;
}

/**
 * WebGPU Renderer System
 * Modern GPU API with compute shader support
 */
export class WebGPURenderer {
    private adapter: any | null = null;
    private device: any | null = null;
    private context: any | null = null;
    private swapChainFormat: any = 'bgra8unorm';
    
    private renderPipelines: Map<string, any> = new Map();
    private computePipelines: Map<string, any> = new Map();
    private buffers: Map<string, any> = new Map();
    private textures: Map<string, any> = new Map();
    private bindGroups: Map<string, any> = new Map();
    
    private commandEncoder: any | null = null;
    private currentPassEncoder: any | null = null;
    
    /**
     * Check if WebGPU is supported
     */
    static isSupported(): boolean {
        return 'gpu' in navigator;
    }
    
    /**
     * Initialize WebGPU renderer
     */
    async initialize(canvas: HTMLCanvasElement, config: WebGPUConfig = {}): Promise<void> {
        if (!WebGPURenderer.isSupported()) {
            throw new Error('WebGPU is not supported in this browser');
        }
        
        // Request adapter
        this.adapter = await navigator.gpu!.requestAdapter({
            powerPreference: config.powerPreference || 'high-performance'
        });
        
        if (!this.adapter) {
            throw new Error('Failed to get WebGPU adapter');
        }
        
        // Request device
        this.device = await this.adapter.requestDevice({
            requiredLimits: config.limits
        });
        
        // Configure canvas context
        this.context = canvas.getContext('webgpu') as any;
        if (!this.context) {
            throw new Error('Failed to get WebGPU context');
        }
        
        this.swapChainFormat = navigator.gpu!.getPreferredCanvasFormat();
        
        this.context.configure({
            device: this.device,
            format: this.swapChainFormat,
            alphaMode: 'premultiplied'
        });
        
        console.log('WebGPU initialized successfully');
    }
    
    /**
     * Create a compute pipeline for GPU compute operations
     */
    createComputePipeline(name: string, config: ComputeShaderConfig): void {
        if (!this.device) throw new Error('Device not initialized');
        
        const shaderModule = this.device.createShaderModule({
            code: config.code
        });
        
        const pipeline = this.device.createComputePipeline({
            layout: 'auto',
            compute: {
                module: shaderModule,
                entryPoint: config.entryPoint
            }
        });
        
        this.computePipelines.set(name, pipeline);
    }
    
    /**
     * Create a render pipeline for drawing
     */
    createRenderPipeline(name: string, config: RenderPipelineConfig): void {
        if (!this.device) throw new Error('Device not initialized');
        
        const vertexModule = this.device.createShaderModule({ code: config.vertexShader });
        const fragmentModule = this.device.createShaderModule({ code: config.fragmentShader });
        
        const pipeline = this.device.createRenderPipeline({
            layout: 'auto',
            vertex: {
                module: vertexModule,
                entryPoint: 'main',
                buffers: config.vertexBuffers as any
            },
            fragment: {
                module: fragmentModule,
                entryPoint: 'main',
                targets: config.targets as any
            },
            primitive: config.primitive as any,
            depthStencil: config.depthStencil as any
        });
        
        this.renderPipelines.set(name, pipeline);
    }
    
    /**
     * Create a GPU buffer
     */
    createBuffer(name: string, size: number, usage: number, data?: ArrayBuffer): any {
        if (!this.device) throw new Error('Device not initialized');
        
        const buffer = this.device.createBuffer({
            size,
            usage,
            mappedAtCreation: !!data
        });
        
        if (data) {
            new Uint8Array(buffer.getMappedRange()).set(new Uint8Array(data));
            buffer.unmap();
        }
        
        this.buffers.set(name, buffer);
        return buffer;
    }
    
    /**
     * Create a GPU texture
     */
    createTexture(name: string, width: number, height: number, format: string, usage: number): any {
        if (!this.device) throw new Error('Device not initialized');
        
        const texture = this.device.createTexture({
            size: [width, height],
            format: format as any,
            usage
        });
        
        this.textures.set(name, texture);
        return texture;
    }
    
    /**
     * Dispatch compute shader
     */
    dispatchCompute(pipelineName: string, workgroupsX: number, workgroupsY: number, workgroupsZ: number): void {
        if (!this.device) throw new Error('Device not initialized');
        
        const pipeline = this.computePipelines.get(pipelineName);
        if (!pipeline) throw new Error(`Compute pipeline '${pipelineName}' not found`);
        
        if (!this.commandEncoder) {
            this.commandEncoder = this.device.createCommandEncoder();
        }
        
        const passEncoder = this.commandEncoder.beginComputePass();
        passEncoder.setPipeline(pipeline);
        
        // Set bind groups (would need to be configured externally)
        passEncoder.dispatchWorkgroups(workgroupsX, workgroupsY, workgroupsZ);
        passEncoder.end();
    }
    
    /**
     * Begin render pass
     */
    beginRenderPass(clearColor?: { r: number; g: number; b: number; a: number }): void {
        if (!this.device || !this.context) throw new Error('Device not initialized');
        
        if (!this.commandEncoder) {
            this.commandEncoder = this.device.createCommandEncoder();
        }
        
        const textureView = this.context.getCurrentTexture().createView();
        
        this.currentPassEncoder = this.commandEncoder.beginRenderPass({
            colorAttachments: [{
                view: textureView,
                clearValue: clearColor || { r: 0, g: 0, b: 0, a: 1 },
                loadOp: 'clear',
                storeOp: 'store'
            }]
        }) as any;
    }
    
    /**
     * Draw using render pipeline
     */
    draw(pipelineName: string, vertexCount: number, instanceCount: number = 1): void {
        const pipeline = this.renderPipelines.get(pipelineName);
        if (!pipeline) throw new Error(`Render pipeline '${pipelineName}' not found`);
        if (!this.currentPassEncoder || !('setPipeline' in this.currentPassEncoder)) {
            throw new Error('No active render pass');
        }
        
        const renderPass = this.currentPassEncoder as any;
        renderPass.setPipeline(pipeline);
        renderPass.draw(vertexCount, instanceCount);
    }
    
    /**
     * End current pass
     */
    endPass(): void {
        if (this.currentPassEncoder) {
            this.currentPassEncoder.end();
            this.currentPassEncoder = null;
        }
    }
    
    /**
     * Submit commands and present
     */
    present(): void {
        if (!this.device || !this.commandEncoder) return;
        
        const commandBuffer = this.commandEncoder.finish();
        this.device.queue.submit([commandBuffer]);
        
        this.commandEncoder = null;
    }
    
    /**
     * Get device info
     */
    getDeviceInfo(): { vendor: string; architecture: string; limits: any } {
        if (!this.adapter) return { vendor: 'Unknown', architecture: 'Unknown', limits: {} };
        
        return {
            vendor: (this.adapter as any).info?.vendor || 'Unknown',
            architecture: (this.adapter as any).info?.architecture || 'Unknown',
            limits: this.device?.limits || {}
        };
    }
    
    /**
     * Clean up resources
     */
    destroy(): void {
        // Destroy buffers
        for (const buffer of this.buffers.values()) {
            buffer.destroy();
        }
        this.buffers.clear();
        
        // Destroy textures
        for (const texture of this.textures.values()) {
            texture.destroy();
        }
        this.textures.clear();
        
        this.renderPipelines.clear();
        this.computePipelines.clear();
        this.bindGroups.clear();
        
        this.device?.destroy();
        this.device = null;
        this.adapter = null;
        this.context = null;
    }
}
