/**
 * @fileoverview EditorScene - Scene Management for the Editor
 * @module editor/app
 * 
 * Manages GameObjects in the editor, including:
 * - Creating/deleting objects
 * - Primitive creation (cube, sphere, etc.)
 * - Light creation
 * - Scene state save/restore for play mode
 * 
 * @author MrNova420
 * @license MIT
 */

import { Scene } from '../../scene/Scene';
import { GameObject } from '../../scene/GameObject';
import { EditorContext } from '../EditorContext';
import { Logger } from '../../core/Logger';
import { EventSystem } from '../../core/EventSystem';

/**
 * Primitive types
 */
export type PrimitiveType = 'cube' | 'sphere' | 'plane' | 'cylinder' | 'cone' | 'capsule';

/**
 * Editor light types (for editor use)
 */
export type EditorLightType = 'directional' | 'point' | 'spot' | 'area';

/**
 * Editor object data (extended GameObject data for editor)
 */
export interface EditorObjectData {
    primitiveType?: PrimitiveType;
    editorColor?: [number, number, number];
    lightType?: EditorLightType;
    lightColor?: [number, number, number];
    lightIntensity?: number;
}

/**
 * Scene state snapshot for play mode
 */
interface SceneSnapshot {
    objects: Array<{
        name: string;
        position: { x: number; y: number; z: number };
        rotation: { x: number; y: number; z: number; w: number };
        scale: { x: number; y: number; z: number };
        data: EditorObjectData;
    }>;
}

/**
 * Editor Scene Manager
 * 
 * Provides high-level scene management for the editor.
 */
export class EditorScene {
    private scene: Scene;
    private _context: EditorContext;
    private logger: Logger;
    private events: EventSystem;
    
    // All GameObjects in the scene
    private gameObjects: Map<string, GameObject> = new Map();
    
    // ID counter for unique names
    private idCounter: number = 0;
    
    // Saved state for play mode
    private savedState: SceneSnapshot | null = null;

    constructor(context: EditorContext) {
        this.scene = new Scene('EditorScene');
        this._context = context;
        this.logger = new Logger('EditorScene');
        this.events = new EventSystem();
        
        this.logger.info('EditorScene created');
    }

    /**
     * Create a demo scene with sample objects
     */
    createDemoScene(): void {
        this.logger.info('Creating demo scene...');
        
        // Create some demo objects
        const cube = this.createPrimitive('cube');
        if (cube) {
            cube.name = 'Demo Cube';
            cube.transform.position.set(0, 0.5, 0);
            (cube as any).editorColor = [0.3, 0.7, 0.4];
        }
        
        const sphere = this.createPrimitive('sphere');
        if (sphere) {
            sphere.name = 'Demo Sphere';
            sphere.transform.position.set(2, 0.5, 0);
            (sphere as any).editorColor = [0.4, 0.5, 0.8];
        }
        
        const plane = this.createPrimitive('plane');
        if (plane) {
            plane.name = 'Ground';
            plane.transform.position.set(0, 0, 0);
            plane.transform.scale.set(10, 1, 10);
            (plane as any).editorColor = [0.5, 0.5, 0.5];
        }
        
        const light = this.createLight('directional');
        if (light) {
            light.name = 'Main Light';
            light.transform.position.set(5, 10, 5);
        }
        
        this.logger.info('Demo scene created');
    }

    /**
     * Create a new empty GameObject
     */
    createGameObject(name?: string): GameObject {
        const uniqueName = name || `GameObject_${++this.idCounter}`;
        const gameObject = new GameObject(uniqueName);
        
        this.addGameObject(gameObject);
        return gameObject;
    }

    /**
     * Create a primitive object
     */
    createPrimitive(type: PrimitiveType): GameObject {
        const name = `${type.charAt(0).toUpperCase() + type.slice(1)}_${++this.idCounter}`;
        const gameObject = new GameObject(name);
        
        // Store primitive type for renderer
        (gameObject as any).primitiveType = type;
        
        // Default color based on type
        const colors: Record<PrimitiveType, [number, number, number]> = {
            cube: [0.4, 0.6, 0.8],
            sphere: [0.8, 0.4, 0.4],
            plane: [0.5, 0.5, 0.5],
            cylinder: [0.6, 0.8, 0.4],
            cone: [0.8, 0.6, 0.4],
            capsule: [0.4, 0.8, 0.6]
        };
        (gameObject as any).editorColor = colors[type] || [0.5, 0.5, 0.5];
        
        this.addGameObject(gameObject);
        return gameObject;
    }

    /**
     * Create a light object
     */
    createLight(type: EditorLightType): GameObject {
        const name = `${type.charAt(0).toUpperCase() + type.slice(1)}Light_${++this.idCounter}`;
        const gameObject = new GameObject(name);
        
        // Store light data
        (gameObject as any).lightType = type;
        (gameObject as any).lightColor = [1, 1, 1];
        (gameObject as any).lightIntensity = 1;
        (gameObject as any).primitiveType = 'sphere'; // Visual representation
        (gameObject as any).editorColor = [1, 0.9, 0.5]; // Yellow-ish for lights
        
        // Scale down the visual representation
        gameObject.transform.scale.set(0.2, 0.2, 0.2);
        
        this.addGameObject(gameObject);
        return gameObject;
    }

    /**
     * Add a GameObject to the scene
     */
    addGameObject(gameObject: GameObject): void {
        // Ensure unique name
        let name = gameObject.name;
        let counter = 1;
        while (this.gameObjects.has(name)) {
            name = `${gameObject.name}_${counter++}`;
        }
        gameObject.name = name;
        
        this.gameObjects.set(name, gameObject);
        this.scene.add(gameObject);
        
        this.events.emit('objectAdded', gameObject);
        this.logger.info(`Added: ${name}`);
    }

    /**
     * Remove a GameObject from the scene
     */
    removeGameObject(gameObject: GameObject): void {
        const name = gameObject.name;
        
        if (this.gameObjects.has(name)) {
            this.gameObjects.delete(name);
            this.scene.remove(gameObject);
            gameObject.destroy();
            
            this.events.emit('objectRemoved', gameObject);
            this.logger.info(`Removed: ${name}`);
        }
    }

    /**
     * Find GameObject by name
     */
    findByName(name: string): GameObject | null {
        return this.gameObjects.get(name) || null;
    }

    /**
     * Get all GameObjects
     */
    getAllGameObjects(): GameObject[] {
        return Array.from(this.gameObjects.values());
    }

    /**
     * Get object count
     */
    getObjectCount(): number {
        return this.gameObjects.size;
    }

    /**
     * Get the editor context
     */
    getEditorContext(): EditorContext {
        return this._context;
    }

    /**
     * Update scene (called during play mode)
     */
    update(deltaTime: number): void {
        this.scene.update(deltaTime);
    }

    /**
     * Save current scene state (for play mode)
     */
    saveState(): void {
        const objects: SceneSnapshot['objects'] = [];
        
        for (const obj of this.gameObjects.values()) {
            objects.push({
                name: obj.name,
                position: {
                    x: obj.transform.position.x,
                    y: obj.transform.position.y,
                    z: obj.transform.position.z
                },
                rotation: {
                    x: obj.transform.rotation.x,
                    y: obj.transform.rotation.y,
                    z: obj.transform.rotation.z,
                    w: obj.transform.rotation.w
                },
                scale: {
                    x: obj.transform.scale.x,
                    y: obj.transform.scale.y,
                    z: obj.transform.scale.z
                },
                data: {
                    primitiveType: (obj as any).primitiveType,
                    editorColor: (obj as any).editorColor,
                    lightType: (obj as any).lightType,
                    lightColor: (obj as any).lightColor,
                    lightIntensity: (obj as any).lightIntensity
                }
            });
        }
        
        this.savedState = { objects };
        this.logger.info('Scene state saved');
    }

    /**
     * Restore scene state (after play mode)
     */
    restoreState(): void {
        if (!this.savedState) {
            this.logger.warn('No saved state to restore');
            return;
        }
        
        // Restore transforms
        for (const saved of this.savedState.objects) {
            const obj = this.gameObjects.get(saved.name);
            if (obj) {
                obj.transform.position.set(saved.position.x, saved.position.y, saved.position.z);
                obj.transform.rotation.set(saved.rotation.x, saved.rotation.y, saved.rotation.z, saved.rotation.w);
                obj.transform.scale.set(saved.scale.x, saved.scale.y, saved.scale.z);
            }
        }
        
        this.savedState = null;
        this.logger.info('Scene state restored');
    }

    /**
     * Clear all objects from scene
     */
    clear(): void {
        for (const obj of this.gameObjects.values()) {
            this.scene.remove(obj);
            obj.destroy();
        }
        this.gameObjects.clear();
        this.idCounter = 0;
        
        this.events.emit('sceneCleared');
        this.logger.info('Scene cleared');
    }

    /**
     * Get underlying Scene
     */
    getScene(): Scene {
        return this.scene;
    }

    /**
     * Get event system
     */
    getEvents(): EventSystem {
        return this.events;
    }

    /**
     * Export scene to JSON
     */
    toJSON(): object {
        const objects: object[] = [];
        
        for (const obj of this.gameObjects.values()) {
            objects.push({
                name: obj.name,
                transform: {
                    position: obj.transform.position.toArray(),
                    rotation: obj.transform.rotation.toArray(),
                    scale: obj.transform.scale.toArray()
                },
                primitiveType: (obj as any).primitiveType,
                editorColor: (obj as any).editorColor,
                lightType: (obj as any).lightType,
                lightColor: (obj as any).lightColor,
                lightIntensity: (obj as any).lightIntensity
            });
        }
        
        return {
            version: '1.0',
            name: this.scene.name,
            objects
        };
    }

    /**
     * Import scene from JSON
     */
    fromJSON(data: any): void {
        this.clear();
        
        if (!data.objects || !Array.isArray(data.objects)) {
            this.logger.error('Invalid scene data');
            return;
        }
        
        for (const objData of data.objects) {
            const obj = new GameObject(objData.name);
            
            if (objData.transform) {
                if (objData.transform.position) {
                    const p = objData.transform.position;
                    obj.transform.position.set(p.x || p[0] || 0, p.y || p[1] || 0, p.z || p[2] || 0);
                }
                if (objData.transform.rotation) {
                    const r = objData.transform.rotation;
                    obj.transform.rotation.set(r.x || r[0] || 0, r.y || r[1] || 0, r.z || r[2] || 0, r.w || r[3] || 1);
                }
                if (objData.transform.scale) {
                    const s = objData.transform.scale;
                    obj.transform.scale.set(s.x || s[0] || 1, s.y || s[1] || 1, s.z || s[2] || 1);
                }
            }
            
            if (objData.primitiveType) {
                (obj as any).primitiveType = objData.primitiveType;
            }
            if (objData.editorColor) {
                (obj as any).editorColor = objData.editorColor;
            }
            if (objData.lightType) {
                (obj as any).lightType = objData.lightType;
            }
            if (objData.lightColor) {
                (obj as any).lightColor = objData.lightColor;
            }
            if (objData.lightIntensity !== undefined) {
                (obj as any).lightIntensity = objData.lightIntensity;
            }
            
            this.addGameObject(obj);
        }
        
        this.logger.info(`Loaded scene: ${data.name || 'Unnamed'}`);
    }

    /**
     * Dispose scene
     */
    dispose(): void {
        this.clear();
        this.scene.destroy();
        this.events.clear();
        this.logger.info('EditorScene disposed');
    }
}
