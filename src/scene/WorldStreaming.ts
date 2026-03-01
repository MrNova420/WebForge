/**
 * @module scene
 * @fileoverview Chunk-based world streaming system for open-world games.
 * Manages dynamic loading/unloading of world chunks based on player proximity,
 * with LOD support, spatial hashing, and directional preloading.
 */

import { Vector3 } from '../math/Vector3';

/** Coordinate identifying a chunk in the world grid. */
export interface ChunkCoord {
    x: number;
    z: number;
}

/** Lifecycle state of a world chunk. */
export enum ChunkState {
    Unloaded = 0,
    Loading = 1,
    Loaded = 2,
    Active = 3,
    Unloading = 4
}

/** Runtime data associated with a single world chunk. */
export interface ChunkData {
    coord: ChunkCoord;
    state: ChunkState;
    /** Object IDs residing in this chunk. */
    objects: string[];
    terrain?: any;
    /** Timestamp (ms) when the chunk finished loading. */
    loadTime: number;
    /** Timestamp (ms) of the last access or activation. */
    lastAccessTime: number;
    /** Loading priority – lower values load first. */
    priority: number;
    /** Level-of-detail tier (0 = highest detail). */
    lod: number;
}

/** Configuration options for the world streaming system. */
export interface WorldStreamingConfig {
    /** World units per chunk side. */
    chunkSize: number;
    /** Radius (in chunks) to keep loaded around the player. */
    loadRadius: number;
    /** Chunks beyond this radius are unloaded. */
    unloadRadius: number;
    /** Maximum number of chunks loading concurrently. */
    maxConcurrentLoads: number;
    /** Distance thresholds for each LOD level. */
    lodDistances: number[];
    /** Whether to preload chunks in the player's movement direction. */
    preloadDirection: boolean;
    /** Maximum number of cached (unloaded) chunks to retain. */
    cacheSize: number;
}

const DEFAULT_CONFIG: WorldStreamingConfig = {
    chunkSize: 256,
    loadRadius: 3,
    unloadRadius: 5,
    maxConcurrentLoads: 4,
    lodDistances: [0, 2, 4, 6],
    preloadDirection: true,
    cacheSize: 32
};

const MIN_VELOCITY_THRESHOLD = 0.1;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function chunkKey(x: number, z: number): string {
    return `${x},${z}`;
}

function coordKey(coord: ChunkCoord): string {
    return chunkKey(coord.x, coord.z);
}

// ---------------------------------------------------------------------------
// SpatialHash – fast 2-D spatial queries
// ---------------------------------------------------------------------------

/** Grid-based spatial hash for quick radius queries on the XZ plane. */
export class SpatialHash {
    private _cellSize: number;
    private _cells: Map<string, Set<string>> = new Map();
    private _objectCells: Map<string, string> = new Map();

    constructor(cellSize: number = 256) {
        this._cellSize = cellSize;
    }

    /** Insert an object at the given world XZ position. */
    public insert(id: string, x: number, z: number): void {
        this.remove(id);
        const key = this._hash(x, z);
        let bucket = this._cells.get(key);
        if (!bucket) {
            bucket = new Set();
            this._cells.set(key, bucket);
        }
        bucket.add(id);
        this._objectCells.set(id, key);
    }

    /** Remove a previously inserted object. */
    public remove(id: string): void {
        const key = this._objectCells.get(id);
        if (key !== undefined) {
            const bucket = this._cells.get(key);
            if (bucket) {
                bucket.delete(id);
                if (bucket.size === 0) this._cells.delete(key);
            }
            this._objectCells.delete(id);
        }
    }

    /** Return all object IDs within `radius` world units of (x, z). */
    public query(x: number, z: number, radius: number): string[] {
        const results: string[] = [];
        const minCX = Math.floor((x - radius) / this._cellSize);
        const maxCX = Math.floor((x + radius) / this._cellSize);
        const minCZ = Math.floor((z - radius) / this._cellSize);
        const maxCZ = Math.floor((z + radius) / this._cellSize);

        for (let cx = minCX; cx <= maxCX; cx++) {
            for (let cz = minCZ; cz <= maxCZ; cz++) {
                const bucket = this._cells.get(chunkKey(cx, cz));
                if (bucket) {
                    bucket.forEach((id) => results.push(id));
                }
            }
        }
        return results;
    }

    /** Remove all entries. */
    public clear(): void {
        this._cells.clear();
        this._objectCells.clear();
    }

    private _hash(x: number, z: number): string {
        return chunkKey(
            Math.floor(x / this._cellSize),
            Math.floor(z / this._cellSize)
        );
    }
}

// ---------------------------------------------------------------------------
// WorldStreaming
// ---------------------------------------------------------------------------

/**
 * Manages chunk-based world streaming for large open-world scenes.
 *
 * Chunks are loaded and unloaded dynamically based on the player's position.
 * A registered loader callback is invoked asynchronously for each chunk that
 * enters the load radius, while chunks that leave the unload radius are
 * released. LOD levels are assigned based on configurable distance thresholds
 * and optional directional preloading anticipates player movement.
 *
 * @example
 * ```ts
 * const streaming = new WorldStreaming({ chunkSize: 128, loadRadius: 4 });
 * streaming.registerChunkLoader(async (coord, lod) => loadTerrain(coord, lod));
 * streaming.registerChunkUnloader((coord) => releaseTerrain(coord));
 *
 * // In game loop
 * streaming.update(player.transform.position, deltaTime);
 * ```
 */
export class WorldStreaming {
    private _config: WorldStreamingConfig;
    private _chunks: Map<string, ChunkData> = new Map();
    private _cache: Map<string, ChunkData> = new Map();
    private _spatialHash: SpatialHash;
    private _loadQueue: ChunkCoord[] = [];
    private _activeLoads: number = 0;
    private _lastPlayerPos: Vector3 = new Vector3();
    private _playerVelocity: Vector3 = new Vector3();
    private _disposed: boolean = false;

    private _chunkLoader: ((coord: ChunkCoord, lod: number) => Promise<any>) | null = null;
    private _chunkUnloader: ((coord: ChunkCoord) => void) | null = null;

    /** Called when a chunk finishes loading. */
    public onChunkLoad: ((chunk: ChunkData) => void) | null = null;
    /** Called when a chunk is unloaded. */
    public onChunkUnload: ((chunk: ChunkData) => void) | null = null;
    /** Called when a chunk transitions to the Active state. */
    public onChunkActivate: ((chunk: ChunkData) => void) | null = null;

    constructor(config?: Partial<WorldStreamingConfig>) {
        this._config = { ...DEFAULT_CONFIG, ...config };
        this._spatialHash = new SpatialHash(this._config.chunkSize);
    }

    // ------------------------------------------------------------------
    // Public API – coordinate helpers
    // ------------------------------------------------------------------

    /** Convert a world-space position to a chunk coordinate. */
    public getChunkAt(worldPos: Vector3): ChunkCoord {
        return this.worldToChunkCoord(worldPos.x, worldPos.z);
    }

    /** Convert world XZ coordinates to a chunk coordinate. */
    public worldToChunkCoord(x: number, z: number): ChunkCoord {
        return {
            x: Math.floor(x / this._config.chunkSize),
            z: Math.floor(z / this._config.chunkSize)
        };
    }

    /** Return the world-space center of a chunk. */
    public chunkToWorldCenter(coord: ChunkCoord): Vector3 {
        const half = this._config.chunkSize / 2;
        return new Vector3(
            coord.x * this._config.chunkSize + half,
            0,
            coord.z * this._config.chunkSize + half
        );
    }

    // ------------------------------------------------------------------
    // Public API – chunk queries
    // ------------------------------------------------------------------

    /** Check whether a chunk is currently loaded (state >= Loaded). */
    public isChunkLoaded(coord: ChunkCoord): boolean {
        const chunk = this._chunks.get(coordKey(coord));
        return chunk !== undefined &&
            (chunk.state === ChunkState.Loaded || chunk.state === ChunkState.Active);
    }

    /** Retrieve chunk data, or `null` if not tracked. */
    public getChunk(coord: ChunkCoord): ChunkData | null {
        return this._chunks.get(coordKey(coord)) ?? null;
    }

    /** Return all chunks in the Loaded or Active state. */
    public getLoadedChunks(): ChunkData[] {
        const out: ChunkData[] = [];
        this._chunks.forEach((c) => {
            if (c.state === ChunkState.Loaded || c.state === ChunkState.Active) {
                out.push(c);
            }
        });
        return out;
    }

    /** Return all chunks in the Active state. */
    public getActiveChunks(): ChunkData[] {
        const out: ChunkData[] = [];
        this._chunks.forEach((c) => {
            if (c.state === ChunkState.Active) out.push(c);
        });
        return out;
    }

    /** Number of chunks currently being loaded. */
    public getLoadingCount(): number {
        return this._activeLoads;
    }

    // ------------------------------------------------------------------
    // Public API – chunk manipulation
    // ------------------------------------------------------------------

    /** Immediately schedule a chunk for loading regardless of distance. */
    public forceLoadChunk(coord: ChunkCoord): void {
        const key = coordKey(coord);
        if (this._chunks.has(key)) return;
        this._enqueueLoad(coord, 0);
    }

    /** Immediately unload a specific chunk. */
    public forceUnloadChunk(coord: ChunkCoord): void {
        this._unloadChunk(coord);
    }

    /** Register an object ID in the chunk that contains `worldPos`. */
    public addObjectToChunk(objectId: string, worldPos: Vector3): void {
        const coord = this.getChunkAt(worldPos);
        const key = coordKey(coord);
        let chunk = this._chunks.get(key);
        if (!chunk) {
            chunk = this._createChunkData(coord);
            this._chunks.set(key, chunk);
        }
        if (!chunk.objects.includes(objectId)) {
            chunk.objects.push(objectId);
        }
        this._spatialHash.insert(objectId, worldPos.x, worldPos.z);
    }

    /** Remove an object ID from a specific chunk. */
    public removeObjectFromChunk(objectId: string, coord: ChunkCoord): void {
        const key = coordKey(coord);
        const chunk = this._chunks.get(key);
        if (chunk) {
            const idx = chunk.objects.indexOf(objectId);
            if (idx !== -1) chunk.objects.splice(idx, 1);
        }
        this._spatialHash.remove(objectId);
    }

    /** Return all object IDs within `radius` world units of `center`. */
    public getObjectsInRadius(center: Vector3, radius: number): string[] {
        return this._spatialHash.query(center.x, center.z, radius);
    }

    /** Override the LOD level for a specific chunk. */
    public setLODForChunk(coord: ChunkCoord, lod: number): void {
        const chunk = this._chunks.get(coordKey(coord));
        if (chunk) chunk.lod = lod;
    }

    /** Distance (in chunk units) from a chunk to a world position. */
    public getChunkDistance(coord: ChunkCoord, playerPos: Vector3): number {
        const center = this.chunkToWorldCenter(coord);
        const dx = center.x - playerPos.x;
        const dz = center.z - playerPos.z;
        return Math.sqrt(dx * dx + dz * dz) / this._config.chunkSize;
    }

    // ------------------------------------------------------------------
    // Public API – loader registration
    // ------------------------------------------------------------------

    /**
     * Register the asynchronous loader that provides terrain/content for a chunk.
     * The returned promise payload is stored in `ChunkData.terrain`.
     */
    public registerChunkLoader(loader: (coord: ChunkCoord, lod: number) => Promise<any>): void {
        this._chunkLoader = loader;
    }

    /** Register a callback invoked when a chunk is unloaded. */
    public registerChunkUnloader(unloader: (coord: ChunkCoord) => void): void {
        this._chunkUnloader = unloader;
    }

    // ------------------------------------------------------------------
    // Public API – statistics & lifecycle
    // ------------------------------------------------------------------

    /** Return a snapshot of streaming statistics. */
    public getStatistics(): {
        loaded: number;
        active: number;
        loading: number;
        cached: number;
        totalMemory: number;
    } {
        let loaded = 0;
        let active = 0;
        let loading = 0;

        this._chunks.forEach((c) => {
            if (c.state === ChunkState.Loaded) loaded++;
            else if (c.state === ChunkState.Active) active++;
            else if (c.state === ChunkState.Loading) loading++;
        });

        return {
            loaded,
            active,
            loading,
            cached: this._cache.size,
            totalMemory: this._chunks.size + this._cache.size
        };
    }

    /** Unload every chunk and reset internal state. */
    public clear(): void {
        this._chunks.forEach((_c, _key, map) => {
            const c = map.get(_key)!;
            if (this._chunkUnloader && c.state !== ChunkState.Unloaded) {
                this._chunkUnloader(c.coord);
            }
        });
        this._chunks.clear();
        this._cache.clear();
        this._loadQueue.length = 0;
        this._activeLoads = 0;
        this._spatialHash.clear();
    }

    /** Dispose the streaming system, releasing all resources. */
    public dispose(): void {
        this.clear();
        this._chunkLoader = null;
        this._chunkUnloader = null;
        this.onChunkLoad = null;
        this.onChunkUnload = null;
        this.onChunkActivate = null;
        this._disposed = true;
    }

    /** Merge partial config changes at runtime. */
    public setConfig(config: Partial<WorldStreamingConfig>): void {
        this._config = { ...this._config, ...config };
    }

    /** Return a copy of the current configuration. */
    public getConfig(): WorldStreamingConfig {
        return { ...this._config };
    }

    // ------------------------------------------------------------------
    // Public API – main update
    // ------------------------------------------------------------------

    /**
     * Main update tick – call once per frame.
     *
     * Evaluates which chunks should be loaded, activated, or unloaded based
     * on the player's current position and optional movement direction.
     *
     * @param playerPosition - Current player world position.
     * @param deltaTime - Time elapsed since the last frame (seconds).
     */
    public update(playerPosition: Vector3, deltaTime: number): void {
        if (this._disposed) return;

        // Track velocity for directional preloading
        if (deltaTime > 0) {
            this._playerVelocity = playerPosition.subtract(this._lastPlayerPos).multiplyScalar(1 / deltaTime);
        }
        this._lastPlayerPos = playerPosition.clone();

        const playerCoord = this.getChunkAt(playerPosition);
        const now = Date.now();

        this._updateChunkStates(playerCoord, playerPosition, now);
        this._enqueueNearbyChunks(playerCoord, playerPosition);
        this._processLoadQueue();
        this._trimCache();
    }

    // ------------------------------------------------------------------
    // Private – state transitions
    // ------------------------------------------------------------------

    private _updateChunkStates(
        playerCoord: ChunkCoord,
        _playerPos: Vector3,
        now: number
    ): void {
        const toUnload: ChunkCoord[] = [];

        this._chunks.forEach((chunk) => {
            const dist = this._coordDistance(chunk.coord, playerCoord);

            // Unload chunks outside unload radius
            if (dist > this._config.unloadRadius) {
                toUnload.push(chunk.coord);
                return;
            }

            // Activate chunks inside load radius that are Loaded
            if (dist <= this._config.loadRadius && chunk.state === ChunkState.Loaded) {
                chunk.state = ChunkState.Active;
                chunk.lastAccessTime = now;
                if (this.onChunkActivate) this.onChunkActivate(chunk);
            }

            // Deactivate Active chunks that drifted outside load radius
            if (dist > this._config.loadRadius && chunk.state === ChunkState.Active) {
                chunk.state = ChunkState.Loaded;
            }

            // Update LOD based on distance
            chunk.lod = this._computeLOD(dist);
        });

        for (const coord of toUnload) {
            this._unloadChunk(coord);
        }
    }

    private _enqueueNearbyChunks(playerCoord: ChunkCoord, playerPos: Vector3): void {
        const radius = this._config.loadRadius;
        const preload = this._config.preloadDirection ? 1 : 0;

        const minX = playerCoord.x - radius - preload;
        const maxX = playerCoord.x + radius + preload;
        const minZ = playerCoord.z - radius - preload;
        const maxZ = playerCoord.z + radius + preload;

        for (let cx = minX; cx <= maxX; cx++) {
            for (let cz = minZ; cz <= maxZ; cz++) {
                const dist = this._coordDistance({ x: cx, z: cz }, playerCoord);
                if (dist > this._config.loadRadius + preload) continue;

                const key = chunkKey(cx, cz);
                if (this._chunks.has(key)) continue;

                // Directional preloading bias
                let priority = dist;
                if (this._config.preloadDirection && this._playerVelocity.length() > MIN_VELOCITY_THRESHOLD) {
                    const dir = this._playerVelocity.normalize();
                    const toChunk = this.chunkToWorldCenter({ x: cx, z: cz }).subtract(playerPos);
                    const toChunkNorm = toChunk.length() > 0 ? toChunk.normalize() : toChunk;
                    const dot = dir.x * toChunkNorm.x + dir.z * toChunkNorm.z;
                    priority -= dot * 0.5; // lower priority = sooner
                }

                this._enqueueLoad({ x: cx, z: cz }, priority);
            }
        }
    }

    // ------------------------------------------------------------------
    // Private – loading / unloading
    // ------------------------------------------------------------------

    private _enqueueLoad(coord: ChunkCoord, priority: number): void {
        const key = coordKey(coord);
        if (this._chunks.has(key)) return;

        // Restore from cache if available
        const cached = this._cache.get(key);
        if (cached) {
            cached.state = ChunkState.Loaded;
            cached.lastAccessTime = Date.now();
            cached.priority = priority;
            this._chunks.set(key, cached);
            this._cache.delete(key);
            if (this.onChunkLoad) this.onChunkLoad(cached);
            return;
        }

        // Avoid duplicate queue entries
        if (this._loadQueue.some((c) => c.x === coord.x && c.z === coord.z)) return;

        this._loadQueue.push(coord);
        // Sort by priority ascending (nearest first)
        this._loadQueue.sort((a, b) => {
            return this._coordDistance(a, this.getChunkAt(this._lastPlayerPos))
                - this._coordDistance(b, this.getChunkAt(this._lastPlayerPos));
        });
    }

    private _processLoadQueue(): void {
        while (
            this._loadQueue.length > 0 &&
            this._activeLoads < this._config.maxConcurrentLoads
        ) {
            const coord = this._loadQueue.shift()!;
            const key = coordKey(coord);

            // Skip if already tracked
            if (this._chunks.has(key)) continue;

            const chunk = this._createChunkData(coord);
            chunk.state = ChunkState.Loading;
            this._chunks.set(key, chunk);
            this._activeLoads++;

            this._loadChunkAsync(chunk);
        }
    }

    private _loadChunkAsync(chunk: ChunkData): void {
        const loader = this._chunkLoader;
        if (!loader) {
            // No loader registered – transition straight to Loaded
            chunk.state = ChunkState.Loaded;
            chunk.loadTime = Date.now();
            chunk.lastAccessTime = Date.now();
            this._activeLoads = Math.max(0, this._activeLoads - 1);
            if (this.onChunkLoad) this.onChunkLoad(chunk);
            return;
        }

        loader(chunk.coord, chunk.lod)
            .then((terrain) => {
                if (this._disposed) return;
                const key = coordKey(chunk.coord);
                const current = this._chunks.get(key);
                if (!current || current.state !== ChunkState.Loading) {
                    // Chunk was removed while loading
                    this._activeLoads = Math.max(0, this._activeLoads - 1);
                    return;
                }
                current.terrain = terrain;
                current.state = ChunkState.Loaded;
                current.loadTime = Date.now();
                current.lastAccessTime = Date.now();
                this._activeLoads = Math.max(0, this._activeLoads - 1);
                if (this.onChunkLoad) this.onChunkLoad(current);
            })
            .catch(() => {
                // On failure, remove the chunk so it can be retried later
                const key = coordKey(chunk.coord);
                this._chunks.delete(key);
                this._activeLoads = Math.max(0, this._activeLoads - 1);
            });
    }

    private _unloadChunk(coord: ChunkCoord): void {
        const key = coordKey(coord);
        const chunk = this._chunks.get(key);
        if (!chunk) return;

        chunk.state = ChunkState.Unloading;

        if (this._chunkUnloader) {
            this._chunkUnloader(coord);
        }
        if (this.onChunkUnload) this.onChunkUnload(chunk);

        // Move to cache
        chunk.state = ChunkState.Unloaded;
        this._chunks.delete(key);
        this._cache.set(key, chunk);
    }

    // ------------------------------------------------------------------
    // Private – cache management
    // ------------------------------------------------------------------

    private _trimCache(): void {
        if (this._cache.size <= this._config.cacheSize) return;

        // Evict oldest entries first
        const entries = Array.from(this._cache.entries());
        entries.sort((a, b) => a[1].lastAccessTime - b[1].lastAccessTime);

        while (this._cache.size > this._config.cacheSize && entries.length > 0) {
            const oldest = entries.shift()!;
            this._cache.delete(oldest[0]);
        }
    }

    // ------------------------------------------------------------------
    // Private – helpers
    // ------------------------------------------------------------------

    private _createChunkData(coord: ChunkCoord): ChunkData {
        return {
            coord: { x: coord.x, z: coord.z },
            state: ChunkState.Unloaded,
            objects: [],
            terrain: undefined,
            loadTime: 0,
            lastAccessTime: 0,
            priority: 0,
            lod: 0
        };
    }

    /** Chebyshev distance between two chunk coordinates. */
    private _coordDistance(a: ChunkCoord, b: ChunkCoord): number {
        return Math.max(Math.abs(a.x - b.x), Math.abs(a.z - b.z));
    }

    private _computeLOD(chunkDist: number): number {
        const distances = this._config.lodDistances;
        for (let i = distances.length - 1; i >= 0; i--) {
            if (chunkDist >= distances[i]) return i;
        }
        return 0;
    }
}
