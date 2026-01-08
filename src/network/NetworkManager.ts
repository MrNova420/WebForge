/**
 * Network message types
 */
export enum MessageType {
    // Connection
    CONNECT = 'connect',
    DISCONNECT = 'disconnect',
    PING = 'ping',
    PONG = 'pong',

    // State sync
    STATE_UPDATE = 'state_update',
    TRANSFORM_UPDATE = 'transform_update',
    ENTITY_SPAWN = 'entity_spawn',
    ENTITY_DESTROY = 'entity_destroy',

    // Events
    PLAYER_INPUT = 'player_input',
    PLAYER_ACTION = 'player_action',
    CUSTOM_EVENT = 'custom_event',

    // RPC
    RPC_CALL = 'rpc_call',
    RPC_RESPONSE = 'rpc_response'
}

/**
 * Network message interface
 */
export interface NetworkMessage {
    type: MessageType;
    senderId: string;
    timestamp: number;
    data: any;
    reliable?: boolean;
}

/**
 * Network client interface
 */
export interface NetworkClient {
    id: string;
    isConnected: boolean;
    latency: number;
    lastMessageTime: number;
}

/**
 * Network manager base class
 * 
 * Provides foundation for WebSocket and WebRTC networking.
 */
export abstract class NetworkManager {
    protected clients: Map<string, NetworkClient> = new Map();
    protected messageHandlers: Map<MessageType, ((message: NetworkMessage) => void)[]> = new Map();
    protected localClientId: string = '';
    protected isServer: boolean = false;

    /**
     * Connect to server or start hosting
     */
    public abstract connect(address: string): Promise<void>;

    /**
     * Disconnect from network
     */
    public abstract disconnect(): void;

    /**
     * Send message to specific client or all clients
     */
    public abstract send(message: NetworkMessage, targetId?: string): void;

    /**
     * Register message handler
     */
    public on(type: MessageType, handler: (message: NetworkMessage) => void): void {
        if (!this.messageHandlers.has(type)) {
            this.messageHandlers.set(type, []);
        }

        this.messageHandlers.get(type)!.push(handler);
    }

    /**
     * Unregister message handler
     */
    public off(type: MessageType, handler: (message: NetworkMessage) => void): void {
        const handlers = this.messageHandlers.get(type);
        if (!handlers) {
            return;
        }

        const index = handlers.indexOf(handler);
        if (index !== -1) {
            handlers.splice(index, 1);
        }
    }

    /**
     * Handle incoming message
     */
    protected handleMessage(message: NetworkMessage): void {
        const handlers = this.messageHandlers.get(message.type);
        if (!handlers) {
            return;
        }

        for (const handler of handlers) {
            handler(message);
        }
    }

    /**
     * Get local client ID
     */
    public getLocalClientId(): string {
        return this.localClientId;
    }

    /**
     * Get all connected clients
     */
    public getClients(): NetworkClient[] {
        return Array.from(this.clients.values());
    }

    /**
     * Get client by ID
     */
    public getClient(id: string): NetworkClient | undefined {
        return this.clients.get(id);
    }

    /**
     * Check if client is connected
     */
    public isConnected(id?: string): boolean {
        if (id) {
            const client = this.clients.get(id);
            return client ? client.isConnected : false;
        }

        return this.clients.size > 0;
    }

    /**
     * Get client count
     */
    public getClientCount(): number {
        return this.clients.size;
    }

    /**
     * Broadcast message to all clients
     */
    public broadcast(message: NetworkMessage): void {
        for (const client of this.clients.values()) {
            if (client.isConnected && client.id !== this.localClientId) {
                this.send(message, client.id);
            }
        }
    }

    /**
     * Create network message
     */
    protected createMessage(type: MessageType, data: any, reliable: boolean = true): NetworkMessage {
        return {
            type,
            senderId: this.localClientId,
            timestamp: Date.now(),
            data,
            reliable
        };
    }

    /**
     * Update network (called each frame)
     */
    public update(deltaTime: number): void {
        // Update ping/latency for clients
        const now = Date.now();

        for (const client of this.clients.values()) {
            if (client.isConnected) {
                // Send ping if no message for 1 second
                if (now - client.lastMessageTime > 1000) {
                    this.send(this.createMessage(MessageType.PING, {}, false), client.id);
                }
            }
        }
    }
}
