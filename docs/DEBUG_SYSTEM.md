# 🔧 WebForge Debug System

Professional debugging toolkit for the WebForge game engine.

## Quick Start

```typescript
import { debugManager } from '@webforge/platform';

// Initialize with your engine
debugManager.initialize(engine, scene);

// In your game loop
function gameLoop() {
    debugManager.beginFrame();
    
    // Your game code here...
    
    debugManager.endFrame();
    requestAnimationFrame(gameLoop);
}
```

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| **`** (backtick) | Toggle debug overlay |
| **~** or **Ctrl+`** | Toggle debug console |
| **F5** | Continue execution |
| **F10** | Step over |
| **F11** | Step into |
| **Shift+F11** | Step out |
| **Ctrl+Shift+P** | Pause execution |
| **Ctrl+Shift+R** | Toggle recording |

## Features

### 1. Debug Overlay (HUD)

Real-time performance metrics displayed on screen.

```typescript
// Toggle programmatically
debugManager.showOverlay();
debugManager.hideOverlay();

// Add custom metrics
debugManager.overlay.addMetric({
    name: 'Enemies',
    getter: () => enemies.length,
    warningThreshold: 100,
    errorThreshold: 200
});
```

**Built-in metrics:**
- FPS (with graph)
- Frame time (with graph)
- Memory usage
- Draw calls
- Triangle count
- Entity count

### 2. Breakpoints

Pause execution and inspect state.

```typescript
// Create a breakpoint
const bp = debugManager.break('onPlayerDeath');

// Conditional breakpoint
debugManager.breakpoints.createConditionalBreakpoint(
    'lowHealth',
    'health < 10',
    (ctx) => player.health < 10
);

// Logpoint (logs without pausing)
debugManager.breakpoints.createLogpoint('damage', 'Took {damage} damage');

// Hit a breakpoint in your code
await debugManager.hitBreakpoint(bp.id, { player, damage });
```

### 3. Watch System

Monitor variables in real-time.

```typescript
// Watch a value
debugManager.watch('playerHealth', () => player.health);

// Watch with break-on-change
debugManager.watch('score', () => game.score, true);

// Watch all properties of an object
debugManager.watchObject(player, 'player', 2); // depth = 2

// Get current values
const snapshot = debugManager.watches.getSnapshot();
```

### 4. Call Stack Tracking

Profile function calls and find bottlenecks.

```typescript
// Track a function
const result = debugManager.trackCall('updatePhysics', () => {
    return physics.step(deltaTime);
});

// Track async function
await debugManager.trackCallAsync('loadLevel', async () => {
    return await loader.load('level1');
});

// Use @traced decorator
class Player {
    @traced
    takeDamage(amount: number) {
        this.health -= amount;
    }
}

// Get hot functions
const hotFuncs = debugManager.callStack.getHotFunctions(10);
```

### 5. Timeline Profiler

Frame-by-frame performance analysis.

```typescript
// Start recording
debugManager.startRecording();

// Profile specific sections
debugManager.profile('physics', () => physics.step());
debugManager.profile('render', () => renderer.render(), 'render');

// Add markers
debugManager.marker('Level Loaded');
debugManager.marker('Low FPS', 'warning');

// Stop and analyze
debugManager.stopRecording();
const stats = debugManager.getTimelineStats();

// Export for Chrome DevTools
const trace = debugManager.exportChromeTrace();
// Load in chrome://tracing
```

### 6. State Inspector

Deep inspection of game objects.

```typescript
// Inspect an object
const inspected = debugManager.inspect(player, 'Player');

// Get property value
const health = debugManager.inspector.getProperty(inspected.id, 'stats.health');

// Set property value (for debugging)
debugManager.inspector.setProperty(inspected.id, 'position.x', 100);

// Search across all inspected objects
const results = debugManager.inspector.search('ammo');

// Get changes since last frame
const diffs = debugManager.inspector.getDiffFromHistory(inspected.id, 1);
```

### 7. Error Tracking

Automatic error capture with context.

```typescript
// Track an error
debugManager.error(new Error('Something went wrong'), {
    level: currentLevel,
    player: player.id
});

// Track a warning
debugManager.warn('Performance degraded');

// Assert conditions
debugManager.assert(player.health >= 0, 'Health cannot be negative');

// Wrap functions for automatic tracking
const safeLoad = debugManager.errors.wrap(riskyLoadFunction);

// Get error statistics
const stats = debugManager.errors.getStats();
console.log(`Errors: ${stats.total}, Rate: ${stats.recentRate}/sec`);
```

### 8. Debug Console

In-game REPL with commands.

```typescript
// Show console
debugManager.showConsole();

// Register custom command
debugManager.registerCommand({
    name: 'spawn',
    description: 'Spawn an entity',
    usage: 'spawn <type> [x] [y] [z]',
    execute: (args, context) => {
        const [type, x, y, z] = args;
        const entity = spawn(type, { x, y, z });
        return { success: true, output: `Spawned ${type} at (${x}, ${y}, ${z})` };
    }
});
```

**Built-in commands:**
- `help` - List commands
- `clear` - Clear console
- `stats` - Show debug stats
- `fps [target]` - Show/set FPS
- `pause` / `resume` - Control game
- `breakpoints` - List breakpoints
- `watches` - List watches
- `stack` - Show call stack
- `profile` - Show hot functions
- `errors` - Show recent errors
- `record [start|stop|export]` - Timeline recording

### 9. Debug Draw

Visual debugging for physics and geometry.

```typescript
// Draw a line
debugManager.draw.line(start, end, '#ff0000', 2); // 2 second duration

// Draw a ray
debugManager.draw.ray(origin, direction, 10, '#00ff00');

// Draw a box
debugManager.draw.box(min, max, '#ffff00');
debugManager.draw.boxFromCenter(center, size);

// Draw a sphere
debugManager.draw.sphere(center, radius, '#00ffff');

// Draw axes
debugManager.draw.axes(position, scale);

// Draw a grid
debugManager.draw.grid(center, 20, 10); // 20 units, 10 divisions

// Draw a path
debugManager.draw.path(points, '#ff00ff', true); // closed path

// Draw camera frustum
debugManager.draw.frustum(pos, forward, up, fov, aspect, near, far);

// Persistent drawing (duration = -1)
debugManager.draw.grid(Vector3.zero(), 100, 50, '#333', -1);
```

## Configuration

```typescript
const debugManager = new DebugManager({
    enabled: true,
    showOverlay: false,          // Start with overlay hidden
    showConsole: false,          // Start with console hidden
    enableBreakpoints: true,
    enableWatches: true,
    enableCallStack: true,
    enableTimeline: true,
    enableErrorTracking: true,
    autoStartRecording: false,   // Don't auto-record
    keyboardShortcuts: true      // Enable keyboard shortcuts
});
```

## Exporting Debug Data

```typescript
// Export all debug data as JSON
const data = debugManager.exportData();
console.log(data);

// Export Chrome trace format (for chrome://tracing)
const trace = debugManager.exportChromeTrace();
downloadFile('trace.json', trace);
```

## API Reference

### DebugManager

| Method | Description |
|--------|-------------|
| `initialize(engine?, scene?)` | Initialize the debug system |
| `shutdown()` | Clean up and disable |
| `beginFrame()` | Call at start of frame |
| `endFrame()` | Call at end of frame |
| `break(name, condition?)` | Create breakpoint |
| `watch(name, getter, breakOnChange?)` | Watch a value |
| `inspect(obj, name?)` | Inspect an object |
| `profile(name, fn, category?)` | Profile a function |
| `marker(name, type?)` | Add timeline marker |
| `error(error, context?)` | Track an error |
| `assert(condition, message)` | Assert a condition |
| `setEnabled(enabled)` | Enable/disable debugging |

### Sub-systems

Access sub-systems directly for advanced use:

```typescript
debugManager.breakpoints  // BreakpointManager
debugManager.watches      // WatchSystem
debugManager.callStack    // CallStackTracker
debugManager.inspector    // StateInspector
debugManager.timeline     // TimelineProfiler
debugManager.overlay      // DebugOverlay
debugManager.errors       // ErrorTracker
debugManager.console      // DebugConsole
debugManager.draw         // DebugDraw
```

## Best Practices

1. **Disable in production**: `debugManager.setEnabled(false)`
2. **Use conditional breakpoints** to avoid stopping on every hit
3. **Profile specific sections** rather than entire frames
4. **Export traces** for offline analysis
5. **Clear watches** when no longer needed to save memory
