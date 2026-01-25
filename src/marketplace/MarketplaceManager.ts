/**
 * MarketplaceManager - Asset marketplace and template library
 * 
 * Provides asset marketplace features:
 * - Asset listing and discovery
 * - Ratings and reviews
 * - Purchase/download management
 * - Creator profiles
 * - Template library
 * 
 * @module marketplace
 */

import { EventSystem } from '../core/EventSystem';

/**
 * Asset category
 */
export enum AssetCategory {
    MODELS_3D = '3d-models',
    TEXTURES = 'textures',
    MATERIALS = 'materials',
    AUDIO = 'audio',
    SCRIPTS = 'scripts',
    TEMPLATES = 'templates',
    PLUGINS = 'plugins',
    SHADERS = 'shaders',
    ANIMATIONS = 'animations',
    PARTICLES = 'particles'
}

/**
 * Asset listing
 */
export interface Asset {
    id: string;
    name: string;
    description: string;
    category: AssetCategory;
    tags: string[];
    price: number; // 0 for free
    creatorId: string;
    creatorName: string;
    version: string;
    downloadCount: number;
    rating: number; // 0-5
    reviewCount: number;
    thumbnailUrl: string;
    previewUrls: string[];
    fileSize: number;
    lastUpdated: number;
    createdAt: number;
    license: string;
    dependencies?: string[];
}

/**
 * Asset review
 */
export interface Review {
    id: string;
    assetId: string;
    userId: string;
    userName: string;
    rating: number; // 1-5
    title: string;
    comment: string;
    helpful: number;
    timestamp: number;
}

/**
 * Creator profile
 */
export interface CreatorProfile {
    id: string;
    name: string;
    bio: string;
    website?: string;
    avatarUrl: string;
    assetsPublished: number;
    totalDownloads: number;
    averageRating: number;
    joinedAt: number;
    verified: boolean;
}

/**
 * Purchase record
 */
export interface Purchase {
    id: string;
    assetId: string;
    userId: string;
    price: number;
    timestamp: number;
    downloadUrl: string;
}

/**
 * Search filters
 */
export interface SearchFilters {
    category?: AssetCategory;
    tags?: string[];
    minRating?: number;
    maxPrice?: number;
    freeOnly?: boolean;
    sortBy?: 'popular' | 'recent' | 'rating' | 'price';
    sortOrder?: 'asc' | 'desc';
}

/**
 * MarketplaceManager - Manages asset marketplace
 */
export class MarketplaceManager {
    private events: EventSystem;
    private assets: Map<string, Asset>;
    private reviews: Map<string, Review[]>; // assetId -> reviews
    private creators: Map<string, CreatorProfile>;
    private purchases: Map<string, Purchase[]>; // userId -> purchases
    private currentUserId: string;

    constructor(userId: string = 'anonymous') {
        this.events = new EventSystem();
        this.assets = new Map();
        this.reviews = new Map();
        this.creators = new Map();
        this.purchases = new Map();
        this.currentUserId = userId;

        this.initializeSampleData();
    }

    /**
     * Initialize sample marketplace data
     */
    private initializeSampleData(): void {
        // Sample creator
        const creator: CreatorProfile = {
            id: 'creator-1',
            name: 'WebForge Team',
            bio: 'Official WebForge asset creators',
            avatarUrl: '/avatars/webforge.png',
            assetsPublished: 10,
            totalDownloads: 5000,
            averageRating: 4.8,
            joinedAt: Date.now() - 365 * 24 * 60 * 60 * 1000,
            verified: true
        };
        this.creators.set(creator.id, creator);

        // Sample asset
        const asset: Asset = {
            id: 'asset-1',
            name: 'Low Poly Character Pack',
            description: 'A collection of 20 low poly character models perfect for prototyping',
            category: AssetCategory.MODELS_3D,
            tags: ['characters', 'low-poly', 'game-ready'],
            price: 0, // Free
            creatorId: creator.id,
            creatorName: creator.name,
            version: '1.0.0',
            downloadCount: 2500,
            rating: 4.7,
            reviewCount: 45,
            thumbnailUrl: '/assets/thumbnails/characters.jpg',
            previewUrls: ['/assets/preview1.jpg', '/assets/preview2.jpg'],
            fileSize: 15 * 1024 * 1024, // 15MB
            lastUpdated: Date.now(),
            createdAt: Date.now() - 90 * 24 * 60 * 60 * 1000,
            license: 'CC0 - Public Domain'
        };
        this.assets.set(asset.id, asset);
    }

    /**
     * Publish asset to marketplace
     */
    public publishAsset(asset: Omit<Asset, 'id' | 'downloadCount' | 'rating' | 'reviewCount' | 'createdAt' | 'lastUpdated'>): Asset {
        const newAsset: Asset = {
            ...asset,
            id: this.generateAssetId(),
            downloadCount: 0,
            rating: 0,
            reviewCount: 0,
            createdAt: Date.now(),
            lastUpdated: Date.now()
        };

        this.assets.set(newAsset.id, newAsset);
        this.events.emit('asset_published', newAsset);

        return newAsset;
    }

    /**
     * Search assets
     */
    public searchAssets(query: string, filters?: SearchFilters): Asset[] {
        let results = Array.from(this.assets.values());

        // Apply text search
        if (query) {
            const searchTerms = query.toLowerCase().split(' ');
            results = results.filter(asset => {
                const searchText = `${asset.name} ${asset.description} ${asset.tags.join(' ')}`.toLowerCase();
                return searchTerms.every(term => searchText.includes(term));
            });
        }

        // Apply filters
        if (filters) {
            if (filters.category) {
                results = results.filter(asset => asset.category === filters.category);
            }

            if (filters.tags && filters.tags.length > 0) {
                results = results.filter(asset => 
                    filters.tags!.some(tag => asset.tags.includes(tag))
                );
            }

            if (filters.minRating !== undefined) {
                results = results.filter(asset => asset.rating >= filters.minRating!);
            }

            if (filters.maxPrice !== undefined) {
                results = results.filter(asset => asset.price <= filters.maxPrice!);
            }

            if (filters.freeOnly) {
                results = results.filter(asset => asset.price === 0);
            }

            // Apply sorting
            if (filters.sortBy) {
                const order = filters.sortOrder === 'asc' ? 1 : -1;

                results.sort((a, b) => {
                    switch (filters.sortBy) {
                        case 'popular':
                            return (b.downloadCount - a.downloadCount) * order;
                        case 'recent':
                            return (b.createdAt - a.createdAt) * order;
                        case 'rating':
                            return (b.rating - a.rating) * order;
                        case 'price':
                            return (a.price - b.price) * order;
                        default:
                            return 0;
                    }
                });
            }
        }

        return results;
    }

    /**
     * Get asset details
     */
    public getAsset(assetId: string): Asset | undefined {
        return this.assets.get(assetId);
    }

    /**
     * Add review to asset
     */
    public addReview(assetId: string, rating: number, title: string, comment: string): Review {
        const review: Review = {
            id: this.generateReviewId(),
            assetId,
            userId: this.currentUserId,
            userName: 'Current User',
            rating: Math.max(1, Math.min(5, rating)),
            title,
            comment,
            helpful: 0,
            timestamp: Date.now()
        };

        if (!this.reviews.has(assetId)) {
            this.reviews.set(assetId, []);
        }
        this.reviews.get(assetId)!.push(review);

        // Update asset rating
        this.updateAssetRating(assetId);

        this.events.emit('review_added', review);

        return review;
    }

    /**
     * Update asset rating based on reviews
     */
    private updateAssetRating(assetId: string): void {
        const asset = this.assets.get(assetId);
        const reviews = this.reviews.get(assetId);

        if (!asset || !reviews || reviews.length === 0) return;

        const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
        asset.rating = totalRating / reviews.length;
        asset.reviewCount = reviews.length;
    }

    /**
     * Get reviews for asset
     */
    public getReviews(assetId: string): Review[] {
        return this.reviews.get(assetId) || [];
    }

    /**
     * Purchase/download asset
     */
    public purchaseAsset(assetId: string): Purchase {
        const asset = this.assets.get(assetId);
        if (!asset) {
            throw new Error('Asset not found');
        }

        const purchase: Purchase = {
            id: this.generatePurchaseId(),
            assetId,
            userId: this.currentUserId,
            price: asset.price,
            timestamp: Date.now(),
            downloadUrl: `/downloads/${assetId}`
        };

        if (!this.purchases.has(this.currentUserId)) {
            this.purchases.set(this.currentUserId, []);
        }
        this.purchases.get(this.currentUserId)!.push(purchase);

        // Increment download count
        asset.downloadCount++;

        this.events.emit('asset_purchased', purchase);

        return purchase;
    }

    /**
     * Get user's purchases
     */
    public getUserPurchases(): Purchase[] {
        return this.purchases.get(this.currentUserId) || [];
    }

    /**
     * Get creator profile
     */
    public getCreator(creatorId: string): CreatorProfile | undefined {
        return this.creators.get(creatorId);
    }

    /**
     * Get assets by creator
     */
    public getAssetsByCreator(creatorId: string): Asset[] {
        return Array.from(this.assets.values()).filter(asset => asset.creatorId === creatorId);
    }

    /**
     * Get featured assets
     */
    public getFeaturedAssets(count: number = 10): Asset[] {
        return Array.from(this.assets.values())
            .sort((a, b) => {
                // Sort by combination of rating and download count
                const scoreA = a.rating * Math.log(a.downloadCount + 1);
                const scoreB = b.rating * Math.log(b.downloadCount + 1);
                return scoreB - scoreA;
            })
            .slice(0, count);
    }

    /**
     * Generate unique IDs
     */
    private generateAssetId(): string {
        return `asset_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    }

    private generateReviewId(): string {
        return `review_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    }

    private generatePurchaseId(): string {
        return `purchase_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    }

    /**
     * Listen to marketplace events
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
}
