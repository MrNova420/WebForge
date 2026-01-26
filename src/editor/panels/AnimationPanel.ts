/**
 * @fileoverview Animation Panel - Timeline and State Machine Editor
 * @module editor/panels
 * 
 * Provides animation editing capabilities including:
 * - Timeline keyframe editor
 * - Curve editor for interpolation
 * - Animation state machine designer
 * - Blend tree configuration
 * 
 * @author MrNova420
 * @license MIT
 */

import { Panel } from '../Panel';
import { Logger } from '../../core/Logger';

/**
 * Animation keyframe
 */
export interface EditorKeyframe {
    time: number;
    value: number;
    inTangent: number;
    outTangent: number;
    interpolation: 'linear' | 'bezier' | 'step';
}

/**
 * Animation track for a single property
 */
export interface EditorAnimationTrack {
    id: string;
    name: string;
    property: string; // e.g., "transform.position.x"
    keyframes: EditorKeyframe[];
    muted: boolean;
    locked: boolean;
    color: string;
}

/**
 * Animation clip containing multiple tracks
 */
export interface EditorAnimationClip {
    id: string;
    name: string;
    duration: number;
    frameRate: number;
    tracks: EditorAnimationTrack[];
    loop: boolean;
}

/**
 * Animation state in state machine
 */
export interface EditorAnimationState {
    id: string;
    name: string;
    clip: string | null;
    x: number;
    y: number;
    speed: number;
    loop: boolean;
    isEntry: boolean;
    isExit: boolean;
}

/**
 * State machine transition
 */
export interface EditorStateTransition {
    id: string;
    from: string;
    to: string;
    duration: number;
    conditions: TransitionCondition[];
}

/**
 * Transition condition
 */
export interface TransitionCondition {
    parameter: string;
    comparison: '==' | '!=' | '>' | '<' | '>=' | '<=';
    value: number | boolean;
}

/**
 * Animation parameter
 */
export interface EditorAnimationParameter {
    name: string;
    type: 'float' | 'int' | 'bool' | 'trigger';
    defaultValue: number | boolean;
}

/**
 * Animation Panel
 * 
 * Comprehensive animation editing interface with timeline and state machine views.
 */
export class AnimationPanel extends Panel {
    private logger: Logger;
    
    // Current animation clip
    private currentClip: EditorAnimationClip | null = null;
    
    // Timeline state
    private currentTime: number = 0;
    private isPlaying: boolean = false;
    private playbackSpeed: number = 1;
    private zoom: number = 1;
    private scrollX: number = 0;
    
    // Selection
    private selectedTrack: string | null = null;
    private selectedKeyframes: Set<string> = new Set();
    
    // Canvas elements
    private timelineCanvas: HTMLCanvasElement | null = null;
    private timelineCtx: CanvasRenderingContext2D | null = null;
    private curveCanvas: HTMLCanvasElement | null = null;
    private curveCtx: CanvasRenderingContext2D | null = null;
    
    // View mode
    private viewMode: 'timeline' | 'curves' | 'statemachine' = 'timeline';
    
    // State machine data
    private states: Map<string, EditorAnimationState> = new Map();
    private transitions: Map<string, EditorStateTransition> = new Map();
    private parameters: EditorAnimationParameter[] = [];
    
    // State machine canvas
    private smCanvas: HTMLCanvasElement | null = null;
    private smCtx: CanvasRenderingContext2D | null = null;
    private smPanX: number = 0;
    private smPanY: number = 0;
    private smZoom: number = 1;
    
    // Animation loop
    private animationFrameId: number | null = null;
    private lastUpdateTime: number = 0;
    
    constructor() {
        super('animation', 'Animation');
        this.logger = new Logger('AnimationPanel');
    }
    
    /**
     * Render panel content
     */
    protected onMount(_container: HTMLElement): void {
        if (!this.container) return;
        
        this.container.innerHTML = `
            <div class="anim-container">
                <div class="anim-toolbar">
                    <div class="anim-toolbar-section">
                        <button class="anim-btn" id="anim-new" title="New Clip">📄</button>
                        <button class="anim-btn" id="anim-save" title="Save">💾</button>
                        <button class="anim-btn" id="anim-load" title="Load">📂</button>
                        <span class="anim-separator">|</span>
                        <select id="anim-clip-select" class="anim-select">
                            <option value="">No Animation</option>
                        </select>
                    </div>
                    <div class="anim-toolbar-section anim-playback">
                        <button class="anim-btn" id="anim-first" title="First Frame">⏮</button>
                        <button class="anim-btn" id="anim-prev" title="Previous Frame">◀</button>
                        <button class="anim-btn" id="anim-play" title="Play/Pause">▶</button>
                        <button class="anim-btn" id="anim-next" title="Next Frame">▶</button>
                        <button class="anim-btn" id="anim-last" title="Last Frame">⏭</button>
                        <span class="anim-time-display">
                            <input type="number" id="anim-time-input" value="0" step="0.01" min="0">
                            <span>/</span>
                            <span id="anim-duration">0.00</span>
                        </span>
                    </div>
                    <div class="anim-toolbar-section">
                        <button class="anim-btn ${this.viewMode === 'timeline' ? 'active' : ''}" data-view="timeline" title="Timeline View">📊</button>
                        <button class="anim-btn ${this.viewMode === 'curves' ? 'active' : ''}" data-view="curves" title="Curve Editor">📈</button>
                        <button class="anim-btn ${this.viewMode === 'statemachine' ? 'active' : ''}" data-view="statemachine" title="State Machine">🔄</button>
                    </div>
                </div>
                
                <div class="anim-content">
                    <!-- Timeline View -->
                    <div class="anim-view anim-timeline-view ${this.viewMode === 'timeline' ? 'active' : ''}">
                        <div class="anim-tracks-sidebar">
                            <div class="anim-tracks-header">
                                <span>Tracks</span>
                                <button class="anim-btn-small" id="anim-add-track" title="Add Track">+</button>
                            </div>
                            <div class="anim-tracks-list" id="anim-tracks-list">
                                <!-- Tracks populated by code -->
                            </div>
                        </div>
                        <div class="anim-timeline-area">
                            <div class="anim-timeline-header">
                                <canvas id="anim-timeline-ruler"></canvas>
                            </div>
                            <div class="anim-timeline-body">
                                <canvas id="anim-timeline-canvas"></canvas>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Curve Editor View -->
                    <div class="anim-view anim-curves-view ${this.viewMode === 'curves' ? 'active' : ''}">
                        <div class="anim-curves-sidebar">
                            <div class="anim-curves-header">Properties</div>
                            <div class="anim-curves-list" id="anim-curves-list">
                                <!-- Property list populated by code -->
                            </div>
                        </div>
                        <div class="anim-curves-area">
                            <canvas id="anim-curves-canvas"></canvas>
                        </div>
                    </div>
                    
                    <!-- State Machine View -->
                    <div class="anim-view anim-sm-view ${this.viewMode === 'statemachine' ? 'active' : ''}">
                        <div class="anim-sm-sidebar">
                            <div class="anim-sm-section">
                                <div class="anim-sm-section-header">Parameters</div>
                                <div class="anim-params-list" id="anim-params-list">
                                    <!-- Parameters populated by code -->
                                </div>
                                <button class="anim-btn-small" id="anim-add-param">+ Add Parameter</button>
                            </div>
                            <div class="anim-sm-section">
                                <div class="anim-sm-section-header">States</div>
                                <div class="anim-states-list" id="anim-states-list">
                                    <!-- States populated by code -->
                                </div>
                                <button class="anim-btn-small" id="anim-add-state">+ Add State</button>
                            </div>
                        </div>
                        <div class="anim-sm-area">
                            <canvas id="anim-sm-canvas"></canvas>
                        </div>
                    </div>
                </div>
                
                <!-- EditorKeyframe Properties (shown when keyframe selected) -->
                <div class="anim-keyframe-panel" id="anim-keyframe-panel" style="display: none;">
                    <div class="anim-kf-header">EditorKeyframe Properties</div>
                    <div class="anim-kf-content">
                        <div class="anim-kf-row">
                            <label>Time:</label>
                            <input type="number" id="kf-time" step="0.01">
                        </div>
                        <div class="anim-kf-row">
                            <label>Value:</label>
                            <input type="number" id="kf-value" step="0.01">
                        </div>
                        <div class="anim-kf-row">
                            <label>Interpolation:</label>
                            <select id="kf-interp">
                                <option value="linear">Linear</option>
                                <option value="bezier">Bezier</option>
                                <option value="step">Step</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        this.setupStyles();
        this.setupCanvases();
        this.setupEvents();
        this.renderCurrentView();
    }
    
    /**
     * Setup CSS styles
     */
    private setupStyles(): void {
        if (!this.container) return;
        
        const style = document.createElement('style');
        style.textContent = `
            .anim-container {
                display: flex;
                flex-direction: column;
                height: 100%;
                background: #1a1a2e;
                color: #ffffff;
            }
            .anim-toolbar {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 6px 10px;
                background: #252538;
                border-bottom: 1px solid #3a3a5a;
            }
            .anim-toolbar-section {
                display: flex;
                align-items: center;
                gap: 4px;
            }
            .anim-btn {
                padding: 4px 8px;
                background: #3a3a5a;
                border: 1px solid #4a4a6a;
                border-radius: 4px;
                color: #ffffff;
                cursor: pointer;
                font-size: 14px;
            }
            .anim-btn:hover { background: #4a4a6a; }
            .anim-btn.active { background: #5a5a8a; border-color: #7a7aaa; }
            .anim-btn-small {
                padding: 2px 6px;
                background: #3a3a5a;
                border: 1px solid #4a4a6a;
                border-radius: 3px;
                color: #ffffff;
                cursor: pointer;
                font-size: 11px;
            }
            .anim-separator {
                color: #4a4a6a;
                margin: 0 4px;
            }
            .anim-select {
                padding: 4px 8px;
                background: #2a2a4a;
                border: 1px solid #3a3a5a;
                border-radius: 4px;
                color: #ffffff;
                font-size: 12px;
                min-width: 150px;
            }
            .anim-time-display {
                display: flex;
                align-items: center;
                gap: 4px;
                font-size: 12px;
                color: #aaaacc;
            }
            .anim-time-display input {
                width: 60px;
                padding: 2px 4px;
                background: #2a2a4a;
                border: 1px solid #3a3a5a;
                border-radius: 3px;
                color: #ffffff;
                font-size: 11px;
            }
            .anim-content {
                flex: 1;
                overflow: hidden;
            }
            .anim-view {
                display: none;
                height: 100%;
            }
            .anim-view.active { display: flex; }
            
            /* Timeline View */
            .anim-timeline-view {
                flex-direction: row;
            }
            .anim-tracks-sidebar {
                width: 180px;
                background: #202030;
                border-right: 1px solid #3a3a5a;
                display: flex;
                flex-direction: column;
            }
            .anim-tracks-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 8px 10px;
                background: #252538;
                border-bottom: 1px solid #3a3a5a;
                font-weight: bold;
                font-size: 12px;
            }
            .anim-tracks-list {
                flex: 1;
                overflow-y: auto;
            }
            .anim-track-item {
                display: flex;
                align-items: center;
                padding: 6px 10px;
                border-bottom: 1px solid #2a2a4a;
                cursor: pointer;
                font-size: 11px;
            }
            .anim-track-item:hover { background: #2a2a4a; }
            .anim-track-item.selected { background: #3a3a5a; }
            .anim-track-color {
                width: 12px;
                height: 12px;
                border-radius: 2px;
                margin-right: 8px;
            }
            .anim-track-name { flex: 1; }
            .anim-track-actions {
                display: flex;
                gap: 4px;
            }
            .anim-track-action {
                opacity: 0.5;
                cursor: pointer;
                font-size: 10px;
            }
            .anim-track-action:hover { opacity: 1; }
            .anim-timeline-area {
                flex: 1;
                display: flex;
                flex-direction: column;
                overflow: hidden;
            }
            .anim-timeline-header {
                height: 24px;
                background: #252538;
                border-bottom: 1px solid #3a3a5a;
            }
            .anim-timeline-body {
                flex: 1;
                position: relative;
                overflow: hidden;
            }
            #anim-timeline-ruler,
            #anim-timeline-canvas,
            #anim-curves-canvas,
            #anim-sm-canvas {
                display: block;
                width: 100%;
                height: 100%;
            }
            
            /* Curve Editor */
            .anim-curves-view {
                flex-direction: row;
            }
            .anim-curves-sidebar {
                width: 150px;
                background: #202030;
                border-right: 1px solid #3a3a5a;
            }
            .anim-curves-header {
                padding: 8px 10px;
                background: #252538;
                border-bottom: 1px solid #3a3a5a;
                font-weight: bold;
                font-size: 12px;
            }
            .anim-curves-list {
                padding: 8px;
            }
            .anim-curve-item {
                display: flex;
                align-items: center;
                padding: 4px;
                margin-bottom: 4px;
                border-radius: 3px;
                cursor: pointer;
                font-size: 11px;
            }
            .anim-curve-item:hover { background: #2a2a4a; }
            .anim-curve-item.selected { background: #3a3a5a; }
            .anim-curves-area {
                flex: 1;
                position: relative;
            }
            
            /* State Machine */
            .anim-sm-view {
                flex-direction: row;
            }
            .anim-sm-sidebar {
                width: 200px;
                background: #202030;
                border-right: 1px solid #3a3a5a;
                overflow-y: auto;
            }
            .anim-sm-section {
                border-bottom: 1px solid #3a3a5a;
                padding: 8px;
            }
            .anim-sm-section-header {
                font-weight: bold;
                font-size: 11px;
                margin-bottom: 8px;
                color: #8888aa;
            }
            .anim-params-list, .anim-states-list {
                margin-bottom: 8px;
            }
            .anim-param-item, .anim-state-item {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 4px 6px;
                margin-bottom: 4px;
                background: #2a2a4a;
                border-radius: 3px;
                font-size: 11px;
            }
            .anim-sm-area {
                flex: 1;
                position: relative;
            }
            
            /* EditorKeyframe Panel */
            .anim-keyframe-panel {
                position: absolute;
                right: 10px;
                bottom: 10px;
                width: 200px;
                background: #252538;
                border: 1px solid #3a3a5a;
                border-radius: 6px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            }
            .anim-kf-header {
                padding: 8px 10px;
                background: #2a2a4a;
                border-bottom: 1px solid #3a3a5a;
                font-weight: bold;
                font-size: 11px;
                border-radius: 5px 5px 0 0;
            }
            .anim-kf-content {
                padding: 10px;
            }
            .anim-kf-row {
                display: flex;
                align-items: center;
                margin-bottom: 8px;
            }
            .anim-kf-row label {
                width: 80px;
                font-size: 11px;
                color: #aaaacc;
            }
            .anim-kf-row input, .anim-kf-row select {
                flex: 1;
                padding: 4px 6px;
                background: #2a2a4a;
                border: 1px solid #3a3a5a;
                border-radius: 3px;
                color: #ffffff;
                font-size: 11px;
            }
        `;
        this.container.appendChild(style);
    }
    
    /**
     * Setup canvas elements
     */
    private setupCanvases(): void {
        // Timeline canvases
        const timelineCanvas = this.container?.querySelector('#anim-timeline-canvas') as HTMLCanvasElement;
        if (timelineCanvas) {
            this.timelineCanvas = timelineCanvas;
            this.timelineCtx = timelineCanvas.getContext('2d');
            this.resizeCanvas(timelineCanvas);
        }
        
        // Curve canvas
        const curveCanvas = this.container?.querySelector('#anim-curves-canvas') as HTMLCanvasElement;
        if (curveCanvas) {
            this.curveCanvas = curveCanvas;
            this.curveCtx = curveCanvas.getContext('2d');
            this.resizeCanvas(curveCanvas);
        }
        
        // State machine canvas
        const smCanvas = this.container?.querySelector('#anim-sm-canvas') as HTMLCanvasElement;
        if (smCanvas) {
            this.smCanvas = smCanvas;
            this.smCtx = smCanvas.getContext('2d');
            this.resizeCanvas(smCanvas);
        }
    }
    
    /**
     * Resize canvas to fit parent
     */
    private resizeCanvas(canvas: HTMLCanvasElement): void {
        const parent = canvas.parentElement;
        if (parent) {
            canvas.width = parent.clientWidth;
            canvas.height = parent.clientHeight;
        }
    }
    
    /**
     * Setup event handlers
     */
    private setupEvents(): void {
        if (!this.container) return;
        
        // View mode buttons
        this.container.querySelectorAll('[data-view]').forEach(btn => {
            btn.addEventListener('click', () => {
                this.viewMode = (btn as HTMLElement).dataset.view as 'timeline' | 'curves' | 'statemachine';
                this.container?.querySelectorAll('[data-view]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.container?.querySelectorAll('.anim-view').forEach(v => v.classList.remove('active'));
                this.container?.querySelector(`.anim-${this.viewMode === 'statemachine' ? 'sm' : this.viewMode}-view`)?.classList.add('active');
                this.renderCurrentView();
            });
        });
        
        // Playback controls
        this.container.querySelector('#anim-play')?.addEventListener('click', () => this.togglePlayback());
        this.container.querySelector('#anim-first')?.addEventListener('click', () => this.goToFrame(0));
        this.container.querySelector('#anim-last')?.addEventListener('click', () => this.goToFrame(this.currentClip?.duration || 0));
        this.container.querySelector('#anim-prev')?.addEventListener('click', () => this.stepFrame(-1));
        this.container.querySelector('#anim-next')?.addEventListener('click', () => this.stepFrame(1));
        
        // Time input
        this.container.querySelector('#anim-time-input')?.addEventListener('change', (e) => {
            this.currentTime = parseFloat((e.target as HTMLInputElement).value);
            this.renderCurrentView();
        });
        
        // New clip
        this.container.querySelector('#anim-new')?.addEventListener('click', () => this.createNewClip());
        
        // Add track
        this.container.querySelector('#anim-add-track')?.addEventListener('click', () => this.addTrack());
        
        // Add state
        this.container.querySelector('#anim-add-state')?.addEventListener('click', () => this.addState());
        
        // Add parameter
        this.container.querySelector('#anim-add-param')?.addEventListener('click', () => this.addParameter());
        
        // Timeline canvas events
        if (this.timelineCanvas) {
            this.timelineCanvas.addEventListener('mousedown', this.onTimelineMouseDown.bind(this));
            this.timelineCanvas.addEventListener('mousemove', this.onTimelineMouseMove.bind(this));
            this.timelineCanvas.addEventListener('mouseup', this.onTimelineMouseUp.bind(this));
            this.timelineCanvas.addEventListener('dblclick', this.onTimelineDoubleClick.bind(this));
        }
        
        // State machine canvas events
        if (this.smCanvas) {
            this.smCanvas.addEventListener('mousedown', this.onSMMouseDown.bind(this));
            this.smCanvas.addEventListener('mousemove', this.onSMMouseMove.bind(this));
            this.smCanvas.addEventListener('mouseup', this.onSMMouseUp.bind(this));
        }
        
        // Window resize
        window.addEventListener('resize', () => {
            if (this.timelineCanvas) this.resizeCanvas(this.timelineCanvas);
            if (this.curveCanvas) this.resizeCanvas(this.curveCanvas);
            if (this.smCanvas) this.resizeCanvas(this.smCanvas);
            this.renderCurrentView();
        });
    }
    
    /**
     * Render the current view
     */
    private renderCurrentView(): void {
        switch (this.viewMode) {
            case 'timeline':
                this.renderTimeline();
                break;
            case 'curves':
                this.renderCurves();
                break;
            case 'statemachine':
                this.renderStateMachine();
                break;
        }
    }
    
    /**
     * Render timeline view
     */
    private renderTimeline(): void {
        if (!this.timelineCanvas || !this.timelineCtx) return;
        
        const ctx = this.timelineCtx;
        const width = this.timelineCanvas.width;
        const height = this.timelineCanvas.height;
        
        // Clear
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, 0, width, height);
        
        if (!this.currentClip) {
            ctx.fillStyle = '#666688';
            ctx.font = '14px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('No animation clip loaded', width / 2, height / 2);
            return;
        }
        
        const trackHeight = 30;
        const pixelsPerSecond = 100 * this.zoom;
        
        // Draw grid
        ctx.strokeStyle = '#2a2a4a';
        ctx.lineWidth = 1;
        
        // Vertical time grid
        const timeStep = this.getTimeGridStep();
        for (let t = 0; t <= this.currentClip.duration; t += timeStep) {
            const x = t * pixelsPerSecond - this.scrollX;
            if (x < 0 || x > width) continue;
            
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
            
            // Time label
            ctx.fillStyle = '#666688';
            ctx.font = '10px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(t.toFixed(2) + 's', x, 12);
        }
        
        // Horizontal track separators
        for (let i = 0; i <= this.currentClip.tracks.length; i++) {
            const y = i * trackHeight + 20;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }
        
        // Draw tracks and keyframes
        this.currentClip.tracks.forEach((track, index) => {
            const y = index * trackHeight + 20;
            
            // Track background
            if (track.id === this.selectedTrack) {
                ctx.fillStyle = '#2a2a4a';
                ctx.fillRect(0, y, width, trackHeight);
            }
            
            // Draw keyframes
            track.keyframes.forEach(keyframe => {
                const x = keyframe.time * pixelsPerSecond - this.scrollX;
                if (x < -10 || x > width + 10) return;
                
                const kfY = y + trackHeight / 2;
                const size = 8;
                
                // EditorKeyframe diamond
                ctx.beginPath();
                ctx.moveTo(x, kfY - size);
                ctx.lineTo(x + size, kfY);
                ctx.lineTo(x, kfY + size);
                ctx.lineTo(x - size, kfY);
                ctx.closePath();
                
                ctx.fillStyle = track.color;
                ctx.fill();
                ctx.strokeStyle = this.selectedKeyframes.has(`${track.id}_${keyframe.time}`) ? '#ffffff' : '#000000';
                ctx.lineWidth = 1;
                ctx.stroke();
            });
        });
        
        // Draw playhead
        const playheadX = this.currentTime * pixelsPerSecond - this.scrollX;
        if (playheadX >= 0 && playheadX <= width) {
            ctx.strokeStyle = '#ff4444';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(playheadX, 0);
            ctx.lineTo(playheadX, height);
            ctx.stroke();
            
            // Playhead handle
            ctx.fillStyle = '#ff4444';
            ctx.beginPath();
            ctx.moveTo(playheadX - 6, 0);
            ctx.lineTo(playheadX + 6, 0);
            ctx.lineTo(playheadX, 10);
            ctx.closePath();
            ctx.fill();
        }
        
        // Update track list
        this.updateTrackList();
    }
    
    /**
     * Get time grid step based on zoom
     */
    private getTimeGridStep(): number {
        const steps = [0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10];
        const targetPixels = 50;
        const pixelsPerSecond = 100 * this.zoom;
        
        for (const step of steps) {
            if (step * pixelsPerSecond >= targetPixels) {
                return step;
            }
        }
        return steps[steps.length - 1];
    }
    
    /**
     * Update track list UI
     */
    private updateTrackList(): void {
        const container = this.container?.querySelector('#anim-tracks-list');
        if (!container || !this.currentClip) {
            if (container) container.innerHTML = '';
            return;
        }
        
        container.innerHTML = this.currentClip.tracks.map(track => `
            <div class="anim-track-item ${track.id === this.selectedTrack ? 'selected' : ''}" data-track="${track.id}">
                <div class="anim-track-color" style="background: ${track.color}"></div>
                <span class="anim-track-name">${track.name}</span>
                <div class="anim-track-actions">
                    <span class="anim-track-action" data-action="mute" title="Mute">${track.muted ? '🔇' : '🔊'}</span>
                    <span class="anim-track-action" data-action="lock" title="Lock">${track.locked ? '🔒' : '🔓'}</span>
                </div>
            </div>
        `).join('');
        
        // Track selection
        container.querySelectorAll('.anim-track-item').forEach(item => {
            item.addEventListener('click', () => {
                this.selectedTrack = (item as HTMLElement).dataset.track || null;
                this.renderTimeline();
            });
        });
    }
    
    /**
     * Render curve editor
     */
    private renderCurves(): void {
        if (!this.curveCanvas || !this.curveCtx) return;
        
        const ctx = this.curveCtx;
        const width = this.curveCanvas.width;
        const height = this.curveCanvas.height;
        
        // Clear
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, 0, width, height);
        
        if (!this.currentClip || !this.selectedTrack) {
            ctx.fillStyle = '#666688';
            ctx.font = '14px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('Select a track to edit curves', width / 2, height / 2);
            return;
        }
        
        const track = this.currentClip.tracks.find(t => t.id === this.selectedTrack);
        if (!track) return;
        
        // Grid
        ctx.strokeStyle = '#2a2a4a';
        ctx.lineWidth = 0.5;
        
        // Value grid
        for (let y = 0; y < height; y += 50) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }
        
        // Time grid
        for (let x = 0; x < width; x += 50) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }
        
        // Draw curve
        if (track.keyframes.length > 0) {
            const pixelsPerSecond = width / (this.currentClip.duration || 1);
            const valueRange = this.getValueRange(track);
            const valueScale = height / (valueRange.max - valueRange.min || 1);
            
            ctx.strokeStyle = track.color;
            ctx.lineWidth = 2;
            ctx.beginPath();
            
            for (let i = 0; i < track.keyframes.length; i++) {
                const kf = track.keyframes[i];
                const x = kf.time * pixelsPerSecond;
                const y = height - (kf.value - valueRange.min) * valueScale;
                
                if (i === 0) {
                    ctx.moveTo(x, y);
                } else {
                    const prevKf = track.keyframes[i - 1];
                    const prevX = prevKf.time * pixelsPerSecond;
                    const prevY = height - (prevKf.value - valueRange.min) * valueScale;
                    
                    if (kf.interpolation === 'step') {
                        ctx.lineTo(x, prevY);
                        ctx.lineTo(x, y);
                    } else if (kf.interpolation === 'bezier') {
                        const cp1x = prevX + (x - prevX) * 0.33;
                        const cp2x = prevX + (x - prevX) * 0.67;
                        ctx.bezierCurveTo(cp1x, prevY + prevKf.outTangent * 50, cp2x, y - kf.inTangent * 50, x, y);
                    } else {
                        ctx.lineTo(x, y);
                    }
                }
            }
            ctx.stroke();
            
            // Draw keyframe points
            track.keyframes.forEach(kf => {
                const x = kf.time * pixelsPerSecond;
                const y = height - (kf.value - valueRange.min) * valueScale;
                
                ctx.fillStyle = track.color;
                ctx.beginPath();
                ctx.arc(x, y, 6, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 1;
                ctx.stroke();
            });
        }
        
        // Playhead
        const playheadX = this.currentTime * (width / (this.currentClip.duration || 1));
        ctx.strokeStyle = '#ff4444';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(playheadX, 0);
        ctx.lineTo(playheadX, height);
        ctx.stroke();
    }
    
    /**
     * Get value range for a track
     */
    private getValueRange(track: EditorAnimationTrack): { min: number; max: number } {
        if (track.keyframes.length === 0) return { min: 0, max: 1 };
        
        let min = Infinity, max = -Infinity;
        for (const kf of track.keyframes) {
            min = Math.min(min, kf.value);
            max = Math.max(max, kf.value);
        }
        
        // Add padding
        const range = max - min || 1;
        return { min: min - range * 0.1, max: max + range * 0.1 };
    }
    
    /**
     * Render state machine
     */
    private renderStateMachine(): void {
        if (!this.smCanvas || !this.smCtx) return;
        
        const ctx = this.smCtx;
        const width = this.smCanvas.width;
        const height = this.smCanvas.height;
        
        // Clear
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, 0, width, height);
        
        // Grid
        ctx.strokeStyle = '#222238';
        ctx.lineWidth = 1;
        for (let x = 0; x < width; x += 30) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }
        for (let y = 0; y < height; y += 30) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }
        
        ctx.save();
        ctx.translate(this.smPanX, this.smPanY);
        ctx.scale(this.smZoom, this.smZoom);
        
        // Draw transitions
        for (const transition of this.transitions.values()) {
            const fromState = this.states.get(transition.from);
            const toState = this.states.get(transition.to);
            if (!fromState || !toState) continue;
            
            const startX = fromState.x + 60;
            const startY = fromState.y + 20;
            const endX = toState.x + 60;
            const endY = toState.y + 20;
            
            // Line
            ctx.strokeStyle = '#6666aa';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(startX, startY);
            ctx.lineTo(endX, endY);
            ctx.stroke();
            
            // Arrow
            const angle = Math.atan2(endY - startY, endX - startX);
            const arrowSize = 10;
            const arrowX = (startX + endX) / 2;
            const arrowY = (startY + endY) / 2;
            
            ctx.fillStyle = '#6666aa';
            ctx.beginPath();
            ctx.moveTo(arrowX + arrowSize * Math.cos(angle), arrowY + arrowSize * Math.sin(angle));
            ctx.lineTo(arrowX + arrowSize * Math.cos(angle + 2.5), arrowY + arrowSize * Math.sin(angle + 2.5));
            ctx.lineTo(arrowX + arrowSize * Math.cos(angle - 2.5), arrowY + arrowSize * Math.sin(angle - 2.5));
            ctx.closePath();
            ctx.fill();
        }
        
        // Draw states
        for (const state of this.states.values()) {
            // State box
            const boxWidth = 120;
            const boxHeight = 40;
            
            ctx.fillStyle = state.isEntry ? '#44aa44' : (state.isExit ? '#aa4444' : '#3a3a5c');
            ctx.strokeStyle = '#5a5a8a';
            ctx.lineWidth = 2;
            
            // Rounded rectangle
            const radius = 6;
            ctx.beginPath();
            ctx.moveTo(state.x + radius, state.y);
            ctx.lineTo(state.x + boxWidth - radius, state.y);
            ctx.quadraticCurveTo(state.x + boxWidth, state.y, state.x + boxWidth, state.y + radius);
            ctx.lineTo(state.x + boxWidth, state.y + boxHeight - radius);
            ctx.quadraticCurveTo(state.x + boxWidth, state.y + boxHeight, state.x + boxWidth - radius, state.y + boxHeight);
            ctx.lineTo(state.x + radius, state.y + boxHeight);
            ctx.quadraticCurveTo(state.x, state.y + boxHeight, state.x, state.y + boxHeight - radius);
            ctx.lineTo(state.x, state.y + radius);
            ctx.quadraticCurveTo(state.x, state.y, state.x + radius, state.y);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            
            // State name
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 12px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(state.name, state.x + boxWidth / 2, state.y + boxHeight / 2);
        }
        
        ctx.restore();
        
        // Update sidebar
        this.updateStateMachineSidebar();
    }
    
    /**
     * Update state machine sidebar
     */
    private updateStateMachineSidebar(): void {
        // Parameters
        const paramsContainer = this.container?.querySelector('#anim-params-list');
        if (paramsContainer) {
            paramsContainer.innerHTML = this.parameters.map(param => `
                <div class="anim-param-item">
                    <span>${param.name}</span>
                    <span style="color: #8888aa; font-size: 10px;">${param.type}</span>
                </div>
            `).join('') || '<div style="color: #666688; font-size: 11px;">No parameters</div>';
        }
        
        // States
        const statesContainer = this.container?.querySelector('#anim-states-list');
        if (statesContainer) {
            statesContainer.innerHTML = Array.from(this.states.values()).map(state => `
                <div class="anim-state-item">
                    <span>${state.name}</span>
                    <span style="color: #8888aa; font-size: 10px;">${state.isEntry ? '(Entry)' : state.isExit ? '(Exit)' : ''}</span>
                </div>
            `).join('') || '<div style="color: #666688; font-size: 11px;">No states</div>';
        }
    }
    
    // ========== Playback Controls ==========
    
    /**
     * Toggle playback
     */
    private togglePlayback(): void {
        if (!this.currentClip) return;
        
        this.isPlaying = !this.isPlaying;
        
        const btn = this.container?.querySelector('#anim-play');
        if (btn) {
            btn.textContent = this.isPlaying ? '⏸' : '▶';
        }
        
        if (this.isPlaying) {
            this.lastUpdateTime = performance.now();
            this.animate();
        } else if (this.animationFrameId !== null) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }
    
    /**
     * Animation loop
     */
    private animate(): void {
        if (!this.isPlaying || !this.currentClip) return;
        
        const now = performance.now();
        const delta = (now - this.lastUpdateTime) / 1000;
        this.lastUpdateTime = now;
        
        this.currentTime += delta * this.playbackSpeed;
        
        if (this.currentTime >= this.currentClip.duration) {
            if (this.currentClip.loop) {
                this.currentTime = 0;
            } else {
                this.currentTime = this.currentClip.duration;
                this.togglePlayback();
            }
        }
        
        this.updateTimeDisplay();
        this.renderCurrentView();
        this.events.emit('timeChanged', this.currentTime);
        
        if (this.isPlaying) {
            this.animationFrameId = requestAnimationFrame(() => this.animate());
        }
    }
    
    /**
     * Go to specific frame
     */
    private goToFrame(time: number): void {
        if (!this.currentClip) return;
        this.currentTime = Math.max(0, Math.min(time, this.currentClip.duration));
        this.updateTimeDisplay();
        this.renderCurrentView();
    }
    
    /**
     * Step frame forward or backward
     */
    private stepFrame(direction: number): void {
        if (!this.currentClip) return;
        const frameTime = 1 / this.currentClip.frameRate;
        this.goToFrame(this.currentTime + frameTime * direction);
    }
    
    /**
     * Update time display
     */
    private updateTimeDisplay(): void {
        const input = this.container?.querySelector('#anim-time-input') as HTMLInputElement;
        if (input) input.value = this.currentTime.toFixed(2);
        
        const duration = this.container?.querySelector('#anim-duration');
        if (duration) duration.textContent = (this.currentClip?.duration || 0).toFixed(2);
    }
    
    // ========== Timeline Events ==========
    
    private isDraggingPlayhead = false;
    private isDraggingEditorKeyframe = false;
    private draggedEditorKeyframe: { track: string; time: number } | null = null;
    
    private onTimelineMouseDown(e: MouseEvent): void {
        if (!this.timelineCanvas || !this.currentClip) return;
        
        const rect = this.timelineCanvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const pixelsPerSecond = 100 * this.zoom;
        const clickTime = (x + this.scrollX) / pixelsPerSecond;
        
        // Check if clicking playhead area (top 15px)
        if (y < 15) {
            this.isDraggingPlayhead = true;
            this.goToFrame(clickTime);
            return;
        }
        
        // Check if clicking on a keyframe
        const trackHeight = 30;
        const trackIndex = Math.floor((y - 20) / trackHeight);
        
        if (trackIndex >= 0 && trackIndex < this.currentClip.tracks.length) {
            const track = this.currentClip.tracks[trackIndex];
            
            for (const kf of track.keyframes) {
                const kfX = kf.time * pixelsPerSecond - this.scrollX;
                if (Math.abs(x - kfX) < 8) {
                    this.isDraggingEditorKeyframe = true;
                    this.draggedEditorKeyframe = { track: track.id, time: kf.time };
                    this.selectedKeyframes.clear();
                    this.selectedKeyframes.add(`${track.id}_${kf.time}`);
                    this.showKeyframePanel(kf);
                    return;
                }
            }
        }
        
        // Deselect keyframes if clicking empty space
        this.selectedKeyframes.clear();
        this.hideKeyframePanel();
        this.renderTimeline();
    }
    
    private onTimelineMouseMove(e: MouseEvent): void {
        if (!this.timelineCanvas || !this.currentClip) return;
        
        const rect = this.timelineCanvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const pixelsPerSecond = 100 * this.zoom;
        const time = (x + this.scrollX) / pixelsPerSecond;
        
        if (this.isDraggingPlayhead) {
            this.goToFrame(time);
        } else if (this.isDraggingEditorKeyframe && this.draggedEditorKeyframe) {
            // Move keyframe
            const track = this.currentClip.tracks.find(t => t.id === this.draggedEditorKeyframe!.track);
            if (track) {
                const kf = track.keyframes.find(k => k.time === this.draggedEditorKeyframe!.time);
                if (kf) {
                    kf.time = Math.max(0, Math.min(time, this.currentClip.duration));
                    this.draggedEditorKeyframe.time = kf.time;
                    this.renderTimeline();
                }
            }
        }
    }
    
    private onTimelineMouseUp(_e: MouseEvent): void {
        this.isDraggingPlayhead = false;
        this.isDraggingEditorKeyframe = false;
        this.draggedEditorKeyframe = null;
    }
    
    private onTimelineDoubleClick(e: MouseEvent): void {
        if (!this.timelineCanvas || !this.currentClip) return;
        
        const rect = this.timelineCanvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const pixelsPerSecond = 100 * this.zoom;
        const time = (x + this.scrollX) / pixelsPerSecond;
        const trackHeight = 30;
        const trackIndex = Math.floor((y - 20) / trackHeight);
        
        if (trackIndex >= 0 && trackIndex < this.currentClip.tracks.length) {
            const track = this.currentClip.tracks[trackIndex];
            
            // Add new keyframe
            const newEditorKeyframe: EditorKeyframe = {
                time: time,
                value: 0,
                inTangent: 0,
                outTangent: 0,
                interpolation: 'linear'
            };
            track.keyframes.push(newEditorKeyframe);
            track.keyframes.sort((a, b) => a.time - b.time);
            
            this.renderTimeline();
            this.events.emit('keyframeAdded', { track: track.id, keyframe: newEditorKeyframe });
        }
    }
    
    // ========== State Machine Events ==========
    
    private isDraggingSMState = false;
    private draggedState: string | null = null;
    private smDragOffsetX = 0;
    private smDragOffsetY = 0;
    
    private onSMMouseDown(e: MouseEvent): void {
        if (!this.smCanvas) return;
        
        const rect = this.smCanvas.getBoundingClientRect();
        const x = (e.clientX - rect.left - this.smPanX) / this.smZoom;
        const y = (e.clientY - rect.top - this.smPanY) / this.smZoom;
        
        // Check if clicking on a state
        for (const [id, state] of this.states) {
            if (x >= state.x && x <= state.x + 120 &&
                y >= state.y && y <= state.y + 40) {
                this.isDraggingSMState = true;
                this.draggedState = id;
                this.smDragOffsetX = x - state.x;
                this.smDragOffsetY = y - state.y;
                return;
            }
        }
        
        // Pan
        this.isDraggingSMState = false;
    }
    
    private onSMMouseMove(e: MouseEvent): void {
        if (!this.smCanvas) return;
        
        const rect = this.smCanvas.getBoundingClientRect();
        const x = (e.clientX - rect.left - this.smPanX) / this.smZoom;
        const y = (e.clientY - rect.top - this.smPanY) / this.smZoom;
        
        if (this.isDraggingSMState && this.draggedState) {
            const state = this.states.get(this.draggedState);
            if (state) {
                state.x = x - this.smDragOffsetX;
                state.y = y - this.smDragOffsetY;
                this.renderStateMachine();
            }
        }
    }
    
    private onSMMouseUp(_e: MouseEvent): void {
        this.isDraggingSMState = false;
        this.draggedState = null;
    }
    
    // ========== EditorKeyframe Panel ==========
    
    private showKeyframePanel(kf: EditorKeyframe): void {
        const panel = this.container?.querySelector('#anim-keyframe-panel') as HTMLElement;
        if (!panel) return;
        
        panel.style.display = 'block';
        (panel.querySelector('#kf-time') as HTMLInputElement).value = kf.time.toString();
        (panel.querySelector('#kf-value') as HTMLInputElement).value = kf.value.toString();
        (panel.querySelector('#kf-interp') as HTMLSelectElement).value = kf.interpolation;
    }
    
    private hideKeyframePanel(): void {
        const panel = this.container?.querySelector('#anim-keyframe-panel') as HTMLElement;
        if (panel) panel.style.display = 'none';
    }
    
    // ========== Actions ==========
    
    /**
     * Create a new animation clip
     */
    private createNewClip(): void {
        this.currentClip = {
            id: `clip_${Date.now()}`,
            name: 'New Animation',
            duration: 5,
            frameRate: 30,
            tracks: [],
            loop: true
        };
        
        this.currentTime = 0;
        this.selectedTrack = null;
        this.selectedKeyframes.clear();
        
        this.updateTimeDisplay();
        this.onMount(this.container!);
        this.logger.info('Created new animation clip');
        this.events.emit('clipCreated', this.currentClip);
    }
    
    /**
     * Add a new track
     */
    private addTrack(): void {
        if (!this.currentClip) {
            this.createNewClip();
        }
        
        const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#ffeaa7', '#dfe6e9', '#a29bfe', '#fd79a8'];
        const color = colors[this.currentClip!.tracks.length % colors.length];
        
        const track: EditorAnimationTrack = {
            id: `track_${Date.now()}`,
            name: `Track ${this.currentClip!.tracks.length + 1}`,
            property: 'transform.position.x',
            keyframes: [],
            muted: false,
            locked: false,
            color
        };
        
        this.currentClip!.tracks.push(track);
        this.selectedTrack = track.id;
        this.renderTimeline();
        this.events.emit('trackAdded', track);
    }
    
    /**
     * Add a new state to the state machine
     */
    private addState(): void {
        const state: EditorAnimationState = {
            id: `state_${Date.now()}`,
            name: `State ${this.states.size + 1}`,
            clip: null,
            x: 100 + (this.states.size % 3) * 150,
            y: 100 + Math.floor(this.states.size / 3) * 80,
            speed: 1,
            loop: true,
            isEntry: this.states.size === 0,
            isExit: false
        };
        
        this.states.set(state.id, state);
        this.renderStateMachine();
        this.events.emit('stateAdded', state);
    }
    
    /**
     * Add a new parameter
     */
    private addParameter(): void {
        const param: EditorAnimationParameter = {
            name: `param${this.parameters.length}`,
            type: 'float',
            defaultValue: 0
        };
        
        this.parameters.push(param);
        this.renderStateMachine();
        this.events.emit('parameterAdded', param);
    }
    
    // ========== Public API ==========
    
    /**
     * Get the current clip
     */
    getCurrentClip(): EditorAnimationClip | null {
        return this.currentClip;
    }
    
    /**
     * Set the current clip
     */
    setCurrentClip(clip: EditorAnimationClip): void {
        this.currentClip = clip;
        this.currentTime = 0;
        this.onMount(this.container!);
    }
    
    /**
     * Get current time
     */
    getCurrentTime(): number {
        return this.currentTime;
    }
    
    /**
     * Set current time
     */
    setCurrentTime(time: number): void {
        this.goToFrame(time);
    }
    
    /**
     * Get animation states
     */
    getStates(): EditorAnimationState[] {
        return Array.from(this.states.values());
    }
    
    /**
     * Get animation parameters
     */
    getParameters(): EditorAnimationParameter[] {
        return [...this.parameters];
    }
}
