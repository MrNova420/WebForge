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
        desired.normalize().multiplyScalar(this.agent.maxSpeed);

        const steer = desired.sub(this.agent.velocity);
        this.limitForce(steer);
        this.force.add(steer);
    }

    /**
     * Flee from a target position
     */
    public flee(target: Vector3): void {
        const desired = this.agent.position.clone().sub(target);
        desired.normalize().multiplyScalar(this.agent.maxSpeed);

        const steer = desired.sub(this.agent.velocity);
        this.limitForce(steer);
        this.force.add(steer);
    }

    /**
     * Arrive at target (slow down near destination)
     */
    public arrive(target: Vector3, slowingRadius: number = 3.0): void {
        const desired = target.clone().sub(this.agent.position);
        const distance = desired.length();

        desired.normalize();

        if (distance < slowingRadius) {
            // Inside slowing area
            const speed = this.agent.maxSpeed * (distance / slowingRadius);
            desired.multiplyScalar(speed);
        } else {
            desired.multiplyScalar(this.agent.maxSpeed);
        }

        const steer = desired.sub(this.agent.velocity);
        this.limitForce(steer);
        this.force.add(steer);
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
        this.force.add(wanderForce);
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
            avoidance.normalize().multiplyScalar(this.agent.maxForce);
            this.force.add(avoidance);
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
                diff.normalize().divideScalar(distance); // Weight by distance
                steer.add(diff);
                count++;
            }
        }

        if (count > 0) {
            steer.divideScalar(count);
            steer.normalize().multiplyScalar(this.agent.maxSpeed);
            steer.sub(this.agent.velocity);
            this.limitForce(steer);
            this.force.add(steer);
        }
    }

    /**
     * Alignment - steer towards average heading of neighbors
     */
    public align(neighbors: AIAgent[]): void {
        const sum = new Vector3();
        let count = 0;

        for (const other of neighbors) {
            sum.add(other.velocity);
            count++;
        }

        if (count > 0) {
            sum.divideScalar(count);
            sum.normalize().multiplyScalar(this.agent.maxSpeed);

            const steer = sum.sub(this.agent.velocity);
            this.limitForce(steer);
            this.force.add(steer);
        }
    }

    /**
     * Cohesion - steer towards average position of neighbors
     */
    public cohesion(neighbors: AIAgent[]): void {
        const sum = new Vector3();
        let count = 0;

        for (const other of neighbors) {
            sum.add(other.position);
            count++;
        }

        if (count > 0) {
            sum.divideScalar(count);
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
            force.normalize().multiplyScalar(this.agent.maxForce);
        }
    }
}
