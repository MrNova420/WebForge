/**
 * @fileoverview EditorKeyboard - Keyboard Shortcuts for the Editor
 * @module editor/app
 * 
 * Handles all keyboard shortcuts and input for the editor.
 * 
 * @author MrNova420
 * @license MIT
 */

import { TransformMode } from '../EditorContext';
import { Logger } from '../../core/Logger';
import type { EditorApplication } from './EditorApplication';

/**
 * Keyboard shortcut definition
 */
interface KeyboardShortcut {
    key: string;
    ctrl?: boolean;
    shift?: boolean;
    alt?: boolean;
    action: () => void;
    description: string;
}

/**
 * Editor Keyboard Manager
 * 
 * Manages keyboard shortcuts and input handling.
 */
export class EditorKeyboard {
    private editor: EditorApplication;
    private logger: Logger;
    private shortcuts: KeyboardShortcut[] = [];
    private boundHandler: (e: KeyboardEvent) => void;

    constructor(editor: EditorApplication) {
        this.editor = editor;
        this.logger = new Logger('EditorKeyboard');
        this.boundHandler = this.handleKeyDown.bind(this);
        
        this.registerDefaultShortcuts();
    }

    /**
     * Initialize keyboard listeners
     */
    initialize(): void {
        document.addEventListener('keydown', this.boundHandler);
        this.logger.info('Keyboard shortcuts initialized');
    }

    /**
     * Register default keyboard shortcuts
     */
    private registerDefaultShortcuts(): void {
        // Transform tools
        this.register('q', () => this.editor.setTransformMode(TransformMode.SELECT), 'Select tool');
        this.register('w', () => this.editor.setTransformMode(TransformMode.TRANSLATE), 'Translate tool');
        this.register('e', () => this.editor.setTransformMode(TransformMode.ROTATE), 'Rotate tool');
        this.register('r', () => this.editor.setTransformMode(TransformMode.SCALE), 'Scale tool');
        
        // Frame selected
        this.register('f', () => this.editor.frameSelected(), 'Frame selected');
        
        // Delete
        this.register('Delete', () => this.editor.deleteSelected(), 'Delete selected');
        this.register('Backspace', () => this.editor.deleteSelected(), 'Delete selected');
        
        // Duplicate
        this.register('d', () => this.editor.duplicateSelected(), 'Duplicate selected', true);
        
        // Undo/Redo
        this.register('z', () => this.editor.undo(), 'Undo', true);
        this.register('y', () => this.editor.redo(), 'Redo', true);
        this.register('z', () => this.editor.redo(), 'Redo', true, true);
        
        // Play mode
        this.register('p', () => {
            if (this.editor.getIsPlaying()) {
                this.editor.stopPlay();
            } else {
                this.editor.play();
            }
        }, 'Toggle play', true);
        
        // View shortcuts
        this.register('1', () => this.editor.setView('front'), 'Front view');
        this.register('3', () => this.editor.setView('right'), 'Right view');
        this.register('7', () => this.editor.setView('top'), 'Top view');
        this.register('0', () => this.editor.setView('perspective'), 'Perspective view');
        
        // Toggle wireframe
        this.register('z', () => this.editor.toggleWireframe(), 'Toggle wireframe', false, false, true);
        
        // Toggle grid
        this.register('g', () => this.editor.toggleGrid(), 'Toggle grid', false, false, true);
        
        // Grid snap
        this.register('g', () => this.editor.toggleGridSnap(), 'Toggle grid snap', true);
        
        // Create primitives
        this.register('1', () => this.editor.createPrimitive('cube'), 'Create cube', true, true);
        this.register('2', () => this.editor.createPrimitive('sphere'), 'Create sphere', true, true);
        this.register('3', () => this.editor.createPrimitive('plane'), 'Create plane', true, true);
        this.register('4', () => this.editor.createPrimitive('cylinder'), 'Create cylinder', true, true);
        
        // Create lights
        this.register('l', () => this.editor.createLight('point'), 'Create point light', true, true);
        this.register('d', () => this.editor.createLight('directional'), 'Create directional light', true, true, true);
    }

    /**
     * Register a keyboard shortcut
     */
    register(
        key: string,
        action: () => void,
        description: string,
        ctrl: boolean = false,
        shift: boolean = false,
        alt: boolean = false
    ): void {
        this.shortcuts.push({ key, action, description, ctrl, shift, alt });
    }

    /**
     * Handle keydown event
     */
    private handleKeyDown(e: KeyboardEvent): void {
        // Ignore if typing in input
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
            return;
        }
        
        const key = e.key.toLowerCase();
        
        for (const shortcut of this.shortcuts) {
            const keyMatch = shortcut.key.toLowerCase() === key;
            const ctrlMatch = !!shortcut.ctrl === (e.ctrlKey || e.metaKey);
            const shiftMatch = !!shortcut.shift === e.shiftKey;
            const altMatch = !!shortcut.alt === e.altKey;
            
            if (keyMatch && ctrlMatch && shiftMatch && altMatch) {
                e.preventDefault();
                shortcut.action();
                return;
            }
        }
    }

    /**
     * Get all registered shortcuts
     */
    getShortcuts(): Array<{ key: string; modifiers: string; description: string }> {
        return this.shortcuts.map(s => {
            const modifiers: string[] = [];
            if (s.ctrl) modifiers.push('Ctrl');
            if (s.shift) modifiers.push('Shift');
            if (s.alt) modifiers.push('Alt');
            
            return {
                key: s.key,
                modifiers: modifiers.join('+'),
                description: s.description
            };
        });
    }

    /**
     * Dispose
     */
    dispose(): void {
        document.removeEventListener('keydown', this.boundHandler);
        this.logger.info('Keyboard shortcuts disposed');
    }
}
