import { NetworkManager, NetworkMessage, MessageType, NetworkClient } from './NetworkManager';

/**
 * WebSocket-based network manager
 * 
 * Implements client-server networking using WebSockets.
 */
export class WebSocketNetworkManager extends NetworkManager {
    private socket: WebSocket | null = null;
    private reconnectAttempts: number = 0;
    private maxReconnectAttempts: number = 5;
    private reconnectDelay: number = 2000;

    /**
     * Connect to WebSocket server
     */
    public async connect(address: string): Promise<void> {
        return new Promise((resolve, reject) => {
            try {
                this.socket = new WebSocket(address);

                this.socket.onopen = () => {
                    console.log('WebSocket connected');
                    this.reconnectAttempts = 0;
                    this.localClientId = this.generateClientId();
                    resolve();
                };

                this.socket.onmessage = (event) => {
                    this.handleSocketMessage(event);
                };

                this.socket.onerror = (error) => {
                    console.error('WebSocket error:', error);
                    reject(error);
                };

                this.socket.onclose = () => {
                    console.log('WebSocket closed');
                    this.handleDisconnect();
                };
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Disconnect from server
     */
    public disconnect(): void {
        if (this.socket) {
            this.socket.close();
            this.socket = null;
        }

        this.clients.clear();
    }

    /**
     * Send message via WebSocket
     */
    public send(message: NetworkMessage, targetId?: string): void {
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
            console.warn('WebSocket not connected');
            return;
        }

        const packet = {
            ...message,
            targetId
        };

        this.socket.send(JSON.stringify(packet));
    }

    /**
     * Handle incoming WebSocket message
     */
    private handleSocketMessage(event: MessageEvent): void {
        try {
            const message: NetworkMessage = JSON.parse(event.data);

            // Update client info
            if (message.senderId) {
                const client = this.clients.get(message.senderId);
                if (client) {
                    client.lastMessageTime = Date.now();

                    if (message.type === MessageType.PONG) {
                        client.latency = Date.now() - message.timestamp;
                    }
                } else {
                    // New client
                    this.clients.set(message.senderId, {
                        id: message.senderId,
                        isConnected: true,
                        latency: 0,
                        lastMessageTime: Date.now()
                    });
                }
            }

            this.handleMessage(message);

            // Auto-respond to ping
            if (message.type === MessageType.PING) {
                this.send(this.createMessage(MessageType.PONG, {}, false), message.senderId);
            }
        } catch (error) {
            console.error('Failed to parse WebSocket message:', error);
        }
    }

    /**
     * Handle disconnect
     */
    private handleDisconnect(): void {
        // Attempt reconnect
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            console.log(`Reconnecting... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

            setTimeout(() => {
                if (this.socket && this.socket.url) {
                    this.connect(this.socket.url).catch(console.error);
                }
            }, this.reconnectDelay);
        } else {
            console.error('Max reconnect attempts reached');
        }
    }

    /**
     * Generate unique client ID
     */
    private generateClientId(): string {
        return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Check if connected
     */
    public isConnected(): boolean {
        return this.socket !== null && this.socket.readyState === WebSocket.OPEN;
    }
}
