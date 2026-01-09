/**
 * WebForge Achievement System
 * 
 * Phase 13-14 (Week 89-96): Character Tech
 * Comprehensive achievement tracking with progress, unlocks, and rewards.
 */

/**
 * Achievement rarity
 */
export enum AchievementRarity {
    COMMON = 'common',
    UNCOMMON = 'uncommon',
    RARE = 'rare',
    EPIC = 'epic',
    LEGENDARY = 'legendary'
}

/**
 * Achievement definition
 */
export interface Achievement {
    id: string;
    name: string;
    description: string;
    rarity: AchievementRarity;
    icon?: string;
    points: number;
    hidden: boolean;
    
    // Progress tracking
    maxProgress: number;
    currentProgress: number;
    
    // Requirements
    requirements?: string[];
    
    // Rewards
    rewards?: {
        experience?: number;
        currency?: number;
        items?: string[];
        unlocks?: string[];
    };
    
    // Metadata
    unlocked: boolean;
    unlockedAt?: number;
    category?: string;
}

/**
 * Achievement System - Part of Phase 13-14 Character Tech
 */
export class AchievementSystem {
    private achievements: Map<string, Achievement> = new Map();
    private listeners: Array<(achievement: Achievement) => void> = [];
    private totalPoints: number = 0;
    
    constructor() {
        this.initializeDefaultAchievements();
    }
    
    /**
     * Initialize default achievements
     */
    private initializeDefaultAchievements(): void {
        // Exploration achievements
        this.registerAchievement({
            id: 'first_steps',
            name: 'First Steps',
            description: 'Start your journey',
            rarity: AchievementRarity.COMMON,
            points: 10,
            hidden: false,
            maxProgress: 1,
            currentProgress: 0,
            unlocked: false,
            category: 'exploration'
        });
        
        this.registerAchievement({
            id: 'world_explorer',
            name: 'World Explorer',
            description: 'Visit 10 different locations',
            rarity: AchievementRarity.UNCOMMON,
            points: 25,
            hidden: false,
            maxProgress: 10,
            currentProgress: 0,
            unlocked: false,
            category: 'exploration'
        });
        
        // Combat achievements
        this.registerAchievement({
            id: 'first_victory',
            name: 'First Victory',
            description: 'Defeat your first enemy',
            rarity: AchievementRarity.COMMON,
            points: 10,
            hidden: false,
            maxProgress: 1,
            currentProgress: 0,
            unlocked: false,
            category: 'combat'
        });
        
        this.registerAchievement({
            id: 'warrior',
            name: 'Warrior',
            description: 'Defeat 100 enemies',
            rarity: AchievementRarity.RARE,
            points: 50,
            hidden: false,
            maxProgress: 100,
            currentProgress: 0,
            unlocked: false,
            category: 'combat'
        });
        
        // Collection achievements
        this.registerAchievement({
            id: 'collector',
            name: 'Collector',
            description: 'Collect 50 items',
            rarity: AchievementRarity.UNCOMMON,
            points: 30,
            hidden: false,
            maxProgress: 50,
            currentProgress: 0,
            unlocked: false,
            category: 'collection'
        });
        
        // Mastery achievements
        this.registerAchievement({
            id: 'master',
            name: 'Master',
            description: 'Reach maximum level',
            rarity: AchievementRarity.EPIC,
            points: 100,
            hidden: false,
            maxProgress: 1,
            currentProgress: 0,
            unlocked: false,
            category: 'mastery'
        });
        
        // Hidden achievements
        this.registerAchievement({
            id: 'secret_discovered',
            name: '???',
            description: 'Discover the hidden secret',
            rarity: AchievementRarity.LEGENDARY,
            points: 200,
            hidden: true,
            maxProgress: 1,
            currentProgress: 0,
            unlocked: false,
            category: 'secrets'
        });
    }
    
    /**
     * Register new achievement
     */
    public registerAchievement(achievement: Achievement): void {
        this.achievements.set(achievement.id, achievement);
    }
    
    /**
     * Update achievement progress
     */
    public updateProgress(achievementId: string, progress: number): boolean {
        const achievement = this.achievements.get(achievementId);
        
        if (!achievement || achievement.unlocked) {
            return false;
        }
        
        achievement.currentProgress = Math.min(achievement.maxProgress, progress);
        
        // Check if achievement should be unlocked
        if (achievement.currentProgress >= achievement.maxProgress) {
            return this.unlockAchievement(achievementId);
        }
        
        return false;
    }
    
    /**
     * Increment achievement progress
     */
    public incrementProgress(achievementId: string, amount: number = 1): boolean {
        const achievement = this.achievements.get(achievementId);
        
        if (!achievement || achievement.unlocked) {
            return false;
        }
        
        return this.updateProgress(achievementId, achievement.currentProgress + amount);
    }
    
    /**
     * Unlock achievement
     */
    public unlockAchievement(achievementId: string): boolean {
        const achievement = this.achievements.get(achievementId);
        
        if (!achievement || achievement.unlocked) {
            return false;
        }
        
        achievement.unlocked = true;
        achievement.unlockedAt = Date.now();
        achievement.currentProgress = achievement.maxProgress;
        
        this.totalPoints += achievement.points;
        
        // Notify listeners
        for (const listener of this.listeners) {
            listener(achievement);
        }
        
        console.log(`🏆 Achievement Unlocked: ${achievement.name}`);
        
        return true;
    }
    
    /**
     * Check if achievement is unlocked
     */
    public isUnlocked(achievementId: string): boolean {
        const achievement = this.achievements.get(achievementId);
        return achievement ? achievement.unlocked : false;
    }
    
    /**
     * Get achievement
     */
    public getAchievement(achievementId: string): Achievement | undefined {
        return this.achievements.get(achievementId);
    }
    
    /**
     * Get all achievements
     */
    public getAllAchievements(includeHidden: boolean = false): Achievement[] {
        const achievements = Array.from(this.achievements.values());
        
        if (!includeHidden) {
            return achievements.filter(a => !a.hidden || a.unlocked);
        }
        
        return achievements;
    }
    
    /**
     * Get achievements by category
     */
    public getAchievementsByCategory(category: string): Achievement[] {
        return Array.from(this.achievements.values()).filter(
            a => a.category === category
        );
    }
    
    /**
     * Get unlocked achievements
     */
    public getUnlockedAchievements(): Achievement[] {
        return Array.from(this.achievements.values()).filter(a => a.unlocked);
    }
    
    /**
     * Get achievement progress percentage
     */
    public getProgressPercentage(achievementId: string): number {
        const achievement = this.achievements.get(achievementId);
        
        if (!achievement) return 0;
        
        return (achievement.currentProgress / achievement.maxProgress) * 100;
    }
    
    /**
     * Get total achievement points
     */
    public getTotalPoints(): number {
        return this.totalPoints;
    }
    
    /**
     * Get completion percentage
     */
    public getCompletionPercentage(): number {
        const total = this.achievements.size;
        const unlocked = this.getUnlockedAchievements().length;
        
        return total > 0 ? (unlocked / total) * 100 : 0;
    }
    
    /**
     * Add achievement unlock listener
     */
    public addUnlockListener(callback: (achievement: Achievement) => void): void {
        this.listeners.push(callback);
    }
    
    /**
     * Remove achievement unlock listener
     */
    public removeUnlockListener(callback: (achievement: Achievement) => void): void {
        this.listeners = this.listeners.filter(l => l !== callback);
    }
    
    /**
     * Export achievement data for save/load
     */
    public exportData(): any {
        const data: any = {};
        
        for (const [id, achievement] of this.achievements) {
            data[id] = {
                currentProgress: achievement.currentProgress,
                unlocked: achievement.unlocked,
                unlockedAt: achievement.unlockedAt
            };
        }
        
        return data;
    }
    
    /**
     * Import achievement data
     */
    public importData(data: any): void {
        for (const [id, saveData] of Object.entries(data)) {
            const achievement = this.achievements.get(id);
            
            if (achievement && saveData) {
                const saved = saveData as any;
                achievement.currentProgress = saved.currentProgress || 0;
                achievement.unlocked = saved.unlocked || false;
                achievement.unlockedAt = saved.unlockedAt;
                
                if (achievement.unlocked) {
                    this.totalPoints += achievement.points;
                }
            }
        }
    }
    
    /**
     * Reset all achievements
     */
    public reset(): void {
        for (const achievement of this.achievements.values()) {
            achievement.currentProgress = 0;
            achievement.unlocked = false;
            achievement.unlockedAt = undefined;
        }
        
        this.totalPoints = 0;
    }
    
    /**
     * Get achievement statistics
     */
    public getStatistics(): {
        total: number;
        unlocked: number;
        percentage: number;
        points: number;
        byRarity: Record<AchievementRarity, number>;
    } {
        const byRarity: Record<AchievementRarity, number> = {
            [AchievementRarity.COMMON]: 0,
            [AchievementRarity.UNCOMMON]: 0,
            [AchievementRarity.RARE]: 0,
            [AchievementRarity.EPIC]: 0,
            [AchievementRarity.LEGENDARY]: 0
        };
        
        for (const achievement of this.achievements.values()) {
            if (achievement.unlocked) {
                byRarity[achievement.rarity]++;
            }
        }
        
        return {
            total: this.achievements.size,
            unlocked: this.getUnlockedAchievements().length,
            percentage: this.getCompletionPercentage(),
            points: this.totalPoints,
            byRarity
        };
    }
}
