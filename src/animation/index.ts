/**
 * @module animation
 * @fileoverview WebForge Animation - Skeletal and property animation system
 */

export {
  AnimationClip,
  AnimationTrack,
  InterpolationMode,
  TrackType
} from './AnimationClip';
export type { Keyframe } from './AnimationClip';

export {
  AnimationPlayer,
  PlaybackMode,
  AnimationState
} from './AnimationPlayer';

export {
  Skeleton,
  Bone,
  SkinnedMesh
} from './Skeleton';

export { AnimationBlender } from './AnimationBlender';

export {
  AnimationStateMachine,
  AnimationState as AnimStateMachineState,
  ConditionType,
  ComparisonOperator
} from './AnimationStateMachine';
export type { AnimationParameter, TransitionCondition, StateTransition } from './AnimationStateMachine';

export {
  Simple1DBlendTree,
  Simple2DBlendTree,
  DirectBlendTree,
  AdditiveBlendTree,
  BlendTreeManager,
  BlendTreeType
} from './BlendTree';
export type { BlendSample } from './BlendTree';

export {
  TwoBoneIK,
  FABRIKSolver,
  CCDSolver,
  LookAtIK,
  IKChain,
  IKManager
} from './IK';
export type { IKJoint } from './IK';
