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
    private mesh: MeshData;
    private layers: TextureLayer[] = [];
    private activeLayerIndex: number = 0;
    private textureWidth: number;
    private textureHeight: number;
    private settings: PaintBrushSettings;
    private compositeCanvas: HTMLCanvasElement;
    private compositeContext: CanvasRenderingContext2D;
    private previousPosition: Vector2 | null = null;
    private cloneSource: Vector2 | null = null;
    
    constructor(mesh: MeshData, width: number = 1024, height: number = 1024) {
        this.mesh = mesh;
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
     * Blur brush (box blur within brush radius)
     */
    private blurBrush(ctx: CanvasRenderingContext2D, position: Vector2): void {
        const radius = Math.floor(this.settings.size / 2);
        const x = Math.floor(position.x - radius);
        const y = Math.floor(position.y - radius);
        const diameter = radius * 2;
        
        // Clamp to canvas bounds
        const sx = Math.max(0, x);
        const sy = Math.max(0, y);
        const sw = Math.min(diameter, this.textureWidth - sx);
        const sh = Math.min(diameter, this.textureHeight - sy);
        
        if (sw <= 0 || sh <= 0) return;
        
        // Read pixels from the area
        const imageData = ctx.getImageData(sx, sy, sw, sh);
        const data = imageData.data;
        // Blur kernel radius: ranges from 1 (hard brush) to 4 (soft brush)
        // based on inverse of hardness setting
        const blurRadius = Math.max(1, Math.floor(3 * (1 - this.settings.hardness) + 1));
        
        // Create output buffer
        const output = new Uint8ClampedArray(data.length);
        
        // Box blur pass
        for (let py = 0; py < sh; py++) {
            for (let px = 0; px < sw; px++) {
                // Check if pixel is within circular brush
                const dx = (sx + px) - position.x;
                const dy = (sy + py) - position.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                
                if (dist > radius) {
                    // Outside brush - copy original pixel
                    const idx = (py * sw + px) * 4;
                    output[idx] = data[idx];
                    output[idx + 1] = data[idx + 1];
                    output[idx + 2] = data[idx + 2];
                    output[idx + 3] = data[idx + 3];
                    continue;
                }
                
                let r = 0, g = 0, b = 0, a = 0, count = 0;
                
                for (let ky = -blurRadius; ky <= blurRadius; ky++) {
                    for (let kx = -blurRadius; kx <= blurRadius; kx++) {
                        const nx = px + kx;
                        const ny = py + ky;
                        if (nx >= 0 && nx < sw && ny >= 0 && ny < sh) {
                            const idx = (ny * sw + nx) * 4;
                            r += data[idx];
                            g += data[idx + 1];
                            b += data[idx + 2];
                            a += data[idx + 3];
                            count++;
                        }
                    }
                }
                
                const outIdx = (py * sw + px) * 4;
                const strength = this.settings.opacity * (1 - dist / radius);
                output[outIdx] = Math.round(data[outIdx] * (1 - strength) + (r / count) * strength);
                output[outIdx + 1] = Math.round(data[outIdx + 1] * (1 - strength) + (g / count) * strength);
                output[outIdx + 2] = Math.round(data[outIdx + 2] * (1 - strength) + (b / count) * strength);
                output[outIdx + 3] = Math.round(data[outIdx + 3] * (1 - strength) + (a / count) * strength);
            }
        }
        
        imageData.data.set(output);
        ctx.putImageData(imageData, sx, sy);
    }
    
    /**
     * Smudge brush - picks up color from previous position and paints it forward
     */
    private smudgeBrush(ctx: CanvasRenderingContext2D, position: Vector2): void {
        if (!this.previousPosition) {
            this.previousPosition = position;
            return;
        }
        
        const radius = Math.floor(this.settings.size / 2);
        const prevX = Math.floor(this.previousPosition.x - radius);
        const prevY = Math.floor(this.previousPosition.y - radius);
        const diameter = radius * 2;
        
        // Clamp source region
        const srcX = Math.max(0, prevX);
        const srcY = Math.max(0, prevY);
        const srcW = Math.min(diameter, this.textureWidth - srcX);
        const srcH = Math.min(diameter, this.textureHeight - srcY);
        
        if (srcW <= 0 || srcH <= 0) return;
        
        // Read source pixels from previous position
        const srcData = ctx.getImageData(srcX, srcY, srcW, srcH);
        
        // Read destination pixels at current position
        const dstX = Math.max(0, Math.floor(position.x - radius));
        const dstY = Math.max(0, Math.floor(position.y - radius));
        const dstW = Math.min(diameter, this.textureWidth - dstX);
        const dstH = Math.min(diameter, this.textureHeight - dstY);
        
        if (dstW <= 0 || dstH <= 0) return;
        
        const dstData = ctx.getImageData(dstX, dstY, dstW, dstH);
        const strength = this.settings.opacity * this.settings.flow;
        
        // Blend source into destination within circular brush shape
        const minW = Math.min(srcW, dstW);
        const minH = Math.min(srcH, dstH);
        
        for (let py = 0; py < minH; py++) {
            for (let px = 0; px < minW; px++) {
                const dx = (dstX + px) - position.x;
                const dy = (dstY + py) - position.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                
                if (dist > radius) continue;
                
                const falloff = 1 - (dist / radius);
                const blend = strength * falloff;
                
                const srcIdx = (py * srcW + px) * 4;
                const dstIdx = (py * dstW + px) * 4;
                
                dstData.data[dstIdx] = Math.round(dstData.data[dstIdx] * (1 - blend) + srcData.data[srcIdx] * blend);
                dstData.data[dstIdx + 1] = Math.round(dstData.data[dstIdx + 1] * (1 - blend) + srcData.data[srcIdx + 1] * blend);
                dstData.data[dstIdx + 2] = Math.round(dstData.data[dstIdx + 2] * (1 - blend) + srcData.data[srcIdx + 2] * blend);
                dstData.data[dstIdx + 3] = Math.round(dstData.data[dstIdx + 3] * (1 - blend) + srcData.data[srcIdx + 3] * blend);
            }
        }
        
        ctx.putImageData(dstData, dstX, dstY);
    }
    
    /**
     * Clone brush - stamps pixels from a source position offset
     */
    private cloneBrush(ctx: CanvasRenderingContext2D, position: Vector2): void {
        if (!this.cloneSource) return;
        
        const radius = Math.floor(this.settings.size / 2);
        const offset = new Vector2(
            this.cloneSource.x - position.x,
            this.cloneSource.y - position.y
        );
        
        // Read source pixels (from offset position)
        const srcX = Math.max(0, Math.floor(position.x + offset.x - radius));
        const srcY = Math.max(0, Math.floor(position.y + offset.y - radius));
        const diameter = radius * 2;
        const srcW = Math.min(diameter, this.textureWidth - srcX);
        const srcH = Math.min(diameter, this.textureHeight - srcY);
        
        if (srcW <= 0 || srcH <= 0) return;
        
        const srcData = ctx.getImageData(srcX, srcY, srcW, srcH);
        
        // Read destination pixels
        const dstX = Math.max(0, Math.floor(position.x - radius));
        const dstY = Math.max(0, Math.floor(position.y - radius));
        const dstW = Math.min(diameter, this.textureWidth - dstX);
        const dstH = Math.min(diameter, this.textureHeight - dstY);
        
        if (dstW <= 0 || dstH <= 0) return;
        
        const dstData = ctx.getImageData(dstX, dstY, dstW, dstH);
        const strength = this.settings.opacity * this.settings.flow;
        
        const minW = Math.min(srcW, dstW);
        const minH = Math.min(srcH, dstH);
        
        for (let py = 0; py < minH; py++) {
            for (let px = 0; px < minW; px++) {
                const dx = (dstX + px) - position.x;
                const dy = (dstY + py) - position.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                
                if (dist > radius) continue;
                
                const falloff = 1 - (dist / radius) * (1 - this.settings.hardness);
                const blend = strength * Math.min(1, falloff);
                
                const srcIdx = (py * srcW + px) * 4;
                const dstIdx = (py * dstW + px) * 4;
                
                dstData.data[dstIdx] = Math.round(dstData.data[dstIdx] * (1 - blend) + srcData.data[srcIdx] * blend);
                dstData.data[dstIdx + 1] = Math.round(dstData.data[dstIdx + 1] * (1 - blend) + srcData.data[srcIdx + 1] * blend);
                dstData.data[dstIdx + 2] = Math.round(dstData.data[dstIdx + 2] * (1 - blend) + srcData.data[srcIdx + 2] * blend);
                dstData.data[dstIdx + 3] = Math.round(dstData.data[dstIdx + 3] * (1 - blend) + srcData.data[srcIdx + 3] * blend);
            }
        }
        
        ctx.putImageData(dstData, dstX, dstY);
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
     * Find UV coordinates at 3D position by testing against mesh triangles
     * Uses closest-point-on-triangle to find the UV at the nearest mesh surface point
     */
    private findUVAtPosition(position: Vector3): Vector2 | null {
        const positions = this.mesh.getPositions();
        const uvs = this.mesh.getUVs();
        const indices = this.mesh.getIndices();
        
        if (!positions || !uvs || positions.length < 9 || uvs.length < 6) {
            return null;
        }
        
        let closestDist = Infinity;
        let closestUV: Vector2 | null = null;
        
        // Iterate through triangles
        const triCount = indices.length > 0 ? Math.floor(indices.length / 3) : Math.floor(positions.length / 9);
        
        for (let i = 0; i < triCount; i++) {
            // Get vertex indices
            let i0: number, i1: number, i2: number;
            if (indices.length > 0) {
                i0 = indices[i * 3];
                i1 = indices[i * 3 + 1];
                i2 = indices[i * 3 + 2];
            } else {
                i0 = i * 3;
                i1 = i * 3 + 1;
                i2 = i * 3 + 2;
            }
            
            // Get positions
            const v0 = new Vector3(positions[i0 * 3], positions[i0 * 3 + 1], positions[i0 * 3 + 2]);
            const v1 = new Vector3(positions[i1 * 3], positions[i1 * 3 + 1], positions[i1 * 3 + 2]);
            const v2 = new Vector3(positions[i2 * 3], positions[i2 * 3 + 1], positions[i2 * 3 + 2]);
            
            // Compute barycentric coordinates of closest point on triangle
            const bary = this.closestPointBarycentric(position, v0, v1, v2);
            if (!bary) continue;
            
            // Compute closest point
            const closest = v0.clone().multiplyScalar(bary.u)
                .add(v1.clone().multiplyScalar(bary.v))
                .add(v2.clone().multiplyScalar(bary.w));
            
            const dist = position.clone().subtract(closest).lengthSquared();
            
            if (dist < closestDist) {
                closestDist = dist;
                
                // Interpolate UVs using barycentric coordinates
                const uv0x = uvs[i0 * 2], uv0y = uvs[i0 * 2 + 1];
                const uv1x = uvs[i1 * 2], uv1y = uvs[i1 * 2 + 1];
                const uv2x = uvs[i2 * 2], uv2y = uvs[i2 * 2 + 1];
                
                closestUV = new Vector2(
                    uv0x * bary.u + uv1x * bary.v + uv2x * bary.w,
                    uv0y * bary.u + uv1y * bary.v + uv2y * bary.w
                );
            }
        }
        
        return closestUV;
    }
    
    /**
     * Compute barycentric coordinates for closest point on triangle to point P
     */
    private closestPointBarycentric(
        p: Vector3, a: Vector3, b: Vector3, c: Vector3
    ): { u: number; v: number; w: number } | null {
        const ab = b.clone().subtract(a);
        const ac = c.clone().subtract(a);
        const ap = p.clone().subtract(a);
        
        const d1 = ab.dot(ap);
        const d2 = ac.dot(ap);
        
        // Vertex region A
        if (d1 <= 0 && d2 <= 0) return { u: 1, v: 0, w: 0 };
        
        const bp = p.clone().subtract(b);
        const d3 = ab.dot(bp);
        const d4 = ac.dot(bp);
        
        // Vertex region B
        if (d3 >= 0 && d4 <= d3) return { u: 0, v: 1, w: 0 };
        
        // Edge region AB
        const vc = d1 * d4 - d3 * d2;
        if (vc <= 0 && d1 >= 0 && d3 <= 0) {
            const v = d1 / (d1 - d3);
            return { u: 1 - v, v: v, w: 0 };
        }
        
        const cp = p.clone().subtract(c);
        const d5 = ab.dot(cp);
        const d6 = ac.dot(cp);
        
        // Vertex region C
        if (d6 >= 0 && d5 <= d6) return { u: 0, v: 0, w: 1 };
        
        // Edge region AC
        const vb = d5 * d2 - d1 * d6;
        if (vb <= 0 && d2 >= 0 && d6 <= 0) {
            const w = d2 / (d2 - d6);
            return { u: 1 - w, v: 0, w: w };
        }
        
        // Edge region BC
        const va = d3 * d6 - d5 * d4;
        if (va <= 0 && (d4 - d3) >= 0 && (d5 - d6) >= 0) {
            const w = (d4 - d3) / ((d4 - d3) + (d5 - d6));
            return { u: 0, v: 1 - w, w: w };
        }
        
        // Inside face
        const denominator = va + vb + vc;
        if (Math.abs(denominator) < 1e-10) return { u: 1/3, v: 1/3, w: 1/3 }; // Degenerate triangle
        const denom = 1.0 / denominator;
        const v = vb * denom;
        const w = vc * denom;
        return { u: 1 - v - w, v: v, w: w };
    }
    
    /**
     * Set clone source position for clone brush
     * @param position - Source position in texture coordinates
     */
    public setCloneSource(position: Vector2): void {
        this.cloneSource = position;
    }
    
    /**
     * Get clone source position
     */
    public getCloneSource(): Vector2 | null {
        return this.cloneSource;
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
