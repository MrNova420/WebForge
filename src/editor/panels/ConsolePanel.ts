/**
 * WebForge Console Panel
 * 
 * Log viewer for displaying messages, warnings, and errors.
 * Provides filtering, search, and log level management.
 */

import { Panel } from '../Panel';
import { EditorContext } from '../EditorContext';
import { Logger, LogLevel } from '../../core/Logger';

/**
 * Console log entry
 */
export interface ConsoleEntry {
    level: LogLevel;
    message: string;
    timestamp: Date;
    stack?: string;
}

/**
 * Console panel for log viewing
 */
export class ConsolePanel extends Panel {
    private context: EditorContext;
    private logger: Logger | null = null;
    private entries: ConsoleEntry[] = [];
    
    private logContainer: HTMLElement | null = null;
    private filterLevel: LogLevel | 'all' = 'all';
    private searchTerm: string = '';
    private autoScroll: boolean = true;
    
    // Log level visibility
    private visibleLevels: Set<LogLevel> = new Set([
        LogLevel.DEBUG,
        LogLevel.INFO,
        LogLevel.WARN,
        LogLevel.ERROR
    ]);
    
    /**
     * Creates a new console panel
     * @param context - Editor context
     * @param id - Panel ID
     * @param title - Panel title
     */
    constructor(context: EditorContext, id: string = 'console', title: string = 'Console') {
        super(id, title);
        this.context = context;
        
        // Intercept console methods
        this.interceptConsole();
    }
    
    /**
     * Creates the panel content
     */
    protected createContent(): HTMLElement {
        const content = document.createElement('div');
        content.style.cssText = `
            width: 100%;
            height: 100%;
            display: flex;
            flex-direction: column;
            background: #1a1a1a;
            color: #e0e0e0;
            font-family: 'Consolas', 'Monaco', monospace;
        `;
        
        // Toolbar
        const toolbar = this.createToolbar();
        content.appendChild(toolbar);
        
        // Log container
        this.logContainer = document.createElement('div');
        this.logContainer.style.cssText = `
            flex: 1;
            overflow-y: auto;
            padding: 10px;
            font-size: 12px;
            line-height: 1.5;
        `;
        content.appendChild(this.logContainer);
        
        return content;
    }
    
    /**
     * Creates the toolbar
     */
    private createToolbar(): HTMLElement {
        const toolbar = document.createElement('div');
        toolbar.style.cssText = `
            padding: 8px;
            background: #252525;
            border-bottom: 1px solid #333;
            display: flex;
            gap: 8px;
            align-items: center;
        `;
        
        // Clear button
        const clearBtn = this.createButton('🗑️ Clear', 'Clear all logs', () => {
            this.clearLogs();
        });
        toolbar.appendChild(clearBtn);
        
        // Separator
        toolbar.appendChild(this.createSeparator());
        
        // Level filter buttons
        const levels = [
            { level: LogLevel.DEBUG, label: '🐛 Debug', color: '#888' },
            { level: LogLevel.INFO, label: 'ℹ️ Info', color: '#4a9eff' },
            { level: LogLevel.WARN, label: '⚠️ Warn', color: '#ffa500' },
            { level: LogLevel.ERROR, label: '❌ Error', color: '#ff5555' }
        ];
        
        levels.forEach(({ level, label, color }) => {
            const btn = document.createElement('button');
            btn.textContent = label;
            btn.style.cssText = `
                padding: 4px 10px;
                background: ${this.visibleLevels.has(level) ? color : '#2a2a2a'};
                border: 1px solid ${color};
                border-radius: 3px;
                color: white;
                cursor: pointer;
                font-size: 11px;
                opacity: ${this.visibleLevels.has(level) ? '1' : '0.5'};
            `;
            btn.onclick = () => {
                if (this.visibleLevels.has(level)) {
                    this.visibleLevels.delete(level);
                } else {
                    this.visibleLevels.add(level);
                }
                btn.style.background = this.visibleLevels.has(level) ? color : '#2a2a2a';
                btn.style.opacity = this.visibleLevels.has(level) ? '1' : '0.5';
                this.refreshView();
            };
            toolbar.appendChild(btn);
        });
        
        // Spacer
        const spacer = document.createElement('div');
        spacer.style.cssText = 'flex: 1;';
        toolbar.appendChild(spacer);
        
        // Auto-scroll toggle
        const autoScrollBtn = document.createElement('button');
        autoScrollBtn.textContent = this.autoScroll ? '📌 Auto-scroll' : '📍 Manual';
        autoScrollBtn.style.cssText = `
            padding: 4px 10px;
            background: ${this.autoScroll ? '#4a9eff' : '#2a2a2a'};
            border: 1px solid #444;
            border-radius: 3px;
            color: white;
            cursor: pointer;
            font-size: 11px;
        `;
        autoScrollBtn.onclick = () => {
            this.autoScroll = !this.autoScroll;
            autoScrollBtn.textContent = this.autoScroll ? '📌 Auto-scroll' : '📍 Manual';
            autoScrollBtn.style.background = this.autoScroll ? '#4a9eff' : '#2a2a2a';
        };
        toolbar.appendChild(autoScrollBtn);
        
        // Search input
        const searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.placeholder = 'Search logs...';
        searchInput.style.cssText = `
            width: 200px;
            padding: 4px 8px;
            background: #1a1a1a;
            border: 1px solid #444;
            border-radius: 3px;
            color: #e0e0e0;
            font-size: 11px;
        `;
        searchInput.oninput = () => {
            this.searchTerm = searchInput.value;
            this.refreshView();
        };
        toolbar.appendChild(searchInput);
        
        return toolbar;
    }
    
    /**
     * Creates a toolbar button
     */
    private createButton(text: string, title: string, onClick: () => void): HTMLElement {
        const button = document.createElement('button');
        button.textContent = text;
        button.title = title;
        button.style.cssText = `
            padding: 4px 10px;
            background: #3a3a3a;
            border: 1px solid #444;
            border-radius: 3px;
            color: #e0e0e0;
            cursor: pointer;
            font-size: 11px;
        `;
        button.onclick = onClick;
        return button;
    }
    
    /**
     * Creates a separator
     */
    private createSeparator(): HTMLElement {
        const separator = document.createElement('div');
        separator.style.cssText = 'width: 1px; background: #444; height: 20px;';
        return separator;
    }
    
    /**
     * Intercepts console methods to capture logs
     */
    private interceptConsole(): void {
        const originalLog = console.log;
        const originalWarn = console.warn;
        const originalError = console.error;
        
        console.log = (...args: any[]) => {
            originalLog.apply(console, args);
            this.addEntry(LogLevel.INFO, args.join(' '));
        };
        
        console.warn = (...args: any[]) => {
            originalWarn.apply(console, args);
            this.addEntry(LogLevel.WARN, args.join(' '));
        };
        
        console.error = (...args: any[]) => {
            originalError.apply(console, args);
            this.addEntry(LogLevel.ERROR, args.join(' '));
        };
    }
    
    /**
     * Adds a log entry
     */
    public addEntry(level: LogLevel, message: string, stack?: string): void {
        const entry: ConsoleEntry = {
            level,
            message,
            timestamp: new Date(),
            stack
        };
        
        this.entries.push(entry);
        
        // Limit entries to prevent memory issues
        if (this.entries.length > 1000) {
            this.entries.shift();
        }
        
        this.refreshView();
    }
    
    /**
     * Refreshes the log view
     */
    private refreshView(): void {
        if (!this.logContainer) return;
        
        // Filter entries
        const filtered = this.entries.filter(entry => {
            // Check level visibility
            if (!this.visibleLevels.has(entry.level)) return false;
            
            // Check search term
            if (this.searchTerm && !entry.message.toLowerCase().includes(this.searchTerm.toLowerCase())) {
                return false;
            }
            
            return true;
        });
        
        // Clear container
        this.logContainer.innerHTML = '';
        
        // Add entries
        filtered.forEach(entry => {
            const entryEl = this.createLogEntry(entry);
            this.logContainer!.appendChild(entryEl);
        });
        
        // Auto-scroll to bottom
        if (this.autoScroll) {
            this.logContainer.scrollTop = this.logContainer.scrollHeight;
        }
    }
    
    /**
     * Creates a log entry element
     */
    private createLogEntry(entry: ConsoleEntry): HTMLElement {
        const entryEl = document.createElement('div');
        entryEl.style.cssText = `
            padding: 4px 8px;
            margin-bottom: 2px;
            border-left: 3px solid ${this.getLevelColor(entry.level)};
            background: #2a2a2a;
            border-radius: 2px;
            font-size: 12px;
            word-break: break-word;
        `;
        
        // Timestamp
        const timestamp = document.createElement('span');
        timestamp.textContent = this.formatTimestamp(entry.timestamp);
        timestamp.style.cssText = 'color: #666; margin-right: 10px; font-size: 10px;';
        entryEl.appendChild(timestamp);
        
        // Level icon
        const icon = document.createElement('span');
        icon.textContent = this.getLevelIcon(entry.level);
        icon.style.cssText = 'margin-right: 8px;';
        entryEl.appendChild(icon);
        
        // Message
        const message = document.createElement('span');
        message.textContent = entry.message;
        message.style.cssText = `color: ${this.getLevelColor(entry.level)};`;
        entryEl.appendChild(message);
        
        // Stack trace (if available)
        if (entry.stack) {
            const stack = document.createElement('div');
            stack.textContent = entry.stack;
            stack.style.cssText = `
                margin-top: 5px;
                padding-left: 20px;
                color: #888;
                font-size: 10px;
                font-family: monospace;
            `;
            entryEl.appendChild(stack);
        }
        
        return entryEl;
    }
    
    /**
     * Gets the color for a log level
     */
    private getLevelColor(level: LogLevel): string {
        const colors: Record<LogLevel, string> = {
            [LogLevel.DEBUG]: '#888',
            [LogLevel.INFO]: '#4a9eff',
            [LogLevel.WARN]: '#ffa500',
            [LogLevel.ERROR]: '#ff5555'
        };
        return colors[level];
    }
    
    /**
     * Gets the icon for a log level
     */
    private getLevelIcon(level: LogLevel): string {
        const icons: Record<LogLevel, string> = {
            [LogLevel.DEBUG]: '🐛',
            [LogLevel.INFO]: 'ℹ️',
            [LogLevel.WARN]: '⚠️',
            [LogLevel.ERROR]: '❌'
        };
        return icons[level];
    }
    
    /**
     * Formats a timestamp
     */
    private formatTimestamp(date: Date): string {
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        const seconds = date.getSeconds().toString().padStart(2, '0');
        const ms = date.getMilliseconds().toString().padStart(3, '0');
        return `${hours}:${minutes}:${seconds}.${ms}`;
    }
    
    /**
     * Clears all logs
     */
    private clearLogs(): void {
        this.entries = [];
        this.refreshView();
    }
    
    /**
     * Sets the logger instance
     */
    public setLogger(logger: Logger): void {
        this.logger = logger;
    }
}
