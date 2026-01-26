/**
 * WebForge Professional Debugger - Timeline Profiler
 * 
 * Visual frame-by-frame performance analysis with
 * flame graphs and detailed timing breakdowns.
 */

export interface TimelineFrame {
    number: number;
    startTime: number;
    endTime: number;
    duration: number;
    fps: number;
    entries: TimelineEntry[];
    markers: TimelineMarker[];
    memoryUsage?: number;
    gpuTime?: number;
}

export interface TimelineEntry {
    id: string;
    name: string;
    category: TimelineCategory;
    startTime: number;
    endTime: number;
    duration: number;
    selfTime: number;
    depth: number;
    parent?: string;
    children: string[];
    metadata?: Record<string, unknown>;
    color?: string;
}

export interface TimelineMarker {
    id: string;
    name: string;
    time: number;
    type: 'event' | 'warning' | 'error' | 'user';
    description?: string;
    color?: string;
}

export type TimelineCategory = 
    | 'script'
    | 'render'
    | 'physics'
    | 'animation'
    | 'audio'
    | 'network'
    | 'garbage-collection'
    | 'idle'
    | 'user';

export interface TimelineStats {
    totalFrames: number;
    averageFPS: number;
    minFPS: number;
    maxFPS: number;
    averageFrameTime: number;
    p50FrameTime: number;
    p95FrameTime: number;
    p99FrameTime: number;
    droppedFrames: number;
    categoryBreakdown: Map<TimelineCategory, number>;
}

export interface FlameGraphNode {
    name: string;
    value: number;
    selfValue: number;
    children: FlameGraphNode[];
    depth: number;
    color?: string;
}

const CATEGORY_COLORS: Record<TimelineCategory, string> = {
    'script': '#FFD700',
    'render': '#4CAF50',
    'physics': '#2196F3',
    'animation': '#9C27B0',
    'audio': '#FF5722',
    'network': '#00BCD4',
    'garbage-collection': '#F44336',
    'idle': '#9E9E9E',
    'user': '#E91E63'
};

export class TimelineProfiler {
    private frames: TimelineFrame[] = [];
    private currentFrame: TimelineFrame | null = null;
    private activeEntries: Map<string, TimelineEntry> = new Map();
    private entryStack: TimelineEntry[] = [];
    private maxFrames: number = 300;
    private frameNumber: number = 0;
    private recording: boolean = false;
    private entryIdCounter: number = 0;
    private markerIdCounter: number = 0;
    private targetFPS: number = 60;

    /**
     * Start recording
     */
    startRecording(): void {
        this.recording = true;
        this.frames = [];
        this.frameNumber = 0;
    }

    /**
     * Stop recording
     */
    stopRecording(): void {
        this.recording = false;
        if (this.currentFrame) {
            this.endFrame();
        }
    }

    /**
     * Check if recording
     */
    isRecording(): boolean {
        return this.recording;
    }

    /**
     * Begin a new frame
     */
    beginFrame(): void {
        if (!this.recording) return;

        // End previous frame if exists
        if (this.currentFrame) {
            this.endFrame();
        }

        this.currentFrame = {
            number: this.frameNumber++,
            startTime: performance.now(),
            endTime: 0,
            duration: 0,
            fps: 0,
            entries: [],
            markers: []
        };
    }

    /**
     * End current frame
     */
    endFrame(): void {
        if (!this.recording || !this.currentFrame) return;

        this.currentFrame.endTime = performance.now();
        this.currentFrame.duration = this.currentFrame.endTime - this.currentFrame.startTime;
        this.currentFrame.fps = 1000 / this.currentFrame.duration;

        // Get memory if available
        if ('memory' in performance) {
            const memory = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory;
            this.currentFrame.memoryUsage = memory?.usedJSHeapSize;
        }

        // Calculate self-times
        this.calculateSelfTimes(this.currentFrame.entries);

        this.frames.push(this.currentFrame);

        // Trim old frames
        while (this.frames.length > this.maxFrames) {
            this.frames.shift();
        }

        this.currentFrame = null;
        this.activeEntries.clear();
        this.entryStack = [];
    }

    /**
     * Begin a timeline entry (like a function/task)
     */
    begin(name: string, category: TimelineCategory = 'script', metadata?: Record<string, unknown>): string {
        if (!this.recording || !this.currentFrame) return '';

        const id = `entry_${++this.entryIdCounter}`;
        const parent = this.entryStack[this.entryStack.length - 1];

        const entry: TimelineEntry = {
            id,
            name,
            category,
            startTime: performance.now(),
            endTime: 0,
            duration: 0,
            selfTime: 0,
            depth: this.entryStack.length,
            children: [],
            metadata,
            color: CATEGORY_COLORS[category]
        };

        if (parent) {
            entry.parent = parent.id;
            parent.children.push(id);
        }

        this.activeEntries.set(id, entry);
        this.entryStack.push(entry);
        this.currentFrame.entries.push(entry);

        return id;
    }

    /**
     * End a timeline entry
     */
    end(id: string): void {
        if (!this.recording) return;

        const entry = this.activeEntries.get(id);
        if (!entry) return;

        entry.endTime = performance.now();
        entry.duration = entry.endTime - entry.startTime;

        // Pop from stack
        const stackIndex = this.entryStack.indexOf(entry);
        if (stackIndex !== -1) {
            this.entryStack.splice(stackIndex, 1);
        }
    }

    /**
     * Measure a synchronous function
     */
    measure<T>(name: string, fn: () => T, category: TimelineCategory = 'script'): T {
        const id = this.begin(name, category);
        try {
            return fn();
        } finally {
            this.end(id);
        }
    }

    /**
     * Measure an async function
     */
    async measureAsync<T>(
        name: string,
        fn: () => Promise<T>,
        category: TimelineCategory = 'script'
    ): Promise<T> {
        const id = this.begin(name, category);
        try {
            return await fn();
        } finally {
            this.end(id);
        }
    }

    /**
     * Add a marker (event/milestone)
     */
    addMarker(
        name: string,
        type: TimelineMarker['type'] = 'event',
        description?: string
    ): void {
        if (!this.recording || !this.currentFrame) return;

        this.currentFrame.markers.push({
            id: `marker_${++this.markerIdCounter}`,
            name,
            time: performance.now(),
            type,
            description,
            color: type === 'error' ? '#F44336' : type === 'warning' ? '#FF9800' : '#2196F3'
        });
    }

    /**
     * Get all recorded frames
     */
    getFrames(): TimelineFrame[] {
        return [...this.frames];
    }

    /**
     * Get frame by number
     */
    getFrame(number: number): TimelineFrame | undefined {
        return this.frames.find(f => f.number === number);
    }

    /**
     * Get frames in time range
     */
    getFramesInRange(startFrame: number, endFrame: number): TimelineFrame[] {
        return this.frames.filter(f => f.number >= startFrame && f.number <= endFrame);
    }

    /**
     * Get timeline statistics
     */
    getStats(): TimelineStats {
        if (this.frames.length === 0) {
            return {
                totalFrames: 0,
                averageFPS: 0,
                minFPS: 0,
                maxFPS: 0,
                averageFrameTime: 0,
                p50FrameTime: 0,
                p95FrameTime: 0,
                p99FrameTime: 0,
                droppedFrames: 0,
                categoryBreakdown: new Map()
            };
        }

        const frameTimes = this.frames.map(f => f.duration).sort((a, b) => a - b);
        const targetFrameTime = 1000 / this.targetFPS;

        const categoryTotals = new Map<TimelineCategory, number>();
        for (const frame of this.frames) {
            for (const entry of frame.entries) {
                const current = categoryTotals.get(entry.category) ?? 0;
                categoryTotals.set(entry.category, current + entry.selfTime);
            }
        }

        return {
            totalFrames: this.frames.length,
            averageFPS: this.frames.reduce((sum, f) => sum + f.fps, 0) / this.frames.length,
            minFPS: Math.min(...this.frames.map(f => f.fps)),
            maxFPS: Math.max(...this.frames.map(f => f.fps)),
            averageFrameTime: frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length,
            p50FrameTime: this.percentile(frameTimes, 50),
            p95FrameTime: this.percentile(frameTimes, 95),
            p99FrameTime: this.percentile(frameTimes, 99),
            droppedFrames: this.frames.filter(f => f.duration > targetFrameTime).length,
            categoryBreakdown: categoryTotals
        };
    }

    /**
     * Generate flame graph data
     */
    generateFlameGraph(frameRange?: { start: number; end: number }): FlameGraphNode {
        const frames = frameRange
            ? this.getFramesInRange(frameRange.start, frameRange.end)
            : this.frames;

        const root: FlameGraphNode = {
            name: 'root',
            value: 0,
            selfValue: 0,
            children: [],
            depth: 0
        };

        // Aggregate all entries by name path
        const aggregated = new Map<string, { total: number; self: number }>();

        for (const frame of frames) {
            for (const entry of frame.entries) {
                const path = this.getEntryPath(entry, frame.entries);
                const existing = aggregated.get(path) ?? { total: 0, self: 0 };
                existing.total += entry.duration;
                existing.self += entry.selfTime;
                aggregated.set(path, existing);
            }
        }

        // Build tree from aggregated data
        for (const [path, times] of aggregated) {
            this.addToFlameGraph(root, path.split(' > '), times.total, times.self);
        }

        root.value = root.children.reduce((sum, c) => sum + c.value, 0);

        return root;
    }

    /**
     * Get slowest entries across all frames
     */
    getSlowestEntries(limit: number = 10): Array<{ name: string; totalTime: number; callCount: number; avgTime: number }> {
        const aggregated = new Map<string, { total: number; count: number }>();

        for (const frame of this.frames) {
            for (const entry of frame.entries) {
                const existing = aggregated.get(entry.name) ?? { total: 0, count: 0 };
                existing.total += entry.duration;
                existing.count++;
                aggregated.set(entry.name, existing);
            }
        }

        return Array.from(aggregated.entries())
            .map(([name, data]) => ({
                name,
                totalTime: data.total,
                callCount: data.count,
                avgTime: data.total / data.count
            }))
            .sort((a, b) => b.totalTime - a.totalTime)
            .slice(0, limit);
    }

    /**
     * Get frames with performance issues
     */
    getProblemFrames(): TimelineFrame[] {
        const targetFrameTime = 1000 / this.targetFPS;
        return this.frames.filter(f => f.duration > targetFrameTime * 1.5);
    }

    /**
     * Export timeline data as JSON
     */
    exportJSON(): string {
        return JSON.stringify({
            frames: this.frames,
            stats: this.getStats()
        }, null, 2);
    }

    /**
     * Export as Chrome DevTools trace format
     */
    exportChromeTrace(): string {
        const events: object[] = [];

        for (const frame of this.frames) {
            for (const entry of frame.entries) {
                // Begin event
                events.push({
                    name: entry.name,
                    cat: entry.category,
                    ph: 'B',
                    ts: entry.startTime * 1000,
                    pid: 1,
                    tid: 1
                });

                // End event
                events.push({
                    name: entry.name,
                    cat: entry.category,
                    ph: 'E',
                    ts: entry.endTime * 1000,
                    pid: 1,
                    tid: 1
                });
            }

            // Add markers as instant events
            for (const marker of frame.markers) {
                events.push({
                    name: marker.name,
                    cat: marker.type,
                    ph: 'i',
                    ts: marker.time * 1000,
                    pid: 1,
                    tid: 1,
                    s: 'g'
                });
            }
        }

        return JSON.stringify({ traceEvents: events }, null, 2);
    }

    /**
     * Set target FPS for analysis
     */
    setTargetFPS(fps: number): void {
        this.targetFPS = fps;
    }

    /**
     * Set max frames to keep
     */
    setMaxFrames(max: number): void {
        this.maxFrames = max;
    }

    /**
     * Clear all recorded data
     */
    clear(): void {
        this.frames = [];
        this.currentFrame = null;
        this.activeEntries.clear();
        this.entryStack = [];
        this.frameNumber = 0;
    }

    private calculateSelfTimes(entries: TimelineEntry[]): void {
        for (const entry of entries) {
            const childTime = entry.children
                .map(id => entries.find(e => e.id === id))
                .filter((e): e is TimelineEntry => e !== undefined)
                .reduce((sum, child) => sum + child.duration, 0);
            
            entry.selfTime = Math.max(0, entry.duration - childTime);
        }
    }

    private getEntryPath(entry: TimelineEntry, allEntries: TimelineEntry[]): string {
        const path: string[] = [entry.name];
        let current = entry;

        while (current.parent) {
            const parent = allEntries.find(e => e.id === current.parent);
            if (!parent) break;
            path.unshift(parent.name);
            current = parent;
        }

        return path.join(' > ');
    }

    private addToFlameGraph(
        node: FlameGraphNode,
        path: string[],
        value: number,
        selfValue: number
    ): void {
        if (path.length === 0) return;

        const [current, ...rest] = path;
        let child = node.children.find(c => c.name === current);

        if (!child) {
            child = {
                name: current,
                value: 0,
                selfValue: 0,
                children: [],
                depth: node.depth + 1
            };
            node.children.push(child);
        }

        if (rest.length === 0) {
            child.value += value;
            child.selfValue += selfValue;
        } else {
            this.addToFlameGraph(child, rest, value, selfValue);
            child.value = child.selfValue + child.children.reduce((sum, c) => sum + c.value, 0);
        }
    }

    private percentile(sortedArray: number[], p: number): number {
        if (sortedArray.length === 0) return 0;
        const index = Math.ceil((p / 100) * sortedArray.length) - 1;
        return sortedArray[Math.max(0, index)];
    }
}

// Global instance
export const timelineProfiler = new TimelineProfiler();
