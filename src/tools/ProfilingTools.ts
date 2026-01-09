/**
 * Advanced profiling and performance analysis tools for WebForge
 * Provides frame profiling, memory profiling, GPU profiling, and network profiling
 * Part of Phase 15-16 Professional Tools (Week 105-112)
 */

export interface ProfilerSample {
    name: string;
    startTime: number;
    endTime: number;
    duration: number;
    parent?: string;
}

export interface FrameStats {
    frameNumber: number;
    timestamp: number;
    fps: number;
    frameTime: number;
    drawCalls: number;
    triangles: number;
    vertices: number;
    textures: number;
    shaders: number;
    renderTime: number;
    updateTime: number;
    physicsTime: number;
}

export interface MemoryStats {
    timestamp: number;
    heapUsed: number;
    heapTotal: number;
    heapLimit: number;
    external: number;
    arrayBuffers: number;
}

export interface GPUStats {
    timestamp: number;
    drawCalls: number;
    triangles: number;
    vertices: number;
    textureBindings: number;
    shaderChanges: number;
    stateChanges: number;
    bufferUpdates: number;
}

export interface NetworkStats {
    timestamp: number;
    bytesSent: number;
    bytesReceived: number;
    messagesSent: number;
    messagesReceived: number;
    latency: number;
    packetLoss: number;
}

export interface PerformanceRecommendation {
    category: 'rendering' | 'memory' | 'physics' | 'network' | 'general';
    severity: 'info' | 'warning' | 'critical';
    issue: string;
    recommendation: string;
    impact: 'low' | 'medium' | 'high';
}

/**
 * Frame Profiler - Tracks frame-by-frame performance
 */
export class FrameProfiler {
    private samples: ProfilerSample[] = [];
    private frameHistory: FrameStats[] = [];
    private maxHistory: number = 300; // 5 seconds at 60 FPS
    private currentFrame: number = 0;
    private activeScopes: Map<string, number> = new Map();

    /**
     * Begin profiling scope
     */
    public beginScope(name: string, parent?: string): void {
        this.activeScopes.set(name, performance.now());
        this.samples.push({
            name,
            startTime: performance.now(),
            endTime: 0,
            duration: 0,
            parent
        });
    }

    /**
     * End profiling scope
     */
    public endScope(name: string): void {
        const startTime = this.activeScopes.get(name);
        if (startTime !== undefined) {
            const endTime = performance.now();
            const sample = this.samples.find(s => s.name === name && s.endTime === 0);
            if (sample) {
                sample.endTime = endTime;
                sample.duration = endTime - startTime;
            }
            this.activeScopes.delete(name);
        }
    }

    /**
     * Record frame stats
     */
    public recordFrame(stats: Partial<FrameStats>): void {
        const frameStats: FrameStats = {
            frameNumber: this.currentFrame++,
            timestamp: performance.now(),
            fps: stats.fps || 0,
            frameTime: stats.frameTime || 0,
            drawCalls: stats.drawCalls || 0,
            triangles: stats.triangles || 0,
            vertices: stats.vertices || 0,
            textures: stats.textures || 0,
            shaders: stats.shaders || 0,
            renderTime: stats.renderTime || 0,
            updateTime: stats.updateTime || 0,
            physicsTime: stats.physicsTime || 0
        };

        this.frameHistory.push(frameStats);
        if (this.frameHistory.length > this.maxHistory) {
            this.frameHistory.shift();
        }
    }

    /**
     * Get average FPS over last N frames
     */
    public getAverageFPS(frames: number = 60): number {
        const recent = this.frameHistory.slice(-frames);
        if (recent.length === 0) return 0;
        const avgFrameTime = recent.reduce((sum, f) => sum + f.frameTime, 0) / recent.length;
        return 1000 / avgFrameTime;
    }

    /**
     * Get frame time percentiles
     */
    public getFrameTimePercentiles(): { p50: number; p95: number; p99: number } {
        const frameTimes = this.frameHistory.map(f => f.frameTime).sort((a, b) => a - b);
        const len = frameTimes.length;
        if (len === 0) return { p50: 0, p95: 0, p99: 0 };

        return {
            p50: frameTimes[Math.floor(len * 0.5)],
            p95: frameTimes[Math.floor(len * 0.95)],
            p99: frameTimes[Math.floor(len * 0.99)]
        };
    }

    /**
     * Get slowest scopes
     */
    public getSlowestScopes(count: number = 10): ProfilerSample[] {
        return [...this.samples]
            .filter(s => s.duration > 0)
            .sort((a, b) => b.duration - a.duration)
            .slice(0, count);
    }

    /**
     * Get frame history
     */
    public getFrameHistory(): FrameStats[] {
        return [...this.frameHistory];
    }

    /**
     * Clear all data
     */
    public clear(): void {
        this.samples = [];
        this.frameHistory = [];
        this.activeScopes.clear();
    }
}

/**
 * Memory Profiler - Tracks memory usage over time
 */
export class MemoryProfiler {
    private history: MemoryStats[] = [];
    private maxHistory: number = 300; // 5 minutes at 1 sample/sec
    private sampleInterval: number = 1000; // 1 second
    private lastSample: number = 0;

    /**
     * Sample memory usage
     */
    public sample(): void {
        const now = performance.now();
        if (now - this.lastSample < this.sampleInterval) return;

        const memory = (performance as any).memory;
        if (!memory) return;

        const stats: MemoryStats = {
            timestamp: now,
            heapUsed: memory.usedJSHeapSize,
            heapTotal: memory.totalJSHeapSize,
            heapLimit: memory.jsHeapSizeLimit,
            external: 0,
            arrayBuffers: 0
        };

        this.history.push(stats);
        if (this.history.length > this.maxHistory) {
            this.history.shift();
        }

        this.lastSample = now;
    }

    /**
     * Get current memory usage
     */
    public getCurrentMemory(): MemoryStats | null {
        return this.history.length > 0 ? this.history[this.history.length - 1] : null;
    }

    /**
     * Get memory trend (increasing/decreasing)
     */
    public getMemoryTrend(samples: number = 60): 'increasing' | 'decreasing' | 'stable' {
        const recent = this.history.slice(-samples);
        if (recent.length < 10) return 'stable';

        const first = recent.slice(0, samples / 3);
        const last = recent.slice(-samples / 3);

        const avgFirst = first.reduce((sum, s) => sum + s.heapUsed, 0) / first.length;
        const avgLast = last.reduce((sum, s) => sum + s.heapUsed, 0) / last.length;

        const change = (avgLast - avgFirst) / avgFirst;
        if (change > 0.1) return 'increasing';
        if (change < -0.1) return 'decreasing';
        return 'stable';
    }

    /**
     * Detect memory leaks
     */
    public detectLeaks(): boolean {
        if (this.history.length < 60) return false;

        const trend = this.getMemoryTrend(60);
        const current = this.getCurrentMemory();
        if (!current) return false;

        const usage = current.heapUsed / current.heapLimit;
        return trend === 'increasing' && usage > 0.8;
    }

    /**
     * Get memory history
     */
    public getHistory(): MemoryStats[] {
        return [...this.history];
    }

    /**
     * Clear history
     */
    public clear(): void {
        this.history = [];
    }
}

/**
 * GPU Profiler - Tracks GPU performance metrics
 */
export class GPUProfiler {
    private history: GPUStats[] = [];
    private maxHistory: number = 300;
    private currentStats: Partial<GPUStats> = {};

    /**
     * Record draw call
     */
    public recordDrawCall(triangles: number, vertices: number): void {
        this.currentStats.drawCalls = (this.currentStats.drawCalls || 0) + 1;
        this.currentStats.triangles = (this.currentStats.triangles || 0) + triangles;
        this.currentStats.vertices = (this.currentStats.vertices || 0) + vertices;
    }

    /**
     * Record texture binding
     */
    public recordTextureBinding(): void {
        this.currentStats.textureBindings = (this.currentStats.textureBindings || 0) + 1;
    }

    /**
     * Record shader change
     */
    public recordShaderChange(): void {
        this.currentStats.shaderChanges = (this.currentStats.shaderChanges || 0) + 1;
    }

    /**
     * Record state change
     */
    public recordStateChange(): void {
        this.currentStats.stateChanges = (this.currentStats.stateChanges || 0) + 1;
    }

    /**
     * Record buffer update
     */
    public recordBufferUpdate(): void {
        this.currentStats.bufferUpdates = (this.currentStats.bufferUpdates || 0) + 1;
    }

    /**
     * Complete frame and store stats
     */
    public endFrame(): void {
        const stats: GPUStats = {
            timestamp: performance.now(),
            drawCalls: this.currentStats.drawCalls || 0,
            triangles: this.currentStats.triangles || 0,
            vertices: this.currentStats.vertices || 0,
            textureBindings: this.currentStats.textureBindings || 0,
            shaderChanges: this.currentStats.shaderChanges || 0,
            stateChanges: this.currentStats.stateChanges || 0,
            bufferUpdates: this.currentStats.bufferUpdates || 0
        };

        this.history.push(stats);
        if (this.history.length > this.maxHistory) {
            this.history.shift();
        }

        this.currentStats = {};
    }

    /**
     * Get average stats
     */
    public getAverageStats(frames: number = 60): GPUStats {
        const recent = this.history.slice(-frames);
        if (recent.length === 0) {
            return {
                timestamp: 0,
                drawCalls: 0,
                triangles: 0,
                vertices: 0,
                textureBindings: 0,
                shaderChanges: 0,
                stateChanges: 0,
                bufferUpdates: 0
            };
        }

        return {
            timestamp: recent[recent.length - 1].timestamp,
            drawCalls: recent.reduce((sum, s) => sum + s.drawCalls, 0) / recent.length,
            triangles: recent.reduce((sum, s) => sum + s.triangles, 0) / recent.length,
            vertices: recent.reduce((sum, s) => sum + s.vertices, 0) / recent.length,
            textureBindings: recent.reduce((sum, s) => sum + s.textureBindings, 0) / recent.length,
            shaderChanges: recent.reduce((sum, s) => sum + s.shaderChanges, 0) / recent.length,
            stateChanges: recent.reduce((sum, s) => sum + s.stateChanges, 0) / recent.length,
            bufferUpdates: recent.reduce((sum, s) => sum + s.bufferUpdates, 0) / recent.length
        };
    }

    /**
     * Get history
     */
    public getHistory(): GPUStats[] {
        return [...this.history];
    }

    /**
     * Clear data
     */
    public clear(): void {
        this.history = [];
        this.currentStats = {};
    }
}

/**
 * Network Profiler - Tracks network performance
 */
export class NetworkProfiler {
    private history: NetworkStats[] = [];
    private maxHistory: number = 300;
    private currentStats: Partial<NetworkStats> = {
        bytesSent: 0,
        bytesReceived: 0,
        messagesSent: 0,
        messagesReceived: 0
    };
    private latencySamples: number[] = [];

    /**
     * Record sent data
     */
    public recordSent(bytes: number): void {
        this.currentStats.bytesSent = (this.currentStats.bytesSent || 0) + bytes;
        this.currentStats.messagesSent = (this.currentStats.messagesSent || 0) + 1;
    }

    /**
     * Record received data
     */
    public recordReceived(bytes: number): void {
        this.currentStats.bytesReceived = (this.currentStats.bytesReceived || 0) + bytes;
        this.currentStats.messagesReceived = (this.currentStats.messagesReceived || 0) + 1;
    }

    /**
     * Record latency sample
     */
    public recordLatency(ms: number): void {
        this.latencySamples.push(ms);
        if (this.latencySamples.length > 100) {
            this.latencySamples.shift();
        }
    }

    /**
     * End period and save stats
     */
    public endPeriod(): void {
        const avgLatency = this.latencySamples.length > 0
            ? this.latencySamples.reduce((sum, l) => sum + l, 0) / this.latencySamples.length
            : 0;

        const stats: NetworkStats = {
            timestamp: performance.now(),
            bytesSent: this.currentStats.bytesSent || 0,
            bytesReceived: this.currentStats.bytesReceived || 0,
            messagesSent: this.currentStats.messagesSent || 0,
            messagesReceived: this.currentStats.messagesReceived || 0,
            latency: avgLatency,
            packetLoss: 0 // Would require packet tracking
        };

        this.history.push(stats);
        if (this.history.length > this.maxHistory) {
            this.history.shift();
        }

        this.currentStats = {
            bytesSent: 0,
            bytesReceived: 0,
            messagesSent: 0,
            messagesReceived: 0
        };
    }

    /**
     * Get current bandwidth usage (bytes/sec)
     */
    public getBandwidth(): { sent: number; received: number } {
        if (this.history.length < 2) return { sent: 0, received: 0 };

        const recent = this.history.slice(-10);
        const duration = (recent[recent.length - 1].timestamp - recent[0].timestamp) / 1000;

        if (duration === 0) return { sent: 0, received: 0 };

        const totalSent = recent.reduce((sum, s) => sum + s.bytesSent, 0);
        const totalReceived = recent.reduce((sum, s) => sum + s.bytesReceived, 0);

        return {
            sent: totalSent / duration,
            received: totalReceived / duration
        };
    }

    /**
     * Get average latency
     */
    public getAverageLatency(): number {
        if (this.latencySamples.length === 0) return 0;
        return this.latencySamples.reduce((sum, l) => sum + l, 0) / this.latencySamples.length;
    }

    /**
     * Get history
     */
    public getHistory(): NetworkStats[] {
        return [...this.history];
    }

    /**
     * Clear data
     */
    public clear(): void {
        this.history = [];
        this.currentStats = {
            bytesSent: 0,
            bytesReceived: 0,
            messagesSent: 0,
            messagesReceived: 0
        };
        this.latencySamples = [];
    }
}

/**
 * Performance Analyzer - Analyzes profiling data and provides recommendations
 */
export class PerformanceAnalyzer {
    /**
     * Analyze frame profiler data
     */
    public static analyzeFrame(profiler: FrameProfiler): PerformanceRecommendation[] {
        const recommendations: PerformanceRecommendation[] = [];
        const avgFPS = profiler.getAverageFPS();
        const percentiles = profiler.getFrameTimePercentiles();

        // Low FPS
        if (avgFPS < 30) {
            recommendations.push({
                category: 'rendering',
                severity: 'critical',
                issue: `Low average FPS: ${avgFPS.toFixed(1)}`,
                recommendation: 'Reduce draw calls, enable GPU instancing, or lower quality settings',
                impact: 'high'
            });
        } else if (avgFPS < 50) {
            recommendations.push({
                category: 'rendering',
                severity: 'warning',
                issue: `FPS below target: ${avgFPS.toFixed(1)}`,
                recommendation: 'Consider optimizing shaders or reducing particle count',
                impact: 'medium'
            });
        }

        // Frame time spikes
        if (percentiles.p99 > 33.33) { // 30 FPS
            recommendations.push({
                category: 'general',
                severity: 'warning',
                issue: 'Detected frame time spikes',
                recommendation: 'Investigate GC pauses, spread work across frames, or use object pooling',
                impact: 'medium'
            });
        }

        return recommendations;
    }

    /**
     * Analyze memory profiler data
     */
    public static analyzeMemory(profiler: MemoryProfiler): PerformanceRecommendation[] {
        const recommendations: PerformanceRecommendation[] = [];
        const current = profiler.getCurrentMemory();
        const trend = profiler.getMemoryTrend();
        const hasLeaks = profiler.detectLeaks();

        if (!current) return recommendations;

        // High memory usage
        const usage = current.heapUsed / current.heapLimit;
        if (usage > 0.9) {
            recommendations.push({
                category: 'memory',
                severity: 'critical',
                issue: `Very high memory usage: ${(usage * 100).toFixed(1)}%`,
                recommendation: 'Reduce asset quality, implement texture streaming, or clear unused resources',
                impact: 'high'
            });
        } else if (usage > 0.75) {
            recommendations.push({
                category: 'memory',
                severity: 'warning',
                issue: `High memory usage: ${(usage * 100).toFixed(1)}%`,
                recommendation: 'Monitor memory usage and consider resource optimization',
                impact: 'medium'
            });
        }

        // Memory leaks
        if (hasLeaks) {
            recommendations.push({
                category: 'memory',
                severity: 'critical',
                issue: 'Possible memory leak detected',
                recommendation: 'Check for unreleased event listeners, circular references, or cached data',
                impact: 'high'
            });
        } else if (trend === 'increasing') {
            recommendations.push({
                category: 'memory',
                severity: 'info',
                issue: 'Memory usage trending upward',
                recommendation: 'Monitor for potential leaks over longer periods',
                impact: 'low'
            });
        }

        return recommendations;
    }

    /**
     * Analyze GPU profiler data
     */
    public static analyzeGPU(profiler: GPUProfiler): PerformanceRecommendation[] {
        const recommendations: PerformanceRecommendation[] = [];
        const stats = profiler.getAverageStats();

        // High draw calls
        if (stats.drawCalls > 1000) {
            recommendations.push({
                category: 'rendering',
                severity: 'critical',
                issue: `Very high draw calls: ${stats.drawCalls.toFixed(0)}`,
                recommendation: 'Enable GPU instancing, batch static geometry, or reduce object count',
                impact: 'high'
            });
        } else if (stats.drawCalls > 500) {
            recommendations.push({
                category: 'rendering',
                severity: 'warning',
                issue: `High draw calls: ${stats.drawCalls.toFixed(0)}`,
                recommendation: 'Consider batching or instancing for better performance',
                impact: 'medium'
            });
        }

        // High triangle count
        if (stats.triangles > 1000000) {
            recommendations.push({
                category: 'rendering',
                severity: 'warning',
                issue: `Very high triangle count: ${(stats.triangles / 1000000).toFixed(1)}M`,
                recommendation: 'Enable LOD system, frustum culling, or reduce mesh complexity',
                impact: 'high'
            });
        }

        // High state changes
        if (stats.stateChanges > 200) {
            recommendations.push({
                category: 'rendering',
                severity: 'info',
                issue: `High state changes: ${stats.stateChanges.toFixed(0)}`,
                recommendation: 'Sort draw calls by material to reduce state changes',
                impact: 'medium'
            });
        }

        return recommendations;
    }

    /**
     * Analyze network profiler data
     */
    public static analyzeNetwork(profiler: NetworkProfiler): PerformanceRecommendation[] {
        const recommendations: PerformanceRecommendation[] = [];
        const bandwidth = profiler.getBandwidth();
        const latency = profiler.getAverageLatency();

        // High bandwidth
        const totalBandwidth = bandwidth.sent + bandwidth.received;
        if (totalBandwidth > 1000000) { // 1 MB/s
            recommendations.push({
                category: 'network',
                severity: 'warning',
                issue: `High bandwidth usage: ${(totalBandwidth / 1000000).toFixed(2)} MB/s`,
                recommendation: 'Compress data, reduce update frequency, or use delta compression',
                impact: 'medium'
            });
        }

        // High latency
        if (latency > 200) {
            recommendations.push({
                category: 'network',
                severity: 'warning',
                issue: `High network latency: ${latency.toFixed(0)}ms`,
                recommendation: 'Implement client-side prediction and interpolation',
                impact: 'high'
            });
        } else if (latency > 100) {
            recommendations.push({
                category: 'network',
                severity: 'info',
                issue: `Elevated latency: ${latency.toFixed(0)}ms`,
                recommendation: 'Consider regional servers or CDN for better latency',
                impact: 'medium'
            });
        }

        return recommendations;
    }

    /**
     * Get all recommendations
     */
    public static analyze(
        frameProfiler: FrameProfiler,
        memoryProfiler: MemoryProfiler,
        gpuProfiler: GPUProfiler,
        networkProfiler: NetworkProfiler
    ): PerformanceRecommendation[] {
        return [
            ...this.analyzeFrame(frameProfiler),
            ...this.analyzeMemory(memoryProfiler),
            ...this.analyzeGPU(gpuProfiler),
            ...this.analyzeNetwork(networkProfiler)
        ];
    }
}
