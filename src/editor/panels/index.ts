/**
 * WebForge Editor Panels
 * 
 * Core editor panels for the visual editor.
 */

export { SceneViewPanel, CameraMode } from './SceneViewPanel';
export { InspectorPanel, PropertyType } from './InspectorPanel';
export { HierarchyPanel } from './HierarchyPanel';
export { AssetBrowserPanel, AssetType } from './AssetBrowserPanel';
export { ConsolePanel } from './ConsolePanel';
export { VisualScriptingPanel, VSPortType, VSPortDirection } from './VisualScriptingPanel';
export { MaterialEditorPanel, MaterialPropertyType } from './MaterialEditorPanel';
export { AnimationPanel } from './AnimationPanel';
export { TerrainPanel } from './TerrainPanel';
export { ParticlePanel } from './ParticlePanel';
export { AudioPanel } from './AudioPanel';
export { ProfilerPanel } from './ProfilerPanel';
export { NetworkPanel } from './NetworkPanel';

export type { PropertyDescriptor } from './InspectorPanel';
export type { AssetItem } from './AssetBrowserPanel';
export type { ConsoleEntry } from './ConsolePanel';
export type { VSScriptNode, VSNodeConnection, VSNodePort, VSNodeDefinition, VSNodeCategory } from './VisualScriptingPanel';
export type { MaterialData, MaterialPreset, TextureSlot } from './MaterialEditorPanel';
export type { EditorAnimationClip, EditorAnimationTrack, EditorAnimationState, EditorKeyframe, EditorStateTransition, EditorAnimationParameter } from './AnimationPanel';
export type { TerrainToolType, EditorTerrainBrushShape, EditorTerrainBrush, EditorTerrainLayer, FoliageType, TerrainSettings } from './TerrainPanel';
export type { ParticleEmitterShape, ParticleBlendMode, ParticleSpace, ParticleSortMode, CurveType, ColorStop, CurvePoint, ParticleEmitterConfig, ParticleBurst, ParticlePreset } from './ParticlePanel';
export type { AudioSourceType, AudioRolloffMode, AudioEffectType, AudioBusConfig, AudioEffect, EditorAudioSourceConfig, SoundEventConfig, SoundEntry, AudioSnapshot } from './AudioPanel';
export type { FrameTimingData, PerformanceMarker, ProfilerSession } from './ProfilerPanel';
export type { ConnectionState, PacketDirection, NetworkPacket, ConnectionInfo } from './NetworkPanel';
