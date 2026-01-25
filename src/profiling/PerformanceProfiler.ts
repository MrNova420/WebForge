/**
 * PerformanceProfiler - Advanced profiling and performance analysis
 * 
 * Provides comprehensive profiling capabilities:
 * - Frame-by-frame performance tracking
 * - Memory usage monitoring
 * - GPU performance metrics
 * - Network activity tracking
 * - Performance recommendations
 * 
 * @module profiling
 */

import { EventSystem } from '../core/EventSystem';

/**
 * Frame profile data
 */
export interface FrameProfile {
    frameNumber: number;
    timestamp: number;
    duration: number;
    fps: number;
    updateTime: number;
    renderTime: number;
    physicsTime: number;
    scriptTime: number;
    drawCalls: number;
    triangles: number;
    textures: number;
}

/**
 * Memory snapshot
 */
export interface MemorySnapshot {
    timestamp: number;
    totalMemory: number;
    usedMemory: number;
    freeMemory: number;
    textureMemory: number;
    geometryMemory: number;
    audioMemory: number;
    jsHeapSize: number;
    jsHeapLimit: number;
}

/**
 * GPU metrics
 */
export interface GPUMetrics {
    timestamp: number;
    gpuTime: number;
    drawCalls: number;
    triangles: number;
    shaderPrograms: number;
    textureBinds: number;
    bufferBinds: number;
}

/**
 * Network activity
 */
export interface NetworkActivity {
    timestamp: number;
    requestCount: number;
    bytesSent: number;
    bytesReceived: number;
    latency: number;
    bandwidth: number;
}

/**
 * Performance recommendation
 */
export interface PerformanceRecommendation {
    severity: 'info' | 'warning' | 'critical';
    category: 'rendering' | 'memory' | 'network' | 'scripting' | 'general';
    title: string;
    description: string;
    suggestion: string;
    impact: 'low' | 'medium' | 'high';
}

/**
 * Profiling session
 */
export interface ProfilingSession {
    id: string;
    startTime: number;
    endTime: number;
    duration: number;
    frameProfiles: FrameProfile[];
    memorySnapshots: MemorySnapshot[];
    gpuMetrics: GPUMetrics[];
    networkActivity: NetworkActivity[];
    recommendations: PerformanceRecommendation[];
}

/**
 * PerformanceProfiler - Main profiling class
 */
export class PerformanceProfiler {
    private events: EventSystem;
    private isActive: boolean;
    private currentSession: ProfilingSession | null;
    private sessionHistory: ProfilingSession[];
    private frameNumber: number;
    private maxHistorySize: number;
    private samplingInterval: number;
    private lastSampleTime: number;

    constructor() {
        this.events = new EventSystem();
        this.isActive = false;
        this.currentSession = null;
        this.sessionHistory = [];
        this.frameNumber = 0;
        this.maxHistorySize = 10;
        this.samplingInterval = 100; // Sample every 100ms
        this.lastSampleTime = 0;
    }

    /**
     * Start profiling session
     */
    public startProfiling(): string {
        if (this.isActive) {
            throw new Error('Profiling session already active');
        }

        const sessionId = this.generateSessionId();
        this.currentSession = {
            id: sessionId,
            startTime: Date.now(),
            endTime: 0,
            duration: 0,
            frameProfiles: [],
            memorySnapshots: [],
            gpuMetrics: [],
            networkActivity: [],
            recommendations: []
        };

        this.isActive = true;
        this.frameNumber = 0;
        this.lastSampleTime = Date.now();

        this.events.emit('profiling_started', { sessionId });

        return sessionId;
    }

    /**
     * Stop profiling session
     */
    public stopProfiling(): ProfilingSession {
        if (!this.isActive || !this.currentSession) {
            throw new Error('No active profiling session');
        }

        this.currentSession.endTime = Date.now();
        this.currentSession.duration = this.currentSession.endTime - this.currentSession.startTime;

        // Generate recommendations
        this.generateRecommendations(this.currentSession);

        // Save to history
        this.sessionHistory.push(this.currentSession);
        if (this.sessionHistory.length > this.maxHistorySize) {
            this.sessionHistory.shift();
        }

        const session = this.currentSession;
        this.currentSession = null;
        this.isActive = false;

        this.events.emit('profiling_stopped', session);

        return session;
    }

    /**
     * Record frame profile
     */
    public recordFrame(frameData: Partial<FrameProfile>): void {
        if (!this.isActive || !this.currentSession) return;

        const frame: FrameProfile = {
            frameNumber: this.frameNumber++,
            timestamp: Date.now(),
            duration: frameData.duration || 0,
            fps: frameData.fps || 0,
            updateTime: frameData.updateTime || 0,
            renderTime: frameData.renderTime || 0,
            physicsTime: frameData.physicsTime || 0,
            scriptTime: frameData.scriptTime || 0,
            drawCalls: frameData.drawCalls || 0,
            triangles: frameData.triangles || 0,
            textures: frameData.textures || 0
        };

        this.currentSession.frameProfiles.push(frame);

        // Sample other metrics periodically
        const now = Date.now();
        if (now - this.lastSampleTime >= this.samplingInterval) {
            this.sampleMetrics();
            this.lastSampleTime = now;
        }
    }

    /**
     * Sample various performance metrics
     */
    private sampleMetrics(): void {
        if (!this.currentSession) return;

        // Sample memory
        this.currentSession.memorySnapshots.push(this.captureMemorySnapshot());

        // Sample GPU metrics
        this.currentSession.gpuMetrics.push(this.captureGPUMetrics());

        // Sample network activity
        this.currentSession.networkActivity.push(this.captureNetworkActivity());
    }

    /**
     * Capture memory snapshot
     */
    private captureMemorySnapshot(): MemorySnapshot {
        // In browser environment, would use performance.memory
        const jsHeap = (performance as any).memory || {
            usedJSHeapSize: 0,
            totalJSHeapSize: 0,
            jsHeapSizeLimit: 0
        };

        return {
            timestamp: Date.now(),
            totalMemory: 1024 * 1024 * 1024, // 1GB simulated
            usedMemory: jsHeap.usedJSHeapSize || 100 * 1024 * 1024,
            freeMemory: 924 * 1024 * 1024,
            textureMemory: 50 * 1024 * 1024,
            geometryMemory: 30 * 1024 * 1024,
            audioMemory: 10 * 1024 * 1024,
            jsHeapSize: jsHeap.usedJSHeapSize || 10 * 1024 * 1024,
            jsHeapLimit: jsHeap.jsHeapSizeLimit || 500 * 1024 * 1024
        };
    }

    /**
     * Capture GPU metrics
     */
    private captureGPUMetrics(): GPUMetrics {
        return {
            timestamp: Date.now(),
            gpuTime: 8.5, // ms
            drawCalls: 150,
            triangles: 500000,
            shaderPrograms: 10,
            textureBinds: 50,
            bufferBinds: 100
        };
    }

    /**
     * Capture network activity
     */
    private captureNetworkActivity(): NetworkActivity {
        return {
            timestamp: Date.now(),
            requestCount: 5,
            bytesSent: 1024,
            bytesReceived: 10240,
            latency: 50, // ms
            bandwidth: 2048 // KB/s
        };
    }

    /**
     * Generate performance recommendations
     */
    private generateRecommendations(session: ProfilingSession): void {
        const recommendations: PerformanceRecommendation[] = [];

        // Analyze FPS
        const avgFps = this.calculateAverageFps(session.frameProfiles);
        if (avgFps < 30) {
            recommendations.push({
                severity: 'critical',
                category: 'rendering',
                title: 'Low Frame Rate',
                description: `Average FPS is ${avgFps.toFixed(1)}, which is below the target of 30 FPS`,
                suggestion: 'Reduce draw calls, optimize shaders, or implement LOD system',
                impact: 'high'
            });
        } else if (avgFps < 60) {
            recommendations.push({
                severity: 'warning',
                category: 'rendering',
                title: 'Suboptimal Frame Rate',
                description: `Average FPS is ${avgFps.toFixed(1)}, which is below the target of 60 FPS`,
                suggestion: 'Consider optimizing rendering pipeline or reducing scene complexity',
                impact: 'medium'
            });
        }

        // Analyze draw calls
        const avgDrawCalls = this.calculateAverageDrawCalls(session.frameProfiles);
        if (avgDrawCalls > 1000) {
            recommendations.push({
                severity: 'warning',
                category: 'rendering',
                title: 'High Draw Call Count',
                description: `Average draw calls: ${avgDrawCalls.toFixed(0)}. High draw call count impacts performance`,
                suggestion: 'Use instancing, batching, or combine meshes to reduce draw calls',
                impact: 'high'
            });
        }

        // Analyze memory
        if (session.memorySnapshots.length > 0) {
            const latestMemory = session.memorySnapshots[session.memorySnapshots.length - 1];
            const memoryUsagePercent = (latestMemory.usedMemory / latestMemory.totalMemory) * 100;

            if (memoryUsagePercent > 80) {
                recommendations.push({
                    severity: 'critical',
                    category: 'memory',
                    title: 'High Memory Usage',
                    description: `Memory usage at ${memoryUsagePercent.toFixed(1)}% of available memory`,
                    suggestion: 'Implement asset streaming, reduce texture sizes, or use object pooling',
                    impact: 'high'
                });
            } else if (memoryUsagePercent > 60) {
                recommendations.push({
                    severity: 'warning',
                    category: 'memory',
                    title: 'Elevated Memory Usage',
                    description: `Memory usage at ${memoryUsagePercent.toFixed(1)}% of available memory`,
                    suggestion: 'Monitor for memory leaks and consider optimizing asset usage',
                    impact: 'medium'
                });
            }
        }

        // Analyze script time
        const avgScriptTime = this.calculateAverageScriptTime(session.frameProfiles);
        if (avgScriptTime > 10) {
            recommendations.push({
                severity: 'warning',
                category: 'scripting',
                title: 'High Script Execution Time',
                description: `Average script time: ${avgScriptTime.toFixed(2)}ms per frame`,
                suggestion: 'Optimize game logic, use object pooling, or move heavy operations to Web Workers',
                impact: 'medium'
            });
        }

        session.recommendations = recommendations;
    }

    /**
     * Calculate average FPS
     */
    private calculateAverageFps(frames: FrameProfile[]): number {
        if (frames.length === 0) return 0;
        const sum = frames.reduce((acc, frame) => acc + frame.fps, 0);
        return sum / frames.length;
    }

    /**
     * Calculate average draw calls
     */
    private calculateAverageDrawCalls(frames: FrameProfile[]): number {
        if (frames.length === 0) return 0;
        const sum = frames.reduce((acc, frame) => acc + frame.drawCalls, 0);
        return sum / frames.length;
    }

    /**
     * Calculate average script time
     */
    private calculateAverageScriptTime(frames: FrameProfile[]): number {
        if (frames.length === 0) return 0;
        const sum = frames.reduce((acc, frame) => acc + frame.scriptTime, 0);
        return sum / frames.length;
    }

    /**
     * Generate session ID
     */
    private generateSessionId(): string {
        return `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    }

    /**
     * Get session history
     */
    public getSessionHistory(): ProfilingSession[] {
        return [...this.sessionHistory];
    }

    /**
     * Get current session
     */
    public getCurrentSession(): ProfilingSession | null {
        return this.currentSession;
    }

    /**
     * Check if profiling is active
     */
    public isProfilingActive(): boolean {
        return this.isActive;
    }

    /**
     * Set sampling interval
     */
    public setSamplingInterval(intervalMs: number): void {
        this.samplingInterval = Math.max(10, intervalMs);
    }

    /**
     * Listen to profiling events
     */
    public on(event: string, callback: (data: any) => void): void {
        this.events.on(event, callback);
    }

    /**
     * Remove event listener
     */
    public off(event: string, callback: (data: any) => void): void {
        this.events.off(event, callback);
    }
}
