/**
 * Behavior tree node status
 */
export enum NodeStatus {
    SUCCESS = 'success',
    FAILURE = 'failure',
    RUNNING = 'running'
}

/**
 * Blackboard for sharing data between nodes
 */
export type Blackboard = Map<string, any>;

/**
 * Abstract behavior tree node
 */
export abstract class BehaviorNode {
    protected children: BehaviorNode[] = [];

    /**
     * Execute the node
     */
    public abstract tick(deltaTime: number, blackboard: Blackboard): NodeStatus;

    /**
     * Add child node
     */
    public addChild(child: BehaviorNode): void {
        this.children.push(child);
    }

    /**
     * Reset node state
     */
    public reset(): void {
        for (const child of this.children) {
            child.reset();
        }
    }
}

/**
 * Sequence node - executes children until one fails
 */
export class Sequence extends BehaviorNode {
    private currentChild: number = 0;

    public tick(deltaTime: number, blackboard: Blackboard): NodeStatus {
        while (this.currentChild < this.children.length) {
            const status = this.children[this.currentChild].tick(deltaTime, blackboard);

            if (status === NodeStatus.FAILURE) {
                this.currentChild = 0;
                return NodeStatus.FAILURE;
            }

            if (status === NodeStatus.RUNNING) {
                return NodeStatus.RUNNING;
            }

            this.currentChild++;
        }

        this.currentChild = 0;
        return NodeStatus.SUCCESS;
    }

    public reset(): void {
        super.reset();
        this.currentChild = 0;
    }
}

/**
 * Selector node - executes children until one succeeds
 */
export class Selector extends BehaviorNode {
    private currentChild: number = 0;

    public tick(deltaTime: number, blackboard: Blackboard): NodeStatus {
        while (this.currentChild < this.children.length) {
            const status = this.children[this.currentChild].tick(deltaTime, blackboard);

            if (status === NodeStatus.SUCCESS) {
                this.currentChild = 0;
                return NodeStatus.SUCCESS;
            }

            if (status === NodeStatus.RUNNING) {
                return NodeStatus.RUNNING;
            }

            this.currentChild++;
        }

        this.currentChild = 0;
        return NodeStatus.FAILURE;
    }

    public reset(): void {
        super.reset();
        this.currentChild = 0;
    }
}

/**
 * Parallel node - executes all children simultaneously
 */
export class Parallel extends BehaviorNode {
    private requiredSuccesses: number;

    constructor(requiredSuccesses: number = 1) {
        super();
        this.requiredSuccesses = requiredSuccesses;
    }

    public tick(deltaTime: number, blackboard: Blackboard): NodeStatus {
        let successes = 0;
        let failures = 0;
        let running = 0;

        for (const child of this.children) {
            const status = child.tick(deltaTime, blackboard);

            if (status === NodeStatus.SUCCESS) {
                successes++;
            } else if (status === NodeStatus.FAILURE) {
                failures++;
            } else {
                running++;
            }
        }

        if (successes >= this.requiredSuccesses) {
            return NodeStatus.SUCCESS;
        }

        if (failures > this.children.length - this.requiredSuccesses) {
            return NodeStatus.FAILURE;
        }

        return NodeStatus.RUNNING;
    }
}

/**
 * Inverter decorator - inverts child status
 */
export class Inverter extends BehaviorNode {
    public tick(deltaTime: number, blackboard: Blackboard): NodeStatus {
        if (this.children.length === 0) {
            return NodeStatus.FAILURE;
        }

        const status = this.children[0].tick(deltaTime, blackboard);

        if (status === NodeStatus.SUCCESS) {
            return NodeStatus.FAILURE;
        } else if (status === NodeStatus.FAILURE) {
            return NodeStatus.SUCCESS;
        }

        return NodeStatus.RUNNING;
    }
}

/**
 * Repeater decorator - repeats child N times
 */
export class Repeater extends BehaviorNode {
    private count: number;
    private current: number = 0;

    constructor(count: number = -1) {
        super();
        this.count = count; // -1 = infinite
    }

    public tick(deltaTime: number, blackboard: Blackboard): NodeStatus {
        if (this.children.length === 0) {
            return NodeStatus.FAILURE;
        }

        const status = this.children[0].tick(deltaTime, blackboard);

        if (status === NodeStatus.RUNNING) {
            return NodeStatus.RUNNING;
        }

        this.current++;

        if (this.count !== -1 && this.current >= this.count) {
            this.current = 0;
            return NodeStatus.SUCCESS;
        }

        return NodeStatus.RUNNING;
    }

    public reset(): void {
        super.reset();
        this.current = 0;
    }
}

/**
 * Action node - executes a function
 */
export class Action extends BehaviorNode {
    private action: (deltaTime: number, blackboard: Blackboard) => NodeStatus;

    constructor(action: (deltaTime: number, blackboard: Blackboard) => NodeStatus) {
        super();
        this.action = action;
    }

    public tick(deltaTime: number, blackboard: Blackboard): NodeStatus {
        return this.action(deltaTime, blackboard);
    }
}

/**
 * Condition node - checks a boolean condition
 */
export class Condition extends BehaviorNode {
    private condition: (blackboard: Blackboard) => boolean;

    constructor(condition: (blackboard: Blackboard) => boolean) {
        super();
        this.condition = condition;
    }

    public tick(_deltaTime: number, blackboard: Blackboard): NodeStatus {
        return this.condition(blackboard) ? NodeStatus.SUCCESS : NodeStatus.FAILURE;
    }
}

/**
 * Behavior tree
 */
export class BehaviorTree {
    private root: BehaviorNode | null = null;
    private blackboard: Blackboard = new Map();

    /**
     * Set root node
     */
    public setRoot(root: BehaviorNode): void {
        this.root = root;
    }

    /**
     * Tick the tree
     */
    public tick(deltaTime: number, customBlackboard?: Blackboard): NodeStatus {
        if (!this.root) {
            return NodeStatus.FAILURE;
        }

        const bb = customBlackboard || this.blackboard;
        return this.root.tick(deltaTime, bb);
    }

    /**
     * Reset tree
     */
    public reset(): void {
        if (this.root) {
            this.root.reset();
        }
        this.blackboard.clear();
    }

    /**
     * Get blackboard
     */
    public getBlackboard(): Blackboard {
        return this.blackboard;
    }
}
