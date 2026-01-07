/**
 * Animation State Machine
 * 
 * Manages animation state transitions with conditions and blend times.
 * Similar to Unity's Animator Controller or Unreal's Animation Blueprint.
 */

import { EventSystem } from '../core/EventSystem';
import { AnimationClip } from './AnimationClip';
import { AnimationPlayer, PlaybackMode } from './AnimationPlayer';

/**
 * Condition types for state transitions
 */
export enum ConditionType {
    BOOL = 'bool',
    FLOAT = 'float',
    INT = 'int',
    TRIGGER = 'trigger'
}

/**
 * Comparison operators for conditions
 */
export enum ComparisonOperator {
    EQUAL = 'equal',
    NOT_EQUAL = 'notEqual',
    GREATER = 'greater',
    LESS = 'less',
    GREATER_OR_EQUAL = 'greaterOrEqual',
    LESS_OR_EQUAL = 'lessOrEqual'
}

/**
 * Animation parameter
 */
export interface AnimationParameter {
    name: string;
    type: ConditionType;
    value: boolean | number;
}

/**
 * Transition condition
 */
export interface TransitionCondition {
    parameter: string;
    operator: ComparisonOperator;
    value: boolean | number;
}

/**
 * State transition definition
 */
export interface StateTransition {
    fromState: string;
    toState: string;
    conditions: TransitionCondition[];
    duration: number;  // Blend duration in seconds
    exitTime?: number;  // Normalized time (0-1) to start transition
    hasExitTime: boolean;
}

/**
 * Animation state
 */
export class AnimationState {
    public name: string;
    public clip: AnimationClip;
    public speed: number;
    public loop: boolean;
    public transitions: StateTransition[];

    constructor(name: string, clip: AnimationClip) {
        this.name = name;
        this.clip = clip;
        this.speed = 1.0;
        this.loop = true;
        this.transitions = [];
    }

    /**
     * Add a transition to another state
     */
    addTransition(toState: string, conditions: TransitionCondition[], duration: number = 0.3): StateTransition {
        const transition: StateTransition = {
            fromState: this.name,
            toState,
            conditions,
            duration,
            hasExitTime: false
        };
        this.transitions.push(transition);
        return transition;
    }
}

/**
 * Animation State Machine
 * 
 * Manages states, transitions, and parameters for complex animation logic.
 */
export class AnimationStateMachine {
    private states: Map<string, AnimationState>;
    private parameters: Map<string, AnimationParameter>;
    private currentState: AnimationState | null;
    private nextState: AnimationState | null;
    private isTransitioning: boolean;
    private transitionProgress: number;
    private transitionDuration: number;
    private currentPlayer: AnimationPlayer;
    private nextPlayer: AnimationPlayer;
    private events: EventSystem;
    private targets: Map<string, any>;
    private stateTime: number;  // Time spent in current state

    constructor() {
        this.states = new Map();
        this.parameters = new Map();
        this.currentState = null;
        this.nextState = null;
        this.isTransitioning = false;
        this.transitionProgress = 0;
        this.transitionDuration = 0;
        this.currentPlayer = new AnimationPlayer();
        this.nextPlayer = new AnimationPlayer();
        this.events = new EventSystem();
        this.targets = new Map();
        this.stateTime = 0;
    }

    /**
     * Add a state to the state machine
     */
    addState(state: AnimationState): void {
        this.states.set(state.name, state);
    }

    /**
     * Create and add a new state
     */
    createState(name: string, clip: AnimationClip): AnimationState {
        const state = new AnimationState(name, clip);
        this.addState(state);
        return state;
    }

    /**
     * Set a state as the default starting state
     */
    setDefaultState(stateName: string): void {
        const state = this.states.get(stateName);
        if (!state) {
            console.warn(`State ${stateName} not found`);
            return;
        }

        this.currentState = state;
        this.currentPlayer.setClip(state.clip);
        this.currentPlayer.setSpeed(state.speed);
        
        // Copy targets to player
        this.targets.forEach((target, name) => {
            this.currentPlayer.registerTarget(name, target);
        });

        const mode = state.loop ? PlaybackMode.LOOP : PlaybackMode.ONCE;
        this.currentPlayer.play(mode);
        this.stateTime = 0;

        this.events.emit('stateEnter', { state: state.name });
    }

    /**
     * Add a parameter
     */
    addParameter(name: string, type: ConditionType, defaultValue: boolean | number = 0): void {
        this.parameters.set(name, {
            name,
            type,
            value: defaultValue
        });
    }

    /**
     * Set a boolean parameter
     */
    setBool(name: string, value: boolean): void {
        const param = this.parameters.get(name);
        if (param && param.type === ConditionType.BOOL) {
            param.value = value;
            this.checkTransitions();
        }
    }

    /**
     * Set a float parameter
     */
    setFloat(name: string, value: number): void {
        const param = this.parameters.get(name);
        if (param && param.type === ConditionType.FLOAT) {
            param.value = value;
            this.checkTransitions();
        }
    }

    /**
     * Set an integer parameter
     */
    setInt(name: string, value: number): void {
        const param = this.parameters.get(name);
        if (param && param.type === ConditionType.INT) {
            param.value = Math.floor(value);
            this.checkTransitions();
        }
    }

    /**
     * Set a trigger (auto-resets after use)
     */
    setTrigger(name: string): void {
        const param = this.parameters.get(name);
        if (param && param.type === ConditionType.TRIGGER) {
            param.value = true;
            this.checkTransitions();
        }
    }

    /**
     * Register a target for animation
     */
    registerTarget(name: string, target: any): void {
        this.targets.set(name, target);
        this.currentPlayer.registerTarget(name, target);
        this.nextPlayer.registerTarget(name, target);
    }

    /**
     * Update the state machine
     */
    update(deltaTime: number): void {
        if (!this.currentState) return;

        this.stateTime += deltaTime;

        if (this.isTransitioning) {
            this.updateTransition(deltaTime);
        } else {
            this.currentPlayer.update(deltaTime);
            this.checkTransitions();
        }
    }

    /**
     * Check if any transitions should occur
     */
    private checkTransitions(): void {
        if (!this.currentState || this.isTransitioning) return;

        for (const transition of this.currentState.transitions) {
            if (this.evaluateTransition(transition)) {
                this.startTransition(transition);
                break;
            }
        }
    }

    /**
     * Evaluate if a transition should occur
     */
    private evaluateTransition(transition: StateTransition): boolean {
        // Check exit time if required
        if (transition.hasExitTime && transition.exitTime !== undefined) {
            const normalizedTime = this.currentPlayer.getTime() / this.currentState!.clip.getDuration();
            if (normalizedTime < transition.exitTime) {
                return false;
            }
        }

        // Check all conditions
        for (const condition of transition.conditions) {
            if (!this.evaluateCondition(condition)) {
                return false;
            }
        }

        return true;
    }

    /**
     * Evaluate a single condition
     */
    private evaluateCondition(condition: TransitionCondition): boolean {
        const param = this.parameters.get(condition.parameter);
        if (!param) return false;

        const paramValue = param.value;
        const condValue = condition.value;

        switch (condition.operator) {
            case ComparisonOperator.EQUAL:
                return paramValue === condValue;
            case ComparisonOperator.NOT_EQUAL:
                return paramValue !== condValue;
            case ComparisonOperator.GREATER:
                return typeof paramValue === 'number' && typeof condValue === 'number' && paramValue > condValue;
            case ComparisonOperator.LESS:
                return typeof paramValue === 'number' && typeof condValue === 'number' && paramValue < condValue;
            case ComparisonOperator.GREATER_OR_EQUAL:
                return typeof paramValue === 'number' && typeof condValue === 'number' && paramValue >= condValue;
            case ComparisonOperator.LESS_OR_EQUAL:
                return typeof paramValue === 'number' && typeof condValue === 'number' && paramValue <= condValue;
            default:
                return false;
        }
    }

    /**
     * Start a transition to a new state
     */
    private startTransition(transition: StateTransition): void {
        const nextState = this.states.get(transition.toState);
        if (!nextState) return;

        this.nextState = nextState;
        this.isTransitioning = true;
        this.transitionProgress = 0;
        this.transitionDuration = transition.duration;

        // Setup next player
        this.nextPlayer.setClip(nextState.clip);
        this.nextPlayer.setSpeed(nextState.speed);
        const mode = nextState.loop ? PlaybackMode.LOOP : PlaybackMode.ONCE;
        this.nextPlayer.play(mode);

        // Reset triggers
        this.parameters.forEach(param => {
            if (param.type === ConditionType.TRIGGER) {
                param.value = false;
            }
        });

        this.events.emit('transitionStart', {
            from: this.currentState!.name,
            to: nextState.name
        });
    }

    /**
     * Update transition blending
     */
    private updateTransition(deltaTime: number): void {
        if (!this.nextState) return;

        this.transitionProgress += deltaTime / this.transitionDuration;

        if (this.transitionProgress >= 1.0) {
            // Transition complete
            this.currentState = this.nextState;
            this.nextState = null;
            this.isTransitioning = false;
            this.transitionProgress = 0;
            this.stateTime = 0;

            // Swap players
            const temp = this.currentPlayer;
            this.currentPlayer = this.nextPlayer;
            this.nextPlayer = temp;
            this.nextPlayer.stop();

            this.events.emit('stateEnter', { state: this.currentState.name });
        } else {
            // Update both players
            this.currentPlayer.update(deltaTime);
            this.nextPlayer.update(deltaTime);

            // Blend between them (blend logic handled by animation blender in practice)
            // Here we just update both - actual blending would be done by the application
        }
    }

    /**
     * Get current state name
     */
    getCurrentState(): string | null {
        return this.currentState?.name || null;
    }

    /**
     * Check if transitioning
     */
    isInTransition(): boolean {
        return this.isTransitioning;
    }

    /**
     * Get transition progress (0-1)
     */
    getTransitionProgress(): number {
        return this.transitionProgress;
    }

    /**
     * Get event system for listening to state changes
     */
    getEvents(): EventSystem {
        return this.events;
    }

    /**
     * Get current animation player
     */
    getCurrentPlayer(): AnimationPlayer {
        return this.currentPlayer;
    }

    /**
     * Get next animation player (during transition)
     */
    getNextPlayer(): AnimationPlayer | null {
        return this.isTransitioning ? this.nextPlayer : null;
    }
}
