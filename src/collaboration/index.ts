/**
 * Collaboration module - Real-time collaborative editing
 * 
 * @module collaboration
 */

export { CollaborationManager, UserRole, OperationType } from './CollaborationManager';
export type { CollaborativeUser, EditOperation, OperationConflict } from './CollaborationManager';
export { PresenceIndicators } from './PresenceIndicators';
export type { Cursor3D, SelectionBox, ViewportFrustum } from './PresenceIndicators';
export { ChatSystem } from './ChatSystem';
export type { ChatMessage, Annotation3D } from './ChatSystem';
