# 🔥 WebForge vs 🌟 NovaHub — Project Comparison

> **Note:** The URL `https://github.com/MrNova420/Nova-Forge.git` does not exist (404).
> This comparison uses **NovaHub** (`MrNova420/NovaHub`) — your other main TypeScript project — as the closest match.
> If "Nova-Forge" is a private repo or a different project, please share its details and we can update this document.

---

## 📋 At a Glance

| Aspect | 🔥 WebForge | 🌟 NovaHub |
|--------|-------------|------------|
| **What It Is** | Browser-based game engine + visual editor + 3D modeler | AI-powered coding assistant / development hub |
| **Category** | Game Development Platform | Developer Productivity Tool |
| **Language** | TypeScript (100%) | TypeScript (primary), with Bun/Node.js tooling |
| **Runtime** | Browser (WebGL/WebGPU) | Terminal (TUI) + Desktop + Web |
| **Build Tool** | Vite | Turborepo + Bun |
| **Package Manager** | npm | Bun (monorepo with workspaces) |
| **Architecture** | Single-package, modular `src/` | Monorepo with 17+ packages |
| **Based On** | Original creation | Fork/rebrand of [OpenCode](https://github.com/anomalyco/opencode) |
| **Status** | Phase 10 — Feature-Complete (active) | v0.0.1 — In Development |
| **Created** | Jan 6, 2026 | Feb 1, 2026 |
| **Last Commit** | Feb 2, 2026 | Feb 1, 2026 |
| **License** | MIT | MIT |

---

## 🏗️ Architecture Comparison

### WebForge — Single Package, Deep Module Tree

```
webforge/
├── src/                    ← One codebase, 33 modules
│   ├── core/               # Engine lifecycle, events, input, time
│   ├── math/               # Vector2/3/4, Matrix4, Quaternion, Transform
│   ├── rendering/          # WebGL renderer, shaders, materials, effects
│   ├── physics/            # Rigid body, collision (GJK), constraints
│   ├── animation/          # Skeletal, IK, blend trees, state machines
│   ├── audio/              # 3D spatial audio, effects, music
│   ├── editor/             # Visual editor (panels, gizmos, camera)
│   ├── scene/              # GameObject, Scene hierarchy
│   ├── geometry/           # Mesh creation, modifiers, sculpting
│   ├── terrain/            # Heightmap, LOD, painting
│   ├── ai/                 # NavMesh, behavior trees, steering
│   ├── particles/          # CPU/GPU particle systems
│   ├── network/            # WebRTC P2P, WebSocket
│   ├── scripting/          # Visual scripting (node graph)
│   ├── debug/              # Live debugger, profiler, breakpoints
│   ├── vfx/                # Advanced visual effects
│   ├── weather/            # Weather simulation
│   ├── water/              # Water rendering
│   ├── character/          # Character customization, clothing physics
│   ├── collaboration/      # Real-time collaboration
│   ├── procedural/         # Procedural generation
│   ├── optimization/       # Frustum culling, LOD, instancing
│   └── ... 10 more modules
├── tests/                  # 9 test files, 579 tests
├── index.html              # Landing page
├── editor.html             # Full visual editor UI
└── docs/                   # Comprehensive documentation
```

**Strengths:** Everything in one place. A developer can `npm install` and get the entire engine. The module tree is deep but organized by domain.

### NovaHub — Monorepo with 17+ Packages

```
novahub/
├── packages/
│   ├── novahub/            ← Core CLI / AI coding assistant
│   │   └── src/
│   │       ├── agent/      # AI agent system (build, plan, general)
│   │       ├── tool/       # Tool integrations (file, bash, search)
│   │       ├── session/    # Session management
│   │       ├── provider/   # LLM providers (Claude, OpenAI, etc.)
│   │       ├── lsp/        # Language Server Protocol
│   │       ├── config/     # Configuration management
│   │       ├── cli/        # CLI interface
│   │       ├── server/     # Client/server architecture
│   │       └── ... 20+ modules
│   ├── app/                # Desktop Tauri application
│   ├── web/                # Marketing website (Astro + SolidJS)
│   ├── desktop/            # Desktop packaging
│   ├── ui/                 # Shared UI components
│   ├── console/            # Admin console
│   ├── enterprise/         # Enterprise features
│   ├── docs/               # Documentation site
│   ├── sdk/                # JavaScript SDK
│   ├── plugin/             # Plugin system
│   ├── extensions/         # Extension marketplace
│   ├── identity/           # Auth system
│   ├── function/           # Serverless functions
│   ├── containers/         # Docker containers
│   ├── slack/              # Slack integration
│   └── util/               # Shared utilities
├── infra/                  # SST (Serverless Stack) infrastructure
├── sdks/                   # Additional SDKs
├── specs/                  # API specifications
└── themes/                 # TUI themes
```

**Strengths:** Clean separation of concerns. Each package can be versioned and published independently. The monorepo structure supports a larger team and diverse deployment targets (CLI, desktop, web, enterprise).

---

## 🔧 Tech Stack Comparison

| Technology | WebForge | NovaHub |
|-----------|----------|---------|
| **Language** | TypeScript 5.9 | TypeScript 5.8 |
| **Runtime** | Browser (DOM, WebGL) | Bun / Node.js |
| **Build** | Vite 6.4 | Turborepo + Bun |
| **Testing** | Vitest 4.0 + happy-dom | Bun test |
| **UI Framework** | Vanilla DOM (custom editor) | SolidJS + Ink (TUI) |
| **Web Framework** | None (static HTML) | Astro + SolidJS (website) |
| **CSS** | CSS Variables (dark theme) | Tailwind CSS 4 |
| **Infrastructure** | Static files only | SST (Cloudflare, Stripe, PlanetScale) |
| **Desktop** | N/A (browser-only) | Tauri |
| **Linting** | TypeScript strict (`tsc --noEmit`) | Prettier + TypeScript |
| **Monorepo Tool** | N/A (single package) | Turborepo |
| **Package Manager** | npm | Bun |
| **CI/CD** | GitHub Actions | GitHub Actions |

---

## 🧪 Testing Comparison

| Metric | WebForge | NovaHub |
|--------|----------|---------|
| **Framework** | Vitest | Bun test |
| **Test Files** | 6 | Per-package |
| **Total Tests** | 105 passing | Work in progress |
| **Test Environment** | happy-dom (browser sim) | Node/Bun native |
| **Coverage Tool** | @vitest/coverage-v8 | — |
| **Test Categories** | Math, Events, Debug, Editor, Rendering, Integration | Agent, tools, session |
| **Timeout** | 10s | Default |

**WebForge advantage:** Solid test foundation with 105 passing tests covering math, events, rendering, debugging, and editor runtime.

**NovaHub advantage:** Per-package test isolation in a monorepo — cleaner for large teams.

---

## 🎯 Feature Domains

### What WebForge Does (That NovaHub Doesn't)

| Feature | Details |
|---------|---------|
| 🎮 **Game Engine** | Full game loop with fixed/variable timestep |
| 🎨 **WebGL Renderer** | Forward rendering, PBR materials, shadow mapping |
| ⚡ **Physics Engine** | Rigid body dynamics, GJK collision, constraints |
| 🎭 **Animation System** | Skeletal, IK, blend trees, state machines |
| 🔊 **3D Spatial Audio** | Positional audio, effects, adaptive music |
| 🧊 **3D Modeling** | Geometry tools, sculpting, UV editing |
| 🌍 **Terrain System** | Heightmap terrain, LOD, painting |
| 🎆 **Particle System** | CPU/GPU particles, emitters, forces |
| 🤖 **AI/Navigation** | NavMesh, behavior trees, steering |
| 📜 **Visual Scripting** | Node-based programming |
| 🌐 **Multiplayer** | WebRTC P2P, WebSocket networking |
| 🛠️ **Visual Editor** | Unity-like editor with hierarchy, inspector, scene view |

### What NovaHub Does (That WebForge Doesn't)

| Feature | Details |
|---------|---------|
| 🤖 **AI Coding Assistant** | LLM-powered code generation and editing |
| 🧠 **Multi-Provider AI** | Claude, OpenAI, Google, local models |
| 📟 **Terminal UI (TUI)** | Rich terminal interface with themes |
| 🔌 **LSP Support** | Language Server Protocol integration |
| 🏢 **Enterprise Features** | Admin console, identity management |
| 🖥️ **Desktop App** | Native desktop via Tauri |
| 📦 **Plugin System** | Extensible with plugins/extensions |
| ☁️ **Cloud Infrastructure** | SST with Cloudflare, Stripe, PlanetScale |
| 🔄 **Session Management** | Persistent coding sessions with sharing |
| 🛠️ **Tool System** | File editing, bash execution, search tools |

---

## 📊 Codebase Metrics

| Metric | WebForge | NovaHub |
|--------|----------|---------|
| **Source Modules** | 30+ directories in `src/` | 17+ packages in `packages/` |
| **Core Entry** | `src/index.ts` (exports all) | `packages/novahub/src/index.ts` |
| **HTML Entry Points** | 2 (`index.html`, `editor.html`) | Astro website |
| **Dependencies** | 6 dev deps (minimal!) | 50+ across monorepo |
| **Build Output** | `dist/` — static JS + HTML | Per-package `dist/` + binaries |
| **Total README size** | ~437 lines | ~200 lines (+ per-package READMEs) |
| **Documentation** | 18 markdown files in `docs/` | AI_MODEL_BUNDLING_PLAN, BUILD_SUCCESS, etc. |

---

## 💡 What Each Project Can Learn from the Other

### What WebForge Could Adopt from NovaHub

1. **Monorepo structure** — As WebForge grows, splitting into `@webforge/math`, `@webforge/renderer`, `@webforge/physics` packages (already planned in README) would benefit from Turborepo/workspaces
2. **Prettier/ESLint** — NovaHub uses Prettier for consistent formatting; WebForge currently has no formatter
3. **Desktop packaging** — NovaHub's Tauri integration could inspire WebForge desktop export
4. **Plugin system** — NovaHub's extension/plugin architecture could inspire WebForge's modding support
5. **Cloud infrastructure** — SST patterns could help with WebForge's future collaboration features

### What NovaHub Could Adopt from WebForge

1. **Comprehensive testing** — WebForge's 105-test suite with Vitest is more mature
2. **Minimal dependencies** — WebForge runs with only 6 devDependencies; NovaHub has 50+
3. **Self-contained build** — WebForge's single `npm run build` produces static files; simpler CI/CD
4. **Browser-first architecture** — WebForge's zero-install approach could inspire NovaHub's web client
5. **Documentation depth** — WebForge has 18 detailed docs covering architecture, debugging, performance, etc.

---

## 🔗 Synergy Opportunities

These two projects could complement each other:

| Integration Idea | Description |
|-----------------|-------------|
| **NovaHub as WebForge's AI assistant** | Use NovaHub's AI agents to help write game scripts inside WebForge's visual scripting system |
| **WebForge as NovaHub's 3D preview** | Embed WebForge's renderer in NovaHub for visualizing 3D code changes |
| **Shared TypeScript utilities** | Common math, event, and utility libraries could be shared |
| **NovaHub plugin for WebForge** | A NovaHub extension that understands WebForge's API for intelligent game dev assistance |
| **Unified branding** | Both under the "WeNova Interactive" umbrella with cross-links |

---

## 📈 Development Activity

| Timeline | WebForge | NovaHub |
|----------|----------|---------|
| **Created** | Jan 6, 2026 | Feb 1, 2026 |
| **Last active** | Feb 2, 2026 | Feb 1, 2026 |
| **Focus** | Engine core, editor UI, rendering | AI response system, tool calling |
| **Recent work** | Grid fix, drag placement, keybinds | Qwen AI response parsing fixes |

---

## 🏆 Summary

| | WebForge | NovaHub |
|-|----------|---------|
| **Vision** | Be the browser-based Unreal+Unity+Blender | Be the AI-powered coding assistant hub |
| **Maturity** | More mature codebase with 105 tests, full build pipeline | Earlier stage with active AI integration work |
| **Complexity** | Deep single-package with 30+ modules | Wide monorepo with 17+ packages |
| **Unique Value** | Zero-install game dev in the browser | Provider-agnostic AI coding in the terminal |
| **Best For** | Game developers, educators, web developers | Software engineers, teams, AI-assisted coding |

**Both projects are ambitious, TypeScript-first platforms with complementary strengths. WebForge excels in its self-contained game engine architecture, while NovaHub brings AI-powered developer tooling and enterprise-grade infrastructure. Together, they represent a comprehensive development ecosystem.**

---

*Comparison generated on March 1, 2026 • By MrNova420 / WeNova Interactive*
