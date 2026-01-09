import { ScriptNode, NodeType, PortType } from './ScriptNode';

/**
 * Connection between two nodes
 */
export interface NodeConnection {
    sourceNodeId: string;
    sourcePort: string;
    targetNodeId: string;
    targetPort: string;
}

/**
 * Execution context for scripts
 */
export interface ExecutionContext {
    variables: Map<string, any>;
    state: Map<string, any>;
    deltaTime?: number;
    [key: string]: any;
}

/**
 * Visual script graph
 * Manages nodes and their connections, handles execution flow
 */
export class ScriptGraph {
    /** Graph name */
    public name: string = 'Untitled Graph';
    
    /** All nodes in graph */
    private nodes: Map<string, ScriptNode> = new Map();
    
    /** All connections */
    private connections: NodeConnection[] = [];
    
    /** Execution context */
    private context?: ExecutionContext;
    
    /** Variables */
    private variables: Map<string, any> = new Map();
    
    /**
     * Add node to graph
     */
    public addNode(node: ScriptNode): void {
        this.nodes.set(node.id, node);
    }
    
    /**
     * Remove node from graph
     */
    public removeNode(nodeId: string): void {
        // Remove all connections involving this node
        this.connections = this.connections.filter(conn =>
            conn.sourceNodeId !== nodeId && conn.targetNodeId !== nodeId
        );
        
        this.nodes.delete(nodeId);
    }
    
    /**
     * Get node by ID
     */
    public getNode(nodeId: string): ScriptNode | undefined {
        return this.nodes.get(nodeId);
    }
    
    /**
     * Get all nodes
     */
    public getAllNodes(): ScriptNode[] {
        return Array.from(this.nodes.values());
    }
    
    /**
     * Connect two nodes
     */
    public connectNodes(
        sourceNodeId: string, sourcePort: string,
        targetNodeId: string, targetPort: string
    ): boolean {
        const sourceNode = this.nodes.get(sourceNodeId);
        const targetNode = this.nodes.get(targetNodeId);
        
        if (!sourceNode || !targetNode) {
            return false;
        }
        
        const sourcePortDef = sourceNode.outputs.get(sourcePort);
        const targetPortDef = targetNode.inputs.get(targetPort);
        
        if (!sourcePortDef || !targetPortDef) {
            return false;
        }
        
        // Type checking (allow ANY to connect to anything)
        if (sourcePortDef.type !== PortType.ANY && 
            targetPortDef.type !== PortType.ANY &&
            sourcePortDef.type !== targetPortDef.type) {
            return false;
        }
        
        // Create connection
        const connection: NodeConnection = {
            sourceNodeId,
            sourcePort,
            targetNodeId,
            targetPort
        };
        
        this.connections.push(connection);
        
        // Update port states
        sourcePortDef.connected = true;
        targetPortDef.connected = true;
        targetPortDef.connection = { nodeId: sourceNodeId, portName: sourcePort };
        
        return true;
    }
    
    /**
     * Disconnect nodes
     */
    public disconnectNodes(
        sourceNodeId: string, sourcePort: string,
        targetNodeId: string, targetPort: string
    ): void {
        this.connections = this.connections.filter(conn =>
            !(conn.sourceNodeId === sourceNodeId && conn.sourcePort === sourcePort &&
              conn.targetNodeId === targetNodeId && conn.targetPort === targetPort)
        );
        
        const targetNode = this.nodes.get(targetNodeId);
        if (targetNode) {
            const targetPortDef = targetNode.inputs.get(targetPort);
            if (targetPortDef) {
                targetPortDef.connected = false;
                targetPortDef.connection = undefined;
            }
        }
    }
    
    /**
     * Get connections from a node's output port
     */
    private getConnectionsFromPort(nodeId: string, portName: string): NodeConnection[] {
        return this.connections.filter(conn =>
            conn.sourceNodeId === nodeId && conn.sourcePort === portName
        );
    }
    
    /**
     * Execute graph from event node
     */
    public execute(eventName: string, context: ExecutionContext): void {
        this.context = context;
        
        // Find event nodes with matching name
        const eventNodes = Array.from(this.nodes.values()).filter(node =>
            node.type === NodeType.EVENT && node.name === eventName
        );
        
        for (const eventNode of eventNodes) {
            this.executeNode(eventNode);
        }
    }
    
    /**
     * Execute a single node
     */
    private executeNode(node: ScriptNode): void {
        if (!this.context) return;
        
        // Gather input values from connected nodes
        for (const [_portName, port] of node.inputs) {
            if (port.connected && port.connection) {
                const sourceNode = this.nodes.get(port.connection.nodeId);
                if (sourceNode) {
                    const sourcePort = sourceNode.outputs.get(port.connection.portName);
                    if (sourcePort) {
                        port.value = sourcePort.value;
                    }
                }
            }
        }
        
        // Execute node
        node.execute(this.context);
        
        // Follow execution flow
        const execConnections = this.getConnectionsFromPort(node.id, 'exec_out');
        for (const conn of execConnections) {
            const nextNode = this.nodes.get(conn.targetNodeId);
            if (nextNode) {
                this.executeNode(nextNode);
            }
        }
    }
    
    /**
     * Create execution context
     */
    public createExecutionContext(): ExecutionContext {
        return {
            variables: new Map(this.variables),
            state: new Map()
        };
    }
    
    /**
     * Set variable
     */
    public setVariable(name: string, value: any): void {
        this.variables.set(name, value);
    }
    
    /**
     * Get variable
     */
    public getVariable(name: string): any {
        return this.variables.get(name);
    }
    
    /**
     * Serialize graph to JSON
     */
    public toJSON(): string {
        const data = {
            name: this.name,
            nodes: Array.from(this.nodes.values()).map(node => ({
                id: node.id,
                name: node.name,
                type: node.type,
                x: node.x,
                y: node.y,
                inputs: Array.from(node.inputs.entries()),
                outputs: Array.from(node.outputs.entries()),
                properties: Array.from(node.properties.entries())
            })),
            connections: this.connections,
            variables: Array.from(this.variables.entries())
        };
        
        return JSON.stringify(data, null, 2);
    }
    
    /**
     * Load graph from JSON
     */
    public static fromJSON(json: string): ScriptGraph {
        const data = JSON.parse(json);
        const graph = new ScriptGraph();
        graph.name = data.name;
        
        // Restore nodes (simplified - would need full node reconstruction)
        // This is a placeholder for actual implementation
        
        return graph;
    }
}
