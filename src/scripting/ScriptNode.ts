import { Vector3 } from '../math/Vector3';

/**
 * Port type for node connections
 */
export enum PortType {
    EXEC = 'exec',      // Execution flow
    BOOLEAN = 'boolean',
    NUMBER = 'number',
    STRING = 'string',
    VECTOR3 = 'vector3',
    OBJECT = 'object',
    ANY = 'any'
}

/**
 * Port direction (input or output)
 */
export enum PortDirection {
    INPUT = 'input',
    OUTPUT = 'output'
}

/**
 * Port definition for a node
 */
export interface NodePort {
    name: string;
    type: PortType;
    direction: PortDirection;
    value?: any;
    connected?: boolean;
    connection?: { nodeId: string; portName: string };
}

/**
 * Node types for visual scripting
 */
export enum NodeType {
    EVENT = 'event',
    ACTION = 'action',
    FUNCTION = 'function',
    VARIABLE = 'variable',
    FLOW = 'flow'
}

/**
 * Base class for visual scripting nodes
 * Nodes are the fundamental building blocks of visual scripts
 */
export class ScriptNode {
    /** Unique identifier */
    public id: string;
    
    /** Display name */
    public name: string;
    
    /** Node type */
    public type: NodeType;
    
    /** Position in graph */
    public x: number = 0;
    public y: number = 0;
    
    /** Input ports */
    public inputs: Map<string, NodePort> = new Map();
    
    /** Output ports */
    public outputs: Map<string, NodePort> = new Map();
    
    /** Custom properties */
    public properties: Map<string, any> = new Map();
    
    /** Description/tooltip */
    public description: string = '';
    
    /** Execution function */
    protected executeFunc?: (context: any) => any;
    
    /**
     * Create a new script node
     */
    constructor(name: string, type: NodeType) {
        this.id = this.generateId();
        this.name = name;
        this.type = type;
    }
    
    /**
     * Generate unique ID
     */
    private generateId(): string {
        return `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    /**
     * Add input port
     */
    public addInput(name: string, type: PortType, defaultValue?: any): void {
        this.inputs.set(name, {
            name,
            type,
            direction: PortDirection.INPUT,
            value: defaultValue,
            connected: false
        });
    }
    
    /**
     * Add output port
     */
    public addOutput(name: string, type: PortType): void {
        this.outputs.set(name, {
            name,
            type,
            direction: PortDirection.OUTPUT,
            connected: false
        });
    }
    
    /**
     * Get input value
     */
    public getInputValue(name: string): any {
        const port = this.inputs.get(name);
        return port ? port.value : undefined;
    }
    
    /**
     * Set output value
     */
    public setOutputValue(name: string, value: any): void {
        const port = this.outputs.get(name);
        if (port) {
            port.value = value;
        }
    }
    
    /**
     * Execute node
     */
    public execute(context: any): any {
        if (this.executeFunc) {
            return this.executeFunc(context);
        }
        return null;
    }
    
    /**
     * Set execution function
     */
    public setExecuteFunc(func: (context: any) => any): void {
        this.executeFunc = func;
    }
    
    /**
     * Clone node
     */
    public clone(): ScriptNode {
        const cloned = new ScriptNode(this.name, this.type);
        cloned.x = this.x;
        cloned.y = this.y;
        cloned.description = this.description;
        
        // Clone ports
        this.inputs.forEach((port, name) => {
            cloned.addInput(name, port.type, port.value);
        });
        this.outputs.forEach((port, name) => {
            cloned.addOutput(name, port.type);
        });
        
        // Clone properties
        this.properties.forEach((value, key) => {
            cloned.properties.set(key, value);
        });
        
        return cloned;
    }
}
