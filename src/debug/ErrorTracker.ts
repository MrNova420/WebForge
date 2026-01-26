/**
 * WebForge Professional Debugger - Error Tracker
 * 
 * Comprehensive error catching, reporting, and analysis
 * with context preservation and error grouping.
 */

export interface TrackedError {
    id: string;
    error: Error;
    message: string;
    stack: string;
    type: string;
    timestamp: number;
    frameNumber: number;
    context: ErrorContext;
    count: number;
    firstSeen: number;
    lastSeen: number;
    handled: boolean;
    severity: 'low' | 'medium' | 'high' | 'critical';
    tags: string[];
}

export interface ErrorContext {
    url?: string;
    userAgent?: string;
    viewport?: { width: number; height: number };
    memory?: { used: number; total: number };
    activeScene?: string;
    entityCount?: number;
    customData?: Record<string, unknown>;
    callStack?: string[];
    locals?: Record<string, unknown>;
}

export interface ErrorGroup {
    fingerprint: string;
    message: string;
    type: string;
    errors: TrackedError[];
    count: number;
    firstSeen: number;
    lastSeen: number;
    severity: TrackedError['severity'];
}

export interface ErrorFilter {
    types?: string[];
    severities?: TrackedError['severity'][];
    tags?: string[];
    since?: number;
    until?: number;
    messagePattern?: RegExp;
}

export type ErrorCallback = (error: TrackedError) => void;

export class ErrorTracker {
    private errors: Map<string, TrackedError> = new Map();
    private groups: Map<string, ErrorGroup> = new Map();
    private callbacks: Set<ErrorCallback> = new Set();
    private maxErrors: number = 500;
    private frameNumber: number = 0;
    private enabled: boolean = true;
    private idCounter: number = 0;

    // Context providers
    public sceneGetter: () => string = () => 'Unknown';
    public entityCountGetter: () => number = () => 0;

    constructor() {
        this.installGlobalHandlers();
    }

    /**
     * Track an error manually
     */
    track(
        error: Error | string,
        context: Partial<ErrorContext> = {},
        options: { handled?: boolean; severity?: TrackedError['severity']; tags?: string[] } = {}
    ): TrackedError {
        if (!this.enabled) {
            return this.createDummyError();
        }

        const err = typeof error === 'string' ? new Error(error) : error;
        const tracked = this.createTrackedError(err, context, options);

        // Check for duplicate
        const fingerprint = this.getFingerprint(tracked);
        const existing = this.errors.get(fingerprint);

        if (existing) {
            existing.count++;
            existing.lastSeen = Date.now();
            this.updateGroup(fingerprint, existing);
            this.notifyCallbacks(existing);
            return existing;
        }

        this.errors.set(fingerprint, tracked);
        this.addToGroup(fingerprint, tracked);
        this.trimErrors();
        this.notifyCallbacks(tracked);

        return tracked;
    }

    /**
     * Track an error with try-catch wrapper
     */
    catch<T>(fn: () => T, context?: Partial<ErrorContext>): T | undefined {
        try {
            return fn();
        } catch (error) {
            this.track(error instanceof Error ? error : new Error(String(error)), context, { handled: true });
            return undefined;
        }
    }

    /**
     * Track async errors
     */
    async catchAsync<T>(
        fn: () => Promise<T>,
        context?: Partial<ErrorContext>
    ): Promise<T | undefined> {
        try {
            return await fn();
        } catch (error) {
            this.track(error instanceof Error ? error : new Error(String(error)), context, { handled: true });
            return undefined;
        }
    }

    /**
     * Wrap a function with error tracking
     */
    wrap<T extends (...args: unknown[]) => unknown>(
        fn: T,
        context?: Partial<ErrorContext>
    ): T {
        const tracker = this;

        return function(this: unknown, ...args: unknown[]): unknown {
            try {
                const result = fn.apply(this, args);

                if (result instanceof Promise) {
                    return result.catch((error: unknown) => {
                        tracker.track(
                            error instanceof Error ? error : new Error(String(error)),
                            context,
                            { handled: false }
                        );
                        throw error;
                    });
                }

                return result;
            } catch (error) {
                tracker.track(
                    error instanceof Error ? error : new Error(String(error)),
                    context,
                    { handled: false }
                );
                throw error;
            }
        } as T;
    }

    /**
     * Get all tracked errors
     */
    getErrors(filter?: ErrorFilter): TrackedError[] {
        let errors = Array.from(this.errors.values());

        if (filter) {
            errors = errors.filter(e => {
                if (filter.types && !filter.types.includes(e.type)) return false;
                if (filter.severities && !filter.severities.includes(e.severity)) return false;
                if (filter.tags && !filter.tags.some(t => e.tags.includes(t))) return false;
                if (filter.since && e.lastSeen < filter.since) return false;
                if (filter.until && e.firstSeen > filter.until) return false;
                if (filter.messagePattern && !filter.messagePattern.test(e.message)) return false;
                return true;
            });
        }

        return errors.sort((a, b) => b.lastSeen - a.lastSeen);
    }

    /**
     * Get error groups
     */
    getGroups(): ErrorGroup[] {
        return Array.from(this.groups.values())
            .sort((a, b) => b.count - a.count);
    }

    /**
     * Get error by ID
     */
    getError(id: string): TrackedError | undefined {
        for (const error of this.errors.values()) {
            if (error.id === id) return error;
        }
        return undefined;
    }

    /**
     * Get error statistics
     */
    getStats(): {
        total: number;
        bySeverity: Record<TrackedError['severity'], number>;
        byType: Record<string, number>;
        recentRate: number;
        topErrors: Array<{ message: string; count: number }>;
    } {
        const errors = Array.from(this.errors.values());
        const now = Date.now();
        const recentWindow = 60000; // 1 minute

        const bySeverity: Record<TrackedError['severity'], number> = {
            low: 0,
            medium: 0,
            high: 0,
            critical: 0
        };

        const byType: Record<string, number> = {};

        for (const error of errors) {
            bySeverity[error.severity]++;
            byType[error.type] = (byType[error.type] ?? 0) + 1;
        }

        const recentErrors = errors.filter(e => e.lastSeen > now - recentWindow);
        const recentRate = recentErrors.reduce((sum, e) => sum + e.count, 0) / (recentWindow / 1000);

        const topErrors = this.getGroups()
            .slice(0, 5)
            .map(g => ({ message: g.message, count: g.count }));

        return {
            total: errors.reduce((sum, e) => sum + e.count, 0),
            bySeverity,
            byType,
            recentRate,
            topErrors
        };
    }

    /**
     * Register error callback
     */
    onError(callback: ErrorCallback): () => void {
        this.callbacks.add(callback);
        return () => this.callbacks.delete(callback);
    }

    /**
     * Mark error as resolved
     */
    resolve(id: string): void {
        for (const [fingerprint, error] of this.errors) {
            if (error.id === id) {
                this.errors.delete(fingerprint);
                
                // Update group
                const group = this.groups.get(fingerprint);
                if (group) {
                    group.errors = group.errors.filter(e => e.id !== id);
                    if (group.errors.length === 0) {
                        this.groups.delete(fingerprint);
                    }
                }
                break;
            }
        }
    }

    /**
     * Clear all errors
     */
    clear(): void {
        this.errors.clear();
        this.groups.clear();
    }

    /**
     * Set frame number (for context)
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
     * Export errors as JSON
     */
    exportJSON(): string {
        return JSON.stringify({
            errors: this.getErrors(),
            groups: this.getGroups(),
            stats: this.getStats()
        }, null, 2);
    }

    /**
     * Format error for display
     */
    formatError(error: TrackedError): string {
        const lines = [
            `[${error.severity.toUpperCase()}] ${error.type}: ${error.message}`,
            `  Time: ${new Date(error.timestamp).toISOString()}`,
            `  Count: ${error.count}`,
            `  Frame: ${error.frameNumber}`,
            `  Handled: ${error.handled}`,
            '',
            'Stack Trace:',
            error.stack.split('\n').map(l => `  ${l}`).join('\n')
        ];

        if (error.tags.length > 0) {
            lines.push('', `Tags: ${error.tags.join(', ')}`);
        }

        return lines.join('\n');
    }

    private installGlobalHandlers(): void {
        // Global error handler
        window.addEventListener('error', (event) => {
            this.track(event.error ?? new Error(event.message), {
                url: event.filename,
                customData: {
                    lineno: event.lineno,
                    colno: event.colno
                }
            }, {
                handled: false,
                severity: 'high'
            });
        });

        // Unhandled promise rejection
        window.addEventListener('unhandledrejection', (event) => {
            const error = event.reason instanceof Error
                ? event.reason
                : new Error(String(event.reason));

            this.track(error, {}, {
                handled: false,
                severity: 'high',
                tags: ['unhandled-rejection']
            });
        });
    }

    private createTrackedError(
        error: Error,
        context: Partial<ErrorContext>,
        options: { handled?: boolean; severity?: TrackedError['severity']; tags?: string[] }
    ): TrackedError {
        const now = Date.now();

        return {
            id: `err_${++this.idCounter}`,
            error,
            message: error.message,
            stack: error.stack ?? '',
            type: error.name ?? 'Error',
            timestamp: now,
            frameNumber: this.frameNumber,
            context: this.buildContext(context),
            count: 1,
            firstSeen: now,
            lastSeen: now,
            handled: options.handled ?? false,
            severity: options.severity ?? this.inferSeverity(error),
            tags: options.tags ?? []
        };
    }

    private createDummyError(): TrackedError {
        return {
            id: 'dummy',
            error: new Error('Dummy'),
            message: 'Dummy',
            stack: '',
            type: 'Error',
            timestamp: 0,
            frameNumber: 0,
            context: {},
            count: 0,
            firstSeen: 0,
            lastSeen: 0,
            handled: true,
            severity: 'low',
            tags: []
        };
    }

    private buildContext(partial: Partial<ErrorContext>): ErrorContext {
        return {
            url: window.location.href,
            userAgent: navigator.userAgent,
            viewport: {
                width: window.innerWidth,
                height: window.innerHeight
            },
            memory: this.getMemoryInfo(),
            activeScene: this.sceneGetter(),
            entityCount: this.entityCountGetter(),
            ...partial
        };
    }

    private getMemoryInfo(): { used: number; total: number } | undefined {
        if ('memory' in performance) {
            const memory = (performance as Performance & { memory?: { usedJSHeapSize: number; totalJSHeapSize: number } }).memory;
            if (memory) {
                return {
                    used: memory.usedJSHeapSize,
                    total: memory.totalJSHeapSize
                };
            }
        }
        return undefined;
    }

    private getFingerprint(error: TrackedError): string {
        // Create fingerprint from error type and first stack frame
        const stackLines = error.stack.split('\n');
        const relevantLine = stackLines.find(l => l.includes('at ') && !l.includes('ErrorTracker')) ?? '';
        return `${error.type}:${error.message}:${relevantLine}`.slice(0, 500);
    }

    private inferSeverity(error: Error): TrackedError['severity'] {
        const message = error.message.toLowerCase();
        
        if (message.includes('fatal') || message.includes('crash')) {
            return 'critical';
        }
        if (message.includes('cannot') || message.includes('failed')) {
            return 'high';
        }
        if (message.includes('warning') || message.includes('deprecated')) {
            return 'low';
        }
        return 'medium';
    }

    private addToGroup(fingerprint: string, error: TrackedError): void {
        const existing = this.groups.get(fingerprint);

        if (existing) {
            existing.errors.push(error);
            existing.count++;
            existing.lastSeen = error.lastSeen;
        } else {
            this.groups.set(fingerprint, {
                fingerprint,
                message: error.message,
                type: error.type,
                errors: [error],
                count: 1,
                firstSeen: error.firstSeen,
                lastSeen: error.lastSeen,
                severity: error.severity
            });
        }
    }

    private updateGroup(fingerprint: string, error: TrackedError): void {
        const group = this.groups.get(fingerprint);
        if (group) {
            group.count++;
            group.lastSeen = error.lastSeen;
        }
    }

    private trimErrors(): void {
        if (this.errors.size > this.maxErrors) {
            // Remove oldest errors
            const sorted = Array.from(this.errors.entries())
                .sort((a, b) => a[1].lastSeen - b[1].lastSeen);
            
            const toRemove = sorted.slice(0, this.errors.size - this.maxErrors);
            for (const [key] of toRemove) {
                this.errors.delete(key);
                this.groups.delete(key);
            }
        }
    }

    private notifyCallbacks(error: TrackedError): void {
        for (const callback of this.callbacks) {
            try {
                callback(error);
            } catch (e) {
                console.error('Error callback threw:', e);
            }
        }
    }
}

// Global instance
export const errorTracker = new ErrorTracker();
