/**
 * Inverse Kinematics (IK) System
 * 
 * Solves for joint angles to reach target positions.
 * Supports multiple IK algorithms and chain types.
 */

import { Vector3 } from '../math/Vector3';
import { Quaternion } from '../math/Quaternion';
import { Matrix4 } from '../math/Matrix4';

/**
 * IK chain joint
 */
export interface IKJoint {
    position: Vector3;
    rotation: Quaternion;
    length: number;  // Distance to next joint
}

/**
 * Two-Bone IK Solver
 * 
 * Solves IK for two bones (e.g., upper arm + forearm, thigh + shin).
 * Uses analytical solution for performance.
 */
export class TwoBoneIK {
    private upperLength: number;
    private lowerLength: number;

    constructor(upperLength: number, lowerLength: number) {
        this.upperLength = upperLength;
        this.lowerLength = lowerLength;
    }

    /**
     * Solve two-bone IK
     * @param root - Root joint position
     * @param target - Target position to reach
     * @param poleTarget - Pole vector (hint direction for knee/elbow)
     * @returns Positions for root, middle, and end joints
     */
    solve(
        root: Vector3,
        target: Vector3,
        poleTarget: Vector3
    ): { root: Vector3; middle: Vector3; end: Vector3 } {
        const totalLength = this.upperLength + this.lowerLength;
        const targetDir = target.clone().subtract(root);
        const distance = targetDir.length();

        // Clamp distance to reach
        let clampedDistance = distance;
        if (distance > totalLength * 0.999) {
            // Target out of reach - extend fully
            clampedDistance = totalLength * 0.999;
        }

        if (distance < 0.001) {
            // Target at root - use default pose
            return {
                root,
                middle: root.clone().add(new Vector3(this.upperLength, 0, 0)),
                end: root.clone().add(new Vector3(this.upperLength + this.lowerLength, 0, 0))
            };
        }

        // Normalize target direction
        targetDir.normalize();

        // Calculate middle joint position using law of cosines
        const a = this.upperLength;
        const b = this.lowerLength;
        const c = clampedDistance;

        // Angle at root
        const cosA = (b * b - a * a - c * c) / (-2 * a * c);
        const angleA = Math.acos(Math.max(-1, Math.min(1, cosA)));

        // Calculate pole vector direction
        const poleDir = poleTarget.clone().subtract(root);
        poleDir.subtractSelf(targetDir.clone().multiplyScalar(poleDir.dot(targetDir)));
        poleDir.normalize();

        // Calculate middle joint position
        const upperDir = this.rotateVectorAroundAxis(targetDir, poleDir, angleA);
        const middle = root.clone().add(upperDir.multiplyScalar(a));

        // Calculate end joint position
        const lowerDir = target.clone().subtract(middle).normalize();
        const end = middle.clone().add(lowerDir.multiplyScalar(b));

        return { root, middle, end };
    }

    /**
     * Rotate vector around axis by angle
     */
    private rotateVectorAroundAxis(vector: Vector3, axis: Vector3, angle: number): Vector3 {
        const quat = Quaternion.fromAxisAngle(axis, angle);
        // Manual quaternion rotation: v' = q * v * q^-1
        const result = vector.clone();
        const ix = quat.w * result.x + quat.y * result.z - quat.z * result.y;
        const iy = quat.w * result.y + quat.z * result.x - quat.x * result.z;
        const iz = quat.w * result.z + quat.x * result.y - quat.y * result.x;
        const iw = -quat.x * result.x - quat.y * result.y - quat.z * result.z;
        
        result.x = ix * quat.w + iw * -quat.x + iy * -quat.z - iz * -quat.y;
        result.y = iy * quat.w + iw * -quat.y + iz * -quat.x - ix * -quat.z;
        result.z = iz * quat.w + iw * -quat.z + ix * -quat.y - iy * -quat.x;
        
        return result;
    }

    /**
     * Get upper bone length
     */
    getUpperLength(): number {
        return this.upperLength;
    }

    /**
     * Get lower bone length
     */
    getLowerLength(): number {
        return this.lowerLength;
    }
}

/**
 * FABRIK (Forward And Backward Reaching Inverse Kinematics) Solver
 * 
 * Iterative IK solver for chains of any length.
 * More flexible than two-bone IK but slightly more expensive.
 */
export class FABRIKSolver {
    private joints: Vector3[];
    private lengths: number[];
    private totalLength: number;
    private maxIterations: number;
    private tolerance: number;

    constructor(jointPositions: Vector3[], maxIterations: number = 10, tolerance: number = 0.01) {
        this.joints = jointPositions.map(j => j.clone());
        this.lengths = [];
        this.totalLength = 0;
        this.maxIterations = maxIterations;
        this.tolerance = tolerance;

        // Calculate bone lengths
        for (let i = 0; i < this.joints.length - 1; i++) {
            const length = this.joints[i].distanceTo(this.joints[i + 1]);
            this.lengths.push(length);
            this.totalLength += length;
        }
    }

    /**
     * Solve FABRIK IK
     * @param target - Target position for end effector
     * @param root - Fixed root position
     * @returns Solved joint positions
     */
    solve(target: Vector3, root: Vector3): Vector3[] {
        const n = this.joints.length;
        
        // Check if target is reachable
        const distance = root.distanceTo(target);
        if (distance > this.totalLength) {
            // Target unreachable - extend fully toward target
            const direction = target.clone().subtract(root).normalize();
            this.joints[0] = root.clone();
            
            for (let i = 1; i < n; i++) {
                this.joints[i] = this.joints[i - 1].clone().add(
                    direction.clone().multiplyScalar(this.lengths[i - 1])
                );
            }
            
            return this.joints;
        }

        // Iterative solving
        for (let iteration = 0; iteration < this.maxIterations; iteration++) {
            // Forward reaching (from end to root)
            this.joints[n - 1] = target.clone();
            
            for (let i = n - 2; i >= 0; i--) {
                const direction = this.joints[i].clone().subtract(this.joints[i + 1]);
                direction.normalize();
                this.joints[i] = this.joints[i + 1].clone().add(
                    direction.multiplyScalar(this.lengths[i])
                );
            }

            // Backward reaching (from root to end)
            this.joints[0] = root.clone();
            
            for (let i = 0; i < n - 1; i++) {
                const direction = this.joints[i + 1].clone().subtract(this.joints[i]);
                direction.normalize();
                this.joints[i + 1] = this.joints[i].clone().add(
                    direction.multiplyScalar(this.lengths[i])
                );
            }

            // Check convergence
            const endDistance = this.joints[n - 1].distanceTo(target);
            if (endDistance < this.tolerance) {
                break;
            }
        }

        return this.joints;
    }

    /**
     * Get joint positions
     */
    getJoints(): Vector3[] {
        return this.joints;
    }

    /**
     * Get total chain length
     */
    getTotalLength(): number {
        return this.totalLength;
    }
}

/**
 * CCD (Cyclic Coordinate Descent) IK Solver
 * 
 * Iterative solver that rotates each joint to bring end effector closer to target.
 * Good for long chains and constraints.
 */
export class CCDSolver {
    private joints: Vector3[];
    private maxIterations: number;
    private tolerance: number;

    constructor(jointPositions: Vector3[], maxIterations: number = 10, tolerance: number = 0.01) {
        this.joints = jointPositions.map(j => j.clone());
        this.maxIterations = maxIterations;
        this.tolerance = tolerance;
    }

    /**
     * Solve CCD IK
     * @param target - Target position for end effector
     * @param constraints - Optional angle constraints per joint (radians)
     * @returns Solved joint positions
     */
    solve(target: Vector3, constraints?: number[]): Vector3[] {
        const n = this.joints.length;
        const endEffector = this.joints[n - 1];

        for (let iteration = 0; iteration < this.maxIterations; iteration++) {
            // Check if close enough
            if (endEffector.distanceTo(target) < this.tolerance) {
                break;
            }

            // Iterate from second-to-last joint to root
            for (let i = n - 2; i >= 0; i--) {
                const current = this.joints[i];
                const toEnd = endEffector.clone().subtract(current);
                const toTarget = target.clone().subtract(current);

                // Calculate rotation axis and angle
                const axis = toEnd.clone().cross(toTarget).normalize();
                let angle = Math.acos(Math.max(-1, Math.min(1, toEnd.normalize().dot(toTarget.normalize()))));

                // Apply constraints if provided
                if (constraints && constraints[i] !== undefined) {
                    angle = Math.min(angle, constraints[i]);
                }

                // Check for valid rotation
                if (axis.lengthSquared() < 0.001 || angle < 0.001) {
                    continue;
                }

                // Rotate all joints from current to end
                const quat = Quaternion.fromAxisAngle(axis, angle);
                for (let j = i + 1; j < n; j++) {
                    const relative = this.joints[j].clone().subtract(current);
                    // Manual quaternion rotation
                    const rx = relative.x, ry = relative.y, rz = relative.z;
                    const ix = quat.w * rx + quat.y * rz - quat.z * ry;
                    const iy = quat.w * ry + quat.z * rx - quat.x * rz;
                    const iz = quat.w * rz + quat.x * ry - quat.y * rx;
                    const iw = -quat.x * rx - quat.y * ry - quat.z * rz;
                    
                    relative.x = ix * quat.w + iw * -quat.x + iy * -quat.z - iz * -quat.y;
                    relative.y = iy * quat.w + iw * -quat.y + iz * -quat.x - ix * -quat.z;
                    relative.z = iz * quat.w + iw * -quat.z + ix * -quat.y - iy * -quat.x;
                    
                    this.joints[j] = current.clone().add(relative);
                }
            }
        }

        return this.joints;
    }

    /**
     * Get joint positions
     */
    getJoints(): Vector3[] {
        return this.joints;
    }
}

/**
 * Look-At IK
 * 
 * Simple IK for making objects look at targets (head tracking, eyes, etc.).
 */
export class LookAtIK {
    /**
     * Calculate rotation to look at target
     * @param position - Current position
     * @param target - Target to look at
     * @param up - Up vector (default: Y-up)
     * @returns Rotation quaternion
     */
    static solve(position: Vector3, target: Vector3, up: Vector3 = new Vector3(0, 1, 0)): Quaternion {
        const direction = target.clone().subtract(position).normalize();
        const right = up.clone().cross(direction).normalize();
        const actualUp = direction.clone().cross(right).normalize();

        // Build rotation matrix
        const matrix = new Matrix4();
        matrix.set(
            right.x, actualUp.x, -direction.x, 0,
            right.y, actualUp.y, -direction.y, 0,
            right.z, actualUp.z, -direction.z, 0,
            0, 0, 0, 1
        );

        // Convert matrix to quaternion manually
        const trace = matrix.elements[0] + matrix.elements[5] + matrix.elements[10];
        let quat: Quaternion;
        
        if (trace > 0) {
            const s = 0.5 / Math.sqrt(trace + 1.0);
            quat = new Quaternion(
                0.25 / s,
                (matrix.elements[6] - matrix.elements[9]) * s,
                (matrix.elements[8] - matrix.elements[2]) * s,
                (matrix.elements[1] - matrix.elements[4]) * s
            );
        } else if (matrix.elements[0] > matrix.elements[5] && matrix.elements[0] > matrix.elements[10]) {
            const s = 2.0 * Math.sqrt(1.0 + matrix.elements[0] - matrix.elements[5] - matrix.elements[10]);
            quat = new Quaternion(
                (matrix.elements[6] - matrix.elements[9]) / s,
                0.25 * s,
                (matrix.elements[4] + matrix.elements[1]) / s,
                (matrix.elements[8] + matrix.elements[2]) / s
            );
        } else if (matrix.elements[5] > matrix.elements[10]) {
            const s = 2.0 * Math.sqrt(1.0 + matrix.elements[5] - matrix.elements[0] - matrix.elements[10]);
            quat = new Quaternion(
                (matrix.elements[8] - matrix.elements[2]) / s,
                (matrix.elements[4] + matrix.elements[1]) / s,
                0.25 * s,
                (matrix.elements[9] + matrix.elements[6]) / s
            );
        } else {
            const s = 2.0 * Math.sqrt(1.0 + matrix.elements[10] - matrix.elements[0] - matrix.elements[5]);
            quat = new Quaternion(
                (matrix.elements[1] - matrix.elements[4]) / s,
                (matrix.elements[8] + matrix.elements[2]) / s,
                (matrix.elements[9] + matrix.elements[6]) / s,
                0.25 * s
            );
        }
        
        return quat;
    }

    /**
     * Calculate rotation with constraints
     * @param position - Current position
     * @param target - Target to look at
     * @param maxAngle - Maximum rotation angle (radians)
     * @param forward - Forward direction
     * @param up - Up vector
     * @returns Constrained rotation quaternion
     */
    static solveConstrained(
        position: Vector3,
        target: Vector3,
        maxAngle: number,
        forward: Vector3 = new Vector3(0, 0, -1),
        up: Vector3 = new Vector3(0, 1, 0)
    ): Quaternion {
        const desiredRotation = this.solve(position, target, up);
        
        // Calculate angle from forward direction
        const direction = target.clone().subtract(position).normalize();
        const angle = Math.acos(Math.max(-1, Math.min(1, forward.dot(direction))));

        if (angle > maxAngle) {
            // Clamp to max angle
            const axis = forward.clone().cross(direction).normalize();
            return Quaternion.fromAxisAngle(axis, maxAngle);
        }

        return desiredRotation;
    }
}

/**
 * IK Chain
 * 
 * Represents a chain of joints with IK solving.
 */
export class IKChain {
    private joints: IKJoint[];
    private solver: FABRIKSolver | CCDSolver;
    private useFABRIK: boolean;

    constructor(joints: IKJoint[], useFABRIK: boolean = true) {
        this.joints = joints;
        this.useFABRIK = useFABRIK;

        const positions = joints.map(j => j.position.clone());
        if (useFABRIK) {
            this.solver = new FABRIKSolver(positions);
        } else {
            this.solver = new CCDSolver(positions);
        }
    }

    /**
     * Solve IK for the chain
     * @param target - Target position
     * @param root - Root position (optional, uses first joint if not provided)
     */
    solve(target: Vector3, root?: Vector3): void {
        const rootPos = root || this.joints[0].position;
        
        if (this.useFABRIK) {
            const solved = (this.solver as FABRIKSolver).solve(target, rootPos);
            this.updateJointPositions(solved);
        } else {
            const solved = (this.solver as CCDSolver).solve(target);
            this.updateJointPositions(solved);
        }
    }

    /**
     * Update joint positions from solver
     */
    private updateJointPositions(positions: Vector3[]): void {
        for (let i = 0; i < Math.min(positions.length, this.joints.length); i++) {
            this.joints[i].position.copy(positions[i]);
            
            // Calculate rotation from bone direction
            if (i < this.joints.length - 1) {
                const direction = this.joints[i + 1].position.clone()
                    .subtract(this.joints[i].position)
                    .normalize();
                
                // Create rotation to point along direction
                const forward = new Vector3(0, 1, 0);  // Assume bones point up by default
                const axis = forward.clone().cross(direction);
                const angle = Math.acos(Math.max(-1, Math.min(1, forward.dot(direction))));
                
                if (axis.lengthSquared() > 0.001) {
                    axis.normalize();
                    this.joints[i].rotation = Quaternion.fromAxisAngle(axis, angle);
                }
            }
        }
    }

    /**
     * Get joints
     */
    getJoints(): IKJoint[] {
        return this.joints;
    }

    /**
     * Get solver type
     */
    getSolverType(): string {
        return this.useFABRIK ? 'FABRIK' : 'CCD';
    }
}

/**
 * IK Manager
 * 
 * Manages multiple IK chains and solvers.
 */
export class IKManager {
    private chains: Map<string, IKChain>;
    private twoBoneIKs: Map<string, TwoBoneIK>;

    constructor() {
        this.chains = new Map();
        this.twoBoneIKs = new Map();
    }

    /**
     * Add an IK chain
     */
    addChain(name: string, chain: IKChain): void {
        this.chains.set(name, chain);
    }

    /**
     * Add a two-bone IK
     */
    addTwoBoneIK(name: string, ik: TwoBoneIK): void {
        this.twoBoneIKs.set(name, ik);
    }

    /**
     * Get IK chain
     */
    getChain(name: string): IKChain | undefined {
        return this.chains.get(name);
    }

    /**
     * Get two-bone IK
     */
    getTwoBoneIK(name: string): TwoBoneIK | undefined {
        return this.twoBoneIKs.get(name);
    }

    /**
     * Remove IK chain
     */
    removeChain(name: string): void {
        this.chains.delete(name);
    }

    /**
     * Remove two-bone IK
     */
    removeTwoBoneIK(name: string): void {
        this.twoBoneIKs.delete(name);
    }

    /**
     * Clear all IK solvers
     */
    clear(): void {
        this.chains.clear();
        this.twoBoneIKs.clear();
    }
}
