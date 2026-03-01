/**
 * @module core
 * @fileoverview Rebindable input action mapping system that abstracts raw input
 * into named game actions. Supports keyboard, mouse, and gamepad bindings with
 * runtime rebinding and serialization.
 */

import { Input } from './Input';

/**
 * Types of input sources that can be bound to an action.
 */
export enum InputBindingType {
    Keyboard = 'Keyboard',
    MouseButton = 'MouseButton',
    MouseAxis = 'MouseAxis',
    GamepadButton = 'GamepadButton',
    GamepadAxis = 'GamepadAxis'
}

/**
 * Describes a single input binding that maps a physical input to an action.
 */
export interface InputBinding {
    /** The type of input source. */
    type: InputBindingType;
    /** Keyboard key code (e.g. 'KeyW', 'Space'). Used when type is Keyboard. */
    key?: string;
    /** Mouse button index (0=left, 1=middle, 2=right). Used when type is MouseButton. */
    mouseButton?: number;
    /** Mouse axis identifier. Used when type is MouseAxis. */
    mouseAxis?: 'x' | 'y' | 'wheel';
    /** Gamepad button index. Used when type is GamepadButton. */
    gamepadButton?: number;
    /** Gamepad axis index. Used when type is GamepadAxis. */
    gamepadAxis?: number;
    /** Value multiplier. Defaults to 1. Use -1 for inverted axes. */
    scale?: number;
    /** Dead zone threshold for analog axes. Values below this are treated as 0. */
    deadzone?: number;
}

/**
 * A named action with one or more input bindings.
 */
export interface InputAction {
    /** Unique name identifying this action (e.g. 'Jump', 'MoveForward'). */
    name: string;
    /** The input bindings assigned to this action. */
    bindings: InputBinding[];
    /** Whether this action behaves as a digital button or analog axis. */
    type: 'button' | 'axis';
}

/**
 * Rebindable input action mapping system.
 *
 * Abstracts raw keyboard, mouse, and gamepad input into named game actions,
 * allowing players to customize controls at runtime. Actions can be serialized
 * to JSON for persistence across sessions.
 *
 * @example
 * ```typescript
 * const actionMap = new InputActionMap(input);
 * actionMap.createDefaultFPSActions();
 *
 * // In game loop
 * if (actionMap.isActionPressed('Jump')) {
 *     player.jump();
 * }
 * const moveX = actionMap.getActionValue('StrafeRight') - actionMap.getActionValue('StrafeLeft');
 * ```
 */
export class InputActionMap {
    /** Reference to the engine's input system. */
    private _input: Input;

    /** Map of action names to their definitions. */
    private _actions: Map<string, InputAction>;

    /** Default gamepad index used for gamepad bindings. */
    private _gamepadIndex: number;

    /**
     * Creates a new InputActionMap.
     * @param input - The engine Input instance to read raw input from
     * @param gamepadIndex - Default gamepad index to use for gamepad bindings
     */
    constructor(input: Input, gamepadIndex: number = 0) {
        this._input = input;
        this._actions = new Map();
        this._gamepadIndex = gamepadIndex;
    }

    /**
     * Registers a new named action with the given bindings.
     * @param name - Unique action name
     * @param type - Whether the action is a 'button' or 'axis'
     * @param bindings - Array of input bindings for this action
     * @throws Error if an action with the same name already exists
     */
    public registerAction(name: string, type: 'button' | 'axis', bindings: InputBinding[]): void {
        if (this._actions.has(name)) {
            throw new Error(`Action "${name}" is already registered.`);
        }
        this._actions.set(name, { name, type, bindings: [...bindings] });
    }

    /**
     * Removes a registered action by name.
     * @param name - The action name to remove
     */
    public removeAction(name: string): void {
        this._actions.delete(name);
    }

    /**
     * Gets the current value of an action.
     * For button actions, returns 0 (not held) or 1 (held).
     * For axis actions, returns a value typically in the range -1 to 1.
     * When multiple bindings contribute, the value with the largest absolute magnitude wins.
     * @param name - The action name to query
     * @returns The action's current value, or 0 if the action is not found
     */
    public getActionValue(name: string): number {
        const action = this._actions.get(name);
        if (!action) return 0;

        let result = 0;
        for (const binding of action.bindings) {
            const raw = this._readBindingValue(binding);
            if (Math.abs(raw) > Math.abs(result)) {
                result = raw;
            }
        }

        if (action.type === 'button') {
            return result !== 0 ? 1 : 0;
        }
        return result;
    }

    /**
     * Checks if an action was pressed this frame (transition from up to down).
     * @param name - The action name to query
     * @returns True if any binding for this action was just pressed
     */
    public isActionPressed(name: string): boolean {
        const action = this._actions.get(name);
        if (!action) return false;

        for (const binding of action.bindings) {
            if (this._isBindingPressed(binding)) return true;
        }
        return false;
    }

    /**
     * Checks if an action is currently held down.
     * @param name - The action name to query
     * @returns True if any binding for this action is held down
     */
    public isActionDown(name: string): boolean {
        const action = this._actions.get(name);
        if (!action) return false;

        for (const binding of action.bindings) {
            if (this._isBindingDown(binding)) return true;
        }
        return false;
    }

    /**
     * Checks if an action was released this frame (transition from down to up).
     * @param name - The action name to query
     * @returns True if any binding for this action was just released
     */
    public isActionReleased(name: string): boolean {
        const action = this._actions.get(name);
        if (!action) return false;

        for (const binding of action.bindings) {
            if (this._isBindingReleased(binding)) return true;
        }
        return false;
    }

    /**
     * Replaces a specific binding on an action at the given index.
     * @param name - The action name to modify
     * @param bindingIndex - The index of the binding to replace
     * @param newBinding - The new binding configuration
     * @throws Error if the action is not found or the index is out of range
     */
    public rebindAction(name: string, bindingIndex: number, newBinding: InputBinding): void {
        const action = this._actions.get(name);
        if (!action) {
            throw new Error(`Action "${name}" not found.`);
        }
        if (bindingIndex < 0 || bindingIndex >= action.bindings.length) {
            throw new Error(`Binding index ${bindingIndex} out of range for action "${name}".`);
        }
        action.bindings[bindingIndex] = { ...newBinding };
    }

    /**
     * Gets a copy of the bindings for an action.
     * @param name - The action name
     * @returns Array of input bindings, or empty array if action not found
     */
    public getBindings(name: string): InputBinding[] {
        const action = this._actions.get(name);
        if (!action) return [];
        return action.bindings.map(b => ({ ...b }));
    }

    /**
     * Gets the names of all registered actions.
     * @returns Array of action name strings
     */
    public getAllActions(): string[] {
        return Array.from(this._actions.keys());
    }

    /**
     * Serializes all action definitions and bindings to a JSON string.
     * Useful for saving player control preferences.
     * @returns JSON string representation of all actions
     */
    public exportBindings(): string {
        const data: InputAction[] = [];
        for (const action of this._actions.values()) {
            data.push({
                name: action.name,
                type: action.type,
                bindings: action.bindings.map(b => ({ ...b }))
            });
        }
        return JSON.stringify(data);
    }

    /**
     * Loads action definitions and bindings from a JSON string,
     * replacing all current actions.
     * @param json - JSON string previously produced by {@link exportBindings}
     * @throws Error if the JSON is malformed or contains invalid data
     */
    public importBindings(json: string): void {
        const data: InputAction[] = JSON.parse(json);
        if (!Array.isArray(data)) {
            throw new Error('Invalid bindings data: expected an array.');
        }
        this._actions.clear();
        for (const entry of data) {
            if (!entry.name || !entry.type || !Array.isArray(entry.bindings)) {
                throw new Error(`Invalid action entry: ${JSON.stringify(entry)}`);
            }
            this._actions.set(entry.name, {
                name: entry.name,
                type: entry.type,
                bindings: entry.bindings.map(b => ({ ...b }))
            });
        }
    }

    /**
     * Registers a standard set of FPS game actions with WASD + mouse defaults.
     *
     * Creates: MoveForward, MoveBackward, StrafeLeft, StrafeRight,
     * Jump, Sprint, Crouch, Fire, AltFire, Reload, Interact, LookX, LookY.
     */
    public createDefaultFPSActions(): void {
        this.registerAction('MoveForward', 'button', [
            { type: InputBindingType.Keyboard, key: 'KeyW' },
            { type: InputBindingType.GamepadAxis, gamepadAxis: 1, scale: -1, deadzone: 0.15 }
        ]);
        this.registerAction('MoveBackward', 'button', [
            { type: InputBindingType.Keyboard, key: 'KeyS' },
            { type: InputBindingType.GamepadAxis, gamepadAxis: 1, scale: 1, deadzone: 0.15 }
        ]);
        this.registerAction('StrafeLeft', 'button', [
            { type: InputBindingType.Keyboard, key: 'KeyA' },
            { type: InputBindingType.GamepadAxis, gamepadAxis: 0, scale: -1, deadzone: 0.15 }
        ]);
        this.registerAction('StrafeRight', 'button', [
            { type: InputBindingType.Keyboard, key: 'KeyD' },
            { type: InputBindingType.GamepadAxis, gamepadAxis: 0, scale: 1, deadzone: 0.15 }
        ]);
        this.registerAction('Jump', 'button', [
            { type: InputBindingType.Keyboard, key: 'Space' },
            { type: InputBindingType.GamepadButton, gamepadButton: 0 }
        ]);
        this.registerAction('Sprint', 'button', [
            { type: InputBindingType.Keyboard, key: 'ShiftLeft' },
            { type: InputBindingType.GamepadButton, gamepadButton: 10 }
        ]);
        this.registerAction('Crouch', 'button', [
            { type: InputBindingType.Keyboard, key: 'ControlLeft' },
            { type: InputBindingType.GamepadButton, gamepadButton: 11 }
        ]);
        this.registerAction('Fire', 'button', [
            { type: InputBindingType.MouseButton, mouseButton: 0 },
            { type: InputBindingType.GamepadButton, gamepadButton: 7 }
        ]);
        this.registerAction('AltFire', 'button', [
            { type: InputBindingType.MouseButton, mouseButton: 2 },
            { type: InputBindingType.GamepadButton, gamepadButton: 6 }
        ]);
        this.registerAction('Reload', 'button', [
            { type: InputBindingType.Keyboard, key: 'KeyR' },
            { type: InputBindingType.GamepadButton, gamepadButton: 2 }
        ]);
        this.registerAction('Interact', 'button', [
            { type: InputBindingType.Keyboard, key: 'KeyE' },
            { type: InputBindingType.GamepadButton, gamepadButton: 3 }
        ]);
        this.registerAction('LookX', 'axis', [
            { type: InputBindingType.MouseAxis, mouseAxis: 'x', scale: 1 },
            { type: InputBindingType.GamepadAxis, gamepadAxis: 2, scale: 1, deadzone: 0.1 }
        ]);
        this.registerAction('LookY', 'axis', [
            { type: InputBindingType.MouseAxis, mouseAxis: 'y', scale: 1 },
            { type: InputBindingType.GamepadAxis, gamepadAxis: 3, scale: 1, deadzone: 0.1 }
        ]);
    }

    /**
     * Registers third-person camera actions on top of existing actions.
     *
     * Creates: CameraOrbitX, CameraOrbitY, CameraZoom, LockOn.
     * Typically called after {@link createDefaultFPSActions}.
     */
    public createDefaultThirdPersonActions(): void {
        this.registerAction('CameraOrbitX', 'axis', [
            { type: InputBindingType.MouseAxis, mouseAxis: 'x', scale: 1 },
            { type: InputBindingType.GamepadAxis, gamepadAxis: 2, scale: 1, deadzone: 0.1 }
        ]);
        this.registerAction('CameraOrbitY', 'axis', [
            { type: InputBindingType.MouseAxis, mouseAxis: 'y', scale: 1 },
            { type: InputBindingType.GamepadAxis, gamepadAxis: 3, scale: 1, deadzone: 0.1 }
        ]);
        this.registerAction('CameraZoom', 'axis', [
            { type: InputBindingType.MouseAxis, mouseAxis: 'wheel', scale: 1 },
            { type: InputBindingType.GamepadAxis, gamepadAxis: 5, scale: 1, deadzone: 0.05 }
        ]);
        this.registerAction('LockOn', 'button', [
            { type: InputBindingType.MouseButton, mouseButton: 1 },
            { type: InputBindingType.GamepadButton, gamepadButton: 9 }
        ]);
    }

    /**
     * Removes all registered actions.
     */
    public clear(): void {
        this._actions.clear();
    }

    /**
     * Gets the number of registered actions.
     * @returns The action count
     */
    public getActionCount(): number {
        return this._actions.size;
    }

    // ─── Private helpers ─────────────────────────────────────────────────

    /**
     * Reads the current analog value from a single binding, applying scale
     * and deadzone. For digital sources (keys, buttons) returns 0 or scale.
     */
    private _readBindingValue(binding: InputBinding): number {
        const scale = binding.scale ?? 1;
        const deadzone = binding.deadzone ?? 0;

        switch (binding.type) {
            case InputBindingType.Keyboard:
                return this._input.isKeyDown(binding.key!) ? scale : 0;

            case InputBindingType.MouseButton:
                return this._input.isMouseButtonDown(binding.mouseButton!) ? scale : 0;

            case InputBindingType.MouseAxis: {
                let raw = 0;
                if (binding.mouseAxis === 'x') {
                    raw = this._input.getMouseDelta().x;
                } else if (binding.mouseAxis === 'y') {
                    raw = this._input.getMouseDelta().y;
                } else if (binding.mouseAxis === 'wheel') {
                    raw = this._input.getMouseWheelDelta();
                }
                return Math.abs(raw) > deadzone ? raw * scale : 0;
            }

            case InputBindingType.GamepadButton:
                return this._input.isGamepadButtonDown(this._gamepadIndex, binding.gamepadButton!) ? scale : 0;

            case InputBindingType.GamepadAxis: {
                const raw = this._input.getGamepadAxis(this._gamepadIndex, binding.gamepadAxis!);
                return Math.abs(raw) > deadzone ? raw * scale : 0;
            }

            default:
                return 0;
        }
    }

    /** Checks if a binding's source was pressed this frame. */
    private _isBindingPressed(binding: InputBinding): boolean {
        switch (binding.type) {
            case InputBindingType.Keyboard:
                return this._input.isKeyPressed(binding.key!);
            case InputBindingType.MouseButton:
                return this._input.isMouseButtonPressed(binding.mouseButton!);
            case InputBindingType.GamepadButton:
                return this._input.isGamepadButtonPressed(this._gamepadIndex, binding.gamepadButton!);
            default:
                return false;
        }
    }

    /** Checks if a binding's source is currently held down. */
    private _isBindingDown(binding: InputBinding): boolean {
        switch (binding.type) {
            case InputBindingType.Keyboard:
                return this._input.isKeyDown(binding.key!);
            case InputBindingType.MouseButton:
                return this._input.isMouseButtonDown(binding.mouseButton!);
            case InputBindingType.GamepadButton:
                return this._input.isGamepadButtonDown(this._gamepadIndex, binding.gamepadButton!);
            default:
                return false;
        }
    }

    /** Checks if a binding's source was released this frame. */
    private _isBindingReleased(binding: InputBinding): boolean {
        switch (binding.type) {
            case InputBindingType.Keyboard:
                return this._input.isKeyReleased(binding.key!);
            case InputBindingType.MouseButton:
                return this._input.isMouseButtonReleased(binding.mouseButton!);
            case InputBindingType.GamepadButton:
                return this._input.isGamepadButtonReleased(this._gamepadIndex, binding.gamepadButton!);
            default:
                return false;
        }
    }
}
