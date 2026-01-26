/**
 * @fileoverview EditorCommands - Command/Undo System for the Editor
 * @module editor/app
 * 
 * Implements the Command pattern for undoable operations.
 * 
 * @author MrNova420
 * @license MIT
 */

import { GameObject } from '../../scene/GameObject';
import { Vector3 } from '../../math/Vector3';
import { Quaternion } from '../../math/Quaternion';
import { Logger } from '../../core/Logger';
import { EventSystem } from '../../core/EventSystem';

/**
 * Base command interface
 */
export interface ICommand {
    /** Execute the command */
    execute(): void;
    /** Undo the command */
    undo(): void;
    /** Command description */
    description: string;
}

/**
 * Transform position/scale command (for Vector3 properties)
 */
export class TransformVec3Command implements ICommand {
    description: string;
    
    constructor(
        private object: GameObject,
        private property: 'position' | 'scale',
        private oldValue: Vector3,
        private newValue: Vector3
    ) {
        this.description = `Change ${property} of ${object.name}`;
    }
    
    execute(): void {
        this.object.transform[this.property].copy(this.newValue);
    }
    
    undo(): void {
        this.object.transform[this.property].copy(this.oldValue);
    }
}

/**
 * Transform rotation command (for Quaternion)
 */
export class TransformRotationCommand implements ICommand {
    description: string;
    
    constructor(
        private object: GameObject,
        private oldValue: Quaternion,
        private newValue: Quaternion
    ) {
        this.description = `Change rotation of ${object.name}`;
    }
    
    execute(): void {
        this.object.transform.rotation.copy(this.newValue);
    }
    
    undo(): void {
        this.object.transform.rotation.copy(this.oldValue);
    }
}

/**
 * Create object command
 */
export class CreateObjectCommand implements ICommand {
    description: string;
    
    constructor(
        private object: GameObject,
        private addCallback: (obj: GameObject) => void,
        private removeCallback: (obj: GameObject) => void
    ) {
        this.description = `Create ${object.name}`;
    }
    
    execute(): void {
        this.addCallback(this.object);
    }
    
    undo(): void {
        this.removeCallback(this.object);
    }
}

/**
 * Delete object command
 */
export class DeleteObjectCommand implements ICommand {
    description: string;
    
    constructor(
        private object: GameObject,
        private addCallback: (obj: GameObject) => void,
        private removeCallback: (obj: GameObject) => void
    ) {
        this.description = `Delete ${object.name}`;
    }
    
    execute(): void {
        this.removeCallback(this.object);
    }
    
    undo(): void {
        this.addCallback(this.object);
    }
}

/**
 * Rename object command
 */
export class RenameCommand implements ICommand {
    description: string;
    
    constructor(
        private object: GameObject,
        private oldName: string,
        private newName: string
    ) {
        this.description = `Rename ${oldName} to ${newName}`;
    }
    
    execute(): void {
        this.object.name = this.newName;
    }
    
    undo(): void {
        this.object.name = this.oldName;
    }
}

/**
 * Composite command (for batch operations)
 */
export class CompositeCommand implements ICommand {
    description: string;
    
    constructor(
        private commands: ICommand[],
        description?: string
    ) {
        this.description = description || `${commands.length} operations`;
    }
    
    execute(): void {
        for (const cmd of this.commands) {
            cmd.execute();
        }
    }
    
    undo(): void {
        for (let i = this.commands.length - 1; i >= 0; i--) {
            this.commands[i].undo();
        }
    }
}

/**
 * Undo/Redo Manager
 * 
 * Manages command history for undo/redo operations.
 */
export class UndoManager {
    private undoStack: ICommand[] = [];
    private redoStack: ICommand[] = [];
    private maxHistory: number = 100;
    private logger: Logger;
    private events: EventSystem;

    constructor(maxHistory: number = 100) {
        this.maxHistory = maxHistory;
        this.logger = new Logger('UndoManager');
        this.events = new EventSystem();
    }

    /**
     * Execute a command and add to history
     */
    execute(command: ICommand): void {
        command.execute();
        
        this.undoStack.push(command);
        this.redoStack = []; // Clear redo stack on new action
        
        // Limit history size
        while (this.undoStack.length > this.maxHistory) {
            this.undoStack.shift();
        }
        
        this.events.emit('historyChanged', {
            canUndo: this.canUndo(),
            canRedo: this.canRedo()
        });
        
        this.logger.info(`Executed: ${command.description}`);
    }

    /**
     * Undo last command
     */
    undo(): boolean {
        if (!this.canUndo()) return false;
        
        const command = this.undoStack.pop()!;
        command.undo();
        this.redoStack.push(command);
        
        this.events.emit('historyChanged', {
            canUndo: this.canUndo(),
            canRedo: this.canRedo()
        });
        
        this.logger.info(`Undone: ${command.description}`);
        return true;
    }

    /**
     * Redo last undone command
     */
    redo(): boolean {
        if (!this.canRedo()) return false;
        
        const command = this.redoStack.pop()!;
        command.execute();
        this.undoStack.push(command);
        
        this.events.emit('historyChanged', {
            canUndo: this.canUndo(),
            canRedo: this.canRedo()
        });
        
        this.logger.info(`Redone: ${command.description}`);
        return true;
    }

    /**
     * Check if undo is available
     */
    canUndo(): boolean {
        return this.undoStack.length > 0;
    }

    /**
     * Check if redo is available
     */
    canRedo(): boolean {
        return this.redoStack.length > 0;
    }

    /**
     * Clear history
     */
    clear(): void {
        this.undoStack = [];
        this.redoStack = [];
        
        this.events.emit('historyChanged', {
            canUndo: false,
            canRedo: false
        });
        
        this.logger.info('History cleared');
    }

    /**
     * Get undo stack size
     */
    getUndoCount(): number {
        return this.undoStack.length;
    }

    /**
     * Get redo stack size
     */
    getRedoCount(): number {
        return this.redoStack.length;
    }

    /**
     * Get event system
     */
    getEvents(): EventSystem {
        return this.events;
    }
}

/**
 * Editor Commands Registry
 * 
 * Provides static command creation helpers.
 */
export class EditorCommands {
    /**
     * Create position command
     */
    static createPositionChange(
        object: GameObject,
        newValue: Vector3
    ): TransformVec3Command {
        return new TransformVec3Command(
            object,
            'position',
            object.transform.position.clone(),
            newValue.clone()
        );
    }

    /**
     * Create scale command
     */
    static createScaleChange(
        object: GameObject,
        newValue: Vector3
    ): TransformVec3Command {
        return new TransformVec3Command(
            object,
            'scale',
            object.transform.scale.clone(),
            newValue.clone()
        );
    }

    /**
     * Create rotation command
     */
    static createRotationChange(
        object: GameObject,
        newValue: Quaternion
    ): TransformRotationCommand {
        return new TransformRotationCommand(
            object,
            object.transform.rotation.clone(),
            newValue.clone()
        );
    }

    /**
     * Create create object command
     */
    static createObject(
        object: GameObject,
        addCallback: (obj: GameObject) => void,
        removeCallback: (obj: GameObject) => void
    ): CreateObjectCommand {
        return new CreateObjectCommand(object, addCallback, removeCallback);
    }

    /**
     * Create delete object command
     */
    static deleteObject(
        object: GameObject,
        addCallback: (obj: GameObject) => void,
        removeCallback: (obj: GameObject) => void
    ): DeleteObjectCommand {
        return new DeleteObjectCommand(object, addCallback, removeCallback);
    }

    /**
     * Create rename command
     */
    static rename(
        object: GameObject,
        newName: string
    ): RenameCommand {
        return new RenameCommand(object, object.name, newName);
    }

    /**
     * Create composite command
     */
    static composite(
        commands: ICommand[],
        description?: string
    ): CompositeCommand {
        return new CompositeCommand(commands, description);
    }
}
