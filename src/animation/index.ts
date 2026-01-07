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
