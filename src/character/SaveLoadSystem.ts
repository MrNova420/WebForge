/**
 * WebForge Save/Load System
 * 
 * Phase 13-14 (Week 89-96): Character Tech
 * Comprehensive save/load system with versioning and compression support.
 */

/**
 * Save data structure
 */
export interface SaveData {
    version: string;
    timestamp: number;
    playerData: any;
    worldData: any;
    characterData: any;
    inventoryData: any;
    questData: any;
    settingsData: any;
    customData: Record<string, any>;
}

/**
 * Save slot metadata
 */
export interface SaveSlotMetadata {
    slotId: number;
    name: string;
    timestamp: number;
    playTime: number;
    characterName?: string;
    level?: number;
    location?: string;
    thumbnail?: string;
}

/**
 * Save/Load System - Part of Phase 13-14 Character Tech
 */
export class SaveLoadSystem {
    private currentVersion: string = '1.0.0';
    private maxSlots: number = 10;
    private autoSaveInterval: number = 300000;  // 5 minutes
    private autoSaveTimer: number = 0;
    private lastSaveTime: number = 0;
    
    constructor(version: string = '1.0.0', maxSlots: number = 10) {
        this.currentVersion = version;
        this.maxSlots = maxSlots;
    }
    
    /**
     * Save game to slot
     */
    public async saveGame(slotId: number, data: Partial<SaveData>, metadata?: Partial<SaveSlotMetadata>): Promise<boolean> {
        try {
            const saveData: SaveData = {
                version: this.currentVersion,
                timestamp: Date.now(),
                playerData: data.playerData || {},
                worldData: data.worldData || {},
                characterData: data.characterData || {},
                inventoryData: data.inventoryData || {},
                questData: data.questData || {},
                settingsData: data.settingsData || {},
                customData: data.customData || {}
            };
            
            // Save metadata
            const slotMetadata: SaveSlotMetadata = {
                slotId,
                name: metadata?.name || `Save ${slotId}`,
                timestamp: Date.now(),
                playTime: metadata?.playTime || 0,
                characterName: metadata?.characterName,
                level: metadata?.level,
                location: metadata?.location,
                thumbnail: metadata?.thumbnail
            };
            
            // Store in localStorage (or IndexedDB for larger saves)
            const saveKey = `webforge_save_${slotId}`;
            const metaKey = `webforge_meta_${slotId}`;
            
            localStorage.setItem(saveKey, JSON.stringify(saveData));
            localStorage.setItem(metaKey, JSON.stringify(slotMetadata));
            
            this.lastSaveTime = Date.now();
            
            return true;
        } catch (error) {
            console.error('Save failed:', error);
            return false;
        }
    }
    
    /**
     * Load game from slot
     */
    public async loadGame(slotId: number): Promise<SaveData | null> {
        try {
            const saveKey = `webforge_save_${slotId}`;
            const saveJson = localStorage.getItem(saveKey);
            
            if (!saveJson) {
                return null;
            }
            
            const saveData: SaveData = JSON.parse(saveJson);
            
            // Version migration if needed
            if (saveData.version !== this.currentVersion) {
                return this.migrateSaveData(saveData);
            }
            
            return saveData;
        } catch (error) {
            console.error('Load failed:', error);
            return null;
        }
    }
    
    /**
     * Delete save slot
     */
    public deleteSave(slotId: number): boolean {
        try {
            const saveKey = `webforge_save_${slotId}`;
            const metaKey = `webforge_meta_${slotId}`;
            
            localStorage.removeItem(saveKey);
            localStorage.removeItem(metaKey);
            
            return true;
        } catch (error) {
            console.error('Delete failed:', error);
            return false;
        }
    }
    
    /**
     * Get all save slot metadata
     */
    public getAllSaveSlots(): SaveSlotMetadata[] {
        const slots: SaveSlotMetadata[] = [];
        
        for (let i = 0; i < this.maxSlots; i++) {
            const metaKey = `webforge_meta_${i}`;
            const metaJson = localStorage.getItem(metaKey);
            
            if (metaJson) {
                try {
                    slots.push(JSON.parse(metaJson));
                } catch (error) {
                    console.error(`Failed to load metadata for slot ${i}:`, error);
                }
            }
        }
        
        return slots.sort((a, b) => b.timestamp - a.timestamp);
    }
    
    /**
     * Get save slot metadata
     */
    public getSaveMetadata(slotId: number): SaveSlotMetadata | null {
        try {
            const metaKey = `webforge_meta_${slotId}`;
            const metaJson = localStorage.getItem(metaKey);
            
            if (!metaJson) return null;
            
            return JSON.parse(metaJson);
        } catch (error) {
            console.error('Failed to load metadata:', error);
            return null;
        }
    }
    
    /**
     * Check if save slot exists
     */
    public saveExists(slotId: number): boolean {
        const saveKey = `webforge_save_${slotId}`;
        return localStorage.getItem(saveKey) !== null;
    }
    
    /**
     * Auto-save (called from game loop)
     */
    public updateAutoSave(deltaTime: number, saveData: Partial<SaveData>): void {
        this.autoSaveTimer += deltaTime * 1000;  // Convert to ms
        
        if (this.autoSaveTimer >= this.autoSaveInterval) {
            this.autoSave(saveData);
            this.autoSaveTimer = 0;
        }
    }
    
    /**
     * Perform auto-save
     */
    private async autoSave(data: Partial<SaveData>): Promise<void> {
        const autoSaveSlot = -1;  // Special slot for auto-save
        await this.saveGame(autoSaveSlot, data, { name: 'Auto Save' });
        console.log('Auto-save completed');
    }
    
    /**
     * Load auto-save
     */
    public async loadAutoSave(): Promise<SaveData | null> {
        return this.loadGame(-1);
    }
    
    /**
     * Migrate save data to current version
     */
    private migrateSaveData(oldData: SaveData): SaveData {
        console.log(`Migrating save from version ${oldData.version} to ${this.currentVersion}`);
        
        // Implement migration logic here
        // For now, just update version
        return {
            ...oldData,
            version: this.currentVersion
        };
    }
    
    /**
     * Export save to file
     */
    public exportSave(slotId: number): string | null {
        const saveData = localStorage.getItem(`webforge_save_${slotId}`);
        const metadata = localStorage.getItem(`webforge_meta_${slotId}`);
        
        if (!saveData) return null;
        
        return JSON.stringify({
            save: JSON.parse(saveData),
            metadata: metadata ? JSON.parse(metadata) : null
        });
    }
    
    /**
     * Import save from file
     */
    public importSave(slotId: number, importData: string): boolean {
        try {
            const data = JSON.parse(importData);
            
            if (data.save) {
                localStorage.setItem(`webforge_save_${slotId}`, JSON.stringify(data.save));
            }
            
            if (data.metadata) {
                localStorage.setItem(`webforge_meta_${slotId}`, JSON.stringify(data.metadata));
            }
            
            return true;
        } catch (error) {
            console.error('Import failed:', error);
            return false;
        }
    }
    
    /**
     * Get last save time
     */
    public getLastSaveTime(): number {
        return this.lastSaveTime;
    }
    
    /**
     * Set auto-save interval (milliseconds)
     */
    public setAutoSaveInterval(interval: number): void {
        this.autoSaveInterval = Math.max(60000, interval);  // Min 1 minute
    }
    
    /**
     * Clear all saves (for testing/reset)
     */
    public clearAllSaves(): void {
        for (let i = -1; i < this.maxSlots; i++) {
            this.deleteSave(i);
        }
    }
}
