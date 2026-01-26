/**
 * WebForge Professional Debugger - Debug Manager
 * 
 * Central orchestrator for all debugging features including
 * breakpoints, watches, call stack, profiling, and visualization.
 */

import { breakpointManager, BreakpointManager, BreakpointInfo, DebugContext } from './Breakpoint';
import { watchSystem, WatchSystem, WatchExpression } from './WatchSystem';
import { callStackTracker, CallStackTracker } from './CallStack';
import { stateInspector, StateInspector, InspectedObject } from './StateInspector';
import { timelineProfiler, TimelineProfiler, TimelineStats } from './TimelineProfiler';
import { debugOverlay, DebugOverlay } from './DebugOverlay';
import { errorTracker, ErrorTracker, TrackedError } from './ErrorTracker';
import { debugConsole, DebugConsole, Command } from './DebugConsole';
import { debugDraw, DebugDraw } from './DebugDraw';

export interface DebugManagerConfig {
    enabled: boolean;
    showOverlay: boolean;
    showConsole: boolean;
    enableBreakpoints: boolean;
    enableWatches: boolean;
    enableCallStack: boolean;
    enableTimeline: boolean;
    enableErrorTracking: boolean;
    autoStartRecording: boolean;
    keyboardShortcuts: boolean;
}

export interface DebugSnapshot {
    timestamp: number;
    frameNumber: number;
    fps: number;
    memory: number;
    entityCount: number;
    drawCalls: number;
    activeBreakpoints: number;
    activeWatches: number;
    errors: number;
    warnings: number;
}

const DEFAULT_CONFIG: DebugManagerConfig = {
    enabled: true,
    showOverlay: false,
    showConsole: false,
    enableBreakpoints: true,
    enableWatches: true,
    enableCallStack: true,
    enableTimeline: true,
    enableErrorTracking: true,
    autoStartRecording: false,
    keyboardShortcuts: true
};

export class DebugManager {
    private config: DebugManagerConfig;
    private frameNumber: number = 0;
    private _engineRef: unknown = null;
    private _sceneRef: unknown = null;
    private initialized: boolean = false;

    // Sub-systems (expose for direct access)
    public readonly breakpoints: BreakpointManager = breakpointManager;
    public readonly watches: WatchSystem = watchSystem;
    public readonly callStack: CallStackTracker = callStackTracker;
    public readonly inspector: StateInspector = stateInspector;
    public readonly timeline: TimelineProfiler = timelineProfiler;
    public readonly overlay: DebugOverlay = debugOverlay;
    public readonly errors: ErrorTracker = errorTracker;
    public readonly console: DebugConsole = debugConsole;
    public readonly draw: DebugDraw = debugDraw;

    /** Get the engine reference */
    get engine(): unknown { return this._engineRef; }
    
    /** Get the scene reference */
    get scene(): unknown { return this._sceneRef; }

    constructor(config: Partial<DebugManagerConfig> = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    /**
     * Initialize the debug manager
     */
    initialize(engine?: unknown, scene?: unknown): void {
        if (this.initialized) return;

        this._engineRef = engine;
        this._sceneRef = scene;

        // Wire up references
        this.console.engineRef = engine;
        this.console.sceneRef = scene;
        this.console.debugManagerRef = this;

        // Register debug console commands
        this.registerDebugCommands();

        // Set up keyboard shortcuts
        if (this.config.keyboardShortcuts) {
            this.setupKeyboardShortcuts();
        }

        // Start timeline if configured
        if (this.config.autoStartRecording) {
            this.timeline.startRecording();
        }

        // Show UI if configured
        if (this.config.showOverlay) {
            this.overlay.show();
        }

        if (this.config.showConsole) {
            this.console.show();
        }

        this.initialized = true;
        console.log('[WebForge Debug] Initialized');
    }

    /**
     * Shutdown the debug manager
     */
    shutdown(): void {
        this.overlay.hide();
        this.console.hide();
        this.timeline.stopRecording();
        this.watches.stopAutoUpdate();
        
        this.initialized = false;
    }

    /**
     * Call at the start of each frame
     */
    beginFrame(): void {
        if (!this.config.enabled) return;

        this.frameNumber++;
        
        // Sync frame numbers
        this.breakpoints.nextFrame();
        this.callStack.setFrameNumber(this.frameNumber);
        this.errors.setFrameNumber(this.frameNumber);

        // Start timeline frame
        if (this.timeline.isRecording()) {
            this.timeline.beginFrame();
        }

        // Update watches
        this.watches.update(this.frameNumber);

        // Update debug draw
        this.draw.update();
    }

    /**
     * Call at the end of each frame
     */
    endFrame(): void {
        if (!this.config.enabled) return;

        // End timeline frame
        if (this.timeline.isRecording()) {
            this.timeline.endFrame();
        }

        // Update inspector
        this.inspector.updateAll(this.frameNumber);
    }

    /**
     * Create a breakpoint
     */
    break(name: string, condition?: (ctx: DebugContext) => boolean): BreakpointInfo {
        if (condition) {
            return this.breakpoints.createConditionalBreakpoint(
                name,
                'custom condition',
                condition
            );
        }
        return this.breakpoints.createBreakpoint(name);
    }

    /**
     * Hit a breakpoint (call from instrumented code)
     */
    async hitBreakpoint(breakpointId: string, locals?: Record<string, unknown>): Promise<void> {
        if (!this.config.enableBreakpoints) return;

        const context: Partial<DebugContext> = {
            frameNumber: this.frameNumber,
            locals: new Map(Object.entries(locals ?? {}))
        };

        await this.breakpoints.hit(breakpointId, context);
    }

    /**
     * Watch a value
     */
    watch(name: string, getter: () => unknown, breakOnChange: boolean = false): WatchExpression {
        return this.watches.addWatch(name, getter, { breakOnChange });
    }

    /**
     * Watch object properties
     */
    watchObject(obj: object, name: string, depth: number = 2): void {
        this.watches.addObjectWatch(obj, name, depth);
    }

    /**
     * Inspect an object
     */
    inspect(obj: object, name?: string): InspectedObject {
        return this.inspector.inspect(obj, name);
    }

    /**
     * Track a function call
     */
    trackCall<T>(name: string, fn: () => T): T {
        const frame = this.callStack.enter(name);
        try {
            const result = fn();
            this.callStack.exit(frame, result);
            return result;
        } catch (error) {
            this.callStack.recordError(error instanceof Error ? error : new Error(String(error)), frame);
            this.callStack.exit(frame);
            throw error;
        }
    }

    /**
     * Track an async function call
     */
    async trackCallAsync<T>(name: string, fn: () => Promise<T>): Promise<T> {
        const frame = this.callStack.enter(name, [], { isAsync: true });
        try {
            const result = await fn();
            this.callStack.exit(frame, result);
            return result;
        } catch (error) {
            this.callStack.recordError(error instanceof Error ? error : new Error(String(error)), frame);
            this.callStack.exit(frame);
            throw error;
        }
    }

    /**
     * Profile a code section
     */
    profile<T>(name: string, fn: () => T, category: 'script' | 'render' | 'physics' | 'animation' = 'script'): T {
        return this.timeline.measure(name, fn, category);
    }

    /**
     * Profile an async code section
     */
    async profileAsync<T>(name: string, fn: () => Promise<T>, category: 'script' | 'render' | 'physics' | 'animation' = 'script'): Promise<T> {
        return this.timeline.measureAsync(name, fn, category);
    }

    /**
     * Add a timeline marker
     */
    marker(name: string, type: 'event' | 'warning' | 'error' = 'event'): void {
        this.timeline.addMarker(name, type);
    }

    /**
     * Log an error
     */
    error(error: Error | string, context?: Record<string, unknown>): TrackedError {
        return this.errors.track(
            typeof error === 'string' ? new Error(error) : error,
            { customData: context }
        );
    }

    /**
     * Log a warning
     */
    warn(message: string, context?: Record<string, unknown>): void {
        this.errors.track(new Error(message), { customData: context }, { severity: 'low', tags: ['warning'] });
    }

    /**
     * Assert a condition
     */
    assert(condition: boolean, message: string): void {
        if (!condition) {
            this.errors.track(new Error(`Assertion failed: ${message}`), {}, { severity: 'high', tags: ['assertion'] });
            if (this.config.enableBreakpoints) {
                this.breakpoints.requestPause();
            }
        }
    }

    /**
     * Get a debug snapshot
     */
    getSnapshot(): DebugSnapshot {
        const stats = this.errors.getStats();
        const timelineStats = this.timeline.getStats();

        return {
            timestamp: Date.now(),
            frameNumber: this.frameNumber,
            fps: timelineStats.averageFPS,
            memory: this.getMemoryUsage(),
            entityCount: this.overlay.entityCountGetter(),
            drawCalls: this.overlay.drawCallsGetter(),
            activeBreakpoints: this.breakpoints.getBreakpoints().filter(b => b.enabled).length,
            activeWatches: this.watches.getAllWatches().filter(w => w.enabled).length,
            errors: stats.bySeverity.high + stats.bySeverity.critical,
            warnings: stats.bySeverity.low + stats.bySeverity.medium
        };
    }

    /**
     * Get timeline statistics
     */
    getTimelineStats(): TimelineStats {
        return this.timeline.getStats();
    }

    /**
     * Start timeline recording
     */
    startRecording(): void {
        this.timeline.startRecording();
    }

    /**
     * Stop timeline recording
     */
    stopRecording(): void {
        this.timeline.stopRecording();
    }

    /**
     * Export debug data
     */
    exportData(): string {
        return JSON.stringify({
            snapshot: this.getSnapshot(),
            errors: this.errors.exportJSON(),
            timeline: this.timeline.exportJSON(),
            watches: this.watches.exportData(),
            callStackProfiles: this.callStack.getAllProfiles()
        }, null, 2);
    }

    /**
     * Export Chrome trace format
     */
    exportChromeTrace(): string {
        return this.timeline.exportChromeTrace();
    }

    /**
     * Show the debug overlay
     */
    showOverlay(): void {
        this.overlay.show();
    }

    /**
     * Hide the debug overlay
     */
    hideOverlay(): void {
        this.overlay.hide();
    }

    /**
     * Toggle the debug overlay
     */
    toggleOverlay(): void {
        this.overlay.toggle();
    }

    /**
     * Show the debug console
     */
    showConsole(): void {
        this.console.show();
    }

    /**
     * Hide the debug console
     */
    hideConsole(): void {
        this.console.hide();
    }

    /**
     * Toggle the debug console
     */
    toggleConsole(): void {
        this.console.toggle();
    }

    /**
     * Register a custom console command
     */
    registerCommand(command: Command): void {
        this.console.registerCommand(command);
    }

    /**
     * Enable/disable debugging
     */
    setEnabled(enabled: boolean): void {
        this.config.enabled = enabled;
        this.breakpoints.setEnabled(enabled);
        this.watches.setEnabled(enabled);
        this.callStack.setEnabled(enabled);
        this.errors.setEnabled(enabled);
        this.draw.setEnabled(enabled);

        if (!enabled) {
            this.overlay.hide();
            this.console.hide();
        }
    }

    /**
     * Check if debugging is enabled
     */
    isEnabled(): boolean {
        return this.config.enabled;
    }

    /**
     * Get configuration
     */
    getConfig(): DebugManagerConfig {
        return { ...this.config };
    }

    /**
     * Update configuration
     */
    setConfig(config: Partial<DebugManagerConfig>): void {
        this.config = { ...this.config, ...config };
    }

    private getMemoryUsage(): number {
        if ('memory' in performance) {
            const memory = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory;
            return (memory?.usedJSHeapSize ?? 0) / (1024 * 1024);
        }
        return 0;
    }

    private setupKeyboardShortcuts(): void {
        document.addEventListener('keydown', (e) => {
            // F12 or Ctrl+Shift+D - Toggle debug panel
            if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && e.key === 'D')) {
                e.preventDefault();
                this.toggleOverlay();
            }

            // ` (backtick) - Toggle debug overlay
            if (e.key === '`' && !e.ctrlKey && !e.altKey) {
                // Let overlay handle this
            }

            // ~ (tilde) or Ctrl+` - Toggle console
            if (e.key === '~' || (e.ctrlKey && e.key === '`')) {
                e.preventDefault();
                this.toggleConsole();
            }

            // F5 - Continue (if paused)
            if (e.key === 'F5' && this.breakpoints.paused) {
                e.preventDefault();
                this.breakpoints.continue();
            }

            // F10 - Step over
            if (e.key === 'F10' && this.breakpoints.paused) {
                e.preventDefault();
                this.breakpoints.stepOver();
            }

            // F11 - Step into
            if (e.key === 'F11' && this.breakpoints.paused) {
                e.preventDefault();
                this.breakpoints.stepInto();
            }

            // Shift+F11 - Step out
            if (e.key === 'F11' && e.shiftKey && this.breakpoints.paused) {
                e.preventDefault();
                this.breakpoints.stepOut();
            }

            // Ctrl+Shift+P - Pause
            if (e.ctrlKey && e.shiftKey && e.key === 'P') {
                e.preventDefault();
                this.breakpoints.requestPause();
            }

            // Ctrl+Shift+R - Toggle recording
            if (e.ctrlKey && e.shiftKey && e.key === 'R') {
                e.preventDefault();
                if (this.timeline.isRecording()) {
                    this.stopRecording();
                    console.log('[WebForge Debug] Recording stopped');
                } else {
                    this.startRecording();
                    console.log('[WebForge Debug] Recording started');
                }
            }
        });
    }

    private registerDebugCommands(): void {
        // Breakpoint commands
        this.console.registerCommand({
            name: 'breakpoints',
            description: 'List all breakpoints',
            aliases: ['bp'],
            execute: () => {
                const bps = this.breakpoints.getBreakpoints();
                if (bps.length === 0) {
                    return { success: true, output: 'No breakpoints set' };
                }
                const lines = bps.map(bp => 
                    `${bp.enabled ? '●' : '○'} ${bp.id}: ${bp.name} (hits: ${bp.hitCount})`
                );
                return { success: true, output: lines.join('\n') };
            }
        });

        // Continue command
        this.console.registerCommand({
            name: 'continue',
            description: 'Continue execution (F5)',
            aliases: ['c', 'run'],
            execute: () => {
                if (this.breakpoints.paused) {
                    this.breakpoints.continue();
                    return { success: true, output: 'Continuing...' };
                }
                return { success: true, output: 'Not paused' };
            }
        });

        // Step commands
        this.console.registerCommand({
            name: 'step',
            description: 'Step over (F10)',
            aliases: ['n', 'next'],
            execute: () => {
                if (this.breakpoints.paused) {
                    this.breakpoints.stepOver();
                    return { success: true, output: 'Stepping over...' };
                }
                return { success: true, output: 'Not paused' };
            }
        });

        // Watch commands
        this.console.registerCommand({
            name: 'watches',
            description: 'List all watches',
            aliases: ['w'],
            execute: () => {
                const watches = this.watches.getAllWatches();
                if (watches.length === 0) {
                    return { success: true, output: 'No watches set' };
                }
                const lines = watches.map(w => 
                    `${w.enabled ? '●' : '○'} ${w.name}: ${w.currentValue} (changes: ${w.changeCount})`
                );
                return { success: true, output: lines.join('\n') };
            }
        });

        // Stack command
        this.console.registerCommand({
            name: 'stack',
            description: 'Show call stack',
            aliases: ['bt', 'backtrace'],
            execute: () => {
                const stack = this.callStack.getStack();
                if (stack.length === 0) {
                    return { success: true, output: 'Call stack is empty' };
                }
                return { success: true, output: this.callStack.formatStackTrace(stack) };
            }
        });

        // Profile command
        this.console.registerCommand({
            name: 'profile',
            description: 'Show hot functions',
            execute: () => {
                const profiles = this.callStack.getHotFunctions(10);
                if (profiles.length === 0) {
                    return { success: true, output: 'No profiling data' };
                }
                const lines = profiles.map(p => 
                    `${p.name}: ${p.totalTime.toFixed(2)}ms (${p.callCount} calls, avg ${p.averageTime.toFixed(2)}ms)`
                );
                return { success: true, output: lines.join('\n') };
            }
        });

        // Stats command
        this.console.registerCommand({
            name: 'stats',
            description: 'Show debug statistics',
            execute: () => {
                const snapshot = this.getSnapshot();
                const lines = [
                    `Frame: ${snapshot.frameNumber}`,
                    `FPS: ${snapshot.fps.toFixed(1)}`,
                    `Memory: ${snapshot.memory.toFixed(1)} MB`,
                    `Entities: ${snapshot.entityCount}`,
                    `Draw Calls: ${snapshot.drawCalls}`,
                    `Errors: ${snapshot.errors}`,
                    `Warnings: ${snapshot.warnings}`
                ];
                return { success: true, output: lines.join('\n') };
            }
        });

        // Recording commands
        this.console.registerCommand({
            name: 'record',
            description: 'Start/stop timeline recording',
            execute: (args) => {
                if (args[0] === 'stop') {
                    this.stopRecording();
                    return { success: true, output: 'Recording stopped' };
                } else if (args[0] === 'start' || args.length === 0) {
                    this.startRecording();
                    return { success: true, output: 'Recording started' };
                } else if (args[0] === 'export') {
                    const trace = this.exportChromeTrace();
                    console.log(trace);
                    return { success: true, output: 'Chrome trace exported to console (copy and load in chrome://tracing)' };
                }
                return { success: false, error: 'Usage: record [start|stop|export]' };
            }
        });

        // Errors command
        this.console.registerCommand({
            name: 'errors',
            description: 'Show recent errors',
            execute: () => {
                const errors = this.errors.getErrors().slice(0, 10);
                if (errors.length === 0) {
                    return { success: true, output: 'No errors tracked' };
                }
                const lines = errors.map(e => 
                    `[${e.severity}] ${e.type}: ${e.message} (${e.count}x)`
                );
                return { success: true, output: lines.join('\n') };
            }
        });

        // Overlay command
        this.console.registerCommand({
            name: 'overlay',
            description: 'Toggle debug overlay',
            execute: () => {
                this.toggleOverlay();
                return { success: true, output: `Overlay ${this.overlay.isVisible() ? 'shown' : 'hidden'}` };
            }
        });
    }
}

// Global instance
export const debugManager = new DebugManager();

// Convenience exports
export {
    breakpointManager,
    watchSystem,
    callStackTracker,
    stateInspector,
    timelineProfiler,
    debugOverlay,
    errorTracker,
    debugConsole,
    debugDraw
};
