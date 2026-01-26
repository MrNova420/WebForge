/**
 * WebForge Professional Debugger - Call Stack System
 * 
 * Track and visualize execution flow, function calls,
 * and provide stack trace analysis.
 */

export interface StackFrame {
    id: string;
    functionName: string;
    fileName?: string;
    lineNumber?: number;
    columnNumber?: number;
    arguments: unknown[];
    returnValue?: unknown;
    locals: Map<string, unknown>;
    thisContext?: unknown;
    startTime: number;
    endTime?: number;
    duration?: number;
    children: StackFrame[];
    parent?: StackFrame;
    isAsync: boolean;
    error?: Error;
}

export interface CallStackSnapshot {
    timestamp: number;
    frameNumber: number;
    frames: StackFrame[];
    depth: number;
    totalCalls: number;
}

export interface FunctionProfile {
    name: string;
    callCount: number;
    totalTime: number;
    selfTime: number;
    averageTime: number;
    minTime: number;
    maxTime: number;
    errors: number;
}

export type StackEventCallback = (event: StackEvent) => void;

export interface StackEvent {
    type: 'enter' | 'exit' | 'error' | 'async-start' | 'async-end';
    frame: StackFrame;
    timestamp: number;
}

export class CallStackTracker {
    private rootFrames: StackFrame[] = [];
    private activeFrames: StackFrame[] = [];
    private frameIdCounter: number = 0;
    private functionProfiles: Map<string, FunctionProfile> = new Map();
    private eventCallbacks: Set<StackEventCallback> = new Set();
    private maxDepth: number = 100;
    private maxHistory: number = 1000;
    private enabled: boolean = true;
    private snapshots: CallStackSnapshot[] = [];
    private frameNumber: number = 0;

    /**
     * Enter a function (push onto stack)
     */
    enter(
        functionName: string,
        args: unknown[] = [],
        options: {
            fileName?: string;
            lineNumber?: number;
            thisContext?: unknown;
            isAsync?: boolean;
        } = {}
    ): StackFrame {
        if (!this.enabled) {
            return this.createDummyFrame(functionName);
        }

        const frame: StackFrame = {
            id: `frame_${++this.frameIdCounter}`,
            functionName,
            arguments: args,
            locals: new Map(),
            startTime: performance.now(),
            children: [],
            isAsync: options.isAsync ?? false,
            fileName: options.fileName,
            lineNumber: options.lineNumber,
            thisContext: options.thisContext
        };

        // Link to parent
        if (this.activeFrames.length > 0) {
            const parent = this.activeFrames[this.activeFrames.length - 1];
            frame.parent = parent;
            parent.children.push(frame);
        } else {
            this.rootFrames.push(frame);
            this.trimHistory();
        }

        // Check max depth
        if (this.activeFrames.length < this.maxDepth) {
            this.activeFrames.push(frame);
        }

        this.emitEvent({ type: 'enter', frame, timestamp: Date.now() });

        return frame;
    }

    /**
     * Exit a function (pop from stack)
     */
    exit(frame: StackFrame, returnValue?: unknown): void {
        if (!this.enabled) return;

        frame.endTime = performance.now();
        frame.duration = frame.endTime - frame.startTime;
        frame.returnValue = returnValue;

        // Remove from active frames
        const index = this.activeFrames.indexOf(frame);
        if (index !== -1) {
            this.activeFrames.splice(index, 1);
        }

        // Update function profile
        this.updateProfile(frame);

        this.emitEvent({ type: 'exit', frame, timestamp: Date.now() });
    }

    /**
     * Record an error in current frame
     */
    recordError(error: Error, frame?: StackFrame): void {
        if (!this.enabled) return;

        const targetFrame = frame ?? this.activeFrames[this.activeFrames.length - 1];
        if (targetFrame) {
            targetFrame.error = error;
            
            // Update profile error count
            const profile = this.functionProfiles.get(targetFrame.functionName);
            if (profile) {
                profile.errors++;
            }

            this.emitEvent({ type: 'error', frame: targetFrame, timestamp: Date.now() });
        }
    }

    /**
     * Set a local variable in current frame
     */
    setLocal(name: string, value: unknown, frame?: StackFrame): void {
        if (!this.enabled) return;

        const targetFrame = frame ?? this.activeFrames[this.activeFrames.length - 1];
        if (targetFrame) {
            targetFrame.locals.set(name, value);
        }
    }

    /**
     * Get current call stack
     */
    getStack(): StackFrame[] {
        return [...this.activeFrames];
    }

    /**
     * Get current stack depth
     */
    getDepth(): number {
        return this.activeFrames.length;
    }

    /**
     * Get current frame (top of stack)
     */
    getCurrentFrame(): StackFrame | null {
        return this.activeFrames[this.activeFrames.length - 1] ?? null;
    }

    /**
     * Get parent frame
     */
    getParentFrame(frame?: StackFrame): StackFrame | null {
        const targetFrame = frame ?? this.getCurrentFrame();
        return targetFrame?.parent ?? null;
    }

    /**
     * Get function profile
     */
    getProfile(functionName: string): FunctionProfile | undefined {
        return this.functionProfiles.get(functionName);
    }

    /**
     * Get all function profiles
     */
    getAllProfiles(): FunctionProfile[] {
        return Array.from(this.functionProfiles.values());
    }

    /**
     * Get profiles sorted by total time
     */
    getHotFunctions(limit: number = 10): FunctionProfile[] {
        return this.getAllProfiles()
            .sort((a, b) => b.totalTime - a.totalTime)
            .slice(0, limit);
    }

    /**
     * Get functions with errors
     */
    getErrorFunctions(): FunctionProfile[] {
        return this.getAllProfiles().filter(p => p.errors > 0);
    }

    /**
     * Take a snapshot of current call stack
     */
    takeSnapshot(): CallStackSnapshot {
        const snapshot: CallStackSnapshot = {
            timestamp: Date.now(),
            frameNumber: this.frameNumber,
            frames: this.activeFrames.map(f => this.cloneFrame(f)),
            depth: this.activeFrames.length,
            totalCalls: this.frameIdCounter
        };

        this.snapshots.push(snapshot);
        if (this.snapshots.length > 100) {
            this.snapshots.shift();
        }

        return snapshot;
    }

    /**
     * Get all snapshots
     */
    getSnapshots(): CallStackSnapshot[] {
        return [...this.snapshots];
    }

    /**
     * Get root frames (call trees)
     */
    getRootFrames(): StackFrame[] {
        return [...this.rootFrames];
    }

    /**
     * Format stack trace as string
     */
    formatStackTrace(frames?: StackFrame[]): string {
        const stack = frames ?? this.activeFrames;
        return stack
            .map((frame, index) => {
                const indent = '  '.repeat(index);
                const location = frame.fileName && frame.lineNumber
                    ? ` (${frame.fileName}:${frame.lineNumber})`
                    : '';
                const duration = frame.duration !== undefined
                    ? ` [${frame.duration.toFixed(2)}ms]`
                    : '';
                return `${indent}at ${frame.functionName}${location}${duration}`;
            })
            .join('\n');
    }

    /**
     * Register callback for stack events
     */
    onStackEvent(callback: StackEventCallback): () => void {
        this.eventCallbacks.add(callback);
        return () => this.eventCallbacks.delete(callback);
    }

    /**
     * Wrap a function to automatically track calls
     */
    wrap<T extends (...args: unknown[]) => unknown>(
        fn: T,
        name?: string
    ): T {
        const tracker = this;
        const fnName = name ?? fn.name ?? '<anonymous>';

        const wrapped = function(this: unknown, ...args: unknown[]): unknown {
            const frame = tracker.enter(fnName, args, {
                thisContext: this
            });

            try {
                const result = fn.apply(this, args);

                // Handle promises
                if (result instanceof Promise) {
                    return result
                        .then((value) => {
                            tracker.exit(frame, value);
                            return value;
                        })
                        .catch((error) => {
                            tracker.recordError(error, frame);
                            tracker.exit(frame);
                            throw error;
                        });
                }

                tracker.exit(frame, result);
                return result;
            } catch (error) {
                tracker.recordError(error instanceof Error ? error : new Error(String(error)), frame);
                tracker.exit(frame);
                throw error;
            }
        } as T;

        return wrapped;
    }

    /**
     * Set frame number (for correlation with game loop)
     */
    setFrameNumber(num: number): void {
        this.frameNumber = num;
    }

    /**
     * Enable/disable tracking
     */
    setEnabled(enabled: boolean): void {
        this.enabled = enabled;
    }

    /**
     * Clear all data
     */
    clear(): void {
        this.rootFrames = [];
        this.activeFrames = [];
        this.functionProfiles.clear();
        this.snapshots = [];
        this.frameIdCounter = 0;
    }

    /**
     * Reset profiles only
     */
    resetProfiles(): void {
        this.functionProfiles.clear();
    }

    private createDummyFrame(functionName: string): StackFrame {
        return {
            id: 'dummy',
            functionName,
            arguments: [],
            locals: new Map(),
            startTime: 0,
            children: [],
            isAsync: false
        };
    }

    private updateProfile(frame: StackFrame): void {
        let profile = this.functionProfiles.get(frame.functionName);

        if (!profile) {
            profile = {
                name: frame.functionName,
                callCount: 0,
                totalTime: 0,
                selfTime: 0,
                averageTime: 0,
                minTime: Infinity,
                maxTime: 0,
                errors: 0
            };
            this.functionProfiles.set(frame.functionName, profile);
        }

        const duration = frame.duration ?? 0;
        const childTime = frame.children.reduce((sum, c) => sum + (c.duration ?? 0), 0);

        profile.callCount++;
        profile.totalTime += duration;
        profile.selfTime += duration - childTime;
        profile.averageTime = profile.totalTime / profile.callCount;
        profile.minTime = Math.min(profile.minTime, duration);
        profile.maxTime = Math.max(profile.maxTime, duration);
    }

    private cloneFrame(frame: StackFrame): StackFrame {
        return {
            ...frame,
            locals: new Map(frame.locals),
            children: [],
            parent: undefined
        };
    }

    private trimHistory(): void {
        while (this.rootFrames.length > this.maxHistory) {
            this.rootFrames.shift();
        }
    }

    private emitEvent(event: StackEvent): void {
        for (const callback of this.eventCallbacks) {
            try {
                callback(event);
            } catch (e) {
                console.error('Stack event callback error:', e);
            }
        }
    }
}

// Global instance
export const callStackTracker = new CallStackTracker();

/**
 * Decorator for automatic function tracking
 */
export function traced(
    _target: object,
    propertyKey: string,
    descriptor: PropertyDescriptor
): PropertyDescriptor {
    const originalMethod = descriptor.value;

    descriptor.value = function(...args: unknown[]): unknown {
        const frame = callStackTracker.enter(propertyKey, args, {
            thisContext: this
        });

        try {
            const result = originalMethod.apply(this, args);

            if (result instanceof Promise) {
                return result
                    .then((value) => {
                        callStackTracker.exit(frame, value);
                        return value;
                    })
                    .catch((error) => {
                        callStackTracker.recordError(error, frame);
                        callStackTracker.exit(frame);
                        throw error;
                    });
            }

            callStackTracker.exit(frame, result);
            return result;
        } catch (error) {
            callStackTracker.recordError(
                error instanceof Error ? error : new Error(String(error)),
                frame
            );
            callStackTracker.exit(frame);
            throw error;
        }
    };

    return descriptor;
}
