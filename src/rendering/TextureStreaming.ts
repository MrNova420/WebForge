/**
 * @module rendering
 * @fileoverview Texture streaming system with mip-chain LOD management,
 * distance-based priority loading, LRU eviction, and reference-counted caching.
 * Enables on-demand texture loading for large scenes without exceeding GPU memory budgets.
 */

import { Logger } from '../core/Logger';
import { EventSystem } from '../core/EventSystem';
import { Vector3 } from '../math/Vector3';

/**
 * Configuration for the texture streaming system.
 */
export interface TextureStreamingConfig {
    /** Maximum GPU memory budget in bytes. */
    memoryBudget: number;
    /** Maximum number of textures loading concurrently. */
    maxConcurrentLoads: number;
    /** Number of mip levels to manage (0 = highest detail). */
    maxMipLevels: number;
    /** Distance thresholds for each mip level (index 0 = closest / highest detail). */
    mipDistances: number[];
    /** Interval in milliseconds between LRU eviction sweeps. */
    evictionInterval: number;
    /** Minimum time in milliseconds a texture must be unreferenced before eviction. */
    evictionGracePeriod: number;
    /** Maximum entries retained in the unloaded texture cache. */
    cacheCapacity: number;
}

/**
 * Internal tracking record for a single streaming texture.
 */
export interface StreamingTextureEntry {
    /** Unique identifier (typically the URL). */
    id: string;
    /** Source URL for the texture data. */
    url: string;
    /** Current loading priority (lower = higher priority). */
    priority: number;
    /** Currently loaded mip level (0 = highest detail, -1 = not loaded). */
    currentMip: number;
    /** Desired mip level based on distance. */
    targetMip: number;
    /** Whether the texture data has been loaded at least once. */
    loaded: boolean;
    /** Whether a load operation is currently in flight. */
    loading: boolean;
    /** Timestamp (ms) of the last access via requestTexture or bind. */
    lastAccessTime: number;
    /** Number of active consumers holding a reference. */
    refCount: number;
    /** Estimated memory usage in bytes for the currently loaded mip chain. */
    memoryUsage: number;
    /** Width of the base (mip 0) texture. */
    width: number;
    /** Height of the base (mip 0) texture. */
    height: number;
    /** The loaded image element, if available. */
    image: HTMLImageElement | null;
}

/** Snapshot of streaming system statistics. */
export interface TextureStreamingStats {
    /** Number of textures currently loaded in memory. */
    loadedCount: number;
    /** Number of textures currently being loaded. */
    loadingCount: number;
    /** Total estimated memory usage in bytes. */
    memoryUsed: number;
    /** Configured memory budget in bytes. */
    memoryBudget: number;
    /** Number of textures in the unloaded cache. */
    cachedCount: number;
    /** Total number of tracked texture entries. */
    totalEntries: number;
    /** Number of LRU evictions performed since creation. */
    evictionCount: number;
}

const DEFAULT_CONFIG: TextureStreamingConfig = {
    memoryBudget: 256 * 1024 * 1024, // 256 MB
    maxConcurrentLoads: 4,
    maxMipLevels: 4,
    mipDistances: [0, 50, 150, 400],
    evictionInterval: 1000,
    evictionGracePeriod: 3000,
    cacheCapacity: 64
};

/** Bytes per pixel for RGBA textures. */
const BYTES_PER_PIXEL = 4;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Estimate memory usage for a texture at a given mip level.
 * Each mip level halves both dimensions; we sum the mip chain from the
 * requested level down to the smallest mip.
 */
function estimateMipMemory(baseWidth: number, baseHeight: number, mipLevel: number): number {
    let total = 0;
    let w = Math.max(1, baseWidth >> mipLevel);
    let h = Math.max(1, baseHeight >> mipLevel);
    // Sum this level plus all smaller mips
    while (w >= 1 && h >= 1) {
        total += w * h * BYTES_PER_PIXEL;
        if (w === 1 && h === 1) break;
        w = Math.max(1, w >> 1);
        h = Math.max(1, h >> 1);
    }
    return total;
}

// ---------------------------------------------------------------------------
// TextureStreamingManager
// ---------------------------------------------------------------------------

/**
 * Manages on-demand texture streaming with mip-chain LOD, memory budgeting,
 * LRU eviction, and reference-counted caching.
 *
 * Textures are requested by URL and automatically loaded at the appropriate
 * mip level based on distance from a reference point (typically the camera).
 * When the memory budget is exceeded, the least-recently-used unreferenced
 * textures are evicted first.
 *
 * @example
 * ```ts
 * const streaming = new TextureStreamingManager({
 *     memoryBudget: 128 * 1024 * 1024,
 *     maxConcurrentLoads: 4
 * });
 *
 * // Request a texture (increments refCount)
 * const entry = streaming.requestTexture('assets/brick.png');
 *
 * // Each frame, update priorities based on camera position
 * streaming.update(cameraPosition, deltaTime);
 *
 * // When the texture is no longer needed
 * streaming.releaseTexture('assets/brick.png');
 * ```
 */
export class TextureStreamingManager {
    private _config: TextureStreamingConfig;
    private _entries: Map<string, StreamingTextureEntry> = new Map();
    private _loadQueue: string[] = [];
    private _activeLoads: number = 0;
    private _memoryUsed: number = 0;
    private _evictionCount: number = 0;
    private _lastEvictionTime: number = 0;
    private _disposed: boolean = false;
    private _cameraPosition: Vector3 = new Vector3();
    private _texturePositions: Map<string, Vector3> = new Map();
    private _cachedDistances: Map<string, number> = new Map();
    private _priorityOverrides: Map<string, number> = new Map();

    private _events: EventSystem;
    private _logger: Logger;

    /** Emitted when a texture finishes loading. */
    public onTextureLoaded: ((entry: StreamingTextureEntry) => void) | null = null;
    /** Emitted when a texture is evicted from memory. */
    public onTextureEvicted: ((entry: StreamingTextureEntry) => void) | null = null;
    /** Emitted when a texture's mip level changes. */
    public onMipLevelChanged: ((entry: StreamingTextureEntry, previousMip: number) => void) | null = null;

    constructor(config?: Partial<TextureStreamingConfig>) {
        this._config = { ...DEFAULT_CONFIG, ...config };
        this._events = new EventSystem();
        this._logger = new Logger('TextureStreaming');

        // Normalize mipDistances length to exactly maxMipLevels
        if (this._config.mipDistances.length < this._config.maxMipLevels) {
            const last = this._config.mipDistances[this._config.mipDistances.length - 1] ?? 0;
            const needed = this._config.maxMipLevels - this._config.mipDistances.length;
            for (let i = 1; i <= needed; i++) {
                this._config.mipDistances.push(last + 100 * i);
            }
        } else if (this._config.mipDistances.length > this._config.maxMipLevels) {
            this._config.mipDistances.length = this._config.maxMipLevels;
        }
    }

    // ------------------------------------------------------------------
    // Public API – texture requests
    // ------------------------------------------------------------------

    /**
     * Request a texture by URL. If the texture is already tracked, its
     * reference count is incremented and the existing entry is returned.
     * Otherwise a new entry is created and queued for loading.
     *
     * @param url - URL of the texture to load.
     * @param worldPosition - Optional world position used for distance-based LOD.
     * @param baseWidth - Expected base width (defaults to 1024 until loaded).
     * @param baseHeight - Expected base height (defaults to 1024 until loaded).
     * @returns The streaming texture entry.
     */
    public requestTexture(
        url: string,
        worldPosition?: Vector3,
        baseWidth: number = 1024,
        baseHeight: number = 1024
    ): StreamingTextureEntry {
        if (this._disposed) {
            throw new Error('TextureStreamingManager has been disposed');
        }

        const existing = this._entries.get(url);
        if (existing) {
            existing.refCount++;
            existing.lastAccessTime = Date.now();
            if (worldPosition) {
                this._texturePositions.set(url, worldPosition.clone());
            }
            this._logger.debug(`Texture ref incremented: ${url} (refCount=${existing.refCount})`);
            return existing;
        }

        const entry: StreamingTextureEntry = {
            id: url,
            url,
            priority: Infinity,
            currentMip: -1,
            targetMip: this._config.maxMipLevels - 1,
            loaded: false,
            loading: false,
            lastAccessTime: Date.now(),
            refCount: 1,
            memoryUsage: 0,
            width: baseWidth,
            height: baseHeight,
            image: null
        };

        this._entries.set(url, entry);

        if (worldPosition) {
            this._texturePositions.set(url, worldPosition.clone());
        }

        this._enqueueLoad(url);
        this._logger.info(`Texture requested: ${url}`);
        this._events.emit('texture-requested', { url });
        return entry;
    }

    /**
     * Release a reference to a texture. When the reference count reaches zero
     * the texture becomes eligible for LRU eviction.
     *
     * @param url - URL of the texture to release.
     */
    public releaseTexture(url: string): void {
        const entry = this._entries.get(url);
        if (!entry) {
            this._logger.warn(`Attempted to release unknown texture: ${url}`);
            return;
        }

        entry.refCount = Math.max(0, entry.refCount - 1);
        this._logger.debug(`Texture ref decremented: ${url} (refCount=${entry.refCount})`);

        if (entry.refCount === 0) {
            entry.lastAccessTime = Date.now();
            this._events.emit('texture-unreferenced', { url });
        }
    }

    // ------------------------------------------------------------------
    // Public API – per-frame update
    // ------------------------------------------------------------------

    /**
     * Per-frame update. Recalculates priorities, adjusts mip levels, processes
     * the load queue, and runs eviction if needed.
     *
     * @param cameraPosition - Current camera world position.
     * @param _deltaTime - Elapsed time since last frame (seconds).
     */
    public update(cameraPosition: Vector3, _deltaTime: number): void {
        if (this._disposed) return;

        this._cameraPosition = cameraPosition.clone();

        this._cacheDistances();
        this._updatePriorities();
        this._updateTargetMips();
        this._sortLoadQueue();
        this._processLoadQueue();

        const now = Date.now();
        if (now - this._lastEvictionTime >= this._config.evictionInterval) {
            this._lastEvictionTime = now;
            this._enforceMemoryBudget();
        }
    }

    // ------------------------------------------------------------------
    // Public API – memory management
    // ------------------------------------------------------------------

    /**
     * Set the GPU memory budget at runtime.
     *
     * @param bytes - New memory budget in bytes.
     */
    public setMemoryBudget(bytes: number): void {
        this._config.memoryBudget = Math.max(0, bytes);
        this._logger.info(`Memory budget set to ${(bytes / (1024 * 1024)).toFixed(1)} MB`);
        this._enforceMemoryBudget();
    }

    /**
     * Manually evict the least-recently-used unreferenced textures until
     * memory usage drops below the budget or no more candidates remain.
     *
     * @param maxEvictions - Maximum number of textures to evict (0 = unlimited).
     * @returns Number of textures evicted.
     */
    public evictLRU(maxEvictions: number = 0): number {
        const candidates = this._getEvictionCandidates();
        let evicted = 0;

        for (const entry of candidates) {
            if (maxEvictions > 0 && evicted >= maxEvictions) break;
            if (this._memoryUsed <= this._config.memoryBudget && maxEvictions === 0) break;
            this._evictEntry(entry);
            evicted++;
        }

        return evicted;
    }

    // ------------------------------------------------------------------
    // Public API – prioritization
    // ------------------------------------------------------------------

    /**
     * Manually override the priority for a texture. Lower values are loaded
     * first. Call this before `update()` to influence load ordering.
     *
     * @param url - Texture URL.
     * @param priority - New priority value (lower = higher priority).
     */
    public prioritize(url: string, priority: number): void {
        const entry = this._entries.get(url);
        if (!entry) {
            this._logger.warn(`Cannot prioritize unknown texture: ${url}`);
            return;
        }
        entry.priority = priority;
        this._priorityOverrides.set(url, priority);
        this._sortLoadQueue();
    }

    /**
     * Set the world-space position associated with a texture, used for
     * distance-based LOD and priority calculations.
     *
     * @param url - Texture URL.
     * @param position - World position of the surface using this texture.
     */
    public setTexturePosition(url: string, position: Vector3): void {
        this._texturePositions.set(url, position.clone());
    }

    // ------------------------------------------------------------------
    // Public API – statistics & queries
    // ------------------------------------------------------------------

    /**
     * Returns a snapshot of the streaming system statistics.
     */
    public getStats(): TextureStreamingStats {
        let loadedCount = 0;
        let loadingCount = 0;

        this._entries.forEach((entry) => {
            if (entry.loaded) loadedCount++;
            if (entry.loading) loadingCount++;
        });

        return {
            loadedCount,
            loadingCount,
            memoryUsed: this._memoryUsed,
            memoryBudget: this._config.memoryBudget,
            cachedCount: this._countCached(),
            totalEntries: this._entries.size,
            evictionCount: this._evictionCount
        };
    }

    /**
     * Retrieve the streaming entry for a URL, or `null` if not tracked.
     */
    public getEntry(url: string): StreamingTextureEntry | null {
        return this._entries.get(url) ?? null;
    }

    /**
     * Returns the event system for subscribing to streaming events.
     *
     * Events emitted:
     * - `texture-requested` – A new texture was requested.
     * - `texture-loaded` – A texture finished loading.
     * - `texture-evicted` – A texture was evicted from memory.
     * - `texture-unreferenced` – A texture's refCount dropped to zero.
     * - `mip-changed` – A texture's mip level changed.
     */
    public getEvents(): EventSystem {
        return this._events;
    }

    /**
     * Returns a copy of the current configuration.
     */
    public getConfig(): TextureStreamingConfig {
        return { ...this._config };
    }

    // ------------------------------------------------------------------
    // Public API – lifecycle
    // ------------------------------------------------------------------

    /**
     * Dispose the streaming manager, evicting all textures and releasing resources.
     */
    public dispose(): void {
        this._entries.forEach((entry) => {
            this._evictEntry(entry);
        });
        this._entries.clear();
        this._texturePositions.clear();
        this._cachedDistances.clear();
        this._priorityOverrides.clear();
        this._loadQueue.length = 0;
        this._activeLoads = 0;
        this._memoryUsed = 0;
        this._events.clear();
        this._disposed = true;
        this._logger.info('TextureStreamingManager disposed');
    }

    // ------------------------------------------------------------------
    // Private – priority & mip calculation
    // ------------------------------------------------------------------

    /**
     * Pre-compute distances from camera to each texture position.
     */
    private _cacheDistances(): void {
        this._cachedDistances.clear();
        this._entries.forEach((_entry, url) => {
            const position = this._texturePositions.get(url);
            if (position) {
                this._cachedDistances.set(url, position.distanceTo(this._cameraPosition));
            }
        });
    }

    /**
     * Recalculate priority for every tracked texture based on distance
     * from the camera and reference count.
     */
    private _updatePriorities(): void {
        this._entries.forEach((entry, url) => {
            // Respect manual priority overrides
            const override = this._priorityOverrides.get(url);
            if (override !== undefined) {
                entry.priority = override;
                return;
            }
            const distance = this._cachedDistances.get(url);
            if (distance !== undefined) {
                // Textures with more refs are given a slight priority boost
                const refBoost = Math.min(entry.refCount, 10) * 0.5;
                entry.priority = distance - refBoost;
            } else if (entry.priority === Infinity) {
                // No position known; assign a neutral priority
                entry.priority = 1000;
            }
        });
    }

    /**
     * Determine the ideal mip level for each texture based on its distance
     * from the camera.
     */
    private _updateTargetMips(): void {
        this._entries.forEach((entry, url) => {
            const distance = this._cachedDistances.get(url);
            const previousTarget = entry.targetMip;

            if (distance !== undefined) {
                entry.targetMip = this._computeMipLevel(distance);
            } else {
                // No position: request lowest detail until position is provided
                entry.targetMip = this._config.maxMipLevels - 1;
            }

            // If the target mip changed and the texture is loaded, re-queue for mip adjustment
            if (entry.loaded && entry.targetMip !== previousTarget && entry.targetMip !== entry.currentMip) {
                this._enqueueLoad(url);
            }
        });
    }

    /**
     * Map a world-space distance to a mip level.
     * Mip 0 = highest detail (closest), higher mip = lower detail (farther).
     */
    private _computeMipLevel(distance: number): number {
        const distances = this._config.mipDistances;
        const maxMip = this._config.maxMipLevels - 1;
        // Walk from highest mip (lowest detail) backward; return the first
        // level whose threshold the distance meets or exceeds.
        for (let i = distances.length - 1; i > 0; i--) {
            if (distance >= distances[i]) return Math.min(i, maxMip);
        }
        return 0;
    }

    // ------------------------------------------------------------------
    // Private – load queue management
    // ------------------------------------------------------------------

    private _enqueueLoad(url: string): void {
        if (!this._loadQueue.includes(url)) {
            this._loadQueue.push(url);
        }
    }

    private _sortLoadQueue(): void {
        this._loadQueue.sort((a, b) => {
            const ea = this._entries.get(a);
            const eb = this._entries.get(b);
            if (!ea || !eb) return 0;
            return ea.priority - eb.priority;
        });
    }

    private _processLoadQueue(): void {
        while (
            this._loadQueue.length > 0 &&
            this._activeLoads < this._config.maxConcurrentLoads
        ) {
            const url = this._loadQueue.shift()!;
            const entry = this._entries.get(url);
            if (!entry || entry.loading) continue;

            // Skip if already at target mip
            if (entry.loaded && entry.currentMip === entry.targetMip) continue;

            this._loadTextureAsync(entry);
        }
    }

    // ------------------------------------------------------------------
    // Private – async loading
    // ------------------------------------------------------------------

    private _loadTextureAsync(entry: StreamingTextureEntry): void {
        entry.loading = true;
        this._activeLoads++;

        const image = new Image();
        image.crossOrigin = 'anonymous';

        image.onload = () => {
            if (this._disposed) {
                this._activeLoads = Math.max(0, this._activeLoads - 1);
                return;
            }

            const current = this._entries.get(entry.url);
            if (!current) {
                this._activeLoads = Math.max(0, this._activeLoads - 1);
                return;
            }

            // Update base dimensions from the actual image
            current.width = image.width;
            current.height = image.height;

            const previousMip = current.currentMip;
            current.currentMip = current.targetMip;
            current.image = image;
            current.loaded = true;
            current.loading = false;
            current.lastAccessTime = Date.now();

            // Update memory accounting
            const oldMemory = current.memoryUsage;
            current.memoryUsage = estimateMipMemory(current.width, current.height, current.currentMip);
            this._memoryUsed += current.memoryUsage - oldMemory;

            this._activeLoads = Math.max(0, this._activeLoads - 1);

            this._logger.info(
                `Texture loaded: ${current.url} (mip=${current.currentMip}, ` +
                `${current.width}x${current.height}, ` +
                `${(current.memoryUsage / 1024).toFixed(0)} KB)`
            );

            this._events.emit('texture-loaded', { url: current.url, mip: current.currentMip });
            if (this.onTextureLoaded) this.onTextureLoaded(current);

            if (previousMip !== current.currentMip && previousMip !== -1) {
                this._events.emit('mip-changed', {
                    url: current.url,
                    previousMip,
                    currentMip: current.currentMip
                });
                if (this.onMipLevelChanged) this.onMipLevelChanged(current, previousMip);
            }
        };

        image.onerror = () => {
            if (this._disposed) {
                this._activeLoads = Math.max(0, this._activeLoads - 1);
                return;
            }

            const current = this._entries.get(entry.url);
            if (current) {
                current.loading = false;
            }
            this._activeLoads = Math.max(0, this._activeLoads - 1);
            this._logger.error(`Failed to load texture: ${entry.url}`);
        };

        image.src = entry.url;
    }

    // ------------------------------------------------------------------
    // Private – eviction & memory management
    // ------------------------------------------------------------------

    /**
     * Evict textures until memory usage is within the configured budget.
     */
    private _enforceMemoryBudget(): void {
        if (this._memoryUsed <= this._config.memoryBudget) return;
        const candidates = this._getEvictionCandidates();

        for (const entry of candidates) {
            if (this._memoryUsed <= this._config.memoryBudget) break;
            this._evictEntry(entry);
        }
    }

    /**
     * Build a list of eviction candidates, sorted by last access time ascending
     * (oldest first). Only unreferenced textures past the grace period qualify.
     */
    private _getEvictionCandidates(): StreamingTextureEntry[] {
        const now = Date.now();
        const candidates: StreamingTextureEntry[] = [];

        this._entries.forEach((entry) => {
            if (
                entry.refCount === 0 &&
                entry.loaded &&
                !entry.loading &&
                (now - entry.lastAccessTime) >= this._config.evictionGracePeriod
            ) {
                candidates.push(entry);
            }
        });

        // Sort oldest first (LRU)
        candidates.sort((a, b) => a.lastAccessTime - b.lastAccessTime);
        return candidates;
    }

    /**
     * Evict a single texture entry, freeing its memory and image data.
     * The entry remains tracked (unloaded) so it can be quickly re-requested;
     * _trimCache handles removing excess unloaded entries.
     */
    private _evictEntry(entry: StreamingTextureEntry): void {
        this._memoryUsed = Math.max(0, this._memoryUsed - entry.memoryUsage);
        entry.memoryUsage = 0;
        entry.currentMip = -1;
        entry.loaded = false;
        entry.image = null;

        this._evictionCount++;

        this._logger.debug(`Texture evicted: ${entry.url}`);
        this._events.emit('texture-evicted', { url: entry.url });
        if (this.onTextureEvicted) this.onTextureEvicted(entry);

        this._trimCache();
    }

    /**
     * Trim unreferenced, unloaded entries to stay within cache capacity.
     */
    private _trimCache(): void {
        const cached = this._getCachedEntries();
        if (cached.length <= this._config.cacheCapacity) return;

        // Evict oldest unloaded, unreferenced entries first
        cached.sort((a, b) => a.lastAccessTime - b.lastAccessTime);

        while (cached.length > this._config.cacheCapacity) {
            const oldest = cached.shift()!;
            this._entries.delete(oldest.url);
            this._texturePositions.delete(oldest.url);
        }
    }

    // ------------------------------------------------------------------
    // Private – helpers
    // ------------------------------------------------------------------

    /**
     * Get all entries that are unloaded and unreferenced (cache entries).
     */
    private _getCachedEntries(): StreamingTextureEntry[] {
        const cached: StreamingTextureEntry[] = [];
        this._entries.forEach((entry) => {
            if (!entry.loaded && !entry.loading && entry.refCount === 0) {
                cached.push(entry);
            }
        });
        return cached;
    }

    /**
     * Count the number of cached (unloaded, unreferenced) entries.
     */
    private _countCached(): number {
        let count = 0;
        this._entries.forEach((entry) => {
            if (!entry.loaded && !entry.loading && entry.refCount === 0) {
                count++;
            }
        });
        return count;
    }
}
