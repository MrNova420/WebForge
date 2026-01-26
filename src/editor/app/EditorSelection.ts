/**
 * @fileoverview EditorSelection - Selection System for the Editor
 * @module editor/app
 * 
 * Manages object selection in the editor including:
 * - Single/multi-select
 * - Selection state tracking
 * - Selection events
 * 
 * @author MrNova420
 * @license MIT
 */

import { GameObject } from '../../scene/GameObject';
import { EditorContext } from '../EditorContext';
import { EventSystem } from '../../core/EventSystem';
import { Logger } from '../../core/Logger';

/**
 * Editor selection operation mode
 */
export enum EditorSelectionMode {
    REPLACE = 'replace',
    ADD = 'add',
    REMOVE = 'remove',
    TOGGLE = 'toggle'
}

/**
 * Editor Selection Manager
 * 
 * Handles all selection operations in the editor.
 */
export class EditorSelection {
    private context: EditorContext;
    private _events: EventSystem;
    private _logger: Logger;

    constructor(context: EditorContext) {
        this.context = context;
        this._events = new EventSystem();
        this._logger = new Logger('EditorSelection');
    }

    /**
     * Select objects
     */
    select(objects: GameObject | GameObject[], mode: EditorSelectionMode = EditorSelectionMode.REPLACE): void {
        const objectArray = Array.isArray(objects) ? objects : [objects];
        
        switch (mode) {
            case EditorSelectionMode.REPLACE:
                this.context.setSelection(objectArray);
                break;
                
            case EditorSelectionMode.ADD:
                const current = this.context.getSelection();
                const newSelection = [...current];
                for (const obj of objectArray) {
                    if (!current.includes(obj)) {
                        newSelection.push(obj);
                    }
                }
                this.context.setSelection(newSelection);
                break;
                
            case EditorSelectionMode.REMOVE:
                const remaining = this.context.getSelection().filter(
                    obj => !objectArray.includes(obj)
                );
                this.context.setSelection(remaining);
                break;
                
            case EditorSelectionMode.TOGGLE:
                const toggled = this.context.getSelection();
                for (const obj of objectArray) {
                    const index = toggled.indexOf(obj);
                    if (index >= 0) {
                        toggled.splice(index, 1);
                    } else {
                        toggled.push(obj);
                    }
                }
                this.context.setSelection(toggled);
                break;
        }
    }

    /**
     * Clear selection
     */
    clear(): void {
        this.context.clearSelection();
    }

    /**
     * Get selected objects
     */
    getSelected(): GameObject[] {
        return this.context.getSelection();
    }

    /**
     * Check if object is selected
     */
    isSelected(object: GameObject): boolean {
        return this.context.isSelected(object);
    }

    /**
     * Select all objects in array
     */
    selectAll(objects: GameObject[]): void {
        this.context.setSelection(objects);
    }

    /**
     * Invert selection
     */
    invertSelection(allObjects: GameObject[]): void {
        const selected = this.context.getSelection();
        const inverted = allObjects.filter(obj => !selected.includes(obj));
        this.context.setSelection(inverted);
    }

    /**
     * Get selection count
     */
    getCount(): number {
        return this.context.getSelection().length;
    }

    /**
     * Get first selected object
     */
    getFirst(): GameObject | null {
        const selection = this.context.getSelection();
        return selection.length > 0 ? selection[0] : null;
    }

    /**
     * Get last selected object
     */
    getLast(): GameObject | null {
        const selection = this.context.getSelection();
        return selection.length > 0 ? selection[selection.length - 1] : null;
    }

    /**
     * Get event system for subscriptions
     */
    getEvents(): EventSystem {
        return this._events;
    }

    /**
     * Get logger for debugging
     */
    getLogger(): Logger {
        return this._logger;
    }
}
