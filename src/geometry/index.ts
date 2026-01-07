/**
 * WebForge Geometry Module
 * 
 * Mesh editing and geometry operations for 3D modeling.
 */

export { MeshData, MeshAttributes } from './MeshData';
export { HalfEdgeMesh, HalfEdge, Vertex, Face } from './HalfEdgeMesh';
export { MeshSelection, SelectionMode } from './MeshSelection';
export { MeshOperations } from './MeshOperations';

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
