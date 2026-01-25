/**
 * CollaborationManager - Real-time collaborative editing system
 * 
 * Enables multiple users to work on the same project simultaneously with:
 * - Real-time synchronization via WebRTC
 * - User presence indicators
 * - Conflict resolution
 * - Operation history tracking
 * - Permissions and roles
 * 
 * @module collaboration
 */

import { EventSystem } from '../core/EventSystem';

/**
 * User role for permissions
 */
export enum UserRole {
    OWNER = 'owner',
    ADMIN = 'admin',
    EDITOR = 'editor',
    VIEWER = 'viewer'
}

/**
 * Operation types for collaborative editing
 */
export enum OperationType {
    CREATE = 'create',
    UPDATE = 'update',
    DELETE = 'delete',
    TRANSFORM = 'transform',
    PROPERTY = 'property'
}

/**
 * Collaborative user representation
 */
export interface CollaborativeUser {
    id: string;
    name: string;
    color: string;
    role: UserRole;
    cursorPosition: { x: number; y: number; z: number };
    selectedObjects: string[];
    viewportCamera: {
        position: { x: number; y: number; z: number };
        rotation: { x: number; y: number; z: number };
    };
    isActive: boolean;
    lastSeen: number;
}

/**
 * Edit operation for change tracking
 */
export interface EditOperation {
    id: string;
    type: OperationType;
    userId: string;
    timestamp: number;
    objectId: string;
    property?: string;
    oldValue?: any;
    newValue?: any;
    metadata?: Record<string, any>;
}

/**
 * Conflict between operations
 */
export interface OperationConflict {
    operation1: EditOperation;
    operation2: EditOperation;
    conflictType: 'concurrent' | 'sequential' | 'dependent';
    resolution?: 'merge' | 'override' | 'manual';
}

/**
 * CollaborationManager - Manages real-time collaborative editing
 */
export class CollaborationManager {
    private events: EventSystem;
    private users: Map<string, CollaborativeUser>;
    private operations: EditOperation[];
    private conflicts: OperationConflict[];
    private localUserId: string;
    private _sessionId: string;
    private rtcConnections: Map<string, RTCPeerConnection>;
    private dataChannels: Map<string, RTCDataChannel>;
    private operationQueue: EditOperation[];
    private syncInterval: number;
    private syncTimer: number | null;
    private permissions: Map<UserRole, Set<string>>;

    constructor() {
        this.events = new EventSystem();
        this.users = new Map();
        this.operations = [];
        this.conflicts = [];
        this.localUserId = this.generateUserId();
        this._sessionId = '';
        this.rtcConnections = new Map();
        this.dataChannels = new Map();
        this.operationQueue = [];
        this.syncInterval = 100; // 10 Hz sync rate
        this.syncTimer = null;

        // Initialize default permissions
        this.permissions = new Map();
        this.permissions.set(UserRole.OWNER, new Set(['*']));
        this.permissions.set(UserRole.ADMIN, new Set(['create', 'update', 'delete', 'transform', 'property']));
        this.permissions.set(UserRole.EDITOR, new Set(['create', 'update', 'transform', 'property']));
        this.permissions.set(UserRole.VIEWER, new Set(['read']));
    }

    /**
     * Generate unique user ID
     */
    private generateUserId(): string {
        return `user_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    }

    /**
     * Initialize collaboration session
     */
    public async initSession(sessionId: string, userName: string, role: UserRole = UserRole.EDITOR): Promise<void> {
        this._sessionId = sessionId;

        // Create local user
        const localUser: CollaborativeUser = {
            id: this.localUserId,
            name: userName,
            color: this.generateUserColor(),
            role: role,
            cursorPosition: { x: 0, y: 0, z: 0 },
            selectedObjects: [],
            viewportCamera: {
                position: { x: 0, y: 0, z: 10 },
                rotation: { x: 0, y: 0, z: 0 }
            },
            isActive: true,
            lastSeen: Date.now()
        };

        this.users.set(this.localUserId, localUser);

        // Start sync
        this.startSync();

        this.events.emit('session_initialized', { sessionId, userId: this.localUserId });
    }

    /**
     * Generate random user color
     */
    private generateUserColor(): string {
        const hue = Math.random() * 360;
        return `hsl(${hue}, 70%, 60%)`;
    }

    /**
     * Connect to remote peer
     */
    public async connectToPeer(peerId: string, signalingData?: any): Promise<void> {
        const config: RTCConfiguration = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' }
            ]
        };

        const connection = new RTCPeerConnection(config);
        this.rtcConnections.set(peerId, connection);

        // Create data channel
        const dataChannel = connection.createDataChannel('collaboration', {
            ordered: true
        });

        this.setupDataChannel(peerId, dataChannel);

        // Handle ICE candidates
        connection.onicecandidate = (event) => {
            if (event.candidate) {
                this.events.emit('ice_candidate', { peerId, candidate: event.candidate });
            }
        };

        // Handle connection state
        connection.onconnectionstatechange = () => {
            this.events.emit('connection_state_changed', {
                peerId,
                state: connection.connectionState
            });
        };

        // Create offer if initiating
        if (!signalingData) {
            const offer = await connection.createOffer();
            await connection.setLocalDescription(offer);
            this.events.emit('offer_created', { peerId, offer });
        }
    }

    /**
     * Setup data channel for peer
     */
    private setupDataChannel(peerId: string, channel: RTCDataChannel): void {
        this.dataChannels.set(peerId, channel);

        channel.onopen = () => {
            this.events.emit('peer_connected', { peerId });
            this.syncWithPeer(peerId);
        };

        channel.onmessage = (event) => {
            this.handleRemoteMessage(peerId, event.data);
        };

        channel.onclose = () => {
            this.events.emit('peer_disconnected', { peerId });
            this.users.delete(peerId);
        };

        channel.onerror = (error) => {
            console.error(`Data channel error with peer ${peerId}:`, error);
        };
    }

    /**
     * Handle remote message from peer
     */
    private handleRemoteMessage(peerId: string, data: string): void {
        try {
            const message = JSON.parse(data);

            switch (message.type) {
                case 'user_update':
                    this.updateRemoteUser(message.data);
                    break;
                case 'operation':
                    this.handleRemoteOperation(message.data);
                    break;
                case 'sync_request':
                    this.handleSyncRequest(peerId);
                    break;
                case 'sync_data':
                    this.handleSyncData(message.data);
                    break;
            }
        } catch (error) {
            console.error('Error handling remote message:', error);
        }
    }

    /**
     * Update remote user information
     */
    private updateRemoteUser(userData: CollaborativeUser): void {
        const existingUser = this.users.get(userData.id);
        
        if (existingUser) {
            Object.assign(existingUser, userData);
        } else {
            this.users.set(userData.id, userData);
            this.events.emit('user_joined', userData);
        }

        this.events.emit('user_updated', userData);
    }

    /**
     * Handle remote operation
     */
    private handleRemoteOperation(operation: EditOperation): void {
        // Check for conflicts
        const conflict = this.detectConflict(operation);
        
        if (conflict) {
            this.conflicts.push(conflict);
            this.events.emit('conflict_detected', conflict);
            
            // Attempt automatic resolution
            const resolved = this.resolveConflict(conflict);
            if (resolved) {
                this.events.emit('conflict_resolved', conflict);
            }
        }

        // Add to operation history
        this.operations.push(operation);
        
        // Apply operation
        this.applyOperation(operation);
    }

    /**
     * Detect conflict with existing operations
     */
    private detectConflict(operation: EditOperation): OperationConflict | null {
        // Check recent operations for conflicts
        const recentOps = this.operations.slice(-10);
        
        for (const existingOp of recentOps) {
            // Same object being modified
            if (existingOp.objectId === operation.objectId) {
                // Concurrent modification
                const timeDiff = Math.abs(existingOp.timestamp - operation.timestamp);
                if (timeDiff < 1000) { // Within 1 second
                    return {
                        operation1: existingOp,
                        operation2: operation,
                        conflictType: 'concurrent'
                    };
                }
            }
        }

        return null;
    }

    /**
     * Resolve operation conflict
     */
    private resolveConflict(conflict: OperationConflict): boolean {
        const { operation1, operation2 } = conflict;

        // Last-write-wins strategy for most operations
        if (operation2.timestamp > operation1.timestamp) {
            conflict.resolution = 'override';
            return true;
        }

        // Merge strategy for non-conflicting properties
        if (operation1.property !== operation2.property) {
            conflict.resolution = 'merge';
            return true;
        }

        // Manual resolution needed
        conflict.resolution = 'manual';
        return false;
    }

    /**
     * Apply operation to scene
     */
    private applyOperation(operation: EditOperation): void {
        this.events.emit('apply_operation', operation);
    }

    /**
     * Record local operation
     */
    public recordOperation(type: OperationType, objectId: string, property?: string, oldValue?: any, newValue?: any): void {
        const user = this.users.get(this.localUserId);
        if (!user || !this.canPerformOperation(user.role, type)) {
            console.warn('Operation not permitted');
            return;
        }

        const operation: EditOperation = {
            id: `op_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
            type,
            userId: this.localUserId,
            timestamp: Date.now(),
            objectId,
            property,
            oldValue,
            newValue
        };

        this.operations.push(operation);
        this.operationQueue.push(operation);

        this.events.emit('operation_recorded', operation);
    }

    /**
     * Check if user can perform operation
     */
    private canPerformOperation(role: UserRole, operation: OperationType): boolean {
        const rolePermissions = this.permissions.get(role);
        if (!rolePermissions) return false;

        return rolePermissions.has('*') || rolePermissions.has(operation);
    }

    /**
     * Update local user cursor
     */
    public updateCursor(x: number, y: number, z: number): void {
        const user = this.users.get(this.localUserId);
        if (user) {
            user.cursorPosition = { x, y, z };
            user.lastSeen = Date.now();
        }
    }

    /**
     * Update local user selection
     */
    public updateSelection(objectIds: string[]): void {
        const user = this.users.get(this.localUserId);
        if (user) {
            user.selectedObjects = objectIds;
            user.lastSeen = Date.now();
        }
    }

    /**
     * Update local user viewport camera
     */
    public updateViewport(position: { x: number; y: number; z: number }, rotation: { x: number; y: number; z: number }): void {
        const user = this.users.get(this.localUserId);
        if (user) {
            user.viewportCamera = { position, rotation };
            user.lastSeen = Date.now();
        }
    }

    /**
     * Start synchronization
     */
    private startSync(): void {
        if (this.syncTimer !== null) {
            return;
        }

        // Use setInterval directly for cross-environment compatibility
        this.syncTimer = setInterval(() => {
            this.broadcastUserUpdate();
            this.broadcastQueuedOperations();
        }, this.syncInterval) as unknown as number;
    }

    /**
     * Stop synchronization
     */
    private stopSync(): void {
        if (this.syncTimer !== null) {
            clearInterval(this.syncTimer);
            this.syncTimer = null;
        }
    }

    /**
     * Broadcast user update to all peers
     */
    private broadcastUserUpdate(): void {
        const user = this.users.get(this.localUserId);
        if (!user) return;

        const message = JSON.stringify({
            type: 'user_update',
            data: user
        });

        this.broadcast(message);
    }

    /**
     * Broadcast queued operations
     */
    private broadcastQueuedOperations(): void {
        if (this.operationQueue.length === 0) return;

        const operations = [...this.operationQueue];
        this.operationQueue = [];

        for (const operation of operations) {
            const message = JSON.stringify({
                type: 'operation',
                data: operation
            });

            this.broadcast(message);
        }
    }

    /**
     * Broadcast message to all connected peers
     */
    private broadcast(message: string): void {
        for (const [_peerId, channel] of this.dataChannels) {
            if (channel.readyState === 'open') {
                channel.send(message);
            }
        }
    }

    /**
     * Sync with specific peer
     */
    private syncWithPeer(peerId: string): void {
        const message = JSON.stringify({
            type: 'sync_request'
        });

        const channel = this.dataChannels.get(peerId);
        if (channel && channel.readyState === 'open') {
            channel.send(message);
        }
    }

    /**
     * Handle sync request from peer
     */
    private handleSyncRequest(peerId: string): void {
        const syncData = {
            users: Array.from(this.users.values()),
            operations: this.operations.slice(-100), // Last 100 operations
            conflicts: this.conflicts
        };

        const message = JSON.stringify({
            type: 'sync_data',
            data: syncData
        });

        const channel = this.dataChannels.get(peerId);
        if (channel && channel.readyState === 'open') {
            channel.send(message);
        }
    }

    /**
     * Handle sync data from peer
     */
    private handleSyncData(data: any): void {
        // Merge users
        for (const user of data.users) {
            if (user.id !== this.localUserId) {
                this.users.set(user.id, user);
            }
        }

        // Merge operations
        for (const operation of data.operations) {
            const exists = this.operations.some(op => op.id === operation.id);
            if (!exists) {
                this.operations.push(operation);
                this.applyOperation(operation);
            }
        }

        this.events.emit('synced');
    }

    /**
     * Get all users
     */
    public getUsers(): CollaborativeUser[] {
        return Array.from(this.users.values());
    }

    /**
     * Get local user
     */
    public getLocalUser(): CollaborativeUser | undefined {
        return this.users.get(this.localUserId);
    }

    /**
     * Get operation history
     */
    public getOperations(): EditOperation[] {
        return [...this.operations];
    }

    /**
     * Get conflicts
     */
    public getConflicts(): OperationConflict[] {
        return [...this.conflicts];
    }

    /**
     * Listen to collaboration events
     */
    public on(event: string, callback: (data: any) => void): void {
        this.events.on(event, callback);
    }

    /**
     * Remove event listener
     */
    public off(event: string, callback: (data: any) => void): void {
        this.events.off(event, callback);
    }

    /**
     * Disconnect and cleanup
     */
    public disconnect(): void {
        this.stopSync();

        // Close all data channels
        for (const channel of this.dataChannels.values()) {
            channel.close();
        }

        // Close all peer connections
        for (const connection of this.rtcConnections.values()) {
            connection.close();
        }

        this.users.clear();
        this.operations = [];
        this.conflicts = [];
        this.dataChannels.clear();
        this.rtcConnections.clear();

        this.events.emit('disconnected');
    }

    /**
     * Get session ID
     */
    public getSessionId(): string {
        return this._sessionId;
    }
}
