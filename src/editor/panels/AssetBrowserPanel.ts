/**
 * WebForge Asset Browser Panel
 * 
 * File system browser for managing game assets (models, textures, audio, etc.).
 * Provides thumbnail previews, drag-and-drop support, and asset import.
 */

import { Panel } from '../Panel';
import { EditorContext } from '../EditorContext';

/**
 * Asset type enumeration
 */
export enum AssetType {
    FOLDER = 'folder',
    MODEL = 'model',
    TEXTURE = 'texture',
    MATERIAL = 'material',
    AUDIO = 'audio',
    SCRIPT = 'script',
    SCENE = 'scene',
    PREFAB = 'prefab',
    UNKNOWN = 'unknown'
}

/**
 * Asset item representation
 */
export interface AssetItem {
    name: string;
    type: AssetType;
    path: string;
    size?: number;
    thumbnail?: string;
}

/**
 * Asset browser panel for file management
 */
export class AssetBrowserPanel extends Panel {
    private context: EditorContext;
    private currentPath: string = '/';
    private assets: AssetItem[] = [];
    
    private pathBar: HTMLElement | null = null;
    private gridContainer: HTMLElement | null = null;
    private viewMode: 'grid' | 'list' = 'grid';
    
    /**
     * Creates a new asset browser panel
     * @param context - Editor context
     * @param id - Panel ID
     * @param title - Panel title
     */
    constructor(context: EditorContext, id: string = 'asset-browser', title: string = 'Assets') {
        super(id, title);
        this.context = context;
        
        // Load default assets
        this.loadAssets();
    }
    
    /**
     * Creates the panel content
     */
    protected createContent(): HTMLElement {
        const content = document.createElement('div');
        content.style.cssText = `
            width: 100%;
            height: 100%;
            display: flex;
            flex-direction: column;
            background: #2a2a2a;
            color: #e0e0e0;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        `;
        
        // Toolbar
        const toolbar = this.createToolbar();
        content.appendChild(toolbar);
        
        // Path bar
        this.pathBar = this.createPathBar();
        content.appendChild(this.pathBar);
        
        // Asset grid/list
        this.gridContainer = document.createElement('div');
        this.gridContainer.style.cssText = `
            flex: 1;
            overflow-y: auto;
            padding: 10px;
        `;
        content.appendChild(this.gridContainer);
        
        this.refreshView();
        
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
            align-items: center;
        `;
        
        // Back button
        const backBtn = this.createButton('←', 'Go back', () => {
            this.navigateUp();
        });
        toolbar.appendChild(backBtn);
        
        // Forward button
        const forwardBtn = this.createButton('→', 'Go forward', () => {
            // Navigation history (not implemented yet)
        });
        toolbar.appendChild(forwardBtn);
        
        // Create folder button
        const createFolderBtn = this.createButton('📁+', 'Create folder', () => {
            this.createFolder();
        });
        toolbar.appendChild(createFolderBtn);
        
        // Import button
        const importBtn = this.createButton('📥', 'Import asset', () => {
            this.importAsset();
        });
        toolbar.appendChild(importBtn);
        
        // Separator
        const separator = document.createElement('div');
        separator.style.cssText = 'width: 1px; background: #444; height: 20px; margin: 0 5px;';
        toolbar.appendChild(separator);
        
        // View mode toggles
        const gridBtn = this.createButton('⊞', 'Grid view', () => {
            this.viewMode = 'grid';
            this.refreshView();
        });
        toolbar.appendChild(gridBtn);
        
        const listBtn = this.createButton('☰', 'List view', () => {
            this.viewMode = 'list';
            this.refreshView();
        });
        toolbar.appendChild(listBtn);
        
        // Spacer
        const spacer = document.createElement('div');
        spacer.style.cssText = 'flex: 1;';
        toolbar.appendChild(spacer);
        
        // Search input
        const searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.placeholder = 'Search assets...';
        searchInput.style.cssText = `
            width: 200px;
            padding: 4px 8px;
            background: #1a1a1a;
            border: 1px solid #444;
            border-radius: 3px;
            color: #e0e0e0;
            font-size: 12px;
        `;
        searchInput.oninput = () => {
            this.filterAssets(searchInput.value);
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
     * Creates the path breadcrumb bar
     */
    private createPathBar(): HTMLElement {
        const pathBar = document.createElement('div');
        pathBar.style.cssText = `
            padding: 10px;
            background: #2e2e2e;
            border-bottom: 1px solid #444;
            display: flex;
            align-items: center;
            gap: 5px;
            font-size: 12px;
        `;
        
        const parts = this.currentPath.split('/').filter(p => p);
        
        // Root
        const root = document.createElement('span');
        root.textContent = '📁 Assets';
        root.style.cssText = 'cursor: pointer; padding: 3px 8px; border-radius: 3px;';
        root.onclick = () => {
            this.navigateTo('/');
        };
        pathBar.appendChild(root);
        
        // Path segments
        let currentPath = '';
        parts.forEach(part => {
            const separator = document.createElement('span');
            separator.textContent = '>';
            separator.style.cssText = 'color: #666;';
            pathBar.appendChild(separator);
            
            currentPath += '/' + part;
            const segment = document.createElement('span');
            segment.textContent = part;
            segment.style.cssText = 'cursor: pointer; padding: 3px 8px; border-radius: 3px;';
            segment.onclick = () => {
                this.navigateTo(currentPath);
            };
            pathBar.appendChild(segment);
        });
        
        return pathBar;
    }
    
    /**
     * Refreshes the asset view
     */
    private refreshView(): void {
        if (!this.gridContainer) return;
        
        this.gridContainer.innerHTML = '';
        
        if (this.viewMode === 'grid') {
            this.renderGridView();
        } else {
            this.renderListView();
        }
    }
    
    /**
     * Renders grid view
     */
    private renderGridView(): void {
        if (!this.gridContainer) return;
        
        this.gridContainer.style.cssText += `
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
            gap: 10px;
            padding: 10px;
        `;
        
        this.assets.forEach(asset => {
            const item = this.createGridItem(asset);
            this.gridContainer!.appendChild(item);
        });
    }
    
    /**
     * Creates a grid item
     */
    private createGridItem(asset: AssetItem): HTMLElement {
        const item = document.createElement('div');
        item.style.cssText = `
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 10px;
            border-radius: 4px;
            cursor: pointer;
            transition: background 0.2s;
        `;
        
        item.onmouseenter = () => {
            item.style.background = '#3a3a3a';
        };
        item.onmouseleave = () => {
            item.style.background = '';
        };
        
        // Thumbnail
        const thumbnail = document.createElement('div');
        thumbnail.style.cssText = `
            width: 80px;
            height: 80px;
            background: #1a1a1a;
            border-radius: 4px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 40px;
            margin-bottom: 8px;
        `;
        thumbnail.textContent = this.getAssetIcon(asset.type);
        item.appendChild(thumbnail);
        
        // Name
        const name = document.createElement('div');
        name.textContent = asset.name;
        name.style.cssText = `
            font-size: 11px;
            text-align: center;
            word-break: break-word;
            max-width: 100%;
        `;
        item.appendChild(name);
        
        // Double click to open
        item.ondblclick = () => {
            if (asset.type === AssetType.FOLDER) {
                this.navigateTo(asset.path);
            } else {
                this.openAsset(asset);
            }
        };
        
        return item;
    }
    
    /**
     * Renders list view
     */
    private renderListView(): void {
        if (!this.gridContainer) return;
        
        this.gridContainer.style.cssText += `
            display: flex;
            flex-direction: column;
            gap: 2px;
            padding: 5px;
        `;
        
        this.assets.forEach(asset => {
            const item = this.createListItem(asset);
            this.gridContainer!.appendChild(item);
        });
    }
    
    /**
     * Creates a list item
     */
    private createListItem(asset: AssetItem): HTMLElement {
        const item = document.createElement('div');
        item.style.cssText = `
            display: flex;
            align-items: center;
            padding: 6px 10px;
            border-radius: 3px;
            cursor: pointer;
            transition: background 0.2s;
        `;
        
        item.onmouseenter = () => {
            item.style.background = '#3a3a3a';
        };
        item.onmouseleave = () => {
            item.style.background = '';
        };
        
        // Icon
        const icon = document.createElement('span');
        icon.textContent = this.getAssetIcon(asset.type);
        icon.style.cssText = 'font-size: 20px; margin-right: 10px;';
        item.appendChild(icon);
        
        // Name
        const name = document.createElement('span');
        name.textContent = asset.name;
        name.style.cssText = 'flex: 1; font-size: 13px;';
        item.appendChild(name);
        
        // Size
        if (asset.size) {
            const size = document.createElement('span');
            size.textContent = this.formatFileSize(asset.size);
            size.style.cssText = 'font-size: 11px; color: #888;';
            item.appendChild(size);
        }
        
        // Double click to open
        item.ondblclick = () => {
            if (asset.type === AssetType.FOLDER) {
                this.navigateTo(asset.path);
            } else {
                this.openAsset(asset);
            }
        };
        
        return item;
    }
    
    /**
     * Gets the icon for an asset type
     */
    private getAssetIcon(type: AssetType): string {
        const icons: Record<AssetType, string> = {
            [AssetType.FOLDER]: '📁',
            [AssetType.MODEL]: '🎨',
            [AssetType.TEXTURE]: '🖼️',
            [AssetType.MATERIAL]: '✨',
            [AssetType.AUDIO]: '🔊',
            [AssetType.SCRIPT]: '📝',
            [AssetType.SCENE]: '🌍',
            [AssetType.PREFAB]: '📦',
            [AssetType.UNKNOWN]: '📄'
        };
        return icons[type];
    }
    
    /**
     * Formats file size
     */
    private formatFileSize(bytes: number): string {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }
    
    /**
     * Navigates to a path
     */
    private navigateTo(path: string): void {
        this.currentPath = path;
        this.loadAssets();
        
        // Update path bar
        if (this.pathBar && this.pathBar.parentElement) {
            const newPathBar = this.createPathBar();
            this.pathBar.parentElement.replaceChild(newPathBar, this.pathBar);
            this.pathBar = newPathBar;
        }
        
        this.refreshView();
    }
    
    /**
     * Navigates up one level
     */
    private navigateUp(): void {
        if (this.currentPath === '/') return;
        
        const parts = this.currentPath.split('/').filter(p => p);
        parts.pop();
        const newPath = '/' + parts.join('/');
        this.navigateTo(newPath);
    }
    
    /**
     * Loads assets for current path
     */
    private loadAssets(): void {
        // Mock asset loading - in a real implementation, this would load from file system
        this.assets = [
            { name: 'Models', type: AssetType.FOLDER, path: this.currentPath + '/Models' },
            { name: 'Textures', type: AssetType.FOLDER, path: this.currentPath + '/Textures' },
            { name: 'Materials', type: AssetType.FOLDER, path: this.currentPath + '/Materials' },
            { name: 'Audio', type: AssetType.FOLDER, path: this.currentPath + '/Audio' },
            { name: 'Scripts', type: AssetType.FOLDER, path: this.currentPath + '/Scripts' },
            { name: 'Scenes', type: AssetType.FOLDER, path: this.currentPath + '/Scenes' }
        ];
    }
    
    /**
     * Filters assets by search term
     */
    private filterAssets(searchTerm: string): void {
        // Filter and refresh view
        this.refreshView();
    }
    
    /**
     * Creates a new folder
     */
    private createFolder(): void {
        const name = prompt('Folder name:');
        if (name) {
            this.assets.push({
                name,
                type: AssetType.FOLDER,
                path: this.currentPath + '/' + name
            });
            this.refreshView();
        }
    }
    
    /**
     * Imports an asset
     */
    private importAsset(): void {
        // This would open a file picker dialog
        console.log('Import asset');
    }
    
    /**
     * Opens an asset
     */
    private openAsset(asset: AssetItem): void {
        console.log('Open asset:', asset.name);
        // This would open the asset in the appropriate editor
    }
}
