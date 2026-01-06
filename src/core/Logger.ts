/**
 * @module core
 * @fileoverview Logger class - Multi-level logging system with filtering and formatting
 */

/**
 * Log levels in order of severity.
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4
}

/**
 * Log entry interface.
 */
export interface LogEntry {
  level: LogLevel;
  timestamp: number;
  category: string;
  message: string;
  data?: any;
}

/**
 * Logger configuration options.
 */
export interface LoggerConfig {
  /** Minimum log level to display */
  level?: LogLevel;
  /** Enable timestamp in log messages */
  showTimestamp?: boolean;
  /** Enable category in log messages */
  showCategory?: boolean;
  /** Maximum number of log entries to keep in history */
  maxHistorySize?: number;
  /** Custom log handler function */
  handler?: (entry: LogEntry) => void;
}

/**
 * Multi-level logging system with filtering and formatting.
 * Provides structured logging for debugging and diagnostics.
 * 
 * @example
 * ```typescript
 * const logger = new Logger('Renderer', { level: LogLevel.INFO });
 * 
 * logger.debug('Initializing...'); // Won't show (below INFO level)
 * logger.info('Renderer started'); // Will show
 * logger.warn('Low memory');
 * logger.error('Failed to create shader', { error: 'Syntax error' });
 * 
 * // Get log history
 * const entries = logger.getHistory();
 * ```
 */
export class Logger {
  /** Logger category/name */
  private category: string;
  
  /** Current log level */
  private level: LogLevel;
  
  /** Show timestamp in messages */
  private showTimestamp: boolean;
  
  /** Show category in messages */
  private showCategory: boolean;
  
  /** Log history */
  private history: LogEntry[];
  
  /** Maximum history size */
  private maxHistorySize: number;
  
  /** Custom log handler */
  private handler?: (entry: LogEntry) => void;

  /**
   * Creates a new Logger.
   * @param category - Logger category/name
   * @param config - Logger configuration
   */
  constructor(category: string = 'WebForge', config: LoggerConfig = {}) {
    this.category = category;
    this.level = config.level ?? LogLevel.INFO;
    this.showTimestamp = config.showTimestamp ?? true;
    this.showCategory = config.showCategory ?? true;
    this.maxHistorySize = config.maxHistorySize ?? 1000;
    this.handler = config.handler;
    this.history = [];
  }

  /**
   * Logs a debug message.
   * @param message - Log message
   * @param data - Optional data to log
   */
  debug(message: string, data?: any): void {
    this.log(LogLevel.DEBUG, message, data);
  }

  /**
   * Logs an info message.
   * @param message - Log message
   * @param data - Optional data to log
   */
  info(message: string, data?: any): void {
    this.log(LogLevel.INFO, message, data);
  }

  /**
   * Logs a warning message.
   * @param message - Log message
   * @param data - Optional data to log
   */
  warn(message: string, data?: any): void {
    this.log(LogLevel.WARN, message, data);
  }

  /**
   * Logs an error message.
   * @param message - Log message
   * @param data - Optional data to log
   */
  error(message: string, data?: any): void {
    this.log(LogLevel.ERROR, message, data);
  }

  /**
   * Logs a message at the specified level.
   * @param level - Log level
   * @param message - Log message
   * @param data - Optional data to log
   */
  private log(level: LogLevel, message: string, data?: any): void {
    if (level < this.level) {
      return;
    }

    const entry: LogEntry = {
      level,
      timestamp: Date.now(),
      category: this.category,
      message,
      data
    };

    // Add to history
    this.history.push(entry);
    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
    }

    // Call custom handler if provided
    if (this.handler) {
      this.handler(entry);
      return;
    }

    // Default console output
    this.outputToConsole(entry);
  }

  /**
   * Outputs a log entry to the console.
   * @param entry - Log entry
   */
  private outputToConsole(entry: LogEntry): void {
    const parts: string[] = [];

    if (this.showTimestamp) {
      const date = new Date(entry.timestamp);
      const time = date.toTimeString().split(' ')[0];
      const ms = date.getMilliseconds().toString().padStart(3, '0');
      parts.push(`[${time}.${ms}]`);
    }

    if (this.showCategory) {
      parts.push(`[${entry.category}]`);
    }

    const levelStr = LogLevel[entry.level];
    parts.push(`[${levelStr}]`);
    parts.push(entry.message);

    const formattedMessage = parts.join(' ');

    // Use appropriate console method
    switch (entry.level) {
      case LogLevel.DEBUG:
        if (entry.data !== undefined) {
          console.debug(formattedMessage, entry.data);
        } else {
          console.debug(formattedMessage);
        }
        break;

      case LogLevel.INFO:
        if (entry.data !== undefined) {
          console.log(formattedMessage, entry.data);
        } else {
          console.log(formattedMessage);
        }
        break;

      case LogLevel.WARN:
        if (entry.data !== undefined) {
          console.warn(formattedMessage, entry.data);
        } else {
          console.warn(formattedMessage);
        }
        break;

      case LogLevel.ERROR:
        if (entry.data !== undefined) {
          console.error(formattedMessage, entry.data);
        } else {
          console.error(formattedMessage);
        }
        break;
    }
  }

  /**
   * Sets the minimum log level.
   * @param level - New log level
   */
  setLevel(level: LogLevel): void {
    this.level = level;
    this.info(`Log level set to ${LogLevel[level]}`);
  }

  /**
   * Gets the current log level.
   * @returns Current log level
   */
  getLevel(): LogLevel {
    return this.level;
  }

  /**
   * Gets the log history.
   * @param level - Optional filter by log level
   * @returns Array of log entries
   */
  getHistory(level?: LogLevel): LogEntry[] {
    if (level !== undefined) {
      return this.history.filter(entry => entry.level === level);
    }
    return [...this.history];
  }

  /**
   * Clears the log history.
   */
  clearHistory(): void {
    this.history = [];
    this.debug('Log history cleared');
  }

  /**
   * Enables or disables timestamp display.
   * @param enabled - True to show timestamps
   */
  setShowTimestamp(enabled: boolean): void {
    this.showTimestamp = enabled;
  }

  /**
   * Enables or disables category display.
   * @param enabled - True to show category
   */
  setShowCategory(enabled: boolean): void {
    this.showCategory = enabled;
  }

  /**
   * Creates a child logger with the same configuration.
   * @param category - Child logger category
   * @returns New Logger instance
   */
  child(category: string): Logger {
    return new Logger(category, {
      level: this.level,
      showTimestamp: this.showTimestamp,
      showCategory: this.showCategory,
      maxHistorySize: this.maxHistorySize,
      handler: this.handler
    });
  }

  /**
   * Exports log history as JSON string.
   * @param level - Optional filter by log level
   * @returns JSON string of log entries
   */
  exportJSON(level?: LogLevel): string {
    const entries = this.getHistory(level);
    return JSON.stringify(entries, null, 2);
  }

  /**
   * Exports log history as plain text.
   * @param level - Optional filter by log level
   * @returns Plain text log
   */
  exportText(level?: LogLevel): string {
    const entries = this.getHistory(level);
    return entries
      .map(entry => {
        const date = new Date(entry.timestamp);
        const time = date.toISOString();
        const levelStr = LogLevel[entry.level].padEnd(5);
        const dataStr = entry.data ? ` | ${JSON.stringify(entry.data)}` : '';
        return `${time} [${entry.category}] ${levelStr} ${entry.message}${dataStr}`;
      })
      .join('\n');
  }

  /**
   * Groups multiple log calls together (browser consoles).
   * @param label - Group label
   * @param callback - Function containing log calls
   * @param collapsed - Start group collapsed (default: false)
   */
  group(label: string, callback: () => void, collapsed: boolean = false): void {
    if (collapsed) {
      console.groupCollapsed(label);
    } else {
      console.group(label);
    }
    try {
      callback();
    } finally {
      console.groupEnd();
    }
  }

  /**
   * Logs a table (browser consoles).
   * @param data - Data to display in table format
   */
  table(data: any): void {
    if (this.level <= LogLevel.INFO) {
      console.table(data);
    }
  }

  /**
   * Starts a timer.
   * @param label - Timer label
   */
  time(label: string): void {
    if (this.level <= LogLevel.DEBUG) {
      console.time(`${this.category} - ${label}`);
    }
  }

  /**
   * Stops a timer and logs the elapsed time.
   * @param label - Timer label
   */
  timeEnd(label: string): void {
    if (this.level <= LogLevel.DEBUG) {
      console.timeEnd(`${this.category} - ${label}`);
    }
  }

  /**
   * Logs the current call stack trace.
   * @param message - Optional message
   */
  trace(message?: string): void {
    if (this.level <= LogLevel.DEBUG) {
      if (message) {
        console.trace(`${this.category} - ${message}`);
      } else {
        console.trace(this.category);
      }
    }
  }

  /**
   * Asserts a condition and logs an error if false.
   * @param condition - Condition to test
   * @param message - Error message if condition is false
   */
  assert(condition: boolean, message: string): void {
    if (!condition) {
      this.error(`Assertion failed: ${message}`);
      console.assert(condition, message);
    }
  }
}

/**
 * Global logger instance.
 */
export const logger = new Logger('WebForge', {
  level: LogLevel.INFO,
  showTimestamp: true,
  showCategory: true
});
