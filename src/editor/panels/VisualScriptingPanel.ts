/**
 * @fileoverview Visual Scripting Panel - Node-based programming interface
 * @module editor/panels
 * 
 * Provides a visual node graph editor for creating game logic without code.
 * Integrates with the scripting system for real-time script execution.
 * 
 * @author MrNova420
 * @license MIT
 */

import { Panel } from '../Panel';
import { Logger } from '../../core/Logger';

/**
 * Node connection point type
 */
export enum VSPortType {
    EXEC = 'exec',       // Execution flow
    BOOL = 'bool',
    INT = 'int',
    FLOAT = 'float',
    STRING = 'string',
    VECTOR2 = 'vector2',
    VECTOR3 = 'vector3',
    OBJECT = 'object',
    ANY = 'any'
}

/**
 * Node port direction
 */
export enum VSPortDirection {
    INPUT = 'input',
    OUTPUT = 'output'
}

/**
 * Port definition
 */
export interface VSNodePort {
    id: string;
    name: string;
    type: VSPortType;
    direction: VSPortDirection;
    connected: boolean;
    connectedTo?: string; // port ID
    defaultValue?: any;
}

/**
 * Visual script node
 */
export interface VSScriptNode {
    id: string;
    type: string;
    name: string;
    category: string;
    x: number;
    y: number;
    width: number;
    height: number;
    ports: VSNodePort[];
    properties: Map<string, any>;
    selected: boolean;
}

/**
 * Connection between nodes
 */
export interface VSNodeConnection {
    id: string;
    sourceNode: string;
    sourcePort: string;
    targetNode: string;
    targetPort: string;
}

/**
 * Node library category
 */
export interface VSNodeCategory {
    name: string;
    icon: string;
    nodes: VSNodeDefinition[];
}

/**
 * Node definition template
 */
export interface VSNodeDefinition {
    type: string;
    name: string;
    category: string;
    description: string;
    color: string;
    inputs: Omit<VSNodePort, 'id' | 'connected' | 'connectedTo'>[];
    outputs: Omit<VSNodePort, 'id' | 'connected' | 'connectedTo'>[];
    properties?: { name: string; type: VSPortType; default: any }[];
}

/**
 * Visual Scripting Panel
 * 
 * Provides a node-based visual programming interface.
 */
export class VisualScriptingPanel extends Panel {
    private logger: Logger;
    
    // Canvas rendering
    private canvas: HTMLCanvasElement | null = null;
    private ctx: CanvasRenderingContext2D | null = null;
    
    // Graph state
    private nodes: Map<string, VSScriptNode> = new Map();
    private connections: Map<string, VSNodeConnection> = new Map();
    private nodeCounter: number = 0;
    
    // View state
    private panX: number = 0;
    private panY: number = 0;
    private zoom: number = 1;
    private isPanning: boolean = false;
    private isConnecting: boolean = false;
    private connectingPort: { node: string; port: string } | null = null;
    
    // Selection
    private selectedNodes: Set<string> = new Set();
    private draggedNode: string | null = null;
    private dragOffsetX: number = 0;
    private dragOffsetY: number = 0;
    
    // Mouse state
    private lastMouseX: number = 0;
    private lastMouseY: number = 0;
    
    // Node library
    private nodeLibrary: VSNodeCategory[] = [];
    
    // Colors
    private readonly COLORS = {
        background: '#1a1a2e',
        gridMajor: '#2a2a4e',
        gridMinor: '#222238',
        node: '#2d2d44',
        nodeHeader: '#3d3d5c',
        nodeSelected: '#5a5a8a',
        nodeBorder: '#4a4a6a',
        text: '#ffffff',
        textMuted: '#aaaacc',
        portExec: '#ffffff',
        portBool: '#ff4444',
        portInt: '#44ff88',
        portFloat: '#44aaff',
        portString: '#ff88ff',
        portVector: '#ffaa44',
        portObject: '#aa88ff',
        connection: '#88aaff',
        connectionExec: '#ffffff'
    };
    
    constructor() {
        super('visual-scripting', 'Visual Scripting');
        this.logger = new Logger('VisualScriptingPanel');
        this.initializeNodeLibrary();
    }
    
    /**
     * Initialize the node library with built-in nodes
     */
    private initializeNodeLibrary(): void {
        this.nodeLibrary = [
            {
                name: 'Events',
                icon: '⚡',
                nodes: [
                    {
                        type: 'event_start',
                        name: 'On Start',
                        category: 'Events',
                        description: 'Called when the game starts',
                        color: '#cc4444',
                        inputs: [],
                        outputs: [
                            { name: '', type: VSPortType.EXEC, direction: VSPortDirection.OUTPUT }
                        ]
                    },
                    {
                        type: 'event_update',
                        name: 'On Update',
                        category: 'Events',
                        description: 'Called every frame',
                        color: '#cc4444',
                        inputs: [],
                        outputs: [
                            { name: '', type: VSPortType.EXEC, direction: VSPortDirection.OUTPUT },
                            { name: 'Delta Time', type: VSPortType.FLOAT, direction: VSPortDirection.OUTPUT }
                        ]
                    },
                    {
                        type: 'event_collision',
                        name: 'On Collision',
                        category: 'Events',
                        description: 'Called when colliding with another object',
                        color: '#cc4444',
                        inputs: [],
                        outputs: [
                            { name: '', type: VSPortType.EXEC, direction: VSPortDirection.OUTPUT },
                            { name: 'Other', type: VSPortType.OBJECT, direction: VSPortDirection.OUTPUT }
                        ]
                    },
                    {
                        type: 'event_key',
                        name: 'On Key',
                        category: 'Events',
                        description: 'Called when a key is pressed/released',
                        color: '#cc4444',
                        inputs: [],
                        outputs: [
                            { name: 'Pressed', type: VSPortType.EXEC, direction: VSPortDirection.OUTPUT },
                            { name: 'Released', type: VSPortType.EXEC, direction: VSPortDirection.OUTPUT }
                        ],
                        properties: [
                            { name: 'Key', type: VSPortType.STRING, default: 'Space' }
                        ]
                    }
                ]
            },
            {
                name: 'Flow Control',
                icon: '🔀',
                nodes: [
                    {
                        type: 'branch',
                        name: 'Branch',
                        category: 'Flow Control',
                        description: 'If/else conditional',
                        color: '#666666',
                        inputs: [
                            { name: '', type: VSPortType.EXEC, direction: VSPortDirection.INPUT },
                            { name: 'Condition', type: VSPortType.BOOL, direction: VSPortDirection.INPUT }
                        ],
                        outputs: [
                            { name: 'True', type: VSPortType.EXEC, direction: VSPortDirection.OUTPUT },
                            { name: 'False', type: VSPortType.EXEC, direction: VSPortDirection.OUTPUT }
                        ]
                    },
                    {
                        type: 'sequence',
                        name: 'Sequence',
                        category: 'Flow Control',
                        description: 'Execute multiple paths in order',
                        color: '#666666',
                        inputs: [
                            { name: '', type: VSPortType.EXEC, direction: VSPortDirection.INPUT }
                        ],
                        outputs: [
                            { name: 'Then 0', type: VSPortType.EXEC, direction: VSPortDirection.OUTPUT },
                            { name: 'Then 1', type: VSPortType.EXEC, direction: VSPortDirection.OUTPUT }
                        ]
                    },
                    {
                        type: 'for_loop',
                        name: 'For Loop',
                        category: 'Flow Control',
                        description: 'Loop a set number of times',
                        color: '#666666',
                        inputs: [
                            { name: '', type: VSPortType.EXEC, direction: VSPortDirection.INPUT },
                            { name: 'Start', type: VSPortType.INT, direction: VSPortDirection.INPUT, defaultValue: 0 },
                            { name: 'End', type: VSPortType.INT, direction: VSPortDirection.INPUT, defaultValue: 10 }
                        ],
                        outputs: [
                            { name: 'Loop Body', type: VSPortType.EXEC, direction: VSPortDirection.OUTPUT },
                            { name: 'Completed', type: VSPortType.EXEC, direction: VSPortDirection.OUTPUT },
                            { name: 'Index', type: VSPortType.INT, direction: VSPortDirection.OUTPUT }
                        ]
                    },
                    {
                        type: 'delay',
                        name: 'Delay',
                        category: 'Flow Control',
                        description: 'Wait for a duration before continuing',
                        color: '#666666',
                        inputs: [
                            { name: '', type: VSPortType.EXEC, direction: VSPortDirection.INPUT },
                            { name: 'Duration', type: VSPortType.FLOAT, direction: VSPortDirection.INPUT, defaultValue: 1.0 }
                        ],
                        outputs: [
                            { name: 'Completed', type: VSPortType.EXEC, direction: VSPortDirection.OUTPUT }
                        ]
                    }
                ]
            },
            {
                name: 'Math',
                icon: '🔢',
                nodes: [
                    {
                        type: 'math_add',
                        name: 'Add',
                        category: 'Math',
                        description: 'Add two numbers',
                        color: '#44aa44',
                        inputs: [
                            { name: 'A', type: VSPortType.FLOAT, direction: VSPortDirection.INPUT, defaultValue: 0 },
                            { name: 'B', type: VSPortType.FLOAT, direction: VSPortDirection.INPUT, defaultValue: 0 }
                        ],
                        outputs: [
                            { name: 'Result', type: VSPortType.FLOAT, direction: VSPortDirection.OUTPUT }
                        ]
                    },
                    {
                        type: 'math_subtract',
                        name: 'Subtract',
                        category: 'Math',
                        description: 'Subtract two numbers',
                        color: '#44aa44',
                        inputs: [
                            { name: 'A', type: VSPortType.FLOAT, direction: VSPortDirection.INPUT },
                            { name: 'B', type: VSPortType.FLOAT, direction: VSPortDirection.INPUT }
                        ],
                        outputs: [
                            { name: 'Result', type: VSPortType.FLOAT, direction: VSPortDirection.OUTPUT }
                        ]
                    },
                    {
                        type: 'math_multiply',
                        name: 'Multiply',
                        category: 'Math',
                        description: 'Multiply two numbers',
                        color: '#44aa44',
                        inputs: [
                            { name: 'A', type: VSPortType.FLOAT, direction: VSPortDirection.INPUT, defaultValue: 1 },
                            { name: 'B', type: VSPortType.FLOAT, direction: VSPortDirection.INPUT, defaultValue: 1 }
                        ],
                        outputs: [
                            { name: 'Result', type: VSPortType.FLOAT, direction: VSPortDirection.OUTPUT }
                        ]
                    },
                    {
                        type: 'math_divide',
                        name: 'Divide',
                        category: 'Math',
                        description: 'Divide two numbers',
                        color: '#44aa44',
                        inputs: [
                            { name: 'A', type: VSPortType.FLOAT, direction: VSPortDirection.INPUT },
                            { name: 'B', type: VSPortType.FLOAT, direction: VSPortDirection.INPUT, defaultValue: 1 }
                        ],
                        outputs: [
                            { name: 'Result', type: VSPortType.FLOAT, direction: VSPortDirection.OUTPUT }
                        ]
                    },
                    {
                        type: 'math_lerp',
                        name: 'Lerp',
                        category: 'Math',
                        description: 'Linear interpolation',
                        color: '#44aa44',
                        inputs: [
                            { name: 'A', type: VSPortType.FLOAT, direction: VSPortDirection.INPUT },
                            { name: 'B', type: VSPortType.FLOAT, direction: VSPortDirection.INPUT },
                            { name: 'Alpha', type: VSPortType.FLOAT, direction: VSPortDirection.INPUT, defaultValue: 0.5 }
                        ],
                        outputs: [
                            { name: 'Result', type: VSPortType.FLOAT, direction: VSPortDirection.OUTPUT }
                        ]
                    },
                    {
                        type: 'math_random',
                        name: 'Random',
                        category: 'Math',
                        description: 'Random number in range',
                        color: '#44aa44',
                        inputs: [
                            { name: 'Min', type: VSPortType.FLOAT, direction: VSPortDirection.INPUT, defaultValue: 0 },
                            { name: 'Max', type: VSPortType.FLOAT, direction: VSPortDirection.INPUT, defaultValue: 1 }
                        ],
                        outputs: [
                            { name: 'Value', type: VSPortType.FLOAT, direction: VSPortDirection.OUTPUT }
                        ]
                    }
                ]
            },
            {
                name: 'Vector',
                icon: '📐',
                nodes: [
                    {
                        type: 'vector3_make',
                        name: 'Make Vector3',
                        category: 'Vector',
                        description: 'Create a Vector3 from components',
                        color: '#ffaa44',
                        inputs: [
                            { name: 'X', type: VSPortType.FLOAT, direction: VSPortDirection.INPUT, defaultValue: 0 },
                            { name: 'Y', type: VSPortType.FLOAT, direction: VSPortDirection.INPUT, defaultValue: 0 },
                            { name: 'Z', type: VSPortType.FLOAT, direction: VSPortDirection.INPUT, defaultValue: 0 }
                        ],
                        outputs: [
                            { name: 'Vector', type: VSPortType.VECTOR3, direction: VSPortDirection.OUTPUT }
                        ]
                    },
                    {
                        type: 'vector3_break',
                        name: 'Break Vector3',
                        category: 'Vector',
                        description: 'Split Vector3 into components',
                        color: '#ffaa44',
                        inputs: [
                            { name: 'Vector', type: VSPortType.VECTOR3, direction: VSPortDirection.INPUT }
                        ],
                        outputs: [
                            { name: 'X', type: VSPortType.FLOAT, direction: VSPortDirection.OUTPUT },
                            { name: 'Y', type: VSPortType.FLOAT, direction: VSPortDirection.OUTPUT },
                            { name: 'Z', type: VSPortType.FLOAT, direction: VSPortDirection.OUTPUT }
                        ]
                    },
                    {
                        type: 'vector3_add',
                        name: 'Add Vectors',
                        category: 'Vector',
                        description: 'Add two vectors',
                        color: '#ffaa44',
                        inputs: [
                            { name: 'A', type: VSPortType.VECTOR3, direction: VSPortDirection.INPUT },
                            { name: 'B', type: VSPortType.VECTOR3, direction: VSPortDirection.INPUT }
                        ],
                        outputs: [
                            { name: 'Result', type: VSPortType.VECTOR3, direction: VSPortDirection.OUTPUT }
                        ]
                    },
                    {
                        type: 'vector3_normalize',
                        name: 'Normalize',
                        category: 'Vector',
                        description: 'Normalize a vector',
                        color: '#ffaa44',
                        inputs: [
                            { name: 'Vector', type: VSPortType.VECTOR3, direction: VSPortDirection.INPUT }
                        ],
                        outputs: [
                            { name: 'Result', type: VSPortType.VECTOR3, direction: VSPortDirection.OUTPUT }
                        ]
                    }
                ]
            },
            {
                name: 'Transform',
                icon: '🔄',
                nodes: [
                    {
                        type: 'get_position',
                        name: 'Get Position',
                        category: 'Transform',
                        description: 'Get object position',
                        color: '#4488cc',
                        inputs: [
                            { name: 'Object', type: VSPortType.OBJECT, direction: VSPortDirection.INPUT }
                        ],
                        outputs: [
                            { name: 'Position', type: VSPortType.VECTOR3, direction: VSPortDirection.OUTPUT }
                        ]
                    },
                    {
                        type: 'set_position',
                        name: 'Set Position',
                        category: 'Transform',
                        description: 'Set object position',
                        color: '#4488cc',
                        inputs: [
                            { name: '', type: VSPortType.EXEC, direction: VSPortDirection.INPUT },
                            { name: 'Object', type: VSPortType.OBJECT, direction: VSPortDirection.INPUT },
                            { name: 'Position', type: VSPortType.VECTOR3, direction: VSPortDirection.INPUT }
                        ],
                        outputs: [
                            { name: '', type: VSPortType.EXEC, direction: VSPortDirection.OUTPUT }
                        ]
                    },
                    {
                        type: 'translate',
                        name: 'Translate',
                        category: 'Transform',
                        description: 'Move object by offset',
                        color: '#4488cc',
                        inputs: [
                            { name: '', type: VSPortType.EXEC, direction: VSPortDirection.INPUT },
                            { name: 'Object', type: VSPortType.OBJECT, direction: VSPortDirection.INPUT },
                            { name: 'Offset', type: VSPortType.VECTOR3, direction: VSPortDirection.INPUT }
                        ],
                        outputs: [
                            { name: '', type: VSPortType.EXEC, direction: VSPortDirection.OUTPUT }
                        ]
                    },
                    {
                        type: 'rotate',
                        name: 'Rotate',
                        category: 'Transform',
                        description: 'Rotate object',
                        color: '#4488cc',
                        inputs: [
                            { name: '', type: VSPortType.EXEC, direction: VSPortDirection.INPUT },
                            { name: 'Object', type: VSPortType.OBJECT, direction: VSPortDirection.INPUT },
                            { name: 'Euler', type: VSPortType.VECTOR3, direction: VSPortDirection.INPUT }
                        ],
                        outputs: [
                            { name: '', type: VSPortType.EXEC, direction: VSPortDirection.OUTPUT }
                        ]
                    }
                ]
            },
            {
                name: 'Comparison',
                icon: '⚖️',
                nodes: [
                    {
                        type: 'compare_equal',
                        name: 'Equal',
                        category: 'Comparison',
                        description: 'Check if values are equal',
                        color: '#8844cc',
                        inputs: [
                            { name: 'A', type: VSPortType.ANY, direction: VSPortDirection.INPUT },
                            { name: 'B', type: VSPortType.ANY, direction: VSPortDirection.INPUT }
                        ],
                        outputs: [
                            { name: 'Result', type: VSPortType.BOOL, direction: VSPortDirection.OUTPUT }
                        ]
                    },
                    {
                        type: 'compare_greater',
                        name: 'Greater Than',
                        category: 'Comparison',
                        description: 'Check if A > B',
                        color: '#8844cc',
                        inputs: [
                            { name: 'A', type: VSPortType.FLOAT, direction: VSPortDirection.INPUT },
                            { name: 'B', type: VSPortType.FLOAT, direction: VSPortDirection.INPUT }
                        ],
                        outputs: [
                            { name: 'Result', type: VSPortType.BOOL, direction: VSPortDirection.OUTPUT }
                        ]
                    },
                    {
                        type: 'compare_less',
                        name: 'Less Than',
                        category: 'Comparison',
                        description: 'Check if A < B',
                        color: '#8844cc',
                        inputs: [
                            { name: 'A', type: VSPortType.FLOAT, direction: VSPortDirection.INPUT },
                            { name: 'B', type: VSPortType.FLOAT, direction: VSPortDirection.INPUT }
                        ],
                        outputs: [
                            { name: 'Result', type: VSPortType.BOOL, direction: VSPortDirection.OUTPUT }
                        ]
                    },
                    {
                        type: 'bool_and',
                        name: 'AND',
                        category: 'Comparison',
                        description: 'Logical AND',
                        color: '#8844cc',
                        inputs: [
                            { name: 'A', type: VSPortType.BOOL, direction: VSPortDirection.INPUT },
                            { name: 'B', type: VSPortType.BOOL, direction: VSPortDirection.INPUT }
                        ],
                        outputs: [
                            { name: 'Result', type: VSPortType.BOOL, direction: VSPortDirection.OUTPUT }
                        ]
                    },
                    {
                        type: 'bool_or',
                        name: 'OR',
                        category: 'Comparison',
                        description: 'Logical OR',
                        color: '#8844cc',
                        inputs: [
                            { name: 'A', type: VSPortType.BOOL, direction: VSPortDirection.INPUT },
                            { name: 'B', type: VSPortType.BOOL, direction: VSPortDirection.INPUT }
                        ],
                        outputs: [
                            { name: 'Result', type: VSPortType.BOOL, direction: VSPortDirection.OUTPUT }
                        ]
                    },
                    {
                        type: 'bool_not',
                        name: 'NOT',
                        category: 'Comparison',
                        description: 'Logical NOT',
                        color: '#8844cc',
                        inputs: [
                            { name: 'Value', type: VSPortType.BOOL, direction: VSPortDirection.INPUT }
                        ],
                        outputs: [
                            { name: 'Result', type: VSPortType.BOOL, direction: VSPortDirection.OUTPUT }
                        ]
                    }
                ]
            },
            {
                name: 'Variables',
                icon: '📦',
                nodes: [
                    {
                        type: 'var_get',
                        name: 'Get Variable',
                        category: 'Variables',
                        description: 'Get a variable value',
                        color: '#cc8844',
                        inputs: [],
                        outputs: [
                            { name: 'Value', type: VSPortType.ANY, direction: VSPortDirection.OUTPUT }
                        ],
                        properties: [
                            { name: 'Variable Name', type: VSPortType.STRING, default: 'myVar' }
                        ]
                    },
                    {
                        type: 'var_set',
                        name: 'Set Variable',
                        category: 'Variables',
                        description: 'Set a variable value',
                        color: '#cc8844',
                        inputs: [
                            { name: '', type: VSPortType.EXEC, direction: VSPortDirection.INPUT },
                            { name: 'Value', type: VSPortType.ANY, direction: VSPortDirection.INPUT }
                        ],
                        outputs: [
                            { name: '', type: VSPortType.EXEC, direction: VSPortDirection.OUTPUT }
                        ],
                        properties: [
                            { name: 'Variable Name', type: VSPortType.STRING, default: 'myVar' }
                        ]
                    }
                ]
            },
            {
                name: 'Debug',
                icon: '🐛',
                nodes: [
                    {
                        type: 'print',
                        name: 'Print',
                        category: 'Debug',
                        description: 'Print to console',
                        color: '#cc4488',
                        inputs: [
                            { name: '', type: VSPortType.EXEC, direction: VSPortDirection.INPUT },
                            { name: 'Message', type: VSPortType.STRING, direction: VSPortDirection.INPUT }
                        ],
                        outputs: [
                            { name: '', type: VSPortType.EXEC, direction: VSPortDirection.OUTPUT }
                        ]
                    },
                    {
                        type: 'print_value',
                        name: 'Print Value',
                        category: 'Debug',
                        description: 'Print any value to console',
                        color: '#cc4488',
                        inputs: [
                            { name: '', type: VSPortType.EXEC, direction: VSPortDirection.INPUT },
                            { name: 'Value', type: VSPortType.ANY, direction: VSPortDirection.INPUT }
                        ],
                        outputs: [
                            { name: '', type: VSPortType.EXEC, direction: VSPortDirection.OUTPUT }
                        ]
                    }
                ]
            }
        ];
    }
    
    /**
     * Render method called by base Panel class
     */
    protected onMount(_container: HTMLElement): void {
        if (!this.container) return;
        
        this.container.innerHTML = `
            <div class="vs-container">
                <div class="vs-toolbar">
                    <button class="vs-btn" id="vs-compile" title="Compile Script">▶ Compile</button>
                    <button class="vs-btn" id="vs-add-node" title="Add Node">+ Add Node</button>
                    <button class="vs-btn" id="vs-delete" title="Delete Selected">✗ Delete</button>
                    <div class="vs-spacer"></div>
                    <button class="vs-btn" id="vs-zoom-fit" title="Fit to View">⊡</button>
                    <span class="vs-zoom-label">Zoom: <span id="vs-zoom-value">100%</span></span>
                </div>
                <div class="vs-content">
                    <div class="vs-sidebar" id="vs-node-library">
                        <div class="vs-library-header">Node Library</div>
                        <div class="vs-library-search">
                            <input type="text" placeholder="Search nodes..." id="vs-search">
                        </div>
                        <div class="vs-library-categories" id="vs-categories">
                            <!-- Categories populated by code -->
                        </div>
                    </div>
                    <div class="vs-graph">
                        <canvas id="vs-canvas"></canvas>
                    </div>
                </div>
            </div>
        `;
        
        this.setupStyles();
        this.setupCanvas();
        this.setupLibrary();
        this.setupEvents();
    }
    
    /**
     * Setup CSS styles
     */
    private setupStyles(): void {
        if (!this.container) return;
        
        const style = document.createElement('style');
        style.textContent = `
            .vs-container {
                display: flex;
                flex-direction: column;
                height: 100%;
                background: ${this.COLORS.background};
            }
            .vs-toolbar {
                display: flex;
                align-items: center;
                padding: 4px 8px;
                background: #252538;
                border-bottom: 1px solid #3a3a5a;
                gap: 4px;
            }
            .vs-btn {
                padding: 4px 10px;
                background: #3a3a5a;
                border: 1px solid #4a4a6a;
                border-radius: 4px;
                color: #ffffff;
                cursor: pointer;
                font-size: 12px;
            }
            .vs-btn:hover {
                background: #4a4a6a;
            }
            .vs-spacer {
                flex: 1;
            }
            .vs-zoom-label {
                font-size: 11px;
                color: #8888aa;
                margin-left: 8px;
            }
            .vs-content {
                display: flex;
                flex: 1;
                overflow: hidden;
            }
            .vs-sidebar {
                width: 200px;
                background: #202030;
                border-right: 1px solid #3a3a5a;
                display: flex;
                flex-direction: column;
            }
            .vs-library-header {
                padding: 8px 12px;
                font-weight: bold;
                font-size: 12px;
                background: #252538;
                border-bottom: 1px solid #3a3a5a;
            }
            .vs-library-search input {
                width: 100%;
                padding: 6px 10px;
                background: #1a1a2e;
                border: none;
                border-bottom: 1px solid #3a3a5a;
                color: #ffffff;
                font-size: 12px;
            }
            .vs-library-categories {
                flex: 1;
                overflow-y: auto;
            }
            .vs-category {
                border-bottom: 1px solid #2a2a4e;
            }
            .vs-category-header {
                padding: 6px 10px;
                cursor: pointer;
                display: flex;
                align-items: center;
                gap: 6px;
                font-size: 12px;
            }
            .vs-category-header:hover {
                background: #2a2a4e;
            }
            .vs-category-items {
                display: none;
                padding-left: 20px;
            }
            .vs-category.expanded .vs-category-items {
                display: block;
            }
            .vs-node-item {
                padding: 4px 10px;
                font-size: 11px;
                cursor: pointer;
                color: #aaaacc;
            }
            .vs-node-item:hover {
                background: #2a2a4e;
                color: #ffffff;
            }
            .vs-graph {
                flex: 1;
                position: relative;
            }
            #vs-canvas {
                width: 100%;
                height: 100%;
                display: block;
            }
        `;
        this.container.appendChild(style);
    }
    
    /**
     * Setup canvas for node graph rendering
     */
    private setupCanvas(): void {
        this.canvas = this.container?.querySelector('#vs-canvas') as HTMLCanvasElement;
        if (!this.canvas) return;
        
        this.ctx = this.canvas.getContext('2d');
        
        // Set canvas size
        const parent = this.canvas.parentElement;
        if (parent) {
            this.canvas.width = parent.clientWidth;
            this.canvas.height = parent.clientHeight;
        }
        
        // Initial render
        this.renderGraph();
    }
    
    /**
     * Setup node library UI
     */
    private setupLibrary(): void {
        const container = this.container?.querySelector('#vs-categories');
        if (!container) return;
        
        let html = '';
        for (const category of this.nodeLibrary) {
            html += `
                <div class="vs-category" data-category="${category.name}">
                    <div class="vs-category-header">
                        <span>${category.icon}</span>
                        <span>${category.name}</span>
                    </div>
                    <div class="vs-category-items">
            `;
            for (const node of category.nodes) {
                html += `<div class="vs-node-item" data-type="${node.type}">${node.name}</div>`;
            }
            html += '</div></div>';
        }
        container.innerHTML = html;
        
        // Category expand/collapse
        container.querySelectorAll('.vs-category-header').forEach(header => {
            header.addEventListener('click', () => {
                header.parentElement?.classList.toggle('expanded');
            });
        });
        
        // Node drag to add
        container.querySelectorAll('.vs-node-item').forEach(item => {
            item.addEventListener('dblclick', () => {
                const type = (item as HTMLElement).dataset.type;
                if (type) {
                    this.addNodeOfType(type, this.canvas!.width / 2 - this.panX, this.canvas!.height / 2 - this.panY);
                }
            });
        });
    }
    
    /**
     * Setup event handlers
     */
    private setupEvents(): void {
        if (!this.canvas) return;
        
        // Mouse events
        this.canvas.addEventListener('mousedown', this.onMouseDown.bind(this));
        this.canvas.addEventListener('mousemove', this.onMouseMove.bind(this));
        this.canvas.addEventListener('mouseup', this.onMouseUp.bind(this));
        this.canvas.addEventListener('wheel', this.onWheel.bind(this));
        this.canvas.addEventListener('contextmenu', e => e.preventDefault());
        
        // Keyboard
        window.addEventListener('keydown', this.onKeyDown.bind(this));
        
        // Resize
        window.addEventListener('resize', () => {
            if (this.canvas && this.canvas.parentElement) {
                this.canvas.width = this.canvas.parentElement.clientWidth;
                this.canvas.height = this.canvas.parentElement.clientHeight;
                this.renderGraph();
            }
        });
        
        // Toolbar buttons
        this.container?.querySelector('#vs-add-node')?.addEventListener('click', () => {
            // Toggle sidebar visibility or focus search
            const sidebar = this.container?.querySelector('.vs-sidebar');
            if (sidebar) {
                sidebar.classList.toggle('hidden');
            }
        });
        
        this.container?.querySelector('#vs-delete')?.addEventListener('click', () => {
            this.deleteSelected();
        });
        
        this.container?.querySelector('#vs-zoom-fit')?.addEventListener('click', () => {
            this.fitToView();
        });
        
        this.container?.querySelector('#vs-compile')?.addEventListener('click', () => {
            this.compileScript();
        });
    }
    
    /**
     * Add a node of specified type
     */
    private addNodeOfType(type: string, x: number, y: number): VSScriptNode | null {
        // Find node definition
        let definition: VSNodeDefinition | undefined;
        for (const category of this.nodeLibrary) {
            definition = category.nodes.find(n => n.type === type);
            if (definition) break;
        }
        
        if (!definition) {
            this.logger.warn(`Unknown node type: ${type}`);
            return null;
        }
        
        // Create node
        const nodeId = `node_${++this.nodeCounter}`;
        const node: VSScriptNode = {
            id: nodeId,
            type: definition.type,
            name: definition.name,
            category: definition.category,
            x: x,
            y: y,
            width: 180,
            height: 60 + Math.max(definition.inputs.length, definition.outputs.length) * 24,
            ports: [],
            properties: new Map(),
            selected: false
        };
        
        // Create input ports
        for (let i = 0; i < definition.inputs.length; i++) {
            const input = definition.inputs[i];
            node.ports.push({
                id: `${nodeId}_in_${i}`,
                name: input.name,
                type: input.type,
                direction: VSPortDirection.INPUT,
                connected: false,
                defaultValue: input.defaultValue
            });
        }
        
        // Create output ports
        for (let i = 0; i < definition.outputs.length; i++) {
            const output = definition.outputs[i];
            node.ports.push({
                id: `${nodeId}_out_${i}`,
                name: output.name,
                type: output.type,
                direction: VSPortDirection.OUTPUT,
                connected: false
            });
        }
        
        // Copy properties
        if (definition.properties) {
            for (const prop of definition.properties) {
                node.properties.set(prop.name, prop.default);
            }
        }
        
        this.nodes.set(nodeId, node);
        this.renderGraph();
        this.events.emit('nodeAdded', node);
        return node;
    }
    
    /**
     * Delete selected nodes
     */
    private deleteSelected(): void {
        for (const nodeId of this.selectedNodes) {
            // Remove connections to/from this node
            for (const [connId, conn] of this.connections) {
                if (conn.sourceNode === nodeId || conn.targetNode === nodeId) {
                    this.connections.delete(connId);
                }
            }
            this.nodes.delete(nodeId);
        }
        this.selectedNodes.clear();
        this.renderGraph();
    }
    
    /**
     * Fit view to show all nodes
     */
    private fitToView(): void {
        if (this.nodes.size === 0) {
            this.panX = 0;
            this.panY = 0;
            this.zoom = 1;
            this.renderGraph();
            return;
        }
        
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;
        
        for (const node of this.nodes.values()) {
            minX = Math.min(minX, node.x);
            maxX = Math.max(maxX, node.x + node.width);
            minY = Math.min(minY, node.y);
            maxY = Math.max(maxY, node.y + node.height);
        }
        
        const padding = 50;
        const graphWidth = maxX - minX + padding * 2;
        const graphHeight = maxY - minY + padding * 2;
        
        if (this.canvas) {
            const scaleX = this.canvas.width / graphWidth;
            const scaleY = this.canvas.height / graphHeight;
            this.zoom = Math.min(scaleX, scaleY, 1);
            
            this.panX = -minX + padding + (this.canvas.width / this.zoom - graphWidth) / 2;
            this.panY = -minY + padding + (this.canvas.height / this.zoom - graphHeight) / 2;
        }
        
        this.updateZoomLabel();
        this.renderGraph();
    }
    
    /**
     * Compile the visual script
     */
    private compileScript(): void {
        this.logger.info('Compiling visual script...');
        
        // TODO: Generate executable code from node graph
        // This would integrate with the backend scripting system
        
        this.events.emit('compiled', {
            nodes: Array.from(this.nodes.values()),
            connections: Array.from(this.connections.values())
        });
    }
    
    /**
     * Mouse down handler
     */
    private onMouseDown(e: MouseEvent): void {
        const rect = this.canvas!.getBoundingClientRect();
        const x = (e.clientX - rect.left) / this.zoom - this.panX;
        const y = (e.clientY - rect.top) / this.zoom - this.panY;
        
        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;
        
        // Middle mouse or right click: pan
        if (e.button === 1 || e.button === 2) {
            this.isPanning = true;
            return;
        }
        
        // Check if clicking on a node
        const hitNode = this.getNodeAtPosition(x, y);
        
        if (hitNode) {
            // Check if clicking on a port
            const port = this.getPortAtPosition(hitNode, x, y);
            if (port) {
                this.isConnecting = true;
                this.connectingPort = { node: hitNode.id, port: port.id };
                return;
            }
            
            // Select/drag node
            if (!e.shiftKey && !this.selectedNodes.has(hitNode.id)) {
                this.selectedNodes.clear();
            }
            this.selectedNodes.add(hitNode.id);
            hitNode.selected = true;
            
            this.draggedNode = hitNode.id;
            this.dragOffsetX = x - hitNode.x;
            this.dragOffsetY = y - hitNode.y;
        } else {
            // Click on empty space: deselect
            if (!e.shiftKey) {
                for (const node of this.nodes.values()) {
                    node.selected = false;
                }
                this.selectedNodes.clear();
            }
        }
        
        this.renderGraph();
    }
    
    /**
     * Mouse move handler
     */
    private onMouseMove(e: MouseEvent): void {
        const dx = e.clientX - this.lastMouseX;
        const dy = e.clientY - this.lastMouseY;
        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;
        
        if (this.isPanning) {
            this.panX += dx / this.zoom;
            this.panY += dy / this.zoom;
            this.renderGraph();
            return;
        }
        
        if (this.draggedNode) {
            const node = this.nodes.get(this.draggedNode);
            if (node) {
                const rect = this.canvas!.getBoundingClientRect();
                const x = (e.clientX - rect.left) / this.zoom - this.panX;
                const y = (e.clientY - rect.top) / this.zoom - this.panY;
                
                node.x = x - this.dragOffsetX;
                node.y = y - this.dragOffsetY;
                this.renderGraph();
            }
            return;
        }
        
        if (this.isConnecting) {
            this.renderGraph();
            // Draw temporary connection line
            if (this.ctx && this.connectingPort) {
                const sourceNode = this.nodes.get(this.connectingPort.node);
                const sourcePort = sourceNode?.ports.find(p => p.id === this.connectingPort!.port);
                if (sourceNode && sourcePort) {
                    const portPos = this.getPortPosition(sourceNode, sourcePort);
                    const rect = this.canvas!.getBoundingClientRect();
                    const mx = (e.clientX - rect.left) / this.zoom - this.panX;
                    const my = (e.clientY - rect.top) / this.zoom - this.panY;
                    
                    this.ctx.save();
                    this.ctx.translate(this.panX * this.zoom, this.panY * this.zoom);
                    this.ctx.scale(this.zoom, this.zoom);
                    
                    this.ctx.beginPath();
                    this.ctx.strokeStyle = this.getPortColor(sourcePort.type);
                    this.ctx.lineWidth = 2;
                    this.ctx.setLineDash([5, 5]);
                    this.ctx.moveTo(portPos.x, portPos.y);
                    this.ctx.lineTo(mx, my);
                    this.ctx.stroke();
                    this.ctx.setLineDash([]);
                    
                    this.ctx.restore();
                }
            }
        }
    }
    
    /**
     * Mouse up handler
     */
    private onMouseUp(e: MouseEvent): void {
        if (this.isConnecting && this.connectingPort) {
            // Check if releasing over a port
            const rect = this.canvas!.getBoundingClientRect();
            const x = (e.clientX - rect.left) / this.zoom - this.panX;
            const y = (e.clientY - rect.top) / this.zoom - this.panY;
            
            const hitNode = this.getNodeAtPosition(x, y);
            if (hitNode && hitNode.id !== this.connectingPort.node) {
                const targetPort = this.getPortAtPosition(hitNode, x, y);
                if (targetPort) {
                    this.createConnection(
                        this.connectingPort.node,
                        this.connectingPort.port,
                        hitNode.id,
                        targetPort.id
                    );
                }
            }
        }
        
        this.isPanning = false;
        this.isConnecting = false;
        this.connectingPort = null;
        this.draggedNode = null;
        this.renderGraph();
    }
    
    /**
     * Mouse wheel handler (zoom)
     */
    private onWheel(e: WheelEvent): void {
        e.preventDefault();
        
        const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
        const newZoom = Math.max(0.25, Math.min(2, this.zoom * zoomFactor));
        
        // Zoom towards mouse position
        const rect = this.canvas!.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        
        this.panX = mx / this.zoom - (mx / newZoom - this.panX);
        this.panY = my / this.zoom - (my / newZoom - this.panY);
        
        this.zoom = newZoom;
        this.updateZoomLabel();
        this.renderGraph();
    }
    
    /**
     * Keyboard handler
     */
    private onKeyDown(e: KeyboardEvent): void {
        if (!this.focused) return;
        
        if (e.key === 'Delete' || e.key === 'Backspace') {
            this.deleteSelected();
        }
    }
    
    /**
     * Get node at canvas position
     */
    private getNodeAtPosition(x: number, y: number): VSScriptNode | null {
        // Check in reverse order (top-most first)
        const nodesArray = Array.from(this.nodes.values()).reverse();
        for (const node of nodesArray) {
            if (x >= node.x && x <= node.x + node.width &&
                y >= node.y && y <= node.y + node.height) {
                return node;
            }
        }
        return null;
    }
    
    /**
     * Get port at position within a node
     */
    private getPortAtPosition(node: VSScriptNode, x: number, y: number): VSNodePort | null {
        for (const port of node.ports) {
            const pos = this.getPortPosition(node, port);
            const dx = x - pos.x;
            const dy = y - pos.y;
            if (dx * dx + dy * dy < 64) { // 8px radius
                return port;
            }
        }
        return null;
    }
    
    /**
     * Get port position in canvas coordinates
     */
    private getPortPosition(node: VSScriptNode, port: VSNodePort): { x: number; y: number } {
        const inputPorts = node.ports.filter(p => p.direction === VSPortDirection.INPUT);
        const outputPorts = node.ports.filter(p => p.direction === VSPortDirection.OUTPUT);
        
        let index: number;
        let x: number;
        
        if (port.direction === VSPortDirection.INPUT) {
            index = inputPorts.indexOf(port);
            x = node.x;
        } else {
            index = outputPorts.indexOf(port);
            x = node.x + node.width;
        }
        
        const y = node.y + 40 + index * 24;
        
        return { x, y };
    }
    
    /**
     * Create connection between ports
     */
    private createConnection(sourceNode: string, sourcePort: string, targetNode: string, targetPort: string): void {
        const source = this.nodes.get(sourceNode);
        const target = this.nodes.get(targetNode);
        if (!source || !target) return;
        
        const srcPort = source.ports.find(p => p.id === sourcePort);
        const tgtPort = target.ports.find(p => p.id === targetPort);
        if (!srcPort || !tgtPort) return;
        
        // Validate connection (output to input, compatible types)
        if (srcPort.direction === tgtPort.direction) {
            this.logger.warn('Cannot connect ports of same direction');
            return;
        }
        
        // Check type compatibility
        if (srcPort.type !== tgtPort.type && 
            srcPort.type !== VSPortType.ANY && 
            tgtPort.type !== VSPortType.ANY) {
            this.logger.warn(`Incompatible types: ${srcPort.type} -> ${tgtPort.type}`);
            return;
        }
        
        // Create connection
        const connId = `conn_${sourcePort}_${targetPort}`;
        const connection: VSNodeConnection = {
            id: connId,
            sourceNode: srcPort.direction === VSPortDirection.OUTPUT ? sourceNode : targetNode,
            sourcePort: srcPort.direction === VSPortDirection.OUTPUT ? sourcePort : targetPort,
            targetNode: srcPort.direction === VSPortDirection.OUTPUT ? targetNode : sourceNode,
            targetPort: srcPort.direction === VSPortDirection.OUTPUT ? targetPort : sourcePort
        };
        
        this.connections.set(connId, connection);
        srcPort.connected = true;
        tgtPort.connected = true;
        
        this.events.emit('connectionCreated', connection);
    }
    
    /**
     * Update zoom label
     */
    private updateZoomLabel(): void {
        const label = this.container?.querySelector('#vs-zoom-value');
        if (label) {
            label.textContent = `${Math.round(this.zoom * 100)}%`;
        }
    }
    
    /**
     * Get color for port type
     */
    private getPortColor(type: VSPortType): string {
        switch (type) {
            case VSPortType.EXEC: return this.COLORS.portExec;
            case VSPortType.BOOL: return this.COLORS.portBool;
            case VSPortType.INT: return this.COLORS.portInt;
            case VSPortType.FLOAT: return this.COLORS.portFloat;
            case VSPortType.STRING: return this.COLORS.portString;
            case VSPortType.VECTOR2:
            case VSPortType.VECTOR3: return this.COLORS.portVector;
            case VSPortType.OBJECT: return this.COLORS.portObject;
            default: return '#888888';
        }
    }
    
    /**
     * Render the node graph
     */
    private renderGraph(): void {
        if (!this.ctx || !this.canvas) return;
        
        const ctx = this.ctx;
        const width = this.canvas.width;
        const height = this.canvas.height;
        
        // Clear
        ctx.fillStyle = this.COLORS.background;
        ctx.fillRect(0, 0, width, height);
        
        // Apply transform
        ctx.save();
        ctx.translate(this.panX * this.zoom, this.panY * this.zoom);
        ctx.scale(this.zoom, this.zoom);
        
        // Draw grid
        this.drawGrid(ctx, width / this.zoom, height / this.zoom);
        
        // Draw connections
        for (const conn of this.connections.values()) {
            this.drawConnection(ctx, conn);
        }
        
        // Draw nodes
        for (const node of this.nodes.values()) {
            this.drawNode(ctx, node);
        }
        
        ctx.restore();
    }
    
    /**
     * Draw background grid
     */
    private drawGrid(ctx: CanvasRenderingContext2D, _width: number, _height: number): void {
        const gridSize = 20;
        const majorGridSize = 100;
        
        // Calculate visible area
        const startX = Math.floor(-this.panX / gridSize) * gridSize - gridSize;
        const startY = Math.floor(-this.panY / gridSize) * gridSize - gridSize;
        const endX = startX + this.canvas!.width / this.zoom + gridSize * 2;
        const endY = startY + this.canvas!.height / this.zoom + gridSize * 2;
        
        // Minor grid
        ctx.strokeStyle = this.COLORS.gridMinor;
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        for (let x = startX; x < endX; x += gridSize) {
            ctx.moveTo(x, startY);
            ctx.lineTo(x, endY);
        }
        for (let y = startY; y < endY; y += gridSize) {
            ctx.moveTo(startX, y);
            ctx.lineTo(endX, y);
        }
        ctx.stroke();
        
        // Major grid
        ctx.strokeStyle = this.COLORS.gridMajor;
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let x = Math.floor(startX / majorGridSize) * majorGridSize; x < endX; x += majorGridSize) {
            ctx.moveTo(x, startY);
            ctx.lineTo(x, endY);
        }
        for (let y = Math.floor(startY / majorGridSize) * majorGridSize; y < endY; y += majorGridSize) {
            ctx.moveTo(startX, y);
            ctx.lineTo(endX, y);
        }
        ctx.stroke();
    }
    
    /**
     * Draw a node
     */
    private drawNode(ctx: CanvasRenderingContext2D, node: VSScriptNode): void {
        const { x, y, width, height, name, ports, selected } = node;
        
        // Find definition for color
        let color = '#3a3a5c';
        for (const category of this.nodeLibrary) {
            const def = category.nodes.find(n => n.type === node.type);
            if (def) {
                color = def.color;
                break;
            }
        }
        
        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(x + 4, y + 4, width, height);
        
        // Node body
        ctx.fillStyle = this.COLORS.node;
        ctx.strokeStyle = selected ? this.COLORS.nodeSelected : this.COLORS.nodeBorder;
        ctx.lineWidth = selected ? 2 : 1;
        
        // Rounded rectangle
        const radius = 6;
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + width - radius, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        ctx.lineTo(x + width, y + height - radius);
        ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        ctx.lineTo(x + radius, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        
        // Header
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + width - radius, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        ctx.lineTo(x + width, y + 26);
        ctx.lineTo(x, y + 26);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
        ctx.fill();
        
        // Title
        ctx.fillStyle = this.COLORS.text;
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(name, x + 10, y + 13);
        
        // Draw ports
        const inputPorts = ports.filter(p => p.direction === VSPortDirection.INPUT);
        const outputPorts = ports.filter(p => p.direction === VSPortDirection.OUTPUT);
        
        ctx.font = '11px sans-serif';
        
        // Input ports
        inputPorts.forEach((port, i) => {
            const py = y + 40 + i * 24;
            
            // Port circle
            ctx.fillStyle = this.getPortColor(port.type);
            ctx.beginPath();
            ctx.arc(x, py, port.type === VSPortType.EXEC ? 5 : 6, 0, Math.PI * 2);
            ctx.fill();
            
            if (port.connected) {
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 1;
                ctx.stroke();
            }
            
            // Port label
            ctx.fillStyle = this.COLORS.textMuted;
            ctx.textAlign = 'left';
            ctx.fillText(port.name, x + 12, py);
        });
        
        // Output ports
        outputPorts.forEach((port, i) => {
            const py = y + 40 + i * 24;
            
            // Port circle
            ctx.fillStyle = this.getPortColor(port.type);
            ctx.beginPath();
            ctx.arc(x + width, py, port.type === VSPortType.EXEC ? 5 : 6, 0, Math.PI * 2);
            ctx.fill();
            
            if (port.connected) {
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 1;
                ctx.stroke();
            }
            
            // Port label
            ctx.fillStyle = this.COLORS.textMuted;
            ctx.textAlign = 'right';
            ctx.fillText(port.name, x + width - 12, py);
        });
    }
    
    /**
     * Draw a connection between nodes
     */
    private drawConnection(ctx: CanvasRenderingContext2D, conn: VSNodeConnection): void {
        const sourceNode = this.nodes.get(conn.sourceNode);
        const targetNode = this.nodes.get(conn.targetNode);
        if (!sourceNode || !targetNode) return;
        
        const sourcePort = sourceNode.ports.find(p => p.id === conn.sourcePort);
        const targetPort = targetNode.ports.find(p => p.id === conn.targetPort);
        if (!sourcePort || !targetPort) return;
        
        const start = this.getPortPosition(sourceNode, sourcePort);
        const end = this.getPortPosition(targetNode, targetPort);
        
        // Draw bezier curve
        const dx = Math.abs(end.x - start.x);
        const controlOffset = Math.min(dx * 0.5, 100);
        
        ctx.strokeStyle = sourcePort.type === VSPortType.EXEC ? 
            this.COLORS.connectionExec : this.COLORS.connection;
        ctx.lineWidth = sourcePort.type === VSPortType.EXEC ? 3 : 2;
        
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.bezierCurveTo(
            start.x + controlOffset, start.y,
            end.x - controlOffset, end.y,
            end.x, end.y
        );
        ctx.stroke();
    }
    
    /**
     * Get all nodes
     */
    getNodes(): VSScriptNode[] {
        return Array.from(this.nodes.values());
    }
    
    /**
     * Get all connections
     */
    getConnections(): VSNodeConnection[] {
        return Array.from(this.connections.values());
    }
    
    /**
     * Clear the graph
     */
    clear(): void {
        this.nodes.clear();
        this.connections.clear();
        this.selectedNodes.clear();
        this.nodeCounter = 0;
        this.renderGraph();
    }
    
    /**
     * Load graph from JSON
     */
    loadFromJSON(data: any): void {
        this.clear();
        
        if (data.nodes) {
            for (const nodeData of data.nodes) {
                const node = this.addNodeOfType(nodeData.type, nodeData.x, nodeData.y);
                if (node) {
                    node.name = nodeData.name || node.name;
                    if (nodeData.properties) {
                        for (const [key, value] of Object.entries(nodeData.properties)) {
                            node.properties.set(key, value);
                        }
                    }
                }
            }
        }
        
        // TODO: Restore connections
        
        this.renderGraph();
    }
    
    /**
     * Export graph to JSON
     */
    toJSON(): any {
        return {
            nodes: Array.from(this.nodes.values()).map(node => ({
                id: node.id,
                type: node.type,
                name: node.name,
                x: node.x,
                y: node.y,
                properties: Object.fromEntries(node.properties)
            })),
            connections: Array.from(this.connections.values()).map(conn => ({
                id: conn.id,
                sourceNode: conn.sourceNode,
                sourcePort: conn.sourcePort,
                targetNode: conn.targetNode,
                targetPort: conn.targetPort
            }))
        };
    }
}
