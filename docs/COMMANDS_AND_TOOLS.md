# 🛠️ WebForge Commands & Tools Reference

Complete reference for all commands, tools, and debugging features in WebForge.

---

## 📋 NPM Commands

### Development

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server at http://localhost:5173 |
| `npm run dev:editor` | Start dev server and auto-open editor |
| `npm run compile` | Compile TypeScript (one-time) |
| `npm run compile:watch` | Compile TypeScript with file watching |
| `npm run build` | Production build (compile + bundle) |
| `npm run build:watch` | Production build with watching |
| `npm run preview` | Preview production build |
| `npm run clean` | Remove dist folder |

### Testing

| Command | Description |
|---------|-------------|
| `npm test` | Run all tests once (94 tests) |
| `npm run test:watch` | Run tests with file watching |
| `npm run test:ui` | Run tests with Vitest UI |
| `npm run test:coverage` | Run tests with coverage report |

### Quality

| Command | Description |
|---------|-------------|
| `npm run lint` | TypeScript type checking |
| `npm run lint:fix` | Type check with success message |
| `npm run check` | Run both lint and tests |
| `npm run health` | Full health check (lint + test) |

### Other

| Command | Description |
|---------|-------------|
| `npm run debug` | Start Vite with Node inspector |
| `npm run docs` | View documentation location |

---

## 🎯 DevCenter - Unified Development Tool

The **DevCenter** is your all-in-one development command center. It automatically monitors EVERYTHING during development.

### Opening DevCenter

| Method | Action |
|--------|--------|
| `Ctrl+Shift+D` | Toggle DevCenter overlay |
| `F12` | Toggle DevCenter overlay |
| `Escape` | Close DevCenter overlay |
| Click indicator | Toggle DevCenter overlay |

### DevCenter Tabs

| Tab | Description |
|-----|-------------|
| 📊 **Dashboard** | Overview of project health, FPS, memory, issues |
| ⚠️ **Issues** | All errors, warnings, and issues with suggestions |
| ⚡ **Performance** | FPS, frame time, long tasks, graphs |
| 🧠 **Memory** | Heap usage, DOM nodes, listener count, leak detection |
| 🌐 **Network** | All fetch/XHR requests with status and timing |
| 💬 **Console** | Captured console.log/warn/error messages |
| 🛠️ **Tools** | Quick actions and keyboard shortcuts |

### What DevCenter Monitors Automatically

**Errors:**
- Runtime JavaScript errors
- Unhandled promise rejections
- console.error calls
- Syntax errors

**Warnings:**
- console.warn calls
- Performance warnings
- Memory warnings

**Performance:**
- FPS (frames per second)
- Frame time
- Long tasks (>50ms)
- Layout shifts

**Memory:**
- Heap size
- DOM node count
- Event listener count
- Memory leak detection

**Network:**
- fetch() requests
- XMLHttpRequest requests
- WebSocket connections
- Failed resources (scripts, CSS, images)

**Security:**
- CSP violations

### DevCenter API

```typescript
import { getDevCenter } from '@webforge/platform';

const devCenter = getDevCenter();

// Manual issue logging
devCenter.logIssue('error', 'MyCategory', 'Title', 'Message', 'Suggestion');

// Get current stats
devCenter.getFPS();        // Current FPS
devCenter.getMemoryMB();   // Memory usage in MB
devCenter.getIssues();     // All captured issues
devCenter.getProjectHealth(); // Full health report

// Overlay controls
devCenter.showOverlay();
devCenter.hideOverlay();
devCenter.toggleOverlay();

// Clear data
devCenter.clearIssues();

// Export report
devCenter.exportReport(); // Downloads JSON report
```

---

## 🔍 LiveDebugger

Enhanced debugger that works alongside DevCenter.

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `F12` / `Ctrl+Shift+D` | Toggle overlay |
| `Escape` | Close overlay |
| `Ctrl+Shift+C` | Clear issues |

### What It Catches

- Runtime errors with full stack traces
- Unhandled promise rejections
- Console errors/warnings
- Network failures (fetch/XHR)
- WebSocket connection issues
- Slow network requests
- Performance issues (low FPS)
- Memory leaks
- DOM mutation storms
- Event listener leaks
- Resource loading failures
- Security policy violations

### Smart Suggestions

LiveDebugger provides intelligent fix suggestions:

```
TypeError: Cannot read property 'x' of undefined
💡 Check if the object exists before accessing properties. Use optional chaining (?.)
```

```
WebSocket error: ws://localhost:8080
💡 Check if the WebSocket server is running. Use 'npm run server' or equivalent.
```

---

## 🐛 Debug Manager

Professional debugging for game development.

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `` ` `` (backtick) | Toggle debug overlay |
| `~` / `Ctrl+\`` | Toggle debug console |
| `F5` | Continue execution |
| `F10` | Step over |
| `F11` | Step into |
| `Shift+F11` | Step out |
| `Ctrl+Shift+P` | Pause execution |
| `Ctrl+Shift+R` | Toggle recording |

### Debug Console Commands

| Command | Description |
|---------|-------------|
| `help` | List all commands |
| `clear` | Clear console |
| `stats` | Show debug statistics |
| `fps [target]` | Show/set FPS target |
| `pause` | Pause game |
| `resume` | Resume game |
| `breakpoints` | List breakpoints |
| `watches` | List watched values |
| `stack` | Show call stack |
| `profile` | Show hot functions |
| `errors` | Show recent errors |
| `record [start\|stop\|export]` | Timeline recording |

### Debug API

```typescript
import { debugManager } from '@webforge/platform';

// Initialize
debugManager.initialize(engine, scene);

// Frame tracking
debugManager.beginFrame();
// ... your game code ...
debugManager.endFrame();

// Breakpoints
debugManager.break('onPlayerDeath');
debugManager.breakpoints.createConditionalBreakpoint(
    'lowHealth', 'health < 10', (ctx) => player.health < 10
);

// Watch values
debugManager.watch('playerHealth', () => player.health);
debugManager.watch('score', () => game.score, true); // break on change

// Profile functions
debugManager.profile('physics', () => physics.step());

// Add markers
debugManager.marker('Level Loaded');
debugManager.marker('Low FPS', 'warning');

// Track errors
debugManager.error(new Error('Something wrong'), { player, level });
debugManager.assert(health >= 0, 'Health cannot be negative');

// Visual debugging
debugManager.draw.line(start, end, '#ff0000');
debugManager.draw.box(min, max, '#00ff00');
debugManager.draw.sphere(center, radius, '#0000ff');
debugManager.draw.grid(Vector3.zero(), 100, 50);

// Export for Chrome DevTools
const trace = debugManager.exportChromeTrace();
// Load in chrome://tracing
```

---

## 🧰 DevTools Toolkit

Additional development utilities.

### Features

| Feature | Description |
|---------|-------------|
| **Assertions** | Runtime assertions with messages |
| **Performance Profiling** | Measure function execution time |
| **Memory Snapshots** | Track memory over time |
| **Network Monitoring** | Track all requests |
| **WebGL Debugging** | GL call tracking |

### API

```typescript
import { getDevTools } from '@webforge/platform';

const devTools = getDevTools();
devTools.initialize();

// Assertions
devTools.assert(condition, 'Assertion message');

// Performance
devTools.startProfile('myOperation');
// ... code ...
const duration = devTools.endProfile('myOperation');

// Memory
devTools.takeMemorySnapshot('before');
// ... code ...
devTools.takeMemorySnapshot('after');
devTools.compareSnapshots('before', 'after');

// Logging
devTools.log('Info message');
devTools.warn('Warning message');
devTools.error('Error message');
```

---

## 📁 Project Structure

```
webforge/
├── src/                    # Source code (53,000+ LOC)
│   ├── debug/             # Debug system (5,600+ LOC)
│   │   ├── DebugManager.ts
│   │   ├── Breakpoint.ts
│   │   ├── WatchSystem.ts
│   │   ├── CallStack.ts
│   │   ├── StateInspector.ts
│   │   ├── TimelineProfiler.ts
│   │   ├── DebugOverlay.ts
│   │   ├── DebugConsole.ts
│   │   ├── DebugDraw.ts
│   │   ├── ErrorTracker.ts
│   │   └── LiveDebugger.ts
│   ├── dev/               # Dev tools
│   │   ├── DevCenter.ts   # Unified dev tool (2000+ LOC)
│   │   └── DevTools.ts    # Toolkit utilities
│   ├── editor/            # Editor UI
│   ├── rendering/         # WebGL/WebGPU
│   ├── physics/           # Physics engine
│   ├── ai/                # AI systems
│   └── ...                # 28 modules total
├── tests/                 # Test files (94 tests)
├── docs/                  # Documentation
├── editor.html            # Main editor
└── package.json           # NPM config
```

---

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Start development
npm run dev

# Open editor
# Go to http://localhost:5173/editor.html

# DevCenter opens automatically on errors
# Or press Ctrl+Shift+D / F12 to toggle

# Run tests
npm test

# Full health check
npm run health
```

---

## 💡 Tips

### During Development

1. **Keep DevCenter open** - It shows issues in real-time
2. **Check Dashboard regularly** - Quick overview of project health
3. **Watch for red indicator** - Shows when errors occur
4. **Export reports** - Save debugging sessions

### Debugging Issues

1. Open DevCenter (Ctrl+Shift+D)
2. Go to Issues tab
3. Look at error category and message
4. Follow the 💡 suggestion
5. Check stack trace for location

### Performance Issues

1. Open DevCenter → Performance tab
2. Check FPS (should be 50+)
3. Check for long tasks
4. Use profiling for specific functions

### Memory Issues

1. Open DevCenter → Memory tab
2. Check heap usage over time
3. Watch for "Leak Suspected" warning
4. Check DOM node count (keep under 5000)

---

## 📚 Related Documentation

- [Debug System Guide](./DEBUG_SYSTEM.md)
- [Architecture Design](./ARCHITECTURE_DESIGN.md)
- [Getting Started](./GETTING_STARTED.md)
- [Progress Tracker](./PROGRESS.md)
