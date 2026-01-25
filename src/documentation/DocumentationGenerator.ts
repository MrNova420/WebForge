/**
 * DocumentationGenerator - Auto-generate API documentation
 * 
 * Provides comprehensive documentation generation:
 * - TSDoc to HTML/Markdown conversion
 * - Interactive API reference
 * - Code examples with syntax highlighting
 * - Search functionality
 * - Version tracking
 * 
 * @module documentation
 */

import { EventSystem } from '../core/EventSystem';

/**
 * Documentation page type
 */
export enum DocPageType {
    API_REFERENCE = 'api-reference',
    GUIDE = 'guide',
    TUTORIAL = 'tutorial',
    EXAMPLE = 'example',
    CHANGELOG = 'changelog'
}

/**
 * Documentation page
 */
export interface DocPage {
    id: string;
    title: string;
    type: DocPageType;
    content: string;
    category: string;
    tags: string[];
    version: string;
    lastUpdated: number;
    author?: string;
}

/**
 * API documentation entry
 */
export interface APIDoc {
    name: string;
    type: 'class' | 'interface' | 'function' | 'enum' | 'type';
    description: string;
    signature: string;
    parameters?: ParameterDoc[];
    returns?: ReturnDoc;
    examples?: CodeExample[];
    seeAlso?: string[];
    deprecated?: boolean;
    since?: string;
}

/**
 * Parameter documentation
 */
export interface ParameterDoc {
    name: string;
    type: string;
    description: string;
    optional: boolean;
    defaultValue?: string;
}

/**
 * Return value documentation
 */
export interface ReturnDoc {
    type: string;
    description: string;
}

/**
 * Code example
 */
export interface CodeExample {
    title: string;
    description: string;
    code: string;
    language: string;
}

/**
 * Search result
 */
export interface SearchResult {
    page: DocPage;
    relevance: number;
    matchedTerms: string[];
}

/**
 * DocumentationGenerator - Generates and manages documentation
 */
export class DocumentationGenerator {
    private events: EventSystem;
    private pages: Map<string, DocPage>;
    private apiDocs: Map<string, APIDoc>;
    private searchIndex: Map<string, Set<string>>;

    constructor() {
        this.events = new EventSystem();
        this.pages = new Map();
        this.apiDocs = new Map();
        this.searchIndex = new Map();

        this.initializeDefaultDocs();
    }

    /**
     * Initialize default documentation
     */
    private initializeDefaultDocs(): void {
        // Getting started guide
        this.addPage({
            id: 'getting-started',
            title: 'Getting Started with WebForge',
            type: DocPageType.GUIDE,
            content: `
# Getting Started with WebForge

Welcome to WebForge, the ultimate web game development platform!

## Installation

\`\`\`bash
npm install @webforge/platform
\`\`\`

## Quick Start

\`\`\`typescript
import { Engine } from '@webforge/platform';

const engine = new Engine();
await engine.init();

// Create your first scene
const scene = engine.createScene();

// Start the engine
engine.start();
\`\`\`

## Next Steps

- [Creating Your First Game](./first-game)
- [Understanding the Scene Graph](./scene-graph)
- [Working with Assets](./assets)
            `,
            category: 'Getting Started',
            tags: ['beginner', 'installation', 'quick-start'],
            version: '1.0.0',
            lastUpdated: Date.now()
        });

        // API reference example
        this.addAPIDoc({
            name: 'Engine',
            type: 'class',
            description: 'Main game engine class that manages the game loop, scene, and all subsystems',
            signature: 'class Engine',
            parameters: [],
            examples: [{
                title: 'Basic Engine Setup',
                description: 'Initialize and start the game engine',
                code: `const engine = new Engine();
await engine.init();
engine.start();`,
                language: 'typescript'
            }],
            seeAlso: ['Scene', 'GameObject', 'Component']
        });
    }

    /**
     * Add documentation page
     */
    public addPage(page: DocPage): void {
        this.pages.set(page.id, page);
        this.indexPage(page);
        this.events.emit('page_added', page);
    }

    /**
     * Add API documentation
     */
    public addAPIDoc(apiDoc: APIDoc): void {
        this.apiDocs.set(apiDoc.name, apiDoc);
        this.events.emit('api_doc_added', apiDoc);
    }

    /**
     * Index page for search
     */
    private indexPage(page: DocPage): void {
        // Extract words from title and content
        const words = this.extractWords(page.title + ' ' + page.content);

        for (const word of words) {
            if (!this.searchIndex.has(word)) {
                this.searchIndex.set(word, new Set());
            }
            this.searchIndex.get(word)!.add(page.id);
        }
    }

    /**
     * Extract searchable words
     */
    private extractWords(text: string): string[] {
        return text
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, ' ')
            .split(/\s+/)
            .filter(word => word.length > 2);
    }

    /**
     * Search documentation
     */
    public search(query: string): SearchResult[] {
        const queryWords = this.extractWords(query);
        const pageScores = new Map<string, number>();

        // Calculate relevance scores
        for (const word of queryWords) {
            const matchingPages = this.searchIndex.get(word);
            if (matchingPages) {
                for (const pageId of matchingPages) {
                    const currentScore = pageScores.get(pageId) || 0;
                    pageScores.set(pageId, currentScore + 1);
                }
            }
        }

        // Create search results
        const results: SearchResult[] = [];
        for (const [pageId, score] of pageScores) {
            const page = this.pages.get(pageId);
            if (page) {
                results.push({
                    page,
                    relevance: score / queryWords.length,
                    matchedTerms: queryWords
                });
            }
        }

        // Sort by relevance
        results.sort((a, b) => b.relevance - a.relevance);

        return results;
    }

    /**
     * Get page by ID
     */
    public getPage(id: string): DocPage | undefined {
        return this.pages.get(id);
    }

    /**
     * Get all pages by type
     */
    public getPagesByType(type: DocPageType): DocPage[] {
        return Array.from(this.pages.values()).filter(page => page.type === type);
    }

    /**
     * Get all pages by category
     */
    public getPagesByCategory(category: string): DocPage[] {
        return Array.from(this.pages.values()).filter(page => page.category === category);
    }

    /**
     * Get API documentation
     */
    public getAPIDoc(name: string): APIDoc | undefined {
        return this.apiDocs.get(name);
    }

    /**
     * Get all API documentation
     */
    public getAllAPIDocs(): APIDoc[] {
        return Array.from(this.apiDocs.values());
    }

    /**
     * Generate HTML documentation
     */
    public generateHTML(pageId: string): string {
        const page = this.pages.get(pageId);
        if (!page) {
            return '<h1>Page not found</h1>';
        }

        let html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${page.title} - WebForge Documentation</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            line-height: 1.6;
            max-width: 900px;
            margin: 0 auto;
            padding: 20px;
            color: #333;
        }
        h1 { color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px; }
        h2 { color: #34495e; margin-top: 30px; }
        code {
            background: #f4f4f4;
            padding: 2px 6px;
            border-radius: 3px;
            font-family: 'Courier New', monospace;
        }
        pre {
            background: #282c34;
            color: #abb2bf;
            padding: 15px;
            border-radius: 5px;
            overflow-x: auto;
        }
        pre code { background: none; color: inherit; padding: 0; }
        .meta {
            color: #7f8c8d;
            font-size: 0.9em;
            margin-bottom: 20px;
        }
        .tags {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
            margin-top: 10px;
        }
        .tag {
            background: #3498db;
            color: white;
            padding: 4px 12px;
            border-radius: 15px;
            font-size: 0.85em;
        }
    </style>
</head>
<body>
    <h1>${page.title}</h1>
    <div class="meta">
        <strong>Category:</strong> ${page.category} | 
        <strong>Type:</strong> ${page.type} | 
        <strong>Version:</strong> ${page.version}
    </div>
    <div class="tags">
        ${page.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
    </div>
    <div class="content">
        ${this.markdownToHTML(page.content)}
    </div>
</body>
</html>
        `;

        return html;
    }

    /**
     * Simple markdown to HTML conversion
     */
    private markdownToHTML(markdown: string): string {
        return markdown
            .replace(/^# (.+)$/gm, '<h1>$1</h1>')
            .replace(/^## (.+)$/gm, '<h2>$1</h2>')
            .replace(/^### (.+)$/gm, '<h3>$1</h3>')
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.+?)\*/g, '<em>$1</em>')
            .replace(/`([^`]+)`/g, '<code>$1</code>')
            .replace(/```(\w+)?\n([\s\S]+?)```/g, '<pre><code>$2</code></pre>')
            .replace(/\n\n/g, '</p><p>')
            .replace(/^(.+)$/gm, '<p>$1</p>');
    }

    /**
     * Export all documentation to JSON
     */
    public exportToJSON(): string {
        return JSON.stringify({
            pages: Array.from(this.pages.values()),
            apiDocs: Array.from(this.apiDocs.values())
        }, null, 2);
    }

    /**
     * Import documentation from JSON
     */
    public importFromJSON(json: string): void {
        const data = JSON.parse(json);

        if (data.pages) {
            for (const page of data.pages) {
                this.addPage(page);
            }
        }

        if (data.apiDocs) {
            for (const apiDoc of data.apiDocs) {
                this.addAPIDoc(apiDoc);
            }
        }
    }

    /**
     * Listen to documentation events
     */
    public on(event: string, callback: (data: any) => void): void {
        this.events.on(event, callback);
    }

    /**
     * Remove event listener
     */
    public off(event: string, callback: (data: any) => void): void {
        this.events.off(event, callback);
    }
}
