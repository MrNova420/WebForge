/**
 * @module core
 * @fileoverview GameStateManager - Global game state machine with stack-based
 * state management, validated transitions, and event-driven notifications.
 */

import { EventSystem, EventHandler } from './EventSystem';

/**
 * Represents a discrete game state with lifecycle hooks.
 */
export interface GameState {
    /** Unique name identifying this state */
    name: string;
    /** Called when entering this state */
    onEnter?(previousState: string): void;
    /** Called when exiting this state */
    onExit?(nextState: string): void;
    /** Called each frame while this state is active */
    onUpdate?(deltaTime: number): void;
    /** Called when the state is paused */
    onPause?(): void;
    /** Called when the state is resumed */
    onResume?(): void;
}

/**
 * Defines a valid transition between two states.
 */
export interface GameStateTransition {
    /** Source state name, or '*' to match any state */
    from: string;
    /** Target state name */
    to: string;
    /** Optional guard condition; transition is blocked when it returns false */
    condition?: () => boolean;
    /** Optional callback invoked when the transition executes */
    onTransition?: (from: string, to: string) => void;
}

/**
 * Global game state machine with transitions for managing game flow.
 *
 * Supports flat state changes, validated transitions, and a push/pop state
 * stack for overlay-style states (e.g. pushing Pause on top of Gameplay).
 *
 * @example
 * ```typescript
 * const gsm = GameStateManager.createDefaultGameFlow();
 * gsm.setState('MainMenu');
 * gsm.transitionTo('Loading');
 * gsm.on('state:enter', (data) => console.log('Entered', data.state));
 * ```
 */
export class GameStateManager {
    private _states: Map<string, GameState> = new Map();
    private _transitions: GameStateTransition[] = [];
    private _currentState: string | null = null;
    private _previousState: string | null = null;
    private _history: string[] = [];
    private _stack: string[] = [];
    private _paused: boolean = false;
    private _events: EventSystem = new EventSystem();

    // -- State registration --------------------------------------------------

    /** Registers a state. Throws if a state with the same name already exists. */
    public addState(state: GameState): void {
        if (this._states.has(state.name)) {
            throw new Error(`State "${state.name}" already exists`);
        }
        this._states.set(state.name, state);
    }

    /** Removes a registered state by name. Cannot remove the active state. */
    public removeState(name: string): void {
        if (this._currentState === name) {
            throw new Error(`Cannot remove active state "${name}"`);
        }
        this._states.delete(name);
        this._transitions = this._transitions.filter(
            (t) => t.from !== name && t.to !== name
        );
    }

    // -- Transition registration ---------------------------------------------

    /** Adds a transition rule between states. */
    public addTransition(transition: GameStateTransition): void {
        this._transitions.push(transition);
    }

    /** Removes a specific transition rule. */
    public removeTransition(from: string, to: string): void {
        this._transitions = this._transitions.filter(
            (t) => !(t.from === from && t.to === to)
        );
    }

    // -- State changes -------------------------------------------------------

    /**
     * Force-sets the current state without transition validation.
     * @returns `true` if the state was set successfully.
     */
    public setState(name: string): boolean {
        const target = this._states.get(name);
        if (!target) return false;

        const prev = this._currentState;
        if (prev) {
            this._states.get(prev)?.onExit?.(name);
            this._events.emit('state:exit', { state: prev, next: name });
        }

        this._previousState = prev;
        this._currentState = name;
        this._paused = false;
        this._history.push(name);

        target.onEnter?.(prev ?? '');
        this._events.emit('state:enter', { state: name, previous: prev });
        return true;
    }

    /**
     * Transitions to a new state if a valid transition exists and its
     * condition (if any) is satisfied.
     * @returns `true` if the transition succeeded.
     */
    public transitionTo(name: string): boolean {
        if (!this._states.has(name)) return false;
        if (!this.canTransitionTo(name)) return false;

        const from = this._currentState ?? '';
        const transition = this._findTransition(from, name);
        transition?.onTransition?.(from, name);
        this._events.emit('state:transition', { from, to: name });

        return this.setState(name);
    }

    // -- Queries -------------------------------------------------------------

    /** Returns the name of the current active state, or `null`. */
    public getCurrentState(): string | null {
        return this._currentState;
    }

    /** Returns the name of the previous state, or `null`. */
    public getPreviousState(): string | null {
        return this._previousState;
    }

    /** Returns the full history of state names entered. */
    public getStateHistory(): string[] {
        return [...this._history];
    }

    /** Checks whether the current state matches the given name. */
    public isInState(name: string): boolean {
        return this._currentState === name;
    }

    /** Returns all state names reachable from the current state via valid transitions. */
    public getAvailableTransitions(): string[] {
        const current = this._currentState ?? '';
        return this._transitions
            .filter(
                (t) =>
                    (t.from === current || t.from === '*') &&
                    (!t.condition || t.condition())
            )
            .map((t) => t.to);
    }

    /** Checks whether a transition to the given state is currently allowed. */
    public canTransitionTo(name: string): boolean {
        const current = this._currentState ?? '';
        const transition = this._findTransition(current, name);
        if (!transition) return false;
        return !transition.condition || transition.condition();
    }

    /** Returns the names of all registered states. */
    public getAllStates(): string[] {
        return Array.from(this._states.keys());
    }

    /** Returns the number of registered states. */
    public getStateCount(): number {
        return this._states.size;
    }

    // -- Update / Pause ------------------------------------------------------

    /** Calls `onUpdate` on the current state unless paused. */
    public update(deltaTime: number): void {
        if (this._paused || !this._currentState) return;
        this._states.get(this._currentState)?.onUpdate?.(deltaTime);
    }

    /** Pauses the current state. */
    public pause(): void {
        if (this._paused || !this._currentState) return;
        this._paused = true;
        this._states.get(this._currentState)?.onPause?.();
        this._events.emit('state:pause', { state: this._currentState });
    }

    /** Resumes the current state. */
    public resume(): void {
        if (!this._paused || !this._currentState) return;
        this._paused = false;
        this._states.get(this._currentState)?.onResume?.();
        this._events.emit('state:resume', { state: this._currentState });
    }

    /** Returns whether the manager is currently paused. */
    public isPaused(): boolean {
        return this._paused;
    }

    // -- State stack ---------------------------------------------------------

    /**
     * Pushes a new state onto the stack, pausing the current state.
     * Useful for overlay states like Pause menus.
     */
    public pushState(name: string): void {
        const target = this._states.get(name);
        if (!target) {
            throw new Error(`State "${name}" not found`);
        }

        if (this._currentState) {
            this._states.get(this._currentState)?.onPause?.();
            this._stack.push(this._currentState);
        }

        const prev = this._currentState;
        this._previousState = prev;
        this._currentState = name;
        this._paused = false;
        this._history.push(name);

        target.onEnter?.(prev ?? '');
        this._events.emit('state:push', { state: name, previous: prev });
        this._events.emit('state:enter', { state: name, previous: prev });
    }

    /**
     * Pops the current state off the stack and resumes the one beneath it.
     * @returns The name of the popped state, or `null` if the stack is empty.
     */
    public popState(): string | null {
        if (this._stack.length === 0) return null;

        const popped = this._currentState;
        if (popped) {
            this._states.get(popped)?.onExit?.('');
            this._events.emit('state:exit', { state: popped, next: '' });
        }

        const restored = this._stack.pop()!;
        this._previousState = popped;
        this._currentState = restored;
        this._paused = false;
        this._history.push(restored);

        this._states.get(restored)?.onResume?.();
        this._events.emit('state:pop', { state: popped, restored });
        this._events.emit('state:enter', { state: restored, previous: popped });
        return popped;
    }

    /** Returns the number of states on the stack (not counting the active state). */
    public getStackDepth(): number {
        return this._stack.length;
    }

    // -- Events --------------------------------------------------------------

    /** Subscribes to a state manager event. */
    public on<T = any>(event: string, callback: EventHandler<T>): void {
        this._events.on(event, callback);
    }

    /** Unsubscribes from a state manager event. */
    public off<T = any>(event: string, callback: EventHandler<T>): void {
        this._events.off(event, callback);
    }

    // -- Cleanup -------------------------------------------------------------

    /** Resets the manager, removing all states, transitions, and history. */
    public clear(): void {
        if (this._currentState) {
            this._states.get(this._currentState)?.onExit?.('');
        }
        this._states.clear();
        this._transitions = [];
        this._currentState = null;
        this._previousState = null;
        this._history = [];
        this._stack = [];
        this._paused = false;
        this._events.clear();
    }

    // -- Private helpers -----------------------------------------------------

    private _findTransition(from: string, to: string): GameStateTransition | undefined {
        return this._transitions.find(
            (t) => (t.from === from || t.from === '*') && t.to === to
        );
    }

    // -- Static factory ------------------------------------------------------

    /**
     * Creates a `GameStateManager` pre-configured with a typical game flow:
     *
     * ```
     * MainMenu -> Loading -> Gameplay <-> Pause
     * Gameplay -> GameOver -> MainMenu
     * ```
     */
    public static createDefaultGameFlow(): GameStateManager {
        const gsm = new GameStateManager();

        const stateNames = ['MainMenu', 'Loading', 'Gameplay', 'Pause', 'GameOver'];
        for (const name of stateNames) {
            gsm.addState({ name });
        }

        const transitions: [string, string][] = [
            ['MainMenu', 'Loading'],
            ['Loading', 'Gameplay'],
            ['Gameplay', 'Pause'],
            ['Pause', 'Gameplay'],
            ['Gameplay', 'GameOver'],
            ['GameOver', 'MainMenu'],
        ];
        for (const [from, to] of transitions) {
            gsm.addTransition({ from, to });
        }

        return gsm;
    }
}
