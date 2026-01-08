import { Vector3 } from '../math/Vector3';

/**
 * AI agent state
 */
export enum AgentState {
    IDLE = 'idle',
    MOVING = 'moving',
    PURSUING = 'pursuing',
    FLEEING = 'fleeing'
}

/**
 * AI agent with steering behaviors and pathfinding
 * 
 * Represents an autonomous agent that can navigate,
 * avoid obstacles, and exhibit steering behaviors.
 */
export class AIAgent {
    public position: Vector3;
    public velocity: Vector3;
    public acceleration: Vector3;
    public maxSpeed: number;
    public maxForce: number;
    public mass: number;
    public radius: number;
    public state: AgentState;
    public target: Vector3 | null;
    public path: Vector3[];
    public currentWaypoint: number;
    public arrivalRadius: number;
    public lookAheadDistance: number;

    /**
     * Create a new AI agent
     */
    constructor(position: Vector3, maxSpeed: number = 5.0, maxForce: number = 10.0) {
        this.position = position.clone();
        this.velocity = new Vector3();
        this.acceleration = new Vector3();
        this.maxSpeed = maxSpeed;
        this.maxForce = maxForce;
        this.mass = 1.0;
        this.radius = 0.5;
        this.state = AgentState.IDLE;
        this.target = null;
        this.path = [];
        this.currentWaypoint = 0;
        this.arrivalRadius = 1.0;
        this.lookAheadDistance = 2.0;
    }

    /**
     * Apply a steering force
     */
    public applyForce(force: Vector3): void {
        // F = ma, a = F/m
        const f = force.clone().divideScalar(this.mass);
        this.acceleration.add(f);
    }

    /**
     * Update agent physics
     */
    public update(deltaTime: number): void {
        // Update velocity
        this.velocity.add(this.acceleration.clone().multiplyScalar(deltaTime));

        // Limit speed
        const speed = this.velocity.length();
        if (speed > this.maxSpeed) {
            this.velocity.normalize().multiplyScalar(this.maxSpeed);
        }

        // Update position
        this.position.add(this.velocity.clone().multiplyScalar(deltaTime));

        // Reset acceleration
        this.acceleration.set(0, 0, 0);

        // Follow path if set
        if (this.path.length > 0) {
            this.followPath();
        }
    }

    /**
     * Set path to follow
     */
    public setPath(path: Vector3[]): void {
        this.path = path;
        this.currentWaypoint = 0;
        this.state = AgentState.MOVING;
    }

    /**
     * Follow current path
     */
    private followPath(): void {
        if (this.currentWaypoint >= this.path.length) {
            this.path = [];
            this.state = AgentState.IDLE;
            return;
        }

        const waypoint = this.path[this.currentWaypoint];
        const distance = this.position.distanceTo(waypoint);

        // Check if reached current waypoint
        if (distance < this.arrivalRadius) {
            this.currentWaypoint++;
            return;
        }

        // Seek towards waypoint
        const desired = waypoint.clone().sub(this.position).normalize().multiplyScalar(this.maxSpeed);
        const steer = desired.sub(this.velocity);

        // Limit force
        if (steer.length() > this.maxForce) {
            steer.normalize().multiplyScalar(this.maxForce);
        }

        this.applyForce(steer);
    }

    /**
     * Set target to pursue
     */
    public setTarget(target: Vector3): void {
        this.target = target.clone();
        this.state = AgentState.PURSUING;
    }

    /**
     * Clear target
     */
    public clearTarget(): void {
        this.target = null;
        this.state = AgentState.IDLE;
    }

    /**
     * Check if agent has arrived at target
     */
    public hasArrived(): boolean {
        if (!this.target) {
            return false;
        }

        return this.position.distanceTo(this.target) < this.arrivalRadius;
    }

    /**
     * Get direction agent is facing (normalized velocity)
     */
    public getForward(): Vector3 {
        if (this.velocity.lengthSq() < 0.001) {
            return new Vector3(0, 0, 1);
        }

        return this.velocity.clone().normalize();
    }

    /**
     * Get position ahead of agent
     */
    public getAheadPosition(distance: number): Vector3 {
        return this.position.clone().add(
            this.getForward().multiplyScalar(distance)
        );
    }

    /**
     * Check if can see target (simple line-of-sight)
     */
    public canSee(target: Vector3, maxDistance: number): boolean {
        const distance = this.position.distanceTo(target);
        return distance <= maxDistance;
    }

    /**
     * Get neighbors within radius
     */
    public getNeighbors(agents: AIAgent[], radius: number): AIAgent[] {
        const neighbors: AIAgent[] = [];

        for (const agent of agents) {
            if (agent === this) {
                continue;
            }

            const distance = this.position.distanceTo(agent.position);
            if (distance < radius) {
                neighbors.push(agent);
            }
        }

        return neighbors;
    }

    /**
     * Stop agent
     */
    public stop(): void {
        this.velocity.set(0, 0, 0);
        this.acceleration.set(0, 0, 0);
        this.state = AgentState.IDLE;
    }

    /**
     * Clone agent
     */
    public clone(): AIAgent {
        const agent = new AIAgent(this.position, this.maxSpeed, this.maxForce);
        agent.velocity.copy(this.velocity);
        agent.mass = this.mass;
        agent.radius = this.radius;
        agent.state = this.state;
        agent.arrivalRadius = this.arrivalRadius;
        agent.lookAheadDistance = this.lookAheadDistance;
        return agent;
    }
}
