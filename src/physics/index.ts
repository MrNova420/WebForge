/**
 * @module physics
 * @fileoverview WebForge Physics - Physics simulation system
 */

export { PhysicsWorld } from './PhysicsWorld';
export type { PhysicsWorldConfig, RaycastResult } from './PhysicsWorld';

export { RigidBody, RigidBodyType } from './RigidBody';
export type { RigidBodyConfig } from './RigidBody';

export { 
  CollisionShape, 
  CollisionShapeType,
  BoxShape,
  SphereShape,
  CapsuleShape,
  PlaneShape
} from './CollisionShape';
