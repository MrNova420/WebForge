/**
 * WebForge Quest System
 *
 * Comprehensive quest management for AAA RPG games.
 * Supports quest chains, timed quests, repeatable quests,
 * automatic objective tracking, and full save/load serialization.
 */

// ── Enums ────────────────────────────────────────────────────────────────────

/**
 * Status of a quest instance.
 */
export enum QuestStatus {
    NotStarted = 'not_started',
    Active = 'active',
    Completed = 'completed',
    Failed = 'failed',
    Abandoned = 'abandoned'
}

/**
 * Type of objective a quest can require.
 */
export enum ObjectiveType {
    Kill = 'kill',
    Collect = 'collect',
    Talk = 'talk',
    Explore = 'explore',
    Escort = 'escort',
    Defend = 'defend',
    Craft = 'craft',
    Deliver = 'deliver',
    Interact = 'interact',
    Custom = 'custom'
}

// ── Interfaces ───────────────────────────────────────────────────────────────

/**
 * A single objective within a quest.
 */
export interface QuestObjective {
    /** Unique identifier for the objective */
    id: string;
    /** Player-visible description */
    description: string;
    /** Category of action required */
    type: ObjectiveType;
    /** Optional target entity or item id */
    targetId?: string;
    /** Number of actions required to complete */
    targetCount: number;
    /** Current progress toward targetCount */
    currentCount: number;
    /** Whether this objective has been completed */
    completed: boolean;
    /** If true, not required for quest completion */
    optional: boolean;
    /** If true, description is hidden until conditions reveal it */
    hidden: boolean;
}

/**
 * Rewards granted upon quest completion.
 */
export interface QuestReward {
    /** Experience points granted */
    experience?: number;
    /** Currency granted */
    currency?: number;
    /** Items granted with quantities */
    items?: Array<{ itemId: string; quantity: number }>;
    /** Reputation changes per faction */
    reputation?: Record<string, number>;
    /** Content or feature unlocks */
    unlocks?: string[];
    /** Arbitrary reward data for game-specific systems */
    customRewards?: Record<string, unknown>;
}

/**
 * Static definition of a quest. Registered once and used to spawn instances.
 */
export interface QuestDefinition {
    /** Unique quest identifier */
    id: string;
    /** Display name */
    name: string;
    /** Full description shown in the quest log */
    description: string;
    /** Category tag (e.g. 'main', 'side', 'daily') */
    category: string;
    /** Recommended player level */
    level: number;
    /** List of objectives that must be fulfilled */
    objectives: QuestObjective[];
    /** Rewards granted on completion */
    rewards: QuestReward;
    /** Quest IDs that must be completed before this quest is available */
    prerequisites?: string[];
    /** Time limit in seconds; 0 or undefined means no limit */
    timeLimit?: number;
    /** Whether the quest can be replayed after completion */
    repeatable: boolean;
    /** Next quest in a chain, started automatically on completion */
    chainNext?: string;
    /** NPC that gives this quest */
    giver?: string;
}

/**
 * A live instance of a quest held by a player.
 */
export interface QuestInstance {
    /** The static definition this instance is based on */
    definition: QuestDefinition;
    /** Current status */
    status: QuestStatus;
    /** Timestamp (ms) when the quest was started */
    startTime: number;
    /** Objective IDs that have been completed */
    completedObjectives: Set<string>;
    /** Objective IDs that have been failed */
    failedObjectives: Set<string>;
}

// ── Callback types ───────────────────────────────────────────────────────────

/** Invoked when a quest starts. */
export type QuestStartCallback = (instance: QuestInstance) => void;
/** Invoked when a quest completes. */
export type QuestCompleteCallback = (instance: QuestInstance, reward: QuestReward) => void;
/** Invoked when a quest fails. */
export type QuestFailCallback = (instance: QuestInstance) => void;
/** Invoked when a quest objective is updated. */
export type ObjectiveUpdateCallback = (
    instance: QuestInstance,
    objective: QuestObjective
) => void;

// ── Serialization helpers ────────────────────────────────────────────────────

interface QuestInstanceJSON {
    definitionId: string;
    status: QuestStatus;
    startTime: number;
    completedObjectives: string[];
    failedObjectives: string[];
    objectives: Array<{ id: string; currentCount: number; completed: boolean }>;
}

interface QuestManagerJSON {
    instances: QuestInstanceJSON[];
    trackedQuestId: string | null;
    completedQuestIds: string[];
}

// ── QuestManager ─────────────────────────────────────────────────────────────

/**
 * Central manager for quest lifecycle, tracking, and persistence.
 *
 * @example
 * ```ts
 * const qm = new QuestManager();
 * qm.registerQuest(myQuestDef);
 * qm.startQuest('quest_01');
 * qm.notifyEvent(ObjectiveType.Kill, 'goblin', 1);
 * ```
 */
export class QuestManager {
    private _definitions: Map<string, QuestDefinition> = new Map();
    private _instances: Map<string, QuestInstance> = new Map();
    private _completedIds: Set<string> = new Set();
    private _trackedQuestId: string | null = null;

    // Callbacks
    private _onQuestStart: QuestStartCallback[] = [];
    private _onQuestComplete: QuestCompleteCallback[] = [];
    private _onQuestFail: QuestFailCallback[] = [];
    private _onObjectiveUpdate: ObjectiveUpdateCallback[] = [];

    constructor() {}

    // ── Registration ─────────────────────────────────────────────────────

    /**
     * Register a quest definition so it can be started later.
     * @param definition - The static quest data.
     */
    public registerQuest(definition: QuestDefinition): void {
        this._definitions.set(definition.id, definition);
    }

    /**
     * Remove a quest definition and any active instance.
     * @param id - Quest identifier.
     */
    public removeQuest(id: string): void {
        this._definitions.delete(id);
        this._instances.delete(id);
    }

    // ── Lifecycle ────────────────────────────────────────────────────────

    /**
     * Start a quest if its prerequisites are met and it is not already active.
     * @param id - Quest identifier.
     * @returns `true` if the quest was successfully started.
     */
    public startQuest(id: string): boolean {
        if (!this.isQuestAvailable(id)) return false;

        const def = this._definitions.get(id)!;

        // Deep-clone objectives so each instance tracks independently
        const objectives: QuestObjective[] = def.objectives.map((o) => ({ ...o, currentCount: 0, completed: false }));

        const instance: QuestInstance = {
            definition: { ...def, objectives },
            status: QuestStatus.Active,
            startTime: Date.now(),
            completedObjectives: new Set(),
            failedObjectives: new Set()
        };

        this._instances.set(id, instance);
        this._emit(this._onQuestStart, instance);
        return true;
    }

    /**
     * Mark a quest as completed and return its rewards.
     * Only succeeds when all required objectives are done.
     * @param id - Quest identifier.
     * @returns The quest rewards, or `null` if the quest cannot be completed.
     */
    public completeQuest(id: string): QuestReward | null {
        const instance = this._instances.get(id);
        if (!instance || instance.status !== QuestStatus.Active) return null;
        if (!this.isQuestComplete(id)) return null;

        instance.status = QuestStatus.Completed;
        this._completedIds.add(id);

        const reward = instance.definition.rewards;
        this._emitComplete(instance, reward);

        // Auto-start next quest in chain
        if (instance.definition.chainNext) {
            this.startQuest(instance.definition.chainNext);
        }

        return reward;
    }

    /**
     * Mark a quest as failed.
     * @param id - Quest identifier.
     */
    public failQuest(id: string): void {
        const instance = this._instances.get(id);
        if (!instance || instance.status !== QuestStatus.Active) return;

        instance.status = QuestStatus.Failed;
        this._emit(this._onQuestFail, instance);
    }

    /**
     * Abandon an active quest, returning it to available state.
     * @param id - Quest identifier.
     */
    public abandonQuest(id: string): void {
        const instance = this._instances.get(id);
        if (!instance || instance.status !== QuestStatus.Active) return;

        instance.status = QuestStatus.Abandoned;
        this._instances.delete(id);

        if (this._trackedQuestId === id) {
            this._trackedQuestId = null;
        }
    }

    // ── Objective tracking ───────────────────────────────────────────────

    /**
     * Directly update progress on a specific objective.
     * @param questId - Quest identifier.
     * @param objectiveId - Objective identifier within the quest.
     * @param progress - Amount to add (default 1).
     */
    public updateObjective(questId: string, objectiveId: string, progress: number = 1): void {
        const instance = this._instances.get(questId);
        if (!instance || instance.status !== QuestStatus.Active) return;

        const objective = instance.definition.objectives.find((o) => o.id === objectiveId);
        if (!objective || objective.completed) return;

        objective.currentCount = Math.min(objective.currentCount + progress, objective.targetCount);

        if (objective.currentCount >= objective.targetCount) {
            objective.completed = true;
            instance.completedObjectives.add(objectiveId);
        }

        this._emitObjective(instance, objective);

        // Auto-complete if all required objectives are done
        if (this.isQuestComplete(questId)) {
            this.completeQuest(questId);
        }
    }

    /**
     * Broadcast a game event so all matching active objectives are updated.
     * @param eventType - The objective type that matches this event.
     * @param targetId - The target entity or item id.
     * @param count - Progress increment (default 1).
     */
    public notifyEvent(eventType: ObjectiveType, targetId: string, count: number = 1): void {
        for (const [questId, instance] of this._instances) {
            if (instance.status !== QuestStatus.Active) continue;

            for (const obj of instance.definition.objectives) {
                if (obj.completed) continue;
                if (obj.type !== eventType) continue;
                if (obj.targetId !== undefined && obj.targetId !== targetId) continue;

                this.updateObjective(questId, obj.id, count);
            }
        }
    }

    // ── Queries ──────────────────────────────────────────────────────────

    /**
     * Get a quest instance by id.
     * @param id - Quest identifier.
     */
    public getQuest(id: string): QuestInstance | null {
        return this._instances.get(id) ?? null;
    }

    /**
     * Get all currently active quest instances.
     */
    public getActiveQuests(): QuestInstance[] {
        return [...this._instances.values()].filter((i) => i.status === QuestStatus.Active);
    }

    /**
     * Get all completed quest instances.
     */
    public getCompletedQuests(): QuestInstance[] {
        return [...this._instances.values()].filter((i) => i.status === QuestStatus.Completed);
    }

    /**
     * Get quest definitions that the player can start (prerequisites met, not active).
     */
    public getAvailableQuests(): QuestDefinition[] {
        return [...this._definitions.values()].filter((d) => this.isQuestAvailable(d.id));
    }

    /**
     * Check whether all required objectives of a quest are satisfied.
     * @param id - Quest identifier.
     */
    public isQuestComplete(id: string): boolean {
        const instance = this._instances.get(id);
        if (!instance) return false;

        return instance.definition.objectives
            .filter((o) => !o.optional)
            .every((o) => o.completed);
    }

    /**
     * Check whether a quest can be started right now.
     * @param id - Quest identifier.
     */
    public isQuestAvailable(id: string): boolean {
        const def = this._definitions.get(id);
        if (!def) return false;

        // Already active
        if (this._instances.has(id) && this._instances.get(id)!.status === QuestStatus.Active) {
            return false;
        }

        // Already completed and not repeatable
        if (this._completedIds.has(id) && !def.repeatable) return false;

        // Check prerequisites
        if (def.prerequisites) {
            for (const preId of def.prerequisites) {
                if (!this._completedIds.has(preId)) return false;
            }
        }

        return true;
    }

    /**
     * Get overall progress of a quest as a value between 0 and 1.
     * @param id - Quest identifier.
     */
    public getQuestProgress(id: string): number {
        const instance = this._instances.get(id);
        if (!instance) return 0;

        const required = instance.definition.objectives.filter((o) => !o.optional);
        if (required.length === 0) return 1;

        const total = required.reduce((sum, o) => sum + o.targetCount, 0);
        const current = required.reduce((sum, o) => sum + Math.min(o.currentCount, o.targetCount), 0);
        return total === 0 ? 1 : current / total;
    }

    /**
     * Get progress for a single objective (0–1).
     * @param questId - Quest identifier.
     * @param objectiveId - Objective identifier.
     */
    public getObjectiveProgress(questId: string, objectiveId: string): number {
        const instance = this._instances.get(questId);
        if (!instance) return 0;

        const obj = instance.definition.objectives.find((o) => o.id === objectiveId);
        if (!obj) return 0;
        if (obj.targetCount === 0) return obj.completed ? 1 : 0;
        return Math.min(obj.currentCount / obj.targetCount, 1);
    }

    // ── Tracking ─────────────────────────────────────────────────────────

    /**
     * Get the currently tracked quest shown on the HUD.
     */
    public getTrackedQuest(): QuestInstance | null {
        if (!this._trackedQuestId) return null;
        return this._instances.get(this._trackedQuestId) ?? null;
    }

    /**
     * Set which quest is actively tracked on the HUD.
     * @param id - Quest identifier.
     */
    public setTrackedQuest(id: string): void {
        if (this._instances.has(id)) {
            this._trackedQuestId = id;
        }
    }

    // ── Callbacks ────────────────────────────────────────────────────────

    /** Register a callback for quest start events. */
    public onQuestStart(cb: QuestStartCallback): void {
        this._onQuestStart.push(cb);
    }

    /** Register a callback for quest completion events. */
    public onQuestComplete(cb: QuestCompleteCallback): void {
        this._onQuestComplete.push(cb);
    }

    /** Register a callback for quest failure events. */
    public onQuestFail(cb: QuestFailCallback): void {
        this._onQuestFail.push(cb);
    }

    /** Register a callback for objective update events. */
    public onObjectiveUpdate(cb: ObjectiveUpdateCallback): void {
        this._onObjectiveUpdate.push(cb);
    }

    // ── Counts ───────────────────────────────────────────────────────────

    /** Total number of registered quest definitions. */
    public getQuestCount(): number {
        return this._definitions.size;
    }

    /** Number of currently active quest instances. */
    public getActiveQuestCount(): number {
        return this.getActiveQuests().length;
    }

    // ── Serialization ────────────────────────────────────────────────────

    /**
     * Serialize all quest state to a plain JSON-safe object.
     */
    public toJSON(): QuestManagerJSON {
        const instances: QuestInstanceJSON[] = [];

        for (const [, inst] of this._instances) {
            instances.push({
                definitionId: inst.definition.id,
                status: inst.status,
                startTime: inst.startTime,
                completedObjectives: [...inst.completedObjectives],
                failedObjectives: [...inst.failedObjectives],
                objectives: inst.definition.objectives.map((o) => ({
                    id: o.id,
                    currentCount: o.currentCount,
                    completed: o.completed
                }))
            });
        }

        return {
            instances,
            trackedQuestId: this._trackedQuestId,
            completedQuestIds: [...this._completedIds]
        };
    }

    /**
     * Restore quest state from a previously serialized object.
     * Quest definitions must already be registered before calling this.
     * @param data - The JSON data produced by {@link toJSON}.
     */
    public fromJSON(data: QuestManagerJSON): void {
        this._instances.clear();
        this._completedIds = new Set(data.completedQuestIds);
        this._trackedQuestId = data.trackedQuestId;

        for (const saved of data.instances) {
            const def = this._definitions.get(saved.definitionId);
            if (!def) continue;

            const objectives: QuestObjective[] = def.objectives.map((o) => {
                const savedObj = saved.objectives.find((s) => s.id === o.id);
                return {
                    ...o,
                    currentCount: savedObj?.currentCount ?? 0,
                    completed: savedObj?.completed ?? false
                };
            });

            const instance: QuestInstance = {
                definition: { ...def, objectives },
                status: saved.status,
                startTime: saved.startTime,
                completedObjectives: new Set(saved.completedObjectives),
                failedObjectives: new Set(saved.failedObjectives)
            };

            this._instances.set(def.id, instance);
        }
    }

    // ── Private helpers ──────────────────────────────────────────────────

    private _emit(cbs: QuestStartCallback[] | QuestFailCallback[], instance: QuestInstance): void {
        for (const cb of cbs) cb(instance);
    }

    private _emitComplete(instance: QuestInstance, reward: QuestReward): void {
        for (const cb of this._onQuestComplete) cb(instance, reward);
    }

    private _emitObjective(instance: QuestInstance, objective: QuestObjective): void {
        for (const cb of this._onObjectiveUpdate) cb(instance, objective);
    }
}

// ── QuestChainManager ────────────────────────────────────────────────────────

/**
 * Manages ordered sequences of quests (quest chains).
 *
 * @example
 * ```ts
 * const chains = new QuestChainManager(questManager);
 * chains.registerChain(['quest_01', 'quest_02', 'quest_03']);
 * console.log(chains.getChainProgress('quest_01')); // 0..1
 * ```
 */
export class QuestChainManager {
    private _chains: Map<string, string[]> = new Map();
    private _questManager: QuestManager;

    /**
     * @param questManager - The QuestManager instance used to query quest status.
     */
    constructor(questManager: QuestManager) {
        this._questManager = questManager;
    }

    /**
     * Register an ordered chain of quest IDs.
     * The first ID in the array is used as the chain key.
     * @param questIds - Ordered list of quest identifiers forming the chain.
     */
    public registerChain(questIds: string[]): void {
        if (questIds.length === 0) return;
        this._chains.set(questIds[0], questIds);
    }

    /**
     * Get completion progress of an entire chain (0–1).
     * @param firstQuestId - The first quest ID in the chain.
     */
    public getChainProgress(firstQuestId: string): number {
        const chain = this._chains.get(firstQuestId);
        if (!chain || chain.length === 0) return 0;

        let completed = 0;
        for (const qid of chain) {
            const inst = this._questManager.getQuest(qid);
            if (inst && inst.status === QuestStatus.Completed) {
                completed++;
            }
        }
        return completed / chain.length;
    }

    /**
     * Check whether every quest in the chain is completed.
     * @param firstQuestId - The first quest ID in the chain.
     */
    public isChainComplete(firstQuestId: string): boolean {
        return this.getChainProgress(firstQuestId) === 1;
    }
}
