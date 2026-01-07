/**
 * index.ts - Audio module exports
 * 
 * Central export point for the audio system.
 */

export { WebForgeAudioContext, AudioContextConfig, AudioDestination } from './AudioContext';
export { AudioBufferManager, AudioLoadOptions, AudioBufferInfo } from './AudioBuffer';
export { AudioSource, AudioSourceConfig, AudioSourceState } from './AudioSource';
export { AudioManager, AudioManagerConfig, AudioGroup } from './AudioManager';
export {
    SpatialAudioSource,
    AudioListener,
    DistanceModel,
    PanningModel,
    SpatialAudioConfig,
    AudioListenerConfig
} from './SpatialAudio';
export {
    SpatialAudioManager,
    Audio3DConfig
} from './Spatial3DAudio';
