/**
 * @fileoverview WebForge Development Toolkit
 * @module dev
 * 
 * Production-grade unified development tools for WebForge:
 * - Comprehensive error tracking and reporting
 * - Performance profiling and monitoring
 * - Memory leak detection
 * - Network request monitoring
 * - WebGL state debugging
 * - Runtime type checking
 * - Hot module tracking
 * - Automatic bug reporting
 * 
 * @author MrNova420
 * @license MIT
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface DevError {
    id: string;
    timestamp: number;
    type: 'error' | 'warning' | 'info' | 'debug';
    category: 'runtime' | 'syntax' | 'network' | 'webgl' | 'memory' | 'performance' | 'type' | 'assertion' | 'import';
    message: string;
    stack?: string;
    source?: string;
    line?: number;
    column?: number;
    context?: Record<string, any>;
    handled: boolean;
    count: number;
}

export interface DevPerformanceMetric {
    name: string;
    value: number;
    unit: string;
    timestamp: number;
    category: 'frame' | 'memory' | 'network' | 'render' | 'script' | 'custom';
    threshold?: { warn: number; error: number };
}

export interface DevNetworkRequest {
    id: string;
    url: string;
    method: string;
    status: number;
    statusText: string;
    startTime: number;
    endTime: number;
    duration: number;
    size: number;
    type: string;
    error?: string;
}

export interface DevMemorySnapshot {
    timestamp: number;
    usedJSHeapSize: number;
    totalJSHeapSize: number;
    jsHeapSizeLimit: number;
    domNodes: number;
    eventListeners: number;
}

export interface DevWebGLState {
    contextLost: boolean;
    programs: number;
    textures: number;
    buffers: number;
    framebuffers: number;
    renderbuffers: number;
    shaders: number;
    maxTextureSize: number;
    maxVertexAttribs: number;
    extensions: string[];
}

export interface DevToolsConfig {
    enabled: boolean;
    captureErrors: boolean;
    captureWarnings: boolean;
    captureNetwork: boolean;
    capturePerformance: boolean;
    captureMemory: boolean;
    captureWebGL: boolean;
    memorySnapshotInterval: number;
    performanceThresholds: {
        frameTime: { warn: number; error: number };
        heapSize: { warn: number; error: number };
        networkLatency: { warn: number; error: number };
    };
    maxErrorHistory: number;
    maxNetworkHistory: number;
    showOverlay: boolean;
    overlayPosition: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatTime(ms: number): string {
    if (ms < 1) return `${(ms * 1000).toFixed(2)}μs`;
    if (ms < 1000) return `${ms.toFixed(2)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
}

// ============================================================================
// ERROR TRACKER
// ============================================================================

class ErrorTracker {
    private errors: Map<string, DevError> = new Map();
    private listeners: Set<(error: DevError) => void> = new Set();
    private maxHistory: number;
    private initialized: boolean = false;
    
    constructor(maxHistory: number = 1000) {
        this.maxHistory = maxHistory;
    }
    
    initialize(): void {
        if (this.initialized) return;
        this.setupGlobalHandlers();
        this.initialized = true;
    }
    
    private setupGlobalHandlers(): void {
        // Global error handler
        window.addEventListener('error', (event) => {
            this.capture({
                type: 'error',
                category: event.error instanceof SyntaxError ? 'syntax' : 'runtime',
                message: event.message || 'Unknown error',
                stack: event.error?.stack,
                source: event.filename,
                line: event.lineno,
                column: event.colno
            });
        });
        
        // Unhandled promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            const error = event.reason;
            this.capture({
                type: 'error',
                category: 'runtime',
                message: error?.message || String(error) || 'Unhandled promise rejection',
                stack: error?.stack,
                context: { promise: true, reason: error }
            });
        });
        
        // Console error/warn interception
        const originalError = console.error.bind(console);
        const originalWarn = console.warn.bind(console);
        const self = this;
        
        console.error = function(...args: any[]) {
            self.capture({
                type: 'error',
                category: 'runtime',
                message: args.map(a => {
                    if (a instanceof Error) return a.message;
                    if (typeof a === 'object') {
                        try { return JSON.stringify(a); } catch { return String(a); }
                    }
                    return String(a);
                }).join(' '),
                stack: args.find(a => a instanceof Error)?.stack,
                context: { source: 'console.error', args }
            });
            originalError.apply(console, args);
        };
        
        console.warn = function(...args: any[]) {
            self.capture({
                type: 'warning',
                category: 'runtime',
                message: args.map(a => {
                    if (typeof a === 'object') {
                        try { return JSON.stringify(a); } catch { return String(a); }
                    }
                    return String(a);
                }).join(' '),
                context: { source: 'console.warn', args }
            });
            originalWarn.apply(console, args);
        };
    }
    
    capture(data: Partial<DevError>): DevError {
        // Generate fingerprint for deduplication
        const fingerprint = `${data.category}-${data.message}-${data.source || ''}-${data.line || ''}`;
        
        const existing = this.errors.get(fingerprint);
        if (existing) {
            existing.count++;
            existing.timestamp = Date.now();
            this.notify(existing);
            return existing;
        }
        
        const error: DevError = {
            id: generateId(),
            timestamp: Date.now(),
            type: data.type || 'error',
            category: data.category || 'runtime',
            message: data.message || 'Unknown error',
            stack: data.stack,
            source: data.source,
            line: data.line,
            column: data.column,
            context: data.context,
            handled: false,
            count: 1
        };
        
        this.errors.set(fingerprint, error);
        
        // Trim history
        if (this.errors.size > this.maxHistory) {
            const oldest = Array.from(this.errors.entries())
                .sort((a, b) => a[1].timestamp - b[1].timestamp)[0];
            this.errors.delete(oldest[0]);
        }
        
        this.notify(error);
        return error;
    }
    
    private notify(error: DevError): void {
        for (const listener of this.listeners) {
            try {
                listener(error);
            } catch {
                // Prevent infinite loops
            }
        }
    }
    
    onError(callback: (error: DevError) => void): () => void {
        this.listeners.add(callback);
        return () => this.listeners.delete(callback);
    }
    
    getErrors(): DevError[] {
        return Array.from(this.errors.values()).sort((a, b) => b.timestamp - a.timestamp);
    }
    
    getErrorsByCategory(category: DevError['category']): DevError[] {
        return this.getErrors().filter(e => e.category === category);
    }
    
    getErrorCount(): { total: number; byType: Record<string, number>; byCategory: Record<string, number> } {
        const errors = this.getErrors();
        const byType: Record<string, number> = {};
        const byCategory: Record<string, number> = {};
        
        for (const e of errors) {
            byType[e.type] = (byType[e.type] || 0) + e.count;
            byCategory[e.category] = (byCategory[e.category] || 0) + e.count;
        }
        
        return {
            total: errors.reduce((sum, e) => sum + e.count, 0),
            byType,
            byCategory
        };
    }
    
    clear(): void {
        this.errors.clear();
    }
    
    markHandled(id: string): void {
        for (const error of this.errors.values()) {
            if (error.id === id) {
                error.handled = true;
                break;
            }
        }
    }
}

// ============================================================================
// PERFORMANCE PROFILER
// ============================================================================

class PerformanceProfiler {
    private metrics: DevPerformanceMetric[] = [];
    private marks: Map<string, number> = new Map();
    private frameHistory: number[] = [];
    private maxHistory: number = 300;
    private thresholds: DevToolsConfig['performanceThresholds'];
    private listeners: Set<(metric: DevPerformanceMetric) => void> = new Set();
    
    private lastFrameTime: number = 0;
    private frameCount: number = 0;
    private fpsUpdateTime: number = 0;
    private currentFPS: number = 60;
    private frameTimeAvg: number = 16.67;
    private animationFrameId: number | null = null;
    
    constructor(thresholds: DevToolsConfig['performanceThresholds']) {
        this.thresholds = thresholds;
    }
    
    start(): void {
        if (this.animationFrameId !== null) return;
        this.lastFrameTime = performance.now();
        this.fpsUpdateTime = this.lastFrameTime;
        this.monitor();
    }
    
    stop(): void {
        if (this.animationFrameId !== null) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }
    
    private monitor = (): void => {
        const now = performance.now();
        
        if (this.lastFrameTime > 0) {
            const frameTime = now - this.lastFrameTime;
            this.frameHistory.push(frameTime);
            
            if (this.frameHistory.length > this.maxHistory) {
                this.frameHistory.shift();
            }
            
            this.frameTimeAvg = this.frameHistory.reduce((a, b) => a + b, 0) / this.frameHistory.length;
            
            this.frameCount++;
            if (now - this.fpsUpdateTime >= 1000) {
                this.currentFPS = this.frameCount;
                this.frameCount = 0;
                this.fpsUpdateTime = now;
                
                this.record({
                    name: 'fps',
                    value: this.currentFPS,
                    unit: 'fps',
                    category: 'frame',
                    threshold: { warn: 30, error: 15 }
                });
                
                this.record({
                    name: 'frameTime',
                    value: this.frameTimeAvg,
                    unit: 'ms',
                    category: 'frame',
                    threshold: this.thresholds.frameTime
                });
            }
        }
        
        this.lastFrameTime = now;
        this.animationFrameId = requestAnimationFrame(this.monitor);
    };
    
    mark(name: string): void {
        this.marks.set(name, performance.now());
    }
    
    measure(name: string, startMark: string, category: DevPerformanceMetric['category'] = 'custom'): number {
        const start = this.marks.get(startMark);
        if (start === undefined) {
            return 0;
        }
        
        const duration = performance.now() - start;
        this.record({
            name,
            value: duration,
            unit: 'ms',
            category
        });
        
        return duration;
    }
    
    record(data: Omit<DevPerformanceMetric, 'timestamp'>): void {
        const metric: DevPerformanceMetric = {
            ...data,
            timestamp: Date.now()
        };
        
        this.metrics.push(metric);
        
        if (this.metrics.length > 10000) {
            this.metrics = this.metrics.slice(-5000);
        }
        
        for (const listener of this.listeners) {
            listener(metric);
        }
    }
    
    onMetric(callback: (metric: DevPerformanceMetric) => void): () => void {
        this.listeners.add(callback);
        return () => this.listeners.delete(callback);
    }
    
    getFPS(): number {
        return this.currentFPS;
    }
    
    getFrameTime(): number {
        return this.frameTimeAvg;
    }
    
    getMetrics(category?: DevPerformanceMetric['category']): DevPerformanceMetric[] {
        if (category) {
            return this.metrics.filter(m => m.category === category);
        }
        return [...this.metrics];
    }
    
    getSummary(): Record<string, { avg: number; min: number; max: number; count: number }> {
        const summary: Record<string, { values: number[] }> = {};
        
        for (const metric of this.metrics) {
            if (!summary[metric.name]) {
                summary[metric.name] = { values: [] };
            }
            summary[metric.name].values.push(metric.value);
        }
        
        const result: Record<string, { avg: number; min: number; max: number; count: number }> = {};
        for (const [name, data] of Object.entries(summary)) {
            const values = data.values;
            result[name] = {
                avg: values.reduce((a, b) => a + b, 0) / values.length,
                min: Math.min(...values),
                max: Math.max(...values),
                count: values.length
            };
        }
        
        return result;
    }
    
    clear(): void {
        this.metrics = [];
        this.marks.clear();
    }
}

// ============================================================================
// MEMORY MONITOR
// ============================================================================

class MemoryMonitor {
    private snapshots: DevMemorySnapshot[] = [];
    private interval: number | null = null;
    private maxSnapshots: number = 1000;
    private listeners: Set<(snapshot: DevMemorySnapshot) => void> = new Set();
    private leakDetectionBaseline: DevMemorySnapshot | null = null;
    
    start(intervalMs: number = 5000): void {
        if (this.interval !== null) return;
        
        this.takeSnapshot();
        this.interval = window.setInterval(() => this.takeSnapshot(), intervalMs);
    }
    
    stop(): void {
        if (this.interval !== null) {
            clearInterval(this.interval);
            this.interval = null;
        }
    }
    
    takeSnapshot(): DevMemorySnapshot {
        const memory = (performance as any).memory;
        
        const snapshot: DevMemorySnapshot = {
            timestamp: Date.now(),
            usedJSHeapSize: memory?.usedJSHeapSize || 0,
            totalJSHeapSize: memory?.totalJSHeapSize || 0,
            jsHeapSizeLimit: memory?.jsHeapSizeLimit || 0,
            domNodes: document.getElementsByTagName('*').length,
            eventListeners: 0
        };
        
        this.snapshots.push(snapshot);
        
        if (this.snapshots.length > this.maxSnapshots) {
            this.snapshots.shift();
        }
        
        for (const listener of this.listeners) {
            listener(snapshot);
        }
        
        return snapshot;
    }
    
    setLeakDetectionBaseline(): void {
        this.leakDetectionBaseline = this.takeSnapshot();
    }
    
    checkForLeaks(): { hasLeak: boolean; heapGrowth: number; nodeGrowth: number } {
        if (!this.leakDetectionBaseline) {
            return { hasLeak: false, heapGrowth: 0, nodeGrowth: 0 };
        }
        
        const current = this.getLatest();
        if (!current) {
            return { hasLeak: false, heapGrowth: 0, nodeGrowth: 0 };
        }
        
        const heapGrowth = current.usedJSHeapSize - this.leakDetectionBaseline.usedJSHeapSize;
        const nodeGrowth = current.domNodes - this.leakDetectionBaseline.domNodes;
        
        const hasLeak = heapGrowth > 50 * 1024 * 1024 || nodeGrowth > 1000;
        
        return { hasLeak, heapGrowth, nodeGrowth };
    }
    
    onSnapshot(callback: (snapshot: DevMemorySnapshot) => void): () => void {
        this.listeners.add(callback);
        return () => this.listeners.delete(callback);
    }
    
    getLatest(): DevMemorySnapshot | null {
        return this.snapshots[this.snapshots.length - 1] || null;
    }
    
    getSnapshots(): DevMemorySnapshot[] {
        return [...this.snapshots];
    }
    
    getMemoryTrend(): 'stable' | 'growing' | 'shrinking' {
        if (this.snapshots.length < 10) return 'stable';
        
        const recent = this.snapshots.slice(-10);
        const first = recent[0].usedJSHeapSize;
        const last = recent[recent.length - 1].usedJSHeapSize;
        const diff = last - first;
        
        if (diff > 5 * 1024 * 1024) return 'growing';
        if (diff < -5 * 1024 * 1024) return 'shrinking';
        return 'stable';
    }
    
    clear(): void {
        this.snapshots = [];
        this.leakDetectionBaseline = null;
    }
}

// ============================================================================
// NETWORK MONITOR
// ============================================================================

class NetworkMonitor {
    private requests: DevNetworkRequest[] = [];
    private maxHistory: number = 500;
    private listeners: Set<(request: DevNetworkRequest) => void> = new Set();
    private originalFetch: typeof fetch | null = null;
    private initialized: boolean = false;
    
    initialize(): void {
        if (this.initialized) return;
        this.interceptFetch();
        this.interceptXHR();
        this.initialized = true;
    }
    
    private interceptFetch(): void {
        this.originalFetch = window.fetch.bind(window);
        const self = this;
        
        window.fetch = async function(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
            const url = typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request).url;
            const method = init?.method || 'GET';
            const id = generateId();
            const startTime = performance.now();
            
            try {
                const response = await self.originalFetch!(input, init);
                
                const clone = response.clone();
                let size = 0;
                try {
                    const blob = await clone.blob();
                    size = blob.size;
                } catch {
                    // Ignore size errors
                }
                
                self.record({
                    id,
                    url,
                    method,
                    status: response.status,
                    statusText: response.statusText,
                    startTime,
                    endTime: performance.now(),
                    duration: performance.now() - startTime,
                    size,
                    type: response.headers.get('content-type') || 'unknown'
                });
                
                return response;
            } catch (error: any) {
                self.record({
                    id,
                    url,
                    method,
                    status: 0,
                    statusText: 'Failed',
                    startTime,
                    endTime: performance.now(),
                    duration: performance.now() - startTime,
                    size: 0,
                    type: 'error',
                    error: error.message
                });
                throw error;
            }
        };
    }
    
    private interceptXHR(): void {
        const self = this;
        const originalOpen = XMLHttpRequest.prototype.open;
        const originalSend = XMLHttpRequest.prototype.send;
        
        XMLHttpRequest.prototype.open = function(method: string, url: string | URL, ...args: any[]) {
            const id = generateId();
            (this as any).__networkMonitorData = {
                id,
                url: url.toString(),
                method,
                startTime: 0
            };
            return originalOpen.apply(this, [method, url, ...args] as any);
        };
        
        XMLHttpRequest.prototype.send = function(body?: Document | XMLHttpRequestBodyInit | null) {
            const data = (this as any).__networkMonitorData;
            if (data) {
                data.startTime = performance.now();
                
                this.addEventListener('loadend', () => {
                    self.record({
                        id: data.id,
                        url: data.url,
                        method: data.method,
                        status: this.status,
                        statusText: this.statusText || (this.status === 0 ? 'Failed' : 'OK'),
                        startTime: data.startTime,
                        endTime: performance.now(),
                        duration: performance.now() - data.startTime,
                        size: this.response?.length || 0,
                        type: this.getResponseHeader('content-type') || 'unknown',
                        error: this.status === 0 ? 'Network error or CORS' : undefined
                    });
                });
            }
            return originalSend.apply(this, [body] as any);
        };
    }
    
    private record(request: DevNetworkRequest): void {
        this.requests.push(request);
        
        if (this.requests.length > this.maxHistory) {
            this.requests.shift();
        }
        
        for (const listener of this.listeners) {
            listener(request);
        }
    }
    
    onRequest(callback: (request: DevNetworkRequest) => void): () => void {
        this.listeners.add(callback);
        return () => this.listeners.delete(callback);
    }
    
    getRequests(): DevNetworkRequest[] {
        return [...this.requests];
    }
    
    getFailedRequests(): DevNetworkRequest[] {
        return this.requests.filter(r => r.status === 0 || r.status >= 400);
    }
    
    getSummary(): { 
        total: number; 
        failed: number; 
        avgDuration: number;
        totalSize: number;
        byStatus: Record<number, number>;
    } {
        const failed = this.requests.filter(r => r.status === 0 || r.status >= 400).length;
        const avgDuration = this.requests.length > 0 
            ? this.requests.reduce((sum, r) => sum + r.duration, 0) / this.requests.length 
            : 0;
        const totalSize = this.requests.reduce((sum, r) => sum + r.size, 0);
        
        const byStatus: Record<number, number> = {};
        for (const r of this.requests) {
            byStatus[r.status] = (byStatus[r.status] || 0) + 1;
        }
        
        return { total: this.requests.length, failed, avgDuration, totalSize, byStatus };
    }
    
    clear(): void {
        this.requests = [];
    }
}

// ============================================================================
// WEBGL DEBUGGER
// ============================================================================

class WebGLDebugger {
    private contexts: Map<WebGLRenderingContext | WebGL2RenderingContext, DevWebGLState> = new Map();
    private errors: string[] = [];
    
    register(gl: WebGLRenderingContext | WebGL2RenderingContext): void {
        if (this.contexts.has(gl)) return;
        
        this.contexts.set(gl, this.getState(gl));
        
        gl.canvas.addEventListener('webglcontextlost', (e) => {
            e.preventDefault();
            this.errors.push(`WebGL context lost on canvas: ${(gl.canvas as HTMLCanvasElement).id || 'unknown'}`);
            const state = this.contexts.get(gl);
            if (state) state.contextLost = true;
        });
        
        gl.canvas.addEventListener('webglcontextrestored', () => {
            const state = this.contexts.get(gl);
            if (state) state.contextLost = false;
        });
    }
    
    getState(gl: WebGLRenderingContext | WebGL2RenderingContext): DevWebGLState {
        const extensions: string[] = [];
        const supportedExtensions = gl.getSupportedExtensions();
        if (supportedExtensions) {
            for (const ext of supportedExtensions) {
                if (gl.getExtension(ext)) {
                    extensions.push(ext);
                }
            }
        }
        
        return {
            contextLost: gl.isContextLost(),
            programs: 0,
            textures: 0,
            buffers: 0,
            framebuffers: 0,
            renderbuffers: 0,
            shaders: 0,
            maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
            maxVertexAttribs: gl.getParameter(gl.MAX_VERTEX_ATTRIBS),
            extensions
        };
    }
    
    checkErrors(gl: WebGLRenderingContext | WebGL2RenderingContext): string[] {
        const errors: string[] = [];
        let error = gl.getError();
        
        while (error !== gl.NO_ERROR) {
            let errorString: string;
            switch (error) {
                case gl.INVALID_ENUM: errorString = 'INVALID_ENUM'; break;
                case gl.INVALID_VALUE: errorString = 'INVALID_VALUE'; break;
                case gl.INVALID_OPERATION: errorString = 'INVALID_OPERATION'; break;
                case gl.INVALID_FRAMEBUFFER_OPERATION: errorString = 'INVALID_FRAMEBUFFER_OPERATION'; break;
                case gl.OUT_OF_MEMORY: errorString = 'OUT_OF_MEMORY'; break;
                case gl.CONTEXT_LOST_WEBGL: errorString = 'CONTEXT_LOST_WEBGL'; break;
                default: errorString = `Unknown error (${error})`;
            }
            errors.push(errorString);
            this.errors.push(`WebGL Error: ${errorString}`);
            error = gl.getError();
        }
        
        return errors;
    }
    
    getErrors(): string[] {
        return [...this.errors];
    }
    
    clearErrors(): void {
        this.errors = [];
    }
}

// ============================================================================
// ASSERTION LIBRARY
// ============================================================================

class AssertionLibrary {
    private errorTracker: ErrorTracker;
    private enabled: boolean = true;
    
    constructor(errorTracker: ErrorTracker) {
        this.errorTracker = errorTracker;
    }
    
    enable(): void { this.enabled = true; }
    disable(): void { this.enabled = false; }
    
    assert(condition: boolean, message: string = 'Assertion failed', context?: any): void {
        if (!this.enabled) return;
        
        if (!condition) {
            const error = new Error(message);
            this.errorTracker.capture({
                type: 'error',
                category: 'assertion',
                message,
                stack: error.stack,
                context
            });
            throw error;
        }
    }
    
    assertEqual<T>(actual: T, expected: T, message?: string): void {
        this.assert(
            actual === expected,
            message || `Expected ${expected} but got ${actual}`,
            { actual, expected }
        );
    }
    
    assertDefined<T>(value: T | undefined | null, message?: string): asserts value is T {
        this.assert(
            value !== undefined && value !== null,
            message || 'Value is undefined or null',
            { value }
        );
    }
    
    assertType(value: any, type: string, message?: string): void {
        const actualType = typeof value;
        this.assert(
            actualType === type,
            message || `Expected type ${type} but got ${actualType}`,
            { value, expectedType: type, actualType }
        );
    }
    
    assertInstanceOf<T>(value: any, constructor: new (...args: any[]) => T, message?: string): void {
        this.assert(
            value instanceof constructor,
            message || `Expected instance of ${constructor.name}`,
            { value, constructor: constructor.name }
        );
    }
    
    assertRange(value: number, min: number, max: number, message?: string): void {
        this.assert(
            value >= min && value <= max,
            message || `Value ${value} out of range [${min}, ${max}]`,
            { value, min, max }
        );
    }
    
    fail(message: string, context?: any): never {
        this.errorTracker.capture({
            type: 'error',
            category: 'assertion',
            message,
            context
        });
        throw new Error(message);
    }
    
    warn(condition: boolean, message: string, context?: any): void {
        if (!this.enabled) return;
        
        if (!condition) {
            this.errorTracker.capture({
                type: 'warning',
                category: 'assertion',
                message,
                context
            });
        }
    }
}

// ============================================================================
// DEV OVERLAY UI
// ============================================================================

class DevOverlay {
    private container: HTMLElement | null = null;
    private visible: boolean = false;
    private position: DevToolsConfig['overlayPosition'];
    private devTools: WebForgeDevTools;
    private updateInterval: number | null = null;
    
    constructor(devTools: WebForgeDevTools, position: DevToolsConfig['overlayPosition']) {
        this.devTools = devTools;
        this.position = position;
    }
    
    show(): void {
        if (this.container) {
            this.container.style.display = 'block';
            this.visible = true;
            this.startUpdates();
            return;
        }
        
        this.createOverlay();
        this.visible = true;
        this.startUpdates();
    }
    
    hide(): void {
        if (this.container) {
            this.container.style.display = 'none';
        }
        this.visible = false;
        this.stopUpdates();
    }
    
    toggle(): void {
        if (this.visible) {
            this.hide();
        } else {
            this.show();
        }
    }
    
    private createOverlay(): void {
        this.container = document.createElement('div');
        this.container.id = 'webforge-dev-overlay';
        
        const positions: Record<string, string> = {
            'top-left': 'top: 10px; left: 10px;',
            'top-right': 'top: 10px; right: 10px;',
            'bottom-left': 'bottom: 10px; left: 10px;',
            'bottom-right': 'bottom: 10px; right: 10px;'
        };
        
        this.container.innerHTML = `
            <style>
                #webforge-dev-overlay {
                    position: fixed;
                    ${positions[this.position]}
                    width: 340px;
                    max-height: 85vh;
                    background: rgba(10, 10, 20, 0.97);
                    border: 1px solid #3a3a5a;
                    border-radius: 8px;
                    font-family: 'Consolas', 'Monaco', monospace;
                    font-size: 11px;
                    color: #ccc;
                    z-index: 999999;
                    overflow: hidden;
                    box-shadow: 0 4px 24px rgba(0,0,0,0.6);
                }
                #webforge-dev-overlay * { box-sizing: border-box; }
                #webforge-dev-overlay .dev-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 10px 14px;
                    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
                    border-bottom: 1px solid #3a3a5a;
                    font-weight: bold;
                    cursor: move;
                }
                #webforge-dev-overlay .dev-header-title {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }
                #webforge-dev-overlay .dev-logo {
                    font-size: 16px;
                }
                #webforge-dev-overlay .dev-status {
                    width: 10px;
                    height: 10px;
                    border-radius: 50%;
                    background: #4ade80;
                    box-shadow: 0 0 8px #4ade80;
                }
                #webforge-dev-overlay .dev-status.error {
                    background: #ef4444;
                    box-shadow: 0 0 8px #ef4444;
                    animation: pulse 1s infinite;
                }
                #webforge-dev-overlay .dev-status.warning {
                    background: #f59e0b;
                    box-shadow: 0 0 8px #f59e0b;
                }
                @keyframes pulse {
                    0%, 100% { opacity: 1; transform: scale(1); }
                    50% { opacity: 0.6; transform: scale(0.9); }
                }
                #webforge-dev-overlay .dev-close {
                    background: none;
                    border: none;
                    color: #666;
                    cursor: pointer;
                    font-size: 20px;
                    padding: 0 4px;
                    line-height: 1;
                }
                #webforge-dev-overlay .dev-close:hover { color: #ef4444; }
                #webforge-dev-overlay .dev-tabs {
                    display: flex;
                    background: #0d0d1a;
                    border-bottom: 1px solid #3a3a5a;
                }
                #webforge-dev-overlay .dev-tab {
                    flex: 1;
                    padding: 8px 10px;
                    text-align: center;
                    cursor: pointer;
                    border-bottom: 2px solid transparent;
                    color: #666;
                    transition: all 0.2s;
                }
                #webforge-dev-overlay .dev-tab:hover { background: #151525; color: #aaa; }
                #webforge-dev-overlay .dev-tab.active {
                    color: #4ade80;
                    border-bottom-color: #4ade80;
                    background: #151525;
                }
                #webforge-dev-overlay .dev-content {
                    max-height: calc(85vh - 90px);
                    overflow-y: auto;
                }
                #webforge-dev-overlay .dev-panel { display: none; padding: 12px 14px; }
                #webforge-dev-overlay .dev-panel.active { display: block; }
                #webforge-dev-overlay .dev-section { margin-bottom: 16px; }
                #webforge-dev-overlay .dev-section-title {
                    color: #666;
                    font-size: 10px;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                    margin-bottom: 8px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                #webforge-dev-overlay .dev-row {
                    display: flex;
                    justify-content: space-between;
                    padding: 4px 0;
                    border-bottom: 1px solid #1a1a2e;
                }
                #webforge-dev-overlay .dev-label { color: #888; }
                #webforge-dev-overlay .dev-value { color: #fff; font-weight: bold; }
                #webforge-dev-overlay .dev-value.good { color: #4ade80; }
                #webforge-dev-overlay .dev-value.warn { color: #f59e0b; }
                #webforge-dev-overlay .dev-value.error { color: #ef4444; }
                #webforge-dev-overlay .dev-error-item {
                    padding: 8px 10px;
                    margin: 6px 0;
                    background: rgba(239, 68, 68, 0.1);
                    border-left: 3px solid #ef4444;
                    border-radius: 0 6px 6px 0;
                    font-size: 10px;
                }
                #webforge-dev-overlay .dev-error-item.warning {
                    background: rgba(245, 158, 11, 0.1);
                    border-left-color: #f59e0b;
                }
                #webforge-dev-overlay .dev-error-item.info {
                    background: rgba(59, 130, 246, 0.1);
                    border-left-color: #3b82f6;
                }
                #webforge-dev-overlay .dev-error-header {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 4px;
                }
                #webforge-dev-overlay .dev-error-time { color: #555; font-size: 9px; }
                #webforge-dev-overlay .dev-error-count {
                    background: #ef4444;
                    color: #fff;
                    padding: 1px 6px;
                    border-radius: 10px;
                    font-size: 9px;
                }
                #webforge-dev-overlay .dev-error-msg {
                    word-break: break-word;
                    line-height: 1.4;
                }
                #webforge-dev-overlay .dev-error-stack {
                    margin-top: 6px;
                    padding: 6px;
                    background: rgba(0,0,0,0.3);
                    border-radius: 4px;
                    font-size: 9px;
                    color: #888;
                    max-height: 80px;
                    overflow-y: auto;
                    white-space: pre-wrap;
                    display: none;
                }
                #webforge-dev-overlay .dev-error-item:hover .dev-error-stack { display: block; }
                #webforge-dev-overlay .dev-bar {
                    height: 6px;
                    background: #1a1a2e;
                    border-radius: 3px;
                    margin-top: 6px;
                    overflow: hidden;
                }
                #webforge-dev-overlay .dev-bar-fill {
                    height: 100%;
                    transition: width 0.3s, background 0.3s;
                    border-radius: 3px;
                }
                #webforge-dev-overlay .dev-btn {
                    padding: 5px 10px;
                    background: linear-gradient(135deg, #2a2a4a 0%, #1a1a3a 100%);
                    border: 1px solid #3a3a5a;
                    border-radius: 4px;
                    color: #ccc;
                    cursor: pointer;
                    font-size: 10px;
                    margin: 2px;
                    transition: all 0.2s;
                }
                #webforge-dev-overlay .dev-btn:hover {
                    background: linear-gradient(135deg, #3a3a5a 0%, #2a2a4a 100%);
                    border-color: #4a4a6a;
                }
                #webforge-dev-overlay .dev-net-item {
                    padding: 6px 8px;
                    margin: 4px 0;
                    background: #151520;
                    border-radius: 4px;
                    font-size: 10px;
                }
                #webforge-dev-overlay .dev-net-item.error { border-left: 3px solid #ef4444; }
                #webforge-dev-overlay .dev-net-item.slow { border-left: 3px solid #f59e0b; }
                #webforge-dev-overlay .dev-net-url {
                    color: #4ade80;
                    word-break: break-all;
                    margin-bottom: 2px;
                }
                #webforge-dev-overlay .dev-net-meta { color: #666; display: flex; gap: 10px; }
                #webforge-dev-overlay .dev-quick-stats {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 8px;
                    margin-bottom: 12px;
                }
                #webforge-dev-overlay .dev-stat-box {
                    background: #151520;
                    padding: 10px;
                    border-radius: 6px;
                    text-align: center;
                }
                #webforge-dev-overlay .dev-stat-value {
                    font-size: 18px;
                    font-weight: bold;
                    color: #4ade80;
                }
                #webforge-dev-overlay .dev-stat-label {
                    font-size: 9px;
                    color: #666;
                    text-transform: uppercase;
                }
            </style>
            <div class="dev-header">
                <div class="dev-header-title">
                    <span class="dev-logo">🔧</span>
                    <div class="dev-status" id="dev-status"></div>
                    <span>WebForge DevTools</span>
                </div>
                <div style="display: flex; gap: 6px; align-items: center;">
                    <button class="dev-btn" id="dev-export" style="padding: 4px 8px; font-size: 10px;">📥 Export</button>
                    <button class="dev-close" id="dev-close">×</button>
                </div>
            </div>
            <div class="dev-tabs">
                <div class="dev-tab active" data-tab="overview">Overview</div>
                <div class="dev-tab" data-tab="errors">Errors</div>
                <div class="dev-tab" data-tab="perf">Perf</div>
                <div class="dev-tab" data-tab="network">Network</div>
            </div>
            <div class="dev-content">
                <div class="dev-panel active" id="panel-overview">
                    <div class="dev-quick-stats">
                        <div class="dev-stat-box">
                            <div class="dev-stat-value" id="dev-fps-quick">--</div>
                            <div class="dev-stat-label">FPS</div>
                        </div>
                        <div class="dev-stat-box">
                            <div class="dev-stat-value" id="dev-errors-quick" style="color: #ef4444;">0</div>
                            <div class="dev-stat-label">Errors</div>
                        </div>
                        <div class="dev-stat-box">
                            <div class="dev-stat-value" id="dev-mem-quick">--</div>
                            <div class="dev-stat-label">Memory</div>
                        </div>
                    </div>
                    <div class="dev-section">
                        <div class="dev-section-title">Performance</div>
                        <div class="dev-row">
                            <span class="dev-label">Frame Time</span>
                            <span class="dev-value" id="dev-frametime">--</span>
                        </div>
                        <div class="dev-bar">
                            <div class="dev-bar-fill" id="dev-fps-bar" style="width: 100%; background: #4ade80;"></div>
                        </div>
                    </div>
                    <div class="dev-section">
                        <div class="dev-section-title">Memory</div>
                        <div class="dev-row">
                            <span class="dev-label">Heap Used</span>
                            <span class="dev-value" id="dev-heap-used">--</span>
                        </div>
                        <div class="dev-row">
                            <span class="dev-label">DOM Nodes</span>
                            <span class="dev-value" id="dev-dom-nodes">--</span>
                        </div>
                        <div class="dev-bar">
                            <div class="dev-bar-fill" id="dev-heap-bar" style="width: 0%; background: #4ade80;"></div>
                        </div>
                    </div>
                    <div class="dev-section">
                        <div class="dev-section-title">Network</div>
                        <div class="dev-row">
                            <span class="dev-label">Requests</span>
                            <span class="dev-value" id="dev-net-total">0</span>
                        </div>
                        <div class="dev-row">
                            <span class="dev-label">Failed</span>
                            <span class="dev-value error" id="dev-net-failed">0</span>
                        </div>
                    </div>
                </div>
                <div class="dev-panel" id="panel-errors">
                    <div class="dev-section">
                        <div class="dev-section-title">
                            Error Summary
                            <button class="dev-btn" id="dev-clear-errors">Clear All</button>
                        </div>
                        <div class="dev-row">
                            <span class="dev-label">Errors</span>
                            <span class="dev-value error" id="dev-error-count">0</span>
                        </div>
                        <div class="dev-row">
                            <span class="dev-label">Warnings</span>
                            <span class="dev-value warn" id="dev-warning-count">0</span>
                        </div>
                    </div>
                    <div class="dev-section">
                        <div class="dev-section-title">Recent Issues</div>
                        <div id="dev-error-list"></div>
                    </div>
                </div>
                <div class="dev-panel" id="panel-perf">
                    <div class="dev-section">
                        <div class="dev-section-title">Frame Timing</div>
                        <div class="dev-row">
                            <span class="dev-label">Current FPS</span>
                            <span class="dev-value" id="dev-fps">--</span>
                        </div>
                        <div class="dev-row">
                            <span class="dev-label">Avg Frame Time</span>
                            <span class="dev-value" id="dev-frametime-detail">--</span>
                        </div>
                    </div>
                    <div class="dev-section">
                        <div class="dev-section-title">Heap Memory</div>
                        <div class="dev-row">
                            <span class="dev-label">Used</span>
                            <span class="dev-value" id="dev-heap-used-detail">--</span>
                        </div>
                        <div class="dev-row">
                            <span class="dev-label">Total</span>
                            <span class="dev-value" id="dev-heap-total">--</span>
                        </div>
                        <div class="dev-row">
                            <span class="dev-label">Limit</span>
                            <span class="dev-value" id="dev-heap-limit">--</span>
                        </div>
                        <div class="dev-row">
                            <span class="dev-label">Trend</span>
                            <span class="dev-value" id="dev-memory-trend">--</span>
                        </div>
                        <div class="dev-bar">
                            <div class="dev-bar-fill" id="dev-heap-bar-detail" style="width: 0%; background: #4ade80;"></div>
                        </div>
                    </div>
                    <div class="dev-section">
                        <button class="dev-btn" id="dev-gc">Force GC</button>
                        <button class="dev-btn" id="dev-leak-baseline">Set Leak Baseline</button>
                        <button class="dev-btn" id="dev-leak-check">Check Leaks</button>
                    </div>
                </div>
                <div class="dev-panel" id="panel-network">
                    <div class="dev-section">
                        <div class="dev-section-title">
                            Summary
                            <button class="dev-btn" id="dev-clear-network">Clear</button>
                        </div>
                        <div class="dev-row">
                            <span class="dev-label">Total Requests</span>
                            <span class="dev-value" id="dev-net-total-detail">0</span>
                        </div>
                        <div class="dev-row">
                            <span class="dev-label">Failed</span>
                            <span class="dev-value error" id="dev-net-failed-detail">0</span>
                        </div>
                        <div class="dev-row">
                            <span class="dev-label">Avg Latency</span>
                            <span class="dev-value" id="dev-net-latency">--</span>
                        </div>
                        <div class="dev-row">
                            <span class="dev-label">Data Transfer</span>
                            <span class="dev-value" id="dev-net-size">--</span>
                        </div>
                    </div>
                    <div class="dev-section">
                        <div class="dev-section-title">Recent Requests</div>
                        <div id="dev-net-list"></div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(this.container);
        this.setupEventHandlers();
    }
    
    private setupEventHandlers(): void {
        if (!this.container) return;
        
        this.container.querySelector('#dev-close')?.addEventListener('click', () => this.hide());
        
        // Export button
        this.container.querySelector('#dev-export')?.addEventListener('click', () => {
            const report = this.devTools.exportReport();
            const blob = new Blob([report], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `webforge-devtools-report-${Date.now()}.json`;
            a.click();
            URL.revokeObjectURL(url);
        });
        
        this.container.querySelectorAll('.dev-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const tabName = (tab as HTMLElement).dataset.tab;
                this.container?.querySelectorAll('.dev-tab').forEach(t => t.classList.remove('active'));
                this.container?.querySelectorAll('.dev-panel').forEach(p => p.classList.remove('active'));
                tab.classList.add('active');
                this.container?.querySelector(`#panel-${tabName}`)?.classList.add('active');
            });
        });
        
        this.container.querySelector('#dev-clear-errors')?.addEventListener('click', () => {
            this.devTools.errors.clear();
            this.update();
        });
        
        this.container.querySelector('#dev-clear-network')?.addEventListener('click', () => {
            this.devTools.network.clear();
            this.update();
        });
        
        this.container.querySelector('#dev-leak-baseline')?.addEventListener('click', () => {
            this.devTools.memory.setLeakDetectionBaseline();
            alert('Leak detection baseline set!');
        });
        
        this.container.querySelector('#dev-leak-check')?.addEventListener('click', () => {
            const result = this.devTools.memory.checkForLeaks();
            if (result.hasLeak) {
                alert(`Potential leak detected!\nHeap growth: ${formatBytes(result.heapGrowth)}\nNode growth: ${result.nodeGrowth}`);
            } else {
                alert('No significant leaks detected.');
            }
        });
        
        this.container.querySelector('#dev-gc')?.addEventListener('click', () => {
            if ((window as any).gc) {
                (window as any).gc();
                alert('GC triggered');
            } else {
                alert('GC not available. Run Chrome with --js-flags="--expose-gc"');
            }
        });
        
        // Dragging
        let isDragging = false;
        let dragOffset = { x: 0, y: 0 };
        
        const header = this.container.querySelector('.dev-header') as HTMLElement;
        header?.addEventListener('mousedown', (e) => {
            if ((e.target as HTMLElement).classList.contains('dev-close')) return;
            isDragging = true;
            const rect = this.container!.getBoundingClientRect();
            dragOffset = { x: e.clientX - rect.left, y: e.clientY - rect.top };
        });
        
        document.addEventListener('mousemove', (e) => {
            if (!isDragging || !this.container) return;
            this.container.style.left = `${e.clientX - dragOffset.x}px`;
            this.container.style.top = `${e.clientY - dragOffset.y}px`;
            this.container.style.right = 'auto';
            this.container.style.bottom = 'auto';
        });
        
        document.addEventListener('mouseup', () => {
            isDragging = false;
        });
    }
    
    private startUpdates(): void {
        if (this.updateInterval !== null) return;
        // Update every 1000ms instead of 250ms - much lighter
        this.updateInterval = window.setInterval(() => this.update(), 1000);
        this.update();
    }
    
    private stopUpdates(): void {
        if (this.updateInterval !== null) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }
    
    private update(): void {
        if (!this.container || !this.visible) return;
        
        // Performance
        const fps = this.devTools.performance.getFPS();
        const frameTime = this.devTools.performance.getFrameTime();
        
        this.setText('#dev-fps-quick', fps.toString());
        this.setText('#dev-fps', fps.toString(), fps < 30 ? 'error' : fps < 55 ? 'warn' : 'good');
        this.setText('#dev-frametime', `${frameTime.toFixed(2)}ms`, frameTime > 33 ? 'error' : frameTime > 18 ? 'warn' : 'good');
        this.setText('#dev-frametime-detail', `${frameTime.toFixed(2)}ms`);
        
        const fpsBar = this.container.querySelector('#dev-fps-bar') as HTMLElement;
        if (fpsBar) {
            const fpsPercent = Math.min(100, (fps / 60) * 100);
            fpsBar.style.width = `${fpsPercent}%`;
            fpsBar.style.background = fps < 30 ? '#ef4444' : fps < 55 ? '#f59e0b' : '#4ade80';
        }
        
        // Errors
        const errorStats = this.devTools.errors.getErrorCount();
        this.setText('#dev-errors-quick', (errorStats.byType['error'] || 0).toString());
        this.setText('#dev-error-count', (errorStats.byType['error'] || 0).toString());
        this.setText('#dev-warning-count', (errorStats.byType['warning'] || 0).toString());
        
        // Update status indicator
        const status = this.container.querySelector('#dev-status');
        if (status) {
            status.className = 'dev-status';
            if (errorStats.byType['error'] > 0) {
                status.classList.add('error');
            } else if (errorStats.byType['warning'] > 0) {
                status.classList.add('warning');
            }
        }
        
        // Error list
        const errorList = this.container.querySelector('#dev-error-list');
        if (errorList) {
            const errors = this.devTools.errors.getErrors().slice(0, 15);
            errorList.innerHTML = errors.map(e => `
                <div class="dev-error-item ${e.type}">
                    <div class="dev-error-header">
                        <span class="dev-error-time">${new Date(e.timestamp).toLocaleTimeString()}</span>
                        <span style="color: #888;">[${e.category}]</span>
                        ${e.count > 1 ? `<span class="dev-error-count">×${e.count}</span>` : ''}
                    </div>
                    <div class="dev-error-msg">${this.escapeHtml(e.message.substring(0, 200))}${e.message.length > 200 ? '...' : ''}</div>
                    ${e.stack ? `<div class="dev-error-stack">${this.escapeHtml(e.stack)}</div>` : ''}
                </div>
            `).join('') || '<div style="color: #4ade80; text-align: center; padding: 20px;">✓ No errors</div>';
        }
        
        // Memory
        const memory = this.devTools.memory.getLatest();
        if (memory) {
            const memMB = Math.round(memory.usedJSHeapSize / (1024 * 1024));
            this.setText('#dev-mem-quick', `${memMB}MB`);
            this.setText('#dev-heap-used', formatBytes(memory.usedJSHeapSize));
            this.setText('#dev-heap-used-detail', formatBytes(memory.usedJSHeapSize));
            this.setText('#dev-heap-total', formatBytes(memory.totalJSHeapSize));
            this.setText('#dev-heap-limit', formatBytes(memory.jsHeapSizeLimit));
            this.setText('#dev-dom-nodes', memory.domNodes.toString());
            this.setText('#dev-memory-trend', this.devTools.memory.getMemoryTrend());
            
            const heapPercent = memory.jsHeapSizeLimit > 0 ? (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100 : 0;
            ['#dev-heap-bar', '#dev-heap-bar-detail'].forEach(selector => {
                const bar = this.container?.querySelector(selector) as HTMLElement;
                if (bar) {
                    bar.style.width = `${heapPercent}%`;
                    bar.style.background = heapPercent > 80 ? '#ef4444' : heapPercent > 60 ? '#f59e0b' : '#4ade80';
                }
            });
        }
        
        // Network
        const netSummary = this.devTools.network.getSummary();
        this.setText('#dev-net-total', netSummary.total.toString());
        this.setText('#dev-net-total-detail', netSummary.total.toString());
        this.setText('#dev-net-failed', netSummary.failed.toString());
        this.setText('#dev-net-failed-detail', netSummary.failed.toString());
        this.setText('#dev-net-latency', formatTime(netSummary.avgDuration));
        this.setText('#dev-net-size', formatBytes(netSummary.totalSize));
        
        // Network list
        const netList = this.container.querySelector('#dev-net-list');
        if (netList) {
            const requests = this.devTools.network.getRequests().slice(-10).reverse();
            netList.innerHTML = requests.map(r => {
                const isError = r.status === 0 || r.status >= 400;
                const isSlow = r.duration > 1000;
                return `
                    <div class="dev-net-item ${isError ? 'error' : ''} ${isSlow ? 'slow' : ''}">
                        <div class="dev-net-url">${r.method} ${this.escapeHtml(r.url.substring(0, 50))}${r.url.length > 50 ? '...' : ''}</div>
                        <div class="dev-net-meta">
                            <span>${r.status} ${r.statusText}</span>
                            <span>${formatTime(r.duration)}</span>
                            <span>${formatBytes(r.size)}</span>
                        </div>
                    </div>
                `;
            }).join('') || '<div style="color: #666; text-align: center; padding: 20px;">No requests yet</div>';
        }
    }
    
    private escapeHtml(text: string): string {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    private setText(selector: string, text: string, className?: string): void {
        const el = this.container?.querySelector(selector);
        if (el) {
            el.textContent = text;
            if (className) {
                el.className = `dev-value ${className}`;
            }
        }
    }
    
    destroy(): void {
        this.stopUpdates();
        this.container?.remove();
        this.container = null;
    }
}

// ============================================================================
// MAIN DEV TOOLS CLASS
// ============================================================================

export class WebForgeDevTools {
    private static instance: WebForgeDevTools | null = null;
    
    public readonly errors: ErrorTracker;
    public readonly performance: PerformanceProfiler;
    public readonly memory: MemoryMonitor;
    public readonly network: NetworkMonitor;
    public readonly webgl: WebGLDebugger;
    public readonly assert: AssertionLibrary;
    
    private overlay: DevOverlay | null = null;
    private config: DevToolsConfig;
    private initialized: boolean = false;
    
    private constructor(config: Partial<DevToolsConfig> = {}) {
        this.config = {
            enabled: true,
            captureErrors: true,
            captureWarnings: true,
            captureNetwork: true,
            capturePerformance: true,
            captureMemory: true,
            captureWebGL: true,
            memorySnapshotInterval: 5000,
            performanceThresholds: {
                frameTime: { warn: 20, error: 33 },
                heapSize: { warn: 500 * 1024 * 1024, error: 1024 * 1024 * 1024 },
                networkLatency: { warn: 500, error: 2000 }
            },
            maxErrorHistory: 1000,
            maxNetworkHistory: 500,
            showOverlay: false,  // Don't auto-show, user toggles via DevCenter button
            overlayPosition: 'top-right',
            ...config
        };
        
        this.errors = new ErrorTracker(this.config.maxErrorHistory);
        this.performance = new PerformanceProfiler(this.config.performanceThresholds);
        this.memory = new MemoryMonitor();
        this.network = new NetworkMonitor();
        this.webgl = new WebGLDebugger();
        this.assert = new AssertionLibrary(this.errors);
    }
    
    static getInstance(config?: Partial<DevToolsConfig>): WebForgeDevTools {
        if (!WebForgeDevTools.instance) {
            WebForgeDevTools.instance = new WebForgeDevTools(config);
        }
        return WebForgeDevTools.instance;
    }
    
    initialize(): void {
        if (this.initialized) return;
        
        console.log('%c🔧 WebForge DevTools Initialized', 'color: #4ade80; font-weight: bold; font-size: 14px;');
        console.log('%cPress Ctrl+Shift+D to toggle DevTools overlay', 'color: #888;');
        
        // Initialize error tracking
        if (this.config.captureErrors) {
            this.errors.initialize();
        }
        
        // Initialize network monitoring
        if (this.config.captureNetwork) {
            this.network.initialize();
        }
        
        // Start performance monitoring
        if (this.config.capturePerformance) {
            this.performance.start();
        }
        
        // Start memory monitoring
        if (this.config.captureMemory) {
            this.memory.start(this.config.memorySnapshotInterval);
        }
        
        // Setup keyboard shortcut
        window.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.shiftKey && e.key === 'D') {
                e.preventDefault();
                this.toggleOverlay();
            }
        });
        
        // Create overlay
        this.overlay = new DevOverlay(this, this.config.overlayPosition);
        
        // Show overlay by default in dev mode
        if (this.config.showOverlay) {
            // Small delay to let page load
            setTimeout(() => this.overlay?.show(), 500);
        }
        
        // Expose to window
        (window as any).devTools = this;
        
        this.initialized = true;
    }
    
    showOverlay(): void {
        if (!this.overlay) {
            this.overlay = new DevOverlay(this, this.config.overlayPosition);
        }
        this.overlay.show();
    }
    
    hideOverlay(): void {
        this.overlay?.hide();
    }
    
    toggleOverlay(): void {
        this.overlay?.toggle();
    }
    
    // Convenience methods
    log(message: string, context?: any): void {
        console.log(`[DevTools] ${message}`, context);
    }
    
    warn(message: string, context?: any): void {
        this.errors.capture({ type: 'warning', category: 'runtime', message, context });
    }
    
    error(message: string, context?: any): void {
        this.errors.capture({ type: 'error', category: 'runtime', message, context });
    }
    
    time(label: string): void {
        this.performance.mark(label);
    }
    
    timeEnd(label: string): number {
        return this.performance.measure(label, label);
    }
    
    registerWebGL(gl: WebGLRenderingContext | WebGL2RenderingContext): void {
        this.webgl.register(gl);
    }
    
    checkWebGLErrors(gl: WebGLRenderingContext | WebGL2RenderingContext): string[] {
        return this.webgl.checkErrors(gl);
    }
    
    getReport(): {
        errors: ReturnType<ErrorTracker['getErrorCount']>;
        performance: ReturnType<PerformanceProfiler['getSummary']>;
        memory: DevMemorySnapshot | null;
        network: ReturnType<NetworkMonitor['getSummary']>;
    } {
        return {
            errors: this.errors.getErrorCount(),
            performance: this.performance.getSummary(),
            memory: this.memory.getLatest(),
            network: this.network.getSummary()
        };
    }
    
    exportReport(): string {
        const report = {
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
            url: window.location.href,
            ...this.getReport(),
            errorDetails: this.errors.getErrors(),
            webglErrors: this.webgl.getErrors()
        };
        
        return JSON.stringify(report, null, 2);
    }
    
    destroy(): void {
        this.performance.stop();
        this.memory.stop();
        this.overlay?.destroy();
        WebForgeDevTools.instance = null;
    }
}

// Export singleton getter
export const getDevTools = (): WebForgeDevTools => WebForgeDevTools.getInstance();
export default WebForgeDevTools;
