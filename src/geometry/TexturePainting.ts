/**
 * WebForge Texture Painting System
 * 
 * Paint textures directly onto 3D meshes with multiple layers and blend modes.
 * Supports various brush types and painting modes.
 */

import { Vector3 } from '../math/Vector3';
import { Vector2 } from '../math/Vector2';
import { MeshData } from './MeshData';

/**
 * Blend modes for layer compositing
 */
export enum BlendMode {
    NORMAL = 'normal',
    MULTIPLY = 'multiply',
    ADD = 'add',
    SUBTRACT = 'subtract',
    OVERLAY = 'overlay',
    SCREEN = 'screen'
}

/**
 * Paint brush types
 */
export enum PaintBrushType {
    DRAW = 'draw',           // Standard paint brush
    ERASE = 'erase',         // Erase to transparency
    BLUR = 'blur',           // Blur existing colors
    SMUDGE = 'smudge',       // Smudge colors
    CLONE = 'clone',         // Clone from another area
    FILL = 'fill'            // Fill bucket
}

/**
 * Texture layer
 */
export interface TextureLayer {
    id: string;
    name: string;
    canvas: HTMLCanvasElement;
    context: CanvasRenderingContext2D;
    blendMode: BlendMode;
    opacity: number;
    visible: boolean;
}

/**
 * Brush settings
 */
export interface PaintBrushSettings {
    type: PaintBrushType;
    size: number;            // Brush size in pixels
    hardness: number;        // Brush edge hardness (0-1)
    opacity: number;         // Brush opacity (0-1)
    flow: number;            // Paint flow rate (0-1)
    spacing: number;         // Spacing between dabs (0-1)
    color: string;           // Brush color (hex)
    jitter: number;          // Random position jitter (0-1)
}

/**
 * Texture painting system
 */
export class TexturePaintingSystem {
    // @ts-expect-error - Will be used for 3D painting (findUVAtPosition implementation)
    private _mesh: MeshData;
    private layers: TextureLayer[] = [];
    private activeLayerIndex: number = 0;
    private textureWidth: number;
    private textureHeight: number;
    private settings: PaintBrushSettings;
    private compositeCanvas: HTMLCanvasElement;
    private compositeContext: CanvasRenderingContext2D;
    private previousPosition: Vector2 | null = null;
    
    constructor(mesh: MeshData, width: number = 1024, height: number = 1024) {
        this._mesh = mesh;
        this.textureWidth = width;
        this.textureHeight = height;
        
        // Create composite canvas
        this.compositeCanvas = document.createElement('canvas');
        this.compositeCanvas.width = width;
        this.compositeCanvas.height = height;
        this.compositeContext = this.compositeCanvas.getContext('2d')!;
        
        // Default brush settings
        this.settings = {
            type: PaintBrushType.DRAW,
            size: 50,
            hardness: 0.5,
            opacity: 1.0,
            flow: 1.0,
            spacing: 0.25,
            color: '#FFFFFF',
            jitter: 0.0
        };
        
        // Create initial layer
        this.addLayer('Base Layer');
    }
    
    /**
     * Add a new layer
     */
    public addLayer(name: string): string {
        const canvas = document.createElement('canvas');
        canvas.width = this.textureWidth;
        canvas.height = this.textureHeight;
        const context = canvas.getContext('2d')!;
        
        const layer: TextureLayer = {
            id: `layer_${Date.now()}_${Math.random()}`,
            name,
            canvas,
            context,
            blendMode: BlendMode.NORMAL,
            opacity: 1.0,
            visible: true
        };
        
        this.layers.push(layer);
        return layer.id;
    }
    
    /**
     * Remove a layer
     */
    public removeLayer(layerId: string): boolean {
        const index = this.layers.findIndex(l => l.id === layerId);
        if (index === -1 || this.layers.length === 1) return false;
        
        this.layers.splice(index, 1);
        if (this.activeLayerIndex >= this.layers.length) {
            this.activeLayerIndex = this.layers.length - 1;
        }
        this.compositeAllLayers();
        return true;
    }
    
    /**
     * Set active layer
     */
    public setActiveLayer(layerId: string): boolean {
        const index = this.layers.findIndex(l => l.id === layerId);
        if (index === -1) return false;
        
        this.activeLayerIndex = index;
        return true;
    }
    
    /**
     * Get all layers
     */
    public getLayers(): TextureLayer[] {
        return [...this.layers];
    }
    
    /**
     * Update layer settings
     */
    public updateLayer(layerId: string, settings: Partial<TextureLayer>): boolean {
        const layer = this.layers.find(l => l.id === layerId);
        if (!layer) return false;
        
        if (settings.blendMode !== undefined) layer.blendMode = settings.blendMode;
        if (settings.opacity !== undefined) layer.opacity = settings.opacity;
        if (settings.visible !== undefined) layer.visible = settings.visible;
        if (settings.name !== undefined) layer.name = settings.name;
        
        this.compositeAllLayers();
        return true;
    }
    
    /**
     * Update brush settings
     */
    public updateBrushSettings(settings: Partial<PaintBrushSettings>): void {
        this.settings = { ...this.settings, ...settings };
    }
    
    /**
     * Get current brush settings
     */
    public getBrushSettings(): PaintBrushSettings {
        return { ...this.settings };
    }
    
    /**
     * Paint at UV coordinates
     */
    public paintAtUV(uv: Vector2): void {
        const layer = this.layers[this.activeLayerIndex];
        if (!layer || !layer.visible) return;
        
        // Convert UV to pixel coordinates
        const x = uv.x * this.textureWidth;
        const y = (1.0 - uv.y) * this.textureHeight; // Flip Y
        const position = new Vector2(x, y);
        
        // Apply brush stroke
        this.applyBrushStroke(layer, position);
        
        // Composite all layers
        this.compositeAllLayers();
        
        this.previousPosition = position.clone();
    }
    
    /**
     * Paint at 3D position on mesh
     */
    public paintAt3D(position: Vector3): void {
        // Find UV coordinates at this position
        const uv = this.findUVAtPosition(position);
        if (uv) {
            this.paintAtUV(uv);
        }
    }
    
    /**
     * Apply brush stroke to layer
     */
    private applyBrushStroke(layer: TextureLayer, position: Vector2): void {
        const ctx = layer.context;
        
        switch (this.settings.type) {
            case PaintBrushType.DRAW:
                this.drawBrush(ctx, position);
                break;
            case PaintBrushType.ERASE:
                this.eraseBrush(ctx, position);
                break;
            case PaintBrushType.BLUR:
                this.blurBrush(ctx, position);
                break;
            case PaintBrushType.SMUDGE:
                this.smudgeBrush(ctx, position);
                break;
            case PaintBrushType.CLONE:
                this.cloneBrush(ctx, position);
                break;
            case PaintBrushType.FILL:
                this.fillBrush(ctx, position);
                break;
        }
    }
    
    /**
     * Draw brush dab
     */
    private drawBrush(ctx: CanvasRenderingContext2D, position: Vector2): void {
        // Create gradient for soft brush
        const gradient = ctx.createRadialGradient(
            position.x, position.y, 0,
            position.x, position.y, this.settings.size / 2
        );
        
        const color = this.settings.color;
        const opacity = this.settings.opacity * this.settings.flow;
        
        // Soft edge based on hardness
        const hardness = Math.max(0.01, this.settings.hardness);
        gradient.addColorStop(0, this.hexToRGBA(color, opacity));
        gradient.addColorStop(hardness, this.hexToRGBA(color, opacity * 0.5));
        gradient.addColorStop(1, this.hexToRGBA(color, 0));
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(position.x, position.y, this.settings.size / 2, 0, Math.PI * 2);
        ctx.fill();
        
        // If we have a previous position, interpolate
        if (this.previousPosition) {
            this.interpolateBrush(ctx, this.previousPosition, position);
        }
    }
    
    /**
     * Erase brush
     */
    private eraseBrush(ctx: CanvasRenderingContext2D, position: Vector2): void {
        ctx.globalCompositeOperation = 'destination-out';
        this.drawBrush(ctx, position);
        ctx.globalCompositeOperation = 'source-over';
    }
    
    /**
     * Blur brush (simple box blur)
     */
    private blurBrush(_ctx: CanvasRenderingContext2D, _position: Vector2): void {
        // TODO: Implement blur brush
        console.warn('Blur brush not yet implemented');
    }
    
    /**
     * Smudge brush
     */
    private smudgeBrush(_ctx: CanvasRenderingContext2D, _position: Vector2): void {
        // TODO: Implement smudge brush
        console.warn('Smudge brush not yet implemented');
    }
    
    /**
     * Clone brush
     */
    private cloneBrush(_ctx: CanvasRenderingContext2D, _position: Vector2): void {
        // TODO: Implement clone brush
        console.warn('Clone brush not yet implemented');
    }
    
    /**
     * Fill brush (flood fill)
     */
    private fillBrush(ctx: CanvasRenderingContext2D, _position: Vector2): void {
        ctx.fillStyle = this.settings.color;
        ctx.fillRect(0, 0, this.textureWidth, this.textureHeight);
    }
    
    /**
     * Interpolate brush strokes between two positions
     */
    private interpolateBrush(ctx: CanvasRenderingContext2D, from: Vector2, to: Vector2): void {
        const distance = from.distanceTo(to);
        const steps = Math.max(1, Math.floor(distance * this.settings.spacing));
        
        for (let i = 1; i < steps; i++) {
            const t = i / steps;
            const pos = from.lerp(to, t);
            
            // Add jitter if enabled
            if (this.settings.jitter > 0) {
                const jitterX = (Math.random() - 0.5) * this.settings.jitter * this.settings.size;
                const jitterY = (Math.random() - 0.5) * this.settings.jitter * this.settings.size;
                pos.x += jitterX;
                pos.y += jitterY;
            }
            
            this.drawBrush(ctx, pos);
        }
    }
    
    /**
     * Composite all visible layers into final texture
     */
    private compositeAllLayers(): void {
        // Clear composite canvas
        this.compositeContext.clearRect(0, 0, this.textureWidth, this.textureHeight);
        
        // Composite each visible layer
        for (const layer of this.layers) {
            if (!layer.visible) continue;
            
            // Set blend mode and opacity
            this.compositeContext.globalCompositeOperation = this.getCompositeOperation(layer.blendMode);
            this.compositeContext.globalAlpha = layer.opacity;
            
            // Draw layer
            this.compositeContext.drawImage(layer.canvas, 0, 0);
        }
        
        // Reset composite operation
        this.compositeContext.globalCompositeOperation = 'source-over';
        this.compositeContext.globalAlpha = 1.0;
    }
    
    /**
     * Get canvas composite operation for blend mode
     */
    private getCompositeOperation(blendMode: BlendMode): GlobalCompositeOperation {
        switch (blendMode) {
            case BlendMode.NORMAL: return 'source-over';
            case BlendMode.MULTIPLY: return 'multiply';
            case BlendMode.ADD: return 'lighter';
            case BlendMode.SUBTRACT: return 'difference';
            case BlendMode.OVERLAY: return 'overlay';
            case BlendMode.SCREEN: return 'screen';
            default: return 'source-over';
        }
    }
    
    /**
     * Find UV coordinates at 3D position
     */
    private findUVAtPosition(_position: Vector3): Vector2 | null {
        // TODO: Implement ray-mesh intersection to find UV at position
        // This requires raycasting against the mesh
        console.warn('3D position to UV mapping not yet implemented');
        return null;
    }
    
    /**
     * Convert hex color to RGBA string
     */
    private hexToRGBA(hex: string, alpha: number): string {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    
    /**
     * Get composite texture
     */
    public getTexture(): HTMLCanvasElement {
        return this.compositeCanvas;
    }
    
    /**
     * Export texture as data URL
     */
    public exportTexture(format: 'image/png' | 'image/jpeg' = 'image/png'): string {
        return this.compositeCanvas.toDataURL(format);
    }
    
    /**
     * Clear active layer
     */
    public clearLayer(): void {
        const layer = this.layers[this.activeLayerIndex];
        if (layer) {
            layer.context.clearRect(0, 0, this.textureWidth, this.textureHeight);
            this.compositeAllLayers();
        }
    }
    
    /**
     * Reset stroke (call when starting new stroke)
     */
    public resetStroke(): void {
        this.previousPosition = null;
    }
}
