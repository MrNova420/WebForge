/**
 * WebForge Professional Debugger - Debug Overlay
 * 
 * Real-time on-screen debug HUD showing FPS, memory,
 * draw calls, entity count, and custom metrics.
 */

export interface OverlayConfig {
    position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
    opacity: number;
    fontSize: number;
    backgroundColor: string;
    textColor: string;
    warningColor: string;
    errorColor: string;
    width: number;
    showFPS: boolean;
    showFrameTime: boolean;
    showMemory: boolean;
    showDrawCalls: boolean;
    showEntityCount: boolean;
    showCustomMetrics: boolean;
    graphHeight: number;
    graphHistorySize: number;
}

export interface MetricDefinition {
    name: string;
    getter: () => number;
    unit?: string;
    warningThreshold?: number;
    errorThreshold?: number;
    format?: (value: number) => string;
    showGraph?: boolean;
}

export interface GraphData {
    values: number[];
    min: number;
    max: number;
    average: number;
}

const DEFAULT_CONFIG: OverlayConfig = {
    position: 'top-left',
    opacity: 0.9,
    fontSize: 12,
    backgroundColor: '#1a1a2e',
    textColor: '#eee',
    warningColor: '#ffc107',
    errorColor: '#f44336',
    width: 280,
    showFPS: true,
    showFrameTime: true,
    showMemory: true,
    showDrawCalls: true,
    showEntityCount: true,
    showCustomMetrics: true,
    graphHeight: 40,
    graphHistorySize: 100
};

export class DebugOverlay {
    private config: OverlayConfig;
    private container: HTMLDivElement | null = null;
    private canvas: HTMLCanvasElement | null = null;
    private ctx: CanvasRenderingContext2D | null = null;
    private visible: boolean = false;
    private metrics: Map<string, MetricDefinition> = new Map();
    private graphs: Map<string, GraphData> = new Map();
    private lastFrameTime: number = 0;
    private frameCount: number = 0;
    private fps: number = 0;
    private fpsUpdateTime: number = 0;
    private animationFrameId: number | null = null;

    // Built-in metric getters (to be set by external systems)
    public drawCallsGetter: () => number = () => 0;
    public trianglesGetter: () => number = () => 0;
    public entityCountGetter: () => number = () => 0;
    public activeSceneGetter: () => string = () => 'None';

    constructor(config: Partial<OverlayConfig> = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.initializeBuiltInMetrics();
    }

    /**
     * Show the overlay
     */
    show(): void {
        if (this.visible) return;
        this.visible = true;
        this.createDOM();
        this.startUpdateLoop();
    }

    /**
     * Hide the overlay
     */
    hide(): void {
        if (!this.visible) return;
        this.visible = false;
        this.stopUpdateLoop();
        this.destroyDOM();
    }

    /**
     * Toggle visibility
     */
    toggle(): void {
        if (this.visible) {
            this.hide();
        } else {
            this.show();
        }
    }

    /**
     * Check if visible
     */
    isVisible(): boolean {
        return this.visible;
    }

    /**
     * Add a custom metric
     */
    addMetric(definition: MetricDefinition): void {
        this.metrics.set(definition.name, definition);
        if (definition.showGraph) {
            this.graphs.set(definition.name, {
                values: [],
                min: Infinity,
                max: -Infinity,
                average: 0
            });
        }
    }

    /**
     * Remove a custom metric
     */
    removeMetric(name: string): void {
        this.metrics.delete(name);
        this.graphs.delete(name);
    }

    /**
     * Update configuration
     */
    setConfig(config: Partial<OverlayConfig>): void {
        this.config = { ...this.config, ...config };
        if (this.visible) {
            this.destroyDOM();
            this.createDOM();
        }
    }

    /**
     * Get current configuration
     */
    getConfig(): OverlayConfig {
        return { ...this.config };
    }

    private initializeBuiltInMetrics(): void {
        // FPS metric with graph
        this.addMetric({
            name: 'FPS',
            getter: () => this.fps,
            warningThreshold: 30,
            errorThreshold: 15,
            showGraph: true,
            format: (v) => v.toFixed(0)
        });

        // Frame time
        this.addMetric({
            name: 'Frame Time',
            getter: () => this.lastFrameTime,
            unit: 'ms',
            warningThreshold: 33,
            errorThreshold: 50,
            showGraph: true,
            format: (v) => v.toFixed(2)
        });

        // Memory (if available)
        this.addMetric({
            name: 'Memory',
            getter: () => {
                if ('memory' in performance) {
                    const memory = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory;
                    return (memory?.usedJSHeapSize ?? 0) / (1024 * 1024);
                }
                return 0;
            },
            unit: 'MB',
            warningThreshold: 500,
            errorThreshold: 1000,
            showGraph: true,
            format: (v) => v.toFixed(1)
        });

        // Draw calls
        this.addMetric({
            name: 'Draw Calls',
            getter: () => this.drawCallsGetter(),
            warningThreshold: 500,
            errorThreshold: 1000,
            format: (v) => v.toFixed(0)
        });

        // Triangles
        this.addMetric({
            name: 'Triangles',
            getter: () => this.trianglesGetter(),
            format: (v) => v >= 1000000 ? `${(v/1000000).toFixed(1)}M` : v >= 1000 ? `${(v/1000).toFixed(1)}K` : v.toFixed(0)
        });

        // Entity count
        this.addMetric({
            name: 'Entities',
            getter: () => this.entityCountGetter(),
            format: (v) => v.toFixed(0)
        });
    }

    private createDOM(): void {
        // Create container
        this.container = document.createElement('div');
        this.container.id = 'webforge-debug-overlay';
        this.container.style.cssText = this.getContainerStyle();

        // Create header
        const header = document.createElement('div');
        header.style.cssText = `
            font-weight: bold;
            font-size: 14px;
            margin-bottom: 8px;
            padding-bottom: 4px;
            border-bottom: 1px solid rgba(255,255,255,0.2);
            display: flex;
            justify-content: space-between;
            align-items: center;
        `;
        header.innerHTML = `
            <span>🔧 WebForge Debug</span>
            <span style="font-size: 10px; opacity: 0.7;">Press \` to toggle</span>
        `;
        this.container.appendChild(header);

        // Create metrics container
        const metricsDiv = document.createElement('div');
        metricsDiv.id = 'webforge-debug-metrics';
        this.container.appendChild(metricsDiv);

        // Create graph canvas
        this.canvas = document.createElement('canvas');
        this.canvas.width = this.config.width - 20;
        this.canvas.height = this.config.graphHeight;
        this.canvas.style.cssText = `
            margin-top: 8px;
            border-radius: 4px;
            background: rgba(0,0,0,0.3);
        `;
        this.container.appendChild(this.canvas);
        this.ctx = this.canvas.getContext('2d');

        // Create scene info
        const sceneDiv = document.createElement('div');
        sceneDiv.id = 'webforge-debug-scene';
        sceneDiv.style.cssText = `
            margin-top: 8px;
            padding-top: 8px;
            border-top: 1px solid rgba(255,255,255,0.2);
            font-size: 10px;
            opacity: 0.8;
        `;
        this.container.appendChild(sceneDiv);

        document.body.appendChild(this.container);

        // Add keyboard shortcut
        this.addKeyboardShortcut();
    }

    private destroyDOM(): void {
        if (this.container) {
            this.container.remove();
            this.container = null;
        }
        this.canvas = null;
        this.ctx = null;
    }

    private getContainerStyle(): string {
        const { position, opacity, fontSize, backgroundColor, textColor, width } = this.config;

        const positionStyles: Record<string, string> = {
            'top-left': 'top: 10px; left: 10px;',
            'top-right': 'top: 10px; right: 10px;',
            'bottom-left': 'bottom: 10px; left: 10px;',
            'bottom-right': 'bottom: 10px; right: 10px;'
        };

        return `
            position: fixed;
            ${positionStyles[position]}
            width: ${width}px;
            padding: 10px;
            background: ${backgroundColor};
            color: ${textColor};
            font-family: 'Consolas', 'Monaco', monospace;
            font-size: ${fontSize}px;
            border-radius: 8px;
            opacity: ${opacity};
            z-index: 999999;
            box-shadow: 0 4px 20px rgba(0,0,0,0.5);
            pointer-events: auto;
            user-select: none;
        `;
    }

    private startUpdateLoop(): void {
        const update = (timestamp: number) => {
            if (!this.visible) return;

            // Calculate FPS
            this.frameCount++;
            if (timestamp - this.fpsUpdateTime >= 1000) {
                this.fps = this.frameCount;
                this.frameCount = 0;
                this.fpsUpdateTime = timestamp;
            }

            // Calculate frame time
            if (this.lastFrameTime === 0) {
                this.lastFrameTime = 16.67;
            } else {
                this.lastFrameTime = timestamp - (this.fpsUpdateTime - 1000 + (this.frameCount - 1) * (1000 / Math.max(this.fps, 1)));
            }

            this.updateMetrics();
            this.updateGraph();

            this.animationFrameId = requestAnimationFrame(update);
        };

        this.animationFrameId = requestAnimationFrame(update);
    }

    private stopUpdateLoop(): void {
        if (this.animationFrameId !== null) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }

    private updateMetrics(): void {
        const metricsDiv = document.getElementById('webforge-debug-metrics');
        if (!metricsDiv) return;

        let html = '';

        for (const [name, metric] of this.metrics) {
            const value = metric.getter();
            const formatted = metric.format ? metric.format(value) : value.toFixed(2);
            const unit = metric.unit ?? '';
            
            let color = this.config.textColor;
            if (metric.errorThreshold !== undefined && value >= metric.errorThreshold) {
                color = this.config.errorColor;
            } else if (metric.warningThreshold !== undefined && value >= metric.warningThreshold) {
                color = this.config.warningColor;
            } else if (name === 'FPS') {
                // FPS is inverted (lower is worse)
                if (metric.errorThreshold !== undefined && value <= metric.errorThreshold) {
                    color = this.config.errorColor;
                } else if (metric.warningThreshold !== undefined && value <= metric.warningThreshold) {
                    color = this.config.warningColor;
                }
            }

            // Update graph data
            const graphData = this.graphs.get(name);
            if (graphData) {
                graphData.values.push(value);
                if (graphData.values.length > this.config.graphHistorySize) {
                    graphData.values.shift();
                }
                graphData.min = Math.min(...graphData.values);
                graphData.max = Math.max(...graphData.values);
                graphData.average = graphData.values.reduce((a, b) => a + b, 0) / graphData.values.length;
            }

            html += `
                <div style="display: flex; justify-content: space-between; margin: 2px 0;">
                    <span>${name}:</span>
                    <span style="color: ${color}; font-weight: bold;">${formatted}${unit}</span>
                </div>
            `;
        }

        metricsDiv.innerHTML = html;

        // Update scene info
        const sceneDiv = document.getElementById('webforge-debug-scene');
        if (sceneDiv) {
            sceneDiv.innerHTML = `Scene: ${this.activeSceneGetter()}`;
        }
    }

    private updateGraph(): void {
        if (!this.ctx || !this.canvas) return;

        const { width, height } = this.canvas;
        this.ctx.clearRect(0, 0, width, height);

        // Draw FPS graph
        const fpsData = this.graphs.get('FPS');
        if (fpsData && fpsData.values.length > 1) {
            this.drawGraph(fpsData, '#4CAF50', 0, 120);
        }

        // Draw frame time graph (overlaid)
        const frameTimeData = this.graphs.get('Frame Time');
        if (frameTimeData && frameTimeData.values.length > 1) {
            this.drawGraph(frameTimeData, '#2196F3', 0, 100);
        }

        // Draw target line (60 FPS = 16.67ms)
        this.ctx.strokeStyle = 'rgba(255, 255, 0, 0.5)';
        this.ctx.setLineDash([4, 4]);
        this.ctx.beginPath();
        const targetY = height - (60 / 120) * height;
        this.ctx.moveTo(0, targetY);
        this.ctx.lineTo(width, targetY);
        this.ctx.stroke();
        this.ctx.setLineDash([]);
    }

    private drawGraph(data: GraphData, color: string, minVal: number, maxVal: number): void {
        if (!this.ctx || !this.canvas) return;

        const { width, height } = this.canvas;
        const values = data.values;

        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = 1.5;
        this.ctx.beginPath();

        for (let i = 0; i < values.length; i++) {
            const x = (i / (this.config.graphHistorySize - 1)) * width;
            const normalizedValue = (values[i] - minVal) / (maxVal - minVal);
            const y = height - Math.min(1, Math.max(0, normalizedValue)) * height;

            if (i === 0) {
                this.ctx.moveTo(x, y);
            } else {
                this.ctx.lineTo(x, y);
            }
        }

        this.ctx.stroke();
    }

    private addKeyboardShortcut(): void {
        const handler = (e: KeyboardEvent) => {
            if (e.key === '`' && !e.ctrlKey && !e.altKey && !e.metaKey) {
                this.toggle();
            }
        };

        document.addEventListener('keydown', handler);

        // Store for cleanup
        (this.container as HTMLDivElement & { _keyHandler?: (e: KeyboardEvent) => void })._keyHandler = handler;
    }
}

// Global instance
export const debugOverlay = new DebugOverlay();
