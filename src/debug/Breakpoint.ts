/**
 * WebForge Professional Debugger - Breakpoint System
 * 
 * Provides breakpoint functionality for pausing execution,
 * inspecting state, and stepping through code.
 */

export interface BreakpointCondition {
    expression: string;
    evaluate: (context: DebugContext) => boolean;
}

export interface BreakpointInfo {
    id: string;
    name: string;
    enabled: boolean;
    hitCount: number;
    condition?: BreakpointCondition;
    logMessage?: string;
    location?: {
        file?: string;
        line?: number;
        function?: string;
    };
    createdAt: number;
    lastHit?: number;
}

export interface DebugContext {
    timestamp: number;
    frameNumber: number;
    deltaTime: number;
    locals: Map<string, unknown>;
    callStack: CallFrame[];
    watchedVariables: Map<string, unknown>;
    memorySnapshot?: MemorySnapshot;
}

export interface CallFrame {
    functionName: string;
    fileName?: string;
    lineNumber?: number;
    columnNumber?: number;
    locals: Record<string, unknown>;
    thisArg?: unknown;
}

export interface MemorySnapshot {
    usedJSHeapSize: number;
    totalJSHeapSize: number;
    jsHeapSizeLimit: number;
    timestamp: number;
}

export type BreakpointCallback = (
    breakpoint: BreakpointInfo,
    context: DebugContext
) => void | Promise<void>;

export type StepMode = 'continue' | 'step-over' | 'step-into' | 'step-out' | 'pause';

export class BreakpointManager {
    private breakpoints: Map<string, BreakpointInfo> = new Map();
    private callbacks: Set<BreakpointCallback> = new Set();
    private isPaused: boolean = false;
    private currentContext: DebugContext | null = null;
    private stepMode: StepMode = 'continue';
    private stepDepth: number = 0;
    private frameNumber: number = 0;
    private pausePromiseResolve: (() => void) | null = null;
    private enabled: boolean = true;

    /**
     * Create a new breakpoint
     */
    createBreakpoint(
        name: string,
        options: Partial<BreakpointInfo> = {}
    ): BreakpointInfo {
        const id = `bp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const breakpoint: BreakpointInfo = {
            id,
            name,
            enabled: true,
            hitCount: 0,
            createdAt: Date.now(),
            ...options
        };
        this.breakpoints.set(id, breakpoint);
        return breakpoint;
    }

    /**
     * Create a conditional breakpoint
     */
    createConditionalBreakpoint(
        name: string,
        conditionExpr: string,
        evaluator: (context: DebugContext) => boolean
    ): BreakpointInfo {
        return this.createBreakpoint(name, {
            condition: {
                expression: conditionExpr,
                evaluate: evaluator
            }
        });
    }

    /**
     * Create a logpoint (breakpoint that logs instead of pausing)
     */
    createLogpoint(name: string, message: string): BreakpointInfo {
        return this.createBreakpoint(name, {
            logMessage: message
        });
    }

    /**
     * Remove a breakpoint
     */
    removeBreakpoint(id: string): boolean {
        return this.breakpoints.delete(id);
    }

    /**
     * Enable/disable a breakpoint
     */
    setBreakpointEnabled(id: string, enabled: boolean): void {
        const bp = this.breakpoints.get(id);
        if (bp) {
            bp.enabled = enabled;
        }
    }

    /**
     * Get all breakpoints
     */
    getBreakpoints(): BreakpointInfo[] {
        return Array.from(this.breakpoints.values());
    }

    /**
     * Get breakpoint by ID
     */
    getBreakpoint(id: string): BreakpointInfo | undefined {
        return this.breakpoints.get(id);
    }

    /**
     * Register callback for breakpoint hits
     */
    onBreakpointHit(callback: BreakpointCallback): () => void {
        this.callbacks.add(callback);
        return () => this.callbacks.delete(callback);
    }

    /**
     * Check if currently paused
     */
    get paused(): boolean {
        return this.isPaused;
    }

    /**
     * Get current debug context (when paused)
     */
    getContext(): DebugContext | null {
        return this.currentContext;
    }

    /**
     * Enable/disable the breakpoint system
     */
    setEnabled(enabled: boolean): void {
        this.enabled = enabled;
        if (!enabled && this.isPaused) {
            this.continue();
        }
    }

    /**
     * Hit a breakpoint - call this from instrumented code
     * Returns a promise that resolves when execution should continue
     */
    async hit(
        breakpointId: string,
        context: Partial<DebugContext> = {}
    ): Promise<void> {
        if (!this.enabled) return;

        const breakpoint = this.breakpoints.get(breakpointId);
        if (!breakpoint || !breakpoint.enabled) return;

        // Check condition if present
        const fullContext = this.buildContext(context);
        if (breakpoint.condition) {
            try {
                if (!breakpoint.condition.evaluate(fullContext)) {
                    return;
                }
            } catch (e) {
                console.warn(`Breakpoint condition error: ${e}`);
                return;
            }
        }

        // Update hit info
        breakpoint.hitCount++;
        breakpoint.lastHit = Date.now();

        // If it's a logpoint, just log and continue
        if (breakpoint.logMessage) {
            const message = this.interpolateLogMessage(breakpoint.logMessage, fullContext);
            console.log(`[Logpoint: ${breakpoint.name}] ${message}`);
            return;
        }

        // Pause execution
        await this.pauseExecution(breakpoint, fullContext);
    }

    /**
     * Manual pause (like clicking pause in a debugger)
     */
    async pause(context: Partial<DebugContext> = {}): Promise<void> {
        if (!this.enabled || this.isPaused) return;

        const fullContext = this.buildContext(context);
        const manualBreakpoint: BreakpointInfo = {
            id: 'manual_pause',
            name: 'Manual Pause',
            enabled: true,
            hitCount: 1,
            createdAt: Date.now(),
            lastHit: Date.now()
        };

        await this.pauseExecution(manualBreakpoint, fullContext);
    }

    /**
     * Check if we should pause for stepping
     */
    async checkStep(
        depth: number,
        context: Partial<DebugContext> = {}
    ): Promise<void> {
        if (!this.enabled) return;

        let shouldPause = false;

        switch (this.stepMode) {
            case 'step-over':
                shouldPause = depth <= this.stepDepth;
                break;
            case 'step-into':
                shouldPause = true;
                break;
            case 'step-out':
                shouldPause = depth < this.stepDepth;
                break;
            case 'pause':
                shouldPause = true;
                this.stepMode = 'continue';
                break;
        }

        if (shouldPause) {
            this.stepMode = 'continue';
            await this.pause(context);
        }
    }

    /**
     * Continue execution
     */
    continue(): void {
        this.stepMode = 'continue';
        this.resume();
    }

    /**
     * Step over (execute current line, pause at next)
     */
    stepOver(): void {
        this.stepMode = 'step-over';
        this.stepDepth = this.currentContext?.callStack.length ?? 0;
        this.resume();
    }

    /**
     * Step into (enter function calls)
     */
    stepInto(): void {
        this.stepMode = 'step-into';
        this.resume();
    }

    /**
     * Step out (finish current function)
     */
    stepOut(): void {
        this.stepMode = 'step-out';
        this.stepDepth = this.currentContext?.callStack.length ?? 0;
        this.resume();
    }

    /**
     * Request pause at next opportunity
     */
    requestPause(): void {
        this.stepMode = 'pause';
    }

    /**
     * Clear all breakpoints
     */
    clearAll(): void {
        this.breakpoints.clear();
        if (this.isPaused) {
            this.continue();
        }
    }

    /**
     * Get frame number
     */
    getFrameNumber(): number {
        return this.frameNumber;
    }

    /**
     * Increment frame (call each game loop iteration)
     */
    nextFrame(): void {
        this.frameNumber++;
    }

    private async pauseExecution(
        breakpoint: BreakpointInfo,
        context: DebugContext
    ): Promise<void> {
        this.isPaused = true;
        this.currentContext = context;

        // Notify callbacks
        for (const callback of this.callbacks) {
            try {
                await callback(breakpoint, context);
            } catch (e) {
                console.error('Breakpoint callback error:', e);
            }
        }

        // Wait for resume
        await new Promise<void>((resolve) => {
            this.pausePromiseResolve = resolve;
        });
    }

    private resume(): void {
        this.isPaused = false;
        this.currentContext = null;
        if (this.pausePromiseResolve) {
            this.pausePromiseResolve();
            this.pausePromiseResolve = null;
        }
    }

    private buildContext(partial: Partial<DebugContext>): DebugContext {
        const stack = this.captureCallStack();
        
        return {
            timestamp: Date.now(),
            frameNumber: this.frameNumber,
            deltaTime: 0,
            locals: new Map(),
            callStack: stack,
            watchedVariables: new Map(),
            ...partial
        };
    }

    private captureCallStack(): CallFrame[] {
        const stack: CallFrame[] = [];
        const error = new Error();
        const lines = error.stack?.split('\n').slice(3) ?? [];

        for (const line of lines) {
            const match = line.match(/at\s+(?:(.+?)\s+\()?(.+?):(\d+):(\d+)\)?/);
            if (match) {
                stack.push({
                    functionName: match[1] || '<anonymous>',
                    fileName: match[2],
                    lineNumber: parseInt(match[3], 10),
                    columnNumber: parseInt(match[4], 10),
                    locals: {}
                });
            }
        }

        return stack;
    }

    private interpolateLogMessage(message: string, context: DebugContext): string {
        return message.replace(/\{(\w+)\}/g, (_, key) => {
            if (context.locals.has(key)) {
                return String(context.locals.get(key));
            }
            if (context.watchedVariables.has(key)) {
                return String(context.watchedVariables.get(key));
            }
            return `{${key}}`;
        });
    }
}

// Global instance
export const breakpointManager = new BreakpointManager();
