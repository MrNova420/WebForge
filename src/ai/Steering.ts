import { Vector3 } from '../math/Vector3';
import { AIAgent } from './AIAgent';

/**
 * Steering behaviors for AI agents
 * 
 * Implements Reynolds steering behaviors for autonomous agents.
 */
export class Steering {
    private agent: AIAgent;
    private force: Vector3;

    constructor(agent: AIAgent) {
        this.agent = agent;
        this.force = new Vector3();
    }

    /**
     * Seek towards a target position
     */
    public seek(target: Vector3): void {
        const desired = target.clone().sub(this.agent.position);
        desired.normalizeSelf().multiplyScalarSelf(this.agent.maxSpeed);

        const steer = desired.sub(this.agent.velocity);
        this.limitForce(steer);
        this.force.addSelf(steer);
    }

    /**
     * Flee from a target position
     */
    public flee(target: Vector3): void {
        const desired = this.agent.position.clone().sub(target);
        desired.normalizeSelf().multiplyScalarSelf(this.agent.maxSpeed);

        const steer = desired.sub(this.agent.velocity);
        this.limitForce(steer);
        this.force.addSelf(steer);
    }

    /**
     * Arrive at target (slow down near destination)
     */
    public arrive(target: Vector3, slowingRadius: number = 3.0): void {
        const desired = target.clone().sub(this.agent.position);
        const distance = desired.length();

        desired.normalizeSelf();

        if (distance < slowingRadius) {
            // Inside slowing area
            const speed = this.agent.maxSpeed * (distance / slowingRadius);
            desired.multiplyScalarSelf(speed);
        } else {
            desired.multiplyScalarSelf(this.agent.maxSpeed);
        }

        const steer = desired.sub(this.agent.velocity);
        this.limitForce(steer);
        this.force.addSelf(steer);
    }

    /**
     * Pursue a moving target (predict its future position)
     */
    public pursue(target: AIAgent): void {
        const toTarget = target.position.clone().sub(this.agent.position);
        const lookAhead = toTarget.length() / this.agent.maxSpeed;

        const predictedPos = target.position.clone().add(
            target.velocity.clone().multiplyScalar(lookAhead)
        );

        this.seek(predictedPos);
    }

    /**
     * Evade a moving target (predict and flee)
     */
    public evade(target: AIAgent): void {
        const toTarget = target.position.clone().sub(this.agent.position);
        const lookAhead = toTarget.length() / this.agent.maxSpeed;

        const predictedPos = target.position.clone().add(
            target.velocity.clone().multiplyScalar(lookAhead)
        );

        this.flee(predictedPos);
    }

    /**
     * Wander randomly
     */
    public wander(wanderRadius: number = 1.0, wanderDistance: number = 2.0, wanderAngle: number = 0): void {
        // Circle center ahead of agent
        const circleCenter = this.agent.velocity.clone().normalize().multiplyScalar(wanderDistance);

        // Random displacement on circle
        const displacement = new Vector3(
            Math.cos(wanderAngle),
            0,
            Math.sin(wanderAngle)
        ).multiplyScalar(wanderRadius);

        const wanderForce = circleCenter.add(displacement);
        this.force.addSelf(wanderForce);
    }

    /**
     * Avoid obstacles using ray casting
     */
    public avoidObstacles(obstacles: Vector3[], maxDistance: number): void {
        const ahead = this.agent.getAheadPosition(maxDistance);

        let mostThreatening: Vector3 | null = null;
        let minDist = Infinity;

        for (const obstacle of obstacles) {
            const dist = ahead.distanceTo(obstacle);

            if (dist < minDist) {
                minDist = dist;
                mostThreatening = obstacle;
            }
        }

        if (mostThreatening && minDist < this.agent.radius * 2) {
            const avoidance = ahead.clone().sub(mostThreatening);
            avoidance.normalizeSelf().multiplyScalarSelf(this.agent.maxForce);
            this.force.addSelf(avoidance);
        }
    }

    /**
     * Separation - avoid crowding neighbors
     */
    public separate(neighbors: AIAgent[], desiredSeparation: number): void {
        const steer = new Vector3();
        let count = 0;

        for (const other of neighbors) {
            const distance = this.agent.position.distanceTo(other.position);

            if (distance > 0 && distance < desiredSeparation) {
                const diff = this.agent.position.clone().sub(other.position);
                diff.normalizeSelf().divideScalarSelf(distance); // Weight by distance
                steer.addSelf(diff);
                count++;
            }
        }

        if (count > 0) {
            steer.divideScalarSelf(count);
            steer.normalizeSelf().multiplyScalarSelf(this.agent.maxSpeed);
            steer.subtractSelf(this.agent.velocity);
            this.limitForce(steer);
            this.force.addSelf(steer);
        }
    }

    /**
     * Alignment - steer towards average heading of neighbors
     */
    public align(neighbors: AIAgent[]): void {
        const sum = new Vector3();
        let count = 0;

        for (const other of neighbors) {
            sum.addSelf(other.velocity);
            count++;
        }

        if (count > 0) {
            sum.divideScalarSelf(count);
            sum.normalizeSelf().multiplyScalarSelf(this.agent.maxSpeed);

            const steer = sum.sub(this.agent.velocity);
            this.limitForce(steer);
            this.force.addSelf(steer);
        }
    }

    /**
     * Cohesion - steer towards average position of neighbors
     */
    public cohesion(neighbors: AIAgent[]): void {
        const sum = new Vector3();
        let count = 0;

        for (const other of neighbors) {
            sum.addSelf(other.position);
            count++;
        }

        if (count > 0) {
            sum.divideScalarSelf(count);
            this.seek(sum);
        }
    }

    /**
     * Calculate and return combined force
     */
    public calculate(): Vector3 {
        const result = this.force.clone();
        this.force.set(0, 0, 0);
        return result;
    }

    /**
     * Limit force magnitude
     */
    private limitForce(force: Vector3): void {
        if (force.length() > this.agent.maxForce) {
            force.normalizeSelf().multiplyScalarSelf(this.agent.maxForce);
        }
    }
}
