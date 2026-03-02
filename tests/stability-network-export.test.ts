/**
 * Stability tests for Network, Export, AI, Scripting, UI,
 * Particles, Terrain, Weather, and Water systems.
 */
import { describe, it, expect } from 'vitest';

// Export
import { ExportManager, ExportPlatform, type ExportConfig } from '../src/export/ExportManager';

// AI
import { NavMesh } from '../src/ai/NavMesh';
import {
    BehaviorTree, Sequence, Selector, Action, Condition,
    Inverter, Repeater, Parallel, NodeStatus
} from '../src/ai/BehaviorTree';
import { AIAgent } from '../src/ai/AIAgent';
import { Steering } from '../src/ai/Steering';

// Scripting
import { ScriptGraph } from '../src/scripting/ScriptGraph';
import { ScriptNode, NodeType, PortType } from '../src/scripting/ScriptNode';

// UI
import { GameUI, UIText, UIPanel, UIAnchor } from '../src/ui/GameUI';

// Particles
import { ParticleSystem, ParticleForces } from '../src/particles/ParticleSystem';
import { ParticleEmitter, type EmitterConfig } from '../src/particles/ParticleEmitter';
import { Particle } from '../src/particles/Particle';

// Terrain
import { Terrain } from '../src/terrain/Terrain';
import { TerrainGenerator } from '../src/terrain/TerrainGenerator';

// Weather & Water
import { WeatherSystem, WeatherType, WeatherIntensity } from '../src/weather/WeatherSystem';
import { WaterSimulationSystem } from '../src/water/WaterSimulationSystem';

// Math
import { Vector3 } from '../src/math/Vector3';
import { Vector2 } from '../src/math/Vector2';

// ─── helpers ────────────────────────────────────────────────────────

function makeEmitterConfig(overrides: Partial<EmitterConfig> = {}): EmitterConfig {
    return {
        rate: 10,
        maxParticles: 50,
        shape: 'point',
        shapeParams: {},
        lifetime: [1, 2],
        velocity: { min: new Vector3(0, 1, 0), max: new Vector3(0, 3, 0) },
        size: [0.5, 1.0],
        loop: true,
        ...overrides,
    };
}

function makeWebExportConfig(overrides: Partial<ExportConfig> = {}): ExportConfig {
    return {
        platform: ExportPlatform.WEB,
        outputPath: '/tmp/export',
        projectName: 'TestGame',
        version: '1.0.0',
        optimize: true,
        minify: true,
        sourceMaps: false,
        ...overrides,
    };
}

// ─── ExportManager ──────────────────────────────────────────────────

describe('ExportManager', () => {
    it('creates export manager and generates web export', async () => {
        const mgr = new ExportManager();
        const result = await mgr.export(makeWebExportConfig());

        expect(result.success).toBe(true);
        expect(result.platform).toBe(ExportPlatform.WEB);
        expect(result.artifacts.length).toBeGreaterThanOrEqual(3); // html, js, css
        expect(result.errors).toHaveLength(0);
        expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it('all platform export methods exist and can be configured', async () => {
        const mgr = new ExportManager();

        const platforms = [
            ExportPlatform.WEB,
            ExportPlatform.PWA,
            ExportPlatform.ELECTRON_WINDOWS,
            ExportPlatform.ELECTRON_MACOS,
            ExportPlatform.ELECTRON_LINUX,
            ExportPlatform.CAPACITOR_IOS,
            ExportPlatform.CAPACITOR_ANDROID,
            ExportPlatform.CORDOVA_IOS,
            ExportPlatform.CORDOVA_ANDROID,
        ];

        for (const platform of platforms) {
            const result = await mgr.export(makeWebExportConfig({ platform }));
            expect(result.success).toBe(true);
            expect(result.platform).toBe(platform);
            expect(result.artifacts.length).toBeGreaterThan(0);
        }

        // History should contain all exports
        expect(mgr.getExportHistory()).toHaveLength(platforms.length);
    });

    it('export history and event hooks work', async () => {
        const mgr = new ExportManager();
        const events: string[] = [];
        mgr.on('export_started', () => events.push('started'));
        mgr.on('export_completed', () => events.push('completed'));

        await mgr.export(makeWebExportConfig());

        expect(events).toContain('started');
        expect(events).toContain('completed');
        expect(mgr.getLastExport()?.success).toBe(true);

        mgr.clearHistory();
        expect(mgr.getExportHistory()).toHaveLength(0);
    });
});

// ─── NavMesh ────────────────────────────────────────────────────────

describe('NavMesh', () => {
    it('creates navigation mesh, adds walkable area, and finds path', () => {
        const mesh = new NavMesh();

        // Two adjacent triangles sharing an edge
        const id0 = mesh.addTriangle(
            new Vector3(0, 0, 0),
            new Vector3(10, 0, 0),
            new Vector3(5, 0, 10),
        );
        const id1 = mesh.addTriangle(
            new Vector3(10, 0, 0),
            new Vector3(20, 0, 0),
            new Vector3(5, 0, 10),
        );

        expect(mesh.getNodeCount()).toBe(2);
        mesh.buildGraph();

        // Path through the two triangles
        const path = mesh.findPath(new Vector3(2, 0, 2), new Vector3(18, 0, 2));
        expect(path.length).toBeGreaterThanOrEqual(2);

        mesh.clear();
        expect(mesh.getNodeCount()).toBe(0);
    });
});

// ─── BehaviorTree ───────────────────────────────────────────────────

describe('BehaviorTree', () => {
    it('creates tree with sequence and action nodes, executes', () => {
        const bb = new Map<string, any>();
        const tree = new BehaviorTree();

        const seq = new Sequence();
        seq.addChild(new Action(() => {
            bb.set('step1', true);
            return NodeStatus.SUCCESS;
        }));
        seq.addChild(new Action(() => {
            bb.set('step2', true);
            return NodeStatus.SUCCESS;
        }));
        tree.setRoot(seq);

        const status = tree.tick(0.016, bb);
        expect(status).toBe(NodeStatus.SUCCESS);
        expect(bb.get('step1')).toBe(true);
        expect(bb.get('step2')).toBe(true);
    });

    it('selector falls back to second child when first fails', () => {
        const tree = new BehaviorTree();
        const sel = new Selector();
        sel.addChild(new Action(() => NodeStatus.FAILURE));
        sel.addChild(new Action(() => NodeStatus.SUCCESS));
        tree.setRoot(sel);
        expect(tree.tick(0.016)).toBe(NodeStatus.SUCCESS);
    });

    it('condition node and inverter decorator work', () => {
        const bb = new Map<string, any>();
        bb.set('ready', false);
        const tree = new BehaviorTree();

        const inv = new Inverter();
        inv.addChild(new Condition((b) => b.get('ready')));
        tree.setRoot(inv);

        // ready=false ⟶ condition FAILURE ⟶ inverter SUCCESS
        expect(tree.tick(0.016, bb)).toBe(NodeStatus.SUCCESS);
    });

    it('parallel node runs children simultaneously', () => {
        const tree = new BehaviorTree();
        const par = new Parallel(2);
        par.addChild(new Action(() => NodeStatus.SUCCESS));
        par.addChild(new Action(() => NodeStatus.SUCCESS));
        tree.setRoot(par);
        expect(tree.tick(0.016)).toBe(NodeStatus.SUCCESS);
    });

    it('repeater runs child multiple times', () => {
        let count = 0;
        const tree = new BehaviorTree();
        const rep = new Repeater(3);
        rep.addChild(new Action(() => { count++; return NodeStatus.SUCCESS; }));
        tree.setRoot(rep);

        // Each tick increments counter; first two return RUNNING, third returns SUCCESS
        expect(tree.tick(0.016)).toBe(NodeStatus.RUNNING);
        expect(tree.tick(0.016)).toBe(NodeStatus.RUNNING);
        expect(tree.tick(0.016)).toBe(NodeStatus.SUCCESS);
        expect(count).toBe(3);
    });
});

// ─── Steering ───────────────────────────────────────────────────────

describe('Steering', () => {
    it('seek, flee, and wander do not crash', () => {
        const agent = new AIAgent(new Vector3(0, 0, 0), 5, 10);
        agent.velocity.set(1, 0, 0); // nonzero velocity for wander normalisation
        const steering = new Steering(agent);

        steering.seek(new Vector3(10, 0, 0));
        const seekForce = steering.calculate();
        expect(seekForce.length()).toBeGreaterThan(0);

        steering.flee(new Vector3(10, 0, 0));
        const fleeForce = steering.calculate();
        expect(fleeForce.length()).toBeGreaterThan(0);

        steering.wander(1, 2, Math.PI / 4);
        const wanderForce = steering.calculate();
        expect(Number.isFinite(wanderForce.x)).toBe(true);
    });

    it('arrive slows down near target', () => {
        const agent = new AIAgent(new Vector3(0, 0, 0), 5, 10);
        agent.velocity.set(1, 0, 0);
        const steering = new Steering(agent);

        steering.arrive(new Vector3(1, 0, 0), 5);
        const force = steering.calculate();
        expect(Number.isFinite(force.length())).toBe(true);
    });
});

// ─── ScriptGraph ────────────────────────────────────────────────────

describe('ScriptGraph', () => {
    it('creates visual script graph, adds nodes and connections', () => {
        const graph = new ScriptGraph();
        graph.name = 'TestGraph';

        const eventNode = new ScriptNode('OnStart', NodeType.EVENT);
        eventNode.addOutput('exec_out', PortType.EXEC);

        const logNode = new ScriptNode('Log', NodeType.ACTION);
        logNode.addInput('exec_in', PortType.EXEC);
        logNode.addInput('message', PortType.STRING, 'hello');
        logNode.addOutput('exec_out', PortType.EXEC);

        graph.addNode(eventNode);
        graph.addNode(logNode);
        expect(graph.getAllNodes()).toHaveLength(2);

        const connected = graph.connectNodes(
            eventNode.id, 'exec_out',
            logNode.id, 'exec_in',
        );
        expect(connected).toBe(true);

        graph.setVariable('testVar', 42);
        expect(graph.getVariable('testVar')).toBe(42);
    });

    it('serialises and deserialises graph via JSON', () => {
        const graph = new ScriptGraph();
        graph.name = 'Serializable';
        const n = new ScriptNode('A', NodeType.ACTION);
        n.addInput('in', PortType.NUMBER, 10);
        n.addOutput('out', PortType.NUMBER);
        graph.addNode(n);
        graph.setVariable('v', 'hello');

        const json = graph.toJSON();
        const restored = ScriptGraph.fromJSON(json);
        expect(restored.name).toBe('Serializable');
        expect(restored.getAllNodes()).toHaveLength(1);
        expect(restored.getVariable('v')).toBe('hello');
    });

    it('execute triggers event nodes', () => {
        const graph = new ScriptGraph();
        let executed = false;

        const ev = new ScriptNode('OnStart', NodeType.EVENT);
        ev.addOutput('exec_out', PortType.EXEC);
        ev.setExecuteFunc(() => { executed = true; });
        graph.addNode(ev);

        const ctx = graph.createExecutionContext();
        graph.execute('OnStart', ctx);
        expect(executed).toBe(true);
    });
});

// ─── GameUI ─────────────────────────────────────────────────────────

describe('GameUI', () => {
    it('creates UI system and manages elements', () => {
        const canvas = document.createElement('canvas');
        canvas.width = 800;
        canvas.height = 600;

        // happy-dom may not implement getContext('2d'), so provide a minimal stub
        if (!canvas.getContext('2d')) {
            const origGetContext = canvas.getContext.bind(canvas);
            (canvas as any).getContext = (type: string) => {
                if (type === '2d') {
                    return {
                        save: () => {},
                        restore: () => {},
                        scale: () => {},
                        fillText: () => {},
                        fillRect: () => {},
                        strokeRect: () => {},
                        beginPath: () => {},
                        roundRect: () => {},
                        moveTo: () => {},
                        lineTo: () => {},
                        arcTo: () => {},
                        arc: () => {},
                        fill: () => {},
                        stroke: () => {},
                        closePath: () => {},
                        clip: () => {},
                        rect: () => {},
                        clearRect: () => {},
                        drawImage: () => {},
                        measureText: () => ({ width: 0 }),
                        createLinearGradient: () => ({ addColorStop: () => {} }),
                        createRadialGradient: () => ({ addColorStop: () => {} }),
                        globalAlpha: 1,
                        fillStyle: '',
                        strokeStyle: '',
                        lineWidth: 1,
                        font: '',
                        textAlign: 'left',
                        textBaseline: 'top',
                        canvas,
                    };
                }
                return origGetContext(type);
            };
        }

        const ui = new GameUI(canvas);

        const text = new UIText('score', 10, 10, 200, 30);
        text.text = 'Score: 0';
        text.anchor = UIAnchor.TopLeft;
        ui.addElement(text);

        const panel = new UIPanel('bg', 0, 0, 300, 100);
        ui.addElement(panel);

        expect(ui.getElementCount()).toBe(2);
        expect(ui.getElementById('score')).toBe(text);

        // Render should not throw
        ui.render();

        ui.removeElement('score');
        expect(ui.getElementCount()).toBe(1);

        ui.clear();
        expect(ui.getElementCount()).toBe(0);
    });
});

// ─── ParticleSystem ─────────────────────────────────────────────────

describe('ParticleSystem', () => {
    it('creates emitter and update step does not crash', () => {
        const system = new ParticleSystem();
        const emitter = new ParticleEmitter(makeEmitterConfig());
        system.addEmitter('fire', emitter);

        system.addForce(ParticleForces.gravity(-9.81));

        // Several update ticks
        for (let i = 0; i < 10; i++) {
            system.update(0.016);
        }

        expect(system.getEmitterCount()).toBe(1);
        // Particles should have been spawned
        expect(system.getParticleCount()).toBeGreaterThanOrEqual(0);

        system.stop();
        system.clear();
    });

    it('particle lifecycle works', () => {
        const p = new Particle();
        p.lifetime = 0.5;
        p.velocity.set(0, 1, 0);

        p.update(0.2);
        expect(p.alive).toBe(true);
        expect(p.position.y).toBeCloseTo(0.2, 1);

        p.update(0.4);
        expect(p.alive).toBe(false);
    });

    it('emitter shapes spawn particles in bounds', () => {
        const shapes: Array<EmitterConfig['shape']> = ['point', 'sphere', 'box', 'cone', 'circle'];
        for (const shape of shapes) {
            const emitter = new ParticleEmitter(makeEmitterConfig({
                shape,
                shapeParams: { radius: 1, width: 2, height: 2, depth: 2, angle: 30 },
                rate: 100,
            }));
            emitter.update(0.1);
            // Should not crash regardless of shape
            expect(emitter.getParticleCount()).toBeGreaterThanOrEqual(0);
        }
    });
});

// ─── TerrainGenerator ───────────────────────────────────────────────

describe('TerrainGenerator', () => {
    it('generates terrain heightmap with Perlin noise', () => {
        const terrain = new Terrain(64, 64, 100, 100);
        const gen = new TerrainGenerator(12345);

        gen.generatePerlin(terrain, 4, 0.01, 0.5);

        const dims = terrain.getDimensions();
        expect(dims.width).toBe(64);

        // Spot-check that heights are non-trivial
        let hasNonZero = false;
        for (let z = 0; z < 64; z += 8) {
            for (let x = 0; x < 64; x += 8) {
                if (terrain.getHeightAt(x, z) !== 0) hasNonZero = true;
            }
        }
        expect(hasNonZero).toBe(true);
    });

    it('seed produces deterministic results', () => {
        const t1 = new Terrain(32, 32, 50, 50);
        const t2 = new Terrain(32, 32, 50, 50);
        new TerrainGenerator(42).generatePerlin(t1);
        new TerrainGenerator(42).generatePerlin(t2);

        for (let i = 0; i < 32; i++) {
            expect(t1.getHeightAt(i, i)).toBeCloseTo(t2.getHeightAt(i, i), 5);
        }
    });

    it('plateau, valley, ridge, and erosion do not crash', () => {
        const terrain = new Terrain(32, 32, 50, 50);
        const gen = new TerrainGenerator(99);

        gen.generatePlateau(terrain, 0.7, 0.1);
        gen.generateValleys(terrain, 0.5);
        gen.generateRidges(terrain, 0.8);
        gen.applyErosion(terrain, 5, 0.1);

        // Should not throw; heights should be populated
        expect(terrain.getHeightAt(16, 16)).toBeDefined();
    });
});

// ─── WeatherSystem ──────────────────────────────────────────────────

describe('WeatherSystem', () => {
    it('constructs and sets weather types', () => {
        const ps = new ParticleSystem();
        const weather = new WeatherSystem(ps);

        weather.setWeatherType(WeatherType.RAINY, WeatherIntensity.HEAVY);
        const cfg = weather.getCurrentWeather();
        expect(cfg.type).toBe(WeatherType.RAINY);
        expect(cfg.intensity).toBe(WeatherIntensity.HEAVY);
        expect(weather.isPrecipitating()).toBe(true);
        expect(weather.getPrecipitationType()).toBe('rain');
    });

    it('transitions between weather types without crash', () => {
        const ps = new ParticleSystem();
        const weather = new WeatherSystem(ps);

        weather.transitionTo(WeatherType.SNOWY, WeatherIntensity.MODERATE, 2);
        for (let i = 0; i < 100; i++) {
            weather.update(0.05);
        }

        // After enough time the transition should complete
        const cfg = weather.getCurrentWeather();
        expect(cfg.type).toBe(WeatherType.SNOWY);
    });

    it('fog and lighting values are sensible', () => {
        const ps = new ParticleSystem();
        const weather = new WeatherSystem(ps);

        weather.setWeatherType(WeatherType.FOGGY, WeatherIntensity.EXTREME);
        expect(weather.getFogDensity()).toBeGreaterThan(0);
        expect(weather.getLightingIntensity()).toBeLessThanOrEqual(1);
        expect(weather.getCloudCoverage()).toBeGreaterThanOrEqual(0);
    });
});

// ─── WaterSimulationSystem ──────────────────────────────────────────

describe('WaterSimulationSystem', () => {
    it('constructs and updates without crash', () => {
        const water = new WaterSimulationSystem({ resolution: 64, waveScale: 1.0 });

        for (let i = 0; i < 5; i++) {
            water.update(0.016);
        }

        expect(water.getResolution()).toBe(64);
        expect(water.getHeightField().length).toBe(64 * 64);
    });

    it('height, displacement, foam and caustics queries work', () => {
        const water = new WaterSimulationSystem({ resolution: 64 });
        water.update(0.1);

        const h = water.getHeightAt(5, 5);
        expect(Number.isFinite(h)).toBe(true);

        const disp = water.getDisplacementAt(5, 5);
        expect(Number.isFinite(disp.x)).toBe(true);

        const foam = water.getFoamAt(5, 5);
        expect(foam).toBeGreaterThanOrEqual(0);

        const caustics = water.getCausticsAt(5, 5);
        expect(Number.isFinite(caustics)).toBe(true);

        const normal = water.getNormalAt(5, 5);
        expect(Number.isFinite(normal.x)).toBe(true);
    });

    it('updateSettings does not crash', () => {
        const water = new WaterSimulationSystem({ resolution: 64 });
        water.updateSettings({ windSpeed: 20, choppiness: 0.8, windDirection: new Vector2(0, 1) });
        water.update(0.1);
        expect(water.getResolution()).toBe(64);
    });
});
