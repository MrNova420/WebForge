/**
 * @module core
 * @fileoverview EventSystem class - Type-safe event dispatcher for component communication
 */

/**
 * Event handler function type.
 * @template T - Event data type
 */
export type EventHandler<T = any> = (data: T) => void;

/**
 * Event subscription interface.
 */
export interface EventSubscription {
  /** Unsubscribes this handler from the event */
  unsubscribe(): void;
}

/**
 * Type-safe event dispatcher for component communication.
 * Provides a pub-sub pattern for decoupled communication between game systems.
 * 
 * @example
 * ```typescript
 * const events = new EventSystem();
 * 
 * // Subscribe to an event
 * const sub = events.on('player:damage', (data) => {
 *   console.log(`Player took ${data.amount} damage`);
 * });
 * 
 * // Emit an event
 * events.emit('player:damage', { amount: 10 });
 * 
 * // Unsubscribe
 * sub.unsubscribe();
 * ```
 */
export class EventSystem {
  /** Map of event names to their handlers */
  private handlers: Map<string, Set<EventHandler>>;
  
  /** Map of one-time event handlers */
  private onceHandlers: Map<string, Set<EventHandler>>;
  
  /** Enable/disable debug logging */
  private debug: boolean;

  /**
   * Creates a new EventSystem.
   * @param debug - Enable debug logging (default: false)
   */
  constructor(debug: boolean = false) {
    this.handlers = new Map();
    this.onceHandlers = new Map();
    this.debug = debug;
  }

  /**
   * Subscribes to an event.
   * @param eventName - Name of the event
   * @param handler - Event handler function
   * @returns Subscription object for unsubscribing
   */
  on<T = any>(eventName: string, handler: EventHandler<T>): EventSubscription {
    if (!this.handlers.has(eventName)) {
      this.handlers.set(eventName, new Set());
    }
    
    this.handlers.get(eventName)!.add(handler as EventHandler);
    
    if (this.debug) {
      console.log(`[EventSystem] Subscribed to "${eventName}"`);
    }
    
    return {
      unsubscribe: () => this.off(eventName, handler)
    };
  }

  /**
   * Subscribes to an event for one-time execution.
   * Handler will be automatically unsubscribed after first execution.
   * @param eventName - Name of the event
   * @param handler - Event handler function
   * @returns Subscription object for manual unsubscribing
   */
  once<T = any>(eventName: string, handler: EventHandler<T>): EventSubscription {
    if (!this.onceHandlers.has(eventName)) {
      this.onceHandlers.set(eventName, new Set());
    }
    
    this.onceHandlers.get(eventName)!.add(handler as EventHandler);
    
    if (this.debug) {
      console.log(`[EventSystem] Subscribed once to "${eventName}"`);
    }
    
    return {
      unsubscribe: () => this.offOnce(eventName, handler)
    };
  }

  /**
   * Unsubscribes from an event.
   * @param eventName - Name of the event
   * @param handler - Event handler to remove
   */
  off<T = any>(eventName: string, handler: EventHandler<T>): void {
    const handlers = this.handlers.get(eventName);
    if (handlers) {
      handlers.delete(handler as EventHandler);
      
      if (handlers.size === 0) {
        this.handlers.delete(eventName);
      }
      
      if (this.debug) {
        console.log(`[EventSystem] Unsubscribed from "${eventName}"`);
      }
    }
  }

  /**
   * Removes a one-time event handler.
   * @param eventName - Name of the event
   * @param handler - Event handler to remove
   */
  private offOnce<T = any>(eventName: string, handler: EventHandler<T>): void {
    const handlers = this.onceHandlers.get(eventName);
    if (handlers) {
      handlers.delete(handler as EventHandler);
      
      if (handlers.size === 0) {
        this.onceHandlers.delete(eventName);
      }
      
      if (this.debug) {
        console.log(`[EventSystem] Removed once handler for "${eventName}"`);
      }
    }
  }

  /**
   * Unsubscribes all handlers for a specific event.
   * @param eventName - Name of the event
   */
  offAll(eventName: string): void {
    this.handlers.delete(eventName);
    this.onceHandlers.delete(eventName);
    
    if (this.debug) {
      console.log(`[EventSystem] Removed all handlers for "${eventName}"`);
    }
  }

  /**
   * Emits an event, calling all subscribed handlers.
   * @param eventName - Name of the event
   * @param data - Event data to pass to handlers
   */
  emit<T = any>(eventName: string, data?: T): void {
    if (this.debug) {
      console.log(`[EventSystem] Emitting "${eventName}"`, data);
    }
    
    // Call regular handlers
    const handlers = this.handlers.get(eventName);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error(`[EventSystem] Error in handler for "${eventName}":`, error);
        }
      });
    }
    
    // Call and remove one-time handlers
    const onceHandlers = this.onceHandlers.get(eventName);
    if (onceHandlers) {
      const handlersArray = Array.from(onceHandlers);
      this.onceHandlers.delete(eventName);
      
      handlersArray.forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error(`[EventSystem] Error in once handler for "${eventName}":`, error);
        }
      });
    }
  }

  /**
   * Emits an event asynchronously (on next event loop tick).
   * @param eventName - Name of the event
   * @param data - Event data to pass to handlers
   * @returns Promise that resolves when all handlers complete
   */
  async emitAsync<T = any>(eventName: string, data?: T): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(() => {
        this.emit(eventName, data);
        resolve();
      }, 0);
    });
  }

  /**
   * Checks if an event has any subscribers.
   * @param eventName - Name of the event
   * @returns True if event has subscribers
   */
  hasListeners(eventName: string): boolean {
    return (
      (this.handlers.has(eventName) && this.handlers.get(eventName)!.size > 0) ||
      (this.onceHandlers.has(eventName) && this.onceHandlers.get(eventName)!.size > 0)
    );
  }

  /**
   * Gets the number of subscribers for an event.
   * @param eventName - Name of the event
   * @returns Number of subscribers
   */
  listenerCount(eventName: string): number {
    const regularCount = this.handlers.get(eventName)?.size || 0;
    const onceCount = this.onceHandlers.get(eventName)?.size || 0;
    return regularCount + onceCount;
  }

  /**
   * Gets all event names that have subscribers.
   * @returns Array of event names
   */
  eventNames(): string[] {
    const names = new Set<string>();
    
    this.handlers.forEach((_, name) => names.add(name));
    this.onceHandlers.forEach((_, name) => names.add(name));
    
    return Array.from(names);
  }

  /**
   * Removes all event handlers.
   */
  clear(): void {
    this.handlers.clear();
    this.onceHandlers.clear();
    
    if (this.debug) {
      console.log('[EventSystem] Cleared all handlers');
    }
  }

  /**
   * Creates a namespaced event system.
   * Useful for isolating events within a specific system or module.
   * @param namespace - Namespace prefix for events
   * @returns Namespaced event system
   */
  namespace(namespace: string): NamespacedEventSystem {
    return new NamespacedEventSystem(this, namespace);
  }

  /**
   * Enables or disables debug logging.
   * @param enabled - True to enable debug logging
   */
  setDebug(enabled: boolean): void {
    this.debug = enabled;
  }
}

/**
 * Namespaced event system for isolated event handling.
 */
export class NamespacedEventSystem {
  private parent: EventSystem;
  private namespace: string;

  /**
   * Creates a namespaced event system.
   * @param parent - Parent event system
   * @param namespace - Namespace prefix
   */
  constructor(parent: EventSystem, namespace: string) {
    this.parent = parent;
    this.namespace = namespace;
  }

  /**
   * Creates a namespaced event name.
   * @param eventName - Event name
   * @returns Namespaced event name
   */
  private namespacedEvent(eventName: string): string {
    return `${this.namespace}:${eventName}`;
  }

  /**
   * Subscribes to a namespaced event.
   * @param eventName - Name of the event (without namespace)
   * @param handler - Event handler function
   * @returns Subscription object
   */
  on<T = any>(eventName: string, handler: EventHandler<T>): EventSubscription {
    return this.parent.on(this.namespacedEvent(eventName), handler);
  }

  /**
   * Subscribes to a namespaced event for one-time execution.
   * @param eventName - Name of the event (without namespace)
   * @param handler - Event handler function
   * @returns Subscription object
   */
  once<T = any>(eventName: string, handler: EventHandler<T>): EventSubscription {
    return this.parent.once(this.namespacedEvent(eventName), handler);
  }

  /**
   * Unsubscribes from a namespaced event.
   * @param eventName - Name of the event (without namespace)
   * @param handler - Event handler to remove
   */
  off<T = any>(eventName: string, handler: EventHandler<T>): void {
    this.parent.off(this.namespacedEvent(eventName), handler);
  }

  /**
   * Emits a namespaced event.
   * @param eventName - Name of the event (without namespace)
   * @param data - Event data
   */
  emit<T = any>(eventName: string, data?: T): void {
    this.parent.emit(this.namespacedEvent(eventName), data);
  }

  /**
   * Emits a namespaced event asynchronously.
   * @param eventName - Name of the event (without namespace)
   * @param data - Event data
   * @returns Promise that resolves when all handlers complete
   */
  async emitAsync<T = any>(eventName: string, data?: T): Promise<void> {
    return this.parent.emitAsync(this.namespacedEvent(eventName), data);
  }

  /**
   * Checks if a namespaced event has subscribers.
   * @param eventName - Name of the event (without namespace)
   * @returns True if event has subscribers
   */
  hasListeners(eventName: string): boolean {
    return this.parent.hasListeners(this.namespacedEvent(eventName));
  }

  /**
   * Gets the number of subscribers for a namespaced event.
   * @param eventName - Name of the event (without namespace)
   * @returns Number of subscribers
   */
  listenerCount(eventName: string): number {
    return this.parent.listenerCount(this.namespacedEvent(eventName));
  }
}

/**
 * Global event system instance.
 * Can be used for application-wide events.
 */
export const globalEvents = new EventSystem();
