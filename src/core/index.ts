/**
 * @module core
 * @fileoverview WebForge Core - Engine core systems
 */

export { EventSystem, NamespacedEventSystem, globalEvents } from './EventSystem';
export type { EventHandler, EventSubscription } from './EventSystem';

export { Logger, LogLevel, logger } from './Logger';
export type { LogEntry, LoggerConfig } from './Logger';

export { Time } from './Time';

export { Input, MouseButton } from './Input';

export { ResourceManager, ResourceStatus, ResourceType } from './ResourceManager';
export type { ResourceMetadata, ResourceLoader } from './ResourceManager';

export { Engine, EngineState } from './Engine';
export type { EngineConfig } from './Engine';
