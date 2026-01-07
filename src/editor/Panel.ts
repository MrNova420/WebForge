/**
 * WebForge Editor Panel System
 * 
 * Base classes for editor panels with lifecycle management,
 * resizing, collapsing, and event handling.
 */

import { EventSystem } from '../core/EventSystem';

/**
 * Base Panel class
 * 
 * All editor panels extend this class for consistent behavior.
 * Provides lifecycle hooks, visibility, resizing, and event management.
 */
export abstract class Panel {
    protected id: string;
    protected title: string;
    protected container: HTMLElement | null = null;
    protected events: EventSystem;
    protected visible: boolean = true;
    protected collapsed: boolean = false;
    protected width: number = 300;
    protected height: number = 200;
    protected minWidth: number = 150;
    protected minHeight: number = 100;
    protected focused: boolean = false;
    
    constructor(id: string, title: string) {
        this.id = id;
        this.title = title;
        this.events = new EventSystem();
    }
    
    /**
     * Get the panel ID
     */
    public getId(): string {
        return this.id;
    }
    
    /**
     * Get the panel title
     */
    public getTitle(): string {
        return this.title;
    }
    
    /**
     * Get the event system
     */
    public getEvents(): EventSystem {
        return this.events;
    }
    
    /**
     * Mount the panel to a container element
     */
    public mount(container: HTMLElement): void {
        this.container = container;
        this.container.style.width = `${this.width}px`;
        this.container.style.height = `${this.height}px`;
        this.container.style.display = this.visible ? 'block' : 'none';
        
        this.onMount(container);
        this.events.emit('mounted');
    }
    
    /**
     * Unmount the panel
     */
    public unmount(): void {
        if (this.container) {
            this.onUnmount();
            this.container.innerHTML = '';
            this.container = null;
            this.events.emit('unmounted');
        }
    }
    
    /**
     * Update the panel (called each frame)
     */
    public update(deltaTime: number): void {
        if (this.visible && !this.collapsed) {
            this.onUpdate(deltaTime);
        }
    }
    
    /**
     * Show the panel
     */
    public show(): void {
        if (!this.visible) {
            this.visible = true;
            if (this.container) {
                this.container.style.display = 'block';
            }
            this.events.emit('shown');
        }
    }
    
    /**
     * Hide the panel
     */
    public hide(): void {
        if (this.visible) {
            this.visible = false;
            if (this.container) {
                this.container.style.display = 'none';
            }
            this.events.emit('hidden');
        }
    }
    
    /**
     * Check if the panel is visible
     */
    public isVisible(): boolean {
        return this.visible;
    }
    
    /**
     * Collapse the panel (hide content, show only header)
     */
    public collapse(): void {
        if (!this.collapsed) {
            this.collapsed = true;
            this.events.emit('collapsed');
        }
    }
    
    /**
     * Expand the panel
     */
    public expand(): void {
        if (this.collapsed) {
            this.collapsed = false;
            this.events.emit('expanded');
        }
    }
    
    /**
     * Check if the panel is collapsed
     */
    public isCollapsed(): boolean {
        return this.collapsed;
    }
    
    /**
     * Set panel size
     */
    public setSize(width: number, height: number): void {
        this.width = Math.max(width, this.minWidth);
        this.height = Math.max(height, this.minHeight);
        
        if (this.container) {
            this.container.style.width = `${this.width}px`;
            this.container.style.height = `${this.height}px`;
        }
        
        this.events.emit('resized', { width: this.width, height: this.height });
        this.onResize(this.width, this.height);
    }
    
    /**
     * Get panel width
     */
    public getWidth(): number {
        return this.width;
    }
    
    /**
     * Get panel height
     */
    public getHeight(): number {
        return this.height;
    }
    
    /**
     * Set minimum size
     */
    public setMinSize(width: number, height: number): void {
        this.minWidth = width;
        this.minHeight = height;
    }
    
    /**
     * Focus the panel
     */
    public focus(): void {
        if (!this.focused) {
            this.focused = true;
            this.events.emit('focused');
            this.onFocus();
        }
    }
    
    /**
     * Blur the panel (lose focus)
     */
    public blur(): void {
        if (this.focused) {
            this.focused = false;
            this.events.emit('blurred');
            this.onBlur();
        }
    }
    
    /**
     * Check if the panel is focused
     */
    public isFocused(): boolean {
        return this.focused;
    }
    
    // Lifecycle hooks (to be implemented by subclasses)
    
    /**
     * Called when the panel is mounted
     * Subclasses should create their UI here
     */
    protected abstract onMount(container: HTMLElement): void;
    
    /**
     * Called when the panel is unmounted
     * Subclasses should clean up resources here
     */
    protected onUnmount(): void {
        // Optional override
    }
    
    /**
     * Called each frame while the panel is visible
     * Subclasses should update their UI here
     */
    protected onUpdate(_deltaTime: number): void {
        // Optional override
    }
    
    /**
     * Called when the panel is resized
     * Subclasses should adjust their layout here
     */
    protected onResize(_width: number, _height: number): void {
        // Optional override
    }
    
    /**
     * Called when the panel receives focus
     */
    protected onFocus(): void {
        // Optional override
    }
    
    /**
     * Called when the panel loses focus
     */
    protected onBlur(): void {
        // Optional override
    }
}
