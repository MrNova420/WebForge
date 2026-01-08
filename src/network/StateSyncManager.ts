import { NetworkManager, NetworkMessage, MessageType } from './NetworkManager';
import { Vector3 } from '../math/Vector3';
import { Quaternion } from '../math/Quaternion';

/**
 * Transform snapshot for networking
 */
export interface TransformSnapshot {
    entityId: string;
    position: [number, number, number];
    rotation: [number, number, number, number];
    timestamp: number;
}

/**
 * State synchronization manager
 * 
 * Handles entity state sync over network with interpolation.
 */
export class StateSyncManager {
    private network: NetworkManager;
    private entityStates: Map<string, TransformSnapshot[]> = new Map();
    private interpolationDelay: number = 100; // ms
    private maxSnapshots: number = 10;
    private updateRate: number = 20; // updates per second
    private lastUpdateTime: number = 0;

    constructor(network: NetworkManager) {
        this.network = network;

        // Listen for transform updates
        this.network.on(MessageType.TRANSFORM_UPDATE, (message) => {
            this.handleTransformUpdate(message);
        });
    }

    /**
     * Sync entity transform
     */
    public syncTransform(entityId: string, position: Vector3, rotation: Quaternion): void {
        const now = Date.now();

        // Rate limiting
        if (now - this.lastUpdateTime < 1000 / this.updateRate) {
            return;
        }

        this.lastUpdateTime = now;

        const snapshot: TransformSnapshot = {
            entityId,
            position: [position.x, position.y, position.z],
            rotation: [rotation.x, rotation.y, rotation.z, rotation.w],
            timestamp: now
        };

        const message = this.network['createMessage'](
            MessageType.TRANSFORM_UPDATE,
            snapshot,
            false // Not reliable for performance
        );

        this.network.broadcast(message);
    }

    /**
     * Handle incoming transform update
     */
    private handleTransformUpdate(message: NetworkMessage): void {
        const snapshot: TransformSnapshot = message.data;

        if (!this.entityStates.has(snapshot.entityId)) {
            this.entityStates.set(snapshot.entityId, []);
        }

        const snapshots = this.entityStates.get(snapshot.entityId)!;
        snapshots.push(snapshot);

        // Keep only recent snapshots
        if (snapshots.length > this.maxSnapshots) {
            snapshots.shift();
        }

        // Sort by timestamp
        snapshots.sort((a, b) => a.timestamp - b.timestamp);
    }

    /**
     * Get interpolated transform for entity
     */
    public getInterpolatedTransform(entityId: string): { position: Vector3; rotation: Quaternion } | null {
        const snapshots = this.entityStates.get(entityId);

        if (!snapshots || snapshots.length < 2) {
            return null;
        }

        const now = Date.now();
        const renderTime = now - this.interpolationDelay;

        // Find two snapshots to interpolate between
        let from: TransformSnapshot | null = null;
        let to: TransformSnapshot | null = null;

        for (let i = 0; i < snapshots.length - 1; i++) {
            if (snapshots[i].timestamp <= renderTime && snapshots[i + 1].timestamp >= renderTime) {
                from = snapshots[i];
                to = snapshots[i + 1];
                break;
            }
        }

        if (!from || !to) {
            // Use latest snapshot if no interpolation possible
            const latest = snapshots[snapshots.length - 1];
            return {
                position: new Vector3(...latest.position),
                rotation: new Quaternion(...latest.rotation)
            };
        }

        // Interpolation factor
        const t = (renderTime - from.timestamp) / (to.timestamp - from.timestamp);

        // Interpolate position (linear)
        const position = new Vector3(
            from.position[0] + (to.position[0] - from.position[0]) * t,
            from.position[1] + (to.position[1] - from.position[1]) * t,
            from.position[2] + (to.position[2] - from.position[2]) * t
        );

        // Interpolate rotation (slerp)
        const fromRot = new Quaternion(...from.rotation);
        const toRot = new Quaternion(...to.rotation);
        const rotation = fromRot.slerp(toRot, t);

        return { position, rotation };
    }

    /**
     * Clear entity states
     */
    public clearEntity(entityId: string): void {
        this.entityStates.delete(entityId);
    }

    /**
     * Clear all states
     */
    public clearAll(): void {
        this.entityStates.clear();
    }

    /**
     * Set interpolation delay
     */
    public setInterpolationDelay(delay: number): void {
        this.interpolationDelay = delay;
    }

    /**
     * Set update rate
     */
    public setUpdateRate(rate: number): void {
        this.updateRate = rate;
    }
}
