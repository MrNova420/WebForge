/**
 * @fileoverview Network Panel for WebForge Editor
 * @module editor/panels/NetworkPanel
 * 
 * Multiplayer and network debugging panel with:
 * - Connection status monitoring
 * - Packet inspection
 * - Latency graphs
 * - Bandwidth monitoring
 * - Entity sync visualization
 */

import { Panel } from '../Panel';
import { EditorContext } from '../EditorContext';

// ============================================================================
// TYPES
// ============================================================================

/** Connection state */
export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

/** Packet direction */
export type PacketDirection = 'incoming' | 'outgoing';

/** Network packet data */
export interface NetworkPacket {
    id: number;
    timestamp: number;
    direction: PacketDirection;
    type: string;
    size: number;
    data: unknown;
    latency?: number;
}

/** Connection info */
export interface ConnectionInfo {
    id: string;
    state: ConnectionState;
    address: string;
    port: number;
    latency: number;
    packetsIn: number;
    packetsOut: number;
    bytesIn: number;
    bytesOut: number;
    connectedAt: number;
}

/** Network statistics */
export interface NetworkStats {
    currentLatency: number;
    avgLatency: number;
    packetLoss: number;
    jitter: number;
    bandwidthIn: number;
    bandwidthOut: number;
}

// ============================================================================
// NETWORK PANEL
// ============================================================================

/**
 * Network Panel
 * 
 * Network debugging and monitoring for multiplayer games.
 */
export class NetworkPanel extends Panel {
    // Connection state
    private connections: Map<string, ConnectionInfo> = new Map();
    private selectedConnectionId: string | null = null;
    
    // Packet history
    private packets: NetworkPacket[] = [];
    private maxPackets: number = 500;
    private packetIdCounter: number = 0;
    
    // Latency history
    private latencyHistory: number[] = [];
    private maxLatencyHistory: number = 100;
    
    // UI state
    private activeTab: 'overview' | 'packets' | 'latency' | 'entities' = 'overview';
    private packetFilter: string = '';
    private showIncoming: boolean = true;
    private showOutgoing: boolean = true;
    
    // Animation
    private animationFrame: number = 0;
    private graphCanvas: HTMLCanvasElement | null = null;
    private graphCtx: CanvasRenderingContext2D | null = null;
    
    // Content element
    private content: HTMLElement | null = null;

    constructor(_context: EditorContext, id: string = 'network', title: string = 'Network') {
        super(id, title);
        this.initializeTestData();
    }

    // ========================================================================
    // INITIALIZATION
    // ========================================================================

    private initializeTestData(): void {
        // Create test connection
        this.connections.set('server', {
            id: 'server',
            state: 'connected',
            address: '127.0.0.1',
            port: 7777,
            latency: 45,
            packetsIn: 1234,
            packetsOut: 1156,
            bytesIn: 156789,
            bytesOut: 89012,
            connectedAt: Date.now() - 60000
        });
        
        this.selectedConnectionId = 'server';

        // Generate test packets
        const packetTypes = ['PlayerMove', 'EntityUpdate', 'StateSync', 'Heartbeat', 'RPC'];
        for (let i = 0; i < 50; i++) {
            this.packets.push({
                id: i,
                timestamp: Date.now() - (50 - i) * 100,
                direction: Math.random() > 0.5 ? 'incoming' : 'outgoing',
                type: packetTypes[Math.floor(Math.random() * packetTypes.length)],
                size: Math.floor(Math.random() * 500) + 50,
                data: { example: 'data' },
                latency: Math.floor(Math.random() * 20) + 30
            });
        }

        // Generate latency history
        for (let i = 0; i < this.maxLatencyHistory; i++) {
            this.latencyHistory.push(40 + Math.random() * 20);
        }
    }

    // ========================================================================
    // PANEL LIFECYCLE
    // ========================================================================

    protected onMount(container: HTMLElement): void {
        this.content = document.createElement('div');
        this.content.style.cssText = `
            display: flex;
            flex-direction: column;
            background: #1e1e1e;
            color: #ddd;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            font-size: 12px;
            height: 100%;
            overflow: hidden;
        `;
        container.appendChild(this.content);
        this.renderContent();
        this.startAnimation();
    }

    protected onUpdate(_deltaTime: number): void {
        // Simulate latency updates
        if (Math.random() > 0.9) {
            this.latencyHistory.push(40 + Math.random() * 20);
            if (this.latencyHistory.length > this.maxLatencyHistory) {
                this.latencyHistory.shift();
            }
        }
    }

    protected onUnmount(): void {
        cancelAnimationFrame(this.animationFrame);
        this.content = null;
        this.graphCanvas = null;
        this.graphCtx = null;
    }

    private startAnimation(): void {
        const animate = () => {
            if (this.activeTab === 'latency' && this.graphCtx && this.graphCanvas) {
                this.renderLatencyGraph();
            }
            this.animationFrame = requestAnimationFrame(animate);
        };
        animate();
    }

    private renderContent(): void {
        if (!this.content) return;
        this.content.innerHTML = '';

        // Status bar
        const statusBar = this.createStatusBar();
        this.content.appendChild(statusBar);

        // Tabs
        const tabBar = this.createTabBar();
        this.content.appendChild(tabBar);

        // Content
        const tabContent = document.createElement('div');
        tabContent.style.cssText = 'flex: 1; overflow: auto; padding: 8px;';
        
        switch (this.activeTab) {
            case 'overview':
                this.renderOverviewTab(tabContent);
                break;
            case 'packets':
                this.renderPacketsTab(tabContent);
                break;
            case 'latency':
                this.renderLatencyTab(tabContent);
                break;
            case 'entities':
                this.renderEntitiesTab(tabContent);
                break;
        }
        
        this.content.appendChild(tabContent);
    }

    private createStatusBar(): HTMLElement {
        const statusBar = document.createElement('div');
        statusBar.style.cssText = `
            display: flex;
            align-items: center;
            gap: 16px;
            padding: 8px 12px;
            background: #252526;
            border-bottom: 1px solid #3e3e42;
        `;

        const connection = this.connections.get(this.selectedConnectionId || '');
        const isConnected = connection?.state === 'connected';

        // Status indicator
        const status = document.createElement('div');
        status.style.cssText = 'display: flex; align-items: center; gap: 6px;';
        status.innerHTML = `
            <span style="width: 8px; height: 8px; border-radius: 50%; background: ${isConnected ? '#4caf50' : '#f44336'};"></span>
            <span>${isConnected ? 'Connected' : 'Disconnected'}</span>
        `;
        statusBar.appendChild(status);

        if (connection && isConnected) {
            // Connection info
            const info = document.createElement('div');
            info.style.cssText = 'display: flex; gap: 16px; font-size: 11px; color: #888;';
            info.innerHTML = `
                <span>📍 ${connection.address}:${connection.port}</span>
                <span>📶 ${connection.latency}ms</span>
                <span>📥 ${this.formatBytes(connection.bytesIn)}</span>
                <span>📤 ${this.formatBytes(connection.bytesOut)}</span>
            `;
            statusBar.appendChild(info);
        }

        // Spacer
        const spacer = document.createElement('div');
        spacer.style.cssText = 'flex: 1;';
        statusBar.appendChild(spacer);

        // Connect/Disconnect button
        const connectBtn = document.createElement('button');
        connectBtn.textContent = isConnected ? 'Disconnect' : 'Connect';
        connectBtn.style.cssText = `
            padding: 4px 12px;
            border: none;
            background: ${isConnected ? '#f44336' : '#4caf50'};
            color: white;
            cursor: pointer;
            border-radius: 4px;
            font-size: 11px;
        `;
        connectBtn.onclick = () => this.toggleConnection();
        statusBar.appendChild(connectBtn);

        return statusBar;
    }

    private createTabBar(): HTMLElement {
        const tabBar = document.createElement('div');
        tabBar.style.cssText = `
            display: flex;
            background: #252526;
            border-bottom: 1px solid #3e3e42;
        `;

        type TabId = 'overview' | 'packets' | 'latency' | 'entities';
        const tabs: Array<{ id: TabId; label: string }> = [
            { id: 'overview', label: '📊 Overview' },
            { id: 'packets', label: '📦 Packets' },
            { id: 'latency', label: '📈 Latency' },
            { id: 'entities', label: '👥 Entities' }
        ];

        tabs.forEach(tab => {
            const tabEl = document.createElement('button');
            tabEl.textContent = tab.label;
            tabEl.style.cssText = `
                padding: 8px 16px;
                border: none;
                background: ${this.activeTab === tab.id ? '#1e1e1e' : 'transparent'};
                color: ${this.activeTab === tab.id ? '#fff' : '#888'};
                cursor: pointer;
                font-size: 12px;
                border-bottom: 2px solid ${this.activeTab === tab.id ? '#0078d4' : 'transparent'};
            `;
            tabEl.onclick = () => {
                this.activeTab = tab.id;
                this.renderContent();
            };
            tabBar.appendChild(tabEl);
        });

        return tabBar;
    }

    // ========================================================================
    // OVERVIEW TAB
    // ========================================================================

    private renderOverviewTab(container: HTMLElement): void {
        const connection = this.connections.get(this.selectedConnectionId || '');
        if (!connection) {
            container.innerHTML = '<div style="color: #888; font-style: italic;">No connection</div>';
            return;
        }

        // Stats cards
        const statsGrid = document.createElement('div');
        statsGrid.style.cssText = `
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 12px;
            margin-bottom: 16px;
        `;

        const stats: Array<{ label: string; value: string; color: string }> = [
            { label: 'Latency', value: `${connection.latency}ms`, color: connection.latency < 50 ? '#4caf50' : connection.latency < 100 ? '#ff9800' : '#f44336' },
            { label: 'Packets In', value: connection.packetsIn.toString(), color: '#2196f3' },
            { label: 'Packets Out', value: connection.packetsOut.toString(), color: '#9c27b0' },
            { label: 'Bytes In', value: this.formatBytes(connection.bytesIn), color: '#2196f3' },
            { label: 'Bytes Out', value: this.formatBytes(connection.bytesOut), color: '#9c27b0' },
            { label: 'Uptime', value: this.formatDuration(Date.now() - connection.connectedAt), color: '#4caf50' }
        ];

        stats.forEach(stat => {
            const card = document.createElement('div');
            card.style.cssText = `
                background: #252526;
                padding: 12px;
                border-radius: 4px;
                border-left: 3px solid ${stat.color};
            `;
            card.innerHTML = `
                <div style="font-size: 10px; color: #888; margin-bottom: 4px;">${stat.label}</div>
                <div style="font-size: 18px; font-weight: bold; color: ${stat.color};">${stat.value}</div>
            `;
            statsGrid.appendChild(card);
        });

        container.appendChild(statsGrid);

        // Recent packets
        const recentSection = document.createElement('div');
        recentSection.style.cssText = 'background: #252526; border-radius: 4px; padding: 12px;';
        
        const recentHeader = document.createElement('div');
        recentHeader.textContent = 'Recent Packets';
        recentHeader.style.cssText = 'font-weight: bold; margin-bottom: 12px;';
        recentSection.appendChild(recentHeader);

        const recentPackets = this.packets.slice(-10).reverse();
        recentPackets.forEach(packet => {
            const row = document.createElement('div');
            row.style.cssText = `
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 6px 0;
                border-bottom: 1px solid #3e3e42;
                font-size: 11px;
            `;
            row.innerHTML = `
                <span style="color: ${packet.direction === 'incoming' ? '#2196f3' : '#9c27b0'};">${packet.direction === 'incoming' ? '📥' : '📤'}</span>
                <span style="flex: 1;">${packet.type}</span>
                <span style="color: #888;">${packet.size}B</span>
                <span style="color: #888;">${new Date(packet.timestamp).toLocaleTimeString()}</span>
            `;
            recentSection.appendChild(row);
        });

        container.appendChild(recentSection);
    }

    // ========================================================================
    // PACKETS TAB
    // ========================================================================

    private renderPacketsTab(container: HTMLElement): void {
        // Toolbar
        const toolbar = document.createElement('div');
        toolbar.style.cssText = 'display: flex; gap: 8px; margin-bottom: 12px; align-items: center;';

        // Filter input
        const filterInput = document.createElement('input');
        filterInput.type = 'text';
        filterInput.placeholder = 'Filter packets...';
        filterInput.value = this.packetFilter;
        filterInput.style.cssText = `
            padding: 6px 10px;
            background: #1e1e1e;
            border: 1px solid #3e3e42;
            color: #ddd;
            border-radius: 4px;
            flex: 1;
        `;
        filterInput.oninput = () => {
            this.packetFilter = filterInput.value;
            this.renderContent();
        };
        toolbar.appendChild(filterInput);

        // Direction toggles
        const inBtn = document.createElement('button');
        inBtn.textContent = '📥 In';
        inBtn.style.cssText = `
            padding: 6px 12px;
            border: 1px solid #3e3e42;
            background: ${this.showIncoming ? '#2196f3' : 'transparent'};
            color: #ddd;
            cursor: pointer;
            border-radius: 4px;
        `;
        inBtn.onclick = () => {
            this.showIncoming = !this.showIncoming;
            this.renderContent();
        };
        toolbar.appendChild(inBtn);

        const outBtn = document.createElement('button');
        outBtn.textContent = '📤 Out';
        outBtn.style.cssText = `
            padding: 6px 12px;
            border: 1px solid #3e3e42;
            background: ${this.showOutgoing ? '#9c27b0' : 'transparent'};
            color: #ddd;
            cursor: pointer;
            border-radius: 4px;
        `;
        outBtn.onclick = () => {
            this.showOutgoing = !this.showOutgoing;
            this.renderContent();
        };
        toolbar.appendChild(outBtn);

        // Clear button
        const clearBtn = document.createElement('button');
        clearBtn.textContent = '🗑️';
        clearBtn.style.cssText = `
            padding: 6px 10px;
            border: 1px solid #3e3e42;
            background: transparent;
            color: #ddd;
            cursor: pointer;
            border-radius: 4px;
        `;
        clearBtn.onclick = () => {
            this.packets = [];
            this.renderContent();
        };
        toolbar.appendChild(clearBtn);

        container.appendChild(toolbar);

        // Packet list
        const filteredPackets = this.packets.filter(p => {
            if (this.packetFilter && !p.type.toLowerCase().includes(this.packetFilter.toLowerCase())) return false;
            if (!this.showIncoming && p.direction === 'incoming') return false;
            if (!this.showOutgoing && p.direction === 'outgoing') return false;
            return true;
        }).slice(-100).reverse();

        const table = document.createElement('table');
        table.style.cssText = 'width: 100%; border-collapse: collapse; font-size: 11px;';

        const header = document.createElement('tr');
        header.innerHTML = `
            <th style="padding: 8px; text-align: left; border-bottom: 1px solid #3e3e42;">Dir</th>
            <th style="padding: 8px; text-align: left; border-bottom: 1px solid #3e3e42;">Type</th>
            <th style="padding: 8px; text-align: right; border-bottom: 1px solid #3e3e42;">Size</th>
            <th style="padding: 8px; text-align: right; border-bottom: 1px solid #3e3e42;">Latency</th>
            <th style="padding: 8px; text-align: right; border-bottom: 1px solid #3e3e42;">Time</th>
        `;
        table.appendChild(header);

        filteredPackets.forEach(packet => {
            const row = document.createElement('tr');
            row.style.cssText = 'cursor: pointer;';
            row.innerHTML = `
                <td style="padding: 6px 8px; color: ${packet.direction === 'incoming' ? '#2196f3' : '#9c27b0'};">${packet.direction === 'incoming' ? '📥' : '📤'}</td>
                <td style="padding: 6px 8px;">${packet.type}</td>
                <td style="padding: 6px 8px; text-align: right;">${packet.size}B</td>
                <td style="padding: 6px 8px; text-align: right;">${packet.latency || '-'}ms</td>
                <td style="padding: 6px 8px; text-align: right;">${new Date(packet.timestamp).toLocaleTimeString()}</td>
            `;
            table.appendChild(row);
        });

        container.appendChild(table);
    }

    // ========================================================================
    // LATENCY TAB
    // ========================================================================

    private renderLatencyTab(container: HTMLElement): void {
        // Graph canvas
        this.graphCanvas = document.createElement('canvas');
        this.graphCanvas.width = 800;
        this.graphCanvas.height = 200;
        this.graphCanvas.style.cssText = 'width: 100%; height: 200px; background: #1a1a1a; border-radius: 4px;';
        this.graphCtx = this.graphCanvas.getContext('2d');
        container.appendChild(this.graphCanvas);

        // Stats
        const stats = this.calculateNetworkStats();
        const statsGrid = document.createElement('div');
        statsGrid.style.cssText = `
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 12px;
            margin-top: 16px;
        `;

        const statItems: Array<{ label: string; value: string; color: string }> = [
            { label: 'Current Latency', value: `${stats.currentLatency.toFixed(0)}ms`, color: '#2196f3' },
            { label: 'Average Latency', value: `${stats.avgLatency.toFixed(1)}ms`, color: '#4caf50' },
            { label: 'Jitter', value: `${stats.jitter.toFixed(1)}ms`, color: '#ff9800' },
            { label: 'Packet Loss', value: `${stats.packetLoss.toFixed(1)}%`, color: stats.packetLoss > 5 ? '#f44336' : '#4caf50' }
        ];

        statItems.forEach(stat => {
            const card = document.createElement('div');
            card.style.cssText = `
                background: #252526;
                padding: 12px;
                border-radius: 4px;
                border-left: 3px solid ${stat.color};
            `;
            card.innerHTML = `
                <div style="font-size: 10px; color: #888; margin-bottom: 4px;">${stat.label}</div>
                <div style="font-size: 18px; font-weight: bold; color: ${stat.color};">${stat.value}</div>
            `;
            statsGrid.appendChild(card);
        });

        container.appendChild(statsGrid);
    }

    private renderLatencyGraph(): void {
        if (!this.graphCtx || !this.graphCanvas) return;

        const ctx = this.graphCtx;
        const canvas = this.graphCanvas;
        const width = canvas.width;
        const height = canvas.height;

        // Clear
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(0, 0, width, height);

        if (this.latencyHistory.length < 2) return;

        // Draw grid
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
        
        for (let i = 0; i <= 5; i++) {
            const y = height - (i / 5) * height;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
            
            ctx.fillStyle = '#666';
            ctx.font = '10px sans-serif';
            ctx.fillText(`${(i * 20)}ms`, 5, y - 3);
        }

        // Draw latency line
        ctx.strokeStyle = '#2196f3';
        ctx.lineWidth = 2;
        ctx.beginPath();

        this.latencyHistory.forEach((latency, i) => {
            const x = (i / (this.maxLatencyHistory - 1)) * width;
            const y = height - (latency / 100) * height;
            
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });

        ctx.stroke();

        // Fill area
        ctx.lineTo(width, height);
        ctx.lineTo(0, height);
        ctx.closePath();
        ctx.fillStyle = 'rgba(33, 150, 243, 0.2)';
        ctx.fill();
    }

    // ========================================================================
    // ENTITIES TAB
    // ========================================================================

    private renderEntitiesTab(container: HTMLElement): void {
        // Network entity list (simulated)
        const entities = [
            { id: 1, type: 'Player', owner: 'local', position: '(10.5, 0, 5.2)', syncRate: 30 },
            { id: 2, type: 'Player', owner: 'remote', position: '(-5.0, 0, 8.1)', syncRate: 30 },
            { id: 3, type: 'NPC', owner: 'server', position: '(0, 0, 0)', syncRate: 10 },
            { id: 4, type: 'Projectile', owner: 'server', position: '(2.3, 1.5, 4.8)', syncRate: 60 }
        ];

        const table = document.createElement('table');
        table.style.cssText = 'width: 100%; border-collapse: collapse; font-size: 11px;';

        const header = document.createElement('tr');
        header.innerHTML = `
            <th style="padding: 8px; text-align: left; border-bottom: 1px solid #3e3e42;">ID</th>
            <th style="padding: 8px; text-align: left; border-bottom: 1px solid #3e3e42;">Type</th>
            <th style="padding: 8px; text-align: left; border-bottom: 1px solid #3e3e42;">Owner</th>
            <th style="padding: 8px; text-align: left; border-bottom: 1px solid #3e3e42;">Position</th>
            <th style="padding: 8px; text-align: right; border-bottom: 1px solid #3e3e42;">Sync Rate</th>
        `;
        table.appendChild(header);

        entities.forEach(entity => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td style="padding: 6px 8px;">#${entity.id}</td>
                <td style="padding: 6px 8px;">${entity.type}</td>
                <td style="padding: 6px 8px;">
                    <span style="padding: 2px 6px; border-radius: 10px; font-size: 10px; background: ${
                        entity.owner === 'local' ? '#4caf50' : entity.owner === 'remote' ? '#2196f3' : '#ff9800'
                    };">${entity.owner}</span>
                </td>
                <td style="padding: 6px 8px; font-family: monospace;">${entity.position}</td>
                <td style="padding: 6px 8px; text-align: right;">${entity.syncRate} Hz</td>
            `;
            table.appendChild(row);
        });

        container.appendChild(table);
    }

    // ========================================================================
    // ACTIONS
    // ========================================================================

    private toggleConnection(): void {
        const connection = this.connections.get(this.selectedConnectionId || '');
        if (connection) {
            if (connection.state === 'connected') {
                connection.state = 'disconnected';
            } else {
                connection.state = 'connecting';
                setTimeout(() => {
                    connection.state = 'connected';
                    connection.connectedAt = Date.now();
                    this.renderContent();
                }, 500);
            }
            this.renderContent();
        }
    }

    // ========================================================================
    // HELPERS
    // ========================================================================

    private calculateNetworkStats(): NetworkStats {
        const currentLatency = this.latencyHistory[this.latencyHistory.length - 1] || 0;
        const avgLatency = this.latencyHistory.reduce((a, b) => a + b, 0) / this.latencyHistory.length;
        
        // Calculate jitter (variation in latency)
        let jitterSum = 0;
        for (let i = 1; i < this.latencyHistory.length; i++) {
            jitterSum += Math.abs(this.latencyHistory[i] - this.latencyHistory[i - 1]);
        }
        const jitter = jitterSum / (this.latencyHistory.length - 1);

        return {
            currentLatency,
            avgLatency,
            packetLoss: Math.random() * 2, // Simulated
            jitter,
            bandwidthIn: Math.random() * 50000,
            bandwidthOut: Math.random() * 30000
        };
    }

    private formatBytes(bytes: number): string {
        if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
        if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${bytes} B`;
    }

    private formatDuration(ms: number): string {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        
        if (hours > 0) return `${hours}h ${minutes % 60}m`;
        if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
        return `${seconds}s`;
    }

    // ========================================================================
    // PUBLIC API
    // ========================================================================

    /**
     * Log an incoming packet
     */
    public logPacket(type: string, data: unknown, size: number): void {
        this.packets.push({
            id: this.packetIdCounter++,
            timestamp: Date.now(),
            direction: 'incoming',
            type,
            size,
            data,
            latency: this.latencyHistory[this.latencyHistory.length - 1]
        });

        if (this.packets.length > this.maxPackets) {
            this.packets.shift();
        }
    }

    /**
     * Update latency
     */
    public updateLatency(latency: number): void {
        this.latencyHistory.push(latency);
        if (this.latencyHistory.length > this.maxLatencyHistory) {
            this.latencyHistory.shift();
        }
        
        const connection = this.connections.get(this.selectedConnectionId || '');
        if (connection) {
            connection.latency = latency;
        }
    }
}
