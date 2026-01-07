/**
 * WebForge Hierarchy Panel
 * 
 * Tree view of all GameObjects in the scene with drag-and-drop support.
 * Provides scene organization and quick navigation.
 */

import { Panel } from '../Panel';
import { EditorContext } from '../EditorContext';
import { Scene } from '../../scene/Scene';
import { GameObject } from '../../scene/GameObject';

/**
 * Tree node element data
 */
interface TreeNodeData {
    gameObject: GameObject;
    element: HTMLElement;
    children: HTMLElement;
}

/**
 * Hierarchy panel for scene tree view
 */
export class HierarchyPanel extends Panel {
    private context: EditorContext;
    private scene: Scene | null = null;
    private treeContainer: HTMLElement | null = null;
    private treeNodes: Map<GameObject, TreeNodeData> = new Map();
    
    // Drag and drop state
    private draggedObject: GameObject | null = null;
    private dropTarget: GameObject | null = null;
    
    /**
     * Creates a new hierarchy panel
     * @param context - Editor context
     * @param id - Panel ID
     * @param title - Panel title
     */
    constructor(context: EditorContext, id: string = 'hierarchy', title: string = 'Hierarchy') {
        super(id, title);
        this.context = context;
        
        // Listen to selection changes
        this.context.on('selectionChanged', this.onSelectionChanged.bind(this));
    }
    
    /**
     * Creates the panel content
     */
    protected createContent(): HTMLElement {
        const content = document.createElement('div');
        content.style.cssText = `
            width: 100%;
            height: 100%;
            overflow-y: auto;
            background: #2a2a2a;
            color: #e0e0e0;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            font-size: 13px;
        `;
        
        // Toolbar
        const toolbar = this.createToolbar();
        content.appendChild(toolbar);
        
        // Tree container
        this.treeContainer = document.createElement('div');
        this.treeContainer.style.cssText = 'padding: 5px;';
        content.appendChild(this.treeContainer);
        
        return content;
    }
    
    /**
     * Creates the toolbar
     */
    private createToolbar(): HTMLElement {
        const toolbar = document.createElement('div');
        toolbar.style.cssText = `
            padding: 8px;
            background: #333;
            border-bottom: 1px solid #444;
            display: flex;
            gap: 5px;
        `;
        
        // Create button
        const createBtn = this.createButton('+', 'Create new GameObject', () => {
            this.createGameObject();
        });
        toolbar.appendChild(createBtn);
        
        // Delete button
        const deleteBtn = this.createButton('🗑️', 'Delete selected', () => {
            this.deleteSelected();
        });
        toolbar.appendChild(deleteBtn);
        
        // Separator
        const separator = document.createElement('div');
        separator.style.cssText = 'width: 1px; background: #444; margin: 0 5px;';
        toolbar.appendChild(separator);
        
        // Search input
        const searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.placeholder = 'Search...';
        searchInput.style.cssText = `
            flex: 1;
            padding: 4px 8px;
            background: #1a1a1a;
            border: 1px solid #444;
            border-radius: 3px;
            color: #e0e0e0;
            font-size: 12px;
        `;
        searchInput.oninput = () => {
            this.filterTree(searchInput.value);
        };
        toolbar.appendChild(searchInput);
        
        return toolbar;
    }
    
    /**
     * Creates a toolbar button
     */
    private createButton(text: string, title: string, onClick: () => void): HTMLElement {
        const button = document.createElement('button');
        button.textContent = text;
        button.title = title;
        button.style.cssText = `
            padding: 4px 10px;
            background: #3a3a3a;
            border: 1px solid #444;
            border-radius: 3px;
            color: #e0e0e0;
            cursor: pointer;
            font-size: 13px;
        `;
        button.onclick = onClick;
        return button;
    }
    
    /**
     * Sets the scene to display
     */
    public setScene(scene: Scene): void {
        this.scene = scene;
        this.rebuildTree();
    }
    
    /**
     * Rebuilds the entire tree
     */
    private rebuildTree(): void {
        if (!this.treeContainer || !this.scene) return;
        
        this.treeContainer.innerHTML = '';
        this.treeNodes.clear();
        
        // Build tree from scene root objects
        const rootObjects = this.scene.getChildren();
        rootObjects.forEach(obj => {
            this.createTreeNode(obj, this.treeContainer!);
        });
    }
    
    /**
     * Creates a tree node for a GameObject
     */
    private createTreeNode(gameObject: GameObject, parent: HTMLElement): TreeNodeData {
        const nodeContainer = document.createElement('div');
        
        // Node header
        const header = document.createElement('div');
        header.style.cssText = `
            padding: 4px 8px;
            cursor: pointer;
            user-select: none;
            display: flex;
            align-items: center;
            gap: 5px;
            border-radius: 3px;
        `;
        header.draggable = true;
        
        // Expand/collapse button
        const hasChildren = gameObject.children.length > 0;
        const expandBtn = document.createElement('span');
        expandBtn.textContent = hasChildren ? '▼' : '  ';
        expandBtn.style.cssText = `
            width: 12px;
            text-align: center;
            font-size: 10px;
            color: #888;
        `;
        if (hasChildren) {
            expandBtn.style.cursor = 'pointer';
            expandBtn.onclick = (e) => {
                e.stopPropagation();
                this.toggleNode(nodeData);
            };
        }
        header.appendChild(expandBtn);
        
        // Icon
        const icon = document.createElement('span');
        icon.textContent = '📦';
        icon.style.cssText = 'font-size: 14px;';
        header.appendChild(icon);
        
        // Name
        const name = document.createElement('span');
        name.textContent = gameObject.name;
        name.style.cssText = 'flex: 1;';
        header.appendChild(name);
        
        // Active indicator
        if (!gameObject.active) {
            name.style.color = '#888';
            name.style.fontStyle = 'italic';
        }
        
        // Children container
        const children = document.createElement('div');
        children.style.cssText = 'margin-left: 20px;';
        
        // Build children
        gameObject.children.forEach(child => {
            this.createTreeNode(child, children);
        });
        
        nodeContainer.appendChild(header);
        nodeContainer.appendChild(children);
        parent.appendChild(nodeContainer);
        
        const nodeData: TreeNodeData = {
            gameObject,
            element: header,
            children
        };
        
        this.treeNodes.set(gameObject, nodeData);
        
        // Event handlers
        header.onclick = (e) => {
            if (e.ctrlKey || e.metaKey) {
                this.toggleSelection(gameObject);
            } else {
                this.selectObject(gameObject);
            }
        };
        
        // Drag and drop
        header.ondragstart = (e) => {
            this.draggedObject = gameObject;
            header.style.opacity = '0.5';
        };
        
        header.ondragend = (e) => {
            header.style.opacity = '1';
            this.draggedObject = null;
            this.dropTarget = null;
        };
        
        header.ondragover = (e) => {
            e.preventDefault();
            if (this.draggedObject && this.draggedObject !== gameObject) {
                header.style.background = '#4a9eff';
                this.dropTarget = gameObject;
            }
        };
        
        header.ondragleave = (e) => {
            header.style.background = '';
        };
        
        header.ondrop = (e) => {
            e.preventDefault();
            header.style.background = '';
            
            if (this.draggedObject && this.dropTarget) {
                // Reparent the dragged object
                this.draggedObject.setParent(this.dropTarget);
                this.rebuildTree();
            }
        };
        
        return nodeData;
    }
    
    /**
     * Toggles node expansion
     */
    private toggleNode(nodeData: TreeNodeData): void {
        const isCollapsed = nodeData.children.style.display === 'none';
        nodeData.children.style.display = isCollapsed ? 'block' : 'none';
        
        const expandBtn = nodeData.element.querySelector('span') as HTMLElement;
        if (expandBtn) {
            expandBtn.textContent = isCollapsed ? '▼' : '▶';
        }
    }
    
    /**
     * Selects a GameObject
     */
    private selectObject(gameObject: GameObject): void {
        this.context.setSelection([gameObject]);
    }
    
    /**
     * Toggles GameObject selection
     */
    private toggleSelection(gameObject: GameObject): void {
        const currentSelection = this.context.getSelection();
        const index = currentSelection.indexOf(gameObject);
        
        if (index >= 0) {
            currentSelection.splice(index, 1);
        } else {
            currentSelection.push(gameObject);
        }
        
        this.context.setSelection(currentSelection);
    }
    
    /**
     * Updates selection highlight
     */
    private onSelectionChanged(): void {
        const selected = this.context.getSelection();
        
        // Clear all highlights
        this.treeNodes.forEach(nodeData => {
            nodeData.element.style.background = '';
        });
        
        // Highlight selected nodes
        selected.forEach(obj => {
            const nodeData = this.treeNodes.get(obj);
            if (nodeData) {
                nodeData.element.style.background = '#4a9eff';
            }
        });
    }
    
    /**
     * Creates a new GameObject
     */
    private createGameObject(): void {
        if (!this.scene) return;
        
        const gameObject = new GameObject('New GameObject');
        this.scene.add(gameObject);
        this.rebuildTree();
    }
    
    /**
     * Deletes selected GameObjects
     */
    private deleteSelected(): void {
        const selected = this.context.getSelection();
        selected.forEach(obj => {
            obj.destroy();
        });
        this.context.setSelection([]);
        this.rebuildTree();
    }
    
    /**
     * Filters the tree by search term
     */
    private filterTree(searchTerm: string): void {
        if (!searchTerm) {
            // Show all nodes
            this.treeNodes.forEach(nodeData => {
                nodeData.element.parentElement!.style.display = 'block';
            });
            return;
        }
        
        const term = searchTerm.toLowerCase();
        
        this.treeNodes.forEach(nodeData => {
            const matches = nodeData.gameObject.name.toLowerCase().includes(term);
            nodeData.element.parentElement!.style.display = matches ? 'block' : 'none';
        });
    }
    
    /**
     * Called when panel is unmounted
     */
    public onUnmount(): void {
        super.onUnmount();
        
        // Cleanup event listeners
        this.context.off('selectionChanged', this.onSelectionChanged.bind(this));
    }
}
