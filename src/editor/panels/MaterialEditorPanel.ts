/**
 * @fileoverview Material Editor Panel - PBR Material Editing Interface
 * @module editor/panels
 * 
 * Provides a visual interface for creating and editing PBR materials.
 * Supports real-time preview and integration with the rendering system.
 * 
 * @author MrNova420
 * @license MIT
 */

import { Panel } from '../Panel';
import { Logger } from '../../core/Logger';

/**
 * Material property types
 */
export enum MaterialPropertyType {
    COLOR = 'color',
    FLOAT = 'float',
    TEXTURE = 'texture',
    VECTOR2 = 'vector2',
    VECTOR3 = 'vector3',
    BOOL = 'bool'
}

/**
 * Material texture slot
 */
export interface TextureSlot {
    name: string;
    label: string;
    description: string;
    texture: string | null;
    default: string; // Default color as hex
}

/**
 * Material definition
 */
export interface MaterialData {
    name: string;
    shader: string;
    
    // PBR properties
    baseColor: [number, number, number, number];
    metallic: number;
    roughness: number;
    emissive: [number, number, number];
    emissiveIntensity: number;
    
    // Advanced
    normalScale: number;
    occlusionStrength: number;
    clearcoat: number;
    clearcoatRoughness: number;
    subsurface: number;
    subsurfaceColor: [number, number, number];
    anisotropy: number;
    anisotropyRotation: number;
    
    // Textures
    baseColorMap: string | null;
    metallicMap: string | null;
    roughnessMap: string | null;
    normalMap: string | null;
    emissiveMap: string | null;
    occlusionMap: string | null;
    
    // Rendering
    doubleSided: boolean;
    alphaMode: 'opaque' | 'blend' | 'mask';
    alphaCutoff: number;
}

/**
 * Material preset
 */
export interface MaterialPreset {
    name: string;
    category: string;
    icon: string;
    data: Partial<MaterialData>;
}

/**
 * Material Editor Panel
 * 
 * Full-featured PBR material editor with real-time preview.
 */
export class MaterialEditorPanel extends Panel {
    private logger: Logger;
    
    // Current material
    private material: MaterialData;
    private isDirty: boolean = false;
    
    // Preview canvas
    private previewCanvas: HTMLCanvasElement | null = null;
    private previewCtx: CanvasRenderingContext2D | null = null;
    
    // Material presets
    private presets: MaterialPreset[] = [];
    
    constructor() {
        super('material-editor', 'Material Editor');
        this.logger = new Logger('MaterialEditorPanel');
        this.material = this.createDefaultMaterial();
        this.initializePresets();
    }
    
    /**
     * Create default material
     */
    private createDefaultMaterial(): MaterialData {
        return {
            name: 'New Material',
            shader: 'pbr',
            baseColor: [0.8, 0.8, 0.8, 1.0],
            metallic: 0.0,
            roughness: 0.5,
            emissive: [0, 0, 0],
            emissiveIntensity: 0,
            normalScale: 1.0,
            occlusionStrength: 1.0,
            clearcoat: 0,
            clearcoatRoughness: 0,
            subsurface: 0,
            subsurfaceColor: [1, 0.2, 0.1],
            anisotropy: 0,
            anisotropyRotation: 0,
            baseColorMap: null,
            metallicMap: null,
            roughnessMap: null,
            normalMap: null,
            emissiveMap: null,
            occlusionMap: null,
            doubleSided: false,
            alphaMode: 'opaque',
            alphaCutoff: 0.5
        };
    }
    
    /**
     * Initialize material presets
     */
    private initializePresets(): void {
        this.presets = [
            // Metals
            {
                name: 'Gold',
                category: 'Metals',
                icon: '🥇',
                data: {
                    baseColor: [1.0, 0.766, 0.336, 1.0],
                    metallic: 1.0,
                    roughness: 0.3
                }
            },
            {
                name: 'Silver',
                category: 'Metals',
                icon: '🥈',
                data: {
                    baseColor: [0.972, 0.960, 0.915, 1.0],
                    metallic: 1.0,
                    roughness: 0.2
                }
            },
            {
                name: 'Copper',
                category: 'Metals',
                icon: '🟠',
                data: {
                    baseColor: [0.955, 0.637, 0.538, 1.0],
                    metallic: 1.0,
                    roughness: 0.4
                }
            },
            {
                name: 'Brushed Steel',
                category: 'Metals',
                icon: '⬜',
                data: {
                    baseColor: [0.56, 0.57, 0.58, 1.0],
                    metallic: 1.0,
                    roughness: 0.5,
                    anisotropy: 0.8
                }
            },
            {
                name: 'Chrome',
                category: 'Metals',
                icon: '⚪',
                data: {
                    baseColor: [0.549, 0.556, 0.554, 1.0],
                    metallic: 1.0,
                    roughness: 0.05
                }
            },
            
            // Non-metals
            {
                name: 'Plastic (White)',
                category: 'Plastics',
                icon: '🔲',
                data: {
                    baseColor: [0.95, 0.95, 0.95, 1.0],
                    metallic: 0.0,
                    roughness: 0.3
                }
            },
            {
                name: 'Rubber',
                category: 'Plastics',
                icon: '⬛',
                data: {
                    baseColor: [0.1, 0.1, 0.1, 1.0],
                    metallic: 0.0,
                    roughness: 0.9
                }
            },
            {
                name: 'Glass',
                category: 'Transparent',
                icon: '🔷',
                data: {
                    baseColor: [1.0, 1.0, 1.0, 0.1],
                    metallic: 0.0,
                    roughness: 0.0,
                    alphaMode: 'blend'
                }
            },
            
            // Natural
            {
                name: 'Wood (Oak)',
                category: 'Natural',
                icon: '🪵',
                data: {
                    baseColor: [0.6, 0.4, 0.2, 1.0],
                    metallic: 0.0,
                    roughness: 0.7
                }
            },
            {
                name: 'Marble',
                category: 'Natural',
                icon: '🪨',
                data: {
                    baseColor: [0.95, 0.93, 0.88, 1.0],
                    metallic: 0.0,
                    roughness: 0.2
                }
            },
            {
                name: 'Concrete',
                category: 'Natural',
                icon: '🧱',
                data: {
                    baseColor: [0.5, 0.5, 0.5, 1.0],
                    metallic: 0.0,
                    roughness: 0.95
                }
            },
            
            // Fabric
            {
                name: 'Cotton',
                category: 'Fabric',
                icon: '🧵',
                data: {
                    baseColor: [0.85, 0.85, 0.85, 1.0],
                    metallic: 0.0,
                    roughness: 0.9,
                    subsurface: 0.3
                }
            },
            {
                name: 'Velvet',
                category: 'Fabric',
                icon: '🟪',
                data: {
                    baseColor: [0.4, 0.1, 0.3, 1.0],
                    metallic: 0.0,
                    roughness: 0.8,
                    subsurface: 0.5
                }
            },
            
            // Special
            {
                name: 'Car Paint (Red)',
                category: 'Special',
                icon: '🚗',
                data: {
                    baseColor: [0.8, 0.1, 0.1, 1.0],
                    metallic: 0.3,
                    roughness: 0.2,
                    clearcoat: 1.0,
                    clearcoatRoughness: 0.1
                }
            },
            {
                name: 'Emissive',
                category: 'Special',
                icon: '💡',
                data: {
                    baseColor: [0.0, 0.0, 0.0, 1.0],
                    metallic: 0.0,
                    roughness: 1.0,
                    emissive: [1.0, 0.8, 0.2],
                    emissiveIntensity: 5.0
                }
            },
            {
                name: 'Skin',
                category: 'Special',
                icon: '🖐️',
                data: {
                    baseColor: [0.91, 0.75, 0.65, 1.0],
                    metallic: 0.0,
                    roughness: 0.5,
                    subsurface: 0.6,
                    subsurfaceColor: [0.8, 0.2, 0.1]
                }
            }
        ];
    }
    
    /**
     * Render the panel content
     */
    protected onMount(_container: HTMLElement): void {
        if (!this.container) return;
        
        this.container.innerHTML = `
            <div class="mat-container">
                <div class="mat-toolbar">
                    <button class="mat-btn" id="mat-new" title="New Material">📄 New</button>
                    <button class="mat-btn" id="mat-save" title="Save Material">💾 Save</button>
                    <button class="mat-btn" id="mat-load" title="Load Material">📂 Load</button>
                    <div class="mat-spacer"></div>
                    <input type="text" class="mat-name-input" id="mat-name" value="${this.material.name}">
                </div>
                
                <div class="mat-content">
                    <div class="mat-preview-section">
                        <canvas id="mat-preview" width="200" height="200"></canvas>
                        <div class="mat-preview-controls">
                            <button class="mat-preview-btn active" data-shape="sphere">⚫</button>
                            <button class="mat-preview-btn" data-shape="cube">◼</button>
                            <button class="mat-preview-btn" data-shape="plane">▬</button>
                        </div>
                    </div>
                    
                    <div class="mat-properties">
                        <div class="mat-presets-bar">
                            <select id="mat-preset-select">
                                <option value="">-- Apply Preset --</option>
                                ${this.generatePresetOptions()}
                            </select>
                        </div>
                        
                        <div class="mat-section" id="section-base">
                            <div class="mat-section-header">
                                <span>Base Properties</span>
                                <span class="mat-collapse-btn">▼</span>
                            </div>
                            <div class="mat-section-content">
                                ${this.renderColorProperty('baseColor', 'Base Color', this.material.baseColor)}
                                ${this.renderSliderProperty('metallic', 'Metallic', this.material.metallic, 0, 1)}
                                ${this.renderSliderProperty('roughness', 'Roughness', this.material.roughness, 0, 1)}
                            </div>
                        </div>
                        
                        <div class="mat-section" id="section-emission">
                            <div class="mat-section-header">
                                <span>Emission</span>
                                <span class="mat-collapse-btn">▼</span>
                            </div>
                            <div class="mat-section-content">
                                ${this.renderColorProperty('emissive', 'Emissive Color', [...this.material.emissive, 1])}
                                ${this.renderSliderProperty('emissiveIntensity', 'Intensity', this.material.emissiveIntensity, 0, 10)}
                            </div>
                        </div>
                        
                        <div class="mat-section" id="section-advanced">
                            <div class="mat-section-header">
                                <span>Advanced</span>
                                <span class="mat-collapse-btn">▼</span>
                            </div>
                            <div class="mat-section-content">
                                ${this.renderSliderProperty('normalScale', 'Normal Scale', this.material.normalScale, 0, 2)}
                                ${this.renderSliderProperty('occlusionStrength', 'AO Strength', this.material.occlusionStrength, 0, 1)}
                                ${this.renderSliderProperty('clearcoat', 'Clearcoat', this.material.clearcoat, 0, 1)}
                                ${this.renderSliderProperty('clearcoatRoughness', 'Clearcoat Roughness', this.material.clearcoatRoughness, 0, 1)}
                            </div>
                        </div>
                        
                        <div class="mat-section" id="section-subsurface">
                            <div class="mat-section-header">
                                <span>Subsurface Scattering</span>
                                <span class="mat-collapse-btn">▼</span>
                            </div>
                            <div class="mat-section-content">
                                ${this.renderSliderProperty('subsurface', 'Subsurface', this.material.subsurface, 0, 1)}
                                ${this.renderColorProperty('subsurfaceColor', 'SSS Color', [...this.material.subsurfaceColor, 1])}
                            </div>
                        </div>
                        
                        <div class="mat-section" id="section-anisotropy">
                            <div class="mat-section-header">
                                <span>Anisotropy</span>
                                <span class="mat-collapse-btn">▼</span>
                            </div>
                            <div class="mat-section-content">
                                ${this.renderSliderProperty('anisotropy', 'Anisotropy', this.material.anisotropy, 0, 1)}
                                ${this.renderSliderProperty('anisotropyRotation', 'Rotation', this.material.anisotropyRotation, 0, 1)}
                            </div>
                        </div>
                        
                        <div class="mat-section" id="section-textures">
                            <div class="mat-section-header">
                                <span>Textures</span>
                                <span class="mat-collapse-btn">▼</span>
                            </div>
                            <div class="mat-section-content">
                                ${this.renderTextureSlot('baseColorMap', 'Albedo/Base Color')}
                                ${this.renderTextureSlot('metallicMap', 'Metallic')}
                                ${this.renderTextureSlot('roughnessMap', 'Roughness')}
                                ${this.renderTextureSlot('normalMap', 'Normal')}
                                ${this.renderTextureSlot('emissiveMap', 'Emissive')}
                                ${this.renderTextureSlot('occlusionMap', 'Ambient Occlusion')}
                            </div>
                        </div>
                        
                        <div class="mat-section" id="section-rendering">
                            <div class="mat-section-header">
                                <span>Rendering</span>
                                <span class="mat-collapse-btn">▼</span>
                            </div>
                            <div class="mat-section-content">
                                ${this.renderCheckboxProperty('doubleSided', 'Double Sided', this.material.doubleSided)}
                                ${this.renderSelectProperty('alphaMode', 'Alpha Mode', this.material.alphaMode, [
                                    { value: 'opaque', label: 'Opaque' },
                                    { value: 'blend', label: 'Blend' },
                                    { value: 'mask', label: 'Mask' }
                                ])}
                                ${this.renderSliderProperty('alphaCutoff', 'Alpha Cutoff', this.material.alphaCutoff, 0, 1)}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        this.setupStyles();
        this.setupPreviewCanvas();
        this.setupEvents();
        this.renderPreview();
    }
    
    /**
     * Generate preset dropdown options
     */
    private generatePresetOptions(): string {
        const categories = new Map<string, MaterialPreset[]>();
        
        for (const preset of this.presets) {
            if (!categories.has(preset.category)) {
                categories.set(preset.category, []);
            }
            categories.get(preset.category)!.push(preset);
        }
        
        let html = '';
        for (const [category, presets] of categories) {
            html += `<optgroup label="${category}">`;
            for (const preset of presets) {
                html += `<option value="${preset.name}">${preset.icon} ${preset.name}</option>`;
            }
            html += '</optgroup>';
        }
        return html;
    }
    
    /**
     * Render a color property control
     */
    private renderColorProperty(id: string, label: string, value: number[]): string {
        const hex = this.rgbToHex(value[0], value[1], value[2]);
        return `
            <div class="mat-property">
                <label>${label}</label>
                <div class="mat-color-control">
                    <input type="color" id="prop-${id}" value="${hex}" data-prop="${id}">
                    <input type="number" class="mat-alpha" value="${Math.round((value[3] || 1) * 100)}" min="0" max="100" data-prop="${id}-alpha">%
                </div>
            </div>
        `;
    }
    
    /**
     * Render a slider property control
     */
    private renderSliderProperty(id: string, label: string, value: number, min: number, max: number): string {
        const step = max <= 1 ? 0.01 : 0.1;
        return `
            <div class="mat-property">
                <label>${label}</label>
                <div class="mat-slider-control">
                    <input type="range" id="prop-${id}" value="${value}" min="${min}" max="${max}" step="${step}" data-prop="${id}">
                    <input type="number" class="mat-value" value="${value}" min="${min}" max="${max}" step="${step}" data-prop="${id}-num">
                </div>
            </div>
        `;
    }
    
    /**
     * Render a texture slot control
     */
    private renderTextureSlot(id: string, label: string): string {
        const texture = (this.material as any)[id];
        return `
            <div class="mat-property mat-texture-slot">
                <label>${label}</label>
                <div class="mat-texture-control">
                    <div class="mat-texture-preview" data-texture="${id}">
                        ${texture ? `<img src="${texture}" alt="${label}">` : '<span class="mat-no-texture">No Texture</span>'}
                    </div>
                    <div class="mat-texture-buttons">
                        <button class="mat-tex-btn" data-action="load" data-texture="${id}" title="Load Texture">📂</button>
                        <button class="mat-tex-btn" data-action="clear" data-texture="${id}" title="Clear">✗</button>
                    </div>
                </div>
            </div>
        `;
    }
    
    /**
     * Render a checkbox property
     */
    private renderCheckboxProperty(id: string, label: string, value: boolean): string {
        return `
            <div class="mat-property mat-checkbox">
                <label>
                    <input type="checkbox" id="prop-${id}" ${value ? 'checked' : ''} data-prop="${id}">
                    ${label}
                </label>
            </div>
        `;
    }
    
    /**
     * Render a select property
     */
    private renderSelectProperty(id: string, label: string, value: string, options: { value: string; label: string }[]): string {
        return `
            <div class="mat-property">
                <label>${label}</label>
                <select id="prop-${id}" data-prop="${id}">
                    ${options.map(opt => 
                        `<option value="${opt.value}" ${opt.value === value ? 'selected' : ''}>${opt.label}</option>`
                    ).join('')}
                </select>
            </div>
        `;
    }
    
    /**
     * Setup CSS styles
     */
    private setupStyles(): void {
        if (!this.container) return;
        
        const style = document.createElement('style');
        style.textContent = `
            .mat-container {
                display: flex;
                flex-direction: column;
                height: 100%;
                background: #1e1e2e;
                color: #ffffff;
            }
            .mat-toolbar {
                display: flex;
                align-items: center;
                padding: 6px 10px;
                background: #252538;
                border-bottom: 1px solid #3a3a5a;
                gap: 6px;
            }
            .mat-btn {
                padding: 4px 10px;
                background: #3a3a5a;
                border: 1px solid #4a4a6a;
                border-radius: 4px;
                color: #ffffff;
                cursor: pointer;
                font-size: 12px;
            }
            .mat-btn:hover { background: #4a4a6a; }
            .mat-spacer { flex: 1; }
            .mat-name-input {
                padding: 4px 8px;
                background: #2a2a4a;
                border: 1px solid #3a3a5a;
                border-radius: 4px;
                color: #ffffff;
                font-size: 13px;
                width: 150px;
            }
            .mat-content {
                display: flex;
                flex: 1;
                overflow: hidden;
            }
            .mat-preview-section {
                width: 220px;
                padding: 10px;
                background: #1a1a2e;
                border-right: 1px solid #3a3a5a;
                display: flex;
                flex-direction: column;
                align-items: center;
            }
            #mat-preview {
                background: #101020;
                border-radius: 4px;
                margin-bottom: 10px;
            }
            .mat-preview-controls {
                display: flex;
                gap: 4px;
            }
            .mat-preview-btn {
                width: 32px;
                height: 32px;
                background: #2a2a4a;
                border: 1px solid #3a3a5a;
                border-radius: 4px;
                cursor: pointer;
                font-size: 16px;
            }
            .mat-preview-btn:hover { background: #3a3a5a; }
            .mat-preview-btn.active { background: #4a4a8a; border-color: #6a6aaa; }
            .mat-properties {
                flex: 1;
                overflow-y: auto;
                padding: 10px;
            }
            .mat-presets-bar {
                margin-bottom: 10px;
            }
            .mat-presets-bar select {
                width: 100%;
                padding: 6px;
                background: #2a2a4a;
                border: 1px solid #3a3a5a;
                border-radius: 4px;
                color: #ffffff;
            }
            .mat-section {
                margin-bottom: 10px;
                background: #252538;
                border-radius: 4px;
                overflow: hidden;
            }
            .mat-section-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 8px 12px;
                background: #2a2a4a;
                cursor: pointer;
                font-weight: bold;
                font-size: 12px;
            }
            .mat-section-header:hover { background: #3a3a5a; }
            .mat-section.collapsed .mat-section-content { display: none; }
            .mat-section.collapsed .mat-collapse-btn { transform: rotate(-90deg); }
            .mat-section-content {
                padding: 10px;
            }
            .mat-property {
                display: flex;
                align-items: center;
                margin-bottom: 8px;
            }
            .mat-property label {
                width: 110px;
                font-size: 11px;
                color: #aaaacc;
            }
            .mat-property input[type="color"] {
                width: 50px;
                height: 24px;
                border: none;
                border-radius: 4px;
                cursor: pointer;
            }
            .mat-color-control {
                display: flex;
                align-items: center;
                gap: 6px;
            }
            .mat-alpha {
                width: 50px;
                padding: 2px 4px;
                background: #2a2a4a;
                border: 1px solid #3a3a5a;
                border-radius: 4px;
                color: #ffffff;
                font-size: 11px;
            }
            .mat-slider-control {
                display: flex;
                align-items: center;
                gap: 8px;
                flex: 1;
            }
            .mat-slider-control input[type="range"] {
                flex: 1;
                accent-color: #6a6aaa;
            }
            .mat-value {
                width: 50px;
                padding: 2px 4px;
                background: #2a2a4a;
                border: 1px solid #3a3a5a;
                border-radius: 4px;
                color: #ffffff;
                font-size: 11px;
            }
            .mat-texture-slot {
                flex-direction: column;
                align-items: flex-start;
            }
            .mat-texture-control {
                display: flex;
                align-items: center;
                gap: 8px;
                width: 100%;
            }
            .mat-texture-preview {
                width: 64px;
                height: 64px;
                background: #1a1a2e;
                border: 1px solid #3a3a5a;
                border-radius: 4px;
                display: flex;
                align-items: center;
                justify-content: center;
                overflow: hidden;
            }
            .mat-texture-preview img {
                max-width: 100%;
                max-height: 100%;
            }
            .mat-no-texture {
                font-size: 9px;
                color: #666688;
                text-align: center;
            }
            .mat-texture-buttons {
                display: flex;
                flex-direction: column;
                gap: 4px;
            }
            .mat-tex-btn {
                width: 28px;
                height: 28px;
                background: #2a2a4a;
                border: 1px solid #3a3a5a;
                border-radius: 4px;
                cursor: pointer;
                font-size: 12px;
            }
            .mat-tex-btn:hover { background: #3a3a5a; }
            .mat-checkbox label {
                display: flex;
                align-items: center;
                gap: 8px;
                cursor: pointer;
            }
            .mat-checkbox input[type="checkbox"] {
                accent-color: #6a6aaa;
            }
            .mat-property select {
                flex: 1;
                padding: 4px 8px;
                background: #2a2a4a;
                border: 1px solid #3a3a5a;
                border-radius: 4px;
                color: #ffffff;
            }
        `;
        this.container.appendChild(style);
    }
    
    /**
     * Setup preview canvas
     */
    private setupPreviewCanvas(): void {
        this.previewCanvas = this.container?.querySelector('#mat-preview') as HTMLCanvasElement;
        if (this.previewCanvas) {
            this.previewCtx = this.previewCanvas.getContext('2d');
        }
    }
    
    /**
     * Setup event handlers
     */
    private setupEvents(): void {
        if (!this.container) return;
        
        // Section collapsing
        this.container.querySelectorAll('.mat-section-header').forEach(header => {
            header.addEventListener('click', () => {
                header.parentElement?.classList.toggle('collapsed');
            });
        });
        
        // Toolbar buttons
        this.container.querySelector('#mat-new')?.addEventListener('click', () => {
            this.material = this.createDefaultMaterial();
            this.onMount(this.container!);
        });
        
        this.container.querySelector('#mat-save')?.addEventListener('click', () => {
            this.saveMaterial();
        });
        
        this.container.querySelector('#mat-load')?.addEventListener('click', () => {
            this.loadMaterial();
        });
        
        // Material name
        this.container.querySelector('#mat-name')?.addEventListener('change', (e) => {
            this.material.name = (e.target as HTMLInputElement).value;
            this.markDirty();
        });
        
        // Preset selection
        this.container.querySelector('#mat-preset-select')?.addEventListener('change', (e) => {
            const presetName = (e.target as HTMLSelectElement).value;
            if (presetName) {
                this.applyPreset(presetName);
                (e.target as HTMLSelectElement).value = ''; // Reset
            }
        });
        
        // Preview shape buttons
        this.container.querySelectorAll('.mat-preview-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.container?.querySelectorAll('.mat-preview-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.renderPreview();
            });
        });
        
        // Property changes - sliders
        this.container.querySelectorAll('input[type="range"]').forEach(input => {
            input.addEventListener('input', (e) => {
                const prop = (e.target as HTMLInputElement).dataset.prop;
                if (prop) {
                    const value = parseFloat((e.target as HTMLInputElement).value);
                    (this.material as any)[prop] = value;
                    
                    // Sync with number input
                    const numInput = this.container?.querySelector(`input[data-prop="${prop}-num"]`) as HTMLInputElement;
                    if (numInput) numInput.value = value.toString();
                    
                    this.markDirty();
                    this.renderPreview();
                }
            });
        });
        
        // Property changes - number inputs
        this.container.querySelectorAll('.mat-value').forEach(input => {
            input.addEventListener('change', (e) => {
                const prop = (e.target as HTMLInputElement).dataset.prop?.replace('-num', '');
                if (prop) {
                    const value = parseFloat((e.target as HTMLInputElement).value);
                    (this.material as any)[prop] = value;
                    
                    // Sync with range input
                    const rangeInput = this.container?.querySelector(`input[data-prop="${prop}"]`) as HTMLInputElement;
                    if (rangeInput) rangeInput.value = value.toString();
                    
                    this.markDirty();
                    this.renderPreview();
                }
            });
        });
        
        // Property changes - colors
        this.container.querySelectorAll('input[type="color"]').forEach(input => {
            input.addEventListener('input', (e) => {
                const prop = (e.target as HTMLInputElement).dataset.prop;
                if (prop) {
                    const hex = (e.target as HTMLInputElement).value;
                    const rgb = this.hexToRgb(hex);
                    
                    if (prop === 'baseColor') {
                        this.material.baseColor = [rgb.r, rgb.g, rgb.b, this.material.baseColor[3]];
                    } else if (prop === 'emissive') {
                        this.material.emissive = [rgb.r, rgb.g, rgb.b];
                    } else if (prop === 'subsurfaceColor') {
                        this.material.subsurfaceColor = [rgb.r, rgb.g, rgb.b];
                    }
                    
                    this.markDirty();
                    this.renderPreview();
                }
            });
        });
        
        // Property changes - checkboxes
        this.container.querySelectorAll('input[type="checkbox"]').forEach(input => {
            input.addEventListener('change', (e) => {
                const prop = (e.target as HTMLInputElement).dataset.prop;
                if (prop) {
                    (this.material as any)[prop] = (e.target as HTMLInputElement).checked;
                    this.markDirty();
                }
            });
        });
        
        // Property changes - selects
        this.container.querySelectorAll('.mat-property select').forEach(select => {
            select.addEventListener('change', (e) => {
                const prop = (e.target as HTMLSelectElement).dataset.prop;
                if (prop) {
                    (this.material as any)[prop] = (e.target as HTMLSelectElement).value;
                    this.markDirty();
                }
            });
        });
    }
    
    /**
     * Apply a preset to the current material
     */
    private applyPreset(presetName: string): void {
        const preset = this.presets.find(p => p.name === presetName);
        if (!preset) return;
        
        // Merge preset data with current material
        Object.assign(this.material, preset.data);
        
        // Re-render the UI
        this.onMount(this.container!);
        this.logger.info(`Applied preset: ${presetName}`);
    }
    
    /**
     * Mark material as dirty (unsaved changes)
     */
    private markDirty(): void {
        this.isDirty = true;
        this.events.emit('materialChanged', this.material);
    }
    
    /**
     * Save material
     */
    private saveMaterial(): void {
        const data = JSON.stringify(this.material, null, 2);
        
        // For now, download as file
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${this.material.name.replace(/\s+/g, '_')}.mat.json`;
        a.click();
        URL.revokeObjectURL(url);
        
        this.isDirty = false;
        this.logger.info(`Saved material: ${this.material.name}`);
        this.events.emit('materialSaved', this.material);
    }
    
    /**
     * Load material from file
     */
    private loadMaterial(): void {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        
        input.onchange = (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const data = JSON.parse(event.target?.result as string);
                    this.material = { ...this.createDefaultMaterial(), ...data };
                    this.onMount(this.container!);
                    this.logger.info(`Loaded material: ${this.material.name}`);
                    this.events.emit('materialLoaded', this.material);
                } catch (err) {
                    this.logger.error('Failed to load material');
                }
            };
            reader.readAsText(file);
        };
        
        input.click();
    }
    
    /**
     * Render material preview
     */
    private renderPreview(): void {
        if (!this.previewCanvas || !this.previewCtx) return;
        
        const ctx = this.previewCtx;
        const width = this.previewCanvas.width;
        const height = this.previewCanvas.height;
        const centerX = width / 2;
        const centerY = height / 2;
        
        // Clear
        ctx.fillStyle = '#101020';
        ctx.fillRect(0, 0, width, height);
        
        // Get active shape
        const activeBtn = this.container?.querySelector('.mat-preview-btn.active');
        const shape = (activeBtn as HTMLElement)?.dataset.shape || 'sphere';
        
        // Calculate base color
        const baseColor = this.material.baseColor;
        const metallic = this.material.metallic;
        const roughness = this.material.roughness;
        
        // Simple preview rendering (not physically accurate, just for UI)
        // In a real implementation, this would use WebGL
        
        if (shape === 'sphere') {
            this.drawSphere(ctx, centerX, centerY, 70, baseColor, metallic, roughness);
        } else if (shape === 'cube') {
            this.drawCube(ctx, centerX, centerY, 100, baseColor, metallic, roughness);
        } else if (shape === 'plane') {
            this.drawPlane(ctx, centerX, centerY, 120, baseColor, metallic, roughness);
        }
        
        // Add emissive glow
        if (this.material.emissiveIntensity > 0) {
            const emissive = this.material.emissive;
            ctx.shadowColor = `rgb(${emissive[0] * 255}, ${emissive[1] * 255}, ${emissive[2] * 255})`;
            ctx.shadowBlur = this.material.emissiveIntensity * 10;
        }
    }
    
    /**
     * Draw a sphere preview
     */
    private drawSphere(
        ctx: CanvasRenderingContext2D, 
        x: number, y: number, radius: number,
        color: number[], metallic: number, roughness: number
    ): void {
        // Create gradient for sphere shading
        const gradient = ctx.createRadialGradient(
            x - radius * 0.3, y - radius * 0.3, 0,
            x, y, radius
        );
        
        // Adjust colors based on PBR properties
        const highlight = metallic > 0.5 ? 1.5 : 1.2;
        const shadow = 0.3 + roughness * 0.3;
        
        gradient.addColorStop(0, `rgba(${Math.min(255, color[0] * 255 * highlight)}, ${Math.min(255, color[1] * 255 * highlight)}, ${Math.min(255, color[2] * 255 * highlight)}, 1)`);
        gradient.addColorStop(0.5, `rgba(${color[0] * 255}, ${color[1] * 255}, ${color[2] * 255}, 1)`);
        gradient.addColorStop(1, `rgba(${color[0] * 255 * shadow}, ${color[1] * 255 * shadow}, ${color[2] * 255 * shadow}, 1)`);
        
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
        
        // Specular highlight (more visible for smooth metals)
        if (roughness < 0.5 || metallic > 0.5) {
            const specGradient = ctx.createRadialGradient(
                x - radius * 0.3, y - radius * 0.4, 0,
                x - radius * 0.3, y - radius * 0.4, radius * 0.4
            );
            specGradient.addColorStop(0, `rgba(255, 255, 255, ${(1 - roughness) * 0.8})`);
            specGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
            
            ctx.beginPath();
            ctx.arc(x - radius * 0.3, y - radius * 0.4, radius * 0.4, 0, Math.PI * 2);
            ctx.fillStyle = specGradient;
            ctx.fill();
        }
    }
    
    /**
     * Draw a cube preview
     */
    private drawCube(
        ctx: CanvasRenderingContext2D,
        x: number, y: number, size: number,
        color: number[], metallic: number, roughness: number
    ): void {
        const half = size / 2;
        
        // Isometric cube
        const points = {
            top: [
                [x, y - half * 0.5],
                [x + half * 0.87, y],
                [x, y + half * 0.5],
                [x - half * 0.87, y]
            ],
            left: [
                [x - half * 0.87, y],
                [x, y + half * 0.5],
                [x, y + half * 1.5],
                [x - half * 0.87, y + half]
            ],
            right: [
                [x, y + half * 0.5],
                [x + half * 0.87, y],
                [x + half * 0.87, y + half],
                [x, y + half * 1.5]
            ]
        };
        
        const lightMult = metallic > 0.5 ? 1.2 : 1.0;
        const shadowMult = 0.4 + roughness * 0.2;
        
        // Top face (brightest)
        ctx.beginPath();
        ctx.moveTo(points.top[0][0], points.top[0][1]);
        points.top.forEach(p => ctx.lineTo(p[0], p[1]));
        ctx.closePath();
        ctx.fillStyle = `rgba(${Math.min(255, color[0] * 255 * lightMult)}, ${Math.min(255, color[1] * 255 * lightMult)}, ${Math.min(255, color[2] * 255 * lightMult)}, 1)`;
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.3)';
        ctx.stroke();
        
        // Left face (medium)
        ctx.beginPath();
        ctx.moveTo(points.left[0][0], points.left[0][1]);
        points.left.forEach(p => ctx.lineTo(p[0], p[1]));
        ctx.closePath();
        ctx.fillStyle = `rgba(${color[0] * 255 * 0.7}, ${color[1] * 255 * 0.7}, ${color[2] * 255 * 0.7}, 1)`;
        ctx.fill();
        ctx.stroke();
        
        // Right face (darkest)
        ctx.beginPath();
        ctx.moveTo(points.right[0][0], points.right[0][1]);
        points.right.forEach(p => ctx.lineTo(p[0], p[1]));
        ctx.closePath();
        ctx.fillStyle = `rgba(${color[0] * 255 * shadowMult}, ${color[1] * 255 * shadowMult}, ${color[2] * 255 * shadowMult}, 1)`;
        ctx.fill();
        ctx.stroke();
    }
    
    /**
     * Draw a plane preview
     */
    private drawPlane(
        ctx: CanvasRenderingContext2D,
        x: number, y: number, size: number,
        color: number[], _metallic: number, roughness: number
    ): void {
        const half = size / 2;
        
        // Draw isometric plane (tilted rectangle)
        ctx.beginPath();
        ctx.moveTo(x, y - half * 0.5);
        ctx.lineTo(x + half * 0.87, y);
        ctx.lineTo(x, y + half * 0.5);
        ctx.lineTo(x - half * 0.87, y);
        ctx.closePath();
        
        // Gradient for lighting
        const gradient = ctx.createLinearGradient(x - half, y, x + half, y);
        gradient.addColorStop(0, `rgba(${color[0] * 255 * 0.8}, ${color[1] * 255 * 0.8}, ${color[2] * 255 * 0.8}, 1)`);
        gradient.addColorStop(1, `rgba(${color[0] * 255}, ${color[1] * 255}, ${color[2] * 255}, 1)`);
        
        ctx.fillStyle = gradient;
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.3)';
        ctx.stroke();
        
        // Grid lines for visual reference
        ctx.strokeStyle = `rgba(255, 255, 255, ${0.1 + roughness * 0.05})`;
        ctx.lineWidth = 0.5;
        
        for (let i = 1; i < 4; i++) {
            const t = i / 4;
            ctx.beginPath();
            ctx.moveTo(x - half * 0.87 + (half * 0.87 * 2 * t), y - half * 0.5 * (1 - t) + half * 0.5 * t);
            ctx.lineTo(x - half * 0.87 + (half * 0.87 * 2 * t), y + half * 0.5 * (1 - t) - half * 0.5 * t);
            ctx.stroke();
        }
    }
    
    /**
     * Convert RGB to hex
     */
    private rgbToHex(r: number, g: number, b: number): string {
        const toHex = (n: number) => {
            const hex = Math.round(n * 255).toString(16);
            return hex.length === 1 ? '0' + hex : hex;
        };
        return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    }
    
    /**
     * Convert hex to RGB
     */
    private hexToRgb(hex: string): { r: number; g: number; b: number } {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16) / 255,
            g: parseInt(result[2], 16) / 255,
            b: parseInt(result[3], 16) / 255
        } : { r: 0, g: 0, b: 0 };
    }
    
    /**
     * Get the current material data
     */
    getMaterial(): MaterialData {
        return { ...this.material };
    }
    
    /**
     * Set material data
     */
    setMaterial(data: Partial<MaterialData>): void {
        this.material = { ...this.material, ...data };
        this.onMount(this.container!);
    }
    
    /**
     * Check if material has unsaved changes
     */
    hasUnsavedChanges(): boolean {
        return this.isDirty;
    }
}
