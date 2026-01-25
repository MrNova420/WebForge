/**
 * DiffVisualizer - Visual diff tools for files and scenes
 * 
 * Provides side-by-side diff visualization with:
 * - Line-by-line comparison
 * - Syntax highlighting
 * - Inline diff
 * - 3D scene diff
 * 
 * @module versioncontrol
 */

import { GitDiff, DiffLine, DiffHunk } from './VersionControlSystem';

/**
 * Diff visualization mode
 */
export enum DiffMode {
    SIDE_BY_SIDE = 'side-by-side',
    INLINE = 'inline',
    UNIFIED = 'unified'
}

/**
 * Diff statistics
 */
export interface DiffStats {
    additions: number;
    deletions: number;
    changes: number;
    filesChanged: number;
}

/**
 * Visual diff line with rendering info
 */
export interface VisualDiffLine {
    line: DiffLine;
    highlighted: boolean;
    backgroundColor: string;
    textColor: string;
}

/**
 * DiffVisualizer - Visualizes code and scene diffs
 */
export class DiffVisualizer {
    private mode: DiffMode;
    private _showWhitespace: boolean;
    private _contextLines: number;
    private _syntaxHighlighting: boolean;

    constructor() {
        this.mode = DiffMode.SIDE_BY_SIDE;
        this._showWhitespace = false;
        this._contextLines = 3;
        this._syntaxHighlighting = true;
    }

    /**
     * Generate visual diff from Git diff
     */
    public generateVisualDiff(diff: GitDiff): VisualDiffLine[] {
        const visualLines: VisualDiffLine[] = [];

        for (const hunk of diff.hunks) {
            for (const line of hunk.lines) {
                visualLines.push(this.createVisualLine(line));
            }
        }

        return visualLines;
    }

    /**
     * Create visual line from diff line
     */
    private createVisualLine(line: DiffLine): VisualDiffLine {
        let backgroundColor: string;
        let textColor: string;

        switch (line.type) {
            case 'addition':
                backgroundColor = '#e6ffed';
                textColor = '#24292e';
                break;
            case 'deletion':
                backgroundColor = '#ffeef0';
                textColor = '#24292e';
                break;
            case 'context':
            default:
                backgroundColor = '#ffffff';
                textColor = '#586069';
                break;
        }

        return {
            line,
            highlighted: false,
            backgroundColor,
            textColor
        };
    }

    /**
     * Calculate diff statistics
     */
    public calculateStats(diffs: GitDiff[]): DiffStats {
        const stats: DiffStats = {
            additions: 0,
            deletions: 0,
            changes: 0,
            filesChanged: diffs.length
        };

        for (const diff of diffs) {
            for (const hunk of diff.hunks) {
                for (const line of hunk.lines) {
                    if (line.type === 'addition') {
                        stats.additions++;
                    } else if (line.type === 'deletion') {
                        stats.deletions++;
                    }
                }
            }
        }

        stats.changes = stats.additions + stats.deletions;

        return stats;
    }

    /**
     * Generate side-by-side diff HTML
     */
    public generateSideBySide(diff: GitDiff): string {
        let html = '<div class="diff-side-by-side">';
        html += '<div class="diff-left"><h3>Old</h3>';
        html += this.generateOldSide(diff);
        html += '</div>';
        html += '<div class="diff-right"><h3>New</h3>';
        html += this.generateNewSide(diff);
        html += '</div>';
        html += '</div>';

        return html;
    }

    /**
     * Generate old side of diff
     */
    private generateOldSide(diff: GitDiff): string {
        let html = '<pre>';

        for (const hunk of diff.hunks) {
            for (const line of hunk.lines) {
                if (line.type !== 'addition') {
                    const bgColor = line.type === 'deletion' ? '#ffeef0' : '#ffffff';
                    const prefix = line.type === 'deletion' ? '-' : ' ';
                    html += `<div style="background-color: ${bgColor}">${prefix} ${this.escapeHtml(line.content)}</div>`;
                }
            }
        }

        html += '</pre>';
        return html;
    }

    /**
     * Generate new side of diff
     */
    private generateNewSide(diff: GitDiff): string {
        let html = '<pre>';

        for (const hunk of diff.hunks) {
            for (const line of hunk.lines) {
                if (line.type !== 'deletion') {
                    const bgColor = line.type === 'addition' ? '#e6ffed' : '#ffffff';
                    const prefix = line.type === 'addition' ? '+' : ' ';
                    html += `<div style="background-color: ${bgColor}">${prefix} ${this.escapeHtml(line.content)}</div>`;
                }
            }
        }

        html += '</pre>';
        return html;
    }

    /**
     * Generate inline diff HTML
     */
    public generateInline(diff: GitDiff): string {
        let html = '<div class="diff-inline"><pre>';

        for (const hunk of diff.hunks) {
            html += `<div class="diff-hunk-header">@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@</div>`;

            for (const line of hunk.lines) {
                const visualLine = this.createVisualLine(line);
                const prefix = line.type === 'addition' ? '+' : line.type === 'deletion' ? '-' : ' ';
                html += `<div style="background-color: ${visualLine.backgroundColor}; color: ${visualLine.textColor}">${prefix} ${this.escapeHtml(line.content)}</div>`;
            }
        }

        html += '</pre></div>';
        return html;
    }

    /**
     * Generate unified diff format
     */
    public generateUnified(diff: GitDiff): string {
        let unified = `--- ${diff.filePath}\n`;
        unified += `+++ ${diff.filePath}\n`;

        for (const hunk of diff.hunks) {
            unified += `@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@\n`;

            for (const line of hunk.lines) {
                const prefix = line.type === 'addition' ? '+' : line.type === 'deletion' ? '-' : ' ';
                unified += `${prefix}${line.content}\n`;
            }
        }

        return unified;
    }

    /**
     * Parse unified diff format
     */
    public parseUnified(unifiedDiff: string): GitDiff {
        const lines = unifiedDiff.split('\n');
        const hunks: DiffHunk[] = [];
        let currentHunk: DiffHunk | null = null;

        for (const line of lines) {
            if (line.startsWith('@@')) {
                // Hunk header
                const match = line.match(/@@ -(\d+),(\d+) \+(\d+),(\d+) @@/);
                if (match) {
                    currentHunk = {
                        oldStart: parseInt(match[1]),
                        oldLines: parseInt(match[2]),
                        newStart: parseInt(match[3]),
                        newLines: parseInt(match[4]),
                        lines: []
                    };
                    hunks.push(currentHunk);
                }
            } else if (currentHunk) {
                // Diff line
                const type = line.startsWith('+') ? 'addition' : line.startsWith('-') ? 'deletion' : 'context';
                const content = line.substring(1);

                currentHunk.lines.push({
                    type,
                    content
                });
            }
        }

        return {
            filePath: '',
            oldContent: '',
            newContent: '',
            hunks
        };
    }

    /**
     * Escape HTML special characters
     */
    private escapeHtml(text: string): string {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    /**
     * Set diff mode
     */
    public setMode(mode: DiffMode): void {
        this.mode = mode;
    }

    /**
     * Set show whitespace
     */
    public setShowWhitespace(show: boolean): void {
        this._showWhitespace = show;
    }

    /**
     * Set context lines
     */
    public setContextLines(lines: number): void {
        this._contextLines = Math.max(0, lines);
    }

    /**
     * Set syntax highlighting
     */
    public setSyntaxHighlighting(enabled: boolean): void {
        this._syntaxHighlighting = enabled;
    }

    /**
     * Get current mode
     */
    public getMode(): DiffMode {
        return this.mode;
    }

    /**
     * Get show whitespace setting
     */
    public getShowWhitespace(): boolean {
        return this._showWhitespace;
    }

    /**
     * Get context lines
     */
    public getContextLines(): number {
        return this._contextLines;
    }

    /**
     * Get syntax highlighting setting
     */
    public getSyntaxHighlighting(): boolean {
        return this._syntaxHighlighting;
    }
}
