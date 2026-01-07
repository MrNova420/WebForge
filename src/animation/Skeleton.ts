/**
 * @module animation
 * @fileoverview Skeletal animation system with bones and skinning
 */

import { Vector3 } from '../math/Vector3';
import { Quaternion } from '../math/Quaternion';
import { Matrix4 } from '../math/Matrix4';

/**
 * Bone in a skeleton
 */
export class Bone {
  /** Bone name */
  name: string;
  
  /** Parent bone */
  parent: Bone | null;
  
  /** Child bones */
  children: Bone[];
  
  /** Local position */
  position: Vector3;
  
  /** Local rotation */
  rotation: Quaternion;
  
  /** Local scale */
  scale: Vector3;
  
  /** Bind pose matrix (inverse) */
  inverseBindMatrix: Matrix4;
  
  /** World matrix */
  worldMatrix: Matrix4;

  constructor(name: string, parent: Bone | null = null) {
    this.name = name;
    this.parent = parent;
    this.children = [];
    this.position = new Vector3();
    this.rotation = new Quaternion();
    this.scale = new Vector3(1, 1, 1);
    this.inverseBindMatrix = new Matrix4();
    this.worldMatrix = new Matrix4();

    if (parent) {
      parent.children.push(this);
    }
  }

  /**
   * Updates world matrix
   */
  updateWorldMatrix(): void {
    // Create local matrix
    const localMatrix = Matrix4.translation(this.position);
    localMatrix.multiply(this.rotation.toMatrix4());
    localMatrix.multiply(Matrix4.scaling(this.scale));

    // Compute world matrix
    if (this.parent) {
      this.worldMatrix = this.parent.worldMatrix.clone().multiply(localMatrix);
    } else {
      this.worldMatrix = localMatrix;
    }

    // Update children
    for (const child of this.children) {
      child.updateWorldMatrix();
    }
  }

  /**
   * Gets the final bone matrix (world * inverse bind)
   * @returns Final bone matrix
   */
  getFinalMatrix(): Matrix4 {
    return this.worldMatrix.clone().multiply(this.inverseBindMatrix);
  }
}

/**
 * Skeleton
 */
export class Skeleton {
  /** Root bones */
  roots: Bone[];
  
  /** All bones (flat list) */
  bones: Bone[];
  
  /** Bone name to bone map */
  boneMap: Map<string, Bone>;

  constructor() {
    this.roots = [];
    this.bones = [];
    this.boneMap = new Map();
  }

  /**
   * Adds a bone
   * @param bone - Bone to add
   */
  addBone(bone: Bone): void {
    this.bones.push(bone);
    this.boneMap.set(bone.name, bone);

    if (!bone.parent) {
      this.roots.push(bone);
    }
  }

  /**
   * Gets a bone by name
   * @param name - Bone name
   * @returns Bone or undefined
   */
  getBone(name: string): Bone | undefined {
    return this.boneMap.get(name);
  }

  /**
   * Updates all bone matrices
   */
  update(): void {
    for (const root of this.roots) {
      root.updateWorldMatrix();
    }
  }

  /**
   * Gets bone matrices for skinning
   * @returns Array of bone matrices
   */
  getBoneMatrices(): Matrix4[] {
    return this.bones.map(bone => bone.getFinalMatrix());
  }

  /**
   * Gets bone count
   * @returns Number of bones
   */
  getBoneCount(): number {
    return this.bones.length;
  }

  /**
   * Sets bone transform
   * @param name - Bone name
   * @param position - Position
   * @param rotation - Rotation
   * @param scale - Scale
   */
  setBoneTransform(
    name: string,
    position?: Vector3,
    rotation?: Quaternion,
    scale?: Vector3
  ): void {
    const bone = this.getBone(name);
    if (!bone) return;

    if (position) bone.position.copy(position);
    if (rotation) bone.rotation.copy(rotation);
    if (scale) bone.scale.copy(scale);
  }

  /**
   * Creates a simple skeleton for testing
   * @returns Test skeleton
   */
  static createTestSkeleton(): Skeleton {
    const skeleton = new Skeleton();

    // Create bones
    const root = new Bone('Root');
    const spine = new Bone('Spine', root);
    const chest = new Bone('Chest', spine);
    const neck = new Bone('Neck', chest);
    const head = new Bone('Head', neck);
    
    const leftShoulder = new Bone('LeftShoulder', chest);
    const leftArm = new Bone('LeftArm', leftShoulder);
    const leftForearm = new Bone('LeftForearm', leftArm);
    const leftHand = new Bone('LeftHand', leftForearm);
    
    const rightShoulder = new Bone('RightShoulder', chest);
    const rightArm = new Bone('RightArm', rightShoulder);
    const rightForearm = new Bone('RightForearm', rightArm);
    const rightHand = new Bone('RightHand', rightForearm);

    // Add all bones
    skeleton.addBone(root);
    skeleton.addBone(spine);
    skeleton.addBone(chest);
    skeleton.addBone(neck);
    skeleton.addBone(head);
    skeleton.addBone(leftShoulder);
    skeleton.addBone(leftArm);
    skeleton.addBone(leftForearm);
    skeleton.addBone(leftHand);
    skeleton.addBone(rightShoulder);
    skeleton.addBone(rightArm);
    skeleton.addBone(rightForearm);
    skeleton.addBone(rightHand);

    // Set bind pose
    spine.position.set(0, 1, 0);
    chest.position.set(0, 0.5, 0);
    neck.position.set(0, 0.3, 0);
    head.position.set(0, 0.2, 0);
    
    leftShoulder.position.set(0.3, 0, 0);
    leftArm.position.set(0.3, 0, 0);
    leftForearm.position.set(0.3, 0, 0);
    leftHand.position.set(0.2, 0, 0);
    
    rightShoulder.position.set(-0.3, 0, 0);
    rightArm.position.set(-0.3, 0, 0);
    rightForearm.position.set(-0.3, 0, 0);
    rightHand.position.set(-0.2, 0, 0);

    skeleton.update();

    // Store inverse bind matrices
    for (const bone of skeleton.bones) {
      bone.inverseBindMatrix = bone.worldMatrix.clone().invert();
    }

    return skeleton;
  }
}

/**
 * Skinned mesh attachment to skeleton
 */
export class SkinnedMesh {
  /** Reference to skeleton */
  skeleton: Skeleton;
  
  /** Bone indices per vertex (up to 4 bones) */
  boneIndices: number[][];
  
  /** Bone weights per vertex (up to 4 weights) */
  boneWeights: number[][];

  constructor(skeleton: Skeleton) {
    this.skeleton = skeleton;
    this.boneIndices = [];
    this.boneWeights = [];
  }

  /**
   * Sets bone influences for a vertex
   * @param vertexIndex - Vertex index
   * @param bones - Bone indices (up to 4)
   * @param weights - Bone weights (up to 4, should sum to 1.0)
   */
  setVertexInfluences(vertexIndex: number, bones: number[], weights: number[]): void {
    // Normalize weights
    const sum = weights.reduce((a, b) => a + b, 0);
    const normalized = weights.map(w => w / sum);

    // Pad to 4 elements
    while (bones.length < 4) {
      bones.push(0);
      normalized.push(0);
    }

    this.boneIndices[vertexIndex] = bones.slice(0, 4);
    this.boneWeights[vertexIndex] = normalized.slice(0, 4);
  }

  /**
   * Gets vertex influences
   * @param vertexIndex - Vertex index
   * @returns Bone indices and weights
   */
  getVertexInfluences(vertexIndex: number): { bones: number[]; weights: number[] } {
    return {
      bones: this.boneIndices[vertexIndex] || [0, 0, 0, 0],
      weights: this.boneWeights[vertexIndex] || [1, 0, 0, 0]
    };
  }

  /**
   * Updates skeleton
   */
  update(): void {
    this.skeleton.update();
  }

  /**
   * Gets bone matrices for shader
   * @returns Flat array of matrix elements
   */
  getBoneMatricesArray(): Float32Array {
    const matrices = this.skeleton.getBoneMatrices();
    const data = new Float32Array(matrices.length * 16);
    
    for (let i = 0; i < matrices.length; i++) {
      const elements = matrices[i].elements;
      data.set(elements, i * 16);
    }
    
    return data;
  }
}
