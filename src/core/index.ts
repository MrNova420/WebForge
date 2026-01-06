/**
 * @module core
 * @fileoverview WebForge Core - Engine core systems
 */

export { EventSystem, NamespacedEventSystem, globalEvents } from './EventSystem';
export type { EventHandler, EventSubscription } from './EventSystem';

export { Logger, LogLevel, logger } from './Logger';
export type { LogEntry, LoggerConfig } from './Logger';
