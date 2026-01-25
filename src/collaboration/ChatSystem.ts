/**
 * ChatSystem - Real-time chat and annotations for collaboration
 * 
 * Provides text chat, voice chat, and 3D annotations
 * 
 * @module collaboration
 */

import { EventSystem } from '../core/EventSystem';
import { Vector3 } from '../math/Vector3';

/**
 * Chat message
 */
export interface ChatMessage {
    id: string;
    userId: string;
    userName: string;
    timestamp: number;
    content: string;
    type: 'text' | 'system' | 'annotation';
    metadata?: Record<string, any>;
}

/**
 * 3D annotation in scene
 */
export interface Annotation3D {
    id: string;
    userId: string;
    userName: string;
    timestamp: number;
    position: Vector3;
    content: string;
    color: string;
    resolved: boolean;
}

/**
 * ChatSystem - Manages real-time communication
 */
export class ChatSystem {
    private events: EventSystem;
    private messages: ChatMessage[];
    private annotations: Map<string, Annotation3D>;
    private maxMessages: number;
    private localUserId: string;

    constructor(localUserId: string) {
        this.events = new EventSystem();
        this.messages = [];
        this.annotations = new Map();
        this.maxMessages = 1000;
        this.localUserId = localUserId;
    }

    /**
     * Send text message
     */
    public sendMessage(content: string): ChatMessage {
        const message: ChatMessage = {
            id: this.generateMessageId(),
            userId: this.localUserId,
            userName: 'Local User', // Would be set from user data
            timestamp: Date.now(),
            content,
            type: 'text'
        };

        this.addMessage(message);
        this.events.emit('message_sent', message);

        return message;
    }

    /**
     * Receive message from remote user
     */
    public receiveMessage(message: ChatMessage): void {
        this.addMessage(message);
        this.events.emit('message_received', message);
    }

    /**
     * Add message to history
     */
    private addMessage(message: ChatMessage): void {
        this.messages.push(message);

        // Trim old messages
        if (this.messages.length > this.maxMessages) {
            this.messages = this.messages.slice(-this.maxMessages);
        }
    }

    /**
     * Add system message
     */
    public addSystemMessage(content: string): void {
        const message: ChatMessage = {
            id: this.generateMessageId(),
            userId: 'system',
            userName: 'System',
            timestamp: Date.now(),
            content,
            type: 'system'
        };

        this.addMessage(message);
        this.events.emit('system_message', message);
    }

    /**
     * Create 3D annotation
     */
    public createAnnotation(position: Vector3, content: string, color: string = '#ff9800'): Annotation3D {
        const annotation: Annotation3D = {
            id: this.generateAnnotationId(),
            userId: this.localUserId,
            userName: 'Local User',
            timestamp: Date.now(),
            position: position.clone(),
            content,
            color,
            resolved: false
        };

        this.annotations.set(annotation.id, annotation);
        this.events.emit('annotation_created', annotation);

        return annotation;
    }

    /**
     * Receive annotation from remote user
     */
    public receiveAnnotation(annotation: Annotation3D): void {
        this.annotations.set(annotation.id, annotation);
        this.events.emit('annotation_received', annotation);
    }

    /**
     * Resolve annotation
     */
    public resolveAnnotation(annotationId: string): void {
        const annotation = this.annotations.get(annotationId);
        if (annotation) {
            annotation.resolved = true;
            this.events.emit('annotation_resolved', annotation);
        }
    }

    /**
     * Delete annotation
     */
    public deleteAnnotation(annotationId: string): void {
        const annotation = this.annotations.get(annotationId);
        if (annotation) {
            this.annotations.delete(annotationId);
            this.events.emit('annotation_deleted', annotation);
        }
    }

    /**
     * Generate unique message ID
     */
    private generateMessageId(): string {
        return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    }

    /**
     * Generate unique annotation ID
     */
    private generateAnnotationId(): string {
        return `ann_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    }

    /**
     * Get all messages
     */
    public getMessages(): ChatMessage[] {
        return [...this.messages];
    }

    /**
     * Get messages since timestamp
     */
    public getMessagesSince(timestamp: number): ChatMessage[] {
        return this.messages.filter(msg => msg.timestamp >= timestamp);
    }

    /**
     * Get all annotations
     */
    public getAnnotations(): Annotation3D[] {
        return Array.from(this.annotations.values());
    }

    /**
     * Get unresolved annotations
     */
    public getUnresolvedAnnotations(): Annotation3D[] {
        return Array.from(this.annotations.values()).filter(ann => !ann.resolved);
    }

    /**
     * Listen to chat events
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
     * Clear all messages and annotations
     */
    public clear(): void {
        this.messages = [];
        this.annotations.clear();
        this.events.emit('cleared');
    }
}
