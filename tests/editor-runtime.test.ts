/**
 * Editor Runtime Test
 * Actually loads and runs the editor to catch real errors
 */
import { describe, it, expect, beforeAll, vi } from 'vitest';

// Mock canvas and WebGL
beforeAll(() => {
    // Mock canvas getContext
    HTMLCanvasElement.prototype.getContext = vi.fn((type) => {
        if (type === 'webgl' || type === 'webgl2') {
            return {
                canvas: document.createElement('canvas'),
                getExtension: vi.fn((name) => {
                    if (name === 'OES_vertex_array_object') {
                        return {
                            createVertexArrayOES: vi.fn(() => ({})),
                            bindVertexArrayOES: vi.fn(),
                            deleteVertexArrayOES: vi.fn()
                        };
                    }
                    return null;
                }),
                getParameter: vi.fn(() => 16),
                createShader: vi.fn(() => ({})),
                shaderSource: vi.fn(),
                compileShader: vi.fn(),
                getShaderParameter: vi.fn(() => true),
                createProgram: vi.fn(() => ({})),
                attachShader: vi.fn(),
                linkProgram: vi.fn(),
                getProgramParameter: vi.fn(() => true),
                useProgram: vi.fn(),
                getAttribLocation: vi.fn(() => 0),
                getUniformLocation: vi.fn(() => ({})),
                enableVertexAttribArray: vi.fn(),
                createBuffer: vi.fn(() => ({})),
                bindBuffer: vi.fn(),
                bufferData: vi.fn(),
                vertexAttribPointer: vi.fn(),
                uniformMatrix4fv: vi.fn(),
                uniform1f: vi.fn(),
                uniform3fv: vi.fn(),
                uniform4fv: vi.fn(),
                drawArrays: vi.fn(),
                drawElements: vi.fn(),
                clear: vi.fn(),
                clearColor: vi.fn(),
                enable: vi.fn(),
                disable: vi.fn(),
                viewport: vi.fn(),
                deleteShader: vi.fn(),
                deleteProgram: vi.fn(),
                deleteBuffer: vi.fn(),
                // VAO methods (WebGL2)
                createVertexArray: vi.fn(() => ({})),
                bindVertexArray: vi.fn(),
                deleteVertexArray: vi.fn(),
                // Other WebGL2 methods
                createFramebuffer: vi.fn(() => ({})),
                bindFramebuffer: vi.fn(),
                deleteFramebuffer: vi.fn(),
                createTexture: vi.fn(() => ({})),
                bindTexture: vi.fn(),
                deleteTexture: vi.fn(),
                texImage2D: vi.fn(),
                texParameteri: vi.fn(),
                activeTexture: vi.fn(),
                framebufferTexture2D: vi.fn(),
                checkFramebufferStatus: vi.fn(() => 36053), // FRAMEBUFFER_COMPLETE
                isContextLost: vi.fn(() => false),
            };
        }
        if (type === '2d') {
            return {
                fillRect: vi.fn(),
                clearRect: vi.fn(),
                fillText: vi.fn(),
                measureText: vi.fn(() => ({ width: 10 })),
                beginPath: vi.fn(),
                moveTo: vi.fn(),
                lineTo: vi.fn(),
                stroke: vi.fn(),
                fill: vi.fn(),
                arc: vi.fn(),
                save: vi.fn(),
                restore: vi.fn(),
                translate: vi.fn(),
                rotate: vi.fn(),
                scale: vi.fn(),
            };
        }
        return null;
    });
});

describe('Editor Runtime Tests', () => {
    it('should import all core modules without error', async () => {
        const errors: Error[] = [];
        
        try {
            const modules = await import('../src/index');
            expect(modules).toBeDefined();
            expect(modules.Vector3).toBeDefined();
            expect(modules.EditorApplication).toBeDefined();
            expect(modules.getLiveDebugger).toBeDefined();
            expect(modules.getDevCenter).toBeDefined();
            expect(modules.getDevTools).toBeDefined();
        } catch (e) {
            errors.push(e as Error);
        }
        
        if (errors.length > 0) {
            console.error('IMPORT ERRORS:', errors);
        }
        expect(errors).toHaveLength(0);
    });
    
    it('should create EditorApplication without error', async () => {
        const { EditorApplication } = await import('../src/index');
        
        const canvas = document.createElement('canvas');
        canvas.id = 'test-canvas';
        document.body.appendChild(canvas);
        
        let error: Error | null = null;
        let editor: InstanceType<typeof EditorApplication> | null = null;
        
        try {
            editor = new EditorApplication({
                canvas: canvas,
                debug: true,
                createDemoScene: false
            });
            expect(editor).toBeDefined();
        } catch (e) {
            error = e as Error;
            console.error('EDITOR CREATE ERROR:', e);
        }
        
        expect(error).toBeNull();
    });
    
    it('should initialize EditorApplication without error', async () => {
        const { EditorApplication } = await import('../src/index');
        
        const canvas = document.createElement('canvas');
        canvas.width = 800;
        canvas.height = 600;
        document.body.appendChild(canvas);
        
        const editor = new EditorApplication({
            canvas: canvas,
            debug: true,
            createDemoScene: false
        });
        
        let error: Error | null = null;
        
        try {
            await editor.initialize();
        } catch (e) {
            error = e as Error;
            console.error('EDITOR INIT ERROR:', error.message);
            console.error('STACK:', error.stack);
        }
        
        expect(error).toBeNull();
    });
    
    it('should initialize DevCenter without error', async () => {
        const { getDevCenter } = await import('../src/index');
        
        let error: Error | null = null;
        
        try {
            const devCenter = getDevCenter({
                autoStart: true,
                autoShowOnError: true
            });
            expect(devCenter).toBeDefined();
            expect(devCenter.isActive()).toBe(true);
        } catch (e) {
            error = e as Error;
            console.error('DEVCENTER ERROR:', e);
        }
        
        expect(error).toBeNull();
    });
    
    it('should initialize LiveDebugger without error', async () => {
        const { getLiveDebugger } = await import('../src/index');
        
        let error: Error | null = null;
        
        try {
            const debugger_ = getLiveDebugger();
            debugger_.initialize();
            expect(debugger_).toBeDefined();
        } catch (e) {
            error = e as Error;
            console.error('LIVEDEBUGGER ERROR:', e);
        }
        
        expect(error).toBeNull();
    });
    
    it('should load all editor panels without error', async () => {
        const panels = await import('../src/editor/panels');
        
        expect(panels.SceneViewPanel).toBeDefined();
        expect(panels.InspectorPanel).toBeDefined();
        expect(panels.HierarchyPanel).toBeDefined();
        expect(panels.ConsolePanel).toBeDefined();
        expect(panels.TerrainPanel).toBeDefined();
    });
});
