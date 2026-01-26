/**
 * WebForge Professional Debugger - Console Commands
 * 
 * In-browser console/REPL for runtime debugging with
 * custom commands and autocomplete.
 */

export interface Command {
    name: string;
    description: string;
    usage?: string;
    aliases?: string[];
    execute: (args: string[], context: CommandContext) => CommandResult | Promise<CommandResult>;
}

export interface CommandContext {
    engine: unknown;
    scene: unknown;
    debugManager: unknown;
    variables: Map<string, unknown>;
    history: string[];
}

export interface CommandResult {
    success: boolean;
    output?: string;
    data?: unknown;
    error?: string;
}

export interface ConsoleConfig {
    maxHistory: number;
    maxOutput: number;
    prompt: string;
    welcomeMessage: string;
}

const DEFAULT_CONFIG: ConsoleConfig = {
    maxHistory: 500,
    maxOutput: 1000,
    prompt: '> ',
    welcomeMessage: `
╔═══════════════════════════════════════════════════════════╗
║           WebForge Debug Console v1.0.0                   ║
║  Type 'help' for available commands, 'exit' to close      ║
╚═══════════════════════════════════════════════════════════╝
`
};

export class DebugConsole {
    private commands: Map<string, Command> = new Map();
    private aliases: Map<string, string> = new Map();
    private history: string[] = [];
    private output: string[] = [];
    private variables: Map<string, unknown> = new Map();
    private config: ConsoleConfig;
    private visible: boolean = false;
    private container: HTMLDivElement | null = null;
    private inputElement: HTMLInputElement | null = null;
    private outputElement: HTMLDivElement | null = null;
    private historyIndex: number = -1;

    // External references (set by DebugManager)
    public engineRef: unknown = null;
    public sceneRef: unknown = null;
    public debugManagerRef: unknown = null;

    constructor(config: Partial<ConsoleConfig> = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.registerBuiltInCommands();
    }

    /**
     * Register a command
     */
    registerCommand(command: Command): void {
        this.commands.set(command.name, command);

        if (command.aliases) {
            for (const alias of command.aliases) {
                this.aliases.set(alias, command.name);
            }
        }
    }

    /**
     * Unregister a command
     */
    unregisterCommand(name: string): void {
        const command = this.commands.get(name);
        if (command?.aliases) {
            for (const alias of command.aliases) {
                this.aliases.delete(alias);
            }
        }
        this.commands.delete(name);
    }

    /**
     * Execute a command string
     */
    async execute(input: string): Promise<CommandResult> {
        const trimmed = input.trim();
        if (!trimmed) {
            return { success: true };
        }

        // Add to history
        this.history.push(trimmed);
        if (this.history.length > this.config.maxHistory) {
            this.history.shift();
        }
        this.historyIndex = this.history.length;

        // Parse command and arguments
        const parts = this.parseCommand(trimmed);
        if (parts.length === 0) {
            return { success: true };
        }

        const [commandName, ...args] = parts;
        
        // Check for variable assignment
        if (trimmed.includes('=') && !trimmed.startsWith('=')) {
            return this.handleAssignment(trimmed);
        }

        // Resolve alias
        const resolvedName = this.aliases.get(commandName) ?? commandName;
        const command = this.commands.get(resolvedName);

        if (!command) {
            // Try to evaluate as JavaScript
            return this.evaluateExpression(trimmed);
        }

        const context: CommandContext = {
            engine: this.engineRef,
            scene: this.sceneRef,
            debugManager: this.debugManagerRef,
            variables: this.variables,
            history: this.history
        };

        try {
            const result = await command.execute(args, context);
            this.addOutput(result.output ?? '');
            return result;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.addOutput(`Error: ${errorMessage}`, 'error');
            return { success: false, error: errorMessage };
        }
    }

    /**
     * Show the console
     */
    show(): void {
        if (this.visible) return;
        this.visible = true;
        this.createDOM();
        this.addOutput(this.config.welcomeMessage, 'info');
        this.inputElement?.focus();
    }

    /**
     * Hide the console
     */
    hide(): void {
        if (!this.visible) return;
        this.visible = false;
        this.destroyDOM();
    }

    /**
     * Toggle visibility
     */
    toggle(): void {
        if (this.visible) {
            this.hide();
        } else {
            this.show();
        }
    }

    /**
     * Check if visible
     */
    isVisible(): boolean {
        return this.visible;
    }

    /**
     * Add output line
     */
    addOutput(text: string, type: 'info' | 'error' | 'success' | 'warn' = 'info'): void {
        const timestamp = new Date().toLocaleTimeString();
        const line = `[${timestamp}] ${text}`;
        this.output.push(line);

        if (this.output.length > this.config.maxOutput) {
            this.output.shift();
        }

        this.updateOutputDisplay(line, type);
    }

    /**
     * Clear output
     */
    clearOutput(): void {
        this.output = [];
        if (this.outputElement) {
            this.outputElement.innerHTML = '';
        }
    }

    /**
     * Get command suggestions for autocomplete
     */
    getSuggestions(partial: string): string[] {
        const suggestions: string[] = [];
        const lowerPartial = partial.toLowerCase();

        for (const name of this.commands.keys()) {
            if (name.toLowerCase().startsWith(lowerPartial)) {
                suggestions.push(name);
            }
        }

        for (const alias of this.aliases.keys()) {
            if (alias.toLowerCase().startsWith(lowerPartial)) {
                suggestions.push(alias);
            }
        }

        return suggestions.sort();
    }

    /**
     * Get all commands
     */
    getCommands(): Command[] {
        return Array.from(this.commands.values());
    }

    /**
     * Get command history
     */
    getHistory(): string[] {
        return [...this.history];
    }

    /**
     * Get variables
     */
    getVariables(): Map<string, unknown> {
        return new Map(this.variables);
    }

    /**
     * Set a variable
     */
    setVariable(name: string, value: unknown): void {
        this.variables.set(name, value);
    }

    private registerBuiltInCommands(): void {
        // Help command
        this.registerCommand({
            name: 'help',
            description: 'Show available commands',
            aliases: ['?', 'commands'],
            execute: (args) => {
                if (args.length > 0) {
                    const command = this.commands.get(args[0]) ?? 
                        this.commands.get(this.aliases.get(args[0]) ?? '');
                    
                    if (command) {
                        return {
                            success: true,
                            output: `
${command.name}: ${command.description}
Usage: ${command.usage ?? command.name}
Aliases: ${command.aliases?.join(', ') ?? 'none'}
`
                        };
                    }
                    return { success: false, error: `Unknown command: ${args[0]}` };
                }

                const lines = ['Available commands:\n'];
                for (const cmd of this.commands.values()) {
                    lines.push(`  ${cmd.name.padEnd(15)} - ${cmd.description}`);
                }
                return { success: true, output: lines.join('\n') };
            }
        });

        // Clear command
        this.registerCommand({
            name: 'clear',
            description: 'Clear the console output',
            aliases: ['cls'],
            execute: () => {
                this.clearOutput();
                return { success: true };
            }
        });

        // Exit command
        this.registerCommand({
            name: 'exit',
            description: 'Close the debug console',
            aliases: ['quit', 'close'],
            execute: () => {
                setTimeout(() => this.hide(), 0);
                return { success: true, output: 'Closing console...' };
            }
        });

        // History command
        this.registerCommand({
            name: 'history',
            description: 'Show command history',
            execute: () => {
                const lines = this.history.slice(-20).map((cmd, i) => `${i + 1}. ${cmd}`);
                return { success: true, output: lines.join('\n') };
            }
        });

        // Variables command
        this.registerCommand({
            name: 'vars',
            description: 'Show defined variables',
            aliases: ['variables'],
            execute: () => {
                if (this.variables.size === 0) {
                    return { success: true, output: 'No variables defined' };
                }
                const lines = Array.from(this.variables.entries())
                    .map(([name, value]) => `${name} = ${this.formatValue(value)}`);
                return { success: true, output: lines.join('\n') };
            }
        });

        // Echo command
        this.registerCommand({
            name: 'echo',
            description: 'Print a message',
            usage: 'echo <message>',
            execute: (args) => {
                return { success: true, output: args.join(' ') };
            }
        });

        // Time command
        this.registerCommand({
            name: 'time',
            description: 'Measure execution time of a command',
            usage: 'time <command>',
            execute: async (args, _context) => {
                if (args.length === 0) {
                    return { success: false, error: 'Usage: time <command>' };
                }
                
                const start = performance.now();
                const result = await this.execute(args.join(' '));
                const elapsed = performance.now() - start;
                
                return {
                    success: result.success,
                    output: `${result.output ?? ''}\nExecution time: ${elapsed.toFixed(2)}ms`
                };
            }
        });

        // Inspect command
        this.registerCommand({
            name: 'inspect',
            description: 'Inspect an object or variable',
            usage: 'inspect <expression>',
            aliases: ['i'],
            execute: (args) => {
                if (args.length === 0) {
                    return { success: false, error: 'Usage: inspect <expression>' };
                }

                const expr = args.join(' ');
                const result = this.evaluateExpression(expr);
                
                if (result.success && result.data !== undefined) {
                    return {
                        success: true,
                        output: this.inspectValue(result.data)
                    };
                }
                
                return result;
            }
        });

        // FPS command
        this.registerCommand({
            name: 'fps',
            description: 'Show/set FPS limit',
            usage: 'fps [target]',
            execute: (args, context) => {
                const engine = context.engine as { targetFPS?: number; setTargetFPS?: (fps: number) => void } | null;
                
                if (args.length === 0) {
                    return {
                        success: true,
                        output: `Current FPS target: ${engine?.targetFPS ?? 'unknown'}`
                    };
                }

                const target = parseInt(args[0], 10);
                if (isNaN(target) || target < 1) {
                    return { success: false, error: 'Invalid FPS value' };
                }

                if (engine?.setTargetFPS) {
                    engine.setTargetFPS(target);
                    return { success: true, output: `FPS target set to ${target}` };
                }

                return { success: false, error: 'Engine not available' };
            }
        });

        // Pause command
        this.registerCommand({
            name: 'pause',
            description: 'Pause the game',
            execute: (_args, context) => {
                const engine = context.engine as { pause?: () => void } | null;
                if (engine?.pause) {
                    engine.pause();
                    return { success: true, output: 'Game paused' };
                }
                return { success: false, error: 'Engine not available' };
            }
        });

        // Resume command
        this.registerCommand({
            name: 'resume',
            description: 'Resume the game',
            aliases: ['play'],
            execute: (_args, context) => {
                const engine = context.engine as { resume?: () => void } | null;
                if (engine?.resume) {
                    engine.resume();
                    return { success: true, output: 'Game resumed' };
                }
                return { success: false, error: 'Engine not available' };
            }
        });
    }

    private parseCommand(input: string): string[] {
        const parts: string[] = [];
        let current = '';
        let inQuotes = false;
        let quoteChar = '';

        for (const char of input) {
            if ((char === '"' || char === "'") && !inQuotes) {
                inQuotes = true;
                quoteChar = char;
            } else if (char === quoteChar && inQuotes) {
                inQuotes = false;
                quoteChar = '';
            } else if (char === ' ' && !inQuotes) {
                if (current) {
                    parts.push(current);
                    current = '';
                }
            } else {
                current += char;
            }
        }

        if (current) {
            parts.push(current);
        }

        return parts;
    }

    private handleAssignment(input: string): CommandResult {
        const match = input.match(/^(\w+)\s*=\s*(.+)$/);
        if (!match) {
            return { success: false, error: 'Invalid assignment syntax' };
        }

        const [, name, expr] = match;
        const result = this.evaluateExpression(expr);

        if (result.success) {
            this.variables.set(name, result.data);
            return {
                success: true,
                output: `${name} = ${this.formatValue(result.data)}`
            };
        }

        return result;
    }

    private evaluateExpression(expr: string): CommandResult {
        try {
            // Create a sandboxed evaluation context
            const context: Record<string, unknown> = {
                engine: this.engineRef,
                scene: this.sceneRef,
                debug: this.debugManagerRef,
                ...Object.fromEntries(this.variables)
            };

            // Build function with context variables
            const contextKeys = Object.keys(context);
            const contextValues = Object.values(context);
            
            // eslint-disable-next-line @typescript-eslint/no-implied-eval
            const fn = new Function(...contextKeys, `return ${expr}`);
            const result = fn(...contextValues);

            return {
                success: true,
                output: this.formatValue(result),
                data: result
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }

    private formatValue(value: unknown): string {
        if (value === null) return 'null';
        if (value === undefined) return 'undefined';
        if (typeof value === 'string') return `"${value}"`;
        if (typeof value === 'function') return `[Function: ${value.name || 'anonymous'}]`;
        if (Array.isArray(value)) return `Array(${value.length})`;
        if (typeof value === 'object') {
            try {
                return JSON.stringify(value, null, 2);
            } catch {
                return `[Object: ${value.constructor?.name ?? 'Object'}]`;
            }
        }
        return String(value);
    }

    private inspectValue(value: unknown, depth: number = 0): string {
        const indent = '  '.repeat(depth);
        
        if (value === null) return `${indent}null`;
        if (value === undefined) return `${indent}undefined`;
        if (typeof value !== 'object') return `${indent}${this.formatValue(value)}`;

        const lines: string[] = [];
        const type = Array.isArray(value) ? 'Array' : value.constructor?.name ?? 'Object';
        lines.push(`${indent}${type} {`);

        if (depth < 3) {
            const entries = Object.entries(value as object).slice(0, 20);
            for (const [key, val] of entries) {
                if (typeof val === 'object' && val !== null) {
                    lines.push(`${indent}  ${key}: ${Array.isArray(val) ? `Array(${val.length})` : `{...}`}`);
                } else {
                    lines.push(`${indent}  ${key}: ${this.formatValue(val)}`);
                }
            }
            if (Object.keys(value as object).length > 20) {
                lines.push(`${indent}  ... and ${Object.keys(value as object).length - 20} more`);
            }
        } else {
            lines.push(`${indent}  ...`);
        }

        lines.push(`${indent}}`);
        return lines.join('\n');
    }

    private createDOM(): void {
        this.container = document.createElement('div');
        this.container.id = 'webforge-debug-console';
        this.container.style.cssText = `
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            height: 300px;
            background: rgba(20, 20, 30, 0.95);
            color: #0f0;
            font-family: 'Consolas', 'Monaco', monospace;
            font-size: 13px;
            z-index: 999998;
            display: flex;
            flex-direction: column;
            border-top: 2px solid #444;
        `;

        // Output area
        this.outputElement = document.createElement('div');
        this.outputElement.style.cssText = `
            flex: 1;
            overflow-y: auto;
            padding: 10px;
            white-space: pre-wrap;
            word-wrap: break-word;
        `;
        this.container.appendChild(this.outputElement);

        // Input area
        const inputContainer = document.createElement('div');
        inputContainer.style.cssText = `
            display: flex;
            align-items: center;
            padding: 8px;
            background: rgba(0, 0, 0, 0.3);
            border-top: 1px solid #444;
        `;

        const prompt = document.createElement('span');
        prompt.textContent = this.config.prompt;
        prompt.style.color = '#0ff';
        inputContainer.appendChild(prompt);

        this.inputElement = document.createElement('input');
        this.inputElement.type = 'text';
        this.inputElement.style.cssText = `
            flex: 1;
            background: transparent;
            border: none;
            outline: none;
            color: #fff;
            font-family: inherit;
            font-size: inherit;
            margin-left: 5px;
        `;
        this.inputElement.addEventListener('keydown', (e) => this.handleKeyDown(e));
        inputContainer.appendChild(this.inputElement);

        this.container.appendChild(inputContainer);
        document.body.appendChild(this.container);

        // Global keyboard handler
        document.addEventListener('keydown', this.handleGlobalKey);
    }

    private destroyDOM(): void {
        if (this.container) {
            document.removeEventListener('keydown', this.handleGlobalKey);
            this.container.remove();
            this.container = null;
            this.inputElement = null;
            this.outputElement = null;
        }
    }

    private handleGlobalKey = (e: KeyboardEvent): void => {
        if (e.key === '~' || (e.key === '`' && e.ctrlKey)) {
            e.preventDefault();
            this.toggle();
        }
    };

    private handleKeyDown(e: KeyboardEvent): void {
        if (e.key === 'Enter') {
            const input = this.inputElement?.value ?? '';
            this.inputElement!.value = '';
            this.addOutput(`${this.config.prompt}${input}`, 'info');
            this.execute(input);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (this.historyIndex > 0) {
                this.historyIndex--;
                this.inputElement!.value = this.history[this.historyIndex] ?? '';
            }
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (this.historyIndex < this.history.length - 1) {
                this.historyIndex++;
                this.inputElement!.value = this.history[this.historyIndex] ?? '';
            } else {
                this.historyIndex = this.history.length;
                this.inputElement!.value = '';
            }
        } else if (e.key === 'Tab') {
            e.preventDefault();
            const input = this.inputElement?.value ?? '';
            const suggestions = this.getSuggestions(input);
            if (suggestions.length === 1) {
                this.inputElement!.value = suggestions[0];
            } else if (suggestions.length > 1) {
                this.addOutput(`Suggestions: ${suggestions.join(', ')}`, 'info');
            }
        } else if (e.key === 'Escape') {
            this.hide();
        }
    }

    private updateOutputDisplay(line: string, type: string): void {
        if (!this.outputElement) return;

        const lineElement = document.createElement('div');
        lineElement.textContent = line;

        const colors: Record<string, string> = {
            info: '#0f0',
            error: '#f44',
            success: '#4f4',
            warn: '#ff0'
        };

        lineElement.style.color = colors[type] ?? '#0f0';
        this.outputElement.appendChild(lineElement);
        this.outputElement.scrollTop = this.outputElement.scrollHeight;
    }
}

// Global instance
export const debugConsole = new DebugConsole();
