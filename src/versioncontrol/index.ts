/**
 * Version Control module - Git integration and diff visualization
 * 
 * @module versioncontrol
 */

export { VersionControlSystem } from './VersionControlSystem';
export type { GitCommit, GitFileChange, GitBranch, GitDiff, DiffHunk, DiffLine, MergeConflict, ConflictRegion } from './VersionControlSystem';
export { DiffVisualizer, DiffMode } from './DiffVisualizer';
export type { DiffStats, VisualDiffLine } from './DiffVisualizer';
