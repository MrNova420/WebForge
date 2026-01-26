/**
 * Tests for EventSystem core module
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventSystem } from '../src/core/EventSystem';

describe('EventSystem', () => {
    let eventSystem: EventSystem;

    beforeEach(() => {
        eventSystem = new EventSystem();
    });

    describe('Basic functionality', () => {
        it('should emit and receive events', () => {
            const handler = vi.fn();
            eventSystem.on('test', handler);
            eventSystem.emit('test', { value: 42 });
            
            expect(handler).toHaveBeenCalledTimes(1);
            expect(handler).toHaveBeenCalledWith({ value: 42 });
        });

        it('should handle multiple listeners', () => {
            const handler1 = vi.fn();
            const handler2 = vi.fn();
            
            eventSystem.on('test', handler1);
            eventSystem.on('test', handler2);
            eventSystem.emit('test', 'data');
            
            expect(handler1).toHaveBeenCalledWith('data');
            expect(handler2).toHaveBeenCalledWith('data');
        });

        it('should remove listeners with off()', () => {
            const handler = vi.fn();
            eventSystem.on('test', handler);
            eventSystem.off('test', handler);
            eventSystem.emit('test', 'data');
            
            expect(handler).not.toHaveBeenCalled();
        });

        it('should fire once() listeners only once', () => {
            const handler = vi.fn();
            eventSystem.once('test', handler);
            eventSystem.emit('test', 'first');
            eventSystem.emit('test', 'second');
            
            expect(handler).toHaveBeenCalledTimes(1);
            expect(handler).toHaveBeenCalledWith('first');
        });
    });

    describe('Event types', () => {
        it('should handle events with no data', () => {
            const handler = vi.fn();
            eventSystem.on('empty', handler);
            eventSystem.emit('empty');
            
            expect(handler).toHaveBeenCalled();
        });

        it('should handle events with complex data', () => {
            const handler = vi.fn();
            const complexData = {
                nested: { value: 42 },
                array: [1, 2, 3],
                fn: () => {}
            };
            
            eventSystem.on('complex', handler);
            eventSystem.emit('complex', complexData);
            
            expect(handler).toHaveBeenCalledWith(complexData);
        });
    });

    describe('Multiple event types', () => {
        it('should keep events separate', () => {
            const handler1 = vi.fn();
            const handler2 = vi.fn();
            
            eventSystem.on('event1', handler1);
            eventSystem.on('event2', handler2);
            
            eventSystem.emit('event1', 'data1');
            
            expect(handler1).toHaveBeenCalledWith('data1');
            expect(handler2).not.toHaveBeenCalled();
        });
    });

    describe('Clear functionality', () => {
        it('should clear all listeners', () => {
            const handler1 = vi.fn();
            const handler2 = vi.fn();
            
            eventSystem.on('test1', handler1);
            eventSystem.on('test2', handler2);
            
            eventSystem.clear();
            
            eventSystem.emit('test1', 'data');
            eventSystem.emit('test2', 'data');
            
            expect(handler1).not.toHaveBeenCalled();
            expect(handler2).not.toHaveBeenCalled();
        });
    });

    describe('Error handling', () => {
        it('should not throw if no listeners for event', () => {
            expect(() => {
                eventSystem.emit('nonexistent', 'data');
            }).not.toThrow();
        });

        it('should continue to other listeners if one throws', () => {
            const badHandler = vi.fn(() => {
                throw new Error('Handler error');
            });
            const goodHandler = vi.fn();
            
            eventSystem.on('test', badHandler);
            eventSystem.on('test', goodHandler);
            
            // Should not throw, and should call the good handler
            expect(() => {
                eventSystem.emit('test', 'data');
            }).not.toThrow();
            
            expect(goodHandler).toHaveBeenCalled();
        });
    });

    describe('Has listeners', () => {
        it('should report if event has listeners', () => {
            expect(eventSystem.hasListeners('test')).toBe(false);
            
            const handler = vi.fn();
            eventSystem.on('test', handler);
            
            expect(eventSystem.hasListeners('test')).toBe(true);
            
            eventSystem.off('test', handler);
            
            expect(eventSystem.hasListeners('test')).toBe(false);
        });
    });
});
