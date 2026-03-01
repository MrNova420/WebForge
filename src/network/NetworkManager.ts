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
    RPC_RESPONSE = 'rpc_response',

    // Room management
    ROOM_CREATE = 'room_create',
    ROOM_JOIN = 'room_join',
    ROOM_LEAVE = 'room_leave',
    ROOM_LIST = 'room_list',
    ROOM_UPDATE = 'room_update',

    // Chat
    CHAT_MESSAGE = 'chat_message'
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
    displayName?: string;
}

/**
 * Room interface for multiplayer
 */
export interface NetworkRoom {
    id: string;
    name: string;
    hostId: string;
    clients: string[];
    maxClients: number;
    isPublic: boolean;
    metadata: Record<string, unknown>;
}

/**
 * RPC handler type
 */
export type RPCHandler = (senderId: string, args: unknown[]) => unknown;

/**
 * Entity state for synchronization
 */
export interface NetworkEntityState {
    entityId: string;
    ownerId: string;
    position?: [number, number, number];
    rotation?: [number, number, number, number];
    scale?: [number, number, number];
    data?: Record<string, unknown>;
}

/**
 * Network manager base class
 * 
 * Provides foundation for WebSocket and WebRTC networking
 * with room management, entity sync, and RPC support.
 */
export abstract class NetworkManager {
    protected clients: Map<string, NetworkClient> = new Map();
    protected messageHandlers: Map<MessageType, ((message: NetworkMessage) => void)[]> = new Map();
    protected localClientId: string = '';
    protected isServer: boolean = false;

    // Room management
    protected rooms: Map<string, NetworkRoom> = new Map();
    protected currentRoomId: string | null = null;

    // RPC registry
    protected rpcHandlers: Map<string, RPCHandler> = new Map();
    private rpcCallId: number = 0;
    private pendingRPCs: Map<number, { resolve: (value: unknown) => void; reject: (reason: unknown) => void }> = new Map();

    // Entity state tracking
    protected entityStates: Map<string, NetworkEntityState> = new Map();

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
        // Handle RPC internally
        if (message.type === MessageType.RPC_CALL) {
            this.handleRPCCall(message);
            return;
        }
        if (message.type === MessageType.RPC_RESPONSE) {
            this.handleRPCResponse(message);
            return;
        }

        // Handle entity state updates
        if (message.type === MessageType.ENTITY_SPAWN || message.type === MessageType.TRANSFORM_UPDATE) {
            this.handleEntityUpdate(message);
        }
        if (message.type === MessageType.ENTITY_DESTROY) {
            this.entityStates.delete(message.data?.entityId);
        }

        // Handle room updates
        if (message.type === MessageType.ROOM_UPDATE) {
            this.handleRoomUpdate(message);
        }

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

    // ========== Room Management ==========

    /**
     * Create a new room
     */
    public createRoom(name: string, maxClients: number = 8, isPublic: boolean = true): void {
        const roomId = `room_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
        const room: NetworkRoom = {
            id: roomId,
            name,
            hostId: this.localClientId,
            clients: [this.localClientId],
            maxClients,
            isPublic,
            metadata: {}
        };
        this.rooms.set(roomId, room);
        this.currentRoomId = roomId;
        this.broadcast(this.createMessage(MessageType.ROOM_CREATE, room));
    }

    /**
     * Join a room by ID
     */
    public joinRoom(roomId: string): boolean {
        const room = this.rooms.get(roomId);
        if (!room || room.clients.length >= room.maxClients) {
            return false;
        }
        room.clients.push(this.localClientId);
        this.currentRoomId = roomId;
        this.send(this.createMessage(MessageType.ROOM_JOIN, { roomId }));
        return true;
    }

    /**
     * Leave current room
     */
    public leaveRoom(): void {
        if (this.currentRoomId) {
            const room = this.rooms.get(this.currentRoomId);
            if (room) {
                room.clients = room.clients.filter(id => id !== this.localClientId);
            }
            this.send(this.createMessage(MessageType.ROOM_LEAVE, { roomId: this.currentRoomId }));
            this.currentRoomId = null;
        }
    }

    /**
     * Get current room
     */
    public getCurrentRoom(): NetworkRoom | null {
        return this.currentRoomId ? this.rooms.get(this.currentRoomId) || null : null;
    }

    /**
     * Get list of available rooms
     */
    public getRooms(): NetworkRoom[] {
        return Array.from(this.rooms.values()).filter(r => r.isPublic);
    }

    /**
     * Handle room update from network
     */
    private handleRoomUpdate(message: NetworkMessage): void {
        const roomData = message.data as NetworkRoom;
        if (roomData && roomData.id) {
            this.rooms.set(roomData.id, roomData);
        }
    }

    // ========== RPC (Remote Procedure Call) ==========

    /**
     * Register an RPC handler
     */
    public registerRPC(name: string, handler: RPCHandler): void {
        this.rpcHandlers.set(name, handler);
    }

    /**
     * Unregister an RPC handler
     */
    public unregisterRPC(name: string): void {
        this.rpcHandlers.delete(name);
    }

    /**
     * Call a remote procedure on another client
     */
    public callRPC(targetId: string, name: string, args: unknown[] = []): Promise<unknown> {
        const callId = ++this.rpcCallId;
        return new Promise((resolve, reject) => {
            this.pendingRPCs.set(callId, { resolve, reject });
            this.send(this.createMessage(MessageType.RPC_CALL, { callId, name, args }), targetId);

            // Timeout after 10 seconds
            setTimeout(() => {
                if (this.pendingRPCs.has(callId)) {
                    this.pendingRPCs.delete(callId);
                    reject(new Error(`RPC '${name}' timed out`));
                }
            }, 10000);
        });
    }

    /**
     * Handle incoming RPC call
     */
    private handleRPCCall(message: NetworkMessage): void {
        const { callId, name, args } = message.data;
        const handler = this.rpcHandlers.get(name);
        
        let result: unknown;
        let error: string | null = null;
        
        if (handler) {
            try {
                result = handler(message.senderId, args || []);
            } catch (e) {
                error = e instanceof Error ? e.message : String(e);
            }
        } else {
            error = `RPC '${name}' not found`;
        }
        
        this.send(this.createMessage(MessageType.RPC_RESPONSE, { callId, result, error }), message.senderId);
    }

    /**
     * Handle RPC response
     */
    private handleRPCResponse(message: NetworkMessage): void {
        const { callId, result, error } = message.data;
        const pending = this.pendingRPCs.get(callId);
        if (pending) {
            this.pendingRPCs.delete(callId);
            if (error) {
                pending.reject(new Error(error));
            } else {
                pending.resolve(result);
            }
        }
    }

    // ========== Entity Synchronization ==========

    /**
     * Spawn a networked entity
     */
    public spawnEntity(entityId: string, position?: [number, number, number], rotation?: [number, number, number, number]): void {
        const state: NetworkEntityState = {
            entityId,
            ownerId: this.localClientId,
            position: position || [0, 0, 0],
            rotation: rotation || [0, 0, 0, 1]
        };
        this.entityStates.set(entityId, state);
        this.broadcast(this.createMessage(MessageType.ENTITY_SPAWN, state));
    }

    /**
     * Destroy a networked entity
     */
    public destroyEntity(entityId: string): void {
        this.entityStates.delete(entityId);
        this.broadcast(this.createMessage(MessageType.ENTITY_DESTROY, { entityId }));
    }

    /**
     * Update entity transform for network sync
     */
    public updateEntityTransform(entityId: string, position: [number, number, number], rotation?: [number, number, number, number]): void {
        const state = this.entityStates.get(entityId);
        if (state) {
            state.position = position;
            if (rotation) state.rotation = rotation;
        }
        this.broadcast(this.createMessage(MessageType.TRANSFORM_UPDATE, {
            entityId,
            position,
            rotation
        }, false));
    }

    /**
     * Get all entity states
     */
    public getEntityStates(): NetworkEntityState[] {
        return Array.from(this.entityStates.values());
    }

    /**
     * Handle entity update from network
     */
    private handleEntityUpdate(message: NetworkMessage): void {
        const data = message.data as NetworkEntityState;
        if (data && data.entityId) {
            this.entityStates.set(data.entityId, {
                ...this.entityStates.get(data.entityId),
                ...data,
                ownerId: data.ownerId || message.senderId
            });
        }
    }

    /**
     * Send chat message
     */
    public sendChat(text: string): void {
        this.broadcast(this.createMessage(MessageType.CHAT_MESSAGE, { text, displayName: this.localClientId }));
    }

    /**
     * Update network (called each frame)
     */
    public update(_deltaTime: number): void {
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
