/**
 * WebForge Professional Debugger - State Inspector
 * 
 * Deep inspection of game objects, scenes, and entity state
 * with serialization and diff capabilities.
 */

import type { DebugContext } from './Breakpoint';

export interface InspectedObject {
    id: string;
    name: string;
    type: string;
    target: WeakRef<object>;
    snapshot: ObjectSnapshot;
    history: ObjectSnapshot[];
    maxHistory: number;
    isPinned: boolean;
}

export interface ObjectSnapshot {
    timestamp: number;
    frameNumber: number;
    properties: PropertyInfo[];
    memoryEstimate: number;
}

export interface PropertyInfo {
    name: string;
    type: string;
    value: unknown;
    displayValue: string;
    isExpandable: boolean;
    isGetter: boolean;
    isSetter: boolean;
    isPrivate: boolean;
    isReadOnly: boolean;
    children?: PropertyInfo[];
    path: string;
}

export interface PropertyDiff {
    path: string;
    type: 'added' | 'removed' | 'changed';
    oldValue?: unknown;
    newValue?: unknown;
}

export interface SearchResult {
    objectId: string;
    objectName: string;
    propertyPath: string;
    value: unknown;
    displayValue: string;
}

export class StateInspector {
    private inspectedObjects: Map<string, InspectedObject> = new Map();
    private idCounter: number = 0;
    private frameNumber: number = 0;
    private maxDepth: number = 10;
    private maxProperties: number = 1000;

    /**
     * Inspect an object
     */
    inspect(target: object, name?: string): InspectedObject {
        const id = `obj_${++this.idCounter}`;
        const objectName = name ?? this.getObjectName(target);

        const snapshot = this.createSnapshot(target);

        const inspected: InspectedObject = {
            id,
            name: objectName,
            type: this.getTypeName(target),
            target: new WeakRef(target),
            snapshot,
            history: [snapshot],
            maxHistory: 50,
            isPinned: false
        };

        this.inspectedObjects.set(id, inspected);
        return inspected;
    }

    /**
     * Update snapshot for an inspected object
     */
    updateSnapshot(id: string): ObjectSnapshot | null {
        const inspected = this.inspectedObjects.get(id);
        if (!inspected) return null;

        const target = inspected.target.deref();
        if (!target) {
            // Object was garbage collected
            this.inspectedObjects.delete(id);
            return null;
        }

        const snapshot = this.createSnapshot(target);
        inspected.snapshot = snapshot;
        inspected.history.push(snapshot);

        // Trim history
        if (inspected.history.length > inspected.maxHistory) {
            inspected.history.shift();
        }

        return snapshot;
    }

    /**
     * Update all inspected objects
     */
    updateAll(frameNumber?: number): void {
        if (frameNumber !== undefined) {
            this.frameNumber = frameNumber;
        }

        for (const id of this.inspectedObjects.keys()) {
            this.updateSnapshot(id);
        }
    }

    /**
     * Get inspected object by ID
     */
    getInspected(id: string): InspectedObject | undefined {
        return this.inspectedObjects.get(id);
    }

    /**
     * Get all inspected objects
     */
    getAllInspected(): InspectedObject[] {
        return Array.from(this.inspectedObjects.values());
    }

    /**
     * Remove inspection
     */
    removeInspection(id: string): boolean {
        return this.inspectedObjects.delete(id);
    }

    /**
     * Pin an object (prevents auto-removal)
     */
    pin(id: string): void {
        const inspected = this.inspectedObjects.get(id);
        if (inspected) {
            inspected.isPinned = true;
        }
    }

    /**
     * Unpin an object
     */
    unpin(id: string): void {
        const inspected = this.inspectedObjects.get(id);
        if (inspected) {
            inspected.isPinned = false;
        }
    }

    /**
     * Get property at path
     */
    getProperty(id: string, path: string): unknown {
        const inspected = this.inspectedObjects.get(id);
        if (!inspected) return undefined;

        const target = inspected.target.deref();
        if (!target) return undefined;

        return this.getValueAtPath(target, path);
    }

    /**
     * Set property at path
     */
    setProperty(id: string, path: string, value: unknown): boolean {
        const inspected = this.inspectedObjects.get(id);
        if (!inspected) return false;

        const target = inspected.target.deref();
        if (!target) return false;

        return this.setValueAtPath(target, path, value);
    }

    /**
     * Diff two snapshots
     */
    diffSnapshots(older: ObjectSnapshot, newer: ObjectSnapshot): PropertyDiff[] {
        const diffs: PropertyDiff[] = [];
        const olderMap = this.flattenProperties(older.properties);
        const newerMap = this.flattenProperties(newer.properties);

        // Find changed and removed
        for (const [path, oldValue] of olderMap) {
            const newValue = newerMap.get(path);
            if (newValue === undefined) {
                diffs.push({ path, type: 'removed', oldValue });
            } else if (!this.deepEqual(oldValue, newValue)) {
                diffs.push({ path, type: 'changed', oldValue, newValue });
            }
        }

        // Find added
        for (const [path, newValue] of newerMap) {
            if (!olderMap.has(path)) {
                diffs.push({ path, type: 'added', newValue });
            }
        }

        return diffs;
    }

    /**
     * Get diff from history
     */
    getDiffFromHistory(id: string, framesBack: number = 1): PropertyDiff[] {
        const inspected = this.inspectedObjects.get(id);
        if (!inspected || inspected.history.length < framesBack + 1) {
            return [];
        }

        const older = inspected.history[inspected.history.length - 1 - framesBack];
        const newer = inspected.snapshot;

        return this.diffSnapshots(older, newer);
    }

    /**
     * Search for value across all inspected objects
     */
    search(query: string | RegExp): SearchResult[] {
        const results: SearchResult[] = [];
        const pattern = typeof query === 'string' 
            ? new RegExp(query, 'i')
            : query;

        for (const inspected of this.inspectedObjects.values()) {
            this.searchInProperties(
                inspected.snapshot.properties,
                inspected.id,
                inspected.name,
                pattern,
                results
            );
        }

        return results;
    }

    /**
     * Get debug context for current inspection state
     */
    getDebugContext(): Partial<DebugContext> {
        const locals = new Map<string, unknown>();
        const watchedVariables = new Map<string, unknown>();

        for (const inspected of this.inspectedObjects.values()) {
            const target = inspected.target.deref();
            if (target) {
                locals.set(inspected.name, target);
            }
        }

        return { locals, watchedVariables };
    }

    /**
     * Export inspection data as JSON
     */
    exportJSON(id?: string): string {
        if (id) {
            const inspected = this.inspectedObjects.get(id);
            return JSON.stringify(inspected?.snapshot ?? null, null, 2);
        }

        const allData: Record<string, ObjectSnapshot> = {};
        for (const [objId, inspected] of this.inspectedObjects) {
            allData[objId] = inspected.snapshot;
        }
        return JSON.stringify(allData, null, 2);
    }

    /**
     * Clear all inspections
     */
    clear(): void {
        this.inspectedObjects.clear();
    }

    /**
     * Clear non-pinned inspections
     */
    clearUnpinned(): void {
        for (const [id, inspected] of this.inspectedObjects) {
            if (!inspected.isPinned) {
                this.inspectedObjects.delete(id);
            }
        }
    }

    /**
     * Set max inspection depth
     */
    setMaxDepth(depth: number): void {
        this.maxDepth = depth;
    }

    private createSnapshot(target: object): ObjectSnapshot {
        const properties = this.inspectProperties(target, '', 0);
        const memoryEstimate = this.estimateMemory(properties);

        return {
            timestamp: Date.now(),
            frameNumber: this.frameNumber,
            properties,
            memoryEstimate
        };
    }

    private inspectProperties(
        target: unknown,
        basePath: string,
        depth: number
    ): PropertyInfo[] {
        if (depth > this.maxDepth || target === null || target === undefined) {
            return [];
        }

        const properties: PropertyInfo[] = [];
        const seen = new Set<unknown>();

        if (typeof target !== 'object') {
            return properties;
        }

        // Get own properties
        const descriptors = Object.getOwnPropertyDescriptors(target);
        let propCount = 0;

        for (const [name, descriptor] of Object.entries(descriptors)) {
            if (propCount >= this.maxProperties) break;

            const path = basePath ? `${basePath}.${name}` : name;
            const isPrivate = name.startsWith('_') || name.startsWith('#');

            let value: unknown;
            let isGetter = false;
            let isSetter = false;

            if (descriptor.get) {
                isGetter = true;
                try {
                    value = descriptor.get.call(target);
                } catch {
                    value = '[Getter Error]';
                }
            } else {
                value = descriptor.value;
            }

            if (descriptor.set) {
                isSetter = true;
            }

            // Avoid circular references
            if (typeof value === 'object' && value !== null) {
                if (seen.has(value)) {
                    value = '[Circular]';
                } else {
                    seen.add(value);
                }
            }

            const type = this.getTypeName(value);
            const isExpandable = this.isExpandable(value);
            const displayValue = this.formatValue(value);

            const propInfo: PropertyInfo = {
                name,
                type,
                value: this.isSafeValue(value) ? value : displayValue,
                displayValue,
                isExpandable,
                isGetter,
                isSetter,
                isPrivate,
                isReadOnly: !descriptor.writable && !descriptor.set,
                path
            };

            // Recursively inspect children
            if (isExpandable && value !== '[Circular]') {
                propInfo.children = this.inspectProperties(value, path, depth + 1);
            }

            properties.push(propInfo);
            propCount++;
        }

        // Handle arrays specially
        if (Array.isArray(target)) {
            // Add length as virtual property
            properties.unshift({
                name: 'length',
                type: 'number',
                value: target.length,
                displayValue: String(target.length),
                isExpandable: false,
                isGetter: false,
                isSetter: false,
                isPrivate: false,
                isReadOnly: false,
                path: basePath ? `${basePath}.length` : 'length'
            });
        }

        return properties;
    }

    private getTypeName(value: unknown): string {
        if (value === null) return 'null';
        if (value === undefined) return 'undefined';
        if (Array.isArray(value)) return `Array(${value.length})`;
        if (value instanceof Map) return `Map(${value.size})`;
        if (value instanceof Set) return `Set(${value.size})`;
        if (value instanceof Date) return 'Date';
        if (value instanceof RegExp) return 'RegExp';
        if (value instanceof Error) return value.constructor.name;
        if (typeof value === 'function') return `Function(${value.name || 'anonymous'})`;
        if (typeof value === 'object') {
            const constructor = value.constructor?.name;
            return constructor && constructor !== 'Object' ? constructor : 'Object';
        }
        return typeof value;
    }

    private getObjectName(target: object): string {
        if ('name' in target && typeof target.name === 'string') {
            return target.name;
        }
        if ('id' in target) {
            return `${this.getTypeName(target)}#${target.id}`;
        }
        return this.getTypeName(target);
    }

    private isExpandable(value: unknown): boolean {
        if (value === null || value === undefined) return false;
        if (typeof value !== 'object' && typeof value !== 'function') return false;
        if (value instanceof Date || value instanceof RegExp) return false;
        return true;
    }

    private isSafeValue(value: unknown): boolean {
        const type = typeof value;
        return (
            value === null ||
            value === undefined ||
            type === 'boolean' ||
            type === 'number' ||
            type === 'string'
        );
    }

    private formatValue(value: unknown): string {
        if (value === null) return 'null';
        if (value === undefined) return 'undefined';
        if (typeof value === 'string') {
            return value.length > 100 ? `"${value.slice(0, 100)}..."` : `"${value}"`;
        }
        if (typeof value === 'number' || typeof value === 'boolean') {
            return String(value);
        }
        if (typeof value === 'function') {
            return `ƒ ${value.name || 'anonymous'}()`;
        }
        if (Array.isArray(value)) {
            return `Array(${value.length})`;
        }
        if (value instanceof Map) {
            return `Map(${value.size})`;
        }
        if (value instanceof Set) {
            return `Set(${value.size})`;
        }
        if (value instanceof Date) {
            return value.toISOString();
        }
        if (value instanceof RegExp) {
            return value.toString();
        }
        if (value instanceof Error) {
            return `${value.name}: ${value.message}`;
        }
        if (typeof value === 'object') {
            const name = this.getTypeName(value);
            return `{${name}}`;
        }
        return String(value);
    }

    private getValueAtPath(target: object, path: string): unknown {
        const parts = path.split('.');
        let current: unknown = target;

        for (const part of parts) {
            if (current === null || current === undefined) {
                return undefined;
            }
            current = (current as Record<string, unknown>)[part];
        }

        return current;
    }

    private setValueAtPath(target: object, path: string, value: unknown): boolean {
        const parts = path.split('.');
        const lastPart = parts.pop();
        if (!lastPart) return false;

        let current: unknown = target;
        for (const part of parts) {
            if (current === null || current === undefined) {
                return false;
            }
            current = (current as Record<string, unknown>)[part];
        }

        if (current === null || current === undefined) {
            return false;
        }

        try {
            (current as Record<string, unknown>)[lastPart] = value;
            return true;
        } catch {
            return false;
        }
    }

    private flattenProperties(properties: PropertyInfo[]): Map<string, unknown> {
        const map = new Map<string, unknown>();

        const flatten = (props: PropertyInfo[]) => {
            for (const prop of props) {
                map.set(prop.path, prop.value);
                if (prop.children) {
                    flatten(prop.children);
                }
            }
        };

        flatten(properties);
        return map;
    }

    private searchInProperties(
        properties: PropertyInfo[],
        objectId: string,
        objectName: string,
        pattern: RegExp,
        results: SearchResult[]
    ): void {
        for (const prop of properties) {
            // Search in property name
            if (pattern.test(prop.name) || pattern.test(prop.displayValue)) {
                results.push({
                    objectId,
                    objectName,
                    propertyPath: prop.path,
                    value: prop.value,
                    displayValue: prop.displayValue
                });
            }

            // Search in children
            if (prop.children) {
                this.searchInProperties(prop.children, objectId, objectName, pattern, results);
            }
        }
    }

    private deepEqual(a: unknown, b: unknown): boolean {
        if (a === b) return true;
        if (typeof a !== typeof b) return false;
        if (a === null || b === null) return a === b;

        if (typeof a === 'object') {
            const aStr = JSON.stringify(a);
            const bStr = JSON.stringify(b);
            return aStr === bStr;
        }

        return false;
    }

    private estimateMemory(properties: PropertyInfo[]): number {
        let estimate = 0;

        for (const prop of properties) {
            estimate += prop.name.length * 2; // String overhead
            
            if (typeof prop.value === 'string') {
                estimate += prop.value.length * 2;
            } else if (typeof prop.value === 'number') {
                estimate += 8;
            } else if (typeof prop.value === 'boolean') {
                estimate += 4;
            }

            if (prop.children) {
                estimate += this.estimateMemory(prop.children);
            }
        }

        return estimate;
    }
}

// Global instance
export const stateInspector = new StateInspector();
