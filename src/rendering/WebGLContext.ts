/**
 * @module rendering
 * @fileoverview WebGLContext class - WebGL context management and initialization
 */

import { Logger } from '../core/Logger';
import { EventSystem } from '../core/EventSystem';

/**
 * WebGL context configuration.
 */
export interface WebGLContextConfig {
  canvas?: HTMLCanvasElement | string;
  webgl2?: boolean;
  alpha?: boolean;
  depth?: boolean;
  stencil?: boolean;
  antialias?: boolean;
  premultipliedAlpha?: boolean;
  preserveDrawingBuffer?: boolean;
  powerPreference?: 'default' | 'high-performance' | 'low-power';
}

/**
 * WebGL context wrapper with utility methods.
 */
export class WebGLContext {
  public canvas: HTMLCanvasElement | null;
  public gl: WebGLRenderingContext | WebGL2RenderingContext | null;
  public isWebGL2: boolean;
  
  private config: WebGLContextConfig;
  private events: EventSystem;
  private logger: Logger;
  private contextLost: boolean;

  constructor(config: WebGLContextConfig = {}) {
    this.canvas = null;
    this.gl = null;
    this.isWebGL2 = false;
    this.config = config;
    this.events = new EventSystem();
    this.logger = new Logger('WebGLContext');
    this.contextLost = false;
  }

  async initialize(): Promise<void> {
    if (this.config.canvas) {
      if (typeof this.config.canvas === 'string') {
        const element = document.getElementById(this.config.canvas);
        if (!element || !(element instanceof HTMLCanvasElement)) {
          throw new Error(`Canvas element "${this.config.canvas}" not found`);
        }
        this.canvas = element;
      } else {
        this.canvas = this.config.canvas;
      }
    } else {
      this.canvas = document.createElement('canvas');
      document.body.appendChild(this.canvas);
    }
    
    const contextAttributes: WebGLContextAttributes = {
      alpha: this.config.alpha ?? true,
      depth: this.config.depth ?? true,
      stencil: this.config.stencil ?? false,
      antialias: this.config.antialias ?? true,
      premultipliedAlpha: this.config.premultipliedAlpha ?? true,
      preserveDrawingBuffer: this.config.preserveDrawingBuffer ?? false,
      powerPreference: this.config.powerPreference ?? 'high-performance'
    };
    
    if (this.config.webgl2 !== false) {
      this.gl = this.canvas.getContext('webgl2', contextAttributes) as WebGL2RenderingContext;
      if (this.gl) {
        this.isWebGL2 = true;
        this.logger.info('WebGL 2.0 context created');
      }
    }
    
    if (!this.gl) {
      this.gl = this.canvas.getContext('webgl', contextAttributes) as WebGLRenderingContext;
      if (!this.gl) {
        this.gl = this.canvas.getContext('experimental-webgl', contextAttributes) as WebGLRenderingContext;
      }
      
      if (this.gl) {
        this.isWebGL2 = false;
        this.logger.info('WebGL 1.0 context created');
      } else {
        throw new Error('WebGL is not supported in this browser');
      }
    }
    
    this.canvas.addEventListener('webglcontextlost', this.onContextLost);
    this.canvas.addEventListener('webglcontextrestored', this.onContextRestored);
    
    this.logContextInfo();
    this.events.emit('initialized');
  }

  private logContextInfo(): void {
    if (!this.gl) return;
    const gl = this.gl;
    const info = {
      version: gl.getParameter(gl.VERSION),
      vendor: gl.getParameter(gl.VENDOR),
      renderer: gl.getParameter(gl.RENDERER)
    };
    this.logger.info('WebGL Context Info', info);
  }

  private onContextLost = (event: Event): void => {
    event.preventDefault();
    this.contextLost = true;
    this.events.emit('context-lost');
    this.logger.warn('WebGL context lost');
  };

  private onContextRestored = (): void => {
    this.contextLost = false;
    this.events.emit('context-restored');
    this.logger.info('WebGL context restored');
  };

  isContextLost(): boolean {
    return this.contextLost || this.gl?.isContextLost() || false;
  }

  getWidth(): number {
    return this.canvas?.width || 0;
  }

  getHeight(): number {
    return this.canvas?.height || 0;
  }

  getAspectRatio(): number {
    const width = this.getWidth();
    const height = this.getHeight();
    return height > 0 ? width / height : 1;
  }

  resize(width: number, height: number): void {
    if (this.canvas) {
      this.canvas.width = width;
      this.canvas.height = height;
      if (this.gl) {
        this.gl.viewport(0, 0, width, height);
      }
      this.events.emit('resize', { width, height });
    }
  }

  setViewport(x: number, y: number, width: number, height: number): void {
    if (this.gl) {
      this.gl.viewport(x, y, width, height);
    }
  }

  clear(r: number = 0, g: number = 0, b: number = 0, a: number = 1): void {
    if (this.gl) {
      this.gl.clearColor(r, g, b, a);
      this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
    }
  }

  getEvents(): EventSystem {
    return this.events;
  }

  destroy(): void {
    if (this.canvas) {
      this.canvas.removeEventListener('webglcontextlost', this.onContextLost);
      this.canvas.removeEventListener('webglcontextrestored', this.onContextRestored);
    }
    if (this.gl) {
      const loseContext = this.gl.getExtension('WEBGL_lose_context');
      if (loseContext) {
        loseContext.loseContext();
      }
    }
    this.gl = null;
    this.canvas = null;
    this.events.clear();
  }

  /**
   * Gets the raw WebGL context
   */
  getGL(): WebGLRenderingContext | WebGL2RenderingContext {
    if (!this.gl) {
      throw new Error('WebGL context not initialized');
    }
    return this.gl;
  }

  /**
   * Sets clear color
   */
  setClearColor(r: number, g: number, b: number, a: number): void {
    if (this.gl) {
      this.gl.clearColor(r, g, b, a);
    }
  }
}
