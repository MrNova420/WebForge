/**
 * @module editor/app
 * @fileoverview PickingService - Standalone picking/raycast service extracted from EditorRenderer
 */

import { Camera } from '../../rendering/Camera';
import { GameObject } from '../../scene/GameObject';
import { Vector3 } from '../../math/Vector3';
import { Matrix4 } from '../../math/Matrix4';

/**
 * Ray in world space with an origin and normalized direction.
 */
export interface Ray {
    origin: Vector3;
    direction: Vector3;
}

/**
 * Result of a pick or raycast operation.
 */
export interface PickResult {
    /** The GameObject that was hit */
    object: GameObject;
    /** Distance from the ray origin to the hit point */
    distance: number;
    /** World-space position of the hit */
    hitPoint: Vector3;
    /** Surface normal at the hit point (axis-aligned face normal for AABB) */
    normal?: Vector3;
}

/**
 * Interface for a picking service that supports screen-space and 3D raycast picking.
 */
export interface IPickingService {
    /**
     * Picks the closest object at the given screen coordinates.
     * Uses 3D raycast with screen-space bounding box fallback.
     * @param screenX - Screen X in pixels
     * @param screenY - Screen Y in pixels
     * @returns The closest PickResult, or null if nothing was hit
     */
    pick(screenX: number, screenY: number): PickResult | null;

    /**
     * Picks all objects at the given screen coordinates, sorted by distance.
     * @param screenX - Screen X in pixels
     * @param screenY - Screen Y in pixels
     * @returns Array of PickResults sorted nearest-first
     */
    pickAll(screenX: number, screenY: number): PickResult[];

    /**
     * Casts a ray from an arbitrary origin/direction and returns the closest hit.
     * @param origin - Ray origin in world space
     * @param direction - Normalized ray direction in world space
     * @param maxDistance - Maximum ray distance (default: Infinity)
     * @returns The closest PickResult, or null if nothing was hit
     */
    raycast(origin: Vector3, direction: Vector3, maxDistance?: number): PickResult | null;

    /**
     * Casts a ray and returns all hits sorted by distance.
     * @param origin - Ray origin in world space
     * @param direction - Normalized ray direction in world space
     * @param maxDistance - Maximum ray distance (default: Infinity)
     * @returns Array of PickResults sorted nearest-first
     */
    raycastAll(origin: Vector3, direction: Vector3, maxDistance?: number): PickResult[];

    /**
     * Converts screen pixel coordinates to a world-space ray.
     * @param screenX - Screen X in pixels
     * @param screenY - Screen Y in pixels
     * @returns A Ray, or null if the camera matrices are not invertible
     */
    screenToWorldRay(screenX: number, screenY: number): Ray | null;

    /**
     * Projects a world-space position to screen pixel coordinates.
     * The returned Vector3's z component contains the clip-space w (depth).
     * @param worldPos - Position in world space
     * @returns Screen-space position (x, y in pixels, z = clip w)
     */
    worldToScreen(worldPos: Vector3): Vector3;
}

/** Minimum clickable size in pixels for screen-space picking */
const MIN_CLICKABLE_SIZE = 20;

/** Padding in pixels added around screen-space bounding boxes */
const CLICK_PADDING = 3;

/** Epsilon for ray direction component near-zero checks */
const RAY_EPSILON = 1e-4;

/** Minimum half-extent for flat objects to remain pickable */
const MIN_HALF_EXTENT = 0.05;

/**
 * PickingService provides screen-space and 3D raycast picking for editor objects.
 *
 * Extracted from EditorRenderer to allow standalone usage and testing.
 *
 * @example
 * ```typescript
 * const picking = new PickingService(camera, canvas.width, canvas.height);
 * picking.setObjects(scene.getAllGameObjects());
 *
 * const result = picking.pick(mouseX, mouseY);
 * if (result) {
 *     console.log('Hit', result.object.name, 'at', result.hitPoint);
 * }
 * ```
 */
export class PickingService implements IPickingService {
    private _camera: Camera;
    private _canvasWidth: number;
    private _canvasHeight: number;
    private _objects: GameObject[] = [];

    /**
     * Creates a new PickingService.
     * @param camera - The camera used for projection/unprojection
     * @param canvasWidth - Viewport width in pixels
     * @param canvasHeight - Viewport height in pixels
     */
    constructor(camera: Camera, canvasWidth: number, canvasHeight: number) {
        this._camera = camera;
        this._canvasWidth = canvasWidth;
        this._canvasHeight = canvasHeight;
    }

    /**
     * Replaces the active camera.
     * @param camera - New camera instance
     */
    public setCamera(camera: Camera): void {
        this._camera = camera;
    }

    /**
     * Updates the viewport dimensions.
     * @param width - Viewport width in pixels
     * @param height - Viewport height in pixels
     */
    public setViewportSize(width: number, height: number): void {
        this._canvasWidth = width;
        this._canvasHeight = height;
    }

    /**
     * Sets the list of objects that can be picked.
     * @param objects - Array of GameObjects to test against
     */
    public setObjects(objects: GameObject[]): void {
        this._objects = objects;
    }

    // ─── IPickingService implementation ──────────────────────────────────

    public pick(screenX: number, screenY: number): PickResult | null {
        // Prefer raycast; fall back to screen-space bounding box picking
        const rayResult = this.raycastFromScreen(screenX, screenY);
        if (rayResult) return rayResult;
        return this.screenSpacePick(screenX, screenY);
    }

    public pickAll(screenX: number, screenY: number): PickResult[] {
        const ray = this.screenToWorldRay(screenX, screenY);
        if (!ray) return this.screenSpacePickAll(screenX, screenY);

        const hits = this.raycastAllInternal(ray.origin, ray.direction, Infinity);
        if (hits.length > 0) return hits;

        return this.screenSpacePickAll(screenX, screenY);
    }

    public raycast(origin: Vector3, direction: Vector3, maxDistance: number = Infinity): PickResult | null {
        const hits = this.raycastAllInternal(origin, direction, maxDistance);
        return hits.length > 0 ? hits[0] : null;
    }

    public raycastAll(origin: Vector3, direction: Vector3, maxDistance: number = Infinity): PickResult[] {
        return this.raycastAllInternal(origin, direction, maxDistance);
    }

    public screenToWorldRay(screenX: number, screenY: number): Ray | null {
        // Convert screen pixels to NDC (-1 to 1)
        const ndcX = (screenX / this._canvasWidth) * 2 - 1;
        const ndcY = 1 - (screenY / this._canvasHeight) * 2; // Flip Y

        const viewProj = this._camera.getViewProjectionMatrix();
        const invViewProj = viewProj.clone().invert();

        // Unproject near and far points
        const nearPoint = this.unproject(invViewProj, ndcX, ndcY, -1);
        const farPoint = this.unproject(invViewProj, ndcX, ndcY, 1);

        const direction = new Vector3(
            farPoint.x - nearPoint.x,
            farPoint.y - nearPoint.y,
            farPoint.z - nearPoint.z
        );

        const len = direction.length();
        if (len === 0) return null;
        direction.multiplyScalarSelf(1 / len);

        return { origin: nearPoint, direction };
    }

    public worldToScreen(worldPos: Vector3): Vector3 {
        const vp = this._camera.getViewProjectionMatrix();
        const e = vp.elements;

        const clipX = e[0] * worldPos.x + e[4] * worldPos.y + e[8] * worldPos.z + e[12];
        const clipY = e[1] * worldPos.x + e[5] * worldPos.y + e[9] * worldPos.z + e[13];
        const clipW = e[3] * worldPos.x + e[7] * worldPos.y + e[11] * worldPos.z + e[15];

        const ndcX = clipX / clipW;
        const ndcY = clipY / clipW;

        const sx = (ndcX + 1) * 0.5 * this._canvasWidth;
        const sy = (1 - ndcY) * 0.5 * this._canvasHeight;

        return new Vector3(sx, sy, clipW);
    }

    // ─── Private helpers ─────────────────────────────────────────────────

    /**
     * Unprojects NDC coordinates to world space via the inverse view-projection matrix.
     */
    private unproject(invViewProj: Matrix4, ndcX: number, ndcY: number, ndcZ: number): Vector3 {
        const m = invViewProj.elements;

        const x = m[0] * ndcX + m[4] * ndcY + m[8] * ndcZ + m[12];
        const y = m[1] * ndcX + m[5] * ndcY + m[9] * ndcZ + m[13];
        const z = m[2] * ndcX + m[6] * ndcY + m[10] * ndcZ + m[14];
        const w = m[3] * ndcX + m[7] * ndcY + m[11] * ndcZ + m[15];

        return new Vector3(x / w, y / w, z / w);
    }

    /**
     * Computes the axis-aligned bounding box for a GameObject based on its
     * position and scale.
     */
    private getAABB(obj: GameObject): { boxMin: Vector3; boxMax: Vector3 } {
        const pos = obj.transform.position;
        const scale = obj.transform.scale;

        const halfX = Math.max(scale.x * 0.5, MIN_HALF_EXTENT);
        const halfY = Math.max(scale.y * 0.5, MIN_HALF_EXTENT);
        const halfZ = Math.max(scale.z * 0.5, MIN_HALF_EXTENT);

        return {
            boxMin: new Vector3(pos.x - halfX, pos.y - halfY, pos.z - halfZ),
            boxMax: new Vector3(pos.x + halfX, pos.y + halfY, pos.z + halfZ),
        };
    }

    /**
     * Ray-AABB intersection using the slab method.
     * Returns the distance along the ray (t) and the face normal at the hit point,
     * or null if there is no intersection.
     */
    private rayIntersectAABB(
        origin: Vector3,
        direction: Vector3,
        boxMin: Vector3,
        boxMax: Vector3
    ): { t: number; normal: Vector3 } | null {
        let tmin = -Infinity;
        let tmax = Infinity;
        let tminAxis = -1;
        let tminSign = 1;

        const oComponents = [origin.x, origin.y, origin.z];
        const dComponents = [direction.x, direction.y, direction.z];
        const minComponents = [boxMin.x, boxMin.y, boxMin.z];
        const maxComponents = [boxMax.x, boxMax.y, boxMax.z];

        for (let axis = 0; axis < 3; axis++) {
            if (Math.abs(dComponents[axis]) > RAY_EPSILON) {
                const t1 = (minComponents[axis] - oComponents[axis]) / dComponents[axis];
                const t2 = (maxComponents[axis] - oComponents[axis]) / dComponents[axis];
                const tNear = Math.min(t1, t2);
                const tFar = Math.max(t1, t2);

                if (tNear > tmin) {
                    tmin = tNear;
                    tminAxis = axis;
                    tminSign = t1 < t2 ? -1 : 1;
                }
                tmax = Math.min(tmax, tFar);
            } else if (oComponents[axis] < minComponents[axis] || oComponents[axis] > maxComponents[axis]) {
                return null;
            }
        }

        if (tmax < 0 || tmin > tmax) return null;

        const t = tmin >= 0 ? tmin : tmax;

        // Compute face normal (default to +Z if no axis was dominant)
        const normal = Vector3.zero();
        if (tminAxis === 0) normal.x = tminSign;
        else if (tminAxis === 1) normal.y = tminSign;
        else normal.z = tminSign;

        return { t, normal };
    }

    /**
     * Performs a raycast from screen coordinates and returns the closest hit.
     */
    private raycastFromScreen(screenX: number, screenY: number): PickResult | null {
        const ray = this.screenToWorldRay(screenX, screenY);
        if (!ray) return null;
        return this.raycast(ray.origin, ray.direction);
    }

    /**
     * Internal raycast against all objects, returning sorted hits.
     */
    private raycastAllInternal(origin: Vector3, direction: Vector3, maxDistance: number): PickResult[] {
        const results: PickResult[] = [];

        for (const obj of this._objects) {
            if (!obj.active) continue;

            const { boxMin, boxMax } = this.getAABB(obj);
            const hit = this.rayIntersectAABB(origin, direction, boxMin, boxMax);

            if (hit !== null && hit.t >= 0 && hit.t <= maxDistance) {
                const hitPoint = new Vector3(
                    origin.x + direction.x * hit.t,
                    origin.y + direction.y * hit.t,
                    origin.z + direction.z * hit.t
                );
                results.push({
                    object: obj,
                    distance: hit.t,
                    hitPoint,
                    normal: hit.normal,
                });
            }
        }

        results.sort((a, b) => a.distance - b.distance);
        return results;
    }

    /**
     * Screen-space bounding box picking — projects 8 AABB corners to screen
     * and checks whether the screen point falls inside the projected rectangle.
     * Returns the single best candidate.
     */
    private screenSpacePick(screenX: number, screenY: number): PickResult | null {
        const candidates = this.screenSpacePickCandidates(screenX, screenY);
        if (candidates.length === 0) return null;
        return candidates[0];
    }

    /**
     * Screen-space bounding box picking returning all hits sorted by quality.
     */
    private screenSpacePickAll(screenX: number, screenY: number): PickResult[] {
        return this.screenSpacePickCandidates(screenX, screenY);
    }

    /**
     * Collects all screen-space pick candidates for the given screen point,
     * sorted by depth, projected box size, and proximity to centre.
     */
    private screenSpacePickCandidates(screenX: number, screenY: number): PickResult[] {
        const candidates: {
            obj: GameObject;
            z: number;
            distToCenter: number;
            boxSize: number;
        }[] = [];

        for (const obj of this._objects) {
            if (!obj.active) continue;

            const { boxMin, boxMax } = this.getAABB(obj);

            // Build 8 corners
            const corners: Vector3[] = [
                new Vector3(boxMin.x, boxMin.y, boxMin.z),
                new Vector3(boxMax.x, boxMin.y, boxMin.z),
                new Vector3(boxMin.x, boxMax.y, boxMin.z),
                new Vector3(boxMax.x, boxMax.y, boxMin.z),
                new Vector3(boxMin.x, boxMin.y, boxMax.z),
                new Vector3(boxMax.x, boxMin.y, boxMax.z),
                new Vector3(boxMin.x, boxMax.y, boxMax.z),
                new Vector3(boxMax.x, boxMax.y, boxMax.z),
            ];

            let minSX = Infinity, maxSX = -Infinity;
            let minSY = Infinity, maxSY = -Infinity;
            let minZ = Infinity;
            let behindCamera = false;

            for (const corner of corners) {
                const sp = this.worldToScreen(corner);
                if (sp.z < 0) {
                    behindCamera = true;
                    break;
                }
                minSX = Math.min(minSX, sp.x);
                maxSX = Math.max(maxSX, sp.x);
                minSY = Math.min(minSY, sp.y);
                maxSY = Math.max(maxSY, sp.y);
                minZ = Math.min(minZ, sp.z);
            }

            if (behindCamera) continue;

            const boxWidth = maxSX - minSX;
            const boxHeight = maxSY - minSY;
            const boxSize = boxWidth * boxHeight;

            // Expand small objects to a minimum clickable size
            if (boxWidth < MIN_CLICKABLE_SIZE) {
                const expand = (MIN_CLICKABLE_SIZE - boxWidth) / 2;
                minSX -= expand;
                maxSX += expand;
            }
            if (boxHeight < MIN_CLICKABLE_SIZE) {
                const expand = (MIN_CLICKABLE_SIZE - boxHeight) / 2;
                minSY -= expand;
                maxSY += expand;
            }

            // Add padding
            minSX -= CLICK_PADDING;
            maxSX += CLICK_PADDING;
            minSY -= CLICK_PADDING;
            maxSY += CLICK_PADDING;

            if (screenX >= minSX && screenX <= maxSX &&
                screenY >= minSY && screenY <= maxSY) {
                const centerX = (minSX + maxSX) / 2;
                const centerY = (minSY + maxSY) / 2;
                const distToCenter = Math.hypot(screenX - centerX, screenY - centerY);
                candidates.push({ obj, z: minZ, distToCenter, boxSize });
            }
        }

        // Sort: closer depth → smaller box → closer to center
        candidates.sort((a, b) => {
            const zDiff = a.z - b.z;
            if (Math.abs(zDiff) > 0.5) return zDiff;

            const sizeDiff = a.boxSize - b.boxSize;
            if (Math.abs(sizeDiff) > 100) return sizeDiff;

            return a.distToCenter - b.distToCenter;
        });

        // Convert to PickResult (approximate hit point from camera through object centre)
        return candidates.map((c) => {
            const pos = c.obj.transform.position;
            const cameraPos = this._camera.getPosition();
            const distance = cameraPos.distanceTo(pos);
            return {
                object: c.obj,
                distance,
                hitPoint: pos.clone(),
            };
        });
    }
}
