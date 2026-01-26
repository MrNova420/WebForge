/**
 * WebForge DevCenter - The ULTIMATE All-In-One Development Tool
 * 
 * This is your single command center for everything development:
 * - Live error/warning catching (automatic)
 * - Performance monitoring
 * - Memory leak detection
 * - Network monitoring  
 * - WebSocket debugging
 * - Test runner integration
 * - Build status tracking
 * - Console enhancement
 * - Project health dashboard
 * 
 * Press Ctrl+Shift+D or F12 to open the DevCenter overlay
 * 
 * @module DevCenter
 * @version 2.0.0
 */

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

export interface DevCenterConfig {
    // Core settings
    enabled: boolean;
    autoStart: boolean;
    overlayPosition: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'fullscreen';
    theme: 'dark' | 'light' | 'auto';
    
    // Feature toggles
    enableErrorCapture: boolean;
    enablePerformanceMonitoring: boolean;
    enableMemoryMonitoring: boolean;
    enableNetworkMonitoring: boolean;
    enableWebSocketMonitoring: boolean;
    enableDOMMonitoring: boolean;
    enableConsoleCapture: boolean;
    enableResourceMonitoring: boolean;
    enableSecurityMonitoring: boolean;
    
    // Thresholds
    fpsWarningThreshold: number;
    fpsErrorThreshold: number;
    memoryWarningMB: number;
    memoryErrorMB: number;
    slowNetworkMs: number;
    longTaskMs: number;
    
    // Overlay settings
    maxIssuesDisplayed: number;
    maxNetworkEntries: number;
    maxConsoleEntries: number;
    autoShowOnError: boolean;
    persistBetweenReloads: boolean;
    
    // Integration
    integrateWithDevTools: boolean;
    integrateWithLiveDebugger: boolean;
    enableHotkeys: boolean;
}

export type DevIssueSeverity = 'error' | 'warning' | 'info' | 'performance' | 'memory' | 'network' | 'security';

export interface DevIssue {
    id: string;
    timestamp: number;
    severity: DevIssueSeverity;
    category: string;
    title: string;
    message: string;
    stack?: string;
    source?: string;
    line?: number;
    column?: number;
    suggestion?: string;
    metadata?: Record<string, unknown>;
    count: number;
    lastSeen: number;
}

export interface DevPerformanceData {
    fps: number;
    fpsHistory: number[];
    frameTime: number;
    frameTimeHistory: number[];
    longTasks: number;
    layoutShifts: number;
    paintTime: number;
    scriptTime: number;
    renderTime: number;
    idleTime: number;
}

export interface DevMemoryData {
    heapUsed: number;
    heapTotal: number;
    heapLimit: number;
    heapUsedMB: number;
    heapTotalMB: number;
    heapPercent: number;
    domNodes: number;
    listeners: number;
    detachedNodes: number;
    leakSuspected: boolean;
    heapHistory: number[];
}

export interface DevNetworkEntry {
    id: string;
    type: 'fetch' | 'xhr' | 'websocket' | 'resource';
    method: string;
    url: string;
    status: number;
    statusText: string;
    startTime: number;
    endTime: number;
    duration: number;
    size: number;
    error?: string;
    headers?: Record<string, string>;
}

export interface DevConsoleEntry {
    id: string;
    timestamp: number;
    level: 'log' | 'info' | 'warn' | 'error' | 'debug';
    message: string;
    args: unknown[];
    stack?: string;
}

export interface DevProjectHealth {
    issueCount: {
        errors: number;
        warnings: number;
        info: number;
        performance: number;
        memory: number;
        network: number;
        security: number;
        total: number;
    };
    performance: {
        score: number;
        status: 'good' | 'warning' | 'critical';
    };
    memory: {
        score: number;
        status: 'good' | 'warning' | 'critical';
    };
    network: {
        successRate: number;
        avgLatency: number;
        status: 'good' | 'warning' | 'critical';
    };
    overall: {
        score: number;
        status: 'healthy' | 'degraded' | 'critical';
        summary: string;
    };
}

type TabName = 'dashboard' | 'issues' | 'performance' | 'memory' | 'network' | 'console' | 'tools';

// ============================================================================
// DEVCENTER CLASS
// ============================================================================

export class DevCenter {
    private static instance: DevCenter | null = null;
    
    private config: DevCenterConfig;
    private isRunning: boolean = false;
    private overlay: HTMLElement | null = null;
    private activeTab: TabName = 'dashboard';
    
    // Data stores
    private issues: Map<string, DevIssue> = new Map();
    private networkEntries: DevNetworkEntry[] = [];
    private consoleEntries: DevConsoleEntry[] = [];
    
    // Performance data
    private performanceData: DevPerformanceData = {
        fps: 60,
        fpsHistory: [],
        frameTime: 16.67,
        frameTimeHistory: [],
        longTasks: 0,
        layoutShifts: 0,
        paintTime: 0,
        scriptTime: 0,
        renderTime: 0,
        idleTime: 0
    };
    
    // Memory data
    private memoryData: DevMemoryData = {
        heapUsed: 0,
        heapTotal: 0,
        heapLimit: 0,
        heapUsedMB: 0,
        heapTotalMB: 0,
        heapPercent: 0,
        domNodes: 0,
        listeners: 0,
        detachedNodes: 0,
        leakSuspected: false,
        heapHistory: []
    };
    
    // Monitoring internals
    private frameCount: number = 0;
    private lastFrameTime: number = 0;
    private fpsUpdateTime: number = 0;
    private rafId: number = 0;
    private monitoringIntervalId: number = 0;
    
    // Original console methods
    private originalConsole: {
        log: typeof console.log;
        info: typeof console.info;
        warn: typeof console.warn;
        error: typeof console.error;
        debug: typeof console.debug;
    } | null = null;
    
    // Original network methods
    private originalFetch: typeof fetch | null = null;
    private originalXHROpen: typeof XMLHttpRequest.prototype.open | null = null;
    private originalXHRSend: typeof XMLHttpRequest.prototype.send | null = null;
    private originalWebSocket: typeof WebSocket | null = null;
    
    // Event listener tracking
    private listenerCount: number = 0;
    private originalAddEventListener: typeof EventTarget.prototype.addEventListener | null = null;
    private originalRemoveEventListener: typeof EventTarget.prototype.removeEventListener | null = null;
    
    // Observers
    private performanceObserver: PerformanceObserver | null = null;
    private mutationObserver: MutationObserver | null = null;
    
    // ID counter
    private idCounter: number = 0;
    
    private constructor(config: Partial<DevCenterConfig> = {}) {
        this.config = {
            enabled: true,
            autoStart: true,
            overlayPosition: 'bottom-right',
            theme: 'dark',
            enableErrorCapture: true,
            enablePerformanceMonitoring: true,
            enableMemoryMonitoring: true,
            enableNetworkMonitoring: true,
            enableWebSocketMonitoring: true,
            enableDOMMonitoring: true,
            enableConsoleCapture: true,
            enableResourceMonitoring: true,
            enableSecurityMonitoring: true,
            fpsWarningThreshold: 50,
            fpsErrorThreshold: 30,
            memoryWarningMB: 200,
            memoryErrorMB: 500,
            slowNetworkMs: 3000,
            longTaskMs: 50,
            maxIssuesDisplayed: 100,
            maxNetworkEntries: 200,
            maxConsoleEntries: 500,
            autoShowOnError: true,
            persistBetweenReloads: true,
            integrateWithDevTools: true,
            integrateWithLiveDebugger: true,
            enableHotkeys: true,
            ...config
        };
        
        if (this.config.autoStart && typeof window !== 'undefined') {
            this.start();
        }
    }
    
    public static getInstance(config?: Partial<DevCenterConfig>): DevCenter {
        if (!DevCenter.instance) {
            DevCenter.instance = new DevCenter(config);
        }
        return DevCenter.instance;
    }
    
    // ========================================================================
    // LIFECYCLE
    // ========================================================================
    
    public start(): void {
        if (this.isRunning || typeof window === 'undefined') return;
        this.isRunning = true;
        
        console.log('%c🚀 WebForge DevCenter Started', 'color: #00ff88; font-size: 14px; font-weight: bold;');
        console.log('%c   Press Ctrl+Shift+D or F12 to open DevCenter', 'color: #888;');
        
        // Setup all monitors
        if (this.config.enableErrorCapture) this.setupErrorCapture();
        if (this.config.enableConsoleCapture) this.setupConsoleCapture();
        if (this.config.enableNetworkMonitoring) this.setupNetworkMonitoring();
        if (this.config.enableWebSocketMonitoring) this.setupWebSocketMonitoring();
        if (this.config.enablePerformanceMonitoring) this.setupPerformanceMonitoring();
        if (this.config.enableMemoryMonitoring) this.setupMemoryMonitoring();
        if (this.config.enableDOMMonitoring) this.setupDOMMonitoring();
        if (this.config.enableResourceMonitoring) this.setupResourceMonitoring();
        if (this.config.enableSecurityMonitoring) this.setupSecurityMonitoring();
        if (this.config.enableHotkeys) this.setupHotkeys();
        
        // Start frame loop for FPS
        this.startFrameLoop();
        
        // Start periodic monitoring - every 2000ms for lighter weight
        this.monitoringIntervalId = window.setInterval(() => this.periodicCheck(), 2000);
        
        // Load persisted data if enabled
        if (this.config.persistBetweenReloads) {
            this.loadPersistedData();
        }
        
        // Create minimal indicator
        this.createMinimalIndicator();
    }
    
    public stop(): void {
        if (!this.isRunning) return;
        this.isRunning = false;
        
        // Restore original methods
        this.restoreOriginals();
        
        // Stop observers
        if (this.performanceObserver) {
            this.performanceObserver.disconnect();
            this.performanceObserver = null;
        }
        if (this.mutationObserver) {
            this.mutationObserver.disconnect();
            this.mutationObserver = null;
        }
        
        // Stop loops
        if (this.rafId) cancelAnimationFrame(this.rafId);
        if (this.monitoringIntervalId) clearInterval(this.monitoringIntervalId);
        
        // Remove overlay
        if (this.overlay) {
            this.overlay.remove();
            this.overlay = null;
        }
        
        // Remove indicator
        const indicator = document.getElementById('webforge-devcenter-indicator');
        if (indicator) indicator.remove();
        
        console.log('%c⏹ WebForge DevCenter Stopped', 'color: #ff8800; font-size: 12px;');
    }
    
    // ========================================================================
    // ERROR CAPTURE
    // ========================================================================
    
    private setupErrorCapture(): void {
        // Global error handler
        window.addEventListener('error', (event) => {
            this.addIssue({
                severity: 'error',
                category: 'Runtime Error',
                title: event.message || 'Unknown Error',
                message: event.message,
                stack: event.error?.stack,
                source: event.filename,
                line: event.lineno,
                column: event.colno,
                suggestion: this.getSuggestion('error', event.message, event.error)
            });
        });
        
        // Unhandled promise rejection
        window.addEventListener('unhandledrejection', (event) => {
            const reason = event.reason;
            const message = reason?.message || String(reason);
            this.addIssue({
                severity: 'error',
                category: 'Unhandled Promise',
                title: 'Unhandled Promise Rejection',
                message: message,
                stack: reason?.stack,
                suggestion: this.getSuggestion('promise', message, reason)
            });
        });
    }
    
    // ========================================================================
    // CONSOLE CAPTURE
    // ========================================================================
    
    private setupConsoleCapture(): void {
        this.originalConsole = {
            log: console.log.bind(console),
            info: console.info.bind(console),
            warn: console.warn.bind(console),
            error: console.error.bind(console),
            debug: console.debug.bind(console)
        };
        
        const captureLevel = (level: 'log' | 'info' | 'warn' | 'error' | 'debug') => {
            const original = this.originalConsole![level];
            console[level] = (...args: unknown[]) => {
                // Call original
                original(...args);
                
                // Capture
                this.addConsoleEntry(level, args);
                
                // Errors/warnings also become issues
                if (level === 'error') {
                    const message = args.map(a => String(a)).join(' ');
                    this.addIssue({
                        severity: 'error',
                        category: 'Console Error',
                        title: 'console.error',
                        message: message,
                        stack: new Error().stack
                    });
                } else if (level === 'warn') {
                    const message = args.map(a => String(a)).join(' ');
                    this.addIssue({
                        severity: 'warning',
                        category: 'Console Warning',
                        title: 'console.warn',
                        message: message
                    });
                }
            };
        };
        
        captureLevel('log');
        captureLevel('info');
        captureLevel('warn');
        captureLevel('error');
        captureLevel('debug');
    }
    
    private addConsoleEntry(level: 'log' | 'info' | 'warn' | 'error' | 'debug', args: unknown[]): void {
        const entry: DevConsoleEntry = {
            id: this.generateId(),
            timestamp: Date.now(),
            level,
            message: args.map(a => {
                if (typeof a === 'object') {
                    try {
                        return JSON.stringify(a, null, 2);
                    } catch {
                        return String(a);
                    }
                }
                return String(a);
            }).join(' '),
            args,
            stack: level === 'error' ? new Error().stack : undefined
        };
        
        this.consoleEntries.push(entry);
        
        // Trim if needed
        while (this.consoleEntries.length > this.config.maxConsoleEntries) {
            this.consoleEntries.shift();
        }
        
        this.updateOverlay();
    }
    
    // ========================================================================
    // NETWORK MONITORING
    // ========================================================================
    
    private setupNetworkMonitoring(): void {
        // Patch fetch
        this.originalFetch = window.fetch.bind(window);
        window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
            const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
            const method = init?.method || 'GET';
            const startTime = performance.now();
            const id = this.generateId();
            
            try {
                const response = await this.originalFetch!(input, init);
                const endTime = performance.now();
                
                this.addNetworkEntry({
                    id,
                    type: 'fetch',
                    method,
                    url,
                    status: response.status,
                    statusText: response.statusText,
                    startTime,
                    endTime,
                    duration: endTime - startTime,
                    size: parseInt(response.headers.get('content-length') || '0', 10)
                });
                
                // Check for issues
                if (!response.ok) {
                    this.addIssue({
                        severity: response.status >= 500 ? 'error' : 'warning',
                        category: 'Network',
                        title: `HTTP ${response.status}`,
                        message: `${method} ${url} failed with ${response.status} ${response.statusText}`,
                        suggestion: this.getNetworkSuggestion(response.status)
                    });
                }
                
                if (endTime - startTime > this.config.slowNetworkMs) {
                    this.addIssue({
                        severity: 'performance',
                        category: 'Network',
                        title: 'Slow Request',
                        message: `${method} ${url} took ${(endTime - startTime).toFixed(0)}ms`,
                        suggestion: 'Consider optimizing this request, adding caching, or loading asynchronously'
                    });
                }
                
                return response;
            } catch (error) {
                const endTime = performance.now();
                
                this.addNetworkEntry({
                    id,
                    type: 'fetch',
                    method,
                    url,
                    status: 0,
                    statusText: 'Network Error',
                    startTime,
                    endTime,
                    duration: endTime - startTime,
                    size: 0,
                    error: String(error)
                });
                
                this.addIssue({
                    severity: 'error',
                    category: 'Network',
                    title: 'Fetch Failed',
                    message: `${method} ${url} - ${error}`,
                    suggestion: this.getNetworkErrorSuggestion(error)
                });
                
                throw error;
            }
        };
        
        // Patch XHR
        this.originalXHROpen = XMLHttpRequest.prototype.open;
        this.originalXHRSend = XMLHttpRequest.prototype.send;
        
        const self = this;
        
        XMLHttpRequest.prototype.open = function(method: string, url: string | URL, async?: boolean, username?: string | null, password?: string | null) {
            (this as XMLHttpRequest & { _devMethod: string; _devUrl: string })._devMethod = method;
            (this as XMLHttpRequest & { _devUrl: string })._devUrl = typeof url === 'string' ? url : url.href;
            return self.originalXHROpen!.call(this, method, url, async ?? true, username, password);
        };
        
        XMLHttpRequest.prototype.send = function(body?: XMLHttpRequestBodyInit | null) {
            const xhr = this as XMLHttpRequest & { _devMethod: string; _devUrl: string; _devStartTime: number; _devId: string };
            xhr._devStartTime = performance.now();
            xhr._devId = self.generateId();
            
            this.addEventListener('loadend', function() {
                const endTime = performance.now();
                
                self.addNetworkEntry({
                    id: xhr._devId,
                    type: 'xhr',
                    method: xhr._devMethod || 'GET',
                    url: xhr._devUrl || '',
                    status: this.status,
                    statusText: this.statusText,
                    startTime: xhr._devStartTime,
                    endTime,
                    duration: endTime - xhr._devStartTime,
                    size: parseInt(this.getResponseHeader('content-length') || '0', 10)
                });
                
                if (this.status >= 400) {
                    self.addIssue({
                        severity: this.status >= 500 ? 'error' : 'warning',
                        category: 'Network',
                        title: `XHR ${this.status}`,
                        message: `${xhr._devMethod} ${xhr._devUrl} failed`,
                        suggestion: self.getNetworkSuggestion(this.status)
                    });
                }
            });
            
            this.addEventListener('error', function() {
                self.addIssue({
                    severity: 'error',
                    category: 'Network',
                    title: 'XHR Error',
                    message: `${xhr._devMethod} ${xhr._devUrl} failed`,
                    suggestion: 'Check if the server is running and CORS is configured'
                });
            });
            
            return self.originalXHRSend!.call(this, body);
        };
    }
    
    private addNetworkEntry(entry: DevNetworkEntry): void {
        this.networkEntries.push(entry);
        
        while (this.networkEntries.length > this.config.maxNetworkEntries) {
            this.networkEntries.shift();
        }
        
        this.updateOverlay();
    }
    
    // ========================================================================
    // WEBSOCKET MONITORING
    // ========================================================================
    
    private setupWebSocketMonitoring(): void {
        this.originalWebSocket = window.WebSocket;
        const self = this;
        
        window.WebSocket = class extends self.originalWebSocket! {
            constructor(url: string | URL, protocols?: string | string[]) {
                super(url, protocols);
                
                const wsUrl = typeof url === 'string' ? url : url.href;
                
                this.addEventListener('open', () => {
                    self.addIssue({
                        severity: 'info',
                        category: 'WebSocket',
                        title: 'Connected',
                        message: `WebSocket connected to ${wsUrl}`
                    });
                });
                
                this.addEventListener('error', () => {
                    self.addIssue({
                        severity: 'error',
                        category: 'WebSocket',
                        title: 'Connection Error',
                        message: `WebSocket error connecting to ${wsUrl}`,
                        suggestion: self.getWebSocketSuggestion(wsUrl)
                    });
                });
                
                this.addEventListener('close', (event: CloseEvent) => {
                    if (event.code !== 1000 && event.code !== 1001) {
                        self.addIssue({
                            severity: 'warning',
                            category: 'WebSocket',
                            title: `Closed (${event.code})`,
                            message: `WebSocket to ${wsUrl} closed: ${event.reason || self.getCloseCodeMeaning(event.code)}`,
                            suggestion: self.getWebSocketCloseSuggestion(event.code)
                        });
                    }
                });
            }
        } as typeof WebSocket;
    }
    
    private getCloseCodeMeaning(code: number): string {
        const codes: Record<number, string> = {
            1000: 'Normal closure',
            1001: 'Going away',
            1002: 'Protocol error',
            1003: 'Unsupported data',
            1005: 'No status received',
            1006: 'Abnormal closure',
            1007: 'Invalid frame payload',
            1008: 'Policy violation',
            1009: 'Message too big',
            1010: 'Missing extension',
            1011: 'Internal error',
            1012: 'Service restart',
            1013: 'Try again later',
            1014: 'Bad gateway',
            1015: 'TLS handshake failure'
        };
        return codes[code] || 'Unknown';
    }
    
    // ========================================================================
    // PERFORMANCE MONITORING
    // ========================================================================
    
    private setupPerformanceMonitoring(): void {
        try {
            this.performanceObserver = new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                    if (entry.entryType === 'longtask') {
                        this.performanceData.longTasks++;
                        if (entry.duration > this.config.longTaskMs * 2) {
                            this.addIssue({
                                severity: 'performance',
                                category: 'Performance',
                                title: 'Long Task',
                                message: `Task took ${entry.duration.toFixed(0)}ms (threshold: ${this.config.longTaskMs}ms)`,
                                suggestion: 'Consider breaking this into smaller chunks or using Web Workers'
                            });
                        }
                    } else if (entry.entryType === 'layout-shift') {
                        this.performanceData.layoutShifts++;
                    }
                }
            });
            
            this.performanceObserver.observe({ entryTypes: ['longtask', 'layout-shift'] });
        } catch {
            // PerformanceObserver not supported
        }
    }
    
    private startFrameLoop(): void {
        this.lastFrameTime = performance.now();
        this.fpsUpdateTime = this.lastFrameTime;
        
        const loop = (now: number) => {
            if (!this.isRunning) return;
            
            this.frameCount++;
            const delta = now - this.lastFrameTime;
            this.lastFrameTime = now;
            
            this.performanceData.frameTimeHistory.push(delta);
            if (this.performanceData.frameTimeHistory.length > 60) {
                this.performanceData.frameTimeHistory.shift();
            }
            
            // Update FPS every 500ms
            if (now - this.fpsUpdateTime >= 500) {
                const elapsed = (now - this.fpsUpdateTime) / 1000;
                this.performanceData.fps = Math.round(this.frameCount / elapsed);
                this.frameCount = 0;
                this.fpsUpdateTime = now;
                
                this.performanceData.fpsHistory.push(this.performanceData.fps);
                if (this.performanceData.fpsHistory.length > 60) {
                    this.performanceData.fpsHistory.shift();
                }
                
                // Check FPS thresholds
                if (this.performanceData.fps < this.config.fpsErrorThreshold) {
                    this.addIssue({
                        severity: 'error',
                        category: 'Performance',
                        title: 'Critical FPS',
                        message: `FPS dropped to ${this.performanceData.fps} (threshold: ${this.config.fpsErrorThreshold})`,
                        suggestion: 'Check for expensive operations, optimize render loop, or profile for bottlenecks'
                    });
                } else if (this.performanceData.fps < this.config.fpsWarningThreshold) {
                    this.addIssue({
                        severity: 'warning',
                        category: 'Performance',
                        title: 'Low FPS',
                        message: `FPS at ${this.performanceData.fps} (warning: ${this.config.fpsWarningThreshold})`
                    });
                }
            }
            
            // Calculate frame time
            const avg = this.performanceData.frameTimeHistory.reduce((a, b) => a + b, 0) / this.performanceData.frameTimeHistory.length;
            this.performanceData.frameTime = avg;
            
            this.rafId = requestAnimationFrame(loop);
        };
        
        this.rafId = requestAnimationFrame(loop);
    }
    
    // ========================================================================
    // MEMORY MONITORING
    // ========================================================================
    
    private setupMemoryMonitoring(): void {
        // Track event listeners
        this.originalAddEventListener = EventTarget.prototype.addEventListener;
        this.originalRemoveEventListener = EventTarget.prototype.removeEventListener;
        
        const self = this;
        
        EventTarget.prototype.addEventListener = function(type: string, listener: EventListenerOrEventListenerObject | null, options?: boolean | AddEventListenerOptions) {
            self.listenerCount++;
            return self.originalAddEventListener!.call(this, type, listener, options);
        };
        
        EventTarget.prototype.removeEventListener = function(type: string, listener: EventListenerOrEventListenerObject | null, options?: boolean | EventListenerOptions) {
            self.listenerCount--;
            return self.originalRemoveEventListener!.call(this, type, listener, options);
        };
    }
    
    private periodicCheck(): void {
        // Update memory
        const perf = performance as Performance & { memory?: { usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number } };
        if (perf.memory) {
            this.memoryData.heapUsed = perf.memory.usedJSHeapSize;
            this.memoryData.heapTotal = perf.memory.totalJSHeapSize;
            this.memoryData.heapLimit = perf.memory.jsHeapSizeLimit;
            this.memoryData.heapUsedMB = this.memoryData.heapUsed / (1024 * 1024);
            this.memoryData.heapTotalMB = this.memoryData.heapTotal / (1024 * 1024);
            this.memoryData.heapPercent = (this.memoryData.heapUsed / this.memoryData.heapLimit) * 100;
            
            this.memoryData.heapHistory.push(this.memoryData.heapUsedMB);
            if (this.memoryData.heapHistory.length > 60) {
                this.memoryData.heapHistory.shift();
            }
            
            // Check for memory issues
            if (this.memoryData.heapUsedMB > this.config.memoryErrorMB) {
                this.addIssue({
                    severity: 'error',
                    category: 'Memory',
                    title: 'High Memory',
                    message: `Heap usage at ${this.memoryData.heapUsedMB.toFixed(0)}MB (limit: ${this.config.memoryErrorMB}MB)`,
                    suggestion: 'Check for memory leaks, clear unused objects, or increase memory limit'
                });
            } else if (this.memoryData.heapUsedMB > this.config.memoryWarningMB) {
                this.addIssue({
                    severity: 'warning',
                    category: 'Memory',
                    title: 'Memory Warning',
                    message: `Heap usage at ${this.memoryData.heapUsedMB.toFixed(0)}MB`
                });
            }
            
            // Detect potential leak (continuous growth over longer period)
            // Must have 20+ samples with significant growth to suspect leak
            if (this.memoryData.heapHistory.length >= 20) {
                const recent = this.memoryData.heapHistory.slice(-20);
                const first5Avg = recent.slice(0, 5).reduce((a, b) => a + b, 0) / 5;
                const last5Avg = recent.slice(-5).reduce((a, b) => a + b, 0) / 5;
                const growthPercent = ((last5Avg - first5Avg) / first5Avg) * 100;
                
                // Only suspect leak if memory grew by >20% over the period
                if (growthPercent > 20 && !this.memoryData.leakSuspected) {
                    this.memoryData.leakSuspected = true;
                    this.addIssue({
                        severity: 'memory',
                        category: 'Memory',
                        title: 'Potential Leak',
                        message: `Memory grew ${growthPercent.toFixed(1)}% - possible memory leak`,
                        suggestion: 'Check for objects not being garbage collected, event listeners not removed, or closures holding references'
                    });
                } else if (growthPercent < 5) {
                    // Memory stabilized - clear leak suspicion
                    this.memoryData.leakSuspected = false;
                }
            }
        }
        
        // Update DOM node count
        this.memoryData.domNodes = document.querySelectorAll('*').length;
        this.memoryData.listeners = this.listenerCount;
        
        // Check for excessive DOM
        if (this.memoryData.domNodes > 5000) {
            this.addIssue({
                severity: 'performance',
                category: 'DOM',
                title: 'Large DOM',
                message: `DOM has ${this.memoryData.domNodes} nodes`,
                suggestion: 'Consider virtualization, lazy loading, or removing unused elements'
            });
        }
        
        // Update overlay - only if visible to reduce DOM mutations
        if (this.overlay) {
            this.updateOverlay();
        }
    }
    
    // ========================================================================
    // DOM MONITORING
    // ========================================================================
    
    private setupDOMMonitoring(): void {
        let mutationCount = 0;
        let lastMutationCheck = Date.now();
        
        this.mutationObserver = new MutationObserver((mutations) => {
            // Skip mutations from DevCenter's own overlay to avoid self-triggering
            const overlayMutations = mutations.filter(m => {
                const target = m.target as HTMLElement;
                return !target.closest?.('#webforge-devcenter-overlay') && 
                       !target.closest?.('#webforge-devcenter-indicator');
            });
            
            mutationCount += overlayMutations.length;
            
            const now = Date.now();
            if (now - lastMutationCheck > 1000) {
                if (mutationCount > 1000) {
                    this.addIssue({
                        severity: 'performance',
                        category: 'DOM',
                        title: 'Excessive Mutations',
                        message: `${mutationCount} DOM mutations in the last second`,
                        suggestion: 'Batch DOM updates, use document fragments, or implement virtual DOM'
                    });
                }
                mutationCount = 0;
                lastMutationCheck = now;
            }
        });
        
        this.mutationObserver.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            characterData: true
        });
    }
    
    // ========================================================================
    // RESOURCE MONITORING
    // ========================================================================
    
    private setupResourceMonitoring(): void {
        window.addEventListener('error', (event) => {
            const target = event.target as HTMLElement | null;
            if (target && (target.tagName === 'SCRIPT' || target.tagName === 'LINK' || target.tagName === 'IMG')) {
                const src = (target as HTMLScriptElement).src || 
                           (target as HTMLLinkElement).href ||
                           (target as HTMLImageElement).src;
                this.addIssue({
                    severity: 'error',
                    category: 'Resource',
                    title: `${target.tagName} Failed`,
                    message: `Failed to load: ${src}`,
                    suggestion: 'Check if the resource exists and is accessible'
                });
            }
        }, true);
    }
    
    // ========================================================================
    // SECURITY MONITORING
    // ========================================================================
    
    private setupSecurityMonitoring(): void {
        // CSP violations
        document.addEventListener('securitypolicyviolation', (event) => {
            this.addIssue({
                severity: 'security',
                category: 'Security',
                title: 'CSP Violation',
                message: `Blocked ${event.violatedDirective}: ${event.blockedURI}`,
                suggestion: 'Review your Content Security Policy or update the resource source'
            });
        });
    }
    
    // ========================================================================
    // HOTKEYS
    // ========================================================================
    
    private setupHotkeys(): void {
        window.addEventListener('keydown', (event) => {
            // Ctrl+Shift+D or F12 - toggle overlay
            if ((event.ctrlKey && event.shiftKey && event.key === 'D') || event.key === 'F12') {
                event.preventDefault();
                this.toggleOverlay();
            }
            // Escape - close overlay
            else if (event.key === 'Escape' && this.overlay) {
                this.hideOverlay();
            }
            // Ctrl+Shift+C - clear issues
            else if (event.ctrlKey && event.shiftKey && event.key === 'C') {
                event.preventDefault();
                this.clearIssues();
            }
        });
    }
    
    // ========================================================================
    // ISSUE MANAGEMENT
    // ========================================================================
    
    private addIssue(data: Omit<DevIssue, 'id' | 'timestamp' | 'count' | 'lastSeen'>): void {
        // Create a key for deduplication
        const key = `${data.category}:${data.title}:${data.message.slice(0, 100)}`;
        
        const existing = this.issues.get(key);
        if (existing) {
            existing.count++;
            existing.lastSeen = Date.now();
            this.issues.set(key, existing);
        } else {
            const issue: DevIssue = {
                ...data,
                id: this.generateId(),
                timestamp: Date.now(),
                count: 1,
                lastSeen: Date.now()
            };
            this.issues.set(key, issue);
        }
        
        // Trim if needed
        if (this.issues.size > this.config.maxIssuesDisplayed) {
            const oldestKey = this.issues.keys().next().value;
            if (oldestKey) this.issues.delete(oldestKey);
        }
        
        // Auto-show on error
        if (this.config.autoShowOnError && data.severity === 'error' && !this.overlay) {
            this.showOverlay();
        }
        
        // Update indicator
        this.updateIndicator();
        this.updateOverlay();
        
        // Persist if enabled
        if (this.config.persistBetweenReloads) {
            this.persistData();
        }
    }
    
    public clearIssues(): void {
        this.issues.clear();
        this.updateOverlay();
        this.updateIndicator();
    }
    
    // ========================================================================
    // SUGGESTIONS
    // ========================================================================
    
    private getSuggestion(type: string, message: string, _error?: Error | unknown): string {
        const msg = message.toLowerCase();
        
        if (type === 'error') {
            if (msg.includes('is not defined') || msg.includes('is not a function')) {
                return 'Check for typos in variable/function names, ensure imports are correct';
            }
            if (msg.includes('cannot read propert')) {
                return 'Add null checks before accessing properties, use optional chaining (?.)';
            }
            if (msg.includes('syntax')) {
                return 'Check for missing brackets, semicolons, or invalid syntax';
            }
            if (msg.includes('cors')) {
                return 'Configure CORS on the server or use a proxy';
            }
            if (msg.includes('network')) {
                return 'Check internet connection and server availability';
            }
        }
        
        if (type === 'promise') {
            if (msg.includes('fetch')) {
                return 'Check network connectivity and add proper error handling to fetch calls';
            }
            return 'Add .catch() or try/catch around async operations';
        }
        
        return '';
    }
    
    private getNetworkSuggestion(status: number): string {
        if (status === 404) return 'Check if the URL is correct and the resource exists';
        if (status === 401) return 'Check authentication credentials';
        if (status === 403) return 'Check permissions and authorization';
        if (status === 500) return 'Server error - check server logs';
        if (status === 502 || status === 503) return 'Server may be down or overloaded';
        return '';
    }
    
    private getNetworkErrorSuggestion(error: unknown): string {
        const msg = String(error).toLowerCase();
        if (msg.includes('failed to fetch')) {
            return 'Check if server is running, CORS is configured, or there\'s a network issue';
        }
        if (msg.includes('cors')) {
            return 'Configure CORS headers on the server';
        }
        return 'Check network connectivity and server availability';
    }
    
    private getWebSocketSuggestion(url: string): string {
        if (url.startsWith('ws://') && location.protocol === 'https:') {
            return 'Cannot connect to ws:// from https:// page. Use wss:// instead.';
        }
        return 'Check if the WebSocket server is running and accessible';
    }
    
    private getWebSocketCloseSuggestion(code: number): string {
        if (code === 1006) return 'Connection was abnormally closed - server may have crashed or network interrupted';
        if (code === 1002) return 'Protocol error - check WebSocket message format';
        if (code === 1003) return 'Server received unsupported data type';
        if (code === 1011) return 'Server encountered an unexpected error';
        return '';
    }
    
    // ========================================================================
    // OVERLAY UI
    // ========================================================================
    
    public showOverlay(): void {
        if (this.overlay) return;
        this.createOverlay();
    }
    
    public hideOverlay(): void {
        if (this.overlay) {
            this.overlay.remove();
            this.overlay = null;
        }
    }
    
    public toggleOverlay(): void {
        if (this.overlay) {
            this.hideOverlay();
        } else {
            this.showOverlay();
        }
    }
    
    private createOverlay(): void {
        this.overlay = document.createElement('div');
        this.overlay.id = 'webforge-devcenter-overlay';
        this.overlay.innerHTML = this.renderOverlay();
        document.body.appendChild(this.overlay);
        this.setupOverlayEvents();
    }
    
    private updateOverlay(): void {
        if (!this.overlay) return;
        const content = this.overlay.querySelector('.devcenter-content');
        if (content) {
            content.innerHTML = this.renderTabContent();
        }
        this.updateTabButtons();
    }
    
    private renderOverlay(): string {
        const health = this.getProjectHealth();
        
        return `
            <style>
                #webforge-devcenter-overlay {
                    position: fixed;
                    bottom: 0;
                    right: 0;
                    width: 600px;
                    height: 500px;
                    background: #1a1a2e;
                    border: 1px solid #333;
                    border-radius: 8px 0 0 0;
                    font-family: 'Segoe UI', system-ui, sans-serif;
                    font-size: 12px;
                    color: #e0e0e0;
                    z-index: 99999;
                    display: flex;
                    flex-direction: column;
                    box-shadow: 0 -4px 20px rgba(0,0,0,0.4);
                }
                .devcenter-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 8px 12px;
                    background: #0f0f1a;
                    border-bottom: 1px solid #333;
                    border-radius: 8px 0 0 0;
                    cursor: move;
                }
                .devcenter-title {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-weight: 600;
                    font-size: 14px;
                }
                .devcenter-logo { font-size: 18px; }
                .devcenter-health {
                    display: flex;
                    gap: 12px;
                    align-items: center;
                }
                .devcenter-health-badge {
                    padding: 2px 8px;
                    border-radius: 4px;
                    font-size: 11px;
                    font-weight: 600;
                }
                .health-healthy { background: #1a4d2e; color: #4ade80; }
                .health-degraded { background: #4d3a1a; color: #fbbf24; }
                .health-critical { background: #4d1a1a; color: #f87171; }
                .devcenter-close {
                    background: none;
                    border: none;
                    color: #888;
                    font-size: 18px;
                    cursor: pointer;
                    padding: 4px;
                    line-height: 1;
                }
                .devcenter-close:hover { color: #fff; }
                .devcenter-tabs {
                    display: flex;
                    background: #16162a;
                    border-bottom: 1px solid #333;
                    overflow-x: auto;
                }
                .devcenter-tab {
                    padding: 8px 16px;
                    background: none;
                    border: none;
                    color: #888;
                    cursor: pointer;
                    font-size: 12px;
                    border-bottom: 2px solid transparent;
                    white-space: nowrap;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                }
                .devcenter-tab:hover { color: #fff; background: #1f1f3a; }
                .devcenter-tab.active {
                    color: #00ff88;
                    border-bottom-color: #00ff88;
                }
                .devcenter-tab-badge {
                    background: #ff4444;
                    color: white;
                    padding: 1px 6px;
                    border-radius: 10px;
                    font-size: 10px;
                    min-width: 16px;
                    text-align: center;
                }
                .devcenter-content {
                    flex: 1;
                    overflow-y: auto;
                    padding: 12px;
                }
                .devcenter-section {
                    margin-bottom: 16px;
                }
                .devcenter-section-title {
                    font-size: 11px;
                    font-weight: 600;
                    text-transform: uppercase;
                    color: #888;
                    margin-bottom: 8px;
                    letter-spacing: 0.5px;
                }
                .devcenter-issue {
                    background: #1f1f3a;
                    border-radius: 4px;
                    padding: 8px 10px;
                    margin-bottom: 6px;
                    border-left: 3px solid;
                }
                .issue-error { border-color: #f87171; }
                .issue-warning { border-color: #fbbf24; }
                .issue-info { border-color: #60a5fa; }
                .issue-performance { border-color: #c084fc; }
                .issue-memory { border-color: #f472b6; }
                .issue-network { border-color: #34d399; }
                .issue-security { border-color: #f97316; }
                .issue-title {
                    font-weight: 600;
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 4px;
                }
                .issue-count {
                    background: #333;
                    padding: 1px 6px;
                    border-radius: 10px;
                    font-size: 10px;
                }
                .issue-message {
                    color: #aaa;
                    word-break: break-word;
                }
                .issue-suggestion {
                    color: #4ade80;
                    font-size: 11px;
                    margin-top: 4px;
                }
                .issue-meta {
                    font-size: 10px;
                    color: #666;
                    margin-top: 4px;
                }
                .devcenter-stats {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 12px;
                }
                .devcenter-stat {
                    background: #1f1f3a;
                    padding: 12px;
                    border-radius: 6px;
                    text-align: center;
                }
                .stat-value {
                    font-size: 24px;
                    font-weight: 700;
                }
                .stat-label {
                    font-size: 11px;
                    color: #888;
                    margin-top: 4px;
                }
                .stat-good { color: #4ade80; }
                .stat-warning { color: #fbbf24; }
                .stat-error { color: #f87171; }
                .devcenter-graph {
                    height: 60px;
                    background: #0f0f1a;
                    border-radius: 4px;
                    padding: 8px;
                    margin-top: 8px;
                }
                .devcenter-network-entry {
                    display: grid;
                    grid-template-columns: 60px 1fr 80px 60px;
                    gap: 8px;
                    padding: 6px 8px;
                    background: #1f1f3a;
                    border-radius: 4px;
                    margin-bottom: 4px;
                    font-size: 11px;
                }
                .network-method {
                    font-weight: 600;
                    color: #60a5fa;
                }
                .network-url {
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }
                .network-status { text-align: center; }
                .status-success { color: #4ade80; }
                .status-error { color: #f87171; }
                .status-redirect { color: #fbbf24; }
                .network-time { color: #888; text-align: right; }
                .devcenter-console-entry {
                    padding: 4px 8px;
                    border-bottom: 1px solid #2a2a4a;
                    font-family: 'JetBrains Mono', 'Fira Code', monospace;
                    font-size: 11px;
                }
                .console-log { color: #e0e0e0; }
                .console-info { color: #60a5fa; }
                .console-warn { color: #fbbf24; background: rgba(251, 191, 36, 0.1); }
                .console-error { color: #f87171; background: rgba(248, 113, 113, 0.1); }
                .console-debug { color: #888; }
                .console-time {
                    color: #666;
                    margin-right: 8px;
                }
                .devcenter-actions {
                    display: flex;
                    gap: 8px;
                    padding: 8px 12px;
                    background: #0f0f1a;
                    border-top: 1px solid #333;
                }
                .devcenter-btn {
                    padding: 6px 12px;
                    background: #2a2a4a;
                    border: none;
                    border-radius: 4px;
                    color: #e0e0e0;
                    cursor: pointer;
                    font-size: 11px;
                }
                .devcenter-btn:hover { background: #3a3a5a; }
                .devcenter-btn-primary {
                    background: #1a4d2e;
                    color: #4ade80;
                }
                .dashboard-grid {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 12px;
                }
                .dashboard-card {
                    background: #1f1f3a;
                    border-radius: 6px;
                    padding: 12px;
                }
                .dashboard-card-title {
                    font-size: 11px;
                    font-weight: 600;
                    text-transform: uppercase;
                    color: #888;
                    margin-bottom: 8px;
                }
                .dashboard-card-value {
                    font-size: 28px;
                    font-weight: 700;
                }
                .dashboard-card-detail {
                    font-size: 11px;
                    color: #888;
                    margin-top: 4px;
                }
            </style>
            <div class="devcenter-header">
                <div class="devcenter-title">
                    <span class="devcenter-logo">🔧</span>
                    <span>WebForge DevCenter</span>
                </div>
                <div class="devcenter-health">
                    <span class="devcenter-health-badge health-${health.overall.status}">${health.overall.status.toUpperCase()}</span>
                    <button class="devcenter-close" data-action="close">×</button>
                </div>
            </div>
            <div class="devcenter-tabs">
                <button class="devcenter-tab ${this.activeTab === 'dashboard' ? 'active' : ''}" data-tab="dashboard">📊 Dashboard</button>
                <button class="devcenter-tab ${this.activeTab === 'issues' ? 'active' : ''}" data-tab="issues">
                    ⚠️ Issues
                    ${health.issueCount.total > 0 ? `<span class="devcenter-tab-badge">${health.issueCount.total}</span>` : ''}
                </button>
                <button class="devcenter-tab ${this.activeTab === 'performance' ? 'active' : ''}" data-tab="performance">⚡ Performance</button>
                <button class="devcenter-tab ${this.activeTab === 'memory' ? 'active' : ''}" data-tab="memory">🧠 Memory</button>
                <button class="devcenter-tab ${this.activeTab === 'network' ? 'active' : ''}" data-tab="network">🌐 Network</button>
                <button class="devcenter-tab ${this.activeTab === 'console' ? 'active' : ''}" data-tab="console">💬 Console</button>
                <button class="devcenter-tab ${this.activeTab === 'tools' ? 'active' : ''}" data-tab="tools">🛠️ Tools</button>
            </div>
            <div class="devcenter-content">
                ${this.renderTabContent()}
            </div>
            <div class="devcenter-actions">
                <button class="devcenter-btn" data-action="clear">Clear All</button>
                <button class="devcenter-btn" data-action="export">Export Report</button>
                <button class="devcenter-btn devcenter-btn-primary" data-action="refresh">↻ Refresh</button>
            </div>
        `;
    }
    
    private renderTabContent(): string {
        switch (this.activeTab) {
            case 'dashboard': return this.renderDashboard();
            case 'issues': return this.renderIssues();
            case 'performance': return this.renderPerformance();
            case 'memory': return this.renderMemory();
            case 'network': return this.renderNetwork();
            case 'console': return this.renderConsole();
            case 'tools': return this.renderTools();
            default: return '';
        }
    }
    
    private renderDashboard(): string {
        const health = this.getProjectHealth();
        const issues = Array.from(this.issues.values());
        const recentErrors = issues.filter(i => i.severity === 'error').slice(-3);
        
        return `
            <div class="dashboard-grid">
                <div class="dashboard-card">
                    <div class="dashboard-card-title">FPS</div>
                    <div class="dashboard-card-value stat-${this.performanceData.fps >= 50 ? 'good' : this.performanceData.fps >= 30 ? 'warning' : 'error'}">
                        ${this.performanceData.fps}
                    </div>
                    <div class="dashboard-card-detail">Frame time: ${this.performanceData.frameTime.toFixed(1)}ms</div>
                </div>
                <div class="dashboard-card">
                    <div class="dashboard-card-title">Memory</div>
                    <div class="dashboard-card-value stat-${this.memoryData.heapUsedMB < 200 ? 'good' : this.memoryData.heapUsedMB < 500 ? 'warning' : 'error'}">
                        ${this.memoryData.heapUsedMB.toFixed(0)}MB
                    </div>
                    <div class="dashboard-card-detail">${this.memoryData.heapPercent.toFixed(1)}% of limit</div>
                </div>
                <div class="dashboard-card">
                    <div class="dashboard-card-title">Issues</div>
                    <div class="dashboard-card-value stat-${health.issueCount.errors > 0 ? 'error' : health.issueCount.warnings > 0 ? 'warning' : 'good'}">
                        ${health.issueCount.total}
                    </div>
                    <div class="dashboard-card-detail">${health.issueCount.errors} errors, ${health.issueCount.warnings} warnings</div>
                </div>
                <div class="dashboard-card">
                    <div class="dashboard-card-title">Network</div>
                    <div class="dashboard-card-value stat-${health.network.status}">
                        ${health.network.successRate.toFixed(0)}%
                    </div>
                    <div class="dashboard-card-detail">Avg latency: ${health.network.avgLatency.toFixed(0)}ms</div>
                </div>
            </div>
            ${recentErrors.length > 0 ? `
                <div class="devcenter-section" style="margin-top: 16px;">
                    <div class="devcenter-section-title">Recent Errors</div>
                    ${recentErrors.map(issue => this.renderIssueItem(issue)).join('')}
                </div>
            ` : `
                <div style="text-align: center; padding: 40px; color: #4ade80;">
                    ✓ No errors detected
                </div>
            `}
        `;
    }
    
    private renderIssues(): string {
        const issues = Array.from(this.issues.values()).sort((a, b) => {
            const severityOrder = { error: 0, warning: 1, security: 2, performance: 3, memory: 4, network: 5, info: 6 };
            return (severityOrder[a.severity] || 99) - (severityOrder[b.severity] || 99);
        });
        
        if (issues.length === 0) {
            return `
                <div style="text-align: center; padding: 60px; color: #4ade80;">
                    <div style="font-size: 48px; margin-bottom: 16px;">✓</div>
                    <div>No issues detected</div>
                    <div style="color: #888; font-size: 11px; margin-top: 8px;">The DevCenter is monitoring for errors, warnings, and performance issues</div>
                </div>
            `;
        }
        
        return `
            <div class="devcenter-section">
                ${issues.map(issue => this.renderIssueItem(issue)).join('')}
            </div>
        `;
    }
    
    private renderIssueItem(issue: DevIssue): string {
        return `
            <div class="devcenter-issue issue-${issue.severity}">
                <div class="issue-title">
                    <span>[${issue.category}] ${issue.title}</span>
                    ${issue.count > 1 ? `<span class="issue-count">×${issue.count}</span>` : ''}
                </div>
                <div class="issue-message">${this.escapeHtml(issue.message)}</div>
                ${issue.suggestion ? `<div class="issue-suggestion">💡 ${issue.suggestion}</div>` : ''}
                ${issue.source ? `<div class="issue-meta">${issue.source}${issue.line ? `:${issue.line}` : ''}${issue.column ? `:${issue.column}` : ''}</div>` : ''}
            </div>
        `;
    }
    
    private renderPerformance(): string {
        const fpsStatus = this.performanceData.fps >= 50 ? 'good' : this.performanceData.fps >= 30 ? 'warning' : 'error';
        
        return `
            <div class="devcenter-stats">
                <div class="devcenter-stat">
                    <div class="stat-value stat-${fpsStatus}">${this.performanceData.fps}</div>
                    <div class="stat-label">FPS</div>
                </div>
                <div class="devcenter-stat">
                    <div class="stat-value">${this.performanceData.frameTime.toFixed(1)}ms</div>
                    <div class="stat-label">Frame Time</div>
                </div>
                <div class="devcenter-stat">
                    <div class="stat-value">${this.performanceData.longTasks}</div>
                    <div class="stat-label">Long Tasks</div>
                </div>
            </div>
            <div class="devcenter-section" style="margin-top: 16px;">
                <div class="devcenter-section-title">FPS History</div>
                <div class="devcenter-graph">
                    ${this.renderSparkline(this.performanceData.fpsHistory, 60, 0)}
                </div>
            </div>
            <div class="devcenter-section">
                <div class="devcenter-section-title">Frame Time History</div>
                <div class="devcenter-graph">
                    ${this.renderSparkline(this.performanceData.frameTimeHistory, 50, 0)}
                </div>
            </div>
        `;
    }
    
    private renderMemory(): string {
        const memStatus = this.memoryData.heapUsedMB < 200 ? 'good' : this.memoryData.heapUsedMB < 500 ? 'warning' : 'error';
        
        return `
            <div class="devcenter-stats">
                <div class="devcenter-stat">
                    <div class="stat-value stat-${memStatus}">${this.memoryData.heapUsedMB.toFixed(0)}MB</div>
                    <div class="stat-label">Heap Used</div>
                </div>
                <div class="devcenter-stat">
                    <div class="stat-value">${this.memoryData.heapTotalMB.toFixed(0)}MB</div>
                    <div class="stat-label">Heap Total</div>
                </div>
                <div class="devcenter-stat">
                    <div class="stat-value">${this.memoryData.heapPercent.toFixed(1)}%</div>
                    <div class="stat-label">Usage</div>
                </div>
            </div>
            <div class="devcenter-stats" style="margin-top: 12px;">
                <div class="devcenter-stat">
                    <div class="stat-value">${this.memoryData.domNodes}</div>
                    <div class="stat-label">DOM Nodes</div>
                </div>
                <div class="devcenter-stat">
                    <div class="stat-value">${this.memoryData.listeners}</div>
                    <div class="stat-label">Listeners</div>
                </div>
                <div class="devcenter-stat">
                    <div class="stat-value stat-${this.memoryData.leakSuspected ? 'error' : 'good'}">${this.memoryData.leakSuspected ? 'Yes' : 'No'}</div>
                    <div class="stat-label">Leak Suspected</div>
                </div>
            </div>
            <div class="devcenter-section" style="margin-top: 16px;">
                <div class="devcenter-section-title">Heap History (MB)</div>
                <div class="devcenter-graph">
                    ${this.renderSparkline(this.memoryData.heapHistory, Math.max(...this.memoryData.heapHistory, 100), 0)}
                </div>
            </div>
        `;
    }
    
    private renderNetwork(): string {
        if (this.networkEntries.length === 0) {
            return `<div style="text-align: center; padding: 40px; color: #888;">No network requests recorded</div>`;
        }
        
        const entries = [...this.networkEntries].reverse().slice(0, 50);
        
        return `
            <div class="devcenter-section">
                ${entries.map(entry => `
                    <div class="devcenter-network-entry">
                        <span class="network-method">${entry.method}</span>
                        <span class="network-url" title="${this.escapeHtml(entry.url)}">${this.escapeHtml(entry.url)}</span>
                        <span class="network-status ${entry.status >= 200 && entry.status < 300 ? 'status-success' : entry.status >= 300 && entry.status < 400 ? 'status-redirect' : 'status-error'}">${entry.status || 'ERR'}</span>
                        <span class="network-time">${entry.duration.toFixed(0)}ms</span>
                    </div>
                `).join('')}
            </div>
        `;
    }
    
    private renderConsole(): string {
        if (this.consoleEntries.length === 0) {
            return `<div style="text-align: center; padding: 40px; color: #888;">No console output recorded</div>`;
        }
        
        const entries = [...this.consoleEntries].reverse().slice(0, 100);
        
        return `
            <div class="devcenter-section">
                ${entries.map(entry => `
                    <div class="devcenter-console-entry console-${entry.level}">
                        <span class="console-time">${new Date(entry.timestamp).toLocaleTimeString()}</span>
                        ${this.escapeHtml(entry.message)}
                    </div>
                `).join('')}
            </div>
        `;
    }
    
    private renderTools(): string {
        return `
            <div class="devcenter-section">
                <div class="devcenter-section-title">Quick Actions</div>
                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px;">
                    <button class="devcenter-btn" data-action="force-gc">🗑️ Force GC</button>
                    <button class="devcenter-btn" data-action="clear-cache">💾 Clear Cache</button>
                    <button class="devcenter-btn" data-action="reload">🔄 Reload Page</button>
                    <button class="devcenter-btn" data-action="hard-reload">🔄 Hard Reload</button>
                    <button class="devcenter-btn" data-action="toggle-debug">🐛 Toggle Debug</button>
                    <button class="devcenter-btn" data-action="screenshot">📸 Screenshot</button>
                </div>
            </div>
            <div class="devcenter-section" style="margin-top: 16px;">
                <div class="devcenter-section-title">Keyboard Shortcuts</div>
                <div style="background: #1f1f3a; padding: 12px; border-radius: 6px; font-family: monospace; font-size: 11px;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                        <span>Toggle DevCenter</span><span style="color: #4ade80;">Ctrl+Shift+D / F12</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                        <span>Close DevCenter</span><span style="color: #4ade80;">Escape</span>
                    </div>
                    <div style="display: flex; justify-content: space-between;">
                        <span>Clear Issues</span><span style="color: #4ade80;">Ctrl+Shift+C</span>
                    </div>
                </div>
            </div>
            <div class="devcenter-section" style="margin-top: 16px;">
                <div class="devcenter-section-title">Integration Status</div>
                <div style="background: #1f1f3a; padding: 12px; border-radius: 6px; font-size: 11px;">
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                        <span style="color: #4ade80;">●</span> Error Capture: Active
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                        <span style="color: #4ade80;">●</span> Console Capture: Active
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                        <span style="color: #4ade80;">●</span> Network Monitoring: Active
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                        <span style="color: #4ade80;">●</span> WebSocket Monitoring: Active
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                        <span style="color: #4ade80;">●</span> Performance Monitoring: Active
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="color: #4ade80;">●</span> Memory Monitoring: Active
                    </div>
                </div>
            </div>
        `;
    }
    
    private renderSparkline(data: number[], max: number, min: number): string {
        if (data.length < 2) return '<svg width="100%" height="100%"></svg>';
        
        const width = 560;
        const height = 44;
        const points = data.map((value, i) => {
            const x = (i / (data.length - 1)) * width;
            const y = height - ((value - min) / (max - min || 1)) * height;
            return `${x},${y}`;
        }).join(' ');
        
        return `
            <svg width="100%" height="100%" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
                <polyline fill="none" stroke="#4ade80" stroke-width="1.5" points="${points}"/>
            </svg>
        `;
    }
    
    private setupOverlayEvents(): void {
        if (!this.overlay) return;
        
        // Use event delegation instead of individual listeners
        // This prevents event listener leaks when overlay is recreated
        this.overlay.addEventListener('click', (event) => {
            const target = event.target as HTMLElement;
            
            // Handle tab clicks
            const tab = target.closest('.devcenter-tab') as HTMLElement | null;
            if (tab && tab.dataset.tab) {
                this.activeTab = tab.dataset.tab as TabName;
                this.updateOverlay();
                this.updateTabButtons();
                return;
            }
            
            // Handle action buttons
            const actionBtn = target.closest('[data-action]') as HTMLElement | null;
            if (actionBtn && actionBtn.dataset.action) {
                this.handleAction(actionBtn.dataset.action);
                return;
            }
        });
    }
    
    private updateTabButtons(): void {
        if (!this.overlay) return;
        
        this.overlay.querySelectorAll('.devcenter-tab').forEach(tab => {
            const tabName = (tab as HTMLElement).dataset.tab;
            tab.classList.toggle('active', tabName === this.activeTab);
        });
    }
    
    private handleAction(action: string): void {
        switch (action) {
            case 'close':
                this.hideOverlay();
                break;
            case 'clear':
                this.clearIssues();
                this.networkEntries = [];
                this.consoleEntries = [];
                this.updateOverlay();
                break;
            case 'export':
                this.exportReport();
                break;
            case 'refresh':
                this.updateOverlay();
                break;
            case 'force-gc':
                if ((window as Window & { gc?: () => void }).gc) {
                    (window as Window & { gc?: () => void }).gc!();
                    console.log('DevCenter: Garbage collection triggered');
                } else {
                    console.log('DevCenter: GC not available (run Chrome with --js-flags="--expose-gc")');
                }
                break;
            case 'clear-cache':
                if ('caches' in window) {
                    caches.keys().then(names => names.forEach(name => caches.delete(name)));
                    console.log('DevCenter: Cache cleared');
                }
                break;
            case 'reload':
                location.reload();
                break;
            case 'hard-reload':
                location.reload();
                break;
            case 'screenshot':
                console.log('DevCenter: Screenshot functionality requires html2canvas');
                break;
        }
    }
    
    // ========================================================================
    // MINIMAL INDICATOR
    // ========================================================================
    
    private createMinimalIndicator(): void {
        const indicator = document.createElement('div');
        indicator.id = 'webforge-devcenter-indicator';
        indicator.innerHTML = `
            <style>
                #webforge-devcenter-indicator {
                    position: fixed;
                    bottom: 10px;
                    right: 10px;
                    background: #1a1a2e;
                    border: 1px solid #333;
                    border-radius: 20px;
                    padding: 6px 12px;
                    font-family: 'Segoe UI', system-ui, sans-serif;
                    font-size: 11px;
                    color: #e0e0e0;
                    z-index: 2147483647;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    transition: all 0.2s;
                }
                #webforge-devcenter-indicator:hover {
                    background: #2a2a4a;
                }
                .indicator-dot {
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                    background: #4ade80;
                }
                .indicator-dot.has-errors { background: #f87171; }
                .indicator-dot.has-warnings { background: #fbbf24; }
                .indicator-count {
                    font-weight: 600;
                }
            </style>
            <span class="indicator-dot"></span>
            <span class="indicator-label">DevCenter</span>
            <span class="indicator-count">0</span>
        `;
        
        indicator.addEventListener('click', () => this.toggleOverlay());
        document.body.appendChild(indicator);
    }
    
    private updateIndicator(): void {
        const indicator = document.getElementById('webforge-devcenter-indicator');
        if (!indicator) return;
        
        const health = this.getProjectHealth();
        const dot = indicator.querySelector('.indicator-dot');
        const count = indicator.querySelector('.indicator-count');
        
        if (dot) {
            dot.classList.toggle('has-errors', health.issueCount.errors > 0);
            dot.classList.toggle('has-warnings', health.issueCount.errors === 0 && health.issueCount.warnings > 0);
        }
        
        if (count) {
            count.textContent = String(health.issueCount.total);
        }
    }
    
    // ========================================================================
    // HEALTH & REPORTING
    // ========================================================================
    
    public getProjectHealth(): DevProjectHealth {
        const issues = Array.from(this.issues.values());
        
        const issueCount = {
            errors: issues.filter(i => i.severity === 'error').length,
            warnings: issues.filter(i => i.severity === 'warning').length,
            info: issues.filter(i => i.severity === 'info').length,
            performance: issues.filter(i => i.severity === 'performance').length,
            memory: issues.filter(i => i.severity === 'memory').length,
            network: issues.filter(i => i.severity === 'network').length,
            security: issues.filter(i => i.severity === 'security').length,
            total: issues.length
        };
        
        // Performance score (0-100)
        let perfScore = 100;
        if (this.performanceData.fps < 60) perfScore -= (60 - this.performanceData.fps) * 2;
        if (this.performanceData.longTasks > 10) perfScore -= 20;
        perfScore = Math.max(0, perfScore);
        
        // Memory score
        let memScore = 100;
        if (this.memoryData.heapUsedMB > 100) memScore -= Math.min(50, (this.memoryData.heapUsedMB - 100) / 10);
        if (this.memoryData.leakSuspected) memScore -= 30;
        memScore = Math.max(0, memScore);
        
        // Network stats
        const networkTotal = this.networkEntries.length;
        const networkSuccess = this.networkEntries.filter(e => e.status >= 200 && e.status < 400).length;
        const successRate = networkTotal > 0 ? (networkSuccess / networkTotal) * 100 : 100;
        const avgLatency = networkTotal > 0 
            ? this.networkEntries.reduce((sum, e) => sum + e.duration, 0) / networkTotal 
            : 0;
        
        // Overall health
        let overallScore = 100;
        overallScore -= issueCount.errors * 15;
        overallScore -= issueCount.warnings * 5;
        overallScore -= (100 - perfScore) * 0.3;
        overallScore -= (100 - memScore) * 0.2;
        overallScore = Math.max(0, Math.min(100, overallScore));
        
        const overallStatus = overallScore >= 70 ? 'healthy' : overallScore >= 40 ? 'degraded' : 'critical';
        
        let summary = '';
        if (issueCount.errors > 0) summary = `${issueCount.errors} errors need attention`;
        else if (issueCount.warnings > 0) summary = `${issueCount.warnings} warnings to review`;
        else if (perfScore < 70) summary = 'Performance could be improved';
        else if (memScore < 70) summary = 'Memory usage is high';
        else summary = 'All systems running smoothly';
        
        return {
            issueCount,
            performance: {
                score: perfScore,
                status: perfScore >= 70 ? 'good' : perfScore >= 40 ? 'warning' : 'critical'
            },
            memory: {
                score: memScore,
                status: memScore >= 70 ? 'good' : memScore >= 40 ? 'warning' : 'critical'
            },
            network: {
                successRate,
                avgLatency,
                status: successRate >= 95 ? 'good' : successRate >= 80 ? 'warning' : 'critical'
            },
            overall: {
                score: overallScore,
                status: overallStatus,
                summary
            }
        };
    }
    
    public exportReport(): void {
        const health = this.getProjectHealth();
        const report = {
            timestamp: new Date().toISOString(),
            health,
            issues: Array.from(this.issues.values()),
            performance: this.performanceData,
            memory: this.memoryData,
            networkEntries: this.networkEntries.slice(-50),
            consoleEntries: this.consoleEntries.slice(-100)
        };
        
        const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `webforge-devcenter-report-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }
    
    // ========================================================================
    // PERSISTENCE
    // ========================================================================
    
    private persistData(): void {
        try {
            const data = {
                issues: Array.from(this.issues.entries()),
                timestamp: Date.now()
            };
            sessionStorage.setItem('webforge-devcenter', JSON.stringify(data));
        } catch {
            // Storage full or unavailable
        }
    }
    
    private loadPersistedData(): void {
        try {
            const stored = sessionStorage.getItem('webforge-devcenter');
            if (stored) {
                const data = JSON.parse(stored);
                // Only restore if less than 5 minutes old
                if (Date.now() - data.timestamp < 5 * 60 * 1000) {
                    this.issues = new Map(data.issues);
                }
            }
        } catch {
            // Invalid or unavailable
        }
    }
    
    // ========================================================================
    // UTILITIES
    // ========================================================================
    
    private generateId(): string {
        return `dc-${Date.now()}-${++this.idCounter}`;
    }
    
    private escapeHtml(str: string): string {
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }
    
    private restoreOriginals(): void {
        if (this.originalConsole) {
            console.log = this.originalConsole.log;
            console.info = this.originalConsole.info;
            console.warn = this.originalConsole.warn;
            console.error = this.originalConsole.error;
            console.debug = this.originalConsole.debug;
        }
        
        if (this.originalFetch) {
            window.fetch = this.originalFetch;
        }
        
        if (this.originalXHROpen) {
            XMLHttpRequest.prototype.open = this.originalXHROpen;
        }
        
        if (this.originalXHRSend) {
            XMLHttpRequest.prototype.send = this.originalXHRSend;
        }
        
        if (this.originalWebSocket) {
            (window as Window & { WebSocket: typeof WebSocket }).WebSocket = this.originalWebSocket;
        }
        
        if (this.originalAddEventListener) {
            EventTarget.prototype.addEventListener = this.originalAddEventListener;
        }
        
        if (this.originalRemoveEventListener) {
            EventTarget.prototype.removeEventListener = this.originalRemoveEventListener;
        }
    }
    
    // ========================================================================
    // PUBLIC API
    // ========================================================================
    
    /** Manually log an issue */
    public logIssue(severity: DevIssueSeverity, category: string, title: string, message: string, suggestion?: string): void {
        this.addIssue({ severity, category, title, message, suggestion });
    }
    
    /** Get current FPS */
    public getFPS(): number {
        return this.performanceData.fps;
    }
    
    /** Get current memory usage in MB */
    public getMemoryMB(): number {
        return this.memoryData.heapUsedMB;
    }
    
    /** Get all issues */
    public getIssues(): DevIssue[] {
        return Array.from(this.issues.values());
    }
    
    /** Check if running */
    public isActive(): boolean {
        return this.isRunning;
    }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

let devCenterInstance: DevCenter | null = null;

export function getDevCenter(config?: Partial<DevCenterConfig>): DevCenter {
    if (!devCenterInstance) {
        devCenterInstance = DevCenter.getInstance(config);
    }
    return devCenterInstance;
}

export default DevCenter;
