/**
 * @fileoverview Particle Editor Panel for WebForge Editor
 * @module editor/panels/ParticlePanel
 */

import { Panel } from '../Panel';
import { Vector3 } from '../../math/Vector3';

// ============================================================================
// TYPES
// ============================================================================

/** Particle emitter shape types */
export type ParticleEmitterShape = 'point' | 'sphere' | 'box' | 'cone' | 'circle' | 'edge' | 'mesh';

/** Particle blending modes */
export type ParticleBlendMode = 'additive' | 'alpha' | 'multiply' | 'premultiplied';

/** Particle simulation space */
export type ParticleSpace = 'local' | 'world';

/** Particle sorting mode */
export type ParticleSortMode = 'none' | 'distance' | 'age' | 'depth';

/** Value over lifetime curve type */
export type CurveType = 'constant' | 'linear' | 'curve' | 'random';

/** Color gradient stop */
export interface ColorStop {
    time: number;
    color: string;
    alpha: number;
}

/** Value curve point */
export interface CurvePoint {
    time: number;
    value: number;
    inTangent?: number;
    outTangent?: number;
}

/** Particle emitter configuration */
export interface ParticleEmitterConfig {
    name: string;
    enabled: boolean;
    
    // Emission
    duration: number;
    looping: boolean;
    prewarm: boolean;
    startDelay: number;
    startDelayMultiplier: number;
    
    // Emission rate
    rateOverTime: number;
    rateOverDistance: number;
    bursts: ParticleBurst[];
    
    // Shape
    shape: ParticleEmitterShape;
    shapeParams: {
        radius?: number;
        radiusThickness?: number;
        arc?: number;
        arcMode?: 'random' | 'loop' | 'pingpong';
        angle?: number;
        length?: number;
        boxSize?: Vector3;
        meshAsset?: string;
    };
    
    // Particle properties
    startLifetime: { min: number; max: number };
    startSpeed: { min: number; max: number };
    startSize: { min: number; max: number };
    startSize3D: boolean;
    startSizeXYZ: { x: { min: number; max: number }; y: { min: number; max: number }; z: { min: number; max: number } };
    startRotation: { min: number; max: number };
    startRotation3D: boolean;
    startRotationXYZ: { x: { min: number; max: number }; y: { min: number; max: number }; z: { min: number; max: number } };
    startColor: ColorStop[];
    gravityModifier: number;
    simulationSpace: ParticleSpace;
    simulationSpeed: number;
    scalingMode: 'hierarchy' | 'local' | 'shape';
    maxParticles: number;
    
    // Over lifetime
    velocityOverLifetime: {
        enabled: boolean;
        space: ParticleSpace;
        x: { type: CurveType; value: number; curve: CurvePoint[] };
        y: { type: CurveType; value: number; curve: CurvePoint[] };
        z: { type: CurveType; value: number; curve: CurvePoint[] };
    };
    
    forceOverLifetime: {
        enabled: boolean;
        space: ParticleSpace;
        x: { type: CurveType; value: number; curve: CurvePoint[] };
        y: { type: CurveType; value: number; curve: CurvePoint[] };
        z: { type: CurveType; value: number; curve: CurvePoint[] };
    };
    
    colorOverLifetime: {
        enabled: boolean;
        gradient: ColorStop[];
    };
    
    sizeOverLifetime: {
        enabled: boolean;
        separateAxes: boolean;
        size: { type: CurveType; value: number; curve: CurvePoint[] };
        sizeX: { type: CurveType; value: number; curve: CurvePoint[] };
        sizeY: { type: CurveType; value: number; curve: CurvePoint[] };
        sizeZ: { type: CurveType; value: number; curve: CurvePoint[] };
    };
    
    rotationOverLifetime: {
        enabled: boolean;
        separateAxes: boolean;
        angularVelocity: { type: CurveType; value: number; curve: CurvePoint[] };
        x: { type: CurveType; value: number; curve: CurvePoint[] };
        y: { type: CurveType; value: number; curve: CurvePoint[] };
        z: { type: CurveType; value: number; curve: CurvePoint[] };
    };
    
    // Noise
    noise: {
        enabled: boolean;
        strength: number;
        frequency: number;
        scrollSpeed: number;
        damping: boolean;
        octaves: number;
        remap: { min: number; max: number };
        positionAmount: number;
        rotationAmount: number;
        sizeAmount: number;
    };
    
    // Collision
    collision: {
        enabled: boolean;
        type: 'planes' | 'world';
        mode: '2d' | '3d';
        dampen: number;
        bounce: number;
        lifetimeLoss: number;
        minKillSpeed: number;
        radiusScale: number;
        collidesWith: string[];
        maxCollisionShapes: number;
        quality: 'high' | 'medium' | 'low';
        sendCollisionMessages: boolean;
    };
    
    // Sub emitters
    subEmitters: {
        enabled: boolean;
        birth: string[];
        collision: string[];
        death: string[];
    };
    
    // Texture sheet animation
    textureSheet: {
        enabled: boolean;
        tiles: { x: number; y: number };
        animation: 'wholeSheet' | 'singleRow';
        rowIndex: number;
        timeMode: 'lifetime' | 'fps';
        frameOverTime: { type: CurveType; curve: CurvePoint[] };
        startFrame: { min: number; max: number };
        cycles: number;
        fps: number;
    };
    
    // Trails
    trails: {
        enabled: boolean;
        ratio: number;
        lifetime: number;
        minimumVertexDistance: number;
        worldSpace: boolean;
        dieWithParticles: boolean;
        textureMode: 'stretch' | 'tile' | 'perSegment';
        sizeAffectsWidth: boolean;
        sizeAffectsLifetime: boolean;
        inheritParticleColor: boolean;
        colorOverLifetime: ColorStop[];
        widthOverTrail: { type: CurveType; curve: CurvePoint[] };
        colorOverTrail: ColorStop[];
        generateLightingData: boolean;
        shadowBias: number;
    };
    
    // Renderer
    renderer: {
        renderMode: 'billboard' | 'stretchedBillboard' | 'horizontalBillboard' | 'verticalBillboard' | 'mesh';
        normalDirection: number;
        material: string;
        trailMaterial: string;
        sortMode: ParticleSortMode;
        sortingFudge: number;
        minParticleSize: number;
        maxParticleSize: number;
        alignment: 'view' | 'world' | 'local' | 'facing' | 'velocity';
        flip: { x: number; y: number; z: number };
        pivot: Vector3;
        visualizeInvertedBounds: boolean;
        renderAlignment: 'view' | 'world' | 'local' | 'facing';
        
        // Stretched billboard
        cameraVelocityScale: number;
        velocityScale: number;
        lengthScale: number;
        freeformStretching: boolean;
        rotateWithStretchDirection: boolean;
        
        // Mesh renderer
        mesh: string;
        meshCount: number;
        
        // Shadows
        castShadows: 'off' | 'on' | 'twoSided' | 'shadowsOnly';
        receiveShadows: boolean;
        shadowBias: number;
        motionVectors: 'camera' | 'object' | 'forceNoMotion';
        
        // Lighting
        lightProbeUsage: 'off' | 'blendProbes' | 'useProxyVolume' | 'customProvided';
        reflectionProbeUsage: 'off' | 'blendProbes' | 'blendProbesAndSkybox' | 'simple';
    };
}

/** Particle burst configuration */
export interface ParticleBurst {
    time: number;
    count: { min: number; max: number };
    cycles: number;
    interval: number;
    probability: number;
}

/** Particle system preset */
export interface ParticlePreset {
    name: string;
    category: string;
    description: string;
    thumbnail: string;
    config: Partial<ParticleEmitterConfig>;
}

// ============================================================================
// PARTICLE PANEL
// ============================================================================

/**
 * Particle Editor Panel
 * 
 * Provides comprehensive particle system editing with:
 * - Emitter configuration
 * - Shape editing
 * - Over lifetime curves
 * - Color gradients
 * - Collision settings
 * - Trail effects
 * - Texture sheet animation
 * - Sub-emitters
 * - Real-time preview
 */
export class ParticlePanel extends Panel {
    private currentEmitter: ParticleEmitterConfig | null = null;
    private selectedModule: string = 'main';
    private previewPlaying: boolean = true;
    private previewSpeed: number = 1;
    private showBounds: boolean = false;
    private showWireframe: boolean = false;
    
    /** Available particle presets */
    private presets: ParticlePreset[] = [
        { name: 'Fire', category: 'Elements', description: 'Realistic fire effect', thumbnail: '🔥', config: this.createFirePreset() },
        { name: 'Smoke', category: 'Elements', description: 'Volumetric smoke', thumbnail: '💨', config: this.createSmokePreset() },
        { name: 'Sparks', category: 'Effects', description: 'Metal sparks', thumbnail: '✨', config: this.createSparksPreset() },
        { name: 'Magic', category: 'Fantasy', description: 'Magic particles', thumbnail: '⭐', config: this.createMagicPreset() },
        { name: 'Rain', category: 'Weather', description: 'Rain drops', thumbnail: '🌧️', config: this.createRainPreset() },
        { name: 'Snow', category: 'Weather', description: 'Snowflakes', thumbnail: '❄️', config: this.createSnowPreset() },
        { name: 'Explosion', category: 'Effects', description: 'Explosion burst', thumbnail: '💥', config: this.createExplosionPreset() },
        { name: 'Dust', category: 'Ambient', description: 'Ambient dust', thumbnail: '🌫️', config: this.createDustPreset() },
    ];
    
    constructor() {
        super('particle-panel', 'Particle Editor');
    }
    
    protected onMount(container: HTMLElement): void {
        container.innerHTML = this.render();
        this.setupEventListeners(container);
        this.createDefaultEmitter();
    }
    
    private render(): string {
        return `
            <style>
                .particle-panel {
                    display: flex;
                    flex-direction: column;
                    height: 100%;
                    background: #1e1e1e;
                    color: #e0e0e0;
                    font-family: 'Segoe UI', system-ui, sans-serif;
                    font-size: 12px;
                }
                
                .particle-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 8px 12px;
                    background: #252526;
                    border-bottom: 1px solid #3e3e42;
                }
                
                .particle-title {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-weight: 600;
                }
                
                .particle-icon {
                    font-size: 18px;
                }
                
                .particle-controls {
                    display: flex;
                    gap: 4px;
                }
                
                .particle-btn {
                    padding: 4px 8px;
                    background: #3c3c3c;
                    border: 1px solid #555;
                    border-radius: 3px;
                    color: #e0e0e0;
                    cursor: pointer;
                    font-size: 11px;
                }
                
                .particle-btn:hover {
                    background: #4a4a4a;
                }
                
                .particle-btn.active {
                    background: #0e639c;
                    border-color: #1177bb;
                }
                
                .particle-btn.play { color: #4ec9b0; }
                .particle-btn.stop { color: #f14c4c; }
                
                .particle-preview {
                    height: 200px;
                    background: linear-gradient(180deg, #1a1a2e 0%, #0f0f1a 100%);
                    border-bottom: 1px solid #3e3e42;
                    position: relative;
                    overflow: hidden;
                }
                
                .preview-canvas {
                    width: 100%;
                    height: 100%;
                }
                
                .preview-overlay {
                    position: absolute;
                    bottom: 8px;
                    left: 8px;
                    display: flex;
                    gap: 12px;
                    font-size: 10px;
                    color: #888;
                }
                
                .preview-stat {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                }
                
                .preview-stat-value {
                    color: #4ec9b0;
                    font-weight: 600;
                }
                
                .preview-toolbar {
                    position: absolute;
                    top: 8px;
                    right: 8px;
                    display: flex;
                    gap: 4px;
                }
                
                .particle-body {
                    flex: 1;
                    display: flex;
                    overflow: hidden;
                }
                
                .module-list {
                    width: 180px;
                    background: #252526;
                    border-right: 1px solid #3e3e42;
                    overflow-y: auto;
                }
                
                .module-item {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 8px 12px;
                    cursor: pointer;
                    border-left: 2px solid transparent;
                }
                
                .module-item:hover {
                    background: #2d2d30;
                }
                
                .module-item.selected {
                    background: #094771;
                    border-left-color: #0e639c;
                }
                
                .module-item.disabled {
                    opacity: 0.5;
                }
                
                .module-checkbox {
                    width: 14px;
                    height: 14px;
                    accent-color: #0e639c;
                }
                
                .module-name {
                    flex: 1;
                }
                
                .module-content {
                    flex: 1;
                    overflow-y: auto;
                    padding: 12px;
                }
                
                .module-section {
                    margin-bottom: 16px;
                }
                
                .section-title {
                    font-weight: 600;
                    color: #4fc3f7;
                    margin-bottom: 8px;
                    font-size: 11px;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }
                
                .property-row {
                    display: flex;
                    align-items: center;
                    margin-bottom: 8px;
                }
                
                .property-label {
                    width: 120px;
                    flex-shrink: 0;
                    color: #999;
                }
                
                .property-value {
                    flex: 1;
                    display: flex;
                    gap: 4px;
                }
                
                .property-input {
                    flex: 1;
                    padding: 4px 8px;
                    background: #3c3c3c;
                    border: 1px solid #555;
                    border-radius: 3px;
                    color: #e0e0e0;
                    font-size: 11px;
                }
                
                .property-input:focus {
                    border-color: #0e639c;
                    outline: none;
                }
                
                .property-input[type="range"] {
                    padding: 0;
                    background: transparent;
                    border: none;
                }
                
                .property-select {
                    flex: 1;
                    padding: 4px 8px;
                    background: #3c3c3c;
                    border: 1px solid #555;
                    border-radius: 3px;
                    color: #e0e0e0;
                    font-size: 11px;
                }
                
                .property-checkbox {
                    accent-color: #0e639c;
                }
                
                .minmax-input {
                    display: flex;
                    gap: 4px;
                    align-items: center;
                }
                
                .minmax-input input {
                    width: 60px;
                }
                
                .minmax-sep {
                    color: #666;
                }
                
                .vector3-input {
                    display: flex;
                    gap: 4px;
                }
                
                .vector3-input input {
                    width: 50px;
                    text-align: center;
                }
                
                .vector3-label {
                    width: 16px;
                    text-align: center;
                    font-weight: 600;
                    font-size: 10px;
                }
                
                .vector3-label.x { color: #f14c4c; }
                .vector3-label.y { color: #4ec9b0; }
                .vector3-label.z { color: #569cd6; }
                
                .color-picker {
                    width: 60px;
                    height: 24px;
                    border: none;
                    border-radius: 3px;
                    cursor: pointer;
                }
                
                .gradient-editor {
                    height: 30px;
                    background: linear-gradient(to right, #ff0000, #ffff00, #00ff00);
                    border-radius: 3px;
                    cursor: pointer;
                    position: relative;
                }
                
                .gradient-stop {
                    position: absolute;
                    top: -4px;
                    width: 8px;
                    height: 38px;
                    border: 2px solid white;
                    border-radius: 2px;
                    cursor: ew-resize;
                }
                
                .curve-editor {
                    height: 100px;
                    background: #1a1a2e;
                    border: 1px solid #3e3e42;
                    border-radius: 4px;
                    position: relative;
                }
                
                .curve-canvas {
                    width: 100%;
                    height: 100%;
                }
                
                .burst-list {
                    background: #2d2d30;
                    border-radius: 4px;
                    padding: 8px;
                }
                
                .burst-item {
                    display: flex;
                    gap: 8px;
                    padding: 4px 0;
                    border-bottom: 1px solid #3e3e42;
                }
                
                .burst-item:last-child {
                    border-bottom: none;
                }
                
                .burst-remove {
                    color: #f14c4c;
                    cursor: pointer;
                }
                
                .add-burst-btn {
                    display: block;
                    width: 100%;
                    padding: 6px;
                    margin-top: 8px;
                    background: #3c3c3c;
                    border: 1px dashed #555;
                    border-radius: 3px;
                    color: #888;
                    cursor: pointer;
                }
                
                .add-burst-btn:hover {
                    background: #4a4a4a;
                    color: #e0e0e0;
                }
                
                .preset-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
                    gap: 8px;
                    padding: 8px;
                }
                
                .preset-item {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    padding: 12px 8px;
                    background: #2d2d30;
                    border: 1px solid #3e3e42;
                    border-radius: 6px;
                    cursor: pointer;
                    transition: all 0.15s;
                }
                
                .preset-item:hover {
                    background: #094771;
                    border-color: #0e639c;
                }
                
                .preset-icon {
                    font-size: 24px;
                    margin-bottom: 4px;
                }
                
                .preset-name {
                    font-size: 10px;
                    text-align: center;
                }
                
                .shape-preview {
                    width: 100%;
                    height: 100px;
                    background: #1a1a2e;
                    border: 1px solid #3e3e42;
                    border-radius: 4px;
                    margin-bottom: 12px;
                }
                
                .tabs {
                    display: flex;
                    background: #252526;
                    border-bottom: 1px solid #3e3e42;
                }
                
                .tab {
                    padding: 8px 16px;
                    cursor: pointer;
                    border-bottom: 2px solid transparent;
                    color: #888;
                }
                
                .tab:hover {
                    color: #e0e0e0;
                }
                
                .tab.active {
                    color: #e0e0e0;
                    border-bottom-color: #0e639c;
                }
                
                .footer-bar {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 8px 12px;
                    background: #252526;
                    border-top: 1px solid #3e3e42;
                }
                
                .footer-stats {
                    display: flex;
                    gap: 16px;
                    font-size: 11px;
                    color: #888;
                }
                
                .footer-stat span {
                    color: #4ec9b0;
                    font-weight: 600;
                }
            </style>
            
            <div class="particle-panel">
                <div class="particle-header">
                    <div class="particle-title">
                        <span class="particle-icon">✨</span>
                        <span>Particle System</span>
                    </div>
                    <div class="particle-controls">
                        <button class="particle-btn play ${this.previewPlaying ? 'active' : ''}" id="btn-play" title="Play">▶</button>
                        <button class="particle-btn" id="btn-restart" title="Restart">↺</button>
                        <button class="particle-btn stop" id="btn-stop" title="Stop">■</button>
                        <button class="particle-btn" id="btn-speed" title="Speed: ${this.previewSpeed}x">${this.previewSpeed}x</button>
                    </div>
                </div>
                
                <div class="particle-preview">
                    <canvas class="preview-canvas" id="particle-preview-canvas"></canvas>
                    <div class="preview-overlay">
                        <div class="preview-stat">
                            <span>Particles:</span>
                            <span class="preview-stat-value" id="stat-particles">0</span>
                        </div>
                        <div class="preview-stat">
                            <span>FPS:</span>
                            <span class="preview-stat-value" id="stat-fps">60</span>
                        </div>
                        <div class="preview-stat">
                            <span>Time:</span>
                            <span class="preview-stat-value" id="stat-time">0.00s</span>
                        </div>
                    </div>
                    <div class="preview-toolbar">
                        <button class="particle-btn ${this.showBounds ? 'active' : ''}" id="btn-bounds" title="Show Bounds">📦</button>
                        <button class="particle-btn ${this.showWireframe ? 'active' : ''}" id="btn-wireframe" title="Wireframe">🔲</button>
                    </div>
                </div>
                
                <div class="tabs">
                    <div class="tab active" data-tab="modules">Modules</div>
                    <div class="tab" data-tab="presets">Presets</div>
                </div>
                
                <div class="particle-body">
                    <div class="module-list" id="module-list">
                        ${this.renderModuleList()}
                    </div>
                    <div class="module-content" id="module-content">
                        ${this.renderModuleContent()}
                    </div>
                </div>
                
                <div class="footer-bar">
                    <div class="footer-stats">
                        <div class="footer-stat">Max: <span id="stat-max">${this.currentEmitter?.maxParticles || 1000}</span></div>
                        <div class="footer-stat">Rate: <span id="stat-rate">${this.currentEmitter?.rateOverTime || 10}</span>/s</div>
                        <div class="footer-stat">Lifetime: <span id="stat-lifetime">5</span>s</div>
                    </div>
                    <button class="particle-btn" id="btn-export">Export</button>
                </div>
            </div>
        `;
    }
    
    private renderModuleList(): string {
        const modules = [
            { id: 'main', name: 'Main', enabled: true, required: true },
            { id: 'emission', name: 'Emission', enabled: true },
            { id: 'shape', name: 'Shape', enabled: true },
            { id: 'velocity', name: 'Velocity over Lifetime', enabled: this.currentEmitter?.velocityOverLifetime?.enabled ?? false },
            { id: 'force', name: 'Force over Lifetime', enabled: this.currentEmitter?.forceOverLifetime?.enabled ?? false },
            { id: 'color', name: 'Color over Lifetime', enabled: this.currentEmitter?.colorOverLifetime?.enabled ?? true },
            { id: 'size', name: 'Size over Lifetime', enabled: this.currentEmitter?.sizeOverLifetime?.enabled ?? false },
            { id: 'rotation', name: 'Rotation over Lifetime', enabled: this.currentEmitter?.rotationOverLifetime?.enabled ?? false },
            { id: 'noise', name: 'Noise', enabled: this.currentEmitter?.noise?.enabled ?? false },
            { id: 'collision', name: 'Collision', enabled: this.currentEmitter?.collision?.enabled ?? false },
            { id: 'subemitters', name: 'Sub Emitters', enabled: this.currentEmitter?.subEmitters?.enabled ?? false },
            { id: 'texturesheet', name: 'Texture Sheet Animation', enabled: this.currentEmitter?.textureSheet?.enabled ?? false },
            { id: 'trails', name: 'Trails', enabled: this.currentEmitter?.trails?.enabled ?? false },
            { id: 'renderer', name: 'Renderer', enabled: true, required: true },
        ];
        
        return modules.map(mod => `
            <div class="module-item ${this.selectedModule === mod.id ? 'selected' : ''} ${!mod.enabled && !mod.required ? 'disabled' : ''}" 
                 data-module="${mod.id}">
                ${!mod.required ? `<input type="checkbox" class="module-checkbox" ${mod.enabled ? 'checked' : ''} data-module="${mod.id}">` : ''}
                <span class="module-name">${mod.name}</span>
            </div>
        `).join('');
    }
    
    private renderModuleContent(): string {
        switch (this.selectedModule) {
            case 'main': return this.renderMainModule();
            case 'emission': return this.renderEmissionModule();
            case 'shape': return this.renderShapeModule();
            case 'velocity': return this.renderVelocityModule();
            case 'force': return this.renderForceModule();
            case 'color': return this.renderColorModule();
            case 'size': return this.renderSizeModule();
            case 'rotation': return this.renderRotationModule();
            case 'noise': return this.renderNoiseModule();
            case 'collision': return this.renderCollisionModule();
            case 'subemitters': return this.renderSubEmittersModule();
            case 'texturesheet': return this.renderTextureSheetModule();
            case 'trails': return this.renderTrailsModule();
            case 'renderer': return this.renderRendererModule();
            default: return '';
        }
    }
    
    private renderMainModule(): string {
        const e = this.currentEmitter;
        return `
            <div class="module-section">
                <div class="section-title">Timing</div>
                
                <div class="property-row">
                    <span class="property-label">Duration</span>
                    <div class="property-value">
                        <input type="number" class="property-input" value="${e?.duration ?? 5}" data-prop="duration" step="0.1" min="0">
                        <span>s</span>
                    </div>
                </div>
                
                <div class="property-row">
                    <span class="property-label">Looping</span>
                    <div class="property-value">
                        <input type="checkbox" class="property-checkbox" ${e?.looping ? 'checked' : ''} data-prop="looping">
                    </div>
                </div>
                
                <div class="property-row">
                    <span class="property-label">Prewarm</span>
                    <div class="property-value">
                        <input type="checkbox" class="property-checkbox" ${e?.prewarm ? 'checked' : ''} data-prop="prewarm">
                    </div>
                </div>
                
                <div class="property-row">
                    <span class="property-label">Start Delay</span>
                    <div class="property-value">
                        <input type="number" class="property-input" value="${e?.startDelay ?? 0}" data-prop="startDelay" step="0.1" min="0">
                        <span>s</span>
                    </div>
                </div>
            </div>
            
            <div class="module-section">
                <div class="section-title">Start Values</div>
                
                <div class="property-row">
                    <span class="property-label">Start Lifetime</span>
                    <div class="property-value minmax-input">
                        <input type="number" class="property-input" value="${e?.startLifetime?.min ?? 3}" data-prop="startLifetime.min" step="0.1" min="0">
                        <span class="minmax-sep">-</span>
                        <input type="number" class="property-input" value="${e?.startLifetime?.max ?? 5}" data-prop="startLifetime.max" step="0.1" min="0">
                    </div>
                </div>
                
                <div class="property-row">
                    <span class="property-label">Start Speed</span>
                    <div class="property-value minmax-input">
                        <input type="number" class="property-input" value="${e?.startSpeed?.min ?? 1}" data-prop="startSpeed.min" step="0.1">
                        <span class="minmax-sep">-</span>
                        <input type="number" class="property-input" value="${e?.startSpeed?.max ?? 3}" data-prop="startSpeed.max" step="0.1">
                    </div>
                </div>
                
                <div class="property-row">
                    <span class="property-label">Start Size</span>
                    <div class="property-value minmax-input">
                        <input type="number" class="property-input" value="${e?.startSize?.min ?? 0.5}" data-prop="startSize.min" step="0.1" min="0">
                        <span class="minmax-sep">-</span>
                        <input type="number" class="property-input" value="${e?.startSize?.max ?? 1}" data-prop="startSize.max" step="0.1" min="0">
                    </div>
                </div>
                
                <div class="property-row">
                    <span class="property-label">3D Start Size</span>
                    <div class="property-value">
                        <input type="checkbox" class="property-checkbox" ${e?.startSize3D ? 'checked' : ''} data-prop="startSize3D">
                    </div>
                </div>
                
                <div class="property-row">
                    <span class="property-label">Start Rotation</span>
                    <div class="property-value minmax-input">
                        <input type="number" class="property-input" value="${e?.startRotation?.min ?? 0}" data-prop="startRotation.min" step="1">
                        <span class="minmax-sep">-</span>
                        <input type="number" class="property-input" value="${e?.startRotation?.max ?? 360}" data-prop="startRotation.max" step="1">
                        <span>°</span>
                    </div>
                </div>
                
                <div class="property-row">
                    <span class="property-label">Start Color</span>
                    <div class="property-value">
                        <input type="color" class="color-picker" value="#ffffff" data-prop="startColor">
                    </div>
                </div>
            </div>
            
            <div class="module-section">
                <div class="section-title">Physics</div>
                
                <div class="property-row">
                    <span class="property-label">Gravity Modifier</span>
                    <div class="property-value">
                        <input type="number" class="property-input" value="${e?.gravityModifier ?? 0}" data-prop="gravityModifier" step="0.1">
                    </div>
                </div>
                
                <div class="property-row">
                    <span class="property-label">Simulation Space</span>
                    <div class="property-value">
                        <select class="property-select" data-prop="simulationSpace">
                            <option value="local" ${e?.simulationSpace === 'local' ? 'selected' : ''}>Local</option>
                            <option value="world" ${e?.simulationSpace === 'world' ? 'selected' : ''}>World</option>
                        </select>
                    </div>
                </div>
                
                <div class="property-row">
                    <span class="property-label">Simulation Speed</span>
                    <div class="property-value">
                        <input type="number" class="property-input" value="${e?.simulationSpeed ?? 1}" data-prop="simulationSpeed" step="0.1" min="0">
                    </div>
                </div>
                
                <div class="property-row">
                    <span class="property-label">Max Particles</span>
                    <div class="property-value">
                        <input type="number" class="property-input" value="${e?.maxParticles ?? 1000}" data-prop="maxParticles" step="100" min="1">
                    </div>
                </div>
            </div>
        `;
    }
    
    private renderEmissionModule(): string {
        const e = this.currentEmitter;
        const bursts = e?.bursts || [];
        
        return `
            <div class="module-section">
                <div class="section-title">Rate</div>
                
                <div class="property-row">
                    <span class="property-label">Rate over Time</span>
                    <div class="property-value">
                        <input type="number" class="property-input" value="${e?.rateOverTime ?? 10}" data-prop="rateOverTime" step="1" min="0">
                        <span>/s</span>
                    </div>
                </div>
                
                <div class="property-row">
                    <span class="property-label">Rate over Distance</span>
                    <div class="property-value">
                        <input type="number" class="property-input" value="${e?.rateOverDistance ?? 0}" data-prop="rateOverDistance" step="0.1" min="0">
                        <span>/m</span>
                    </div>
                </div>
            </div>
            
            <div class="module-section">
                <div class="section-title">Bursts</div>
                <div class="burst-list">
                    ${bursts.map((burst, i) => `
                        <div class="burst-item">
                            <input type="number" class="property-input" value="${burst.time}" title="Time" placeholder="Time" style="width: 50px">
                            <input type="number" class="property-input" value="${burst.count.min}" title="Min" placeholder="Min" style="width: 40px">
                            <span class="minmax-sep">-</span>
                            <input type="number" class="property-input" value="${burst.count.max}" title="Max" placeholder="Max" style="width: 40px">
                            <input type="number" class="property-input" value="${burst.cycles}" title="Cycles" placeholder="Cycles" style="width: 40px">
                            <span class="burst-remove" data-burst="${i}">✕</span>
                        </div>
                    `).join('')}
                </div>
                <button class="add-burst-btn" id="add-burst">+ Add Burst</button>
            </div>
        `;
    }
    
    private renderShapeModule(): string {
        const e = this.currentEmitter;
        const shape = e?.shape || 'cone';
        const params = e?.shapeParams || {};
        
        return `
            <div class="module-section">
                <canvas class="shape-preview" id="shape-preview-canvas"></canvas>
                
                <div class="property-row">
                    <span class="property-label">Shape</span>
                    <div class="property-value">
                        <select class="property-select" data-prop="shape" id="shape-select">
                            <option value="point" ${shape === 'point' ? 'selected' : ''}>Point</option>
                            <option value="sphere" ${shape === 'sphere' ? 'selected' : ''}>Sphere</option>
                            <option value="cone" ${shape === 'cone' ? 'selected' : ''}>Cone</option>
                            <option value="box" ${shape === 'box' ? 'selected' : ''}>Box</option>
                            <option value="circle" ${shape === 'circle' ? 'selected' : ''}>Circle</option>
                            <option value="edge" ${shape === 'edge' ? 'selected' : ''}>Edge</option>
                            <option value="mesh" ${shape === 'mesh' ? 'selected' : ''}>Mesh</option>
                        </select>
                    </div>
                </div>
            </div>
            
            <div class="module-section" id="shape-params">
                ${this.renderShapeParams(shape, params)}
            </div>
        `;
    }
    
    private renderShapeParams(shape: string, params: Record<string, unknown>): string {
        switch (shape) {
            case 'sphere':
            case 'circle':
                return `
                    <div class="property-row">
                        <span class="property-label">Radius</span>
                        <div class="property-value">
                            <input type="number" class="property-input" value="${params.radius ?? 1}" data-prop="shapeParams.radius" step="0.1" min="0">
                        </div>
                    </div>
                    <div class="property-row">
                        <span class="property-label">Radius Thickness</span>
                        <div class="property-value">
                            <input type="range" class="property-input" value="${params.radiusThickness ?? 1}" data-prop="shapeParams.radiusThickness" min="0" max="1" step="0.01">
                            <span>${((params.radiusThickness as number) ?? 1).toFixed(2)}</span>
                        </div>
                    </div>
                    <div class="property-row">
                        <span class="property-label">Arc</span>
                        <div class="property-value">
                            <input type="number" class="property-input" value="${params.arc ?? 360}" data-prop="shapeParams.arc" min="0" max="360">
                            <span>°</span>
                        </div>
                    </div>
                `;
            case 'cone':
                return `
                    <div class="property-row">
                        <span class="property-label">Angle</span>
                        <div class="property-value">
                            <input type="number" class="property-input" value="${params.angle ?? 25}" data-prop="shapeParams.angle" min="0" max="90">
                            <span>°</span>
                        </div>
                    </div>
                    <div class="property-row">
                        <span class="property-label">Radius</span>
                        <div class="property-value">
                            <input type="number" class="property-input" value="${params.radius ?? 1}" data-prop="shapeParams.radius" step="0.1" min="0">
                        </div>
                    </div>
                    <div class="property-row">
                        <span class="property-label">Length</span>
                        <div class="property-value">
                            <input type="number" class="property-input" value="${params.length ?? 5}" data-prop="shapeParams.length" step="0.1" min="0">
                        </div>
                    </div>
                `;
            case 'box':
                const boxSize = params.boxSize as Vector3 | undefined;
                return `
                    <div class="property-row">
                        <span class="property-label">Size</span>
                        <div class="property-value vector3-input">
                            <span class="vector3-label x">X</span>
                            <input type="number" class="property-input" value="${boxSize?.x ?? 1}" data-prop="shapeParams.boxSize.x" step="0.1">
                            <span class="vector3-label y">Y</span>
                            <input type="number" class="property-input" value="${boxSize?.y ?? 1}" data-prop="shapeParams.boxSize.y" step="0.1">
                            <span class="vector3-label z">Z</span>
                            <input type="number" class="property-input" value="${boxSize?.z ?? 1}" data-prop="shapeParams.boxSize.z" step="0.1">
                        </div>
                    </div>
                `;
            case 'edge':
                return `
                    <div class="property-row">
                        <span class="property-label">Length</span>
                        <div class="property-value">
                            <input type="number" class="property-input" value="${params.length ?? 1}" data-prop="shapeParams.length" step="0.1" min="0">
                        </div>
                    </div>
                `;
            default:
                return '<p style="color: #888; text-align: center;">No parameters for this shape</p>';
        }
    }
    
    private renderVelocityModule(): string {
        return `
            <div class="module-section">
                <div class="section-title">Velocity over Lifetime</div>
                <div class="curve-editor">
                    <canvas class="curve-canvas" id="velocity-curve-canvas"></canvas>
                </div>
                <div style="margin-top: 8px;">
                    <div class="property-row">
                        <span class="property-label">Space</span>
                        <div class="property-value">
                            <select class="property-select" data-prop="velocityOverLifetime.space">
                                <option value="local">Local</option>
                                <option value="world">World</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    private renderForceModule(): string {
        return `
            <div class="module-section">
                <div class="section-title">Force over Lifetime</div>
                <div class="curve-editor">
                    <canvas class="curve-canvas" id="force-curve-canvas"></canvas>
                </div>
                <div style="margin-top: 8px;">
                    <div class="property-row">
                        <span class="property-label">Space</span>
                        <div class="property-value">
                            <select class="property-select" data-prop="forceOverLifetime.space">
                                <option value="local">Local</option>
                                <option value="world">World</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    private renderColorModule(): string {
        return `
            <div class="module-section">
                <div class="section-title">Color over Lifetime</div>
                <div class="gradient-editor" id="color-gradient">
                    <div class="gradient-stop" style="left: 0%;"></div>
                    <div class="gradient-stop" style="left: 50%;"></div>
                    <div class="gradient-stop" style="left: 100%;"></div>
                </div>
                <p style="color: #666; font-size: 10px; margin-top: 4px;">Click to add stops, drag to move, right-click to delete</p>
            </div>
        `;
    }
    
    private renderSizeModule(): string {
        return `
            <div class="module-section">
                <div class="section-title">Size over Lifetime</div>
                <div class="property-row">
                    <span class="property-label">Separate Axes</span>
                    <div class="property-value">
                        <input type="checkbox" class="property-checkbox" data-prop="sizeOverLifetime.separateAxes">
                    </div>
                </div>
                <div class="curve-editor">
                    <canvas class="curve-canvas" id="size-curve-canvas"></canvas>
                </div>
            </div>
        `;
    }
    
    private renderRotationModule(): string {
        return `
            <div class="module-section">
                <div class="section-title">Rotation over Lifetime</div>
                <div class="property-row">
                    <span class="property-label">Separate Axes</span>
                    <div class="property-value">
                        <input type="checkbox" class="property-checkbox" data-prop="rotationOverLifetime.separateAxes">
                    </div>
                </div>
                <div class="property-row">
                    <span class="property-label">Angular Velocity</span>
                    <div class="property-value">
                        <input type="number" class="property-input" value="0" data-prop="rotationOverLifetime.angularVelocity.value">
                        <span>°/s</span>
                    </div>
                </div>
            </div>
        `;
    }
    
    private renderNoiseModule(): string {
        const noise = this.currentEmitter?.noise;
        return `
            <div class="module-section">
                <div class="section-title">Noise</div>
                <div class="property-row">
                    <span class="property-label">Strength</span>
                    <div class="property-value">
                        <input type="number" class="property-input" value="${noise?.strength ?? 1}" data-prop="noise.strength" step="0.1" min="0">
                    </div>
                </div>
                <div class="property-row">
                    <span class="property-label">Frequency</span>
                    <div class="property-value">
                        <input type="number" class="property-input" value="${noise?.frequency ?? 0.5}" data-prop="noise.frequency" step="0.1" min="0">
                    </div>
                </div>
                <div class="property-row">
                    <span class="property-label">Scroll Speed</span>
                    <div class="property-value">
                        <input type="number" class="property-input" value="${noise?.scrollSpeed ?? 0}" data-prop="noise.scrollSpeed" step="0.1">
                    </div>
                </div>
                <div class="property-row">
                    <span class="property-label">Damping</span>
                    <div class="property-value">
                        <input type="checkbox" class="property-checkbox" ${noise?.damping ? 'checked' : ''} data-prop="noise.damping">
                    </div>
                </div>
                <div class="property-row">
                    <span class="property-label">Octaves</span>
                    <div class="property-value">
                        <input type="number" class="property-input" value="${noise?.octaves ?? 1}" data-prop="noise.octaves" min="1" max="4">
                    </div>
                </div>
            </div>
        `;
    }
    
    private renderCollisionModule(): string {
        const collision = this.currentEmitter?.collision;
        return `
            <div class="module-section">
                <div class="section-title">Collision</div>
                <div class="property-row">
                    <span class="property-label">Type</span>
                    <div class="property-value">
                        <select class="property-select" data-prop="collision.type">
                            <option value="planes" ${collision?.type === 'planes' ? 'selected' : ''}>Planes</option>
                            <option value="world" ${collision?.type === 'world' ? 'selected' : ''}>World</option>
                        </select>
                    </div>
                </div>
                <div class="property-row">
                    <span class="property-label">Mode</span>
                    <div class="property-value">
                        <select class="property-select" data-prop="collision.mode">
                            <option value="3d" ${collision?.mode === '3d' ? 'selected' : ''}>3D</option>
                            <option value="2d" ${collision?.mode === '2d' ? 'selected' : ''}>2D</option>
                        </select>
                    </div>
                </div>
                <div class="property-row">
                    <span class="property-label">Bounce</span>
                    <div class="property-value">
                        <input type="range" class="property-input" value="${collision?.bounce ?? 0.5}" data-prop="collision.bounce" min="0" max="1" step="0.01">
                        <span>${(collision?.bounce ?? 0.5).toFixed(2)}</span>
                    </div>
                </div>
                <div class="property-row">
                    <span class="property-label">Dampen</span>
                    <div class="property-value">
                        <input type="range" class="property-input" value="${collision?.dampen ?? 0}" data-prop="collision.dampen" min="0" max="1" step="0.01">
                        <span>${(collision?.dampen ?? 0).toFixed(2)}</span>
                    </div>
                </div>
                <div class="property-row">
                    <span class="property-label">Lifetime Loss</span>
                    <div class="property-value">
                        <input type="range" class="property-input" value="${collision?.lifetimeLoss ?? 0}" data-prop="collision.lifetimeLoss" min="0" max="1" step="0.01">
                        <span>${(collision?.lifetimeLoss ?? 0).toFixed(2)}</span>
                    </div>
                </div>
            </div>
        `;
    }
    
    private renderSubEmittersModule(): string {
        return `
            <div class="module-section">
                <div class="section-title">Sub Emitters</div>
                <p style="color: #888; text-align: center; padding: 20px;">
                    Sub emitters allow particles to spawn other particle systems on birth, collision, or death.
                </p>
                <div class="property-row">
                    <span class="property-label">Birth</span>
                    <div class="property-value">
                        <button class="particle-btn" style="width: 100%">+ Add Sub Emitter</button>
                    </div>
                </div>
                <div class="property-row">
                    <span class="property-label">Collision</span>
                    <div class="property-value">
                        <button class="particle-btn" style="width: 100%">+ Add Sub Emitter</button>
                    </div>
                </div>
                <div class="property-row">
                    <span class="property-label">Death</span>
                    <div class="property-value">
                        <button class="particle-btn" style="width: 100%">+ Add Sub Emitter</button>
                    </div>
                </div>
            </div>
        `;
    }
    
    private renderTextureSheetModule(): string {
        const ts = this.currentEmitter?.textureSheet;
        return `
            <div class="module-section">
                <div class="section-title">Texture Sheet Animation</div>
                <div class="property-row">
                    <span class="property-label">Tiles</span>
                    <div class="property-value">
                        <span>X</span>
                        <input type="number" class="property-input" value="${ts?.tiles?.x ?? 4}" data-prop="textureSheet.tiles.x" min="1" style="width: 50px">
                        <span>Y</span>
                        <input type="number" class="property-input" value="${ts?.tiles?.y ?? 4}" data-prop="textureSheet.tiles.y" min="1" style="width: 50px">
                    </div>
                </div>
                <div class="property-row">
                    <span class="property-label">Animation</span>
                    <div class="property-value">
                        <select class="property-select" data-prop="textureSheet.animation">
                            <option value="wholeSheet">Whole Sheet</option>
                            <option value="singleRow">Single Row</option>
                        </select>
                    </div>
                </div>
                <div class="property-row">
                    <span class="property-label">Time Mode</span>
                    <div class="property-value">
                        <select class="property-select" data-prop="textureSheet.timeMode">
                            <option value="lifetime">Lifetime</option>
                            <option value="fps">FPS</option>
                        </select>
                    </div>
                </div>
                <div class="property-row">
                    <span class="property-label">Cycles</span>
                    <div class="property-value">
                        <input type="number" class="property-input" value="${ts?.cycles ?? 1}" data-prop="textureSheet.cycles" min="0" step="0.1">
                    </div>
                </div>
            </div>
        `;
    }
    
    private renderTrailsModule(): string {
        const trails = this.currentEmitter?.trails;
        return `
            <div class="module-section">
                <div class="section-title">Trails</div>
                <div class="property-row">
                    <span class="property-label">Ratio</span>
                    <div class="property-value">
                        <input type="range" class="property-input" value="${trails?.ratio ?? 1}" data-prop="trails.ratio" min="0" max="1" step="0.01">
                        <span>${(trails?.ratio ?? 1).toFixed(2)}</span>
                    </div>
                </div>
                <div class="property-row">
                    <span class="property-label">Lifetime</span>
                    <div class="property-value">
                        <input type="number" class="property-input" value="${trails?.lifetime ?? 1}" data-prop="trails.lifetime" min="0" step="0.1">
                    </div>
                </div>
                <div class="property-row">
                    <span class="property-label">Min Vertex Distance</span>
                    <div class="property-value">
                        <input type="number" class="property-input" value="${trails?.minimumVertexDistance ?? 0.2}" data-prop="trails.minimumVertexDistance" min="0" step="0.1">
                    </div>
                </div>
                <div class="property-row">
                    <span class="property-label">World Space</span>
                    <div class="property-value">
                        <input type="checkbox" class="property-checkbox" ${trails?.worldSpace ? 'checked' : ''} data-prop="trails.worldSpace">
                    </div>
                </div>
                <div class="property-row">
                    <span class="property-label">Die with Particles</span>
                    <div class="property-value">
                        <input type="checkbox" class="property-checkbox" ${trails?.dieWithParticles ?? true ? 'checked' : ''} data-prop="trails.dieWithParticles">
                    </div>
                </div>
                <div class="property-row">
                    <span class="property-label">Texture Mode</span>
                    <div class="property-value">
                        <select class="property-select" data-prop="trails.textureMode">
                            <option value="stretch">Stretch</option>
                            <option value="tile">Tile</option>
                            <option value="perSegment">Per Segment</option>
                        </select>
                    </div>
                </div>
            </div>
        `;
    }
    
    private renderRendererModule(): string {
        const r = this.currentEmitter?.renderer;
        return `
            <div class="module-section">
                <div class="section-title">Render Settings</div>
                <div class="property-row">
                    <span class="property-label">Render Mode</span>
                    <div class="property-value">
                        <select class="property-select" data-prop="renderer.renderMode">
                            <option value="billboard" ${r?.renderMode === 'billboard' ? 'selected' : ''}>Billboard</option>
                            <option value="stretchedBillboard" ${r?.renderMode === 'stretchedBillboard' ? 'selected' : ''}>Stretched Billboard</option>
                            <option value="horizontalBillboard" ${r?.renderMode === 'horizontalBillboard' ? 'selected' : ''}>Horizontal Billboard</option>
                            <option value="verticalBillboard" ${r?.renderMode === 'verticalBillboard' ? 'selected' : ''}>Vertical Billboard</option>
                            <option value="mesh" ${r?.renderMode === 'mesh' ? 'selected' : ''}>Mesh</option>
                        </select>
                    </div>
                </div>
                <div class="property-row">
                    <span class="property-label">Sort Mode</span>
                    <div class="property-value">
                        <select class="property-select" data-prop="renderer.sortMode">
                            <option value="none" ${r?.sortMode === 'none' ? 'selected' : ''}>None</option>
                            <option value="distance" ${r?.sortMode === 'distance' ? 'selected' : ''}>By Distance</option>
                            <option value="age" ${r?.sortMode === 'age' ? 'selected' : ''}>Oldest in Front</option>
                            <option value="depth" ${r?.sortMode === 'depth' ? 'selected' : ''}>By Depth</option>
                        </select>
                    </div>
                </div>
                <div class="property-row">
                    <span class="property-label">Min Particle Size</span>
                    <div class="property-value">
                        <input type="number" class="property-input" value="${r?.minParticleSize ?? 0}" data-prop="renderer.minParticleSize" min="0" step="0.01">
                    </div>
                </div>
                <div class="property-row">
                    <span class="property-label">Max Particle Size</span>
                    <div class="property-value">
                        <input type="number" class="property-input" value="${r?.maxParticleSize ?? 0.5}" data-prop="renderer.maxParticleSize" min="0" step="0.01">
                    </div>
                </div>
            </div>
            
            <div class="module-section">
                <div class="section-title">Shadows & Lighting</div>
                <div class="property-row">
                    <span class="property-label">Cast Shadows</span>
                    <div class="property-value">
                        <select class="property-select" data-prop="renderer.castShadows">
                            <option value="off" ${r?.castShadows === 'off' ? 'selected' : ''}>Off</option>
                            <option value="on" ${r?.castShadows === 'on' ? 'selected' : ''}>On</option>
                            <option value="twoSided" ${r?.castShadows === 'twoSided' ? 'selected' : ''}>Two Sided</option>
                            <option value="shadowsOnly" ${r?.castShadows === 'shadowsOnly' ? 'selected' : ''}>Shadows Only</option>
                        </select>
                    </div>
                </div>
                <div class="property-row">
                    <span class="property-label">Receive Shadows</span>
                    <div class="property-value">
                        <input type="checkbox" class="property-checkbox" ${r?.receiveShadows ? 'checked' : ''} data-prop="renderer.receiveShadows">
                    </div>
                </div>
            </div>
        `;
    }
    
    private setupEventListeners(container: HTMLElement): void {
        // Module selection
        container.querySelectorAll('.module-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const target = e.target as HTMLElement;
                if (target.classList.contains('module-checkbox')) return;
                
                const moduleId = item.getAttribute('data-module');
                if (moduleId) {
                    this.selectedModule = moduleId;
                    this.updateUI(container);
                }
            });
        });
        
        // Module enable/disable
        container.querySelectorAll('.module-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                e.stopPropagation();
                const moduleId = (e.target as HTMLInputElement).getAttribute('data-module');
                const enabled = (e.target as HTMLInputElement).checked;
                this.toggleModule(moduleId!, enabled);
            });
        });
        
        // Property inputs
        container.querySelectorAll('.property-input, .property-select, .property-checkbox').forEach(input => {
            input.addEventListener('change', () => {
                this.updatePropertyFromInput(input as HTMLInputElement | HTMLSelectElement);
            });
        });
        
        // Preview controls
        container.querySelector('#btn-play')?.addEventListener('click', () => {
            this.previewPlaying = true;
            this.events.emit('particle:play', {});
            this.updateUI(container);
        });
        
        container.querySelector('#btn-stop')?.addEventListener('click', () => {
            this.previewPlaying = false;
            this.events.emit('particle:stop', {});
            this.updateUI(container);
        });
        
        container.querySelector('#btn-restart')?.addEventListener('click', () => {
            this.events.emit('particle:restart', {});
        });
        
        container.querySelector('#btn-speed')?.addEventListener('click', () => {
            this.previewSpeed = this.previewSpeed >= 2 ? 0.25 : this.previewSpeed * 2;
            this.events.emit('particle:speed', { speed: this.previewSpeed });
            this.updateUI(container);
        });
        
        container.querySelector('#btn-bounds')?.addEventListener('click', () => {
            this.showBounds = !this.showBounds;
            this.events.emit('particle:toggleBounds', { show: this.showBounds });
            this.updateUI(container);
        });
        
        container.querySelector('#btn-wireframe')?.addEventListener('click', () => {
            this.showWireframe = !this.showWireframe;
            this.events.emit('particle:toggleWireframe', { show: this.showWireframe });
            this.updateUI(container);
        });
        
        // Add burst
        container.querySelector('#add-burst')?.addEventListener('click', () => {
            if (this.currentEmitter) {
                if (!this.currentEmitter.bursts) {
                    this.currentEmitter.bursts = [];
                }
                this.currentEmitter.bursts.push({
                    time: 0,
                    count: { min: 10, max: 20 },
                    cycles: 1,
                    interval: 0.01,
                    probability: 1
                });
                this.updateUI(container);
            }
        });
        
        // Export
        container.querySelector('#btn-export')?.addEventListener('click', () => {
            this.exportEmitter();
        });
        
        // Tab switching
        container.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const tabName = tab.getAttribute('data-tab');
                container.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                
                if (tabName === 'presets') {
                    this.showPresets(container);
                } else {
                    this.showModules(container);
                }
            });
        });
    }
    
    private updateUI(container: HTMLElement): void {
        const moduleList = container.querySelector('#module-list');
        if (moduleList) {
            moduleList.innerHTML = this.renderModuleList();
        }
        
        const moduleContent = container.querySelector('#module-content');
        if (moduleContent) {
            moduleContent.innerHTML = this.renderModuleContent();
        }
        
        // Re-attach event listeners
        this.setupEventListeners(container);
    }
    
    private toggleModule(moduleId: string, enabled: boolean): void {
        if (!this.currentEmitter) return;
        
        switch (moduleId) {
            case 'velocity':
                this.currentEmitter.velocityOverLifetime.enabled = enabled;
                break;
            case 'force':
                this.currentEmitter.forceOverLifetime.enabled = enabled;
                break;
            case 'color':
                this.currentEmitter.colorOverLifetime.enabled = enabled;
                break;
            case 'size':
                this.currentEmitter.sizeOverLifetime.enabled = enabled;
                break;
            case 'rotation':
                this.currentEmitter.rotationOverLifetime.enabled = enabled;
                break;
            case 'noise':
                this.currentEmitter.noise.enabled = enabled;
                break;
            case 'collision':
                this.currentEmitter.collision.enabled = enabled;
                break;
            case 'subemitters':
                this.currentEmitter.subEmitters.enabled = enabled;
                break;
            case 'texturesheet':
                this.currentEmitter.textureSheet.enabled = enabled;
                break;
            case 'trails':
                this.currentEmitter.trails.enabled = enabled;
                break;
        }
        
        this.events.emit('particle:moduleToggled', { moduleId, enabled });
    }
    
    private updatePropertyFromInput(input: HTMLInputElement | HTMLSelectElement): void {
        const prop = input.getAttribute('data-prop');
        if (!prop || !this.currentEmitter) return;
        
        let value: unknown;
        if (input.type === 'checkbox') {
            value = (input as HTMLInputElement).checked;
        } else if (input.type === 'number' || input.type === 'range') {
            value = parseFloat(input.value);
        } else {
            value = input.value;
        }
        
        // Set nested property
        const parts = prop.split('.');
        let obj: Record<string, unknown> = this.currentEmitter as unknown as Record<string, unknown>;
        for (let i = 0; i < parts.length - 1; i++) {
            obj = obj[parts[i]] as Record<string, unknown>;
        }
        obj[parts[parts.length - 1]] = value;
        
        this.events.emit('particle:propertyChanged', { property: prop, value });
    }
    
    private showPresets(container: HTMLElement): void {
        const moduleList = container.querySelector('#module-list');
        const moduleContent = container.querySelector('#module-content');
        
        if (moduleList) moduleList.innerHTML = '';
        if (moduleContent) {
            moduleContent.innerHTML = `
                <div class="preset-grid">
                    ${this.presets.map(preset => `
                        <div class="preset-item" data-preset="${preset.name}">
                            <span class="preset-icon">${preset.thumbnail}</span>
                            <span class="preset-name">${preset.name}</span>
                        </div>
                    `).join('')}
                </div>
            `;
            
            moduleContent.querySelectorAll('.preset-item').forEach(item => {
                item.addEventListener('click', () => {
                    const presetName = item.getAttribute('data-preset');
                    const preset = this.presets.find(p => p.name === presetName);
                    if (preset) {
                        this.applyPreset(preset);
                    }
                });
            });
        }
    }
    
    private showModules(container: HTMLElement): void {
        this.updateUI(container);
    }
    
    private applyPreset(preset: ParticlePreset): void {
        if (this.currentEmitter) {
            Object.assign(this.currentEmitter, preset.config);
            this.events.emit('particle:presetApplied', { preset: preset.name });
            
            if (this.container) {
                this.updateUI(this.container);
            }
        }
    }
    
    private exportEmitter(): void {
        if (!this.currentEmitter) return;
        
        const blob = new Blob([JSON.stringify(this.currentEmitter, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${this.currentEmitter.name || 'particle-system'}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }
    
    private createDefaultEmitter(): void {
        this.currentEmitter = {
            name: 'New Particle System',
            enabled: true,
            duration: 5,
            looping: true,
            prewarm: false,
            startDelay: 0,
            startDelayMultiplier: 1,
            rateOverTime: 10,
            rateOverDistance: 0,
            bursts: [],
            shape: 'cone',
            shapeParams: { angle: 25, radius: 1, length: 5 },
            startLifetime: { min: 3, max: 5 },
            startSpeed: { min: 1, max: 3 },
            startSize: { min: 0.5, max: 1 },
            startSize3D: false,
            startSizeXYZ: { x: { min: 1, max: 1 }, y: { min: 1, max: 1 }, z: { min: 1, max: 1 } },
            startRotation: { min: 0, max: 360 },
            startRotation3D: false,
            startRotationXYZ: { x: { min: 0, max: 0 }, y: { min: 0, max: 0 }, z: { min: 0, max: 0 } },
            startColor: [{ time: 0, color: '#ffffff', alpha: 1 }],
            gravityModifier: 0,
            simulationSpace: 'local',
            simulationSpeed: 1,
            scalingMode: 'local',
            maxParticles: 1000,
            velocityOverLifetime: { enabled: false, space: 'local', x: { type: 'constant', value: 0, curve: [] }, y: { type: 'constant', value: 0, curve: [] }, z: { type: 'constant', value: 0, curve: [] } },
            forceOverLifetime: { enabled: false, space: 'local', x: { type: 'constant', value: 0, curve: [] }, y: { type: 'constant', value: 0, curve: [] }, z: { type: 'constant', value: 0, curve: [] } },
            colorOverLifetime: { enabled: true, gradient: [{ time: 0, color: '#ffffff', alpha: 1 }, { time: 1, color: '#ffffff', alpha: 0 }] },
            sizeOverLifetime: { enabled: false, separateAxes: false, size: { type: 'constant', value: 1, curve: [] }, sizeX: { type: 'constant', value: 1, curve: [] }, sizeY: { type: 'constant', value: 1, curve: [] }, sizeZ: { type: 'constant', value: 1, curve: [] } },
            rotationOverLifetime: { enabled: false, separateAxes: false, angularVelocity: { type: 'constant', value: 0, curve: [] }, x: { type: 'constant', value: 0, curve: [] }, y: { type: 'constant', value: 0, curve: [] }, z: { type: 'constant', value: 0, curve: [] } },
            noise: { enabled: false, strength: 1, frequency: 0.5, scrollSpeed: 0, damping: true, octaves: 1, remap: { min: -1, max: 1 }, positionAmount: 1, rotationAmount: 0, sizeAmount: 0 },
            collision: { enabled: false, type: 'world', mode: '3d', dampen: 0, bounce: 0.5, lifetimeLoss: 0, minKillSpeed: 0, radiusScale: 1, collidesWith: ['Default'], maxCollisionShapes: 256, quality: 'medium', sendCollisionMessages: false },
            subEmitters: { enabled: false, birth: [], collision: [], death: [] },
            textureSheet: { enabled: false, tiles: { x: 1, y: 1 }, animation: 'wholeSheet', rowIndex: 0, timeMode: 'lifetime', frameOverTime: { type: 'constant', curve: [] }, startFrame: { min: 0, max: 0 }, cycles: 1, fps: 30 },
            trails: { enabled: false, ratio: 1, lifetime: 1, minimumVertexDistance: 0.2, worldSpace: false, dieWithParticles: true, textureMode: 'stretch', sizeAffectsWidth: true, sizeAffectsLifetime: false, inheritParticleColor: true, colorOverLifetime: [], widthOverTrail: { type: 'constant', curve: [] }, colorOverTrail: [], generateLightingData: false, shadowBias: 0 },
            renderer: { renderMode: 'billboard', normalDirection: 1, material: '', trailMaterial: '', sortMode: 'none', sortingFudge: 0, minParticleSize: 0, maxParticleSize: 0.5, alignment: 'view', flip: { x: 0, y: 0, z: 0 }, pivot: new Vector3(), visualizeInvertedBounds: false, renderAlignment: 'view', cameraVelocityScale: 0, velocityScale: 0, lengthScale: 2, freeformStretching: false, rotateWithStretchDirection: true, mesh: '', meshCount: 1, castShadows: 'off', receiveShadows: false, shadowBias: 0, motionVectors: 'camera', lightProbeUsage: 'off', reflectionProbeUsage: 'off' }
        };
    }
    
    // Preset creators
    private createFirePreset(): Partial<ParticleEmitterConfig> {
        return {
            rateOverTime: 50,
            shape: 'cone',
            shapeParams: { angle: 10, radius: 0.5, length: 2 },
            startLifetime: { min: 0.5, max: 1.5 },
            startSpeed: { min: 2, max: 4 },
            startSize: { min: 0.3, max: 0.8 },
            gravityModifier: -0.5,
            colorOverLifetime: {
                enabled: true,
                gradient: [
                    { time: 0, color: '#ffff00', alpha: 1 },
                    { time: 0.3, color: '#ff8800', alpha: 1 },
                    { time: 0.7, color: '#ff4400', alpha: 0.8 },
                    { time: 1, color: '#440000', alpha: 0 }
                ]
            }
        };
    }
    
    private createSmokePreset(): Partial<ParticleEmitterConfig> {
        return {
            rateOverTime: 20,
            shape: 'cone',
            shapeParams: { angle: 15, radius: 0.3, length: 1 },
            startLifetime: { min: 3, max: 5 },
            startSpeed: { min: 0.5, max: 1 },
            startSize: { min: 0.5, max: 1.5 },
            gravityModifier: -0.1,
            sizeOverLifetime: { enabled: true, separateAxes: false, size: { type: 'linear', value: 2, curve: [{ time: 0, value: 0.5 }, { time: 1, value: 2 }] }, sizeX: { type: 'constant', value: 1, curve: [] }, sizeY: { type: 'constant', value: 1, curve: [] }, sizeZ: { type: 'constant', value: 1, curve: [] } },
            colorOverLifetime: {
                enabled: true,
                gradient: [
                    { time: 0, color: '#888888', alpha: 0.8 },
                    { time: 0.5, color: '#666666', alpha: 0.5 },
                    { time: 1, color: '#444444', alpha: 0 }
                ]
            }
        };
    }
    
    private createSparksPreset(): Partial<ParticleEmitterConfig> {
        return {
            rateOverTime: 100,
            shape: 'sphere',
            shapeParams: { radius: 0.1 },
            startLifetime: { min: 0.3, max: 0.8 },
            startSpeed: { min: 5, max: 10 },
            startSize: { min: 0.02, max: 0.05 },
            gravityModifier: 1,
            colorOverLifetime: {
                enabled: true,
                gradient: [
                    { time: 0, color: '#ffff88', alpha: 1 },
                    { time: 0.5, color: '#ff8844', alpha: 1 },
                    { time: 1, color: '#ff4400', alpha: 0 }
                ]
            },
            trails: { enabled: true, ratio: 0.5, lifetime: 0.2, minimumVertexDistance: 0.02, worldSpace: true, dieWithParticles: true, textureMode: 'stretch', sizeAffectsWidth: true, sizeAffectsLifetime: false, inheritParticleColor: true, colorOverLifetime: [], widthOverTrail: { type: 'constant', curve: [] }, colorOverTrail: [], generateLightingData: false, shadowBias: 0 }
        };
    }
    
    private createMagicPreset(): Partial<ParticleEmitterConfig> {
        return {
            rateOverTime: 30,
            shape: 'sphere',
            shapeParams: { radius: 1, radiusThickness: 0 },
            startLifetime: { min: 1, max: 2 },
            startSpeed: { min: 0, max: 0.5 },
            startSize: { min: 0.1, max: 0.3 },
            noise: { enabled: true, strength: 2, frequency: 1, scrollSpeed: 0.5, damping: true, octaves: 2, remap: { min: -1, max: 1 }, positionAmount: 1, rotationAmount: 0, sizeAmount: 0 },
            colorOverLifetime: {
                enabled: true,
                gradient: [
                    { time: 0, color: '#8844ff', alpha: 0 },
                    { time: 0.2, color: '#8844ff', alpha: 1 },
                    { time: 0.8, color: '#44aaff', alpha: 1 },
                    { time: 1, color: '#44ffff', alpha: 0 }
                ]
            }
        };
    }
    
    private createRainPreset(): Partial<ParticleEmitterConfig> {
        return {
            rateOverTime: 500,
            shape: 'box',
            shapeParams: { boxSize: new Vector3(20, 0.1, 20) },
            startLifetime: { min: 0.5, max: 1 },
            startSpeed: { min: 20, max: 30 },
            startSize: { min: 0.02, max: 0.04 },
            startRotation: { min: 0, max: 0 },
            gravityModifier: 0,
            simulationSpace: 'world',
            renderer: { renderMode: 'stretchedBillboard', normalDirection: 1, material: '', trailMaterial: '', sortMode: 'none', sortingFudge: 0, minParticleSize: 0, maxParticleSize: 0.5, alignment: 'view', flip: { x: 0, y: 0, z: 0 }, pivot: new Vector3(), visualizeInvertedBounds: false, renderAlignment: 'view', cameraVelocityScale: 0, velocityScale: 0.1, lengthScale: 4, freeformStretching: false, rotateWithStretchDirection: true, mesh: '', meshCount: 1, castShadows: 'off', receiveShadows: false, shadowBias: 0, motionVectors: 'camera', lightProbeUsage: 'off', reflectionProbeUsage: 'off' },
            colorOverLifetime: {
                enabled: true,
                gradient: [
                    { time: 0, color: '#aaddff', alpha: 0.3 },
                    { time: 1, color: '#aaddff', alpha: 0 }
                ]
            }
        };
    }
    
    private createSnowPreset(): Partial<ParticleEmitterConfig> {
        return {
            rateOverTime: 100,
            shape: 'box',
            shapeParams: { boxSize: new Vector3(20, 0.1, 20) },
            startLifetime: { min: 5, max: 10 },
            startSpeed: { min: 0.5, max: 1 },
            startSize: { min: 0.05, max: 0.15 },
            startRotation: { min: 0, max: 360 },
            gravityModifier: 0.1,
            simulationSpace: 'world',
            noise: { enabled: true, strength: 0.5, frequency: 0.5, scrollSpeed: 0.2, damping: false, octaves: 1, remap: { min: -1, max: 1 }, positionAmount: 1, rotationAmount: 0.5, sizeAmount: 0 },
            rotationOverLifetime: { enabled: true, separateAxes: false, angularVelocity: { type: 'constant', value: 45, curve: [] }, x: { type: 'constant', value: 0, curve: [] }, y: { type: 'constant', value: 0, curve: [] }, z: { type: 'constant', value: 0, curve: [] } },
            colorOverLifetime: {
                enabled: true,
                gradient: [
                    { time: 0, color: '#ffffff', alpha: 0 },
                    { time: 0.1, color: '#ffffff', alpha: 0.8 },
                    { time: 0.9, color: '#ffffff', alpha: 0.8 },
                    { time: 1, color: '#ffffff', alpha: 0 }
                ]
            }
        };
    }
    
    private createExplosionPreset(): Partial<ParticleEmitterConfig> {
        return {
            duration: 1,
            looping: false,
            rateOverTime: 0,
            bursts: [{ time: 0, count: { min: 50, max: 100 }, cycles: 1, interval: 0, probability: 1 }],
            shape: 'sphere',
            shapeParams: { radius: 0.5 },
            startLifetime: { min: 0.5, max: 1.5 },
            startSpeed: { min: 5, max: 15 },
            startSize: { min: 0.2, max: 0.5 },
            gravityModifier: 1,
            sizeOverLifetime: { enabled: true, separateAxes: false, size: { type: 'curve', value: 1, curve: [{ time: 0, value: 1 }, { time: 1, value: 0 }] }, sizeX: { type: 'constant', value: 1, curve: [] }, sizeY: { type: 'constant', value: 1, curve: [] }, sizeZ: { type: 'constant', value: 1, curve: [] } },
            colorOverLifetime: {
                enabled: true,
                gradient: [
                    { time: 0, color: '#ffffff', alpha: 1 },
                    { time: 0.1, color: '#ffff00', alpha: 1 },
                    { time: 0.3, color: '#ff8800', alpha: 1 },
                    { time: 0.6, color: '#ff4400', alpha: 0.8 },
                    { time: 1, color: '#440000', alpha: 0 }
                ]
            }
        };
    }
    
    private createDustPreset(): Partial<ParticleEmitterConfig> {
        return {
            rateOverTime: 5,
            shape: 'box',
            shapeParams: { boxSize: new Vector3(10, 5, 10) },
            startLifetime: { min: 5, max: 10 },
            startSpeed: { min: 0, max: 0.1 },
            startSize: { min: 0.01, max: 0.03 },
            gravityModifier: 0,
            noise: { enabled: true, strength: 0.3, frequency: 0.2, scrollSpeed: 0.1, damping: false, octaves: 1, remap: { min: -1, max: 1 }, positionAmount: 1, rotationAmount: 0, sizeAmount: 0 },
            colorOverLifetime: {
                enabled: true,
                gradient: [
                    { time: 0, color: '#ffffff', alpha: 0 },
                    { time: 0.2, color: '#ffffff', alpha: 0.3 },
                    { time: 0.8, color: '#ffffff', alpha: 0.3 },
                    { time: 1, color: '#ffffff', alpha: 0 }
                ]
            }
        };
    }
}
