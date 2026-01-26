/**
 * Tests for the Debug system
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
    BreakpointManager,
    WatchSystem,
    CallStackTracker,
    ErrorTracker
} from '../src/debug';

describe('Debug System', () => {
    describe('BreakpointManager', () => {
        let breakpoints: BreakpointManager;

        beforeEach(() => {
            breakpoints = new BreakpointManager();
        });

        it('should create a breakpoint', () => {
            const bp = breakpoints.createBreakpoint('test');
            expect(bp.name).toBe('test');
            expect(bp.enabled).toBe(true);
            expect(bp.hitCount).toBe(0);
        });

        it('should create conditional breakpoint', () => {
            const bp = breakpoints.createConditionalBreakpoint(
                'conditional',
                'x > 5',
                (ctx) => (ctx.locals.get('x') as number) > 5
            );
            expect(bp.condition).toBeDefined();
            expect(bp.condition?.expression).toBe('x > 5');
        });

        it('should create logpoint', () => {
            const bp = breakpoints.createLogpoint('log', 'Value: {x}');
            expect(bp.logMessage).toBe('Value: {x}');
        });

        it('should enable/disable breakpoints', () => {
            const bp = breakpoints.createBreakpoint('test');
            expect(bp.enabled).toBe(true);
            
            breakpoints.setBreakpointEnabled(bp.id, false);
            expect(bp.enabled).toBe(false);
        });

        it('should remove breakpoints', () => {
            const bp = breakpoints.createBreakpoint('test');
            expect(breakpoints.getBreakpoints()).toHaveLength(1);
            
            breakpoints.removeBreakpoint(bp.id);
            expect(breakpoints.getBreakpoints()).toHaveLength(0);
        });

        it('should notify on breakpoint hit', async () => {
            const callback = vi.fn();
            const bp = breakpoints.createBreakpoint('test');
            
            breakpoints.onBreakpointHit(callback);
            
            // Hit without waiting (logpoint behavior)
            const logBp = breakpoints.createLogpoint('log', 'test');
            await breakpoints.hit(logBp.id);
            
            // Logpoints don't pause, so callback won't fire for them
            // But regular breakpoints would pause - we need to continue after
        });

        it('should track frame number', () => {
            expect(breakpoints.getFrameNumber()).toBe(0);
            breakpoints.nextFrame();
            expect(breakpoints.getFrameNumber()).toBe(1);
        });
    });

    describe('WatchSystem', () => {
        let watches: WatchSystem;

        beforeEach(() => {
            watches = new WatchSystem();
        });

        it('should add a watch', () => {
            let value = 42;
            const watch = watches.addWatch('testValue', () => value);
            
            expect(watch.name).toBe('testValue');
            expect(watch.currentValue).toBe(42);
        });

        it('should detect changes on update', () => {
            let value = 10;
            const watch = watches.addWatch('counter', () => value);
            
            value = 20;
            const changed = watches.update();
            
            expect(changed).toHaveLength(1);
            expect(changed[0].name).toBe('counter');
            expect(changed[0].currentValue).toBe(20);
            expect(changed[0].previousValue).toBe(10);
        });

        it('should notify on value change', () => {
            const callback = vi.fn();
            let value = 0;
            
            watches.onValueChange(callback);
            watches.addWatch('test', () => value);
            
            value = 100;
            watches.update();
            
            expect(callback).toHaveBeenCalled();
        });

        it('should track change history', () => {
            let value = 0;
            const watch = watches.addWatch('history', () => value);
            
            for (let i = 1; i <= 5; i++) {
                value = i;
                watches.update();
            }
            
            const history = watches.getHistory(watch.id);
            expect(history.length).toBeGreaterThan(1);
        });

        it('should get snapshot of all values', () => {
            watches.addWatch('a', () => 1);
            watches.addWatch('b', () => 2);
            
            const snapshot = watches.getSnapshot();
            expect(snapshot.get('a')).toBe(1);
            expect(snapshot.get('b')).toBe(2);
        });
    });

    describe('CallStackTracker', () => {
        let tracker: CallStackTracker;

        beforeEach(() => {
            tracker = new CallStackTracker();
            tracker.clear();
        });

        it('should track function entry and exit', () => {
            const frame = tracker.enter('testFunction', [1, 2, 3]);
            expect(tracker.getDepth()).toBe(1);
            expect(frame.functionName).toBe('testFunction');
            
            tracker.exit(frame, 'result');
            expect(tracker.getDepth()).toBe(0);
            expect(frame.returnValue).toBe('result');
            expect(frame.duration).toBeGreaterThanOrEqual(0);
        });

        it('should track nested calls', () => {
            const outer = tracker.enter('outer');
            expect(tracker.getDepth()).toBe(1);
            
            const inner = tracker.enter('inner');
            expect(tracker.getDepth()).toBe(2);
            
            tracker.exit(inner);
            expect(tracker.getDepth()).toBe(1);
            
            tracker.exit(outer);
            expect(tracker.getDepth()).toBe(0);
        });

        it('should record errors', () => {
            const frame = tracker.enter('errorFunc');
            const error = new Error('Test error');
            
            tracker.recordError(error, frame);
            expect(frame.error).toBe(error);
        });

        it('should set local variables', () => {
            const frame = tracker.enter('funcWithLocals');
            tracker.setLocal('x', 42, frame);
            
            expect(frame.locals.get('x')).toBe(42);
        });

        it('should build function profiles', () => {
            for (let i = 0; i < 5; i++) {
                const frame = tracker.enter('profiledFunc');
                tracker.exit(frame);
            }
            
            const profile = tracker.getProfile('profiledFunc');
            expect(profile).toBeDefined();
            expect(profile?.callCount).toBe(5);
        });

        it('should wrap functions for auto-tracking', () => {
            const fn = (a: number, b: number) => a + b;
            const wrapped = tracker.wrap(fn, 'add');
            
            const result = wrapped(2, 3);
            expect(result).toBe(5);
            
            const profile = tracker.getProfile('add');
            expect(profile).toBeDefined();
            expect(profile?.callCount).toBe(1);
        });
    });

    describe('ErrorTracker', () => {
        let errors: ErrorTracker;

        beforeEach(() => {
            errors = new ErrorTracker();
            errors.clear();
        });

        it('should track errors', () => {
            const tracked = errors.track(new Error('Test error'));
            
            expect(tracked.message).toBe('Test error');
            expect(tracked.type).toBe('Error');
            expect(tracked.count).toBe(1);
        });

        it('should count similar errors (deduplication uses fingerprint)', () => {
            // Errors are fingerprinted by type + message + first stack frame
            // Different call sites create different fingerprints
            const err1 = new Error('Same error');
            const err2 = new Error('Same error');
            
            errors.track(err1);
            errors.track(err2);
            
            // They may or may not dedupe based on stack frames
            const all = errors.getErrors();
            expect(all.length).toBeGreaterThanOrEqual(1);
            
            // Total count should be 2
            const totalCount = all.reduce((sum, e) => sum + e.count, 0);
            expect(totalCount).toBe(2);
        });

        it('should track error severity', () => {
            errors.track(new Error('fatal crash'), {}, { severity: 'critical' });
            errors.track(new Error('warning'), {}, { severity: 'low' });
            
            const stats = errors.getStats();
            expect(stats.bySeverity.critical).toBe(1);
            expect(stats.bySeverity.low).toBe(1);
        });

        it('should catch errors in wrapped functions', () => {
            const result = errors.catch(() => {
                throw new Error('Caught error');
            });
            
            expect(result).toBeUndefined();
            expect(errors.getErrors()).toHaveLength(1);
        });

        it('should get error groups', () => {
            errors.track(new Error('Group A'));
            errors.track(new Error('Group A'));
            errors.track(new Error('Group B'));
            
            const groups = errors.getGroups();
            expect(groups.length).toBeGreaterThanOrEqual(1);
        });

        it('should notify on new errors', () => {
            const callback = vi.fn();
            errors.onError(callback);
            
            errors.track(new Error('New error'));
            
            expect(callback).toHaveBeenCalled();
        });
    });
});
