/**
 * WebForge Dialogue System
 *
 * Phase 13-14 (Week 89-96): Character Tech
 * Production-quality branching dialogue system for RPG games with support for
 * conditional branches, skill checks, effects, variable tracking, save/load
 * serialization, and a fluent builder API.
 */

// ── Interfaces ──────────────────────────────────────────────────────────────

/**
 * A condition that must be satisfied for a dialogue branch to be available.
 */
export interface DialogueCondition {
    /** The kind of game state this condition inspects. */
    type: 'variable' | 'item' | 'quest' | 'stat' | 'custom';
    /** Identifier of the variable, item, quest, or stat to check. */
    key: string;
    /** Comparison operator. */
    operator: '==' | '!=' | '>' | '<' | '>=' | '<=';
    /** Value to compare against. */
    value: string | number | boolean;
}

/**
 * A side-effect that is applied when a dialogue node is entered or a choice is made.
 */
export interface DialogueEffect {
    /** The category of effect to apply. */
    type: 'setVariable' | 'giveItem' | 'removeItem' | 'startQuest' | 'addXP' | 'custom';
    /** Target key (variable name, item id, quest id, etc.). */
    key: string;
    /** Payload value for the effect. */
    value: string | number | boolean;
}

/**
 * A single selectable response inside a dialogue node.
 */
export interface DialogueChoice {
    /** Unique identifier for this choice. */
    id: string;
    /** Display text shown to the player. */
    text: string;
    /** Node to advance to, or `null` to end the conversation. */
    nextNodeId: string | null;
    /** Conditions that must all pass for this choice to appear. */
    conditions?: DialogueCondition[];
    /** Effects applied when the player selects this choice. */
    effects?: DialogueEffect[];
    /** Optional skill check required to unlock or modify this choice. */
    skillCheck?: { skill: string; difficulty: number };
}

/**
 * A single dialogue node representing one speaker turn.
 */
export interface DialogueNode {
    /** Unique identifier for this node within its tree. */
    id: string;
    /** Name of the character speaking. */
    speaker: string;
    /** The dialogue text displayed to the player. */
    text: string;
    /** Optional portrait asset key for the speaker. */
    portrait?: string;
    /** Optional emotional state (e.g. 'happy', 'angry'). */
    emotion?: string;
    /** Player response options. Empty array for terminal nodes. */
    choices: DialogueChoice[];
    /** Effects applied when this node is entered. */
    effects?: DialogueEffect[];
    /** When `true`, advance to the first choice automatically after a delay. Consumed by the UI layer. */
    autoAdvance?: boolean;
    /** Seconds to wait before auto-advancing. Consumed by the UI layer (not enforced by the manager). */
    autoAdvanceDelay?: number;
    /** Asset key for an associated voice-over clip. Consumed by the UI/audio layer. */
    voiceLine?: string;
    /** Animation trigger name to play on the speaker. Consumed by the UI/animation layer. */
    animation?: string;
}

/**
 * A complete dialogue tree containing all nodes and local variables.
 */
export interface DialogueTree {
    /** Unique identifier for this tree. */
    id: string;
    /** Human-readable name. */
    name: string;
    /** ID of the first node to display. */
    startNodeId: string;
    /** Map of node id → node data. */
    nodes: Map<string, DialogueNode>;
    /** Local variables scoped to this tree. */
    variables: Record<string, string | number | boolean>;
}

// ── Callback types ──────────────────────────────────────────────────────────

/** Callback invoked when a dialogue starts. */
export type DialogueStartCallback = (tree: DialogueTree) => void;
/** Callback invoked when a dialogue ends. */
export type DialogueEndCallback = (tree: DialogueTree) => void;
/** Callback invoked when the active node changes. */
export type NodeChangeCallback = (node: DialogueNode) => void;
/** Callback invoked when a player selects a choice. */
export type ChoiceMadeCallback = (choice: DialogueChoice, node: DialogueNode) => void;

// ── Serialization helpers ───────────────────────────────────────────────────

interface SerializedDialogueManager {
    trees: Array<{ id: string; name: string; startNodeId: string; nodes: Array<[string, DialogueNode]>; variables: Record<string, string | number | boolean> }>;
    globalVariables: Record<string, string | number | boolean>;
    history: Array<{ speaker: string; text: string }>;
    activeTreeId: string | null;
    activeNodeId: string | null;
}

// ── DialogueManager ─────────────────────────────────────────────────────────

/**
 * Central manager for running dialogue trees.
 *
 * Handles tree registration, condition evaluation, effect application,
 * variable tracking, save / load serialization, and extensible handlers.
 *
 * @example
 * ```ts
 * const dm = new DialogueManager();
 * dm.registerTree(myTree);
 * dm.onDialogueStart = (tree) => console.log('Started', tree.name);
 * const firstNode = dm.startDialogue('greeting');
 * const choices = dm.getAvailableChoices();
 * dm.selectChoice(choices[0].id);
 * dm.endDialogue();
 * ```
 */
export class DialogueManager {
    // ── Private state ───────────────────────────────────────────────────────
    private _trees: Map<string, DialogueTree> = new Map();
    private _globalVariables: Map<string, string | number | boolean> = new Map();
    private _activeTree: DialogueTree | null = null;
    private _activeNode: DialogueNode | null = null;
    private _history: Array<{ speaker: string; text: string }> = [];

    private _effectHandlers: Map<string, (effect: DialogueEffect) => void> = new Map();
    private _conditionHandlers: Map<string, (condition: DialogueCondition) => boolean> = new Map();

    // ── Callbacks ───────────────────────────────────────────────────────────

    /** Fired when a dialogue tree begins. */
    public onDialogueStart: DialogueStartCallback | null = null;
    /** Fired when a dialogue tree ends. */
    public onDialogueEnd: DialogueEndCallback | null = null;
    /** Fired when the current node changes. */
    public onNodeChange: NodeChangeCallback | null = null;
    /** Fired when the player selects a choice. */
    public onChoiceMade: ChoiceMadeCallback | null = null;

    // ── Tree management ─────────────────────────────────────────────────────

    /**
     * Register a dialogue tree so it can be started later.
     * @param tree - The tree to register.
     */
    public registerTree(tree: DialogueTree): void {
        this._trees.set(tree.id, tree);
    }

    /**
     * Remove a previously registered dialogue tree.
     * @param id - Tree identifier to remove.
     */
    public removeTree(id: string): void {
        this._trees.delete(id);
    }

    // ── Dialogue flow ───────────────────────────────────────────────────────

    /**
     * Begin a dialogue from the given tree.
     * @param treeId - Identifier of a registered tree.
     * @returns The starting node, or `null` if the tree is not found.
     */
    public startDialogue(treeId: string): DialogueNode | null {
        const tree = this._trees.get(treeId);
        if (!tree) {
            return null;
        }

        this._activeTree = tree;
        this._history = [];

        const startNode = tree.nodes.get(tree.startNodeId) ?? null;
        this._setActiveNode(startNode);

        this.onDialogueStart?.(tree);
        return this._activeNode;
    }

    /**
     * Get the node currently being displayed.
     * @returns The active dialogue node, or `null` if no dialogue is running.
     */
    public getCurrentNode(): DialogueNode | null {
        return this._activeNode;
    }

    /**
     * Get choices available to the player for the current node, filtered by
     * conditions and skill checks.
     * @returns An array of choices whose conditions are all met.
     */
    public getAvailableChoices(): DialogueChoice[] {
        if (!this._activeNode) {
            return [];
        }

        return this._activeNode.choices.filter((choice) => {
            if (choice.conditions) {
                const allMet = choice.conditions.every((c) => this.evaluateCondition(c));
                if (!allMet) return false;
            }
            if (choice.skillCheck) {
                const statValue = this._resolveNumericValue(choice.skillCheck.skill);
                if (statValue < choice.skillCheck.difficulty) return false;
            }
            return true;
        });
    }

    /**
     * Select a choice by its id and advance the dialogue.
     * @param choiceId - The id of the chosen response.
     * @returns The next dialogue node, or `null` if the conversation ends.
     */
    public selectChoice(choiceId: string): DialogueNode | null {
        if (!this._activeNode || !this._activeTree) {
            return null;
        }

        const choice = this._activeNode.choices.find((c) => c.id === choiceId);
        if (!choice) {
            return null;
        }

        this.onChoiceMade?.(choice, this._activeNode);

        // Apply choice-level effects
        if (choice.effects) {
            this.applyEffects(choice.effects);
        }

        if (choice.nextNodeId === null) {
            this.endDialogue();
            return null;
        }

        const nextNode = this._activeTree.nodes.get(choice.nextNodeId) ?? null;
        this._setActiveNode(nextNode);
        return this._activeNode;
    }

    /**
     * End the current dialogue immediately.
     */
    public endDialogue(): void {
        const tree = this._activeTree;
        this._activeNode = null;
        this._activeTree = null;

        if (tree) {
            this.onDialogueEnd?.(tree);
        }
    }

    /**
     * Whether a dialogue is currently active.
     */
    public isInDialogue(): boolean {
        return this._activeTree !== null;
    }

    // ── Variables ────────────────────────────────────────────────────────────

    /**
     * Retrieve a dialogue variable. Tree-local variables take precedence
     * over global variables.
     * @param key - Variable name.
     * @returns The stored value, or `undefined` if not set.
     */
    public getVariable(key: string): string | number | boolean | undefined {
        if (this._activeTree && key in this._activeTree.variables) {
            return this._activeTree.variables[key];
        }
        return this._globalVariables.get(key);
    }

    /**
     * Set a dialogue variable. If a tree is active the variable is set on the
     * tree scope; otherwise it is set globally.
     * @param key - Variable name.
     * @param value - Value to store.
     */
    public setVariable(key: string, value: string | number | boolean): void {
        if (this._activeTree) {
            this._activeTree.variables[key] = value;
        } else {
            this._globalVariables.set(key, value);
        }
    }

    // ── Conditions & Effects ────────────────────────────────────────────────

    /**
     * Evaluate a single condition against the current game state.
     * Custom condition types are delegated to registered handlers.
     * @param condition - The condition to evaluate.
     * @returns `true` if the condition is satisfied.
     */
    public evaluateCondition(condition: DialogueCondition): boolean {
        if (condition.type === 'custom') {
            const handler = this._conditionHandlers.get(condition.key);
            return handler ? handler(condition) : false;
        }

        const currentValue = this.getVariable(condition.key);
        return this._compare(currentValue, condition.operator, condition.value);
    }

    /**
     * Apply an array of effects to the current game state.
     * Built-in types modify variables directly; custom types are forwarded
     * to registered effect handlers.
     * @param effects - Effects to apply.
     */
    public applyEffects(effects: DialogueEffect[]): void {
        for (const effect of effects) {
            const handler = this._effectHandlers.get(effect.type);
            if (handler) {
                handler(effect);
                continue;
            }

            // Built-in handlers
            switch (effect.type) {
                case 'setVariable':
                    this.setVariable(effect.key, effect.value);
                    break;
                case 'giveItem':
                case 'removeItem':
                case 'startQuest':
                case 'addXP':
                    // Default: store as a variable so the state is tracked
                    this.setVariable(`__effect_${effect.type}_${effect.key}`, effect.value);
                    break;
                case 'custom':
                    // No-op if no handler registered
                    break;
            }
        }
    }

    // ── History ─────────────────────────────────────────────────────────────

    /**
     * Return the ordered history of dialogue lines spoken during the current
     * (or most recently ended) conversation.
     * @returns Array of `{ speaker, text }` entries.
     */
    public getDialogueHistory(): Array<{ speaker: string; text: string }> {
        return [...this._history];
    }

    // ── Extensibility ───────────────────────────────────────────────────────

    /**
     * Register a handler for a custom effect type.
     * @param type - The effect type string (e.g. `'playSound'`).
     * @param handler - Function invoked when the effect is applied.
     */
    public registerEffectHandler(type: string, handler: (effect: DialogueEffect) => void): void {
        this._effectHandlers.set(type, handler);
    }

    /**
     * Register a handler for a custom condition type.
     * @param type - The condition key to handle.
     * @param handler - Function that returns `true` when the condition passes.
     */
    public registerConditionHandler(type: string, handler: (condition: DialogueCondition) => boolean): void {
        this._conditionHandlers.set(type, handler);
    }

    // ── Serialization ───────────────────────────────────────────────────────

    /**
     * Serialize the manager state to a plain JSON-safe object.
     * Useful for save-game systems.
     * @returns A serializable snapshot of all trees, variables, and history.
     */
    public toJSON(): SerializedDialogueManager {
        const trees: SerializedDialogueManager['trees'] = [];
        for (const [, tree] of this._trees) {
            trees.push({
                id: tree.id,
                name: tree.name,
                startNodeId: tree.startNodeId,
                nodes: Array.from(tree.nodes.entries()),
                variables: { ...tree.variables },
            });
        }

        const globalVariables: Record<string, string | number | boolean> = {};
        for (const [k, v] of this._globalVariables) {
            globalVariables[k] = v;
        }

        return {
            trees,
            globalVariables,
            history: [...this._history],
            activeTreeId: this._activeTree?.id ?? null,
            activeNodeId: this._activeNode?.id ?? null,
        };
    }

    /**
     * Restore manager state from a previously serialized snapshot.
     * @param data - The data produced by {@link toJSON}.
     */
    public fromJSON(data: SerializedDialogueManager): void {
        this._trees.clear();
        this._globalVariables.clear();

        for (const entry of data.trees) {
            const tree: DialogueTree = {
                id: entry.id,
                name: entry.name,
                startNodeId: entry.startNodeId,
                nodes: new Map(entry.nodes),
                variables: { ...entry.variables },
            };
            this._trees.set(tree.id, tree);
        }

        for (const [k, v] of Object.entries(data.globalVariables)) {
            this._globalVariables.set(k, v);
        }

        this._history = [...data.history];

        // Restore active dialogue state
        if (data.activeTreeId) {
            this._activeTree = this._trees.get(data.activeTreeId) ?? null;
        } else {
            this._activeTree = null;
        }

        if (this._activeTree && data.activeNodeId) {
            this._activeNode = this._activeTree.nodes.get(data.activeNodeId) ?? null;
        } else {
            this._activeNode = null;
        }
    }

    // ── Private helpers ─────────────────────────────────────────────────────

    /**
     * Set the active node, apply its effects, and record it in history.
     */
    private _setActiveNode(node: DialogueNode | null): void {
        this._activeNode = node;

        if (node) {
            this._history.push({ speaker: node.speaker, text: node.text });

            if (node.effects) {
                this.applyEffects(node.effects);
            }

            this.onNodeChange?.(node);
        }
    }

    /**
     * Resolve a variable key to a numeric value for skill checks.
     */
    private _resolveNumericValue(key: string): number {
        const value = this.getVariable(key);
        if (typeof value === 'number') return value;
        if (typeof value === 'string') {
            const parsed = parseFloat(value);
            return isNaN(parsed) ? 0 : parsed;
        }
        return 0;
    }

    /**
     * Generic comparison used by condition evaluation.
     * Ordering operators (`>`, `<`, `>=`, `<=`) use JavaScript's native
     * comparison, which works numerically for numbers and lexicographically
     * for strings. Callers should ensure operand types are consistent.
     */
    private _compare(
        current: string | number | boolean | undefined,
        operator: DialogueCondition['operator'],
        expected: string | number | boolean
    ): boolean {
        let effective: string | number | boolean;
        if (current === undefined) {
            // Treat missing values as falsy/zero for comparison
            if (typeof expected === 'number') effective = 0;
            else if (typeof expected === 'boolean') effective = false;
            else effective = '';
        } else {
            effective = current;
        }

        switch (operator) {
            case '==': return effective === expected;
            case '!=': return effective !== expected;
            case '>':  return effective > expected;
            case '<':  return effective < expected;
            case '>=': return effective >= expected;
            case '<=': return effective <= expected;
        }
    }
}

// ── DialogueBuilder ─────────────────────────────────────────────────────────

/**
 * Fluent builder for constructing {@link DialogueTree} instances in code.
 *
 * @example
 * ```ts
 * const tree = DialogueBuilder
 *     .create('demo', 'Demo Dialogue')
 *     .addNode('start', 'NPC', 'Hello traveller!')
 *     .addChoice('start', 'Hi there!', 'reply')
 *     .addChoice('start', 'Goodbye.', null)
 *     .addNode('reply', 'NPC', 'Safe travels.')
 *     .setStartNode('start')
 *     .build();
 * ```
 */
export class DialogueBuilder {
    private _id: string;
    private _name: string;
    private _startNodeId: string = '';
    private _nodes: Map<string, DialogueNode> = new Map();
    private _variables: Record<string, string | number | boolean> = {};
    private _choiceCounter: number = 0;

    private constructor(id: string, name: string) {
        this._id = id;
        this._name = name;
    }

    /**
     * Create a new builder instance.
     * @param id - Unique tree identifier.
     * @param name - Human-readable tree name.
     */
    public static create(id: string, name: string): DialogueBuilder {
        return new DialogueBuilder(id, name);
    }

    /**
     * Add a dialogue node.
     * The first node added is automatically set as the start node.
     * @param id - Unique node identifier.
     * @param speaker - Name of the speaking character.
     * @param text - Dialogue text content.
     * @returns This builder for chaining.
     */
    public addNode(id: string, speaker: string, text: string): DialogueBuilder {
        const node: DialogueNode = { id, speaker, text, choices: [] };
        this._nodes.set(id, node);
        if (this._startNodeId === '') {
            this._startNodeId = id;
        }
        return this;
    }

    /**
     * Add a choice to an existing node.
     * @param nodeId - The node to attach the choice to.
     * @param text - Display text for the choice.
     * @param nextNodeId - Target node id, or `null` to end dialogue.
     * @returns This builder for chaining.
     */
    public addChoice(nodeId: string, text: string, nextNodeId: string | null): DialogueBuilder {
        const node = this._nodes.get(nodeId);
        if (!node) {
            throw new Error(`DialogueBuilder: node '${nodeId}' not found.`);
        }

        this._choiceCounter++;
        const choice: DialogueChoice = {
            id: `${nodeId}_choice_${this._choiceCounter}`,
            text,
            nextNodeId,
        };
        node.choices.push(choice);
        return this;
    }

    /**
     * Attach a condition to the most recently added choice on the given node.
     * @param nodeId - The node whose last choice receives the condition.
     * @param condition - The condition to attach.
     * @returns This builder for chaining.
     */
    public addCondition(nodeId: string, condition: DialogueCondition): DialogueBuilder {
        const choice = this._getLastChoice(nodeId);
        if (!choice.conditions) {
            choice.conditions = [];
        }
        choice.conditions.push(condition);
        return this;
    }

    /**
     * Attach an effect to a node (applied when the node is entered).
     * @param nodeId - Target node identifier.
     * @param effect - The effect to attach.
     * @returns This builder for chaining.
     */
    public addEffect(nodeId: string, effect: DialogueEffect): DialogueBuilder {
        const node = this._nodes.get(nodeId);
        if (!node) {
            throw new Error(`DialogueBuilder: node '${nodeId}' not found.`);
        }
        if (!node.effects) {
            node.effects = [];
        }
        node.effects.push(effect);
        return this;
    }

    /**
     * Override the starting node.
     * @param nodeId - The node id to start from.
     * @returns This builder for chaining.
     */
    public setStartNode(nodeId: string): DialogueBuilder {
        this._startNodeId = nodeId;
        return this;
    }

    /**
     * Set a tree-local variable that will be available during the dialogue.
     * @param key - Variable name.
     * @param value - Initial value.
     * @returns This builder for chaining.
     */
    public setVariable(key: string, value: string | number | boolean): DialogueBuilder {
        this._variables[key] = value;
        return this;
    }

    /**
     * Compile the builder into an immutable {@link DialogueTree}.
     * @returns A fully-constructed dialogue tree.
     */
    public build(): DialogueTree {
        if (this._nodes.size === 0) {
            throw new Error('DialogueBuilder: tree must contain at least one node.');
        }
        if (!this._nodes.has(this._startNodeId)) {
            throw new Error(`DialogueBuilder: start node '${this._startNodeId}' not found.`);
        }

        return {
            id: this._id,
            name: this._name,
            startNodeId: this._startNodeId,
            nodes: new Map(this._nodes),
            variables: { ...this._variables },
        };
    }

    // ── Private helpers ─────────────────────────────────────────────────────

    /**
     * Retrieve the last choice added to the given node.
     */
    private _getLastChoice(nodeId: string): DialogueChoice {
        const node = this._nodes.get(nodeId);
        if (!node) {
            throw new Error(`DialogueBuilder: node '${nodeId}' not found.`);
        }
        if (node.choices.length === 0) {
            throw new Error(`DialogueBuilder: node '${nodeId}' has no choices.`);
        }
        return node.choices[node.choices.length - 1];
    }
}
