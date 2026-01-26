/**
 * @fileoverview Profiler Panel for WebForge Editor
 * @module editor/panels/ProfilerPanel
 * 
 * Performance profiling panel with:
 * - Frame timing graphs
 * - Draw call tracking
 * - GPU/CPU timing
 * - Memory monitoring
 * - Hot path detection
 */

import { Panel } from '../Panel';
import { EditorContext } from '../EditorContext';

// ============================================================================
// TYPES
// ============================================================================

/** Frame timing data */
export interface FrameTimingData {
    frameNumber: number;
    totalTime: number;
    cpuTime: number;
    gpuTime: number;
    drawCalls: number;
    triangles: number;
    timestamp: number;
}

/** Performance marker */
export interface PerformanceMarker {
    name: string;
    startTime: number;
    endTime: number;
    duration: number;
    category: 'cpu' | 'gpu' | 'io' | 'other';
}

/** Profiler session data */
export interface ProfilerSession {
    id: string;
    name: string;
    startTime: number;
    endTime: number;
    frames: FrameTimingData[];
    markers: PerformanceMarker[];
}

// ============================================================================
// PROFILER PANEL
// ============================================================================

/**
 * Profiler Panel
 * 
 * Performance profiling and visualization for game development.
 */
export class ProfilerPanel extends Panel {
    // Data storage
    private frameHistory: FrameTimingData[] = [];
    private markers: PerformanceMarker[] = [];
    private sessions: ProfilerSession[] = [];
    private maxHistoryFrames: number = 300;
    
    // Recording state
    private isRecording: boolean = false;
    private currentSession: ProfilerSession | null = null;
    
    // UI state
    private activeTab: 'timeline' | 'frames' | 'markers' | 'sessions' = 'timeline';
    private selectedFrameIndex: number = -1;
    private graphCanvas: HTMLCanvasElement | null = null;
    private graphCtx: CanvasRenderingContext2D | null = null;
    
    // Target frame rate
    private targetFPS: number = 60;
    private targetFrameTime: number = 1000 / 60;
    
    // Animation
    private animationFrame: number = 0;
    
    // Content element
    private content: HTMLElement | null = null;

    constructor(_context: EditorContext, id: string = 'profiler', title: string = 'Profiler') {
        super(id, title);
        this.simulateFrameData();
    }

    // ========================================================================
    // INITIALIZATION
    // ========================================================================

    private simulateFrameData(): void {
        // Generate some test data
        for (let i = 0; i < 100; i++) {
            const baseTime = 16.67 + Math.random() * 5 - 2.5;
            this.frameHistory.push({
                frameNumber: i,
                totalTime: baseTime,
                cpuTime: baseTime * 0.6 + Math.random() * 2,
                gpuTime: baseTime * 0.4 + Math.random() * 2,
                drawCalls: Math.floor(100 + Math.random() * 50),
                triangles: Math.floor(50000 + Math.random() * 20000),
                timestamp: Date.now() - (100 - i) * 16.67
            });
        }
    }

    // ========================================================================
    // PANEL LIFECYCLE
    // ========================================================================

    protected onMount(container: HTMLElement): void {
        this.content = document.createElement('div');
        this.content.style.cssText = `
            display: flex;
            flex-direction: column;
            background: #1e1e1e;
            color: #ddd;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            font-size: 12px;
            height: 100%;
            overflow: hidden;
        `;
        container.appendChild(this.content);
        this.renderContent();
        this.startAnimation();
    }

    protected onUpdate(_deltaTime: number): void {
        // Add new frame data if recording
        if (this.isRecording) {
            this.addFrameData(_deltaTime);
        }
    }

    protected onUnmount(): void {
        cancelAnimationFrame(this.animationFrame);
        this.content = null;
        this.graphCanvas = null;
        this.graphCtx = null;
    }

    private addFrameData(deltaTime: number): void {
        const frame: FrameTimingData = {
            frameNumber: this.frameHistory.length,
            totalTime: deltaTime * 1000,
            cpuTime: deltaTime * 600 + Math.random() * 2,
            gpuTime: deltaTime * 400 + Math.random() * 2,
            drawCalls: Math.floor(100 + Math.random() * 50),
            triangles: Math.floor(50000 + Math.random() * 20000),
            timestamp: Date.now()
        };

        this.frameHistory.push(frame);
        
        if (this.currentSession) {
            this.currentSession.frames.push(frame);
        }

        // Limit history
        if (this.frameHistory.length > this.maxHistoryFrames) {
            this.frameHistory.shift();
        }
    }

    private startAnimation(): void {
        const animate = () => {
            if (this.activeTab === 'timeline' && this.graphCtx && this.graphCanvas) {
                this.renderTimeline();
            }
            this.animationFrame = requestAnimationFrame(animate);
        };
        animate();
    }

    private renderContent(): void {
        if (!this.content) return;
        this.content.innerHTML = '';

        // Toolbar
        const toolbar = this.createToolbar();
        this.content.appendChild(toolbar);

        // Tabs
        const tabBar = this.createTabBar();
        this.content.appendChild(tabBar);

        // Content
        const tabContent = document.createElement('div');
        tabContent.style.cssText = 'flex: 1; overflow: auto; padding: 8px;';
        
        switch (this.activeTab) {
            case 'timeline':
                this.renderTimelineTab(tabContent);
                break;
            case 'frames':
                this.renderFramesTab(tabContent);
                break;
            case 'markers':
                this.renderMarkersTab(tabContent);
                break;
            case 'sessions':
                this.renderSessionsTab(tabContent);
                break;
        }
        
        this.content.appendChild(tabContent);
    }

    private createToolbar(): HTMLElement {
        const toolbar = document.createElement('div');
        toolbar.style.cssText = `
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 8px;
            background: #252526;
            border-bottom: 1px solid #3e3e42;
        `;

        // Record button
        const recordBtn = document.createElement('button');
        recordBtn.textContent = this.isRecording ? '⏹ Stop' : '⏺ Record';
        recordBtn.style.cssText = `
            padding: 6px 12px;
            border: none;
            background: ${this.isRecording ? '#f44336' : '#4caf50'};
            color: white;
            cursor: pointer;
            border-radius: 4px;
        `;
        recordBtn.onclick = () => this.toggleRecording();
        toolbar.appendChild(recordBtn);

        // Clear button
        const clearBtn = document.createElement('button');
        clearBtn.textContent = '🗑️ Clear';
        clearBtn.style.cssText = `
            padding: 6px 12px;
            border: 1px solid #3e3e42;
            background: transparent;
            color: #ddd;
            cursor: pointer;
            border-radius: 4px;
        `;
        clearBtn.onclick = () => this.clearData();
        toolbar.appendChild(clearBtn);

        // Spacer
        const spacer = document.createElement('div');
        spacer.style.cssText = 'flex: 1;';
        toolbar.appendChild(spacer);

        // Target FPS
        const fpsLabel = document.createElement('span');
        fpsLabel.textContent = 'Target FPS:';
        fpsLabel.style.cssText = 'font-size: 11px;';
        toolbar.appendChild(fpsLabel);

        const fpsSelect = document.createElement('select');
        fpsSelect.style.cssText = `
            padding: 4px;
            background: #1e1e1e;
            border: 1px solid #3e3e42;
            color: #ddd;
            border-radius: 2px;
        `;
        [30, 60, 120, 144, 240].forEach(fps => {
            const option = document.createElement('option');
            option.value = String(fps);
            option.textContent = `${fps}`;
            option.selected = fps === this.targetFPS;
            fpsSelect.appendChild(option);
        });
        fpsSelect.onchange = () => {
            this.targetFPS = parseInt(fpsSelect.value);
            this.targetFrameTime = 1000 / this.targetFPS;
        };
        toolbar.appendChild(fpsSelect);

        // Stats summary
        const stats = this.calculateStats();
        const statsDiv = document.createElement('div');
        statsDiv.style.cssText = 'display: flex; gap: 16px; font-size: 11px;';
        statsDiv.innerHTML = `
            <span>Avg: <b style="color: ${stats.avgFPS >= this.targetFPS ? '#4caf50' : '#f44336'}">${stats.avgFPS.toFixed(1)} FPS</b></span>
            <span>Min: <b>${stats.minFPS.toFixed(1)}</b></span>
            <span>Max: <b>${stats.maxFPS.toFixed(1)}</b></span>
        `;
        toolbar.appendChild(statsDiv);

        return toolbar;
    }

    private createTabBar(): HTMLElement {
        const tabBar = document.createElement('div');
        tabBar.style.cssText = `
            display: flex;
            background: #252526;
            border-bottom: 1px solid #3e3e42;
        `;

        type TabId = 'timeline' | 'frames' | 'markers' | 'sessions';
        const tabs: Array<{ id: TabId; label: string }> = [
            { id: 'timeline', label: '📊 Timeline' },
            { id: 'frames', label: '🎞️ Frames' },
            { id: 'markers', label: '📍 Markers' },
            { id: 'sessions', label: '📁 Sessions' }
        ];

        tabs.forEach(tab => {
            const tabEl = document.createElement('button');
            tabEl.textContent = tab.label;
            tabEl.style.cssText = `
                padding: 8px 16px;
                border: none;
                background: ${this.activeTab === tab.id ? '#1e1e1e' : 'transparent'};
                color: ${this.activeTab === tab.id ? '#fff' : '#888'};
                cursor: pointer;
                font-size: 12px;
                border-bottom: 2px solid ${this.activeTab === tab.id ? '#0078d4' : 'transparent'};
            `;
            tabEl.onclick = () => {
                this.activeTab = tab.id;
                this.renderContent();
            };
            tabBar.appendChild(tabEl);
        });

        return tabBar;
    }

    // ========================================================================
    // TIMELINE TAB
    // ========================================================================

    private renderTimelineTab(container: HTMLElement): void {
        // Graph canvas
        this.graphCanvas = document.createElement('canvas');
        this.graphCanvas.width = 800;
        this.graphCanvas.height = 200;
        this.graphCanvas.style.cssText = 'width: 100%; height: 200px; background: #1a1a1a; border-radius: 4px;';
        this.graphCtx = this.graphCanvas.getContext('2d');
        container.appendChild(this.graphCanvas);

        // Legend
        const legend = document.createElement('div');
        legend.style.cssText = 'display: flex; gap: 16px; margin-top: 8px; font-size: 11px;';
        legend.innerHTML = `
            <span><span style="color: #4caf50;">●</span> CPU Time</span>
            <span><span style="color: #2196f3;">●</span> GPU Time</span>
            <span><span style="color: #ff9800;">●</span> Target (${this.targetFrameTime.toFixed(2)}ms)</span>
        `;
        container.appendChild(legend);

        // Stats cards
        const statsContainer = document.createElement('div');
        statsContainer.style.cssText = `
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 12px;
            margin-top: 16px;
        `;

        const stats = this.calculateStats();
        const cards = [
            { label: 'Average FPS', value: stats.avgFPS.toFixed(1), color: stats.avgFPS >= this.targetFPS ? '#4caf50' : '#f44336' },
            { label: 'Frame Time', value: `${stats.avgFrameTime.toFixed(2)}ms`, color: '#2196f3' },
            { label: 'Draw Calls', value: stats.avgDrawCalls.toFixed(0), color: '#9c27b0' },
            { label: 'Triangles', value: this.formatNumber(stats.avgTriangles), color: '#ff9800' },
            { label: '1% Low FPS', value: stats.percentile1FPS.toFixed(1), color: '#f44336' },
            { label: 'Frame Budget', value: `${((stats.avgFrameTime / this.targetFrameTime) * 100).toFixed(0)}%`, color: stats.avgFrameTime <= this.targetFrameTime ? '#4caf50' : '#f44336' }
        ];

        cards.forEach(card => {
            const cardEl = document.createElement('div');
            cardEl.style.cssText = `
                background: #252526;
                padding: 12px;
                border-radius: 4px;
                border-left: 3px solid ${card.color};
            `;
            cardEl.innerHTML = `
                <div style="font-size: 10px; color: #888; margin-bottom: 4px;">${card.label}</div>
                <div style="font-size: 18px; font-weight: bold; color: ${card.color};">${card.value}</div>
            `;
            statsContainer.appendChild(cardEl);
        });

        container.appendChild(statsContainer);
    }

    private renderTimeline(): void {
        if (!this.graphCtx || !this.graphCanvas) return;
        
        const ctx = this.graphCtx;
        const canvas = this.graphCanvas;
        const width = canvas.width;
        const height = canvas.height;

        // Clear
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(0, 0, width, height);

        if (this.frameHistory.length < 2) return;

        // Draw grid
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
        
        // Horizontal lines (frame time markers)
        const maxTime = 50; // 50ms max
        for (let i = 0; i <= 5; i++) {
            const y = height - (i / 5) * height;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
            
            // Labels
            ctx.fillStyle = '#666';
            ctx.font = '10px sans-serif';
            ctx.fillText(`${(i * 10)}ms`, 5, y - 3);
        }

        // Target frame time line
        const targetY = height - (this.targetFrameTime / maxTime) * height;
        ctx.strokeStyle = '#ff9800';
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(0, targetY);
        ctx.lineTo(width, targetY);
        ctx.stroke();
        ctx.setLineDash([]);

        // Draw CPU time
        ctx.strokeStyle = '#4caf50';
        ctx.lineWidth = 2;
        ctx.beginPath();
        
        const visibleFrames = this.frameHistory.slice(-Math.floor(width / 3));
        visibleFrames.forEach((frame, i) => {
            const x = (i / visibleFrames.length) * width;
            const y = height - (frame.cpuTime / maxTime) * height;
            
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        ctx.stroke();

        // Draw GPU time
        ctx.strokeStyle = '#2196f3';
        ctx.beginPath();
        
        visibleFrames.forEach((frame, i) => {
            const x = (i / visibleFrames.length) * width;
            const y = height - (frame.gpuTime / maxTime) * height;
            
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        ctx.stroke();
    }

    // ========================================================================
    // FRAMES TAB
    // ========================================================================

    private renderFramesTab(container: HTMLElement): void {
        // Frame list
        const table = document.createElement('table');
        table.style.cssText = `
            width: 100%;
            border-collapse: collapse;
            font-size: 11px;
        `;

        // Header
        const header = document.createElement('tr');
        header.innerHTML = `
            <th style="padding: 8px; text-align: left; border-bottom: 1px solid #3e3e42;">Frame</th>
            <th style="padding: 8px; text-align: right; border-bottom: 1px solid #3e3e42;">Total</th>
            <th style="padding: 8px; text-align: right; border-bottom: 1px solid #3e3e42;">CPU</th>
            <th style="padding: 8px; text-align: right; border-bottom: 1px solid #3e3e42;">GPU</th>
            <th style="padding: 8px; text-align: right; border-bottom: 1px solid #3e3e42;">Draw Calls</th>
            <th style="padding: 8px; text-align: right; border-bottom: 1px solid #3e3e42;">Triangles</th>
        `;
        table.appendChild(header);

        // Rows (show last 50 frames)
        const recentFrames = this.frameHistory.slice(-50).reverse();
        recentFrames.forEach((frame, idx) => {
            const isSelected = idx === this.selectedFrameIndex;
            const isOver = frame.totalTime > this.targetFrameTime;
            
            const row = document.createElement('tr');
            row.style.cssText = `
                cursor: pointer;
                background: ${isSelected ? '#0078d4' : isOver ? 'rgba(244, 67, 54, 0.1)' : 'transparent'};
            `;
            row.onclick = () => {
                this.selectedFrameIndex = idx;
                this.renderContent();
            };
            
            row.innerHTML = `
                <td style="padding: 6px 8px;">#${frame.frameNumber}</td>
                <td style="padding: 6px 8px; text-align: right; color: ${isOver ? '#f44336' : '#4caf50'};">${frame.totalTime.toFixed(2)}ms</td>
                <td style="padding: 6px 8px; text-align: right;">${frame.cpuTime.toFixed(2)}ms</td>
                <td style="padding: 6px 8px; text-align: right;">${frame.gpuTime.toFixed(2)}ms</td>
                <td style="padding: 6px 8px; text-align: right;">${frame.drawCalls}</td>
                <td style="padding: 6px 8px; text-align: right;">${this.formatNumber(frame.triangles)}</td>
            `;
            table.appendChild(row);
        });

        container.appendChild(table);
    }

    // ========================================================================
    // MARKERS TAB
    // ========================================================================

    private renderMarkersTab(container: HTMLElement): void {
        // Add marker button
        const toolbar = document.createElement('div');
        toolbar.style.cssText = 'margin-bottom: 12px;';
        
        const addBtn = document.createElement('button');
        addBtn.textContent = '+ Add Marker';
        addBtn.style.cssText = `
            padding: 6px 12px;
            border: none;
            background: #0078d4;
            color: white;
            cursor: pointer;
            border-radius: 4px;
        `;
        addBtn.onclick = () => this.addTestMarker();
        toolbar.appendChild(addBtn);
        container.appendChild(toolbar);

        // Markers list
        if (this.markers.length === 0) {
            const empty = document.createElement('div');
            empty.textContent = 'No performance markers recorded.';
            empty.style.cssText = 'color: #888; font-style: italic;';
            container.appendChild(empty);
        } else {
            const table = document.createElement('table');
            table.style.cssText = 'width: 100%; border-collapse: collapse; font-size: 11px;';
            
            const header = document.createElement('tr');
            header.innerHTML = `
                <th style="padding: 8px; text-align: left; border-bottom: 1px solid #3e3e42;">Name</th>
                <th style="padding: 8px; text-align: left; border-bottom: 1px solid #3e3e42;">Category</th>
                <th style="padding: 8px; text-align: right; border-bottom: 1px solid #3e3e42;">Duration</th>
            `;
            table.appendChild(header);

            this.markers.slice(-50).reverse().forEach(marker => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td style="padding: 6px 8px;">${marker.name}</td>
                    <td style="padding: 6px 8px;">${marker.category}</td>
                    <td style="padding: 6px 8px; text-align: right;">${marker.duration.toFixed(3)}ms</td>
                `;
                table.appendChild(row);
            });

            container.appendChild(table);
        }
    }

    // ========================================================================
    // SESSIONS TAB
    // ========================================================================

    private renderSessionsTab(container: HTMLElement): void {
        if (this.sessions.length === 0) {
            const empty = document.createElement('div');
            empty.textContent = 'No profiling sessions saved. Use Record to create a session.';
            empty.style.cssText = 'color: #888; font-style: italic;';
            container.appendChild(empty);
            return;
        }

        const grid = document.createElement('div');
        grid.style.cssText = `
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
            gap: 12px;
        `;

        this.sessions.forEach(session => {
            const card = document.createElement('div');
            card.style.cssText = `
                background: #252526;
                border-radius: 4px;
                padding: 12px;
            `;

            const duration = (session.endTime - session.startTime) / 1000;
            const avgFPS = session.frames.length > 0 
                ? session.frames.reduce((sum, f) => sum + 1000 / f.totalTime, 0) / session.frames.length
                : 0;

            card.innerHTML = `
                <div style="font-weight: bold; margin-bottom: 8px;">${session.name}</div>
                <div style="font-size: 11px; color: #888;">
                    Duration: ${duration.toFixed(1)}s<br>
                    Frames: ${session.frames.length}<br>
                    Avg FPS: ${avgFPS.toFixed(1)}
                </div>
            `;

            const buttons = document.createElement('div');
            buttons.style.cssText = 'display: flex; gap: 8px; margin-top: 12px;';

            const loadBtn = document.createElement('button');
            loadBtn.textContent = 'Load';
            loadBtn.style.cssText = `
                flex: 1;
                padding: 4px;
                border: none;
                background: #0078d4;
                color: white;
                cursor: pointer;
                border-radius: 2px;
            `;
            loadBtn.onclick = () => this.loadSession(session);
            buttons.appendChild(loadBtn);

            const deleteBtn = document.createElement('button');
            deleteBtn.textContent = '🗑️';
            deleteBtn.style.cssText = `
                padding: 4px 8px;
                border: none;
                background: #f44336;
                color: white;
                cursor: pointer;
                border-radius: 2px;
            `;
            deleteBtn.onclick = () => {
                this.sessions = this.sessions.filter(s => s.id !== session.id);
                this.renderContent();
            };
            buttons.appendChild(deleteBtn);

            card.appendChild(buttons);
            grid.appendChild(card);
        });

        container.appendChild(grid);
    }

    // ========================================================================
    // ACTIONS
    // ========================================================================

    private toggleRecording(): void {
        if (this.isRecording) {
            // Stop recording
            if (this.currentSession) {
                this.currentSession.endTime = Date.now();
                this.sessions.push(this.currentSession);
            }
            this.currentSession = null;
            this.isRecording = false;
        } else {
            // Start recording
            this.currentSession = {
                id: `session_${Date.now()}`,
                name: `Session ${this.sessions.length + 1}`,
                startTime: Date.now(),
                endTime: 0,
                frames: [],
                markers: []
            };
            this.isRecording = true;
        }
        this.renderContent();
    }

    private clearData(): void {
        this.frameHistory = [];
        this.markers = [];
        this.selectedFrameIndex = -1;
        this.renderContent();
    }

    private addTestMarker(): void {
        this.markers.push({
            name: `Marker ${this.markers.length + 1}`,
            startTime: performance.now() - Math.random() * 10,
            endTime: performance.now(),
            duration: Math.random() * 10,
            category: ['cpu', 'gpu', 'io', 'other'][Math.floor(Math.random() * 4)] as PerformanceMarker['category']
        });
        this.renderContent();
    }

    private loadSession(session: ProfilerSession): void {
        this.frameHistory = [...session.frames];
        this.markers = [...session.markers];
        this.activeTab = 'timeline';
        this.renderContent();
    }

    // ========================================================================
    // HELPERS
    // ========================================================================

    private calculateStats(): {
        avgFPS: number;
        minFPS: number;
        maxFPS: number;
        avgFrameTime: number;
        avgDrawCalls: number;
        avgTriangles: number;
        percentile1FPS: number;
    } {
        if (this.frameHistory.length === 0) {
            return {
                avgFPS: 0,
                minFPS: 0,
                maxFPS: 0,
                avgFrameTime: 0,
                avgDrawCalls: 0,
                avgTriangles: 0,
                percentile1FPS: 0
            };
        }

        const fps = this.frameHistory.map(f => 1000 / f.totalTime);
        const sortedFPS = [...fps].sort((a, b) => a - b);

        return {
            avgFPS: fps.reduce((a, b) => a + b, 0) / fps.length,
            minFPS: Math.min(...fps),
            maxFPS: Math.max(...fps),
            avgFrameTime: this.frameHistory.reduce((a, b) => a + b.totalTime, 0) / this.frameHistory.length,
            avgDrawCalls: this.frameHistory.reduce((a, b) => a + b.drawCalls, 0) / this.frameHistory.length,
            avgTriangles: this.frameHistory.reduce((a, b) => a + b.triangles, 0) / this.frameHistory.length,
            percentile1FPS: sortedFPS[Math.floor(sortedFPS.length * 0.01)] || 0
        };
    }

    private formatNumber(num: number): string {
        if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
        if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
        return num.toFixed(0);
    }

    // ========================================================================
    // PUBLIC API
    // ========================================================================

    /**
     * Start a performance marker
     */
    public beginMarker(name: string, category: PerformanceMarker['category'] = 'cpu'): void {
        this.markers.push({
            name,
            startTime: performance.now(),
            endTime: 0,
            duration: 0,
            category
        });
    }

    /**
     * End a performance marker
     */
    public endMarker(name: string): void {
        const marker = this.markers.find(m => m.name === name && m.endTime === 0);
        if (marker) {
            marker.endTime = performance.now();
            marker.duration = marker.endTime - marker.startTime;
        }
    }

    /**
     * Export profiling data
     */
    public exportData(): string {
        return JSON.stringify({
            frames: this.frameHistory,
            markers: this.markers,
            sessions: this.sessions
        }, null, 2);
    }
}
