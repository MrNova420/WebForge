/**
 * AudioBuffer.ts - Audio buffer loading and caching
 * 
 * Manages loading, decoding, and caching of audio files.
 */

import { WebForgeAudioContext } from './AudioContext';

/**
 * Audio buffer load options
 */
export interface AudioLoadOptions {
    /** Force reload even if cached */
    forceReload?: boolean;
    /** Progress callback for loading */
    onProgress?: (loaded: number, total: number) => void;
}

/**
 * Audio buffer metadata
 */
export interface AudioBufferInfo {
    /** URL or identifier */
    url: string;
    /** Duration in seconds */
    duration: number;
    /** Number of channels */
    channels: number;
    /** Sample rate */
    sampleRate: number;
    /** File size in bytes */
    size: number;
    /** Load timestamp */
    loadedAt: number;
}

/**
 * Audio buffer manager
 * 
 * Handles loading, caching, and managing audio buffers for efficient
 * audio playback.
 */
export class AudioBufferManager {
    private audioContext: WebForgeAudioContext;
    private bufferCache: Map<string, AudioBuffer> = new Map();
    private bufferInfo: Map<string, AudioBufferInfo> = new Map();
    private loading: Map<string, Promise<AudioBuffer>> = new Map();

    constructor(audioContext: WebForgeAudioContext) {
        this.audioContext = audioContext;
    }

    /**
     * Load an audio file from a URL
     */
    public async load(url: string, options: AudioLoadOptions = {}): Promise<AudioBuffer> {
        // Check cache first
        if (!options.forceReload && this.bufferCache.has(url)) {
            return this.bufferCache.get(url)!;
        }

        // Check if already loading
        if (this.loading.has(url)) {
            return this.loading.get(url)!;
        }

        // Start loading
        const loadPromise = this.loadFromUrl(url, options);
        this.loading.set(url, loadPromise);

        try {
            const buffer = await loadPromise;
            this.bufferCache.set(url, buffer);
            this.loading.delete(url);

            // Store metadata
            this.bufferInfo.set(url, {
                url,
                duration: buffer.duration,
                channels: buffer.numberOfChannels,
                sampleRate: buffer.sampleRate,
                size: buffer.length * buffer.numberOfChannels * 4,
                loadedAt: Date.now()
            });

            return buffer;
        } catch (error) {
            this.loading.delete(url);
            throw error;
        }
    }

    /**
     * Load audio from URL
     */
    private async loadFromUrl(url: string, options: AudioLoadOptions): Promise<AudioBuffer> {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('GET', url, true);
            xhr.responseType = 'arraybuffer';

            xhr.onload = async () => {
                if (xhr.status === 200) {
                    try {
                        const audioBuffer = await this.audioContext.decodeAudioData(xhr.response);
                        resolve(audioBuffer);
                    } catch (error) {
                        reject(new Error(`Failed to decode audio: ${error}`));
                    }
                } else {
                    reject(new Error(`Failed to load audio: ${xhr.statusText}`));
                }
            };

            xhr.onerror = () => {
                reject(new Error('Network error loading audio'));
            };

            if (options.onProgress) {
                xhr.onprogress = (event) => {
                    if (event.lengthComputable) {
                        options.onProgress!(event.loaded, event.total);
                    }
                };
            }

            xhr.send();
        });
    }

    /**
     * Load multiple audio files
     */
    public async loadMultiple(
        urls: string[],
        options: AudioLoadOptions = {}
    ): Promise<Map<string, AudioBuffer>> {
        const promises = urls.map(url => 
            this.load(url, options).then(buffer => ({ url, buffer }))
        );

        const results = await Promise.all(promises);
        const buffers = new Map<string, AudioBuffer>();

        for (const { url, buffer } of results) {
            buffers.set(url, buffer);
        }

        return buffers;
    }

    /**
     * Get a cached buffer
     */
    public get(url: string): AudioBuffer | undefined {
        return this.bufferCache.get(url);
    }

    /**
     * Check if a buffer is cached
     */
    public has(url: string): boolean {
        return this.bufferCache.has(url);
    }

    /**
     * Get buffer info
     */
    public getInfo(url: string): AudioBufferInfo | undefined {
        return this.bufferInfo.get(url);
    }

    /**
     * Remove a buffer from cache
     */
    public unload(url: string): void {
        this.bufferCache.delete(url);
        this.bufferInfo.delete(url);
    }

    /**
     * Clear all cached buffers
     */
    public clear(): void {
        this.bufferCache.clear();
        this.bufferInfo.clear();
        this.loading.clear();
    }

    /**
     * Get total memory usage (approximate)
     */
    public getMemoryUsage(): number {
        let total = 0;
        for (const info of this.bufferInfo.values()) {
            total += info.size;
        }
        return total;
    }

    /**
     * Get number of cached buffers
     */
    public getBufferCount(): number {
        return this.bufferCache.size;
    }

    /**
     * Get all cached URLs
     */
    public getCachedUrls(): string[] {
        return Array.from(this.bufferCache.keys());
    }

    /**
     * Preload audio files
     */
    public async preload(urls: string[]): Promise<void> {
        await this.loadMultiple(urls);
    }

    /**
     * Create a silent buffer
     */
    public createSilentBuffer(duration: number, channels: number = 2): AudioBuffer {
        const sampleRate = this.audioContext.getSampleRate();
        const length = Math.ceil(duration * sampleRate);
        return this.audioContext.createBuffer(channels, length, sampleRate);
    }

    /**
     * Clone an audio buffer
     */
    public clone(source: AudioBuffer): AudioBuffer {
        const clone = this.audioContext.createBuffer(
            source.numberOfChannels,
            source.length,
            source.sampleRate
        );

        // Copy channel data
        for (let channel = 0; channel < source.numberOfChannels; channel++) {
            const sourceData = source.getChannelData(channel);
            const cloneData = clone.getChannelData(channel);
            cloneData.set(sourceData);
        }

        return clone;
    }
}
