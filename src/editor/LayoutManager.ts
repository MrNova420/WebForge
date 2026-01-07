/**
 * WebForge Editor Layout Manager
 * 
 * Manages the layout of editor panels with flexible horizontal/vertical splits,
 * resizing, and layout persistence.
 */

import { Panel } from './Panel';
import { EventSystem } from '../core/EventSystem';

/**
 * Split direction for panel layouts
 */
export enum SplitDirection {
    HORIZONTAL = 'horizontal',
    VERTICAL = 'vertical'
}

/**
 * Layout node types
 */
export enum LayoutNodeType {
    PANEL = 'panel',
    SPLIT = 'split'
}

/**
 * Layout node (panel or split)
 */
export interface LayoutNode {
    type: LayoutNodeType;
    id: string;
    panelId?: string;
    direction?: SplitDirection;
    size?: number;
    children?: LayoutNode[];
}

/**
 * Layout Manager
 * 
 * Manages the layout of editor panels with flexible splits and resizing.
 */
export class LayoutManager {
    private rootContainer: HTMLElement;
    private panels: Map<string, Panel> = new Map();
    private events: EventSystem;
    private rootNode: LayoutNode | null = null;
    private nextId: number = 0;
    
    constructor(container: HTMLElement) {
        this.rootContainer = container;
        this.events = new EventSystem();
        this.setupDefaultLayout();
    }
    
    /**
     * Get the event system
     */
    public getEvents(): EventSystem {
        return this.events;
    }
    
    /**
     * Register a panel with the layout manager
     */
    public registerPanel(panel: Panel): void {
        this.panels.set(panel.getId(), panel);
    }
    
    /**
     * Unregister a panel
     */
    public unregisterPanel(panelId: string): void {
        const panel = this.panels.get(panelId);
        if (panel) {
            panel.unmount();
            this.panels.delete(panelId);
        }
    }
    
    /**
     * Get a panel by ID
     */
    public getPanel(panelId: string): Panel | undefined {
        return this.panels.get(panelId);
    }
    
    /**
     * Create a horizontal split
     */
    public createHorizontalSplit(): string {
        return this.createSplit(SplitDirection.HORIZONTAL);
    }
    
    /**
     * Create a vertical split
     */
    public createVerticalSplit(): string {
        return this.createSplit(SplitDirection.VERTICAL);
    }
    
    /**
     * Create a split node
     */
    private createSplit(_direction: SplitDirection): string {
        const id = this.generateId();
        return id;
    }
    
    /**
     * Add a panel to the layout
     */
    public addPanel(panelId: string, panel: Panel, _parentId?: string, _size?: number): string {
        this.registerPanel(panel);
        
        const nodeId = this.generateId();
        
        // Create container for the panel
        const container = document.createElement('div');
        container.id = `panel-${nodeId}`;
        container.style.position = 'relative';
        container.style.overflow = 'auto';
        this.rootContainer.appendChild(container);
        
        // Mount the panel
        panel.mount(container);
        
        this.events.emit('panelAdded', { panelId, nodeId });
        return nodeId;
    }
    
    /**
     * Remove a panel from the layout
     */
    public removePanel(nodeId: string): void {
        const container = document.getElementById(`panel-${nodeId}`);
        if (container) {
            container.remove();
        }
        
        this.events.emit('panelRemoved', { nodeId });
    }
    
    /**
     * Resize a panel
     */
    public resizePanel(nodeId: string, size: number): void {
        const container = document.getElementById(`panel-${nodeId}`);
        if (container) {
            container.style.width = `${size}px`;
            this.events.emit('panelResized', { nodeId, size });
        }
    }
    
    /**
     * Save the current layout
     */
    public saveLayout(): LayoutNode | null {
        return this.rootNode;
    }
    
    /**
     * Load a layout
     */
    public loadLayout(layout: LayoutNode): void {
        // Clear current layout
        this.rootContainer.innerHTML = '';
        this.panels.clear();
        
        // Apply the new layout
        this.rootNode = layout;
        this.applyLayout(layout);
        
        this.events.emit('layoutLoaded', layout);
    }
    
    /**
     * Apply a layout node
     */
    private applyLayout(node: LayoutNode): void {
        if (node.type === LayoutNodeType.PANEL && node.panelId) {
            // Panel node - would need panel instance
            // In practice, you'd recreate panels from saved state
        } else if (node.type === LayoutNodeType.SPLIT && node.children) {
            // Split node - recursively apply children
            node.children.forEach(child => this.applyLayout(child));
        }
    }
    
    /**
     * Create a default layout
     */
    private setupDefaultLayout(): void {
        // Default layout will be created when panels are added
        this.rootNode = {
            type: LayoutNodeType.SPLIT,
            id: this.generateId(),
            direction: SplitDirection.HORIZONTAL,
            children: []
        };
    }
    
    /**
     * Generate a unique ID
     */
    private generateId(): string {
        return `layout-node-${this.nextId++}`;
    }
    
    /**
     * Update all panels
     */
    public update(deltaTime: number): void {
        this.panels.forEach(panel => {
            if (panel.isVisible()) {
                panel.update(deltaTime);
            }
        });
    }
    
    /**
     * Get all registered panels
     */
    public getPanels(): Panel[] {
        return Array.from(this.panels.values());
    }
    
    /**
     * Clear the layout
     */
    public clear(): void {
        this.panels.forEach(panel => panel.unmount());
        this.panels.clear();
        this.rootContainer.innerHTML = '';
        this.rootNode = null;
    }
}
