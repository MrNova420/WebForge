/**
 * WebForge Professional Debugger - Watch System
 * 
 * Monitor variables and expressions in real-time with
 * change detection and history tracking.
 */

export interface WatchExpression {
    id: string;
    name: string;
    expression: string;
    evaluator: () => unknown;
    enabled: boolean;
    currentValue: unknown;
    previousValue: unknown;
    lastUpdate: number;
    changeCount: number;
    history: WatchHistoryEntry[];
    maxHistory: number;
    breakOnChange: boolean;
}

export interface WatchHistoryEntry {
    timestamp: number;
    frameNumber: number;
    value: unknown;
    serializedValue: string;
}

export interface WatchGroup {
    id: string;
    name: string;
    watches: string[];
    collapsed: boolean;
}

export type WatchChangeCallback = (
    watch: WatchExpression,
    oldValue: unknown,
    newValue: unknown
) => void;

export class WatchSystem {
    private watches: Map<string, WatchExpression> = new Map();
    private groups: Map<string, WatchGroup> = new Map();
    private changeCallbacks: Set<WatchChangeCallback> = new Set();
    private frameNumber: number = 0;
    private enabled: boolean = true;
    private updateInterval: number | null = null;
    private autoUpdateMs: number = 16; // ~60fps

    /**
     * Add a watch expression
     */
    addWatch(
        name: string,
        evaluator: () => unknown,
        options: Partial<WatchExpression> = {}
    ): WatchExpression {
        const id = `watch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        let initialValue: unknown;
        try {
            initialValue = evaluator();
        } catch {
            initialValue = undefined;
        }

        const watch: WatchExpression = {
            id,
            name,
            expression: options.expression ?? name,
            evaluator,
            enabled: true,
            currentValue: initialValue,
            previousValue: undefined,
            lastUpdate: Date.now(),
            changeCount: 0,
            history: [],
            maxHistory: options.maxHistory ?? 100,
            breakOnChange: options.breakOnChange ?? false,
            ...options
        };

        this.watches.set(id, watch);
        this.recordHistory(watch);

        return watch;
    }

    /**
     * Add a watch for an object property
     */
    addPropertyWatch(
        obj: object,
        propertyPath: string,
        options: Partial<WatchExpression> = {}
    ): WatchExpression {
        const evaluator = () => this.getNestedProperty(obj, propertyPath);
        return this.addWatch(propertyPath, evaluator, {
            expression: propertyPath,
            ...options
        });
    }

    /**
     * Add multiple watches for all properties of an object
     */
    addObjectWatch(
        obj: object,
        name: string,
        depth: number = 1
    ): WatchGroup {
        const groupId = `group_${Date.now()}`;
        const watchIds: string[] = [];

        const addProperties = (target: object, prefix: string, currentDepth: number) => {
            if (currentDepth > depth) return;

            for (const key of Object.keys(target)) {
                const path = prefix ? `${prefix}.${key}` : key;
                const value = (target as Record<string, unknown>)[key];

                const watch = this.addWatch(path, () => this.getNestedProperty(obj, path), {
                    expression: `${name}.${path}`
                });
                watchIds.push(watch.id);

                if (value && typeof value === 'object' && !Array.isArray(value)) {
                    addProperties(value as object, path, currentDepth + 1);
                }
            }
        };

        addProperties(obj, '', 1);

        const group: WatchGroup = {
            id: groupId,
            name,
            watches: watchIds,
            collapsed: false
        };

        this.groups.set(groupId, group);
        return group;
    }

    /**
     * Remove a watch
     */
    removeWatch(id: string): boolean {
        // Remove from any groups
        for (const group of this.groups.values()) {
            const index = group.watches.indexOf(id);
            if (index !== -1) {
                group.watches.splice(index, 1);
            }
        }
        return this.watches.delete(id);
    }

    /**
     * Remove a watch group and all its watches
     */
    removeGroup(groupId: string): boolean {
        const group = this.groups.get(groupId);
        if (!group) return false;

        for (const watchId of group.watches) {
            this.watches.delete(watchId);
        }
        return this.groups.delete(groupId);
    }

    /**
     * Get a watch by ID
     */
    getWatch(id: string): WatchExpression | undefined {
        return this.watches.get(id);
    }

    /**
     * Get all watches
     */
    getAllWatches(): WatchExpression[] {
        return Array.from(this.watches.values());
    }

    /**
     * Get all watch groups
     */
    getAllGroups(): WatchGroup[] {
        return Array.from(this.groups.values());
    }

    /**
     * Enable/disable a watch
     */
    setWatchEnabled(id: string, enabled: boolean): void {
        const watch = this.watches.get(id);
        if (watch) {
            watch.enabled = enabled;
        }
    }

    /**
     * Set break-on-change for a watch
     */
    setBreakOnChange(id: string, breakOnChange: boolean): void {
        const watch = this.watches.get(id);
        if (watch) {
            watch.breakOnChange = breakOnChange;
        }
    }

    /**
     * Register callback for value changes
     */
    onValueChange(callback: WatchChangeCallback): () => void {
        this.changeCallbacks.add(callback);
        return () => this.changeCallbacks.delete(callback);
    }

    /**
     * Update all watches (call each frame)
     */
    update(frameNumber?: number): WatchExpression[] {
        if (!this.enabled) return [];

        if (frameNumber !== undefined) {
            this.frameNumber = frameNumber;
        }

        const changedWatches: WatchExpression[] = [];

        for (const watch of this.watches.values()) {
            if (!watch.enabled) continue;

            try {
                const newValue = watch.evaluator();
                const changed = !this.deepEqual(watch.currentValue, newValue);

                if (changed) {
                    watch.previousValue = watch.currentValue;
                    watch.currentValue = newValue;
                    watch.lastUpdate = Date.now();
                    watch.changeCount++;
                    
                    this.recordHistory(watch);
                    changedWatches.push(watch);

                    // Notify callbacks
                    for (const callback of this.changeCallbacks) {
                        try {
                            callback(watch, watch.previousValue, newValue);
                        } catch (e) {
                            console.error('Watch callback error:', e);
                        }
                    }
                }
            } catch (e) {
                // Evaluator threw - mark as error
                const errorValue = `Error: ${e instanceof Error ? e.message : String(e)}`;
                if (watch.currentValue !== errorValue) {
                    watch.previousValue = watch.currentValue;
                    watch.currentValue = errorValue;
                    watch.lastUpdate = Date.now();
                }
            }
        }

        return changedWatches;
    }

    /**
     * Start automatic updates
     */
    startAutoUpdate(intervalMs?: number): void {
        this.stopAutoUpdate();
        this.autoUpdateMs = intervalMs ?? this.autoUpdateMs;
        
        this.updateInterval = window.setInterval(() => {
            this.update();
        }, this.autoUpdateMs);
    }

    /**
     * Stop automatic updates
     */
    stopAutoUpdate(): void {
        if (this.updateInterval !== null) {
            window.clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }

    /**
     * Get watch value history
     */
    getHistory(id: string): WatchHistoryEntry[] {
        const watch = this.watches.get(id);
        return watch?.history ?? [];
    }

    /**
     * Clear history for a watch
     */
    clearHistory(id: string): void {
        const watch = this.watches.get(id);
        if (watch) {
            watch.history = [];
        }
    }

    /**
     * Export all watch data
     */
    exportData(): object {
        const data: Record<string, unknown> = {};
        
        for (const watch of this.watches.values()) {
            data[watch.name] = {
                currentValue: watch.currentValue,
                changeCount: watch.changeCount,
                history: watch.history.slice(-10) // Last 10 entries
            };
        }

        return data;
    }

    /**
     * Get snapshot of all current values
     */
    getSnapshot(): Map<string, unknown> {
        const snapshot = new Map<string, unknown>();
        
        for (const watch of this.watches.values()) {
            if (watch.enabled) {
                snapshot.set(watch.name, watch.currentValue);
            }
        }

        return snapshot;
    }

    /**
     * Enable/disable the watch system
     */
    setEnabled(enabled: boolean): void {
        this.enabled = enabled;
        if (!enabled) {
            this.stopAutoUpdate();
        }
    }

    /**
     * Clear all watches
     */
    clearAll(): void {
        this.stopAutoUpdate();
        this.watches.clear();
        this.groups.clear();
    }

    private recordHistory(watch: WatchExpression): void {
        const entry: WatchHistoryEntry = {
            timestamp: Date.now(),
            frameNumber: this.frameNumber,
            value: this.cloneValue(watch.currentValue),
            serializedValue: this.serializeValue(watch.currentValue)
        };

        watch.history.push(entry);

        // Trim history if needed
        if (watch.history.length > watch.maxHistory) {
            watch.history.shift();
        }
    }

    private getNestedProperty(obj: object, path: string): unknown {
        const parts = path.split('.');
        let current: unknown = obj;

        for (const part of parts) {
            if (current === null || current === undefined) {
                return undefined;
            }
            current = (current as Record<string, unknown>)[part];
        }

        return current;
    }

    private deepEqual(a: unknown, b: unknown): boolean {
        if (a === b) return true;
        if (typeof a !== typeof b) return false;
        if (a === null || b === null) return a === b;

        if (typeof a === 'object') {
            const aKeys = Object.keys(a as object);
            const bKeys = Object.keys(b as object);

            if (aKeys.length !== bKeys.length) return false;

            for (const key of aKeys) {
                if (!this.deepEqual(
                    (a as Record<string, unknown>)[key],
                    (b as Record<string, unknown>)[key]
                )) {
                    return false;
                }
            }
            return true;
        }

        return false;
    }

    private cloneValue(value: unknown): unknown {
        if (value === null || value === undefined) return value;
        if (typeof value !== 'object') return value;

        try {
            return JSON.parse(JSON.stringify(value));
        } catch {
            return `[Uncloneable: ${typeof value}]`;
        }
    }

    private serializeValue(value: unknown): string {
        if (value === null) return 'null';
        if (value === undefined) return 'undefined';

        try {
            return JSON.stringify(value, null, 2);
        } catch {
            return String(value);
        }
    }
}

// Global instance
export const watchSystem = new WatchSystem();
