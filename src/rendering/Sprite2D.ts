/**
 * @module rendering
 * @fileoverview 2D sprite rendering system for games and UI.
 * Provides sprite sheets, animation, batching, and tile maps.
 */

import { Vector2 } from '../math/Vector2';

/** Flip mode for sprite rendering. */
export enum SpriteFlip {
    None = 0,
    Horizontal = 1,
    Vertical = 2,
    Both = 3
}

/** Blend mode for sprite compositing. */
export enum SpriteBlendMode {
    Normal = 0,
    Additive = 1,
    Multiply = 2,
    Screen = 3
}

/** Configuration for a sprite instance. */
export interface SpriteConfig {
    /** Width in world units. */
    width: number;
    /** Height in world units. */
    height: number;
    /** Horizontal pivot (0–1, 0 = left, 1 = right). */
    pivotX: number;
    /** Vertical pivot (0–1, 0 = top, 1 = bottom). */
    pivotY: number;
    /** RGBA tint colour, each component 0–1. */
    color: [number, number, number, number];
    /** Flip mode. */
    flip: SpriteFlip;
    /** Blend mode. */
    blendMode: SpriteBlendMode;
    /** Sorting layer (lower draws first). */
    sortingLayer: number;
    /** Order within the sorting layer. */
    sortingOrder: number;
    /** Whether the sprite is visible. */
    visible: boolean;
}

/** A rectangular region within a texture atlas. */
export interface SpriteFrame {
    /** X position in texture pixels. */
    x: number;
    /** Y position in texture pixels. */
    y: number;
    /** Width in texture pixels. */
    width: number;
    /** Height in texture pixels. */
    height: number;
    /** Optional horizontal offset for trimmed sprites. */
    offsetX?: number;
    /** Optional vertical offset for trimmed sprites. */
    offsetY?: number;
    /** Frame duration in milliseconds (for animation). */
    duration?: number;
}

/** Describes a named sprite animation sequence. */
export interface SpriteAnimation {
    /** Unique animation name. */
    name: string;
    /** Ordered list of frame names to play. */
    frames: string[];
    /** Milliseconds per frame. */
    frameDuration: number;
    /** Whether the animation loops. */
    loop: boolean;
    /** Whether the animation plays forward then backward. */
    pingPong: boolean;
}

// ---------------------------------------------------------------------------
// SpriteSheet
// ---------------------------------------------------------------------------

/** Manages named frames within a texture atlas. */
export class SpriteSheet {
    private _frames: Map<string, SpriteFrame> = new Map();
    private _textureWidth: number;
    private _textureHeight: number;

    /**
     * Creates a new SpriteSheet.
     * @param textureWidth - Full texture width in pixels.
     * @param textureHeight - Full texture height in pixels.
     */
    constructor(textureWidth: number, textureHeight: number) {
        this._textureWidth = textureWidth;
        this._textureHeight = textureHeight;
    }

    /**
     * Adds a named frame region.
     * @param name - Unique frame identifier.
     * @param x - X position in pixels.
     * @param y - Y position in pixels.
     * @param width - Frame width in pixels.
     * @param height - Frame height in pixels.
     */
    public addFrame(name: string, x: number, y: number, width: number, height: number): void {
        this._frames.set(name, { x, y, width, height });
    }

    /**
     * Retrieves a frame by name.
     * @param name - Frame identifier.
     * @returns The frame or null if not found.
     */
    public getFrame(name: string): SpriteFrame | null {
        return this._frames.get(name) ?? null;
    }

    /**
     * Auto-generates frames from a uniform grid.
     * @param columns - Number of columns in the grid.
     * @param rows - Number of rows in the grid.
     * @param frameWidth - Width of each cell in pixels.
     * @param frameHeight - Height of each cell in pixels.
     * @param prefix - Optional name prefix (default "frame_").
     */
    public generateGrid(
        columns: number,
        rows: number,
        frameWidth: number,
        frameHeight: number,
        prefix: string = 'frame_'
    ): void {
        let index = 0;
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < columns; col++) {
                this._frames.set(`${prefix}${index}`, {
                    x: col * frameWidth,
                    y: row * frameHeight,
                    width: frameWidth,
                    height: frameHeight
                });
                index++;
            }
        }
    }

    /** Returns the total number of frames. */
    public getFrameCount(): number {
        return this._frames.size;
    }

    /** Returns all frame names. */
    public getFrameNames(): string[] {
        return Array.from(this._frames.keys());
    }

    /**
     * Computes normalised UV coordinates for a frame.
     * @param frame - The sprite frame.
     * @returns UV rectangle { u0, v0, u1, v1 }.
     */
    public getUVs(frame: SpriteFrame): { u0: number; v0: number; u1: number; v1: number } {
        return {
            u0: frame.x / this._textureWidth,
            v0: frame.y / this._textureHeight,
            u1: (frame.x + frame.width) / this._textureWidth,
            v1: (frame.y + frame.height) / this._textureHeight
        };
    }

    /** Serialises the sprite sheet to a plain object. */
    public toJSON(): object {
        const frames: Record<string, SpriteFrame> = {};
        this._frames.forEach((f, name) => { frames[name] = f; });
        return {
            textureWidth: this._textureWidth,
            textureHeight: this._textureHeight,
            frames
        };
    }

    /**
     * Restores a SpriteSheet from serialised data.
     * @param data - Previously serialised sprite sheet.
     * @returns A new SpriteSheet instance.
     */
    public static fromJSON(data: {
        textureWidth: number;
        textureHeight: number;
        frames: Record<string, SpriteFrame>;
    }): SpriteSheet {
        const sheet = new SpriteSheet(data.textureWidth, data.textureHeight);
        for (const name of Object.keys(data.frames)) {
            const f = data.frames[name];
            sheet._frames.set(name, f);
        }
        return sheet;
    }
}

// ---------------------------------------------------------------------------
// SpriteAnimator
// ---------------------------------------------------------------------------

/** Drives frame-based sprite animations. */
export class SpriteAnimator {
    private _animations: Map<string, SpriteAnimation> = new Map();
    private _currentAnimation: string | null = null;
    private _currentFrameIndex: number = 0;
    private _elapsed: number = 0;
    private _playing: boolean = false;
    private _speed: number = 1;
    private _pingPongForward: boolean = true;

    /** Called when an animation finishes (non-looping) or completes a loop cycle. */
    public onAnimationEnd: ((name: string) => void) | null = null;
    /** Called whenever the current frame changes. */
    public onFrameChange: ((frameName: string) => void) | null = null;

    constructor() { /* intentionally empty */ }

    /**
     * Registers an animation.
     * @param animation - Animation definition to add.
     */
    public addAnimation(animation: SpriteAnimation): void {
        this._animations.set(animation.name, animation);
    }

    /**
     * Removes an animation by name. Stops playback if the removed animation is active.
     * @param name - Animation to remove.
     */
    public removeAnimation(name: string): void {
        this._animations.delete(name);
        if (this._currentAnimation === name) {
            this.stop();
        }
    }

    /**
     * Starts playing an animation from the beginning.
     * @param name - Animation name.
     */
    public play(name: string): void {
        if (!this._animations.has(name)) return;
        this._currentAnimation = name;
        this._currentFrameIndex = 0;
        this._elapsed = 0;
        this._playing = true;
        this._pingPongForward = true;
    }

    /** Stops the current animation and resets state. */
    public stop(): void {
        this._playing = false;
        this._currentAnimation = null;
        this._currentFrameIndex = 0;
        this._elapsed = 0;
    }

    /** Pauses the current animation without resetting. */
    public pause(): void {
        this._playing = false;
    }

    /** Resumes a paused animation. */
    public resume(): void {
        if (this._currentAnimation !== null) {
            this._playing = true;
        }
    }

    /**
     * Advances the animation by the given time.
     * @param deltaTime - Elapsed time in seconds.
     */
    public update(deltaTime: number): void {
        if (!this._playing || this._currentAnimation === null) return;

        const anim = this._animations.get(this._currentAnimation);
        if (!anim || anim.frames.length === 0) return;

        this._elapsed += deltaTime * 1000 * this._speed;

        while (this._elapsed >= anim.frameDuration) {
            this._elapsed -= anim.frameDuration;
            this._advanceFrame(anim);
        }
    }

    private _advanceFrame(anim: SpriteAnimation): void {
        const lastIndex = anim.frames.length - 1;
        const prevIndex = this._currentFrameIndex;

        if (anim.pingPong) {
            if (this._pingPongForward) {
                if (this._currentFrameIndex < lastIndex) {
                    this._currentFrameIndex++;
                } else {
                    this._pingPongForward = false;
                    this._currentFrameIndex--;
                }
            } else {
                if (this._currentFrameIndex > 0) {
                    this._currentFrameIndex--;
                } else {
                    this._pingPongForward = true;
                    this._currentFrameIndex++;
                    if (anim.loop) {
                        this.onAnimationEnd?.(anim.name);
                    } else {
                        this._playing = false;
                        this._currentFrameIndex = 0;
                        this.onAnimationEnd?.(anim.name);
                        return;
                    }
                }
            }
        } else {
            if (this._currentFrameIndex < lastIndex) {
                this._currentFrameIndex++;
            } else if (anim.loop) {
                this._currentFrameIndex = 0;
                this.onAnimationEnd?.(anim.name);
            } else {
                this._playing = false;
                this.onAnimationEnd?.(anim.name);
                return;
            }
        }

        if (this._currentFrameIndex !== prevIndex) {
            this.onFrameChange?.(anim.frames[this._currentFrameIndex]);
        }
    }

    /** Returns the current frame name, or null if idle. */
    public getCurrentFrame(): string | null {
        if (this._currentAnimation === null) return null;
        const anim = this._animations.get(this._currentAnimation);
        if (!anim || anim.frames.length === 0) return null;
        return anim.frames[this._currentFrameIndex];
    }

    /** Returns the current animation name, or null. */
    public getCurrentAnimation(): string | null {
        return this._currentAnimation;
    }

    /** Whether the animator is actively playing. */
    public isPlaying(): boolean {
        return this._playing;
    }

    /**
     * Sets the playback speed multiplier.
     * @param speed - Speed multiplier (1 = normal).
     */
    public setSpeed(speed: number): void {
        this._speed = speed;
    }

    /** Returns the current speed multiplier. */
    public getSpeed(): number {
        return this._speed;
    }
}

// ---------------------------------------------------------------------------
// Sprite
// ---------------------------------------------------------------------------

const DEFAULT_CONFIG: SpriteConfig = {
    width: 1,
    height: 1,
    pivotX: 0.5,
    pivotY: 0.5,
    color: [1, 1, 1, 1],
    flip: SpriteFlip.None,
    blendMode: SpriteBlendMode.Normal,
    sortingLayer: 0,
    sortingOrder: 0,
    visible: true
};

/** A 2D sprite with position, rotation, scale, animation, and hit-testing. */
export class Sprite {
    /** World position. */
    public position: Vector2;
    /** Rotation in radians. */
    public rotation: number = 0;
    /** Scale factor. */
    public scale: Vector2;
    /** Sprite configuration. */
    public config: SpriteConfig;
    /** Optional sprite sheet for texture atlas lookups. */
    public spriteSheet?: SpriteSheet;
    /** Optional animator for frame-based animation. */
    public animator?: SpriteAnimator;

    private _currentFrame: SpriteFrame | null = null;

    /**
     * Creates a new Sprite.
     * @param config - Optional partial configuration (defaults applied).
     */
    constructor(config?: Partial<SpriteConfig>) {
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.config.color = [...this.config.color] as [number, number, number, number];
        this.position = new Vector2(0, 0);
        this.scale = new Vector2(1, 1);
    }

    /**
     * Sets the active frame directly.
     * @param frame - Frame to display.
     */
    public setFrame(frame: SpriteFrame): void {
        this._currentFrame = frame;
    }

    /** Returns the current sprite frame, or null. */
    public getCurrentFrame(): SpriteFrame | null {
        return this._currentFrame;
    }

    /**
     * Updates animation state.
     * @param deltaTime - Elapsed time in seconds.
     */
    public update(deltaTime: number): void {
        if (this.animator && this.spriteSheet) {
            this.animator.update(deltaTime);
            const frameName = this.animator.getCurrentFrame();
            if (frameName !== null) {
                const frame = this.spriteSheet.getFrame(frameName);
                if (frame) {
                    this._currentFrame = frame;
                }
            }
        }
    }

    /**
     * Computes the axis-aligned bounding box in world space.
     * @returns Bounding rectangle { x, y, width, height }.
     */
    public getBounds(): { x: number; y: number; width: number; height: number } {
        const w = this.config.width * this.scale.x;
        const h = this.config.height * this.scale.y;
        const ox = this.position.x - w * this.config.pivotX;
        const oy = this.position.y - h * this.config.pivotY;
        return { x: ox, y: oy, width: w, height: h };
    }

    /**
     * Tests whether a world-space point lies inside the sprite bounds.
     * @param x - World X coordinate.
     * @param y - World Y coordinate.
     * @returns True if the point is inside the bounds.
     */
    public containsPoint(x: number, y: number): boolean {
        const b = this.getBounds();
        return x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height;
    }

    /**
     * Tests whether this sprite's bounds overlap with another sprite's bounds.
     * @param other - Sprite to test against.
     * @returns True if the bounding rectangles overlap.
     */
    public overlaps(other: Sprite): boolean {
        const a = this.getBounds();
        const b = other.getBounds();
        return a.x < b.x + b.width && a.x + a.width > b.x &&
               a.y < b.y + b.height && a.y + a.height > b.y;
    }

    /**
     * Sets the sprite opacity.
     * @param alpha - Opacity value (0–1).
     */
    public setOpacity(alpha: number): void {
        this.config.color[3] = Math.max(0, Math.min(1, alpha));
    }

    /**
     * Sets the RGB tint colour (alpha unchanged).
     * @param r - Red (0–1).
     * @param g - Green (0–1).
     * @param b - Blue (0–1).
     */
    public setTint(r: number, g: number, b: number): void {
        this.config.color[0] = r;
        this.config.color[1] = g;
        this.config.color[2] = b;
    }
}

// ---------------------------------------------------------------------------
// SpriteBatch
// ---------------------------------------------------------------------------

/** Manages a collection of sprites for efficient sorted rendering. */
export class SpriteBatch {
    private _sprites: Sprite[] = [];
    private _maxSprites: number;

    /**
     * Creates a new SpriteBatch.
     * @param maxSprites - Maximum number of sprites (default 10 000).
     */
    constructor(maxSprites: number = 10000) {
        this._maxSprites = maxSprites;
    }

    /**
     * Adds a sprite to the batch.
     * @param sprite - Sprite to add.
     */
    public addSprite(sprite: Sprite): void {
        if (this._sprites.length >= this._maxSprites) return;
        this._sprites.push(sprite);
    }

    /**
     * Removes a sprite from the batch.
     * @param sprite - Sprite to remove.
     */
    public removeSprite(sprite: Sprite): void {
        const idx = this._sprites.indexOf(sprite);
        if (idx !== -1) {
            this._sprites.splice(idx, 1);
        }
    }

    /** Removes all sprites from the batch. */
    public clear(): void {
        this._sprites.length = 0;
    }

    /** Sorts sprites by sorting layer, then sorting order (ascending). */
    public sort(): void {
        this._sprites.sort((a, b) => {
            if (a.config.sortingLayer !== b.config.sortingLayer) {
                return a.config.sortingLayer - b.config.sortingLayer;
            }
            return a.config.sortingOrder - b.config.sortingOrder;
        });
    }

    /** Returns a copy of the sprite list. */
    public getSprites(): Sprite[] {
        return [...this._sprites];
    }

    /** Returns the total sprite count. */
    public getSpriteCount(): number {
        return this._sprites.length;
    }

    /** Returns the number of visible sprites. */
    public getVisibleCount(): number {
        let count = 0;
        for (const s of this._sprites) {
            if (s.config.visible) count++;
        }
        return count;
    }
}

// ---------------------------------------------------------------------------
// TileMap
// ---------------------------------------------------------------------------

/** Tile data for a single map layer. */
interface TileLayer {
    name: string;
    data: Int32Array;
}

/** A 2D tile map with multiple layers. */
export class TileMap {
    private _tileWidth: number;
    private _tileHeight: number;
    private _mapWidth: number;
    private _mapHeight: number;
    private _layers: TileLayer[] = [];

    /**
     * Creates a new TileMap.
     * @param tileWidth - Width of a single tile in world units.
     * @param tileHeight - Height of a single tile in world units.
     * @param mapWidth - Number of tile columns.
     * @param mapHeight - Number of tile rows.
     */
    constructor(tileWidth: number, tileHeight: number, mapWidth: number, mapHeight: number) {
        this._tileWidth = tileWidth;
        this._tileHeight = tileHeight;
        this._mapWidth = mapWidth;
        this._mapHeight = mapHeight;
        // Create a default layer
        this.addLayer('default');
    }

    /**
     * Sets a tile value at the given grid position.
     * @param x - Tile column.
     * @param y - Tile row.
     * @param tileId - Tile identifier (0 = empty).
     * @param layer - Layer index (default 0).
     */
    public setTile(x: number, y: number, tileId: number, layer: number = 0): void {
        if (!this._isValid(x, y, layer)) return;
        this._layers[layer].data[y * this._mapWidth + x] = tileId;
    }

    /**
     * Gets the tile value at the given grid position.
     * @param x - Tile column.
     * @param y - Tile row.
     * @param layer - Layer index (default 0).
     * @returns The tile id, or 0 if out of bounds.
     */
    public getTile(x: number, y: number, layer: number = 0): number {
        if (!this._isValid(x, y, layer)) return 0;
        return this._layers[layer].data[y * this._mapWidth + x];
    }

    /**
     * Adds a new tile layer.
     * @param name - Layer name.
     * @returns The index of the newly created layer.
     */
    public addLayer(name: string): number {
        const data = new Int32Array(this._mapWidth * this._mapHeight);
        this._layers.push({ name, data });
        return this._layers.length - 1;
    }

    /**
     * Removes a layer by index.
     * @param index - Layer index to remove.
     */
    public removeLayer(index: number): void {
        if (index >= 0 && index < this._layers.length) {
            this._layers.splice(index, 1);
        }
    }

    /** Returns the number of layers. */
    public getLayerCount(): number {
        return this._layers.length;
    }

    /**
     * Converts world coordinates to tile grid coordinates.
     * @param worldX - World X position.
     * @param worldY - World Y position.
     * @returns Tile grid coordinates.
     */
    public worldToTile(worldX: number, worldY: number): { x: number; y: number } {
        return {
            x: Math.floor(worldX / this._tileWidth),
            y: Math.floor(worldY / this._tileHeight)
        };
    }

    /**
     * Converts tile grid coordinates to world position (top-left corner of tile).
     * @param tileX - Tile column.
     * @param tileY - Tile row.
     * @returns World position.
     */
    public tileToWorld(tileX: number, tileY: number): { x: number; y: number } {
        return {
            x: tileX * this._tileWidth,
            y: tileY * this._tileHeight
        };
    }

    /**
     * Returns all non-empty tiles that intersect a world-space rectangle.
     * @param x - Rectangle left edge in world units.
     * @param y - Rectangle top edge in world units.
     * @param width - Rectangle width in world units.
     * @param height - Rectangle height in world units.
     * @returns Array of tile entries.
     */
    public getTilesInRect(
        x: number,
        y: number,
        width: number,
        height: number
    ): Array<{ x: number; y: number; tileId: number }> {
        const result: Array<{ x: number; y: number; tileId: number }> = [];
        const startCol = Math.max(0, Math.floor(x / this._tileWidth));
        const startRow = Math.max(0, Math.floor(y / this._tileHeight));
        const endCol = Math.min(this._mapWidth - 1, Math.floor((x + width) / this._tileWidth));
        const endRow = Math.min(this._mapHeight - 1, Math.floor((y + height) / this._tileHeight));

        for (let layer = 0; layer < this._layers.length; layer++) {
            for (let row = startRow; row <= endRow; row++) {
                for (let col = startCol; col <= endCol; col++) {
                    const tileId = this._layers[layer].data[row * this._mapWidth + col];
                    if (tileId !== 0) {
                        result.push({ x: col, y: row, tileId });
                    }
                }
            }
        }
        return result;
    }

    /**
     * Fills an entire layer with a single tile id.
     * @param tileId - Tile identifier to fill with.
     * @param layer - Layer index (default 0).
     */
    public fill(tileId: number, layer: number = 0): void {
        if (layer < 0 || layer >= this._layers.length) return;
        this._layers[layer].data.fill(tileId);
    }

    /** Serialises the tile map to a plain object. */
    public toJSON(): object {
        return {
            tileWidth: this._tileWidth,
            tileHeight: this._tileHeight,
            mapWidth: this._mapWidth,
            mapHeight: this._mapHeight,
            layers: this._layers.map(l => ({
                name: l.name,
                data: Array.from(l.data)
            }))
        };
    }

    /**
     * Restores a TileMap from serialised data.
     * @param data - Previously serialised tile map.
     * @returns A new TileMap instance.
     */
    public static fromJSON(data: {
        tileWidth: number;
        tileHeight: number;
        mapWidth: number;
        mapHeight: number;
        layers: Array<{ name: string; data: number[] }>;
    }): TileMap {
        const map = new TileMap(data.tileWidth, data.tileHeight, data.mapWidth, data.mapHeight);
        // Remove the default layer created by the constructor
        map._layers.length = 0;
        for (const l of data.layers) {
            const layer: TileLayer = {
                name: l.name,
                data: new Int32Array(l.data)
            };
            map._layers.push(layer);
        }
        return map;
    }

    private _isValid(x: number, y: number, layer: number): boolean {
        return x >= 0 && x < this._mapWidth &&
               y >= 0 && y < this._mapHeight &&
               layer >= 0 && layer < this._layers.length;
    }
}
