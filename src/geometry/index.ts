/**
 * WebForge Geometry Module
 * 
 * Mesh editing and geometry operations for 3D modeling.
 */

export { MeshData, MeshAttributes } from './MeshData';
export { HalfEdgeMesh, HalfEdge, Vertex, Face } from './HalfEdgeMesh';
export { MeshSelection, SelectionMode } from './MeshSelection';
export { MeshOperations } from './MeshOperations';
export { UVUnwrapper } from './UVUnwrapper';
export { MeshQualityEnhancer, MeshQualityMetrics, LODSettings } from './MeshQualityEnhancer';
export { SculptingSystem, BrushType as SculptBrushType, FalloffType as SculptFalloffType, BrushSettings } from './SculptingSystem';
export { TexturePaintingSystem, BlendMode, PaintBrushType, PaintBrushSettings } from './TexturePainting';
export { RetopologyTools, EdgeFlowMetrics, RetopologySettings } from './RetopologyTools';
export { WeightPaintingSystem, BoneWeight, VertexWeights, WeightBrushSettings } from './WeightPainting';

// Modifiers
export {
  Modifier,
  SubdivisionModifier,
  MirrorModifier,
  BevelModifier,
  ArrayModifier,
  ModifierStack
} from './modifiers';

// Boolean operations
export {
  BSPPlane,
  BSPTriangle,
  BSPNode,
  BooleanOperations
} from './boolean';
