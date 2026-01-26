/**
 * @fileoverview WebForge Live Debugger - Production-Grade Development Assistant
 * @module debug
 * 
 * Massively enhanced debugging system that automatically catches EVERYTHING:
 * - Runtime errors, syntax errors, type errors
 * - Console warnings and deprecation notices
 * - Performance bottlenecks and frame drops
 * - Memory leaks and DOM bloat
 * - WebSocket/Network failures
 * - WebGL context issues
 * - Module import failures
 * - Event listener leaks
 * - Promise rejection chains
 * - Mutation observer issues
 * - Animation frame timing
 * - Resource loading failures
 * - CORS violations
 * - Security policy violations
 * 
 * Runs passively during development, watching everything and reporting issues
 * in real-time so you can focus on coding.
 * 
 * @author WebForge Team
 * @license MIT
 */

// ============================================================================
// TYPES
// ============================================================================

export type IssueSeverity = 'critical' | 'error' | 'warning' | 'info' | 'debug';
export type IssueCategory = 
    | 'runtime' | 'syntax' | 'type' | 'network' | 'websocket'
    | 'webgl' | 'memory' | 'performance' | 'security' | 'resource'
    | 'deprecation' | 'dom' | 'event' | 'promise' | 'module' | 'animation';

export interface CapturedIssue {
    id: string;
    timestamp: number;
    severity: IssueSeverity;
    category: IssueCategory;
    title: string;
    message: string;
    details?: string;
    stack?: string;
    source?: {
        file?: string;
        line?: number;
        column?: number;
        function?: string;
    };
    context?: Record<string, any>;
    count: number;
    firstSeen: number;
    lastSeen: number;
    resolved: boolean;
    suggestions?: string[];
}

export interface PerformanceAlert {
    type: 'fps_drop' | 'long_task' | 'layout_thrash' | 'memory_spike' | 'gc_pause';
    value: number;
    threshold: number;
    timestamp: number;
    details?: string;
}

export interface ResourceIssue {
    url: string;
    type: 'script' | 'style' | 'image' | 'font' | 'fetch' | 'xhr' | 'websocket' | 'other';
    error: string;
    status?: number;
    timestamp: number;
}

export interface LiveDebuggerConfig {
    enabled: boolean;
    
    // What to watch
    watchErrors: boolean;
    watchWarnings: boolean;
    watchNetwork: boolean;
    watchWebSocket: boolean;
    watchPerformance: boolean;
    watchMemory: boolean;
    watchDOM: boolean;
    watchEvents: boolean;
    watchResources: boolean;
    watchWebGL: boolean;
    watchSecurity: boolean;
    watchModules: boolean;
    
    // Thresholds
    fpsWarningThreshold: number;
    fpsErrorThreshold: number;
    longTaskThreshold: number;
    memoryWarningMB: number;
    memoryErrorMB: number;
    domNodeWarning: number;
    eventListenerWarning: number;
    networkTimeoutWarning: number;
    
    // Behavior
    autoShowOnError: boolean;
    captureConsole: boolean;
    captureStackTraces: boolean;
    groupSimilarIssues: boolean;
    maxIssueHistory: number;
    pauseOnCritical: boolean;
    
    // UI
    showNotifications: boolean;
    notificationDuration: number;
    overlayPosition: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}

// ============================================================================
// DEFAULT CONFIG
// ============================================================================

const DEFAULT_CONFIG: LiveDebuggerConfig = {
    enabled: true,
    
    watchErrors: true,
    watchWarnings: true,
    watchNetwork: true,
    watchWebSocket: true,
    watchPerformance: true,
    watchMemory: true,
    watchDOM: true,
    watchEvents: true,
    watchResources: true,
    watchWebGL: true,
    watchSecurity: true,
    watchModules: true,
    
    fpsWarningThreshold: 45,
    fpsErrorThreshold: 25,
    longTaskThreshold: 50,
    memoryWarningMB: 500,
    memoryErrorMB: 1000,
    domNodeWarning: 5000,
    eventListenerWarning: 500,
    networkTimeoutWarning: 5000,
    
    autoShowOnError: true,
    captureConsole: true,
    captureStackTraces: true,
    groupSimilarIssues: true,
    maxIssueHistory: 2000,
    pauseOnCritical: false,
    
    showNotifications: true,
    notificationDuration: 5000,
    overlayPosition: 'top-right'
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

let issueCounter = 0;

function generateIssueId(): string {
    return `issue_${Date.now()}_${++issueCounter}`;
}

function getStackTrace(): string {
    const err = new Error();
    const stack = err.stack || '';
    // Remove the first 2-3 lines (Error and this function)
    return stack.split('\n').slice(3).join('\n');
}

// Stack parsing utility - exported for use by DevTools integration
export function parseStackLine(line: string): { file?: string; line?: number; column?: number; function?: string } {
    // Parse "at functionName (file:line:column)" or "at file:line:column"
    const match = line.match(/at\s+(?:(.+?)\s+\()?(.+?):(\d+):(\d+)\)?/);
    if (match) {
        return {
            function: match[1] || undefined,
            file: match[2],
            line: parseInt(match[3], 10),
            column: parseInt(match[4], 10)
        };
    }
    return {};
}

function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function formatTime(ms: number): string {
    if (ms < 1) return `${(ms * 1000).toFixed(0)}μs`;
    if (ms < 1000) return `${ms.toFixed(1)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
}

// ============================================================================
// LIVE DEBUGGER CLASS
// ============================================================================

export class LiveDebugger {
    private static instance: LiveDebugger | null = null;
    
    private config: LiveDebuggerConfig;
    private issues: Map<string, CapturedIssue> = new Map();
    private performanceAlerts: PerformanceAlert[] = [];
    private resourceIssues: ResourceIssue[] = [];
    private listeners: Set<(issue: CapturedIssue) => void> = new Set();
    
    private initialized = false;
    private overlay: HTMLElement | null = null;
    
    // Monitoring state
    private fpsHistory: number[] = [];
    private memoryHistory: number[] = [];
    private eventListenerCount = 0;
    private rafId: number | null = null;
    private memoryCheckInterval: number | null = null;
    private domObserver: MutationObserver | null = null;
    
    // Original functions (for restoration)
    private originalConsoleError: typeof console.error | null = null;
    private originalConsoleWarn: typeof console.warn | null = null;
    private originalFetch: typeof fetch | null = null;
    private originalXHROpen: typeof XMLHttpRequest.prototype.open | null = null;
    private originalXHRSend: typeof XMLHttpRequest.prototype.send | null = null;
    private originalWebSocket: typeof WebSocket | null = null;
    private originalAddEventListener: typeof EventTarget.prototype.addEventListener | null = null;
    private originalRemoveEventListener: typeof EventTarget.prototype.removeEventListener | null = null;
    
    // WebSocket tracking
    private activeWebSockets: Map<WebSocket, { url: string; openTime: number }> = new Map();
    
    // Event listener tracking
    private eventListenerRegistry: Map<EventTarget, Map<string, number>> = new Map();
    
    private constructor(config: Partial<LiveDebuggerConfig> = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }
    
    static getInstance(config?: Partial<LiveDebuggerConfig>): LiveDebugger {
        if (!LiveDebugger.instance) {
            LiveDebugger.instance = new LiveDebugger(config);
        } else if (config) {
            LiveDebugger.instance.config = { ...LiveDebugger.instance.config, ...config };
        }
        return LiveDebugger.instance;
    }
    
    // ========================================================================
    // INITIALIZATION
    // ========================================================================
    
    initialize(): void {
        if (this.initialized || !this.config.enabled) return;
        
        console.log('%c🔍 WebForge Live Debugger Active', 'color: #4ade80; font-weight: bold; font-size: 14px;');
        console.log('%cAutomatically watching for errors, performance issues, and more...', 'color: #888; font-size: 11px;');
        console.log('%cPress F12 or Ctrl+Shift+D to toggle debugger panel', 'color: #888; font-size: 11px;');
        
        // Install all watchers
        if (this.config.watchErrors) this.installErrorWatchers();
        if (this.config.captureConsole) this.installConsoleCapture();
        if (this.config.watchNetwork) this.installNetworkWatcher();
        if (this.config.watchWebSocket) this.installWebSocketWatcher();
        if (this.config.watchPerformance) this.installPerformanceWatcher();
        if (this.config.watchMemory) this.installMemoryWatcher();
        if (this.config.watchDOM) this.installDOMWatcher();
        if (this.config.watchEvents) this.installEventWatcher();
        if (this.config.watchResources) this.installResourceWatcher();
        if (this.config.watchSecurity) this.installSecurityWatcher();
        if (this.config.watchModules) this.installModuleWatcher();
        
        // Install keyboard shortcuts
        this.installKeyboardShortcuts();
        
        // Create overlay (hidden initially)
        this.createOverlay();
        
        // Expose to window for debugging
        (window as any).liveDebugger = this;
        
        this.initialized = true;
    }
    
    destroy(): void {
        // Stop all monitoring
        if (this.rafId !== null) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }
        
        if (this.memoryCheckInterval !== null) {
            clearInterval(this.memoryCheckInterval);
            this.memoryCheckInterval = null;
        }
        
        if (this.domObserver) {
            this.domObserver.disconnect();
            this.domObserver = null;
        }
        
        // Restore original functions
        if (this.originalConsoleError) console.error = this.originalConsoleError;
        if (this.originalConsoleWarn) console.warn = this.originalConsoleWarn;
        if (this.originalFetch) window.fetch = this.originalFetch;
        if (this.originalWebSocket) (window as any).WebSocket = this.originalWebSocket;
        if (this.originalAddEventListener) EventTarget.prototype.addEventListener = this.originalAddEventListener;
        if (this.originalRemoveEventListener) EventTarget.prototype.removeEventListener = this.originalRemoveEventListener;
        
        // Remove overlay
        this.overlay?.remove();
        this.overlay = null;
        
        this.initialized = false;
        LiveDebugger.instance = null;
    }
    
    // ========================================================================
    // ERROR WATCHERS
    // ========================================================================
    
    private installErrorWatchers(): void {
        // Global error handler
        window.addEventListener('error', (event) => {
            this.captureIssue({
                severity: 'error',
                category: event.error instanceof SyntaxError ? 'syntax' : 
                         event.error instanceof TypeError ? 'type' : 'runtime',
                title: event.error?.name || 'Error',
                message: event.message || 'Unknown error',
                stack: event.error?.stack,
                source: {
                    file: event.filename,
                    line: event.lineno,
                    column: event.colno
                },
                suggestions: this.getSuggestionsForError(event.error, event.message)
            });
        });
        
        // Unhandled promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            const error = event.reason;
            this.captureIssue({
                severity: 'error',
                category: 'promise',
                title: 'Unhandled Promise Rejection',
                message: error?.message || String(error) || 'Promise rejected without reason',
                stack: error?.stack,
                suggestions: [
                    'Add .catch() handler to the promise',
                    'Use try/catch with async/await',
                    'Check if the promise source is returning expected values'
                ]
            });
        });
        
        // Script errors (CORS issues often show as "Script error")
        window.addEventListener('error', (event) => {
            if (event.message === 'Script error.' && !event.filename) {
                this.captureIssue({
                    severity: 'warning',
                    category: 'security',
                    title: 'Cross-Origin Script Error',
                    message: 'A script from a different origin caused an error. Details hidden due to CORS.',
                    suggestions: [
                        'Add crossorigin="anonymous" attribute to script tags',
                        'Configure CORS headers on the script server',
                        'Host scripts on the same origin'
                    ]
                });
            }
        }, true);
    }
    
    private getSuggestionsForError(error: Error | null, message: string): string[] {
        const suggestions: string[] = [];
        const msg = (message || '').toLowerCase();
        const name = error?.name?.toLowerCase() || '';
        
        // TypeError suggestions
        if (name === 'typeerror' || msg.includes('undefined') || msg.includes('null')) {
            if (msg.includes('cannot read') || msg.includes("reading '")) {
                suggestions.push('Check if the object exists before accessing its properties');
                suggestions.push('Use optional chaining (?.) to safely access nested properties');
                suggestions.push('Verify the data is loaded before using it');
            }
            if (msg.includes('is not a function')) {
                suggestions.push('Check if the method name is spelled correctly');
                suggestions.push('Verify the object is the correct type');
                suggestions.push('Ensure the required module is properly imported');
            }
            if (msg.includes('cannot set')) {
                suggestions.push('Verify the object is initialized before setting properties');
                suggestions.push('Check if you\'re trying to modify a readonly property');
            }
        }
        
        // ReferenceError suggestions
        if (name === 'referenceerror' || msg.includes('is not defined')) {
            suggestions.push('Check for typos in variable/function names');
            suggestions.push('Ensure the variable is declared before use');
            suggestions.push('Verify imports are correct');
            suggestions.push('Check variable scope (let/const block scoping)');
        }
        
        // SyntaxError suggestions
        if (name === 'syntaxerror') {
            if (msg.includes('unexpected token')) {
                suggestions.push('Check for missing brackets, parentheses, or semicolons');
                suggestions.push('Verify JSON format if parsing JSON');
                suggestions.push('Look for unescaped special characters in strings');
            }
            if (msg.includes('unexpected end')) {
                suggestions.push('Check for unclosed brackets or strings');
                suggestions.push('Verify the file is complete (not truncated)');
            }
        }
        
        // Network-related
        if (msg.includes('fetch') || msg.includes('network') || msg.includes('failed to load')) {
            suggestions.push('Check if the server is running');
            suggestions.push('Verify the URL is correct');
            suggestions.push('Check network connectivity');
            suggestions.push('Look for CORS issues in browser console');
        }
        
        // WebGL-related
        if (msg.includes('webgl') || msg.includes('gl.')) {
            suggestions.push('Check if WebGL is supported in this browser');
            suggestions.push('Verify the canvas element exists');
            suggestions.push('Check for context loss - try refreshing');
            suggestions.push('Reduce texture sizes or complexity');
        }
        
        // Module-related
        if (msg.includes('module') || msg.includes('import') || msg.includes('export')) {
            suggestions.push('Check the module path is correct');
            suggestions.push('Verify the export exists in the source module');
            suggestions.push('Ensure you\'re using the correct import syntax');
            suggestions.push('Check if the module is installed (npm install)');
        }
        
        return suggestions;
    }
    
    // ========================================================================
    // CONSOLE CAPTURE
    // ========================================================================
    
    private installConsoleCapture(): void {
        const self = this;
        
        // Capture console.error
        this.originalConsoleError = console.error.bind(console);
        console.error = function(...args: any[]) {
            self.captureConsoleMessage('error', args);
            self.originalConsoleError!.apply(console, args);
        };
        
        // Capture console.warn
        this.originalConsoleWarn = console.warn.bind(console);
        console.warn = function(...args: any[]) {
            self.captureConsoleMessage('warning', args);
            self.originalConsoleWarn!.apply(console, args);
        };
    }
    
    private captureConsoleMessage(severity: 'error' | 'warning', args: any[]): void {
        // Don't capture our own messages
        if (args.some(a => typeof a === 'string' && a.includes('Live Debugger'))) return;
        
        // Format arguments
        const message = args.map(arg => {
            if (arg instanceof Error) return arg.message;
            if (typeof arg === 'object') {
                try { return JSON.stringify(arg, null, 2); }
                catch { return String(arg); }
            }
            return String(arg);
        }).join(' ');
        
        // Check for deprecation warnings
        const isDeprecation = message.toLowerCase().includes('deprecated') || 
                             message.toLowerCase().includes('will be removed');
        
        // Check for WebGL warnings
        const isWebGL = message.toLowerCase().includes('webgl') || 
                       message.toLowerCase().includes('gl.') ||
                       message.toLowerCase().includes('shader');
        
        this.captureIssue({
            severity: severity === 'error' ? 'error' : 'warning',
            category: isDeprecation ? 'deprecation' : isWebGL ? 'webgl' : 'runtime',
            title: isDeprecation ? 'Deprecation Warning' : 
                   isWebGL ? 'WebGL Warning' : 
                   severity === 'error' ? 'Console Error' : 'Console Warning',
            message,
            stack: this.config.captureStackTraces ? getStackTrace() : undefined
        });
    }
    
    // ========================================================================
    // NETWORK WATCHER
    // ========================================================================
    
    private installNetworkWatcher(): void {
        const self = this;
        
        // Watch fetch()
        this.originalFetch = window.fetch.bind(window);
        window.fetch = async function(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
            const url = typeof input === 'string' ? input : 
                       input instanceof URL ? input.href : 
                       (input as Request).url;
            const method = init?.method || 'GET';
            const startTime = performance.now();
            
            try {
                const response = await self.originalFetch!(input, init);
                const duration = performance.now() - startTime;
                
                // Check for slow requests
                if (duration > self.config.networkTimeoutWarning) {
                    self.captureIssue({
                        severity: 'warning',
                        category: 'network',
                        title: 'Slow Network Request',
                        message: `${method} ${url} took ${formatTime(duration)}`,
                        context: { url, method, duration, status: response.status }
                    });
                }
                
                // Check for error responses
                if (!response.ok) {
                    self.captureIssue({
                        severity: response.status >= 500 ? 'error' : 'warning',
                        category: 'network',
                        title: `HTTP ${response.status} ${response.statusText}`,
                        message: `${method} ${url} failed`,
                        context: { url, method, status: response.status, statusText: response.statusText },
                        suggestions: self.getNetworkSuggestions(response.status, url)
                    });
                }
                
                return response;
            } catch (error: any) {
                self.captureIssue({
                    severity: 'error',
                    category: 'network',
                    title: 'Network Request Failed',
                    message: `${method} ${url}: ${error.message}`,
                    context: { url, method, error: error.message },
                    suggestions: [
                        'Check if the server is running',
                        'Verify the URL is correct',
                        'Check for CORS issues',
                        'Verify network connectivity'
                    ]
                });
                
                self.resourceIssues.push({
                    url,
                    type: 'fetch',
                    error: error.message,
                    timestamp: Date.now()
                });
                
                throw error;
            }
        };
        
        // Watch XMLHttpRequest
        this.originalXHROpen = XMLHttpRequest.prototype.open;
        this.originalXHRSend = XMLHttpRequest.prototype.send;
        
        XMLHttpRequest.prototype.open = function(method: string, url: string | URL, ...args: any[]) {
            (this as any).__debugInfo = { method, url: url.toString(), startTime: 0 };
            return self.originalXHROpen!.apply(this, [method, url, ...args] as any);
        };
        
        XMLHttpRequest.prototype.send = function(body?: any) {
            const info = (this as any).__debugInfo;
            if (info) {
                info.startTime = performance.now();
            }
            
            this.addEventListener('loadend', () => {
                if (!info) return;
                
                const duration = performance.now() - info.startTime;
                
                if (this.status === 0 || this.status >= 400) {
                    self.captureIssue({
                        severity: this.status >= 500 ? 'error' : 'warning',
                        category: 'network',
                        title: this.status === 0 ? 'XHR Request Failed' : `HTTP ${this.status}`,
                        message: `${info.method} ${info.url}`,
                        context: { 
                            url: info.url, 
                            method: info.method, 
                            status: this.status,
                            duration 
                        }
                    });
                } else if (duration > self.config.networkTimeoutWarning) {
                    self.captureIssue({
                        severity: 'warning',
                        category: 'network',
                        title: 'Slow XHR Request',
                        message: `${info.method} ${info.url} took ${formatTime(duration)}`,
                        context: { url: info.url, method: info.method, duration }
                    });
                }
            });
            
            return self.originalXHRSend!.apply(this, [body] as any);
        };
    }
    
    private getNetworkSuggestions(status: number, _url: string): string[] {
        switch (status) {
            case 400:
                return ['Check request body format', 'Verify required parameters', 'Check Content-Type header'];
            case 401:
                return ['Check authentication token', 'Verify credentials', 'Token may have expired'];
            case 403:
                return ['Check user permissions', 'Verify API key', 'Resource may be restricted'];
            case 404:
                return ['Verify URL path is correct', 'Check if resource exists', 'API endpoint may have changed'];
            case 405:
                return ['Check HTTP method (GET/POST/etc)', 'Endpoint may not support this method'];
            case 429:
                return ['Rate limit exceeded', 'Add request throttling', 'Wait before retrying'];
            case 500:
                return ['Server error - check server logs', 'Try again later', 'Contact API provider'];
            case 502:
            case 503:
            case 504:
                return ['Server may be down', 'Check server status', 'Try again in a few minutes'];
            default:
                return ['Check server logs for details', 'Verify request format'];
        }
    }
    
    // ========================================================================
    // WEBSOCKET WATCHER
    // ========================================================================
    
    private installWebSocketWatcher(): void {
        const self = this;
        
        this.originalWebSocket = window.WebSocket;
        
        (window as any).WebSocket = function(url: string | URL, protocols?: string | string[]) {
            const ws = new self.originalWebSocket!(url, protocols);
            const wsUrl = url.toString();
            
            self.activeWebSockets.set(ws, { url: wsUrl, openTime: 0 });
            
            ws.addEventListener('open', () => {
                const info = self.activeWebSockets.get(ws);
                if (info) info.openTime = Date.now();
            });
            
            ws.addEventListener('error', () => {
                self.captureIssue({
                    severity: 'error',
                    category: 'websocket',
                    title: 'WebSocket Error',
                    message: `Connection to ${wsUrl} failed`,
                    suggestions: [
                        'Check if the WebSocket server is running',
                        'Verify the WebSocket URL is correct',
                        'Check for SSL/TLS certificate issues (wss://)',
                        'Ensure the server accepts WebSocket connections',
                        'Check firewall or proxy settings'
                    ]
                });
            });
            
            ws.addEventListener('close', (event) => {
                const info = self.activeWebSockets.get(ws);
                self.activeWebSockets.delete(ws);
                
                // Only report unexpected closures
                if (event.code !== 1000 && event.code !== 1001) {
                    const duration = info?.openTime ? Date.now() - info.openTime : 0;
                    self.captureIssue({
                        severity: event.code >= 4000 ? 'error' : 'warning',
                        category: 'websocket',
                        title: 'WebSocket Closed Unexpectedly',
                        message: `${wsUrl} closed with code ${event.code}: ${event.reason || 'No reason'}`,
                        context: { code: event.code, reason: event.reason, duration },
                        suggestions: self.getWebSocketCloseSuggestions(event.code)
                    });
                }
            });
            
            return ws;
        } as any;
        
        // Copy static properties
        (window as any).WebSocket.CONNECTING = 0;
        (window as any).WebSocket.OPEN = 1;
        (window as any).WebSocket.CLOSING = 2;
        (window as any).WebSocket.CLOSED = 3;
    }
    
    private getWebSocketCloseSuggestions(code: number): string[] {
        switch (code) {
            case 1002: return ['Protocol error - check message format'];
            case 1003: return ['Invalid data type received'];
            case 1006: return ['Connection lost - check network', 'Server may have crashed'];
            case 1007: return ['Invalid message data encoding'];
            case 1008: return ['Policy violation - check message size'];
            case 1009: return ['Message too large - reduce payload size'];
            case 1011: return ['Server encountered an error'];
            case 1012: return ['Server restarting - reconnect shortly'];
            case 1013: return ['Try again later - server overloaded'];
            case 1014: return ['Bad gateway'];
            case 1015: return ['TLS/SSL handshake failed - check certificates'];
            default:
                if (code >= 4000) return ['Application-specific error - check server logs'];
                return ['Check WebSocket server status'];
        }
    }
    
    // ========================================================================
    // PERFORMANCE WATCHER
    // ========================================================================
    
    private installPerformanceWatcher(): void {
        // Use Performance Observer for long tasks
        if ('PerformanceObserver' in window) {
            try {
                // Long tasks
                const longTaskObserver = new PerformanceObserver((list) => {
                    for (const entry of list.getEntries()) {
                        if (entry.duration > this.config.longTaskThreshold) {
                            this.captureIssue({
                                severity: entry.duration > 100 ? 'warning' : 'info',
                                category: 'performance',
                                title: 'Long Task Detected',
                                message: `Task took ${entry.duration.toFixed(1)}ms (threshold: ${this.config.longTaskThreshold}ms)`,
                                context: {
                                    duration: entry.duration,
                                    startTime: entry.startTime,
                                    name: entry.name
                                },
                                suggestions: [
                                    'Break up long-running code into smaller chunks',
                                    'Use requestIdleCallback for non-urgent work',
                                    'Move heavy computation to Web Workers',
                                    'Optimize loops and reduce complexity'
                                ]
                            });
                            
                            this.performanceAlerts.push({
                                type: 'long_task',
                                value: entry.duration,
                                threshold: this.config.longTaskThreshold,
                                timestamp: Date.now()
                            });
                        }
                    }
                });
                longTaskObserver.observe({ entryTypes: ['longtask'] });
            } catch (e) {
                // longtask may not be supported
            }
            
            // Layout shifts
            try {
                const layoutShiftObserver = new PerformanceObserver((list) => {
                    for (const entry of list.getEntries()) {
                        const layoutShift = entry as any;
                        if (!layoutShift.hadRecentInput && layoutShift.value > 0.1) {
                            this.captureIssue({
                                severity: layoutShift.value > 0.25 ? 'warning' : 'info',
                                category: 'performance',
                                title: 'Layout Shift Detected',
                                message: `Cumulative layout shift: ${layoutShift.value.toFixed(3)}`,
                                suggestions: [
                                    'Set explicit dimensions for images and embeds',
                                    'Reserve space for dynamic content',
                                    'Avoid inserting content above existing content'
                                ]
                            });
                        }
                    }
                });
                layoutShiftObserver.observe({ entryTypes: ['layout-shift'] });
            } catch (e) {
                // layout-shift may not be supported
            }
        }
        
        // FPS monitoring via requestAnimationFrame
        this.monitorFPS();
    }
    
    private monitorFPS(): void {
        let lastTime = performance.now();
        let frames = 0;
        let lastFPSAlert = 0;
        
        const measure = () => {
            const now = performance.now();
            frames++;
            
            if (now - lastTime >= 1000) {
                const fps = Math.round(frames * 1000 / (now - lastTime));
                this.fpsHistory.push(fps);
                if (this.fpsHistory.length > 60) this.fpsHistory.shift();
                
                // Check for FPS drops
                if (fps < this.config.fpsErrorThreshold && now - lastFPSAlert > 5000) {
                    lastFPSAlert = now;
                    this.captureIssue({
                        severity: 'error',
                        category: 'performance',
                        title: 'Critical FPS Drop',
                        message: `FPS dropped to ${fps} (threshold: ${this.config.fpsErrorThreshold})`,
                        context: { fps, history: [...this.fpsHistory] },
                        suggestions: [
                            'Profile to find bottlenecks',
                            'Enable frustum culling and LOD',
                            'Batch draw calls and optimize shaders',
                            'Check for synchronous operations blocking main thread',
                            'Verify WebGL context is not lost',
                            'Check for expensive computations in render loop'
                        ]
                    });
                    
                    this.performanceAlerts.push({
                        type: 'fps_drop',
                        value: fps,
                        threshold: this.config.fpsErrorThreshold,
                        timestamp: Date.now()
                    });
                } else if (fps < this.config.fpsWarningThreshold && now - lastFPSAlert > 10000) {
                    lastFPSAlert = now;
                    this.captureIssue({
                        severity: 'warning',
                        category: 'performance',
                        title: 'Low FPS',
                        message: `FPS: ${fps} (warning threshold: ${this.config.fpsWarningThreshold})`,
                        context: { fps }
                    });
                }
                
                frames = 0;
                lastTime = now;
            }
            
            this.rafId = requestAnimationFrame(measure);
        };
        
        this.rafId = requestAnimationFrame(measure);
    }
    
    // ========================================================================
    // MEMORY WATCHER
    // ========================================================================
    
    private installMemoryWatcher(): void {
        if (!('memory' in performance)) return;
        
        let lastMemoryAlert = 0;
        let baselineMemory = 0;
        
        this.memoryCheckInterval = window.setInterval(() => {
            const memory = (performance as any).memory;
            if (!memory) return;
            
            const usedMB = memory.usedJSHeapSize / (1024 * 1024);
            const totalMB = memory.totalJSHeapSize / (1024 * 1024);
            const limitMB = memory.jsHeapSizeLimit / (1024 * 1024);
            
            this.memoryHistory.push(usedMB);
            if (this.memoryHistory.length > 60) this.memoryHistory.shift();
            
            // Set baseline
            if (baselineMemory === 0) baselineMemory = usedMB;
            
            const now = Date.now();
            
            // Check for high memory usage
            if (usedMB > this.config.memoryErrorMB && now - lastMemoryAlert > 30000) {
                lastMemoryAlert = now;
                this.captureIssue({
                    severity: 'error',
                    category: 'memory',
                    title: 'High Memory Usage',
                    message: `Memory: ${usedMB.toFixed(0)}MB / ${limitMB.toFixed(0)}MB (${((usedMB / limitMB) * 100).toFixed(0)}%)`,
                    context: { usedMB, totalMB, limitMB, baseline: baselineMemory },
                    suggestions: [
                        'Dispose unused objects and textures',
                        'Clear caches that are no longer needed',
                        'Check for memory leaks in event listeners',
                        'Use object pooling for frequently created objects',
                        'Profile memory with browser DevTools'
                    ]
                });
                
                this.performanceAlerts.push({
                    type: 'memory_spike',
                    value: usedMB,
                    threshold: this.config.memoryErrorMB,
                    timestamp: now
                });
            } else if (usedMB > this.config.memoryWarningMB && now - lastMemoryAlert > 60000) {
                lastMemoryAlert = now;
                this.captureIssue({
                    severity: 'warning',
                    category: 'memory',
                    title: 'Memory Usage Warning',
                    message: `Memory: ${usedMB.toFixed(0)}MB (warning: ${this.config.memoryWarningMB}MB)`,
                    context: { usedMB, totalMB, limitMB }
                });
            }
            
            // Check for memory growth (potential leak)
            if (this.memoryHistory.length >= 30) {
                const earlyAvg = this.memoryHistory.slice(0, 10).reduce((a, b) => a + b, 0) / 10;
                const lateAvg = this.memoryHistory.slice(-10).reduce((a, b) => a + b, 0) / 10;
                const growth = lateAvg - earlyAvg;
                
                if (growth > 50 && now - lastMemoryAlert > 60000) { // 50MB growth
                    lastMemoryAlert = now;
                    this.captureIssue({
                        severity: 'warning',
                        category: 'memory',
                        title: 'Potential Memory Leak',
                        message: `Memory grew by ${growth.toFixed(0)}MB over monitoring period`,
                        context: { 
                            earlyAvg: earlyAvg.toFixed(0), 
                            lateAvg: lateAvg.toFixed(0), 
                            growth: growth.toFixed(0) 
                        },
                        suggestions: [
                            'Check for unremoved event listeners',
                            'Verify setInterval/setTimeout are cleared',
                            'Check for circular references',
                            'Ensure disposed objects are dereferenced',
                            'Use Chrome DevTools Memory tab to profile'
                        ]
                    });
                }
            }
        }, 5000);
    }
    
    // ========================================================================
    // DOM WATCHER
    // ========================================================================
    
    private installDOMWatcher(): void {
        let lastDOMAlert = 0;
        
        // Check DOM node count periodically
        const checkDOM = () => {
            const nodeCount = document.getElementsByTagName('*').length;
            const now = Date.now();
            
            if (nodeCount > this.config.domNodeWarning && now - lastDOMAlert > 60000) {
                lastDOMAlert = now;
                this.captureIssue({
                    severity: 'warning',
                    category: 'dom',
                    title: 'Large DOM Size',
                    message: `DOM has ${nodeCount.toLocaleString()} nodes (warning: ${this.config.domNodeWarning.toLocaleString()})`,
                    suggestions: [
                        'Implement virtual scrolling for long lists',
                        'Remove hidden/unused elements',
                        'Use document fragments for batch updates',
                        'Consider lazy loading content'
                    ]
                });
            }
        };
        
        // Check on interval
        setInterval(checkDOM, 10000);
        
        // Watch for rapid DOM mutations
        let mutationCount = 0;
        let mutationResetTime = Date.now();
        
        this.domObserver = new MutationObserver((mutations) => {
            // Filter out mutations from debug panels to avoid self-counting
            const realMutations = mutations.filter(m => {
                const target = m.target as HTMLElement;
                return !target.closest?.('#webforge-live-debugger') &&
                       !target.closest?.('#webforge-devcenter-overlay') &&
                       !target.closest?.('#webforge-devcenter-indicator') &&
                       !target.closest?.('#webforge-dev-overlay');
            });
            
            mutationCount += realMutations.length;
            
            const now = Date.now();
            if (now - mutationResetTime >= 1000) {
                if (mutationCount > 200) {
                    this.captureIssue({
                        severity: 'info',
                        category: 'dom',
                        title: 'High DOM Mutation Rate',
                        message: `${mutationCount} mutations in the last second`,
                        suggestions: [
                            'Batch DOM updates',
                            'Use document fragments',
                            'Consider using requestAnimationFrame for visual updates',
                            'Debounce rapid updates'
                        ]
                    });
                }
                mutationCount = 0;
                mutationResetTime = now;
            }
        });
        
        this.domObserver.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: false,
            characterData: false
        });
    }
    
    // ========================================================================
    // EVENT WATCHER
    // ========================================================================
    
    private installEventWatcher(): void {
        const self = this;
        let lastEventAlert = 0;
        
        // Track addEventListener calls
        this.originalAddEventListener = EventTarget.prototype.addEventListener;
        EventTarget.prototype.addEventListener = function(
            type: string, 
            listener: EventListenerOrEventListenerObject | null, 
            options?: boolean | AddEventListenerOptions
        ) {
            if (listener) {
                let targetListeners = self.eventListenerRegistry.get(this);
                if (!targetListeners) {
                    targetListeners = new Map();
                    self.eventListenerRegistry.set(this, targetListeners);
                }
                targetListeners.set(type, (targetListeners.get(type) || 0) + 1);
                self.eventListenerCount++;
                
                // Check for too many listeners
                const now = Date.now();
                if (self.eventListenerCount > self.config.eventListenerWarning && now - lastEventAlert > 60000) {
                    lastEventAlert = now;
                    self.captureIssue({
                        severity: 'warning',
                        category: 'event',
                        title: 'High Event Listener Count',
                        message: `${self.eventListenerCount} active event listeners (warning: ${self.config.eventListenerWarning})`,
                        suggestions: [
                            'Use event delegation instead of individual listeners',
                            'Remove listeners when elements are removed',
                            'Use { once: true } for one-time listeners',
                            'Check for listener leaks in components'
                        ]
                    });
                }
            }
            
            return self.originalAddEventListener!.call(this, type, listener, options);
        };
        
        // Track removeEventListener calls
        this.originalRemoveEventListener = EventTarget.prototype.removeEventListener;
        EventTarget.prototype.removeEventListener = function(
            type: string,
            listener: EventListenerOrEventListenerObject | null,
            options?: boolean | EventListenerOptions
        ) {
            if (listener) {
                const targetListeners = self.eventListenerRegistry.get(this);
                if (targetListeners) {
                    const count = targetListeners.get(type) || 0;
                    if (count > 0) {
                        targetListeners.set(type, count - 1);
                        self.eventListenerCount--;
                    }
                }
            }
            
            return self.originalRemoveEventListener!.call(this, type, listener, options);
        };
    }
    
    // ========================================================================
    // RESOURCE WATCHER
    // ========================================================================
    
    private installResourceWatcher(): void {
        // Watch for resource loading errors
        window.addEventListener('error', (event) => {
            const target = event.target as HTMLElement | null;
            if (target && target !== window as unknown) {
                let url = '';
                let type: ResourceIssue['type'] = 'other';
                
                if (target instanceof HTMLScriptElement) {
                    url = target.src;
                    type = 'script';
                } else if (target instanceof HTMLLinkElement) {
                    url = target.href;
                    type = 'style';
                } else if (target instanceof HTMLImageElement) {
                    url = target.src;
                    type = 'image';
                }
                
                if (url) {
                    this.captureIssue({
                        severity: type === 'script' ? 'error' : 'warning',
                        category: 'resource',
                        title: `Failed to Load ${type.charAt(0).toUpperCase() + type.slice(1)}`,
                        message: url,
                        suggestions: [
                            'Check if the resource exists',
                            'Verify the path is correct',
                            'Check for CORS issues',
                            'Ensure the server is running'
                        ]
                    });
                    
                    this.resourceIssues.push({
                        url,
                        type,
                        error: 'Failed to load',
                        timestamp: Date.now()
                    });
                }
            }
        }, true);
    }
    
    // ========================================================================
    // SECURITY WATCHER
    // ========================================================================
    
    private installSecurityWatcher(): void {
        // Content Security Policy violations
        document.addEventListener('securitypolicyviolation', (event) => {
            this.captureIssue({
                severity: 'error',
                category: 'security',
                title: 'Content Security Policy Violation',
                message: `Blocked: ${event.blockedURI || 'inline'} (${event.violatedDirective})`,
                context: {
                    blockedURI: event.blockedURI,
                    violatedDirective: event.violatedDirective,
                    originalPolicy: event.originalPolicy,
                    sourceFile: event.sourceFile,
                    lineNumber: event.lineNumber
                },
                suggestions: [
                    'Update CSP header to allow this resource',
                    'Move inline scripts to external files',
                    'Use nonces or hashes for inline content'
                ]
            });
        });
    }
    
    // ========================================================================
    // MODULE WATCHER
    // ========================================================================
    
    private installModuleWatcher(): void {
        // Watch for import errors (these usually come through global error handler)
        // But we can add specific detection
        
        // Dynamic import failures
        const originalImport = (window as any).importShim || Function.prototype;
        if (typeof originalImport === 'function') {
            (window as any).importShim = async (specifier: string) => {
                try {
                    return await originalImport(specifier);
                } catch (error: any) {
                    this.captureIssue({
                        severity: 'error',
                        category: 'module',
                        title: 'Module Import Failed',
                        message: `Failed to import "${specifier}": ${error.message}`,
                        suggestions: [
                            'Check if the module path is correct',
                            'Verify the module is installed',
                            'Check for syntax errors in the module',
                            'Ensure exports match imports'
                        ]
                    });
                    throw error;
                }
            };
        }
    }
    
    // ========================================================================
    // KEYBOARD SHORTCUTS
    // ========================================================================
    
    private installKeyboardShortcuts(): void {
        window.addEventListener('keydown', (e) => {
            // F12 or Ctrl+Shift+D - Toggle debugger
            if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && e.key === 'D')) {
                e.preventDefault();
                this.toggleOverlay();
            }
            
            // Escape - Close overlay
            if (e.key === 'Escape' && this.overlay?.classList.contains('visible')) {
                this.hideOverlay();
            }
            
            // Ctrl+Shift+C - Clear issues
            if (e.ctrlKey && e.shiftKey && e.key === 'C') {
                e.preventDefault();
                this.clearIssues();
            }
        });
    }
    
    // ========================================================================
    // ISSUE CAPTURE
    // ========================================================================
    
    captureIssue(data: Partial<CapturedIssue>): CapturedIssue {
        const now = Date.now();
        
        // Generate fingerprint for grouping
        const fingerprint = `${data.category}-${data.title}-${data.message?.slice(0, 100)}`;
        
        // Check for existing similar issue
        if (this.config.groupSimilarIssues) {
            const existing = this.issues.get(fingerprint);
            if (existing) {
                existing.count++;
                existing.lastSeen = now;
                this.notifyListeners(existing);
                this.updateOverlay();
                return existing;
            }
        }
        
        const issue: CapturedIssue = {
            id: generateIssueId(),
            timestamp: now,
            severity: data.severity || 'info',
            category: data.category || 'runtime',
            title: data.title || 'Issue',
            message: data.message || '',
            details: data.details,
            stack: data.stack,
            source: data.source,
            context: data.context,
            count: 1,
            firstSeen: now,
            lastSeen: now,
            resolved: false,
            suggestions: data.suggestions
        };
        
        this.issues.set(this.config.groupSimilarIssues ? fingerprint : issue.id, issue);
        
        // Trim history
        if (this.issues.size > this.config.maxIssueHistory) {
            const oldest = Array.from(this.issues.entries())
                .sort((a, b) => a[1].lastSeen - b[1].lastSeen)[0];
            this.issues.delete(oldest[0]);
        }
        
        // Notify listeners
        this.notifyListeners(issue);
        
        // Show notification if enabled
        if (this.config.showNotifications && (issue.severity === 'error' || issue.severity === 'critical')) {
            this.showNotification(issue);
        }
        
        // Auto-show overlay on error
        if (this.config.autoShowOnError && (issue.severity === 'error' || issue.severity === 'critical')) {
            this.showOverlay();
        }
        
        // Update overlay
        this.updateOverlay();
        
        return issue;
    }
    
    private notifyListeners(issue: CapturedIssue): void {
        for (const listener of this.listeners) {
            try {
                listener(issue);
            } catch {
                // Ignore listener errors
            }
        }
    }
    
    // ========================================================================
    // UI - OVERLAY
    // ========================================================================
    
    private createOverlay(): void {
        if (this.overlay) return;
        
        this.overlay = document.createElement('div');
        this.overlay.id = 'webforge-live-debugger';
        
        // Start position from config but allow dragging
        // Position to the left of DevTools (which is at right: 10px, width: 340px)
        this.overlay.innerHTML = `
            <style>
                #webforge-live-debugger {
                    position: fixed;
                    top: 10px;
                    right: 360px;
                    width: 420px;
                    max-height: 80vh;
                    background: rgba(15, 15, 25, 0.98);
                    border: 1px solid #333;
                    border-radius: 12px;
                    font-family: 'SF Mono', 'Consolas', 'Monaco', monospace;
                    font-size: 12px;
                    color: #e0e0e0;
                    z-index: 2147483647;
                    display: none;
                    flex-direction: column;
                    box-shadow: 0 8px 32px rgba(0,0,0,0.5);
                    overflow: hidden;
                }
                #webforge-live-debugger.visible {
                    display: flex;
                }
                #webforge-live-debugger * {
                    box-sizing: border-box;
                }
                .ld-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 12px 16px;
                    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
                    border-bottom: 1px solid #333;
                    cursor: move;
                    user-select: none;
                }
                .ld-title {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    font-weight: 600;
                    font-size: 13px;
                }
                .ld-logo {
                    font-size: 18px;
                }
                .ld-badge {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    min-width: 20px;
                    height: 20px;
                    padding: 0 6px;
                    background: #ef4444;
                    color: white;
                    border-radius: 10px;
                    font-size: 11px;
                    font-weight: 700;
                }
                .ld-badge.warning {
                    background: #f59e0b;
                }
                .ld-badge.ok {
                    background: #22c55e;
                }
                .ld-controls {
                    display: flex;
                    gap: 8px;
                }
                .ld-btn {
                    padding: 4px 10px;
                    background: rgba(255,255,255,0.1);
                    border: none;
                    border-radius: 4px;
                    color: #aaa;
                    cursor: pointer;
                    font-size: 11px;
                    transition: all 0.15s;
                }
                .ld-btn:hover {
                    background: rgba(255,255,255,0.2);
                    color: #fff;
                }
                .ld-close {
                    background: none;
                    border: none;
                    color: #666;
                    cursor: pointer;
                    font-size: 20px;
                    line-height: 1;
                    padding: 0 4px;
                }
                .ld-close:hover {
                    color: #ef4444;
                }
                .ld-tabs {
                    display: flex;
                    background: #0a0a15;
                    border-bottom: 1px solid #333;
                }
                .ld-tab {
                    flex: 1;
                    padding: 10px;
                    text-align: center;
                    cursor: pointer;
                    color: #666;
                    border-bottom: 2px solid transparent;
                    transition: all 0.15s;
                    font-size: 11px;
                }
                .ld-tab:hover {
                    color: #aaa;
                    background: rgba(255,255,255,0.03);
                }
                .ld-tab.active {
                    color: #4ade80;
                    border-bottom-color: #4ade80;
                }
                .ld-tab .ld-tab-count {
                    margin-left: 4px;
                    padding: 1px 5px;
                    background: rgba(255,255,255,0.1);
                    border-radius: 8px;
                    font-size: 10px;
                }
                .ld-tab.active .ld-tab-count {
                    background: rgba(74, 222, 128, 0.2);
                }
                .ld-content {
                    flex: 1;
                    overflow-y: auto;
                    max-height: calc(80vh - 120px);
                }
                .ld-panel {
                    display: none;
                    padding: 12px;
                }
                .ld-panel.active {
                    display: block;
                }
                .ld-empty {
                    text-align: center;
                    padding: 40px 20px;
                    color: #4ade80;
                }
                .ld-empty-icon {
                    font-size: 32px;
                    margin-bottom: 12px;
                }
                .ld-issue {
                    margin-bottom: 8px;
                    padding: 12px;
                    background: rgba(239, 68, 68, 0.08);
                    border-left: 3px solid #ef4444;
                    border-radius: 0 8px 8px 0;
                    transition: all 0.15s;
                }
                .ld-issue:hover {
                    background: rgba(239, 68, 68, 0.12);
                }
                .ld-issue.warning {
                    background: rgba(245, 158, 11, 0.08);
                    border-left-color: #f59e0b;
                }
                .ld-issue.warning:hover {
                    background: rgba(245, 158, 11, 0.12);
                }
                .ld-issue.info {
                    background: rgba(59, 130, 246, 0.08);
                    border-left-color: #3b82f6;
                }
                .ld-issue.info:hover {
                    background: rgba(59, 130, 246, 0.12);
                }
                .ld-issue-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    margin-bottom: 6px;
                }
                .ld-issue-title {
                    font-weight: 600;
                    color: #fff;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                .ld-issue-category {
                    padding: 2px 6px;
                    background: rgba(255,255,255,0.1);
                    border-radius: 4px;
                    font-size: 9px;
                    text-transform: uppercase;
                    color: #888;
                }
                .ld-issue-count {
                    background: rgba(239, 68, 68, 0.3);
                    padding: 2px 8px;
                    border-radius: 10px;
                    font-size: 10px;
                    color: #fca5a5;
                }
                .ld-issue-time {
                    color: #555;
                    font-size: 10px;
                }
                .ld-issue-msg {
                    color: #bbb;
                    word-break: break-word;
                    line-height: 1.5;
                    font-size: 11px;
                }
                .ld-issue-source {
                    margin-top: 6px;
                    font-size: 10px;
                    color: #666;
                }
                .ld-issue-suggestions {
                    margin-top: 8px;
                    padding: 8px;
                    background: rgba(0,0,0,0.2);
                    border-radius: 4px;
                    display: none;
                }
                .ld-issue:hover .ld-issue-suggestions {
                    display: block;
                }
                .ld-issue-suggestions-title {
                    font-size: 10px;
                    color: #4ade80;
                    margin-bottom: 4px;
                    font-weight: 600;
                }
                .ld-issue-suggestions ul {
                    margin: 0;
                    padding-left: 16px;
                    font-size: 10px;
                    color: #888;
                }
                .ld-issue-suggestions li {
                    margin-bottom: 2px;
                }
                .ld-issue-stack {
                    margin-top: 8px;
                    padding: 8px;
                    background: rgba(0,0,0,0.3);
                    border-radius: 4px;
                    font-size: 10px;
                    color: #666;
                    max-height: 100px;
                    overflow-y: auto;
                    white-space: pre-wrap;
                    display: none;
                }
                .ld-issue:hover .ld-issue-stack {
                    display: block;
                }
                .ld-stats {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 10px;
                    margin-bottom: 16px;
                }
                .ld-stat {
                    background: rgba(255,255,255,0.03);
                    padding: 12px;
                    border-radius: 8px;
                    text-align: center;
                }
                .ld-stat-value {
                    font-size: 20px;
                    font-weight: 700;
                    color: #4ade80;
                }
                .ld-stat-value.warning {
                    color: #f59e0b;
                }
                .ld-stat-value.error {
                    color: #ef4444;
                }
                .ld-stat-label {
                    font-size: 10px;
                    color: #666;
                    margin-top: 4px;
                    text-transform: uppercase;
                }
                .ld-section {
                    margin-bottom: 16px;
                }
                .ld-section-title {
                    font-size: 10px;
                    color: #666;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                    margin-bottom: 8px;
                    padding-bottom: 4px;
                    border-bottom: 1px solid #222;
                }
                .ld-perf-bar {
                    height: 4px;
                    background: #222;
                    border-radius: 2px;
                    margin-top: 4px;
                    overflow: hidden;
                }
                .ld-perf-bar-fill {
                    height: 100%;
                    border-radius: 2px;
                    transition: width 0.3s, background 0.3s;
                }
                .ld-notification {
                    position: fixed;
                    bottom: 20px;
                    right: 20px;
                    padding: 12px 16px;
                    background: rgba(239, 68, 68, 0.95);
                    color: white;
                    border-radius: 8px;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.4);
                    z-index: 2147483648;
                    max-width: 350px;
                    animation: slideIn 0.3s ease;
                    font-family: 'SF Mono', 'Consolas', monospace;
                    font-size: 12px;
                }
                .ld-notification.warning {
                    background: rgba(245, 158, 11, 0.95);
                }
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                .ld-notification-title {
                    font-weight: 600;
                    margin-bottom: 4px;
                }
                .ld-notification-msg {
                    opacity: 0.9;
                    font-size: 11px;
                }
            </style>
            
            <div class="ld-header">
                <div class="ld-title">
                    <span class="ld-logo">🔍</span>
                    <span>Live Debugger</span>
                    <span class="ld-badge" id="ld-error-count">0</span>
                </div>
                <div class="ld-controls">
                    <button class="ld-btn" id="ld-clear">Clear</button>
                    <button class="ld-btn" id="ld-export">Export</button>
                    <button class="ld-close" id="ld-close">×</button>
                </div>
            </div>
            
            <div class="ld-tabs">
                <div class="ld-tab active" data-tab="issues">
                    Issues <span class="ld-tab-count" id="ld-issues-count">0</span>
                </div>
                <div class="ld-tab" data-tab="performance">
                    Performance
                </div>
                <div class="ld-tab" data-tab="network">
                    Network <span class="ld-tab-count" id="ld-network-count">0</span>
                </div>
            </div>
            
            <div class="ld-content">
                <div class="ld-panel active" id="ld-panel-issues">
                    <div class="ld-empty" id="ld-no-issues">
                        <div class="ld-empty-icon">✓</div>
                        <div>No issues detected</div>
                    </div>
                    <div id="ld-issues-list"></div>
                </div>
                
                <div class="ld-panel" id="ld-panel-performance">
                    <div class="ld-stats">
                        <div class="ld-stat">
                            <div class="ld-stat-value" id="ld-fps">--</div>
                            <div class="ld-stat-label">FPS</div>
                        </div>
                        <div class="ld-stat">
                            <div class="ld-stat-value" id="ld-memory">--</div>
                            <div class="ld-stat-label">Memory (MB)</div>
                        </div>
                        <div class="ld-stat">
                            <div class="ld-stat-value" id="ld-dom-nodes">--</div>
                            <div class="ld-stat-label">DOM Nodes</div>
                        </div>
                    </div>
                    
                    <div class="ld-section">
                        <div class="ld-section-title">Frame Rate</div>
                        <div>Current: <span id="ld-fps-current">--</span> fps</div>
                        <div class="ld-perf-bar">
                            <div class="ld-perf-bar-fill" id="ld-fps-bar" style="width: 100%; background: #4ade80;"></div>
                        </div>
                    </div>
                    
                    <div class="ld-section">
                        <div class="ld-section-title">Memory</div>
                        <div>Used: <span id="ld-mem-used">--</span> / Limit: <span id="ld-mem-limit">--</span></div>
                        <div class="ld-perf-bar">
                            <div class="ld-perf-bar-fill" id="ld-mem-bar" style="width: 0%; background: #4ade80;"></div>
                        </div>
                    </div>
                    
                    <div class="ld-section">
                        <div class="ld-section-title">Event Listeners</div>
                        <div id="ld-listeners">0</div>
                    </div>
                    
                    <div class="ld-section" id="ld-perf-alerts-section" style="display: none;">
                        <div class="ld-section-title">Recent Alerts</div>
                        <div id="ld-perf-alerts"></div>
                    </div>
                </div>
                
                <div class="ld-panel" id="ld-panel-network">
                    <div class="ld-empty" id="ld-no-network">
                        <div class="ld-empty-icon">✓</div>
                        <div>No network issues</div>
                    </div>
                    <div id="ld-network-list"></div>
                </div>
            </div>
        `;
        
        document.body.appendChild(this.overlay);
        this.setupOverlayEvents();
    }
    
    private setupOverlayEvents(): void {
        if (!this.overlay) return;
        
        // Close button
        this.overlay.querySelector('#ld-close')?.addEventListener('click', () => this.hideOverlay());
        
        // Clear button
        this.overlay.querySelector('#ld-clear')?.addEventListener('click', () => this.clearIssues());
        
        // Export button
        this.overlay.querySelector('#ld-export')?.addEventListener('click', () => this.exportReport());
        
        // Tab switching
        this.overlay.querySelectorAll('.ld-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const tabName = (tab as HTMLElement).dataset.tab;
                this.overlay?.querySelectorAll('.ld-tab').forEach(t => t.classList.remove('active'));
                this.overlay?.querySelectorAll('.ld-panel').forEach(p => p.classList.remove('active'));
                tab.classList.add('active');
                this.overlay?.querySelector(`#ld-panel-${tabName}`)?.classList.add('active');
            });
        });
        
        // Start updating performance panel - every 2000ms for lighter weight
        setInterval(() => this.updatePerformancePanel(), 2000);
        
        // Setup drag functionality on header
        this.setupDragHandler();
    }
    
    private setupDragHandler(): void {
        if (!this.overlay) return;
        
        const header = this.overlay.querySelector('.ld-header') as HTMLElement;
        if (!header) return;
        
        let isDragging = false;
        let startX = 0, startY = 0;
        let startLeft = 0, startTop = 0;
        
        header.addEventListener('mousedown', (e: MouseEvent) => {
            // Don't drag if clicking on buttons
            if ((e.target as HTMLElement).closest('button')) return;
            
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            
            // Convert position to left/top if using right/bottom
            const rect = this.overlay!.getBoundingClientRect();
            this.overlay!.style.right = 'auto';
            this.overlay!.style.bottom = 'auto';
            this.overlay!.style.left = `${rect.left}px`;
            this.overlay!.style.top = `${rect.top}px`;
            
            startLeft = rect.left;
            startTop = rect.top;
            
            e.preventDefault();
        });
        
        document.addEventListener('mousemove', (e: MouseEvent) => {
            if (!isDragging || !this.overlay) return;
            
            const deltaX = e.clientX - startX;
            const deltaY = e.clientY - startY;
            
            let newLeft = startLeft + deltaX;
            let newTop = startTop + deltaY;
            
            // Constrain to viewport
            const rect = this.overlay.getBoundingClientRect();
            const maxX = window.innerWidth - rect.width;
            const maxY = window.innerHeight - rect.height;
            
            newLeft = Math.max(0, Math.min(newLeft, maxX));
            newTop = Math.max(0, Math.min(newTop, maxY));
            
            this.overlay.style.left = `${newLeft}px`;
            this.overlay.style.top = `${newTop}px`;
        });
        
        document.addEventListener('mouseup', () => {
            isDragging = false;
        });
    }
    
    private updateOverlay(): void {
        if (!this.overlay) return;
        
        // Update counts
        const errors = Array.from(this.issues.values()).filter(i => i.severity === 'error' || i.severity === 'critical');
        const warnings = Array.from(this.issues.values()).filter(i => i.severity === 'warning');
        const networkIssues = this.resourceIssues.length;
        
        const errorBadge = this.overlay.querySelector('#ld-error-count')!;
        errorBadge.textContent = errors.length.toString();
        errorBadge.className = 'ld-badge' + (errors.length === 0 ? ' ok' : warnings.length > 0 && errors.length === 0 ? ' warning' : '');
        
        this.overlay.querySelector('#ld-issues-count')!.textContent = this.issues.size.toString();
        this.overlay.querySelector('#ld-network-count')!.textContent = networkIssues.toString();
        
        // Update issues list
        const issuesList = this.overlay.querySelector('#ld-issues-list')!;
        const noIssues = this.overlay.querySelector('#ld-no-issues')!;
        
        if (this.issues.size === 0) {
            (noIssues as HTMLElement).style.display = 'block';
            issuesList.innerHTML = '';
        } else {
            (noIssues as HTMLElement).style.display = 'none';
            
            const sortedIssues = Array.from(this.issues.values())
                .sort((a, b) => b.lastSeen - a.lastSeen)
                .slice(0, 50);
            
            issuesList.innerHTML = sortedIssues.map(issue => {
                const severityClass = issue.severity === 'warning' ? 'warning' : 
                                     issue.severity === 'info' ? 'info' : '';
                
                return `
                    <div class="ld-issue ${severityClass}">
                        <div class="ld-issue-header">
                            <div class="ld-issue-title">
                                <span class="ld-issue-category">${issue.category}</span>
                                ${this.escapeHtml(issue.title)}
                                ${issue.count > 1 ? `<span class="ld-issue-count">×${issue.count}</span>` : ''}
                            </div>
                            <div class="ld-issue-time">${new Date(issue.lastSeen).toLocaleTimeString()}</div>
                        </div>
                        <div class="ld-issue-msg">${this.escapeHtml(issue.message.slice(0, 200))}${issue.message.length > 200 ? '...' : ''}</div>
                        ${issue.source?.file ? `<div class="ld-issue-source">${issue.source.file}:${issue.source.line || '?'}</div>` : ''}
                        ${issue.suggestions?.length ? `
                            <div class="ld-issue-suggestions">
                                <div class="ld-issue-suggestions-title">💡 Suggestions:</div>
                                <ul>
                                    ${issue.suggestions.map(s => `<li>${this.escapeHtml(s)}</li>`).join('')}
                                </ul>
                            </div>
                        ` : ''}
                        ${issue.stack ? `<div class="ld-issue-stack">${this.escapeHtml(issue.stack)}</div>` : ''}
                    </div>
                `;
            }).join('');
        }
        
        // Update network list
        const networkList = this.overlay.querySelector('#ld-network-list')!;
        const noNetwork = this.overlay.querySelector('#ld-no-network')!;
        
        if (this.resourceIssues.length === 0) {
            (noNetwork as HTMLElement).style.display = 'block';
            networkList.innerHTML = '';
        } else {
            (noNetwork as HTMLElement).style.display = 'none';
            networkList.innerHTML = this.resourceIssues.slice(-20).reverse().map(issue => `
                <div class="ld-issue">
                    <div class="ld-issue-header">
                        <div class="ld-issue-title">
                            <span class="ld-issue-category">${issue.type}</span>
                            ${issue.error}
                        </div>
                        <div class="ld-issue-time">${new Date(issue.timestamp).toLocaleTimeString()}</div>
                    </div>
                    <div class="ld-issue-msg">${this.escapeHtml(issue.url)}</div>
                </div>
            `).join('');
        }
    }
    
    private updatePerformancePanel(): void {
        if (!this.overlay || !this.overlay.classList.contains('visible')) return;
        
        const fps = this.fpsHistory.length > 0 ? this.fpsHistory[this.fpsHistory.length - 1] : 0;
        const memory = (performance as any).memory;
        const usedMB = memory ? memory.usedJSHeapSize / (1024 * 1024) : 0;
        const limitMB = memory ? memory.jsHeapSizeLimit / (1024 * 1024) : 0;
        const domNodes = document.getElementsByTagName('*').length;
        
        // Update stats
        const fpsEl = this.overlay.querySelector('#ld-fps')!;
        fpsEl.textContent = fps.toString();
        fpsEl.className = 'ld-stat-value' + (fps < this.config.fpsErrorThreshold ? ' error' : fps < this.config.fpsWarningThreshold ? ' warning' : '');
        
        const memEl = this.overlay.querySelector('#ld-memory')!;
        memEl.textContent = usedMB.toFixed(0);
        memEl.className = 'ld-stat-value' + (usedMB > this.config.memoryErrorMB ? ' error' : usedMB > this.config.memoryWarningMB ? ' warning' : '');
        
        const domEl = this.overlay.querySelector('#ld-dom-nodes')!;
        domEl.textContent = domNodes.toLocaleString();
        domEl.className = 'ld-stat-value' + (domNodes > this.config.domNodeWarning ? ' warning' : '');
        
        // Update bars
        this.overlay.querySelector('#ld-fps-current')!.textContent = fps.toString();
        const fpsBar = this.overlay.querySelector('#ld-fps-bar') as HTMLElement;
        const fpsPercent = Math.min(100, (fps / 60) * 100);
        fpsBar.style.width = `${fpsPercent}%`;
        fpsBar.style.background = fps < this.config.fpsErrorThreshold ? '#ef4444' : fps < this.config.fpsWarningThreshold ? '#f59e0b' : '#4ade80';
        
        this.overlay.querySelector('#ld-mem-used')!.textContent = formatBytes(usedMB * 1024 * 1024);
        this.overlay.querySelector('#ld-mem-limit')!.textContent = formatBytes(limitMB * 1024 * 1024);
        const memBar = this.overlay.querySelector('#ld-mem-bar') as HTMLElement;
        const memPercent = limitMB > 0 ? (usedMB / limitMB) * 100 : 0;
        memBar.style.width = `${memPercent}%`;
        memBar.style.background = memPercent > 80 ? '#ef4444' : memPercent > 60 ? '#f59e0b' : '#4ade80';
        
        this.overlay.querySelector('#ld-listeners')!.textContent = this.eventListenerCount.toLocaleString();
        
        // Update performance alerts
        const alertsSection = this.overlay.querySelector('#ld-perf-alerts-section') as HTMLElement;
        const alertsEl = this.overlay.querySelector('#ld-perf-alerts')!;
        
        if (this.performanceAlerts.length > 0) {
            alertsSection.style.display = 'block';
            alertsEl.innerHTML = this.performanceAlerts.slice(-5).reverse().map(alert => `
                <div style="margin-bottom: 6px; padding: 6px; background: rgba(239, 68, 68, 0.1); border-radius: 4px; font-size: 11px;">
                    ${alert.type}: ${alert.value.toFixed(1)} (threshold: ${alert.threshold})
                </div>
            `).join('');
        } else {
            alertsSection.style.display = 'none';
        }
    }
    
    private escapeHtml(text: string): string {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    showOverlay(): void {
        this.overlay?.classList.add('visible');
        this.updateOverlay();
    }
    
    hideOverlay(): void {
        this.overlay?.classList.remove('visible');
    }
    
    toggleOverlay(): void {
        if (this.overlay?.classList.contains('visible')) {
            this.hideOverlay();
        } else {
            this.showOverlay();
        }
    }
    
    // Alias for toggle - for unified API
    toggle(): void {
        this.toggleOverlay();
    }
    
    show(): void {
        this.showOverlay();
    }
    
    hide(): void {
        this.hideOverlay();
    }
    
    // ========================================================================
    // NOTIFICATIONS
    // ========================================================================
    
    private showNotification(issue: CapturedIssue): void {
        const notification = document.createElement('div');
        notification.className = 'ld-notification' + (issue.severity === 'warning' ? ' warning' : '');
        notification.innerHTML = `
            <div class="ld-notification-title">${this.escapeHtml(issue.title)}</div>
            <div class="ld-notification-msg">${this.escapeHtml(issue.message.slice(0, 100))}${issue.message.length > 100 ? '...' : ''}</div>
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideIn 0.3s ease reverse';
            setTimeout(() => notification.remove(), 300);
        }, this.config.notificationDuration);
    }
    
    // ========================================================================
    // PUBLIC API
    // ========================================================================
    
    onIssue(callback: (issue: CapturedIssue) => void): () => void {
        this.listeners.add(callback);
        return () => this.listeners.delete(callback);
    }
    
    getIssues(category?: IssueCategory): CapturedIssue[] {
        const issues = Array.from(this.issues.values());
        if (category) {
            return issues.filter(i => i.category === category);
        }
        return issues;
    }
    
    getErrorCount(): number {
        return Array.from(this.issues.values())
            .filter(i => i.severity === 'error' || i.severity === 'critical')
            .reduce((sum, i) => sum + i.count, 0);
    }
    
    getWarningCount(): number {
        return Array.from(this.issues.values())
            .filter(i => i.severity === 'warning')
            .reduce((sum, i) => sum + i.count, 0);
    }
    
    clearIssues(): void {
        this.issues.clear();
        this.performanceAlerts = [];
        this.resourceIssues = [];
        this.updateOverlay();
    }
    
    resolveIssue(id: string): void {
        for (const [key, issue] of this.issues) {
            if (issue.id === id) {
                issue.resolved = true;
                this.issues.delete(key);
                break;
            }
        }
        this.updateOverlay();
    }
    
    exportReport(): void {
        const report = {
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
            url: window.location.href,
            issues: Array.from(this.issues.values()),
            performanceAlerts: this.performanceAlerts,
            resourceIssues: this.resourceIssues,
            summary: {
                totalIssues: this.issues.size,
                errors: this.getErrorCount(),
                warnings: this.getWarningCount(),
                avgFPS: this.fpsHistory.length > 0 
                    ? this.fpsHistory.reduce((a, b) => a + b, 0) / this.fpsHistory.length 
                    : 0,
                eventListeners: this.eventListenerCount
            }
        };
        
        const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `webforge-debug-report-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }
    
    isEnabled(): boolean {
        return this.config.enabled;
    }
    
    setEnabled(enabled: boolean): void {
        this.config.enabled = enabled;
    }
    
    getConfig(): LiveDebuggerConfig {
        return { ...this.config };
    }
}

// ============================================================================
// EXPORTS
// ============================================================================

export const getLiveDebugger = (): LiveDebugger => LiveDebugger.getInstance();
export default LiveDebugger;
