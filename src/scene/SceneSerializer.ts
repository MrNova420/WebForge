/**
 * SceneSerializer - Serialize/deserialize entire scene graphs to/from JSON.
 *
 * Supports full scene save/load, deep cloning, and scene diffing.
 * Custom component serialization is handled via the ComponentRegistry.
 *
 * @module SceneSerializer
 */

import { Scene } from './Scene';
import { GameObject, IComponent } from './GameObject';
import { Vector3 } from '../math/Vector3';
import { Quaternion } from '../math/Quaternion';

// ─── Serialized Data Interfaces ──────────────────────────────────────────────

/** Serialized representation of a Vector3. */
export interface SerializedVector3 {
    x: number;
    y: number;
    z: number;
}

/** Serialized representation of a Quaternion. */
export interface SerializedQuaternion {
    x: number;
    y: number;
    z: number;
    w: number;
}

/** Serialized representation of a Transform. */
export interface SerializedTransform {
    position: SerializedVector3;
    rotation: SerializedQuaternion;
    scale: SerializedVector3;
}

/** Serialized representation of a component. */
export interface SerializedComponent {
    type: string;
    data: Record<string, unknown>;
}

/** Serialized representation of a GameObject (recursive via children). */
export interface SerializedGameObject {
    name: string;
    tags: string[];
    transform: SerializedTransform;
    components: SerializedComponent[];
    children: SerializedGameObject[];
}

/** Serialized representation of an entire Scene. */
export interface SerializedScene {
    version: number;
    name: string;
    objects: SerializedGameObject[];
    metadata: Record<string, unknown>;
}

/** Result of diffing two scenes. */
export interface SceneDiff {
    /** Object names present in scene B but not in scene A. */
    added: string[];
    /** Object names present in scene A but not in scene B. */
    removed: string[];
    /** Object names present in both but with different transforms. */
    modified: string[];
}

// ─── Component Serializer Interface ──────────────────────────────────────────

/** Pair of functions for serializing and deserializing a component type. */
export interface ComponentSerializer {
    serialize(component: unknown): unknown;
    deserialize(data: unknown): unknown;
}

// ─── ComponentRegistry ───────────────────────────────────────────────────────

/**
 * Registry for custom component serializers.
 *
 * Users register a serializer per component type name so that
 * `SceneSerializer` can persist and restore arbitrary components.
 *
 * @example
 * ```ts
 * ComponentRegistry.register('HealthComponent', {
 *     serialize: (comp) => ({ hp: comp.hp, maxHp: comp.maxHp }),
 *     deserialize: (data) => new HealthComponent(data.hp, data.maxHp),
 * });
 * ```
 */
export class ComponentRegistry {
    private static _registry: Map<string, ComponentSerializer> = new Map();

    /**
     * Register a serializer for the given component type name.
     * @param typeName - Unique name identifying the component type.
     * @param serializer - Object with `serialize` and `deserialize` methods.
     */
    public static register(typeName: string, serializer: ComponentSerializer): void {
        ComponentRegistry._registry.set(typeName, serializer);
    }

    /**
     * Retrieve the serializer registered for `typeName`, or `null` if none exists.
     */
    public static getSerializer(typeName: string): ComponentSerializer | null {
        return ComponentRegistry._registry.get(typeName) ?? null;
    }

    /**
     * Return the list of all registered component type names.
     */
    public static getRegisteredTypes(): string[] {
        return Array.from(ComponentRegistry._registry.keys());
    }

    /**
     * Remove all registered serializers. Primarily useful for testing.
     */
    public static clear(): void {
        ComponentRegistry._registry.clear();
    }
}

// ─── SceneSerializer ─────────────────────────────────────────────────────────

/** Current serialization format version. */
const SERIALIZER_VERSION = 1;

/**
 * Provides static methods to serialize and deserialize `Scene` instances
 * to and from plain JSON-compatible objects.
 */
export class SceneSerializer {
    // ── Public API ───────────────────────────────────────────────────────

    /**
     * Serialize an entire scene graph into a plain object.
     * @param scene - The scene to serialize.
     * @returns A `SerializedScene` that can be safely converted to JSON.
     */
    public static serialize(scene: Scene): SerializedScene {
        const rootObjects = SceneSerializer._collectRootObjects(scene);
        return {
            version: SERIALIZER_VERSION,
            name: scene.name,
            objects: rootObjects.map((obj) => SceneSerializer.serializeGameObject(obj)),
            metadata: {},
        };
    }

    /**
     * Deserialize a `SerializedScene` back into a live `Scene`.
     * @param data - The serialized scene data.
     * @returns A fully reconstructed `Scene`.
     */
    public static deserialize(data: SerializedScene): Scene {
        SceneSerializer._validateVersion(data.version);

        const scene = new Scene(data.name);

        for (const objData of data.objects) {
            const gameObject = SceneSerializer.deserializeGameObject(objData);
            scene.add(gameObject);

            // Re-apply tags through the scene's tag system.
            for (const tag of objData.tags) {
                scene.tagObject(gameObject, tag);
            }

            // Recursively tag children as well.
            SceneSerializer._applyTagsRecursive(scene, objData, gameObject);
        }

        return scene;
    }

    /**
     * Serialize a scene to a JSON string.
     * @param scene - The scene to serialize.
     * @param pretty - If `true`, output is formatted with 2-space indentation.
     * @returns A JSON string representation of the scene.
     */
    public static toJSON(scene: Scene, pretty: boolean = false): string {
        const data = SceneSerializer.serialize(scene);
        return pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);
    }

    /**
     * Deserialize a scene from a JSON string.
     * @param json - A JSON string produced by `toJSON`.
     * @returns A reconstructed `Scene`.
     */
    public static fromJSON(json: string): Scene {
        const data = JSON.parse(json) as SerializedScene;
        return SceneSerializer.deserialize(data);
    }

    /**
     * Serialize a single `GameObject` (and its children recursively).
     * @param obj - The game object to serialize.
     * @returns A `SerializedGameObject`.
     */
    public static serializeGameObject(obj: GameObject): SerializedGameObject {
        const transform = obj.transform;
        const children = obj.getChildren();
        const components = SceneSerializer._serializeComponents(obj);

        return {
            name: obj.name,
            tags: obj.getTags(),
            transform: {
                position: SceneSerializer._serializeVector3(transform.position),
                rotation: SceneSerializer._serializeQuaternion(transform.rotation),
                scale: SceneSerializer._serializeVector3(transform.scale),
            },
            components,
            children: children.map((child) => SceneSerializer.serializeGameObject(child)),
        };
    }

    /**
     * Deserialize a single `SerializedGameObject` into a live `GameObject`.
     * Recursively deserializes children and sets up parent-child relationships.
     * @param data - The serialized game object data.
     * @param parent - Optional parent to attach the new object to.
     * @returns A reconstructed `GameObject`.
     */
    public static deserializeGameObject(
        data: SerializedGameObject,
        parent?: GameObject,
    ): GameObject {
        const obj = new GameObject(data.name);

        // Restore transform
        const pos = data.transform.position;
        const rot = data.transform.rotation;
        const scl = data.transform.scale;

        obj.transform.position.set(pos.x, pos.y, pos.z);
        obj.transform.rotation.set(rot.x, rot.y, rot.z, rot.w);
        obj.transform.scale.set(scl.x, scl.y, scl.z);

        // Restore tags
        for (const tag of data.tags) {
            obj.addTag(tag);
        }

        // Restore components via registry
        for (const compData of data.components) {
            const serializer = ComponentRegistry.getSerializer(compData.type);
            if (serializer) {
                const component = serializer.deserialize(compData.data);
                obj.addComponent(component as IComponent);
            }
        }

        // Attach to parent
        if (parent) {
            obj.setParent(parent);
        }

        // Recursively deserialize children
        for (const childData of data.children) {
            SceneSerializer.deserializeGameObject(childData, obj);
        }

        return obj;
    }

    /**
     * Deep-clone a scene by round-tripping through serialization.
     * @param scene - The scene to clone.
     * @returns A new `Scene` that is a deep copy of the original.
     */
    public static clone(scene: Scene): Scene {
        const data = SceneSerializer.serialize(scene);
        return SceneSerializer.deserialize(data);
    }

    /**
     * Compute the differences between two scenes.
     *
     * Objects are matched by name. An object present only in `sceneB` is
     * considered *added*; only in `sceneA`, *removed*; in both but with a
     * different transform, *modified*.
     *
     * @param sceneA - The baseline scene.
     * @param sceneB - The scene to compare against.
     * @returns A `SceneDiff` describing the changes.
     */
    public static diff(sceneA: Scene, sceneB: Scene): SceneDiff {
        const mapA = SceneSerializer._buildObjectMap(sceneA);
        const mapB = SceneSerializer._buildObjectMap(sceneB);

        const added: string[] = [];
        const removed: string[] = [];
        const modified: string[] = [];

        // Objects in B but not in A → added
        // Objects in both → check for transform differences
        const entriesB = Array.from(mapB.entries());
        for (const [name, objB] of entriesB) {
            const objA = mapA.get(name);
            if (!objA) {
                added.push(name);
            } else if (!SceneSerializer._transformsEqual(objA, objB)) {
                modified.push(name);
            }
        }

        // Objects in A but not in B → removed
        const keysA = Array.from(mapA.keys());
        for (const name of keysA) {
            if (!mapB.has(name)) {
                removed.push(name);
            }
        }

        return { added, removed, modified };
    }

    /**
     * Return the current serialization format version.
     */
    public static getVersion(): number {
        return SERIALIZER_VERSION;
    }

    // ── Private Helpers ──────────────────────────────────────────────────

    /**
     * Collect only root-level GameObjects from a scene (those without a parent).
     */
    private static _collectRootObjects(scene: Scene): GameObject[] {
        const allObjects = scene.getAllObjects();
        const roots: GameObject[] = [];

        for (const obj of allObjects) {
            if (obj instanceof GameObject && obj.getParent() === null) {
                roots.push(obj);
            }
        }

        return roots;
    }

    /** Serialize a Vector3 to a plain object. */
    private static _serializeVector3(v: Vector3): SerializedVector3 {
        return { x: v.x, y: v.y, z: v.z };
    }

    /** Serialize a Quaternion to a plain object. */
    private static _serializeQuaternion(q: Quaternion): SerializedQuaternion {
        return { x: q.x, y: q.y, z: q.z, w: q.w };
    }

    /** Serialize all components on a GameObject using the ComponentRegistry. */
    private static _serializeComponents(obj: GameObject): SerializedComponent[] {
        const components = obj.getAllComponents();
        const result: SerializedComponent[] = [];

        for (const comp of components) {
            const typeName = comp.constructor.name;
            const serializer = ComponentRegistry.getSerializer(typeName);
            if (serializer) {
                result.push({
                    type: typeName,
                    data: serializer.serialize(comp) as Record<string, unknown>,
                });
            }
        }

        return result;
    }

    /** Validate that the serialized data version is supported. */
    private static _validateVersion(version: number): void {
        if (version > SERIALIZER_VERSION) {
            throw new Error(
                `Unsupported scene format version ${version}. ` +
                `Maximum supported version is ${SERIALIZER_VERSION}.`,
            );
        }
    }

    /** Recursively apply tags to child objects via the scene's tag system. */
    private static _applyTagsRecursive(
        scene: Scene,
        data: SerializedGameObject,
        parent: GameObject,
    ): void {
        const children = parent.getChildren();
        for (let i = 0; i < data.children.length; i++) {
            const childData = data.children[i];
            const child = children[i];
            if (child) {
                for (const tag of childData.tags) {
                    scene.tagObject(child, tag);
                }
                SceneSerializer._applyTagsRecursive(scene, childData, child);
            }
        }
    }

    /**
     * Build a flat map of object name → SerializedGameObject for all objects
     * (including nested children) in a scene.
     */
    private static _buildObjectMap(scene: Scene): Map<string, SerializedGameObject> {
        const serialized = SceneSerializer.serialize(scene);
        const map = new Map<string, SerializedGameObject>();
        SceneSerializer._flattenObjects(serialized.objects, map);
        return map;
    }

    /** Recursively flatten a tree of SerializedGameObjects into a map keyed by name. */
    private static _flattenObjects(
        objects: SerializedGameObject[],
        map: Map<string, SerializedGameObject>,
    ): void {
        for (const obj of objects) {
            map.set(obj.name, obj);
            if (obj.children.length > 0) {
                SceneSerializer._flattenObjects(obj.children, map);
            }
        }
    }

    /** Compare two serialized game objects' transforms for equality. */
    private static _transformsEqual(
        a: SerializedGameObject,
        b: SerializedGameObject,
    ): boolean {
        const EPSILON = 1e-6;
        return (
            SceneSerializer._vec3Equal(a.transform.position, b.transform.position, EPSILON) &&
            SceneSerializer._quatEqual(a.transform.rotation, b.transform.rotation, EPSILON) &&
            SceneSerializer._vec3Equal(a.transform.scale, b.transform.scale, EPSILON)
        );
    }

    /** Check approximate equality of two serialized Vector3 values. */
    private static _vec3Equal(a: SerializedVector3, b: SerializedVector3, eps: number): boolean {
        return (
            Math.abs(a.x - b.x) < eps &&
            Math.abs(a.y - b.y) < eps &&
            Math.abs(a.z - b.z) < eps
        );
    }

    /** Check approximate equality of two serialized Quaternion values. */
    private static _quatEqual(
        a: SerializedQuaternion,
        b: SerializedQuaternion,
        eps: number,
    ): boolean {
        return (
            Math.abs(a.x - b.x) < eps &&
            Math.abs(a.y - b.y) < eps &&
            Math.abs(a.z - b.z) < eps &&
            Math.abs(a.w - b.w) < eps
        );
    }
}
