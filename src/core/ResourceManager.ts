/**
 * @module core
 * @fileoverview ResourceManager class - Asset loading, caching, and lifecycle management
 */

import { EventSystem } from './EventSystem';
import { Logger } from './Logger';

/**
 * Resource loading status.
 */
export enum ResourceStatus {
  PENDING = 'pending',
  LOADING = 'loading',
  LOADED = 'loaded',
  ERROR = 'error'
}

/**
 * Resource type enumeration.
 */
export enum ResourceType {
  IMAGE = 'image',
  JSON = 'json',
  TEXT = 'text',
  BINARY = 'binary',
  AUDIO = 'audio'
}

/**
 * Resource metadata interface.
 */
export interface ResourceMetadata {
  url: string;
  type: ResourceType;
  status: ResourceStatus;
  data: any;
  error?: Error;
  size?: number;
  loadTime?: number;
  references: number;
}

/**
 * Resource loader function type.
 */
export type ResourceLoader<T> = (url: string) => Promise<T>;

/**
 * Comprehensive resource management system.
 * Handles loading, caching, and lifecycle management of game assets.
 * 
 * @example
 * ```typescript
 * const resources = new ResourceManager();
 * 
 * // Load a single resource
 * const texture = await resources.load('textures/wall.png', ResourceType.IMAGE);
 * 
 * // Load multiple resources
 * await resources.loadAll([
 *   { url: 'textures/floor.png', type: ResourceType.IMAGE },
 *   { url: 'models/character.json', type: ResourceType.JSON }
 * ]);
 * 
 * // Get a loaded resource
 * const data = resources.get('textures/wall.png');
 * 
 * // Unload when done
 * resources.unload('textures/wall.png');
 * ```
 */
export class ResourceManager {
  /** Resource cache */
  private resources: Map<string, ResourceMetadata>;
  
  /** Custom resource loaders */
  private loaders: Map<ResourceType, ResourceLoader<any>>;
  
  /** Event system for resource events */
  private events: EventSystem;
  
  /** Logger */
  private logger: Logger;
  
  /** Base URL for relative paths */
  private baseURL: string;
  
  /** Currently loading resources */
  private loading: Set<string>;
  
  /** Maximum cache size in bytes (0 = unlimited) */
  private maxCacheSize: number;
  
  /** Current cache size in bytes */
  private currentCacheSize: number;

  /**
   * Creates a new ResourceManager.
   * @param baseURL - Base URL for relative paths (default: '')
   * @param maxCacheSize - Maximum cache size in bytes (default: 0 = unlimited)
   */
  constructor(baseURL: string = '', maxCacheSize: number = 0) {
    this.resources = new Map();
    this.loaders = new Map();
    this.events = new EventSystem();
    this.logger = new Logger('ResourceManager');
    this.baseURL = baseURL;
    this.loading = new Set();
    this.maxCacheSize = maxCacheSize;
    this.currentCacheSize = 0;
    
    // Register default loaders
    this.registerDefaultLoaders();
  }

  /**
   * Registers default resource loaders.
   */
  private registerDefaultLoaders(): void {
    // Image loader
    this.registerLoader(ResourceType.IMAGE, async (url: string) => {
      return new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
        img.src = url;
      });
    });
    
    // JSON loader
    this.registerLoader(ResourceType.JSON, async (url: string) => {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to load JSON: ${url} (${response.status})`);
      }
      return response.json();
    });
    
    // Text loader
    this.registerLoader(ResourceType.TEXT, async (url: string) => {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to load text: ${url} (${response.status})`);
      }
      return response.text();
    });
    
    // Binary loader
    this.registerLoader(ResourceType.BINARY, async (url: string) => {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to load binary: ${url} (${response.status})`);
      }
      return response.arrayBuffer();
    });
    
    // Audio loader
    this.registerLoader(ResourceType.AUDIO, async (url: string) => {
      return new Promise<HTMLAudioElement>((resolve, reject) => {
        const audio = new Audio();
        audio.preload = 'auto';
        audio.oncanplaythrough = () => resolve(audio);
        audio.onerror = () => reject(new Error(`Failed to load audio: ${url}`));
        audio.src = url;
      });
    });
  }

  /**
   * Registers a custom resource loader.
   * @param type - Resource type
   * @param loader - Loader function
   */
  registerLoader<T>(type: ResourceType, loader: ResourceLoader<T>): void {
    this.loaders.set(type, loader);
  }

  /**
   * Resolves a URL (handles relative and absolute paths).
   * @param url - URL to resolve
   * @returns Resolved URL
   */
  private resolveURL(url: string): string {
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
      return url;
    }
    return this.baseURL + url;
  }

  /**
   * Loads a resource.
   * @param url - Resource URL
   * @param type - Resource type
   * @param forceReload - Force reload even if cached
   * @returns Promise with loaded resource data
   */
  async load<T = any>(
    url: string,
    type: ResourceType,
    forceReload: boolean = false
  ): Promise<T> {
    const resolvedURL = this.resolveURL(url);
    
    // Check if already loaded
    if (!forceReload && this.resources.has(resolvedURL)) {
      const metadata = this.resources.get(resolvedURL)!;
      
      if (metadata.status === ResourceStatus.LOADED) {
        metadata.references++;
        return metadata.data;
      }
      
      if (metadata.status === ResourceStatus.ERROR) {
        throw metadata.error;
      }
      
      // Already loading, wait for it
      if (metadata.status === ResourceStatus.LOADING) {
        return new Promise((resolve, reject) => {
          const checkStatus = () => {
            const meta = this.resources.get(resolvedURL);
            if (meta?.status === ResourceStatus.LOADED) {
              resolve(meta.data);
            } else if (meta?.status === ResourceStatus.ERROR) {
              reject(meta.error);
            } else {
              setTimeout(checkStatus, 10);
            }
          };
          checkStatus();
        });
      }
    }
    
    // Mark as loading
    this.loading.add(resolvedURL);
    const metadata: ResourceMetadata = {
      url: resolvedURL,
      type,
      status: ResourceStatus.LOADING,
      data: null,
      references: 1
    };
    this.resources.set(resolvedURL, metadata);
    
    this.events.emit('resource:loading', { url: resolvedURL, type });
    
    try {
      const startTime = performance.now();
      
      // Get loader for this type
      const loader = this.loaders.get(type);
      if (!loader) {
        throw new Error(`No loader registered for type: ${type}`);
      }
      
      // Load the resource
      const data = await loader(resolvedURL);
      
      const loadTime = performance.now() - startTime;
      
      // Calculate size if possible
      let size = 0;
      if (data instanceof ArrayBuffer) {
        size = data.byteLength;
      } else if (data instanceof HTMLImageElement) {
        size = data.width * data.height * 4; // Approximate
      } else if (typeof data === 'string') {
        size = data.length;
      }
      
      // Update metadata
      metadata.status = ResourceStatus.LOADED;
      metadata.data = data;
      metadata.loadTime = loadTime;
      metadata.size = size;
      
      this.currentCacheSize += size;
      
      // Check cache size limit
      if (this.maxCacheSize > 0 && this.currentCacheSize > this.maxCacheSize) {
        this.evictLRU();
      }
      
      this.loading.delete(resolvedURL);
      this.events.emit('resource:loaded', { url: resolvedURL, type, data, loadTime });
      this.logger.debug(`Loaded resource: ${url} (${loadTime.toFixed(2)}ms, ${size} bytes)`);
      
      return data;
    } catch (error) {
      metadata.status = ResourceStatus.ERROR;
      metadata.error = error as Error;
      
      this.loading.delete(resolvedURL);
      this.events.emit('resource:error', { url: resolvedURL, type, error });
      this.logger.error(`Failed to load resource: ${url}`, error);
      
      throw error;
    }
  }

  /**
   * Loads multiple resources in parallel.
   * @param resources - Array of resources to load
   * @returns Promise that resolves when all resources are loaded
   */
  async loadAll(
    resources: Array<{ url: string; type: ResourceType }>
  ): Promise<void> {
    const promises = resources.map(({ url, type }) => this.load(url, type));
    await Promise.all(promises);
  }

  /**
   * Loads multiple resources with progress tracking.
   * @param resources - Array of resources to load
   * @param onProgress - Progress callback
   * @returns Promise that resolves when all resources are loaded
   */
  async loadAllWithProgress(
    resources: Array<{ url: string; type: ResourceType }>,
    onProgress?: (loaded: number, total: number) => void
  ): Promise<void> {
    let loaded = 0;
    const total = resources.length;
    
    const promises = resources.map(async ({ url, type }) => {
      await this.load(url, type);
      loaded++;
      if (onProgress) {
        onProgress(loaded, total);
      }
    });
    
    await Promise.all(promises);
  }

  /**
   * Gets a loaded resource.
   * @param url - Resource URL
   * @returns Resource data or null if not loaded
   */
  get<T = any>(url: string): T | null {
    const resolvedURL = this.resolveURL(url);
    const metadata = this.resources.get(resolvedURL);
    
    if (metadata && metadata.status === ResourceStatus.LOADED) {
      return metadata.data;
    }
    
    return null;
  }

  /**
   * Checks if a resource is loaded.
   * @param url - Resource URL
   * @returns True if resource is loaded
   */
  isLoaded(url: string): boolean {
    const resolvedURL = this.resolveURL(url);
    const metadata = this.resources.get(resolvedURL);
    return metadata !== undefined && metadata.status === ResourceStatus.LOADED;
  }

  /**
   * Checks if a resource is loading.
   * @param url - Resource URL
   * @returns True if resource is currently loading
   */
  isLoading(url: string): boolean {
    const resolvedURL = this.resolveURL(url);
    return this.loading.has(resolvedURL);
  }

  /**
   * Gets resource metadata.
   * @param url - Resource URL
   * @returns Resource metadata or null
   */
  getMetadata(url: string): ResourceMetadata | null {
    const resolvedURL = this.resolveURL(url);
    return this.resources.get(resolvedURL) || null;
  }

  /**
   * Unloads a resource.
   * @param url - Resource URL
   */
  unload(url: string): void {
    const resolvedURL = this.resolveURL(url);
    const metadata = this.resources.get(resolvedURL);
    
    if (metadata) {
      metadata.references--;
      
      if (metadata.references <= 0) {
        if (metadata.size) {
          this.currentCacheSize -= metadata.size;
        }
        this.resources.delete(resolvedURL);
        this.events.emit('resource:unloaded', { url: resolvedURL });
        this.logger.debug(`Unloaded resource: ${url}`);
      }
    }
  }

  /**
   * Unloads all resources.
   */
  unloadAll(): void {
    this.resources.clear();
    this.loading.clear();
    this.currentCacheSize = 0;
    this.events.emit('resource:unloaded-all');
    this.logger.info('Unloaded all resources');
  }

  /**
   * Evicts least recently used resources to free cache space.
   */
  private evictLRU(): void {
    // Simple implementation: remove resources with no references
    const toRemove: string[] = [];
    
    this.resources.forEach((metadata, url) => {
      if (metadata.references <= 0) {
        toRemove.push(url);
      }
    });
    
    toRemove.forEach(url => {
      const metadata = this.resources.get(url);
      if (metadata?.size) {
        this.currentCacheSize -= metadata.size;
      }
      this.resources.delete(url);
      this.logger.debug(`Evicted resource: ${url}`);
    });
  }

  /**
   * Gets loading progress.
   * @returns Object with loaded and total counts
   */
  getProgress(): { loaded: number; loading: number; total: number } {
    let loaded = 0;
    let loading = 0;
    
    this.resources.forEach(metadata => {
      if (metadata.status === ResourceStatus.LOADED) {
        loaded++;
      } else if (metadata.status === ResourceStatus.LOADING) {
        loading++;
      }
    });
    
    return {
      loaded,
      loading,
      total: this.resources.size
    };
  }

  /**
   * Gets cache statistics.
   * @returns Cache statistics object
   */
  getStats(): {
    resourceCount: number;
    cacheSize: number;
    maxCacheSize: number;
    loading: number;
  } {
    return {
      resourceCount: this.resources.size,
      cacheSize: this.currentCacheSize,
      maxCacheSize: this.maxCacheSize,
      loading: this.loading.size
    };
  }

  /**
   * Sets the base URL for relative paths.
   * @param baseURL - New base URL
   */
  setBaseURL(baseURL: string): void {
    this.baseURL = baseURL;
  }

  /**
   * Sets the maximum cache size.
   * @param size - Maximum cache size in bytes (0 = unlimited)
   */
  setMaxCacheSize(size: number): void {
    this.maxCacheSize = size;
    if (size > 0 && this.currentCacheSize > size) {
      this.evictLRU();
    }
  }

  /**
   * Gets the event system for listening to resource events.
   * @returns Event system
   */
  getEvents(): EventSystem {
    return this.events;
  }
}
