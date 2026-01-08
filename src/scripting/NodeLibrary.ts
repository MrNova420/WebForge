import { ScriptNode, NodeType, PortType } from './ScriptNode';
import { Vector3 } from '../math/Vector3';

/**
 * Library of built-in nodes for visual scripting
 * Provides common operations: math, logic, variables, events, flow control
 */
export class NodeLibrary {
    
    // ========== MATH NODES ==========
    
    /**
     * Create math operation node
     */
    public static createMathNode(operation: string, defaultA: number = 0, defaultB: number = 0): ScriptNode {
        const node = new ScriptNode(operation, NodeType.FUNCTION);
        node.addInput('a', PortType.NUMBER, defaultA);
        node.addInput('b', PortType.NUMBER, defaultB);
        node.addOutput('result', PortType.NUMBER);
        
        node.setExecuteFunc((context) => {
            const a = node.getInputValue('a');
            const b = node.getInputValue('b');
            let result = 0;
            
            switch (operation) {
                case 'Add': result = a + b; break;
                case 'Subtract': result = a - b; break;
                case 'Multiply': result = a * b; break;
                case 'Divide': result = b !== 0 ? a / b : 0; break;
                case 'Min': result = Math.min(a, b); break;
                case 'Max': result = Math.max(a, b); break;
                case 'Pow': result = Math.pow(a, b); break;
                default: result = 0;
            }
            
            node.setOutputValue('result', result);
            return result;
        });
        
        return node;
    }
    
    /**
     * Create trigonometry node
     */
    public static createTrigNode(operation: string): ScriptNode {
        const node = new ScriptNode(operation, NodeType.FUNCTION);
        node.addInput('value', PortType.NUMBER, 0);
        node.addOutput('result', PortType.NUMBER);
        
        node.setExecuteFunc((context) => {
            const value = node.getInputValue('value');
            let result = 0;
            
            switch (operation) {
                case 'Sin': result = Math.sin(value); break;
                case 'Cos': result = Math.cos(value); break;
                case 'Tan': result = Math.tan(value); break;
                case 'Asin': result = Math.asin(value); break;
                case 'Acos': result = Math.acos(value); break;
                case 'Atan': result = Math.atan(value); break;
                case 'Sqrt': result = Math.sqrt(value); break;
                case 'Abs': result = Math.abs(value); break;
                default: result = 0;
            }
            
            node.setOutputValue('result', result);
            return result;
        });
        
        return node;
    }
    
    /**
     * Create random node
     */
    public static createRandomNode(min: number = 0, max: number = 1): ScriptNode {
        const node = new ScriptNode('Random', NodeType.FUNCTION);
        node.addInput('min', PortType.NUMBER, min);
        node.addInput('max', PortType.NUMBER, max);
        node.addOutput('value', PortType.NUMBER);
        
        node.setExecuteFunc((context) => {
            const minVal = node.getInputValue('min');
            const maxVal = node.getInputValue('max');
            const result = minVal + Math.random() * (maxVal - minVal);
            node.setOutputValue('value', result);
            return result;
        });
        
        return node;
    }
    
    // ========== LOGIC NODES ==========
    
    /**
     * Create branch (if/else) node
     */
    public static createBranchNode(): ScriptNode {
        const node = new ScriptNode('Branch', NodeType.FLOW);
        node.addInput('exec_in', PortType.EXEC);
        node.addInput('condition', PortType.BOOLEAN, false);
        node.addOutput('true', PortType.EXEC);
        node.addOutput('false', PortType.EXEC);
        
        node.setExecuteFunc((context) => {
            const condition = node.getInputValue('condition');
            return condition ? 'true' : 'false';
        });
        
        return node;
    }
    
    /**
     * Create comparison node
     */
    public static createComparisonNode(operation: string): ScriptNode {
        const node = new ScriptNode(operation, NodeType.FUNCTION);
        node.addInput('a', PortType.NUMBER, 0);
        node.addInput('b', PortType.NUMBER, 0);
        node.addOutput('result', PortType.BOOLEAN);
        
        node.setExecuteFunc((context) => {
            const a = node.getInputValue('a');
            const b = node.getInputValue('b');
            let result = false;
            
            switch (operation) {
                case 'Greater': result = a > b; break;
                case 'Less': result = a < b; break;
                case 'Equal': result = a === b; break;
                case 'GreaterEqual': result = a >= b; break;
                case 'LessEqual': result = a <= b; break;
                case 'NotEqual': result = a !== b; break;
                default: result = false;
            }
            
            node.setOutputValue('result', result);
            return result;
        });
        
        return node;
    }
    
    /**
     * Create boolean logic node
     */
    public static createLogicNode(operation: string): ScriptNode {
        const node = new ScriptNode(operation, NodeType.FUNCTION);
        node.addInput('a', PortType.BOOLEAN, false);
        node.addInput('b', PortType.BOOLEAN, false);
        node.addOutput('result', PortType.BOOLEAN);
        
        node.setExecuteFunc((context) => {
            const a = node.getInputValue('a');
            const b = node.getInputValue('b');
            let result = false;
            
            switch (operation) {
                case 'AND': result = a && b; break;
                case 'OR': result = a || b; break;
                case 'NOT': result = !a; break;
                case 'XOR': result = a !== b; break;
                default: result = false;
            }
            
            node.setOutputValue('result', result);
            return result;
        });
        
        return node;
    }
    
    // ========== VARIABLE NODES ==========
    
    /**
     * Create variable node (get or set)
     */
    public static createVariableNode(operation: string, variableName: string): ScriptNode {
        const node = new ScriptNode(`${operation} ${variableName}`, NodeType.VARIABLE);
        
        if (operation === 'GetVariable') {
            node.addOutput('value', PortType.ANY);
            
            node.setExecuteFunc((context) => {
                const value = context.variables.get(variableName);
                node.setOutputValue('value', value);
                return value;
            });
        } else if (operation === 'SetVariable') {
            node.addInput('exec_in', PortType.EXEC);
            node.addInput('value', PortType.ANY);
            node.addOutput('exec_out', PortType.EXEC);
            
            node.setExecuteFunc((context) => {
                const value = node.getInputValue('value');
                context.variables.set(variableName, value);
                return value;
            });
        }
        
        return node;
    }
    
    // ========== EVENT NODES ==========
    
    /**
     * Create event node
     */
    public static createEventNode(eventName: string): ScriptNode {
        const node = new ScriptNode(eventName, NodeType.EVENT);
        node.addOutput('exec_out', PortType.EXEC);
        
        switch (eventName) {
            case 'OnStart':
                node.description = 'Triggered once at start';
                break;
            case 'OnUpdate':
                node.description = 'Triggered every frame';
                node.addOutput('deltaTime', PortType.NUMBER);
                node.setExecuteFunc((context) => {
                    node.setOutputValue('deltaTime', context.deltaTime || 0);
                });
                break;
            case 'OnInput':
                node.description = 'Triggered on input';
                node.addOutput('key', PortType.STRING);
                break;
        }
        
        return node;
    }
    
    // ========== FLOW CONTROL NODES ==========
    
    /**
     * Create sequence node (execute multiple in order)
     */
    public static createSequenceNode(count: number = 2): ScriptNode {
        const node = new ScriptNode('Sequence', NodeType.FLOW);
        node.addInput('exec_in', PortType.EXEC);
        
        for (let i = 0; i < count; i++) {
            node.addOutput(`then_${i}`, PortType.EXEC);
        }
        
        return node;
    }
    
    /**
     * Create delay node
     */
    public static createDelayNode(duration: number = 1.0): ScriptNode {
        const node = new ScriptNode('Delay', NodeType.FLOW);
        node.addInput('exec_in', PortType.EXEC);
        node.addInput('duration', PortType.NUMBER, duration);
        node.addOutput('exec_out', PortType.EXEC);
        
        node.setExecuteFunc((context) => {
            const duration = node.getInputValue('duration');
            setTimeout(() => {
                // Execute next node after delay
                // This requires async execution support
            }, duration * 1000);
        });
        
        return node;
    }
    
    // ========== GAMEOBJECT NODES ==========
    
    /**
     * Create GameObject operation node
     */
    public static createGameObjectNode(operation: string): ScriptNode {
        const node = new ScriptNode(operation, NodeType.ACTION);
        node.addInput('exec_in', PortType.EXEC);
        node.addInput('target', PortType.OBJECT);
        node.addOutput('exec_out', PortType.EXEC);
        
        switch (operation) {
            case 'SetPosition':
                node.addInput('position', PortType.VECTOR3, new Vector3(0, 0, 0));
                node.setExecuteFunc((context) => {
                    const target = node.getInputValue('target');
                    const position = node.getInputValue('position');
                    if (target && target.transform) {
                        target.transform.position = position;
                    }
                });
                break;
            case 'GetPosition':
                node.addOutput('position', PortType.VECTOR3);
                node.setExecuteFunc((context) => {
                    const target = node.getInputValue('target');
                    if (target && target.transform) {
                        node.setOutputValue('position', target.transform.position);
                    }
                });
                break;
            case 'Destroy':
                node.setExecuteFunc((context) => {
                    const target = node.getInputValue('target');
                    if (target && target.destroy) {
                        target.destroy();
                    }
                });
                break;
        }
        
        return node;
    }
    
    // ========== DEBUG NODES ==========
    
    /**
     * Create print node
     */
    public static createPrintNode(): ScriptNode {
        const node = new ScriptNode('Print', NodeType.ACTION);
        node.addInput('exec_in', PortType.EXEC);
        node.addInput('message', PortType.STRING, '');
        node.addOutput('exec_out', PortType.EXEC);
        
        node.setExecuteFunc((context) => {
            const message = node.getInputValue('message');
            console.log('[Script]', message);
        });
        
        return node;
    }
}
