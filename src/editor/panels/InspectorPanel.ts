/**
 * WebForge Inspector Panel
 * 
 * Property editor for inspecting and modifying GameObject properties and components.
 * Provides a unified interface for editing all properties of selected objects.
 */

import { Panel } from '../Panel';
import { EditorContext } from '../EditorContext';
import { GameObject } from '../../scene/GameObject';
import { Vector3 } from '../../math/Vector3';
import { Quaternion } from '../../math/Quaternion';

/**
 * Property type for automatic UI generation
 */
export enum PropertyType {
    NUMBER = 'number',
    STRING = 'string',
    BOOLEAN = 'boolean',
    VECTOR3 = 'vector3',
    COLOR = 'color',
    ENUM = 'enum'
}

/**
 * Property descriptor for UI generation
 */
export interface PropertyDescriptor {
    name: string;
    type: PropertyType;
    value: any;
    min?: number;
    max?: number;
    step?: number;
    options?: string[];
    onChange?: (value: any) => void;
}

/**
 * Inspector panel for property editing
 */
export class InspectorPanel extends Panel {
    private context: EditorContext;
    private selectedObject: GameObject | null = null;
    private propertyContainer: HTMLElement | null = null;
    protected content: HTMLElement | null = null;
    
    /**
     * Creates a new inspector panel
     * @param context - Editor context
     * @param id - Panel ID
     * @param title - Panel title
     */
    constructor(context: EditorContext, id: string = 'inspector', title: string = 'Inspector') {
        super(id, title);
        this.context = context;
        
        // Listen to selection changes
        this.context.on('selectionChanged', this.onSelectionChanged.bind(this));
    }
    
    /**
     * Creates the panel content
     */
    protected createContent(): HTMLElement {
        this.content = document.createElement('div');
        this.content.style.cssText = `
            width: 100%;
            height: 100%;
            overflow-y: auto;
            background: #2a2a2a;
            color: #e0e0e0;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        `;
        
        // No selection message
        const noSelection = document.createElement('div');
        noSelection.style.cssText = `
            padding: 20px;
            text-align: center;
            color: #888;
            font-style: italic;
        `;
        noSelection.textContent = 'No object selected';
        
        this.propertyContainer = document.createElement('div');
        this.propertyContainer.style.cssText = 'padding: 10px;';
        this.propertyContainer.appendChild(noSelection);
        
        this.content.appendChild(this.propertyContainer);
        
        return this.content;
    }
    
    /**
     * Handles selection change
     */
    private onSelectionChanged(): void {
        const selected = this.context.getSelection();
        
        if (selected.length === 0) {
            this.selectedObject = null;
            this.showNoSelection();
        } else if (selected.length === 1) {
            this.selectedObject = selected[0];
            this.showObjectProperties();
        } else {
            this.selectedObject = null;
            this.showMultiSelection(selected.length);
        }
    }
    
    /**
     * Shows no selection message
     */
    private showNoSelection(): void {
        if (!this.propertyContainer) return;
        
        this.propertyContainer.innerHTML = '';
        const noSelection = document.createElement('div');
        noSelection.style.cssText = `
            padding: 20px;
            text-align: center;
            color: #888;
            font-style: italic;
        `;
        noSelection.textContent = 'No object selected';
        this.propertyContainer.appendChild(noSelection);
    }
    
    /**
     * Shows multi-selection message
     */
    private showMultiSelection(count: number): void {
        if (!this.propertyContainer) return;
        
        this.propertyContainer.innerHTML = '';
        const message = document.createElement('div');
        message.style.cssText = `
            padding: 20px;
            text-align: center;
            color: #888;
            font-style: italic;
        `;
        message.textContent = `${count} objects selected`;
        this.propertyContainer.appendChild(message);
    }
    
    /**
     * Shows properties of selected object
     */
    private showObjectProperties(): void {
        if (!this.propertyContainer || !this.selectedObject) return;
        
        this.propertyContainer.innerHTML = '';
        
        // Object header
        const header = this.createHeader();
        this.propertyContainer.appendChild(header);
        
        // Transform section
        const transformSection = this.createTransformSection();
        this.propertyContainer.appendChild(transformSection);
        
        // Components section
        const componentsSection = this.createComponentsSection();
        this.propertyContainer.appendChild(componentsSection);
    }
    
    /**
     * Creates the object header
     */
    private createHeader(): HTMLElement {
        const header = document.createElement('div');
        header.style.cssText = `
            padding: 15px;
            background: #333;
            border-bottom: 2px solid #444;
            margin-bottom: 10px;
        `;
        
        // Name input
        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.value = this.selectedObject?.name || 'Unnamed';
        nameInput.style.cssText = `
            width: 100%;
            padding: 8px;
            background: #1a1a1a;
            border: 1px solid #444;
            border-radius: 3px;
            color: #e0e0e0;
            font-size: 14px;
            font-weight: bold;
        `;
        nameInput.onchange = () => {
            if (this.selectedObject) {
                this.selectedObject.name = nameInput.value;
            }
        };
        header.appendChild(nameInput);
        
        // Active checkbox
        const activeContainer = document.createElement('div');
        activeContainer.style.cssText = 'margin-top: 10px;';
        
        const activeCheckbox = document.createElement('input');
        activeCheckbox.type = 'checkbox';
        activeCheckbox.checked = this.selectedObject?.active || false;
        activeCheckbox.id = 'active-checkbox';
        activeCheckbox.style.cssText = 'margin-right: 8px;';
        activeCheckbox.onchange = () => {
            if (this.selectedObject) {
                this.selectedObject.active = activeCheckbox.checked;
            }
        };
        
        const activeLabel = document.createElement('label');
        activeLabel.htmlFor = 'active-checkbox';
        activeLabel.textContent = 'Active';
        activeLabel.style.cssText = 'cursor: pointer; user-select: none;';
        
        activeContainer.appendChild(activeCheckbox);
        activeContainer.appendChild(activeLabel);
        header.appendChild(activeContainer);
        
        return header;
    }
    
    /**
     * Creates the transform section
     */
    private createTransformSection(): HTMLElement {
        const section = this.createSection('Transform');
        
        if (!this.selectedObject) return section;
        
        const transform = this.selectedObject.transform;
        
        // Position
        this.addVector3Property(section, 'Position', transform.position, (value) => {
            transform.position.copy(value);
        });
        
        // Rotation (Euler angles)
        const rotation = transform.rotation.toEuler();
        this.addVector3Property(section, 'Rotation', rotation, (value) => {
            transform.rotation = Quaternion.fromEuler(value.x, value.y, value.z);
        });
        
        // Scale
        this.addVector3Property(section, 'Scale', transform.scale, (value) => {
            transform.scale.copy(value);
        });
        
        return section;
    }
    
    /**
     * Creates the components section
     */
    private createComponentsSection(): HTMLElement {
        const section = this.createSection('Components');
        
        // Add component button
        const addButton = document.createElement('button');
        addButton.textContent = '+ Add Component';
        addButton.style.cssText = `
            width: 100%;
            padding: 8px;
            background: #4a9eff;
            border: none;
            border-radius: 3px;
            color: white;
            cursor: pointer;
            font-size: 13px;
            margin-top: 10px;
        `;
        addButton.onclick = () => {
            this.showAddComponentMenu();
        };
        section.appendChild(addButton);
        
        return section;
    }
    
    /**
     * Creates a collapsible section
     */
    private createSection(title: string): HTMLElement {
        const section = document.createElement('div');
        section.style.cssText = `
            background: #333;
            border-radius: 4px;
            margin-bottom: 10px;
            overflow: hidden;
        `;
        
        const header = document.createElement('div');
        header.style.cssText = `
            padding: 12px 15px;
            background: #3a3a3a;
            cursor: pointer;
            user-select: none;
            font-weight: bold;
            font-size: 13px;
            border-bottom: 1px solid #444;
        `;
        header.textContent = title;
        
        const content = document.createElement('div');
        content.style.cssText = 'padding: 15px;';
        
        header.onclick = () => {
            const isCollapsed = content.style.display === 'none';
            content.style.display = isCollapsed ? 'block' : 'none';
        };
        
        section.appendChild(header);
        section.appendChild(content);
        
        return section;
    }
    
    /**
     * Adds a Vector3 property to a section
     */
    private addVector3Property(
        section: HTMLElement,
        label: string,
        value: Vector3,
        onChange: (value: Vector3) => void
    ): void {
        const content = section.querySelector('div:last-child') as HTMLElement;
        if (!content) return;
        
        const row = document.createElement('div');
        row.style.cssText = 'margin-bottom: 10px;';
        
        const labelEl = document.createElement('div');
        labelEl.textContent = label;
        labelEl.style.cssText = 'font-size: 12px; color: #aaa; margin-bottom: 5px;';
        row.appendChild(labelEl);
        
        const inputs = document.createElement('div');
        inputs.style.cssText = 'display: flex; gap: 5px;';
        
        const axes = ['x', 'y', 'z'];
        const colors = ['#ff5555', '#55ff55', '#5555ff'];
        
        axes.forEach((axis, index) => {
            const inputGroup = document.createElement('div');
            inputGroup.style.cssText = 'flex: 1; display: flex; align-items: center;';
            
            const axisLabel = document.createElement('span');
            axisLabel.textContent = axis.toUpperCase();
            axisLabel.style.cssText = `
                color: ${colors[index]};
                font-weight: bold;
                font-size: 11px;
                margin-right: 5px;
            `;
            
            const input = document.createElement('input');
            input.type = 'number';
            input.value = value[axis as keyof Vector3].toString();
            input.step = '0.1';
            input.style.cssText = `
                flex: 1;
                padding: 6px;
                background: #1a1a1a;
                border: 1px solid #444;
                border-radius: 3px;
                color: #e0e0e0;
                font-size: 12px;
            `;
            
            input.onchange = () => {
                const newValue = new Vector3(value.x, value.y, value.z);
                (newValue as any)[axis] = parseFloat(input.value);
                onChange(newValue);
            };
            
            inputGroup.appendChild(axisLabel);
            inputGroup.appendChild(input);
            inputs.appendChild(inputGroup);
        });
        
        row.appendChild(inputs);
        content.appendChild(row);
    }
    
    /**
     * Shows the add component menu
     */
    private showAddComponentMenu(): void {
        // This would show a dropdown or modal with available components
        // For now, just a placeholder
        console.log('Add component menu');
    }
    
    /**
     * Called when panel is mounted
     */
    protected onMount(_container: HTMLElement): void {
        // Panel is already mounted through base class
    }
    
    /**
     * Called when panel is unmounted
     */
    protected onUnmount(): void {
        // Cleanup event listeners
        this.context.off('selectionChanged', this.onSelectionChanged.bind(this));
    }
}
