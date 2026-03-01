/**
 * @module ui/GameUI
 * @fileoverview Canvas-based in-game UI framework for rendering HUD elements,
 * menus, and game UI components. Fully self-contained with no external dependencies.
 *
 * @example
 * ```typescript
 * const canvas = document.getElementById('game') as HTMLCanvasElement;
 * const ui = new GameUI(canvas);
 *
 * const healthBar = new UIHealthBar('hpBar', 10, 10, 200, 24);
 * healthBar.value = 0.75;
 * ui.addElement(healthBar);
 *
 * const score = new UIText('score', 0, 10, 200, 32);
 * score.text = 'Score: 1000';
 * score.anchor = UIAnchor.TopCenter;
 * ui.addElement(score);
 *
 * // In your game loop:
 * ui.render();
 * ```
 */

// ---------------------------------------------------------------------------
// Enums & Types
// ---------------------------------------------------------------------------

/** Anchor point for positioning UI elements relative to the canvas. */
export enum UIAnchor {
    TopLeft = 'top-left',
    TopCenter = 'top-center',
    TopRight = 'top-right',
    CenterLeft = 'center-left',
    Center = 'center',
    CenterRight = 'center-right',
    BottomLeft = 'bottom-left',
    BottomCenter = 'bottom-center',
    BottomRight = 'bottom-right',
}

/** Text horizontal alignment. */
export type TextAlign = 'left' | 'center' | 'right';

/** How an image fits inside its element bounds. */
export type ImageFit = 'fill' | 'contain' | 'cover';

/** Label display format for progress bars. */
export type LabelFormat = 'percent' | 'value' | 'custom';

// ---------------------------------------------------------------------------
// UIElement – abstract base
// ---------------------------------------------------------------------------

/**
 * Abstract base class for all UI elements.
 *
 * Provides positioning, hierarchy management, hit-testing, and anchor-aware
 * coordinate resolution. Concrete subclasses must implement {@link render}.
 *
 * @example
 * ```typescript
 * class UICircle extends UIElement {
 *     render(ctx: CanvasRenderingContext2D): void {
 *         const [ax, ay] = this.anchoredPosition(ctx.canvas.width, ctx.canvas.height);
 *         ctx.beginPath();
 *         ctx.arc(ax + this.width / 2, ay + this.height / 2, this.width / 2, 0, Math.PI * 2);
 *         ctx.fill();
 *     }
 * }
 * ```
 */
export abstract class UIElement {
    /** Unique identifier. */
    public id: string;
    /** X offset relative to the anchor point. */
    public x: number;
    /** Y offset relative to the anchor point. */
    public y: number;
    /** Element width in pixels. */
    public width: number;
    /** Element height in pixels. */
    public height: number;
    /** Whether the element is rendered and interactive. */
    public visible: boolean = true;
    /** Anchor determines the reference corner/edge for positioning. */
    public anchor: UIAnchor = UIAnchor.TopLeft;
    /** Opacity from 0 (transparent) to 1 (opaque). */
    public opacity: number = 1;
    /** Parent element, if any. */
    public parent: UIElement | null = null;
    /** Direct children. */
    public children: UIElement[] = [];

    constructor(id: string, x: number, y: number, width: number, height: number) {
        this.id = id;
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
    }

    /**
     * Add a child element.
     * @param child - The element to add as a child.
     */
    public addChild(child: UIElement): void {
        if (child.parent) {
            child.parent.removeChild(child.id);
        }
        child.parent = this;
        this.children.push(child);
    }

    /**
     * Remove a direct child by id.
     * @param id - Identifier of the child to remove.
     * @returns The removed element, or `null` if not found.
     */
    public removeChild(id: string): UIElement | null {
        const idx = this.children.findIndex((c) => c.id === id);
        if (idx === -1) return null;
        const removed = this.children.splice(idx, 1)[0];
        removed.parent = null;
        return removed;
    }

    /**
     * Recursively search this element and its descendants for a given id.
     * @param id - Identifier to search for.
     * @returns The matching element, or `null`.
     */
    public findById(id: string): UIElement | null {
        if (this.id === id) return this;
        for (const child of this.children) {
            const found = child.findById(id);
            if (found) return found;
        }
        return null;
    }

    /**
     * Test whether a point (in canvas coordinates) falls within this element.
     * @param px - X coordinate to test.
     * @param py - Y coordinate to test.
     * @param canvasWidth - Width of the canvas for anchor resolution.
     * @param canvasHeight - Height of the canvas for anchor resolution.
     * @returns `true` if the point is inside the element bounds.
     */
    public hitTest(px: number, py: number, canvasWidth: number, canvasHeight: number): boolean {
        if (!this.visible) return false;
        const [ax, ay] = this.anchoredPosition(canvasWidth, canvasHeight);
        return px >= ax && px <= ax + this.width && py >= ay && py <= ay + this.height;
    }

    /**
     * Resolve the absolute top-left position on the canvas, taking the anchor
     * and any parent offset into account.
     * @param canvasWidth - Canvas width in pixels.
     * @param canvasHeight - Canvas height in pixels.
     * @returns A tuple `[absoluteX, absoluteY]`.
     */
    public anchoredPosition(canvasWidth: number, canvasHeight: number): [number, number] {
        let ox = 0;
        let oy = 0;

        switch (this.anchor) {
            case UIAnchor.TopLeft:
                break;
            case UIAnchor.TopCenter:
                ox = canvasWidth / 2 - this.width / 2;
                break;
            case UIAnchor.TopRight:
                ox = canvasWidth - this.width;
                break;
            case UIAnchor.CenterLeft:
                oy = canvasHeight / 2 - this.height / 2;
                break;
            case UIAnchor.Center:
                ox = canvasWidth / 2 - this.width / 2;
                oy = canvasHeight / 2 - this.height / 2;
                break;
            case UIAnchor.CenterRight:
                ox = canvasWidth - this.width;
                oy = canvasHeight / 2 - this.height / 2;
                break;
            case UIAnchor.BottomLeft:
                oy = canvasHeight - this.height;
                break;
            case UIAnchor.BottomCenter:
                ox = canvasWidth / 2 - this.width / 2;
                oy = canvasHeight - this.height;
                break;
            case UIAnchor.BottomRight:
                ox = canvasWidth - this.width;
                oy = canvasHeight - this.height;
                break;
        }

        let baseX = ox + this.x;
        let baseY = oy + this.y;

        if (this.parent) {
            const [px, py] = this.parent.anchoredPosition(canvasWidth, canvasHeight);
            baseX += px;
            baseY += py;
        }

        return [baseX, baseY];
    }

    /**
     * Render this element onto the provided 2D context.
     * Implementations must call {@link anchoredPosition} to resolve coordinates.
     * @param ctx - The canvas 2D rendering context.
     */
    public abstract render(ctx: CanvasRenderingContext2D): void;

    /**
     * Render this element and all visible children, respecting opacity.
     * @param ctx - The canvas 2D rendering context.
     */
    public renderTree(ctx: CanvasRenderingContext2D): void {
        if (!this.visible || this.opacity <= 0) return;

        const needsAlpha = this.opacity < 1;
        if (needsAlpha) {
            ctx.save();
            ctx.globalAlpha *= this.opacity;
        }

        this.render(ctx);

        for (const child of this.children) {
            child.renderTree(ctx);
        }

        if (needsAlpha) {
            ctx.restore();
        }
    }
}

// ---------------------------------------------------------------------------
// UIText
// ---------------------------------------------------------------------------

/**
 * Renders a single line of text with optional shadow.
 *
 * @example
 * ```typescript
 * const label = new UIText('title', 0, 20, 300, 40);
 * label.text = 'Game Over';
 * label.fontSize = 36;
 * label.bold = true;
 * label.shadow = true;
 * label.anchor = UIAnchor.TopCenter;
 * ```
 */
export class UIText extends UIElement {
    /** Text string to render. */
    public text: string = '';
    /** Font size in pixels. */
    public fontSize: number = 16;
    /** CSS font family. */
    public fontFamily: string = 'Arial, sans-serif';
    /** Fill colour (any CSS colour value). */
    public color: string = '#ffffff';
    /** Horizontal text alignment within the element bounds. */
    public align: TextAlign = 'left';
    /** Whether to render in bold. */
    public bold: boolean = false;
    /** Whether to render in italic. */
    public italic: boolean = false;
    /** Enable a drop-shadow behind the text. */
    public shadow: boolean = false;
    /** Shadow colour. */
    public shadowColor: string = 'rgba(0,0,0,0.6)';
    /** Shadow offset in pixels. */
    public shadowOffsetX: number = 2;
    /** Shadow offset in pixels. */
    public shadowOffsetY: number = 2;

    constructor(id: string, x: number, y: number, width: number, height: number) {
        super(id, x, y, width, height);
    }

    /** @inheritdoc */
    public render(ctx: CanvasRenderingContext2D): void {
        const [ax, ay] = this.anchoredPosition(ctx.canvas.width, ctx.canvas.height);
        const style = `${this.italic ? 'italic ' : ''}${this.bold ? 'bold ' : ''}${this.fontSize}px ${this.fontFamily}`;
        ctx.font = style;
        ctx.textBaseline = 'top';

        let tx = ax;
        if (this.align === 'center') {
            ctx.textAlign = 'center';
            tx = ax + this.width / 2;
        } else if (this.align === 'right') {
            ctx.textAlign = 'right';
            tx = ax + this.width;
        } else {
            ctx.textAlign = 'left';
        }

        const ty = ay + (this.height - this.fontSize) / 2;

        if (this.shadow) {
            ctx.fillStyle = this.shadowColor;
            ctx.fillText(this.text, tx + this.shadowOffsetX, ty + this.shadowOffsetY);
        }

        ctx.fillStyle = this.color;
        ctx.fillText(this.text, tx, ty);
    }
}

// ---------------------------------------------------------------------------
// UIPanel
// ---------------------------------------------------------------------------

/** Optional linear gradient definition for panels. */
export interface UIGradient {
    /** Start colour. */
    from: string;
    /** End colour. */
    to: string;
    /** Angle in degrees (0 = top-to-bottom). */
    angle?: number;
}

/**
 * A rectangular panel with optional rounded corners and gradient fill.
 *
 * @example
 * ```typescript
 * const panel = new UIPanel('hud-bg', 10, 10, 300, 100);
 * panel.backgroundColor = 'rgba(0,0,0,0.7)';
 * panel.borderRadius = 8;
 * ```
 */
export class UIPanel extends UIElement {
    /** Background fill colour. */
    public backgroundColor: string = 'rgba(0,0,0,0.5)';
    /** Border stroke colour. */
    public borderColor: string = 'transparent';
    /** Border line width. */
    public borderWidth: number = 0;
    /** Corner radius for rounded rectangles. */
    public borderRadius: number = 0;
    /** Optional gradient that overrides backgroundColor. */
    public gradient: UIGradient | null = null;

    constructor(id: string, x: number, y: number, width: number, height: number) {
        super(id, x, y, width, height);
    }

    /** @inheritdoc */
    public render(ctx: CanvasRenderingContext2D): void {
        const [ax, ay] = this.anchoredPosition(ctx.canvas.width, ctx.canvas.height);

        ctx.beginPath();
        this._roundedRect(ctx, ax, ay, this.width, this.height, this.borderRadius);

        if (this.gradient) {
            const angle = ((this.gradient.angle ?? 0) * Math.PI) / 180;
            const cx = ax + this.width / 2;
            const cy = ay + this.height / 2;
            const len = Math.max(this.width, this.height);
            const dx = Math.sin(angle) * len / 2;
            const dy = Math.cos(angle) * len / 2;
            const grad = ctx.createLinearGradient(cx - dx, cy - dy, cx + dx, cy + dy);
            grad.addColorStop(0, this.gradient.from);
            grad.addColorStop(1, this.gradient.to);
            ctx.fillStyle = grad;
        } else {
            ctx.fillStyle = this.backgroundColor;
        }
        ctx.fill();

        if (this.borderWidth > 0 && this.borderColor !== 'transparent') {
            ctx.lineWidth = this.borderWidth;
            ctx.strokeStyle = this.borderColor;
            ctx.stroke();
        }
    }

    /** Draw a rounded rectangle path. */
    private _roundedRect(
        ctx: CanvasRenderingContext2D,
        x: number,
        y: number,
        w: number,
        h: number,
        r: number,
    ): void {
        const radius = Math.min(r, w / 2, h / 2);
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + w - radius, y);
        ctx.arcTo(x + w, y, x + w, y + radius, radius);
        ctx.lineTo(x + w, y + h - radius);
        ctx.arcTo(x + w, y + h, x + w - radius, y + h, radius);
        ctx.lineTo(x + radius, y + h);
        ctx.arcTo(x, y + h, x, y + h - radius, radius);
        ctx.lineTo(x, y + radius);
        ctx.arcTo(x, y, x + radius, y, radius);
        ctx.closePath();
    }
}

// ---------------------------------------------------------------------------
// UIButton
// ---------------------------------------------------------------------------

/**
 * An interactive button with hover, pressed, and disabled visual states.
 *
 * @example
 * ```typescript
 * const btn = new UIButton('startBtn', 0, 0, 160, 48);
 * btn.label = 'Start Game';
 * btn.anchor = UIAnchor.Center;
 * btn.onClick = () => console.log('clicked!');
 * ```
 */
export class UIButton extends UIElement {
    /** Button label text. */
    public label: string = '';
    /** Label font size. */
    public fontSize: number = 16;
    /** Label font family. */
    public fontFamily: string = 'Arial, sans-serif';
    /** Label text colour. */
    public textColor: string = '#ffffff';
    /** Default background colour. */
    public backgroundColor: string = '#3366cc';
    /** Background colour when hovered. */
    public hoverColor: string = '#4477dd';
    /** Background colour when pressed. */
    public pressedColor: string = '#224499';
    /** Background colour when disabled. */
    public disabledColor: string = '#666666';
    /** Border radius for rounded corners. */
    public borderRadius: number = 4;
    /** Whether the button is disabled. */
    public disabled: boolean = false;
    /** Whether the pointer is currently over the button. */
    public hovered: boolean = false;
    /** Whether the button is currently being pressed. */
    public pressed: boolean = false;
    /** Callback invoked on click. */
    public onClick: (() => void) | null = null;

    constructor(id: string, x: number, y: number, width: number, height: number) {
        super(id, x, y, width, height);
    }

    /**
     * Handle pointer movement to update hover state.
     * @param px - Pointer X in canvas coordinates.
     * @param py - Pointer Y in canvas coordinates.
     * @param canvasWidth - Canvas width.
     * @param canvasHeight - Canvas height.
     */
    public onMouseMove(px: number, py: number, canvasWidth: number, canvasHeight: number): void {
        this.hovered = this.hitTest(px, py, canvasWidth, canvasHeight);
        if (!this.hovered) this.pressed = false;
    }

    /**
     * Handle pointer down.
     * @param px - Pointer X in canvas coordinates.
     * @param py - Pointer Y in canvas coordinates.
     * @param canvasWidth - Canvas width.
     * @param canvasHeight - Canvas height.
     */
    public onMouseDown(px: number, py: number, canvasWidth: number, canvasHeight: number): void {
        if (this.hitTest(px, py, canvasWidth, canvasHeight) && !this.disabled) {
            this.pressed = true;
        }
    }

    /**
     * Handle pointer up. Fires {@link onClick} if released over the button.
     * @param px - Pointer X in canvas coordinates.
     * @param py - Pointer Y in canvas coordinates.
     * @param canvasWidth - Canvas width.
     * @param canvasHeight - Canvas height.
     */
    public onMouseUp(px: number, py: number, canvasWidth: number, canvasHeight: number): void {
        if (this.pressed && this.hitTest(px, py, canvasWidth, canvasHeight) && !this.disabled) {
            this.onClick?.();
        }
        this.pressed = false;
    }

    /** @inheritdoc */
    public render(ctx: CanvasRenderingContext2D): void {
        const [ax, ay] = this.anchoredPosition(ctx.canvas.width, ctx.canvas.height);

        let bg = this.backgroundColor;
        if (this.disabled) bg = this.disabledColor;
        else if (this.pressed) bg = this.pressedColor;
        else if (this.hovered) bg = this.hoverColor;

        ctx.beginPath();
        const r = Math.min(this.borderRadius, this.width / 2, this.height / 2);
        ctx.moveTo(ax + r, ay);
        ctx.lineTo(ax + this.width - r, ay);
        ctx.arcTo(ax + this.width, ay, ax + this.width, ay + r, r);
        ctx.lineTo(ax + this.width, ay + this.height - r);
        ctx.arcTo(ax + this.width, ay + this.height, ax + this.width - r, ay + this.height, r);
        ctx.lineTo(ax + r, ay + this.height);
        ctx.arcTo(ax, ay + this.height, ax, ay + this.height - r, r);
        ctx.lineTo(ax, ay + r);
        ctx.arcTo(ax, ay, ax + r, ay, r);
        ctx.closePath();

        ctx.fillStyle = bg;
        ctx.fill();

        // Label
        ctx.fillStyle = this.disabled ? '#999999' : this.textColor;
        ctx.font = `${this.fontSize}px ${this.fontFamily}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.label, ax + this.width / 2, ay + this.height / 2);
    }
}

// ---------------------------------------------------------------------------
// UIImage
// ---------------------------------------------------------------------------

/**
 * Displays an `HTMLImageElement` inside its bounds with configurable fit mode.
 *
 * @example
 * ```typescript
 * const icon = new UIImage('icon', 10, 10, 64, 64);
 * const img = new Image();
 * img.src = 'icon.png';
 * icon.image = img;
 * icon.fit = 'contain';
 * ```
 */
export class UIImage extends UIElement {
    /** The image to draw. Null images are silently skipped. */
    public image: HTMLImageElement | null = null;
    /** Optional tint colour applied as a multiply blend. */
    public tint: string | null = null;
    /** How the image fits its element bounds. */
    public fit: ImageFit = 'fill';

    constructor(id: string, x: number, y: number, width: number, height: number) {
        super(id, x, y, width, height);
    }

    /** @inheritdoc */
    public render(ctx: CanvasRenderingContext2D): void {
        if (!this.image || !this.image.complete) return;

        const [ax, ay] = this.anchoredPosition(ctx.canvas.width, ctx.canvas.height);
        const iw = this.image.naturalWidth || this.image.width;
        const ih = this.image.naturalHeight || this.image.height;

        if (iw === 0 || ih === 0) return;

        let dx = ax;
        let dy = ay;
        let dw = this.width;
        let dh = this.height;

        if (this.fit === 'contain' || this.fit === 'cover') {
            const aspectImg = iw / ih;
            const aspectBox = this.width / this.height;
            const useWidth =
                this.fit === 'contain' ? aspectImg > aspectBox : aspectImg < aspectBox;

            if (useWidth) {
                dw = this.width;
                dh = this.width / aspectImg;
            } else {
                dh = this.height;
                dw = this.height * aspectImg;
            }
            dx = ax + (this.width - dw) / 2;
            dy = ay + (this.height - dh) / 2;
        }

        ctx.save();
        if (this.fit === 'cover') {
            ctx.beginPath();
            ctx.rect(ax, ay, this.width, this.height);
            ctx.clip();
        }
        ctx.drawImage(this.image, dx, dy, dw, dh);

        if (this.tint) {
            ctx.globalCompositeOperation = 'multiply';
            ctx.fillStyle = this.tint;
            ctx.fillRect(dx, dy, dw, dh);
            ctx.globalCompositeOperation = 'source-over';
        }
        ctx.restore();
    }
}

// ---------------------------------------------------------------------------
// UIProgressBar
// ---------------------------------------------------------------------------

/**
 * A horizontal progress bar with optional label.
 *
 * @example
 * ```typescript
 * const xpBar = new UIProgressBar('xp', 10, 50, 200, 20);
 * xpBar.value = 0.6;
 * xpBar.barColor = '#22cc66';
 * xpBar.showLabel = true;
 * ```
 */
export class UIProgressBar extends UIElement {
    /** Current value in the range [0, {@link maxValue}]. */
    public value: number = 1;
    /** Maximum value. */
    public maxValue: number = 1;
    /** Fill colour for the bar. */
    public barColor: string = '#22cc66';
    /** Background colour behind the bar. */
    public backgroundColor: string = 'rgba(0,0,0,0.5)';
    /** Border stroke colour. */
    public borderColor: string = '#ffffff';
    /** Border line width. */
    public borderWidth: number = 1;
    /** Whether to display a text label over the bar. */
    public showLabel: boolean = false;
    /** Label display format. */
    public labelFormat: LabelFormat = 'percent';
    /** Custom label string used when labelFormat is `'custom'`. */
    public customLabel: string = '';
    /** Label font size. */
    public labelFontSize: number = 12;
    /** Label colour. */
    public labelColor: string = '#ffffff';

    constructor(id: string, x: number, y: number, width: number, height: number) {
        super(id, x, y, width, height);
    }

    /** Normalised progress in [0, 1]. */
    protected get _fraction(): number {
        if (this.maxValue <= 0) return 0;
        return Math.max(0, Math.min(this.value / this.maxValue, 1));
    }

    /** @inheritdoc */
    public render(ctx: CanvasRenderingContext2D): void {
        const [ax, ay] = this.anchoredPosition(ctx.canvas.width, ctx.canvas.height);

        // Background
        ctx.fillStyle = this.backgroundColor;
        ctx.fillRect(ax, ay, this.width, this.height);

        // Fill
        ctx.fillStyle = this.barColor;
        ctx.fillRect(ax, ay, this.width * this._fraction, this.height);

        // Border
        if (this.borderWidth > 0) {
            ctx.strokeStyle = this.borderColor;
            ctx.lineWidth = this.borderWidth;
            ctx.strokeRect(ax, ay, this.width, this.height);
        }

        // Label
        if (this.showLabel) {
            this._renderLabel(ctx, ax, ay);
        }
    }

    /** Draw the progress label centred on the bar. */
    protected _renderLabel(ctx: CanvasRenderingContext2D, ax: number, ay: number): void {
        let text: string;
        switch (this.labelFormat) {
            case 'percent':
                text = `${Math.round(this._fraction * 100)}%`;
                break;
            case 'value':
                text = `${Math.round(this.value)} / ${Math.round(this.maxValue)}`;
                break;
            case 'custom':
                text = this.customLabel;
                break;
        }

        ctx.fillStyle = this.labelColor;
        ctx.font = `${this.labelFontSize}px Arial, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, ax + this.width / 2, ay + this.height / 2);
    }
}

// ---------------------------------------------------------------------------
// UIHealthBar
// ---------------------------------------------------------------------------

/**
 * Specialised progress bar for displaying player/entity health with colour
 * transitions and a low-health pulse effect.
 *
 * @example
 * ```typescript
 * const hp = new UIHealthBar('hp', 10, 10, 200, 24);
 * hp.value = 0.3;
 * hp.pulseWhenLow = true;
 * ```
 */
export class UIHealthBar extends UIProgressBar {
    /** Colour when health is above the low threshold. */
    public healthColor: string = '#22cc44';
    /** Colour for the "damage flash" region (drawn behind the health fill). */
    public damageColor: string = '#cc4422';
    /** Fraction (0-1) below which health is considered low. */
    public lowHealthThreshold: number = 0.25;
    /** Colour used when health drops below the threshold. */
    public lowHealthColor: string = '#cc2222';
    /** Enable pulsing animation when health is below the threshold. */
    public pulseWhenLow: boolean = false;

    private _previousFraction: number = 1;
    private _damageDisplayFraction: number = 1;

    constructor(id: string, x: number, y: number, width: number, height: number) {
        super(id, x, y, width, height);
    }

    /** @inheritdoc */
    public render(ctx: CanvasRenderingContext2D): void {
        const [ax, ay] = this.anchoredPosition(ctx.canvas.width, ctx.canvas.height);
        const frac = this._fraction;

        // Animate the damage "ghost" bar towards current value
        if (frac < this._previousFraction) {
            this._damageDisplayFraction = this._previousFraction;
        }
        this._damageDisplayFraction += (frac - this._damageDisplayFraction) * 0.05;
        if (Math.abs(this._damageDisplayFraction - frac) < 0.001) {
            this._damageDisplayFraction = frac;
        }
        this._previousFraction = frac;

        // Pulse opacity when low – uses wall-clock time so the animation
        // speed is consistent regardless of frame rate.
        let alpha = 1;
        if (this.pulseWhenLow && frac > 0 && frac <= this.lowHealthThreshold) {
            alpha = 0.6 + 0.4 * Math.abs(Math.sin(Date.now() / 200));
        }

        ctx.save();
        ctx.globalAlpha *= alpha;

        // Background
        ctx.fillStyle = this.backgroundColor;
        ctx.fillRect(ax, ay, this.width, this.height);

        // Damage region
        if (this._damageDisplayFraction > frac) {
            ctx.fillStyle = this.damageColor;
            ctx.fillRect(ax, ay, this.width * this._damageDisplayFraction, this.height);
        }

        // Health fill
        ctx.fillStyle = frac <= this.lowHealthThreshold ? this.lowHealthColor : this.healthColor;
        ctx.fillRect(ax, ay, this.width * frac, this.height);

        // Border
        if (this.borderWidth > 0) {
            ctx.strokeStyle = this.borderColor;
            ctx.lineWidth = this.borderWidth;
            ctx.strokeRect(ax, ay, this.width, this.height);
        }

        ctx.restore();

        // Label (rendered outside the alpha save so it doesn't pulse)
        if (this.showLabel) {
            this._renderLabel(ctx, ax, ay);
        }
    }
}

// ---------------------------------------------------------------------------
// GameUI – manager
// ---------------------------------------------------------------------------

/**
 * Root manager for the in-game UI layer.
 *
 * Owns the element tree, dispatches pointer events to interactive elements,
 * and drives the per-frame render pass.
 *
 * @example
 * ```typescript
 * const ui = new GameUI(canvas);
 *
 * canvas.addEventListener('mousemove', (e) => ui.handleMouseMove(e.offsetX, e.offsetY));
 * canvas.addEventListener('mousedown', (e) => ui.handleMouseDown(e.offsetX, e.offsetY));
 * canvas.addEventListener('mouseup', (e) => ui.handleMouseUp(e.offsetX, e.offsetY));
 *
 * function loop() {
 *     ui.render();
 *     requestAnimationFrame(loop);
 * }
 * loop();
 * ```
 */
export class GameUI {
    private _canvas: HTMLCanvasElement;
    private _ctx: CanvasRenderingContext2D;
    private _elements: UIElement[] = [];
    private _scale: number = 1;

    /**
     * Create a new GameUI bound to the given canvas.
     * @param canvas - The target canvas element.
     */
    constructor(canvas: HTMLCanvasElement) {
        this._canvas = canvas;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('GameUI: failed to obtain 2D rendering context');
        this._ctx = ctx;
    }

    /**
     * Add a root-level UI element.
     * @param element - The element to add.
     */
    public addElement(element: UIElement): void {
        this._elements.push(element);
    }

    /**
     * Remove a root-level element by id.
     * @param id - Identifier of the element to remove.
     */
    public removeElement(id: string): void {
        this._elements = this._elements.filter((e) => e.id !== id);
    }

    /**
     * Find any element (root or nested) by its id.
     * @param id - Identifier to search for.
     * @returns The matching element, or `null`.
     */
    public getElementById(id: string): UIElement | null {
        for (const el of this._elements) {
            const found = el.findById(id);
            if (found) return found;
        }
        return null;
    }

    /**
     * Render all visible elements onto the canvas.
     * Call once per frame inside your game loop.
     */
    public render(): void {
        this._ctx.save();
        if (this._scale !== 1) {
            this._ctx.scale(this._scale, this._scale);
        }
        for (const el of this._elements) {
            el.renderTree(this._ctx);
        }
        this._ctx.restore();
    }

    /**
     * Forward a pointer-move event to all interactive elements.
     * @param x - Pointer X in canvas coordinates.
     * @param y - Pointer Y in canvas coordinates.
     */
    public handleMouseMove(x: number, y: number): void {
        const sx = x / this._scale;
        const sy = y / this._scale;
        this._forEachButton((btn) => {
            btn.onMouseMove(sx, sy, this._canvas.width / this._scale, this._canvas.height / this._scale);
        });
    }

    /**
     * Forward a pointer-down event to all interactive elements.
     * @param x - Pointer X in canvas coordinates.
     * @param y - Pointer Y in canvas coordinates.
     */
    public handleMouseDown(x: number, y: number): void {
        const sx = x / this._scale;
        const sy = y / this._scale;
        this._forEachButton((btn) => {
            btn.onMouseDown(sx, sy, this._canvas.width / this._scale, this._canvas.height / this._scale);
        });
    }

    /**
     * Forward a pointer-up event to all interactive elements.
     * @param x - Pointer X in canvas coordinates.
     * @param y - Pointer Y in canvas coordinates.
     */
    public handleMouseUp(x: number, y: number): void {
        const sx = x / this._scale;
        const sy = y / this._scale;
        this._forEachButton((btn) => {
            btn.onMouseUp(sx, sy, this._canvas.width / this._scale, this._canvas.height / this._scale);
        });
    }

    /**
     * Set a uniform scale factor applied to all UI rendering.
     * @param scale - Scale multiplier (1 = no scaling).
     */
    public setScale(scale: number): void {
        this._scale = Math.max(0.1, scale);
    }

    /** Remove all elements from the UI. */
    public clear(): void {
        this._elements = [];
    }

    /**
     * Get the total number of root-level elements.
     * @returns Element count.
     */
    public getElementCount(): number {
        return this._elements.length;
    }

    /** Recursively visit every UIButton in the element tree. */
    private _forEachButton(callback: (btn: UIButton) => void): void {
        const visit = (el: UIElement): void => {
            if (el instanceof UIButton) callback(el);
            for (const child of el.children) visit(child);
        };
        for (const el of this._elements) visit(el);
    }
}
