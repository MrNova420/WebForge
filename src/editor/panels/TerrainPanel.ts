/**
 * @fileoverview Terrain Editor Panel
 * @module editor/panels
 * 
 * Comprehensive terrain sculpting and painting interface.
 * Features:
 * - Height map editing with brushes
 * - Multi-layer texture painting
 * - Vegetation/foliage placement
 * - Road/path tools
 * - Erosion simulation
 * - Import/export heightmaps
 * 
 * @author WebForge Team
 * @license MIT
 */

import { Panel } from '../Panel';

// ============================================================================
// TYPES
// ============================================================================

export type TerrainToolType = 
    | 'raise' | 'lower' | 'flatten' | 'smooth' | 'sharpen'
    | 'paint' | 'erase'
    | 'scatter' | 'remove' | 'align'
    | 'road' | 'river';

export type EditorTerrainBrushShape = 'circle' | 'square' | 'noise' | 'custom';

export interface EditorTerrainBrush {
    shape: EditorTerrainBrushShape;
    size: number;
    strength: number;
    falloff: number;
    rotation: number;
    jitter: number;
    customMask?: ImageData;
}

export interface EditorTerrainLayer {
    id: string;
    name: string;
    albedoTexture: string;
    normalTexture?: string;
    roughness: number;
    metallic: number;
    tiling: { x: number; y: number };
    offset: { x: number; y: number };
    slopeMin: number;
    slopeMax: number;
    heightMin: number;
    heightMax: number;
}

export interface FoliageType {
    id: string;
    name: string;
    mesh: string;
    density: number;
    minScale: number;
    maxScale: number;
    alignToNormal: boolean;
    randomRotation: boolean;
    slopeMin: number;
    slopeMax: number;
    heightMin: number;
    heightMax: number;
}

export interface TerrainSettings {
    width: number;
    length: number;
    height: number;
    resolution: number;
    tessellation: number;
    lodLevels: number;
    lodDistance: number;
}

// ============================================================================
// TERRAIN PANEL
// ============================================================================

export class TerrainPanel extends Panel {
    private currentTool: TerrainToolType = 'raise';
    private brush: EditorTerrainBrush;
    private layers: EditorTerrainLayer[] = [];
    private foliageTypes: FoliageType[] = [];
    private selectedLayer: number = 0;
    private selectedFoliage: number = -1;
    private terrainSettings: TerrainSettings;
    private previewCanvas: HTMLCanvasElement | null = null;
    private previewCtx: CanvasRenderingContext2D | null = null;
    
    constructor(id: string = 'terrain', title: string = 'Terrain Editor') {
        super(id, title);
        
        this.brush = {
            shape: 'circle',
            size: 50,
            strength: 0.5,
            falloff: 0.5,
            rotation: 0,
            jitter: 0
        };
        
        this.terrainSettings = {
            width: 1000,
            length: 1000,
            height: 200,
            resolution: 513,
            tessellation: 64,
            lodLevels: 4,
            lodDistance: 100
        };
        
        this.setupDefaultLayers();
        this.setupDefaultFoliage();
    }
    
    private setupDefaultLayers(): void {
        this.layers = [
            {
                id: 'grass',
                name: 'Grass',
                albedoTexture: 'textures/terrain/grass_albedo.jpg',
                normalTexture: 'textures/terrain/grass_normal.jpg',
                roughness: 0.8,
                metallic: 0,
                tiling: { x: 20, y: 20 },
                offset: { x: 0, y: 0 },
                slopeMin: 0,
                slopeMax: 30,
                heightMin: 0,
                heightMax: 0.7
            },
            {
                id: 'rock',
                name: 'Rock',
                albedoTexture: 'textures/terrain/rock_albedo.jpg',
                normalTexture: 'textures/terrain/rock_normal.jpg',
                roughness: 0.9,
                metallic: 0,
                tiling: { x: 10, y: 10 },
                offset: { x: 0, y: 0 },
                slopeMin: 25,
                slopeMax: 90,
                heightMin: 0,
                heightMax: 1
            },
            {
                id: 'dirt',
                name: 'Dirt',
                albedoTexture: 'textures/terrain/dirt_albedo.jpg',
                normalTexture: 'textures/terrain/dirt_normal.jpg',
                roughness: 0.85,
                metallic: 0,
                tiling: { x: 15, y: 15 },
                offset: { x: 0, y: 0 },
                slopeMin: 0,
                slopeMax: 45,
                heightMin: 0,
                heightMax: 0.5
            },
            {
                id: 'snow',
                name: 'Snow',
                albedoTexture: 'textures/terrain/snow_albedo.jpg',
                normalTexture: 'textures/terrain/snow_normal.jpg',
                roughness: 0.6,
                metallic: 0,
                tiling: { x: 25, y: 25 },
                offset: { x: 0, y: 0 },
                slopeMin: 0,
                slopeMax: 40,
                heightMin: 0.7,
                heightMax: 1
            }
        ];
    }
    
    private setupDefaultFoliage(): void {
        this.foliageTypes = [
            {
                id: 'tree_oak',
                name: 'Oak Tree',
                mesh: 'models/foliage/oak_tree.glb',
                density: 0.3,
                minScale: 0.8,
                maxScale: 1.2,
                alignToNormal: false,
                randomRotation: true,
                slopeMin: 0,
                slopeMax: 20,
                heightMin: 0,
                heightMax: 0.6
            },
            {
                id: 'tree_pine',
                name: 'Pine Tree',
                mesh: 'models/foliage/pine_tree.glb',
                density: 0.4,
                minScale: 0.7,
                maxScale: 1.3,
                alignToNormal: false,
                randomRotation: true,
                slopeMin: 0,
                slopeMax: 25,
                heightMin: 0.3,
                heightMax: 0.8
            },
            {
                id: 'grass_clump',
                name: 'Grass Clump',
                mesh: 'models/foliage/grass_clump.glb',
                density: 0.8,
                minScale: 0.5,
                maxScale: 1.5,
                alignToNormal: true,
                randomRotation: true,
                slopeMin: 0,
                slopeMax: 30,
                heightMin: 0,
                heightMax: 0.7
            },
            {
                id: 'rock_small',
                name: 'Small Rock',
                mesh: 'models/foliage/rock_small.glb',
                density: 0.5,
                minScale: 0.3,
                maxScale: 2.0,
                alignToNormal: true,
                randomRotation: true,
                slopeMin: 0,
                slopeMax: 90,
                heightMin: 0,
                heightMax: 1
            },
            {
                id: 'flower',
                name: 'Wild Flower',
                mesh: 'models/foliage/flower.glb',
                density: 0.6,
                minScale: 0.6,
                maxScale: 1.4,
                alignToNormal: true,
                randomRotation: true,
                slopeMin: 0,
                slopeMax: 20,
                heightMin: 0,
                heightMax: 0.5
            }
        ];
    }
    
    protected onMount(container: HTMLElement): void {
        container.innerHTML = this.generateHTML();
        this.setupEventListeners(container);
        this.createBrushPreview(container);
        this.updateUI(container);
    }
    
    private generateHTML(): string {
        return `
            <div class="terrain-panel">
                <style>
                    .terrain-panel {
                        display: flex;
                        flex-direction: column;
                        height: 100%;
                        font-size: 12px;
                        overflow: hidden;
                    }
                    .terrain-tabs {
                        display: flex;
                        background: #1e1e1e;
                        border-bottom: 1px solid #3c3c3c;
                    }
                    .terrain-tab {
                        padding: 8px 14px;
                        cursor: pointer;
                        border-bottom: 2px solid transparent;
                        color: #858585;
                        transition: all 0.2s;
                    }
                    .terrain-tab:hover { color: #cccccc; }
                    .terrain-tab.active {
                        color: #ffffff;
                        border-bottom-color: #007acc;
                        background: #252526;
                    }
                    .terrain-content {
                        flex: 1;
                        overflow-y: auto;
                        padding: 12px;
                    }
                    .terrain-tab-content {
                        display: none;
                    }
                    .terrain-tab-content.active {
                        display: block;
                    }
                    .terrain-section {
                        margin-bottom: 16px;
                    }
                    .terrain-section-header {
                        font-weight: 600;
                        color: #cccccc;
                        margin-bottom: 10px;
                        padding-bottom: 4px;
                        border-bottom: 1px solid #3c3c3c;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                    }
                    .terrain-tools {
                        display: grid;
                        grid-template-columns: repeat(4, 1fr);
                        gap: 4px;
                    }
                    .terrain-tool {
                        padding: 10px 8px;
                        background: #2d2d30;
                        border: 1px solid #3c3c3c;
                        border-radius: 4px;
                        cursor: pointer;
                        text-align: center;
                        transition: all 0.15s;
                        font-size: 11px;
                    }
                    .terrain-tool:hover {
                        background: #3e3e42;
                        border-color: #505050;
                    }
                    .terrain-tool.active {
                        background: #094771;
                        border-color: #007acc;
                    }
                    .terrain-tool-icon {
                        font-size: 18px;
                        margin-bottom: 4px;
                        display: block;
                    }
                    .terrain-brush-preview {
                        width: 100%;
                        height: 80px;
                        background: #1e1e1e;
                        border: 1px solid #3c3c3c;
                        border-radius: 4px;
                        margin-bottom: 12px;
                    }
                    .terrain-slider-row {
                        margin-bottom: 10px;
                    }
                    .terrain-slider-row label {
                        display: flex;
                        justify-content: space-between;
                        margin-bottom: 4px;
                        color: #9d9d9d;
                    }
                    .terrain-slider {
                        width: 100%;
                        height: 6px;
                        appearance: none;
                        background: #3c3c3c;
                        border-radius: 3px;
                        cursor: pointer;
                    }
                    .terrain-slider::-webkit-slider-thumb {
                        appearance: none;
                        width: 14px;
                        height: 14px;
                        background: #007acc;
                        border-radius: 50%;
                        cursor: grab;
                    }
                    .terrain-slider::-webkit-slider-thumb:active {
                        cursor: grabbing;
                    }
                    .terrain-layers {
                        border: 1px solid #3c3c3c;
                        border-radius: 4px;
                        overflow: hidden;
                    }
                    .terrain-layer-item {
                        display: flex;
                        align-items: center;
                        padding: 8px 10px;
                        background: #252526;
                        border-bottom: 1px solid #3c3c3c;
                        cursor: pointer;
                        gap: 10px;
                    }
                    .terrain-layer-item:last-child {
                        border-bottom: none;
                    }
                    .terrain-layer-item:hover {
                        background: #2d2d30;
                    }
                    .terrain-layer-item.selected {
                        background: #094771;
                    }
                    .terrain-layer-preview {
                        width: 32px;
                        height: 32px;
                        border-radius: 4px;
                        background: #1e1e1e;
                        border: 1px solid #3c3c3c;
                    }
                    .terrain-layer-info {
                        flex: 1;
                    }
                    .terrain-layer-name {
                        font-weight: 500;
                        margin-bottom: 2px;
                    }
                    .terrain-layer-meta {
                        font-size: 10px;
                        color: #666;
                    }
                    .terrain-foliage-grid {
                        display: grid;
                        grid-template-columns: repeat(3, 1fr);
                        gap: 6px;
                    }
                    .terrain-foliage-item {
                        padding: 8px;
                        background: #252526;
                        border: 1px solid #3c3c3c;
                        border-radius: 4px;
                        text-align: center;
                        cursor: pointer;
                        transition: all 0.15s;
                    }
                    .terrain-foliage-item:hover {
                        background: #2d2d30;
                        border-color: #505050;
                    }
                    .terrain-foliage-item.selected {
                        background: #094771;
                        border-color: #007acc;
                    }
                    .terrain-foliage-icon {
                        font-size: 24px;
                        margin-bottom: 4px;
                    }
                    .terrain-foliage-name {
                        font-size: 10px;
                        white-space: nowrap;
                        overflow: hidden;
                        text-overflow: ellipsis;
                    }
                    .terrain-btn {
                        padding: 6px 12px;
                        background: linear-gradient(180deg, #3c3c3c, #2d2d30);
                        border: 1px solid #505050;
                        border-radius: 4px;
                        color: #cccccc;
                        cursor: pointer;
                        font-size: 11px;
                        transition: all 0.15s;
                    }
                    .terrain-btn:hover {
                        background: linear-gradient(180deg, #4a4a4a, #3c3c3c);
                    }
                    .terrain-btn.primary {
                        background: linear-gradient(180deg, #0078d4, #005a9e);
                        border-color: #0078d4;
                    }
                    .terrain-btn.primary:hover {
                        background: linear-gradient(180deg, #1c97ea, #0078d4);
                    }
                    .terrain-btn-group {
                        display: flex;
                        gap: 6px;
                        flex-wrap: wrap;
                    }
                    .terrain-input-row {
                        display: grid;
                        grid-template-columns: 1fr 1fr;
                        gap: 10px;
                        margin-bottom: 10px;
                    }
                    .terrain-input-group {
                        display: flex;
                        flex-direction: column;
                        gap: 4px;
                    }
                    .terrain-input-group label {
                        font-size: 11px;
                        color: #9d9d9d;
                    }
                    .terrain-input {
                        padding: 6px 8px;
                        background: #1e1e1e;
                        border: 1px solid #3c3c3c;
                        border-radius: 4px;
                        color: #cccccc;
                        font-size: 12px;
                    }
                    .terrain-input:focus {
                        outline: none;
                        border-color: #007acc;
                    }
                    .terrain-select {
                        padding: 6px 8px;
                        background: #1e1e1e;
                        border: 1px solid #3c3c3c;
                        border-radius: 4px;
                        color: #cccccc;
                        font-size: 12px;
                        cursor: pointer;
                    }
                    .terrain-checkbox-row {
                        display: flex;
                        align-items: center;
                        gap: 8px;
                        margin-bottom: 8px;
                    }
                    .terrain-checkbox-row input {
                        accent-color: #007acc;
                    }
                    .terrain-heightmap-preview {
                        width: 100%;
                        height: 150px;
                        background: #1e1e1e;
                        border: 1px solid #3c3c3c;
                        border-radius: 4px;
                        margin-bottom: 12px;
                        position: relative;
                    }
                    .terrain-heightmap-preview canvas {
                        width: 100%;
                        height: 100%;
                        border-radius: 4px;
                    }
                    .terrain-erosion-controls {
                        padding: 10px;
                        background: #1e1e1e;
                        border: 1px solid #3c3c3c;
                        border-radius: 4px;
                    }
                </style>
                
                <div class="terrain-tabs">
                    <div class="terrain-tab active" data-tab="sculpt">Sculpt</div>
                    <div class="terrain-tab" data-tab="paint">Paint</div>
                    <div class="terrain-tab" data-tab="foliage">Foliage</div>
                    <div class="terrain-tab" data-tab="settings">Settings</div>
                </div>
                
                <div class="terrain-content">
                    <!-- SCULPT TAB -->
                    <div class="terrain-tab-content active" id="tab-sculpt">
                        <div class="terrain-section">
                            <div class="terrain-section-header">Sculpt Tools</div>
                            <div class="terrain-tools">
                                <div class="terrain-tool active" data-tool="raise">
                                    <span class="terrain-tool-icon">⬆️</span>
                                    Raise
                                </div>
                                <div class="terrain-tool" data-tool="lower">
                                    <span class="terrain-tool-icon">⬇️</span>
                                    Lower
                                </div>
                                <div class="terrain-tool" data-tool="flatten">
                                    <span class="terrain-tool-icon">➖</span>
                                    Flatten
                                </div>
                                <div class="terrain-tool" data-tool="smooth">
                                    <span class="terrain-tool-icon">🌊</span>
                                    Smooth
                                </div>
                                <div class="terrain-tool" data-tool="sharpen">
                                    <span class="terrain-tool-icon">⚡</span>
                                    Sharpen
                                </div>
                                <div class="terrain-tool" data-tool="road">
                                    <span class="terrain-tool-icon">🛤️</span>
                                    Road
                                </div>
                                <div class="terrain-tool" data-tool="river">
                                    <span class="terrain-tool-icon">💧</span>
                                    River
                                </div>
                            </div>
                        </div>
                        
                        <div class="terrain-section">
                            <div class="terrain-section-header">Brush</div>
                            <canvas class="terrain-brush-preview" id="brush-preview"></canvas>
                            
                            <div class="terrain-slider-row">
                                <label>
                                    <span>Size</span>
                                    <span id="brush-size-val">${this.brush.size}</span>
                                </label>
                                <input type="range" class="terrain-slider" id="brush-size" 
                                    min="1" max="200" value="${this.brush.size}">
                            </div>
                            
                            <div class="terrain-slider-row">
                                <label>
                                    <span>Strength</span>
                                    <span id="brush-strength-val">${Math.round(this.brush.strength * 100)}%</span>
                                </label>
                                <input type="range" class="terrain-slider" id="brush-strength" 
                                    min="1" max="100" value="${this.brush.strength * 100}">
                            </div>
                            
                            <div class="terrain-slider-row">
                                <label>
                                    <span>Falloff</span>
                                    <span id="brush-falloff-val">${Math.round(this.brush.falloff * 100)}%</span>
                                </label>
                                <input type="range" class="terrain-slider" id="brush-falloff" 
                                    min="0" max="100" value="${this.brush.falloff * 100}">
                            </div>
                            
                            <div class="terrain-input-row">
                                <div class="terrain-input-group">
                                    <label>Shape</label>
                                    <select class="terrain-select" id="brush-shape">
                                        <option value="circle" ${this.brush.shape === 'circle' ? 'selected' : ''}>Circle</option>
                                        <option value="square" ${this.brush.shape === 'square' ? 'selected' : ''}>Square</option>
                                        <option value="noise" ${this.brush.shape === 'noise' ? 'selected' : ''}>Noise</option>
                                    </select>
                                </div>
                                <div class="terrain-input-group">
                                    <label>Rotation</label>
                                    <input type="number" class="terrain-input" id="brush-rotation" 
                                        value="${this.brush.rotation}" min="0" max="360">
                                </div>
                            </div>
                        </div>
                        
                        <div class="terrain-section">
                            <div class="terrain-section-header">Erosion</div>
                            <div class="terrain-erosion-controls">
                                <div class="terrain-slider-row">
                                    <label>
                                        <span>Iterations</span>
                                        <span id="erosion-iter-val">50000</span>
                                    </label>
                                    <input type="range" class="terrain-slider" id="erosion-iterations" 
                                        min="1000" max="200000" value="50000" step="1000">
                                </div>
                                <div class="terrain-slider-row">
                                    <label>
                                        <span>Inertia</span>
                                        <span id="erosion-inertia-val">0.05</span>
                                    </label>
                                    <input type="range" class="terrain-slider" id="erosion-inertia" 
                                        min="0" max="100" value="5">
                                </div>
                                <div class="terrain-slider-row">
                                    <label>
                                        <span>Sediment Capacity</span>
                                        <span id="erosion-sediment-val">4</span>
                                    </label>
                                    <input type="range" class="terrain-slider" id="erosion-sediment" 
                                        min="1" max="20" value="4">
                                </div>
                                <div class="terrain-btn-group" style="margin-top: 10px;">
                                    <button class="terrain-btn primary" id="btn-erode">Apply Erosion</button>
                                    <button class="terrain-btn" id="btn-thermal">Thermal Erosion</button>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- PAINT TAB -->
                    <div class="terrain-tab-content" id="tab-paint">
                        <div class="terrain-section">
                            <div class="terrain-section-header">Paint Tools</div>
                            <div class="terrain-tools" style="grid-template-columns: repeat(3, 1fr);">
                                <div class="terrain-tool active" data-tool="paint">
                                    <span class="terrain-tool-icon">🖌️</span>
                                    Paint
                                </div>
                                <div class="terrain-tool" data-tool="erase">
                                    <span class="terrain-tool-icon">🧹</span>
                                    Erase
                                </div>
                                <div class="terrain-tool" data-tool="fill">
                                    <span class="terrain-tool-icon">🪣</span>
                                    Fill
                                </div>
                            </div>
                        </div>
                        
                        <div class="terrain-section">
                            <div class="terrain-section-header">
                                Texture Layers
                                <button class="terrain-btn" id="btn-add-layer">+ Add</button>
                            </div>
                            <div class="terrain-layers" id="layer-list">
                                ${this.renderLayers()}
                            </div>
                        </div>
                        
                        <div class="terrain-section" id="layer-properties" style="display: none;">
                            <div class="terrain-section-header">Layer Properties</div>
                            <div class="terrain-input-row">
                                <div class="terrain-input-group">
                                    <label>Tiling X</label>
                                    <input type="number" class="terrain-input" id="layer-tiling-x" value="1">
                                </div>
                                <div class="terrain-input-group">
                                    <label>Tiling Y</label>
                                    <input type="number" class="terrain-input" id="layer-tiling-y" value="1">
                                </div>
                            </div>
                            <div class="terrain-slider-row">
                                <label>
                                    <span>Roughness</span>
                                    <span id="layer-rough-val">0.8</span>
                                </label>
                                <input type="range" class="terrain-slider" id="layer-roughness" 
                                    min="0" max="100" value="80">
                            </div>
                            <div class="terrain-input-row">
                                <div class="terrain-input-group">
                                    <label>Slope Min (°)</label>
                                    <input type="number" class="terrain-input" id="layer-slope-min" 
                                        value="0" min="0" max="90">
                                </div>
                                <div class="terrain-input-group">
                                    <label>Slope Max (°)</label>
                                    <input type="number" class="terrain-input" id="layer-slope-max" 
                                        value="90" min="0" max="90">
                                </div>
                            </div>
                            <div class="terrain-input-row">
                                <div class="terrain-input-group">
                                    <label>Height Min</label>
                                    <input type="number" class="terrain-input" id="layer-height-min" 
                                        value="0" min="0" max="1" step="0.1">
                                </div>
                                <div class="terrain-input-group">
                                    <label>Height Max</label>
                                    <input type="number" class="terrain-input" id="layer-height-max" 
                                        value="1" min="0" max="1" step="0.1">
                                </div>
                            </div>
                            <div class="terrain-btn-group">
                                <button class="terrain-btn" id="btn-auto-paint">Auto-Paint by Rules</button>
                            </div>
                        </div>
                    </div>
                    
                    <!-- FOLIAGE TAB -->
                    <div class="terrain-tab-content" id="tab-foliage">
                        <div class="terrain-section">
                            <div class="terrain-section-header">Foliage Tools</div>
                            <div class="terrain-tools" style="grid-template-columns: repeat(3, 1fr);">
                                <div class="terrain-tool active" data-tool="scatter">
                                    <span class="terrain-tool-icon">🌿</span>
                                    Scatter
                                </div>
                                <div class="terrain-tool" data-tool="remove">
                                    <span class="terrain-tool-icon">✂️</span>
                                    Remove
                                </div>
                                <div class="terrain-tool" data-tool="align">
                                    <span class="terrain-tool-icon">📐</span>
                                    Align
                                </div>
                            </div>
                        </div>
                        
                        <div class="terrain-section">
                            <div class="terrain-section-header">
                                Foliage Types
                                <button class="terrain-btn" id="btn-add-foliage">+ Add</button>
                            </div>
                            <div class="terrain-foliage-grid" id="foliage-list">
                                ${this.renderFoliageTypes()}
                            </div>
                        </div>
                        
                        <div class="terrain-section" id="foliage-properties" style="display: none;">
                            <div class="terrain-section-header">Foliage Properties</div>
                            <div class="terrain-slider-row">
                                <label>
                                    <span>Density</span>
                                    <span id="foliage-density-val">50%</span>
                                </label>
                                <input type="range" class="terrain-slider" id="foliage-density" 
                                    min="1" max="100" value="50">
                            </div>
                            <div class="terrain-input-row">
                                <div class="terrain-input-group">
                                    <label>Min Scale</label>
                                    <input type="number" class="terrain-input" id="foliage-min-scale" 
                                        value="0.8" min="0.1" max="5" step="0.1">
                                </div>
                                <div class="terrain-input-group">
                                    <label>Max Scale</label>
                                    <input type="number" class="terrain-input" id="foliage-max-scale" 
                                        value="1.2" min="0.1" max="5" step="0.1">
                                </div>
                            </div>
                            <div class="terrain-checkbox-row">
                                <input type="checkbox" id="foliage-align-normal" checked>
                                <label for="foliage-align-normal">Align to Surface Normal</label>
                            </div>
                            <div class="terrain-checkbox-row">
                                <input type="checkbox" id="foliage-random-rotation" checked>
                                <label for="foliage-random-rotation">Random Rotation</label>
                            </div>
                            <div class="terrain-input-row">
                                <div class="terrain-input-group">
                                    <label>Slope Min (°)</label>
                                    <input type="number" class="terrain-input" id="foliage-slope-min" 
                                        value="0" min="0" max="90">
                                </div>
                                <div class="terrain-input-group">
                                    <label>Slope Max (°)</label>
                                    <input type="number" class="terrain-input" id="foliage-slope-max" 
                                        value="30" min="0" max="90">
                                </div>
                            </div>
                        </div>
                        
                        <div class="terrain-section">
                            <div class="terrain-section-header">Batch Operations</div>
                            <div class="terrain-btn-group">
                                <button class="terrain-btn" id="btn-clear-foliage">Clear All</button>
                                <button class="terrain-btn" id="btn-distribute-foliage">Auto-Distribute</button>
                            </div>
                            <div style="margin-top: 10px; color: #666; font-size: 11px;">
                                Instances: <span id="foliage-count">0</span>
                            </div>
                        </div>
                    </div>
                    
                    <!-- SETTINGS TAB -->
                    <div class="terrain-tab-content" id="tab-settings">
                        <div class="terrain-section">
                            <div class="terrain-section-header">Terrain Size</div>
                            <div class="terrain-input-row">
                                <div class="terrain-input-group">
                                    <label>Width (m)</label>
                                    <input type="number" class="terrain-input" id="terrain-width" 
                                        value="${this.terrainSettings.width}">
                                </div>
                                <div class="terrain-input-group">
                                    <label>Length (m)</label>
                                    <input type="number" class="terrain-input" id="terrain-length" 
                                        value="${this.terrainSettings.length}">
                                </div>
                            </div>
                            <div class="terrain-input-row">
                                <div class="terrain-input-group">
                                    <label>Max Height (m)</label>
                                    <input type="number" class="terrain-input" id="terrain-height" 
                                        value="${this.terrainSettings.height}">
                                </div>
                                <div class="terrain-input-group">
                                    <label>Resolution</label>
                                    <select class="terrain-select" id="terrain-resolution">
                                        <option value="129">129×129</option>
                                        <option value="257">257×257</option>
                                        <option value="513" selected>513×513</option>
                                        <option value="1025">1025×1025</option>
                                        <option value="2049">2049×2049</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                        
                        <div class="terrain-section">
                            <div class="terrain-section-header">LOD Settings</div>
                            <div class="terrain-slider-row">
                                <label>
                                    <span>LOD Levels</span>
                                    <span id="lod-levels-val">${this.terrainSettings.lodLevels}</span>
                                </label>
                                <input type="range" class="terrain-slider" id="terrain-lod-levels" 
                                    min="1" max="8" value="${this.terrainSettings.lodLevels}">
                            </div>
                            <div class="terrain-slider-row">
                                <label>
                                    <span>LOD Distance</span>
                                    <span id="lod-distance-val">${this.terrainSettings.lodDistance}m</span>
                                </label>
                                <input type="range" class="terrain-slider" id="terrain-lod-distance" 
                                    min="25" max="500" value="${this.terrainSettings.lodDistance}">
                            </div>
                        </div>
                        
                        <div class="terrain-section">
                            <div class="terrain-section-header">Heightmap</div>
                            <div class="terrain-heightmap-preview" id="heightmap-preview">
                                <canvas id="heightmap-canvas"></canvas>
                            </div>
                            <div class="terrain-btn-group">
                                <button class="terrain-btn" id="btn-import-heightmap">Import</button>
                                <button class="terrain-btn" id="btn-export-heightmap">Export</button>
                                <button class="terrain-btn" id="btn-generate-heightmap">Generate</button>
                            </div>
                        </div>
                        
                        <div class="terrain-section">
                            <div class="terrain-section-header">Procedural Generation</div>
                            <div class="terrain-input-row">
                                <div class="terrain-input-group">
                                    <label>Seed</label>
                                    <input type="number" class="terrain-input" id="terrain-seed" value="12345">
                                </div>
                                <div class="terrain-input-group">
                                    <label>Type</label>
                                    <select class="terrain-select" id="terrain-gen-type">
                                        <option value="perlin">Perlin Noise</option>
                                        <option value="simplex">Simplex Noise</option>
                                        <option value="ridged">Ridged Multifractal</option>
                                        <option value="fbm">FBM</option>
                                        <option value="voronoi">Voronoi</option>
                                    </select>
                                </div>
                            </div>
                            <div class="terrain-slider-row">
                                <label>
                                    <span>Octaves</span>
                                    <span id="gen-octaves-val">6</span>
                                </label>
                                <input type="range" class="terrain-slider" id="terrain-octaves" 
                                    min="1" max="12" value="6">
                            </div>
                            <div class="terrain-slider-row">
                                <label>
                                    <span>Frequency</span>
                                    <span id="gen-freq-val">0.01</span>
                                </label>
                                <input type="range" class="terrain-slider" id="terrain-frequency" 
                                    min="1" max="100" value="10">
                            </div>
                            <div class="terrain-slider-row">
                                <label>
                                    <span>Amplitude</span>
                                    <span id="gen-amp-val">1.0</span>
                                </label>
                                <input type="range" class="terrain-slider" id="terrain-amplitude" 
                                    min="1" max="200" value="100">
                            </div>
                            <button class="terrain-btn primary" id="btn-generate-terrain" style="width: 100%; margin-top: 10px;">
                                Generate Terrain
                            </button>
                        </div>
                        
                        <div class="terrain-section">
                            <div class="terrain-section-header">Actions</div>
                            <div class="terrain-btn-group">
                                <button class="terrain-btn primary" id="btn-apply-settings">Apply Changes</button>
                                <button class="terrain-btn" id="btn-reset-terrain">Reset to Flat</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    private renderLayers(): string {
        return this.layers.map((layer, i) => `
            <div class="terrain-layer-item ${i === this.selectedLayer ? 'selected' : ''}" data-layer="${i}">
                <div class="terrain-layer-preview" style="background: linear-gradient(45deg, #555 25%, #333 25%, #333 50%, #555 50%, #555 75%, #333 75%); background-size: 8px 8px;"></div>
                <div class="terrain-layer-info">
                    <div class="terrain-layer-name">${layer.name}</div>
                    <div class="terrain-layer-meta">Slope: ${layer.slopeMin}°-${layer.slopeMax}° | Height: ${(layer.heightMin * 100).toFixed(0)}-${(layer.heightMax * 100).toFixed(0)}%</div>
                </div>
            </div>
        `).join('');
    }
    
    private renderFoliageTypes(): string {
        const icons: Record<string, string> = {
            tree_oak: '🌳',
            tree_pine: '🌲',
            grass_clump: '🌿',
            rock_small: '🪨',
            flower: '🌸'
        };
        
        return this.foliageTypes.map((foliage, i) => `
            <div class="terrain-foliage-item ${i === this.selectedFoliage ? 'selected' : ''}" data-foliage="${i}">
                <div class="terrain-foliage-icon">${icons[foliage.id] || '🌱'}</div>
                <div class="terrain-foliage-name">${foliage.name}</div>
            </div>
        `).join('');
    }
    
    private setupEventListeners(container: HTMLElement): void {
        // Tab switching
        container.querySelectorAll('.terrain-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const tabName = (tab as HTMLElement).dataset.tab;
                container.querySelectorAll('.terrain-tab').forEach(t => t.classList.remove('active'));
                container.querySelectorAll('.terrain-tab-content').forEach(c => c.classList.remove('active'));
                tab.classList.add('active');
                container.querySelector(`#tab-${tabName}`)?.classList.add('active');
            });
        });
        
        // Tool selection
        container.querySelectorAll('.terrain-tool').forEach(tool => {
            tool.addEventListener('click', () => {
                const toolName = (tool as HTMLElement).dataset.tool as TerrainToolType;
                this.currentTool = toolName;
                
                // Update active state within same tools group
                const parent = tool.parentElement;
                parent?.querySelectorAll('.terrain-tool').forEach(t => t.classList.remove('active'));
                tool.classList.add('active');
                
                this.events.emit('toolChanged', { tool: this.currentTool });
            });
        });
        
        // Brush sliders
        const brushSizeSlider = container.querySelector('#brush-size') as HTMLInputElement;
        const brushStrengthSlider = container.querySelector('#brush-strength') as HTMLInputElement;
        const brushFalloffSlider = container.querySelector('#brush-falloff') as HTMLInputElement;
        
        brushSizeSlider?.addEventListener('input', () => {
            this.brush.size = parseInt(brushSizeSlider.value);
            container.querySelector('#brush-size-val')!.textContent = brushSizeSlider.value;
            this.updateBrushPreview();
        });
        
        brushStrengthSlider?.addEventListener('input', () => {
            this.brush.strength = parseInt(brushStrengthSlider.value) / 100;
            container.querySelector('#brush-strength-val')!.textContent = `${brushStrengthSlider.value}%`;
        });
        
        brushFalloffSlider?.addEventListener('input', () => {
            this.brush.falloff = parseInt(brushFalloffSlider.value) / 100;
            container.querySelector('#brush-falloff-val')!.textContent = `${brushFalloffSlider.value}%`;
            this.updateBrushPreview();
        });
        
        // Brush shape
        const brushShapeSelect = container.querySelector('#brush-shape') as HTMLSelectElement;
        brushShapeSelect?.addEventListener('change', () => {
            this.brush.shape = brushShapeSelect.value as EditorTerrainBrushShape;
            this.updateBrushPreview();
        });
        
        // Layer selection
        container.querySelector('#layer-list')?.addEventListener('click', (e) => {
            const item = (e.target as HTMLElement).closest('.terrain-layer-item');
            if (item) {
                this.selectedLayer = parseInt((item as HTMLElement).dataset.layer || '0');
                container.querySelectorAll('.terrain-layer-item').forEach(l => l.classList.remove('selected'));
                item.classList.add('selected');
                (container.querySelector('#layer-properties') as HTMLElement).style.display = 'block';
                this.updateLayerProperties(container);
            }
        });
        
        // Foliage selection
        container.querySelector('#foliage-list')?.addEventListener('click', (e) => {
            const item = (e.target as HTMLElement).closest('.terrain-foliage-item');
            if (item) {
                const idx = parseInt((item as HTMLElement).dataset.foliage || '-1');
                if (this.selectedFoliage === idx) {
                    this.selectedFoliage = -1;
                    item.classList.remove('selected');
                    (container.querySelector('#foliage-properties') as HTMLElement).style.display = 'none';
                } else {
                    this.selectedFoliage = idx;
                    container.querySelectorAll('.terrain-foliage-item').forEach(f => f.classList.remove('selected'));
                    item.classList.add('selected');
                    (container.querySelector('#foliage-properties') as HTMLElement).style.display = 'block';
                    this.updateFoliageProperties(container);
                }
            }
        });
        
        // Erosion sliders
        container.querySelector('#erosion-iterations')?.addEventListener('input', (e) => {
            const val = (e.target as HTMLInputElement).value;
            container.querySelector('#erosion-iter-val')!.textContent = val;
        });
        
        container.querySelector('#erosion-inertia')?.addEventListener('input', (e) => {
            const val = parseInt((e.target as HTMLInputElement).value) / 100;
            container.querySelector('#erosion-inertia-val')!.textContent = val.toFixed(2);
        });
        
        container.querySelector('#erosion-sediment')?.addEventListener('input', (e) => {
            const val = (e.target as HTMLInputElement).value;
            container.querySelector('#erosion-sediment-val')!.textContent = val;
        });
        
        // LOD sliders
        container.querySelector('#terrain-lod-levels')?.addEventListener('input', (e) => {
            const val = (e.target as HTMLInputElement).value;
            container.querySelector('#lod-levels-val')!.textContent = val;
            this.terrainSettings.lodLevels = parseInt(val);
        });
        
        container.querySelector('#terrain-lod-distance')?.addEventListener('input', (e) => {
            const val = (e.target as HTMLInputElement).value;
            container.querySelector('#lod-distance-val')!.textContent = `${val}m`;
            this.terrainSettings.lodDistance = parseInt(val);
        });
        
        // Procedural generation sliders
        container.querySelector('#terrain-octaves')?.addEventListener('input', (e) => {
            container.querySelector('#gen-octaves-val')!.textContent = (e.target as HTMLInputElement).value;
        });
        
        container.querySelector('#terrain-frequency')?.addEventListener('input', (e) => {
            const val = parseInt((e.target as HTMLInputElement).value) / 1000;
            container.querySelector('#gen-freq-val')!.textContent = val.toFixed(3);
        });
        
        container.querySelector('#terrain-amplitude')?.addEventListener('input', (e) => {
            const val = parseInt((e.target as HTMLInputElement).value) / 100;
            container.querySelector('#gen-amp-val')!.textContent = val.toFixed(1);
        });
        
        // Action buttons
        container.querySelector('#btn-erode')?.addEventListener('click', () => {
            this.events.emit('erode', { 
                type: 'hydraulic',
                iterations: parseInt((container.querySelector('#erosion-iterations') as HTMLInputElement).value)
            });
        });
        
        container.querySelector('#btn-thermal')?.addEventListener('click', () => {
            this.events.emit('erode', { type: 'thermal' });
        });
        
        container.querySelector('#btn-generate-terrain')?.addEventListener('click', () => {
            this.events.emit('generate', {
                type: (container.querySelector('#terrain-gen-type') as HTMLSelectElement).value,
                seed: parseInt((container.querySelector('#terrain-seed') as HTMLInputElement).value),
                octaves: parseInt((container.querySelector('#terrain-octaves') as HTMLInputElement).value),
                frequency: parseInt((container.querySelector('#terrain-frequency') as HTMLInputElement).value) / 1000,
                amplitude: parseInt((container.querySelector('#terrain-amplitude') as HTMLInputElement).value) / 100
            });
        });
        
        container.querySelector('#btn-reset-terrain')?.addEventListener('click', () => {
            this.events.emit('reset');
        });
        
        container.querySelector('#btn-auto-paint')?.addEventListener('click', () => {
            this.events.emit('autoPaint', { layers: this.layers });
        });
        
        container.querySelector('#btn-distribute-foliage')?.addEventListener('click', () => {
            this.events.emit('distributeFoliage', { foliageTypes: this.foliageTypes });
        });
        
        container.querySelector('#btn-clear-foliage')?.addEventListener('click', () => {
            this.events.emit('clearFoliage');
        });
        
        container.querySelector('#btn-import-heightmap')?.addEventListener('click', () => {
            this.importHeightmap();
        });
        
        container.querySelector('#btn-export-heightmap')?.addEventListener('click', () => {
            this.events.emit('exportHeightmap');
        });
    }
    
    private createBrushPreview(container: HTMLElement): void {
        this.previewCanvas = container.querySelector('#brush-preview') as HTMLCanvasElement;
        if (!this.previewCanvas) return;
        
        this.previewCanvas.width = this.previewCanvas.clientWidth * window.devicePixelRatio;
        this.previewCanvas.height = this.previewCanvas.clientHeight * window.devicePixelRatio;
        this.previewCtx = this.previewCanvas.getContext('2d');
        
        this.updateBrushPreview();
    }
    
    private updateBrushPreview(): void {
        if (!this.previewCtx || !this.previewCanvas) return;
        
        const ctx = this.previewCtx;
        const w = this.previewCanvas.width;
        const h = this.previewCanvas.height;
        
        ctx.fillStyle = '#1e1e1e';
        ctx.fillRect(0, 0, w, h);
        
        const centerX = w / 2;
        const centerY = h / 2;
        const maxRadius = Math.min(w, h) * 0.4;
        const radius = Math.min(this.brush.size / 200 * maxRadius, maxRadius);
        
        // Draw brush preview
        if (this.brush.shape === 'circle') {
            const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
            gradient.addColorStop(0, `rgba(0, 122, 204, ${this.brush.strength})`);
            gradient.addColorStop(1 - this.brush.falloff, `rgba(0, 122, 204, ${this.brush.strength * 0.5})`);
            gradient.addColorStop(1, 'rgba(0, 122, 204, 0)');
            
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
            ctx.fill();
        } else if (this.brush.shape === 'square') {
            ctx.save();
            ctx.translate(centerX, centerY);
            ctx.rotate(this.brush.rotation * Math.PI / 180);
            
            const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, radius * 1.4);
            gradient.addColorStop(0, `rgba(0, 122, 204, ${this.brush.strength})`);
            gradient.addColorStop(1 - this.brush.falloff, `rgba(0, 122, 204, ${this.brush.strength * 0.5})`);
            gradient.addColorStop(1, 'rgba(0, 122, 204, 0)');
            
            ctx.fillStyle = gradient;
            ctx.fillRect(-radius, -radius, radius * 2, radius * 2);
            ctx.restore();
        } else if (this.brush.shape === 'noise') {
            const imageData = ctx.createImageData(w, h);
            const data = imageData.data;
            
            for (let y = 0; y < h; y++) {
                for (let x = 0; x < w; x++) {
                    const dx = x - centerX;
                    const dy = y - centerY;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    
                    if (dist < radius) {
                        const falloffFactor = 1 - Math.pow(dist / radius, 2 / (1 - this.brush.falloff + 0.01));
                        const noise = Math.random();
                        const alpha = this.brush.strength * falloffFactor * noise * 255;
                        
                        const i = (y * w + x) * 4;
                        data[i] = 0;
                        data[i + 1] = 122;
                        data[i + 2] = 204;
                        data[i + 3] = alpha;
                    }
                }
            }
            
            ctx.putImageData(imageData, 0, 0);
        }
        
        // Draw circle outline
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
    }
    
    private updateUI(_container: HTMLElement): void {
        // Update any dynamic UI elements
    }
    
    private updateLayerProperties(_container: HTMLElement): void {
        if (!this.container) return;
        const layer = this.layers[this.selectedLayer];
        if (!layer) return;
        
        (this.container.querySelector('#layer-tiling-x') as HTMLInputElement).value = layer.tiling.x.toString();
        (this.container.querySelector('#layer-tiling-y') as HTMLInputElement).value = layer.tiling.y.toString();
        (this.container.querySelector('#layer-roughness') as HTMLInputElement).value = (layer.roughness * 100).toString();
        this.container.querySelector('#layer-rough-val')!.textContent = layer.roughness.toFixed(2);
        (this.container.querySelector('#layer-slope-min') as HTMLInputElement).value = layer.slopeMin.toString();
        (this.container.querySelector('#layer-slope-max') as HTMLInputElement).value = layer.slopeMax.toString();
        (this.container.querySelector('#layer-height-min') as HTMLInputElement).value = layer.heightMin.toString();
        (this.container.querySelector('#layer-height-max') as HTMLInputElement).value = layer.heightMax.toString();
    }
    
    private updateFoliageProperties(_container: HTMLElement): void {
        if (!this.container) return;
        const foliage = this.foliageTypes[this.selectedFoliage];
        if (!foliage) return;
        
        (this.container.querySelector('#foliage-density') as HTMLInputElement).value = (foliage.density * 100).toString();
        this.container.querySelector('#foliage-density-val')!.textContent = `${Math.round(foliage.density * 100)}%`;
        (this.container.querySelector('#foliage-min-scale') as HTMLInputElement).value = foliage.minScale.toString();
        (this.container.querySelector('#foliage-max-scale') as HTMLInputElement).value = foliage.maxScale.toString();
        (this.container.querySelector('#foliage-align-normal') as HTMLInputElement).checked = foliage.alignToNormal;
        (this.container.querySelector('#foliage-random-rotation') as HTMLInputElement).checked = foliage.randomRotation;
        (this.container.querySelector('#foliage-slope-min') as HTMLInputElement).value = foliage.slopeMin.toString();
        (this.container.querySelector('#foliage-slope-max') as HTMLInputElement).value = foliage.slopeMax.toString();
    }
    
    private importHeightmap(): void {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*,.raw,.r16,.r32';
        input.onchange = (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (file) {
                this.events.emit('importHeightmap', { file });
            }
        };
        input.click();
    }
    
    // Public API
    getCurrentTool(): TerrainToolType {
        return this.currentTool;
    }
    
    getBrush(): EditorTerrainBrush {
        return { ...this.brush };
    }
    
    getLayers(): EditorTerrainLayer[] {
        return [...this.layers];
    }
    
    getSelectedLayer(): EditorTerrainLayer | null {
        return this.layers[this.selectedLayer] || null;
    }
    
    getFoliageTypes(): FoliageType[] {
        return [...this.foliageTypes];
    }
    
    getSelectedFoliage(): FoliageType | null {
        return this.selectedFoliage >= 0 ? this.foliageTypes[this.selectedFoliage] : null;
    }
    
    getTerrainSettings(): TerrainSettings {
        return { ...this.terrainSettings };
    }
    
    setFoliageCount(count: number): void {
        const el = this.container?.querySelector('#foliage-count');
        if (el) el.textContent = count.toLocaleString();
    }
}
