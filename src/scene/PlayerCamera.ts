/**
 * PlayerCamera - Ready-to-use camera controllers for games.
 *
 * Provides first-person, third-person, orbital, top-down, and side-scroller
 * camera modes with smooth following, camera shake, and configurable limits.
 */

import { Vector3 } from '../math/Vector3';
import { Matrix4 } from '../math/Matrix4';

/** Available camera controller modes. */
export enum PlayerCameraMode {
    FirstPerson = 'FirstPerson',
    ThirdPerson = 'ThirdPerson',
    Orbital = 'Orbital',
    TopDown = 'TopDown',
    SideScroller = 'SideScroller'
}

/** Base configuration shared by all camera modes. */
export interface CameraConfig {
    mode: PlayerCameraMode;
    /** Vertical field of view in degrees. */
    fov?: number;
    /** Near clipping plane distance. */
    near?: number;
    /** Far clipping plane distance. */
    far?: number;
    /** Mouse / input sensitivity multiplier. */
    sensitivity?: number;
    /** Lerp factor for smooth following (0–1). Lower = smoother. */
    smoothing?: number;
}

/** Configuration for first-person cameras. */
export interface FirstPersonConfig extends CameraConfig {
    /** Enable head-bob effect while moving. */
    headBob?: boolean;
    /** Vertical head-bob amplitude in world units. */
    headBobIntensity?: number;
    /** Head-bob oscillation speed. */
    headBobSpeed?: number;
    /** Minimum pitch in radians (looking down). */
    minPitch?: number;
    /** Maximum pitch in radians (looking up). */
    maxPitch?: number;
    /** Eye height above the position origin. */
    eyeHeight?: number;
}

/** Configuration for third-person cameras. */
export interface ThirdPersonConfig extends CameraConfig {
    /** Distance behind the follow target. */
    distance?: number;
    /** Minimum zoom-in distance. */
    minDistance?: number;
    /** Maximum zoom-out distance. */
    maxDistance?: number;
    /** Vertical offset above the follow target. */
    heightOffset?: number;
    /** Horizontal shoulder offset (positive = right). */
    shoulderOffset?: number;
    /** Minimum pitch in radians. */
    minPitch?: number;
    /** Maximum pitch in radians. */
    maxPitch?: number;
}

/** Configuration for orbital cameras. */
export interface OrbitalConfig extends CameraConfig {
    /** World-space point to orbit around. */
    target?: Vector3;
    /** Orbit radius (distance from target). */
    radius?: number;
    /** Minimum orbit radius. */
    minRadius?: number;
    /** Maximum orbit radius. */
    maxRadius?: number;
    /** Enable automatic rotation around the target. */
    autoRotate?: boolean;
    /** Automatic rotation speed in radians per second. */
    autoRotateSpeed?: number;
    /** Minimum pitch in radians. */
    minPitch?: number;
    /** Maximum pitch in radians. */
    maxPitch?: number;
    /** Zoom speed multiplier. */
    zoomSpeed?: number;
}

// Degree-to-radian helpers
const DEG2RAD = Math.PI / 180;
const DEFAULT_MIN_PITCH = -89 * DEG2RAD;
const DEFAULT_MAX_PITCH = 89 * DEG2RAD;

/** Internal state for the camera-shake effect (damped oscillation). */
interface ShakeState {
    intensity: number;
    duration: number;
    elapsed: number;
    offset: Vector3;
    /** Random per-axis angular frequencies for varied oscillation. */
    frequencies: Vector3;
}

/**
 * PlayerCamera provides plug-and-play camera controllers for common game
 * camera styles. Switch between modes at runtime and configure behaviour
 * through typed config objects.
 */
export class PlayerCamera {
    // --- public read-only state ---------------------------------------------------
    private _mode: PlayerCameraMode;
    private _fov: number;
    private _near: number;
    private _far: number;
    private _sensitivity: number;
    private _smoothing: number;

    // --- spatial state -----------------------------------------------------------
    private _position: Vector3 = Vector3.zero();
    private _eyePosition: Vector3 = Vector3.zero();
    private _target: Vector3 = Vector3.zero();
    private _yaw: number = 0;
    private _pitch: number = 0;

    // --- first-person specifics --------------------------------------------------
    private _headBob: boolean = false;
    private _headBobIntensity: number = 0.05;
    private _headBobSpeed: number = 10;
    private _headBobTimer: number = 0;
    private _eyeHeight: number = 1.7;

    // --- third-person specifics --------------------------------------------------
    private _distance: number = 5;
    private _minDistance: number = 1;
    private _maxDistance: number = 20;
    private _heightOffset: number = 1.5;
    private _shoulderOffset: number = 0.5;

    // --- orbital specifics -------------------------------------------------------
    private _radius: number = 5;
    private _minRadius: number = 0.5;
    private _maxRadius: number = 50;
    private _autoRotate: boolean = false;
    private _autoRotateSpeed: number = 0.5;
    private _zoomSpeed: number = 1;

    // --- pitch limits (shared) ---------------------------------------------------
    private _minPitch: number = DEFAULT_MIN_PITCH;
    private _maxPitch: number = DEFAULT_MAX_PITCH;

    // --- camera shake ------------------------------------------------------------
    private _shake: ShakeState | null = null;

    // --- cached matrices ---------------------------------------------------------
    private _viewMatrixDirty: boolean = true;
    private _cachedViewMatrix: Matrix4 = Matrix4.identity();

    // ---------------------------------------------------------------------------
    // Construction
    // ---------------------------------------------------------------------------

    constructor(config: CameraConfig | FirstPersonConfig | ThirdPersonConfig | OrbitalConfig) {
        this._mode = config.mode;
        this._fov = config.fov ?? 60;
        this._near = config.near ?? 0.1;
        this._far = config.far ?? 1000;
        this._sensitivity = config.sensitivity ?? 1;
        this._smoothing = config.smoothing ?? 0.1;

        this._applyModeConfig(config);
    }

    // ---------------------------------------------------------------------------
    // Static factory helpers
    // ---------------------------------------------------------------------------

    /** Create a first-person camera with optional overrides. */
    public static createFPS(config?: Partial<FirstPersonConfig>): PlayerCamera {
        return new PlayerCamera({ mode: PlayerCameraMode.FirstPerson, ...config } as FirstPersonConfig);
    }

    /** Create a third-person follow camera with optional overrides. */
    public static createThirdPerson(config?: Partial<ThirdPersonConfig>): PlayerCamera {
        return new PlayerCamera({ mode: PlayerCameraMode.ThirdPerson, ...config } as ThirdPersonConfig);
    }

    /** Create an orbital camera with optional overrides. */
    public static createOrbital(config?: Partial<OrbitalConfig>): PlayerCamera {
        return new PlayerCamera({ mode: PlayerCameraMode.Orbital, ...config } as OrbitalConfig);
    }

    /** Create a top-down camera (orbital locked to steep pitch). */
    public static createTopDown(config?: Partial<OrbitalConfig>): PlayerCamera {
        const merged: OrbitalConfig = {
            mode: PlayerCameraMode.TopDown,
            radius: 15,
            minPitch: -89 * DEG2RAD,
            maxPitch: -89 * DEG2RAD,
            ...config
        };
        return new PlayerCamera(merged);
    }

    /** Create a side-scroller camera (fixed Z offset, constrained axes). */
    public static createSideScroller(config?: Partial<ThirdPersonConfig>): PlayerCamera {
        const merged: ThirdPersonConfig = {
            mode: PlayerCameraMode.SideScroller,
            distance: 10,
            heightOffset: 0,
            shoulderOffset: 0,
            ...config
        };
        return new PlayerCamera(merged);
    }

    // ---------------------------------------------------------------------------
    // Public getters / setters
    // ---------------------------------------------------------------------------

    /** Current camera world-space position (including shake offset). */
    public getPosition(): Vector3 {
        const base = this._mode === PlayerCameraMode.FirstPerson
            ? this._eyePosition
            : this._position;
        if (this._shake) {
            return base.add(this._shake.offset);
        }
        return base.clone();
    }

    /** Point the camera is looking at. */
    public getTarget(): Vector3 {
        return this._target.clone();
    }

    /** Compute and return the view (look-at) matrix. */
    public getViewMatrix(): Matrix4 {
        if (this._viewMatrixDirty) {
            const eye = this.getPosition();
            const up = Vector3.up();
            this._cachedViewMatrix = Matrix4.lookAt(eye, this._target, up);
            this._viewMatrixDirty = false;
        }
        return this._cachedViewMatrix.clone();
    }

    /** Unit vector pointing forward from the camera (ignoring pitch for XZ). */
    public getForward(): Vector3 {
        const fx = Math.sin(this._yaw);
        const fz = Math.cos(this._yaw);
        return new Vector3(fx, 0, fz).normalizeSelf();
    }

    /** Unit vector pointing right from the camera. */
    public getRight(): Vector3 {
        const forward = this.getForward();
        return forward.cross(Vector3.up()).normalizeSelf();
    }

    /** World up vector (always Y-up). */
    public getUp(): Vector3 {
        return Vector3.up();
    }

    /** Current yaw in radians. */
    public getYaw(): number {
        return this._yaw;
    }

    /** Current pitch in radians. */
    public getPitch(): number {
        return this._pitch;
    }

    /** Field of view in degrees. */
    public getFOV(): number {
        return this._fov;
    }

    /** Set field of view in degrees. */
    public setFOV(fov: number): void {
        this._fov = fov;
    }

    /** Near clipping plane distance. */
    public getNear(): number {
        return this._near;
    }

    /** Far clipping plane distance. */
    public getFar(): number {
        return this._far;
    }

    // ---------------------------------------------------------------------------
    // Mode switching
    // ---------------------------------------------------------------------------

    /** Switch camera mode at runtime, preserving position and orientation. */
    public setMode(mode: PlayerCameraMode): void {
        this._mode = mode;
        this._viewMatrixDirty = true;
    }

    // ---------------------------------------------------------------------------
    // Core update
    // ---------------------------------------------------------------------------

    /** Advance camera state by one frame. Call once per game tick. */
    public update(deltaTime: number): void {
        this._updateShake(deltaTime);

        switch (this._mode) {
            case PlayerCameraMode.FirstPerson:
                this._updateFirstPerson(deltaTime);
                break;
            case PlayerCameraMode.ThirdPerson:
                this._updateThirdPerson(deltaTime);
                break;
            case PlayerCameraMode.Orbital:
                this._updateOrbital(deltaTime);
                break;
            case PlayerCameraMode.TopDown:
                this._updateOrbital(deltaTime);
                break;
            case PlayerCameraMode.SideScroller:
                this._updateSideScroller(deltaTime);
                break;
        }

        this._viewMatrixDirty = true;
    }

    // ---------------------------------------------------------------------------
    // Input methods
    // ---------------------------------------------------------------------------

    /**
     * Apply yaw/pitch rotation from input (e.g. mouse delta).
     * Values are scaled by the configured sensitivity.
     */
    public rotate(deltaYaw: number, deltaPitch: number): void {
        this._yaw += deltaYaw * this._sensitivity;
        this._pitch += deltaPitch * this._sensitivity;
        this._pitch = clamp(this._pitch, this._minPitch, this._maxPitch);
        this._viewMatrixDirty = true;
    }

    /** Zoom in/out. Behaviour depends on current mode. */
    public zoom(delta: number): void {
        switch (this._mode) {
            case PlayerCameraMode.ThirdPerson:
            case PlayerCameraMode.SideScroller:
                this._distance = clamp(
                    this._distance - delta * this._zoomSpeed,
                    this._minDistance,
                    this._maxDistance
                );
                break;
            case PlayerCameraMode.Orbital:
            case PlayerCameraMode.TopDown:
                this._radius = clamp(
                    this._radius - delta * this._zoomSpeed,
                    this._minRadius,
                    this._maxRadius
                );
                break;
            default:
                break;
        }
        this._viewMatrixDirty = true;
    }

    /**
     * Set the look-at target for third-person / orbital modes.
     * For first-person mode this sets the internal forward target.
     */
    public setTarget(position: Vector3): void {
        this._target = position.clone();
        this._viewMatrixDirty = true;
    }

    /** Teleport the camera to a world-space position. */
    public setPosition(position: Vector3): void {
        this._position = position.clone();
        this._viewMatrixDirty = true;
    }

    // ---------------------------------------------------------------------------
    // Camera shake
    // ---------------------------------------------------------------------------

    /**
     * Trigger a camera-shake effect using damped oscillation.
     * @param intensity - Maximum displacement in world units.
     * @param duration  - Duration of the shake in seconds.
     */
    public shake(intensity: number, duration: number): void {
        this._shake = {
            intensity,
            duration,
            elapsed: 0,
            offset: Vector3.zero(),
            frequencies: new Vector3(
                25 + Math.random() * 10,
                30 + Math.random() * 10,
                20 + Math.random() * 10
            )
        };
    }

    // ---------------------------------------------------------------------------
    // First-person helpers
    // ---------------------------------------------------------------------------

    /**
     * Compute a movement direction vector from forward/strafe input.
     * Returns a world-space direction; the caller is responsible for applying speed.
     * @param forward - Forward / backward input (positive = forward).
     * @param strafe  - Left / right input (positive = right).
     */
    public move(forward: number, strafe: number): Vector3 {
        const fwd = this.getForward();
        const right = this.getRight();
        return fwd.multiplyScalar(forward).add(right.multiplyScalar(strafe)).normalizeSelf();
    }

    // ---------------------------------------------------------------------------
    // Third-person helpers
    // ---------------------------------------------------------------------------

    /** Set the world-space position the third-person camera should follow. */
    public setFollowTarget(target: Vector3): void {
        this._target = target.clone();
        this._viewMatrixDirty = true;
    }

    /** Set the follow distance for third-person mode. */
    public setDistance(d: number): void {
        this._distance = clamp(d, this._minDistance, this._maxDistance);
        this._viewMatrixDirty = true;
    }

    // ---------------------------------------------------------------------------
    // Orbital helpers
    // ---------------------------------------------------------------------------

    /** Set the world-space point to orbit around. */
    public setOrbitTarget(target: Vector3): void {
        this._target = target.clone();
        this._viewMatrixDirty = true;
    }

    /** Set the orbit radius (distance from target). */
    public setRadius(r: number): void {
        this._radius = clamp(r, this._minRadius, this._maxRadius);
        this._viewMatrixDirty = true;
    }

    // ---------------------------------------------------------------------------
    // Private – config application
    // ---------------------------------------------------------------------------

    private _applyModeConfig(config: CameraConfig): void {
        const fp = config as FirstPersonConfig;
        const tp = config as ThirdPersonConfig;
        const orb = config as OrbitalConfig;

        // First-person
        if (fp.headBob !== undefined) this._headBob = fp.headBob;
        if (fp.headBobIntensity !== undefined) this._headBobIntensity = fp.headBobIntensity;
        if (fp.headBobSpeed !== undefined) this._headBobSpeed = fp.headBobSpeed;
        if (fp.eyeHeight !== undefined) this._eyeHeight = fp.eyeHeight;

        // Third-person
        if (tp.distance !== undefined) this._distance = tp.distance;
        if (tp.minDistance !== undefined) this._minDistance = tp.minDistance;
        if (tp.maxDistance !== undefined) this._maxDistance = tp.maxDistance;
        if (tp.heightOffset !== undefined) this._heightOffset = tp.heightOffset;
        if (tp.shoulderOffset !== undefined) this._shoulderOffset = tp.shoulderOffset;

        // Orbital
        if (orb.target !== undefined) this._target = orb.target.clone();
        if (orb.radius !== undefined) this._radius = orb.radius;
        if (orb.minRadius !== undefined) this._minRadius = orb.minRadius;
        if (orb.maxRadius !== undefined) this._maxRadius = orb.maxRadius;
        if (orb.autoRotate !== undefined) this._autoRotate = orb.autoRotate;
        if (orb.autoRotateSpeed !== undefined) this._autoRotateSpeed = orb.autoRotateSpeed;
        if (orb.zoomSpeed !== undefined) this._zoomSpeed = orb.zoomSpeed;

        // Shared pitch limits
        const anyConfig = config as FirstPersonConfig & ThirdPersonConfig & OrbitalConfig;
        if (anyConfig.minPitch !== undefined) this._minPitch = anyConfig.minPitch;
        if (anyConfig.maxPitch !== undefined) this._maxPitch = anyConfig.maxPitch;
    }

    // ---------------------------------------------------------------------------
    // Private – per-mode updates
    // ---------------------------------------------------------------------------

    private _updateFirstPerson(deltaTime: number): void {
        // Head-bob
        let bobOffset = 0;
        if (this._headBob) {
            this._headBobTimer += deltaTime * this._headBobSpeed;
            bobOffset = Math.sin(this._headBobTimer) * this._headBobIntensity;
        }

        // Camera position sits at eye height + bob
        const eyeY = this._position.y + this._eyeHeight + bobOffset;

        // Forward direction including pitch
        const cosPitch = Math.cos(this._pitch);
        const fx = Math.sin(this._yaw) * cosPitch;
        const fy = Math.sin(this._pitch);
        const fz = Math.cos(this._yaw) * cosPitch;

        this._target = new Vector3(
            this._position.x + fx,
            eyeY + fy,
            this._position.z + fz
        );

        // Store computed eye position separately to avoid drifting _position.y
        this._eyePosition = new Vector3(this._position.x, eyeY, this._position.z);
    }

    private _updateThirdPerson(_deltaTime: number): void {
        const cosPitch = Math.cos(this._pitch);
        const sinPitch = Math.sin(this._pitch);

        // Desired camera offset behind & above target
        const offsetX = -Math.sin(this._yaw) * cosPitch * this._distance;
        const offsetY = sinPitch * this._distance + this._heightOffset;
        const offsetZ = -Math.cos(this._yaw) * cosPitch * this._distance;

        // Shoulder offset (perpendicular to forward on XZ plane)
        const rightX = Math.cos(this._yaw);
        const rightZ = -Math.sin(this._yaw);

        const desiredPos = new Vector3(
            this._target.x + offsetX + rightX * this._shoulderOffset,
            this._target.y + offsetY,
            this._target.z + offsetZ + rightZ * this._shoulderOffset
        );

        // Smooth interpolation
        this._position = lerpVector3(this._position, desiredPos, this._smoothing);
    }

    private _updateOrbital(deltaTime: number): void {
        if (this._autoRotate) {
            this._yaw += this._autoRotateSpeed * deltaTime;
        }

        const cosPitch = Math.cos(this._pitch);
        const sinPitch = Math.sin(this._pitch);

        const posX = this._target.x + Math.sin(this._yaw) * cosPitch * this._radius;
        const posY = this._target.y + sinPitch * this._radius;
        const posZ = this._target.z + Math.cos(this._yaw) * cosPitch * this._radius;

        const desiredPos = new Vector3(posX, posY, posZ);
        this._position = lerpVector3(this._position, desiredPos, this._smoothing);
    }

    private _updateSideScroller(_deltaTime: number): void {
        // Camera sits at a fixed Z offset, tracking target on X/Y
        const desiredPos = new Vector3(
            this._target.x,
            this._target.y + this._heightOffset,
            this._target.z + this._distance
        );

        this._position = lerpVector3(this._position, desiredPos, this._smoothing);

        // Look straight at the target plane
        this._target = new Vector3(
            this._position.x,
            this._position.y,
            this._target.z
        );
    }

    // ---------------------------------------------------------------------------
    // Private – camera shake (damped oscillation)
    // ---------------------------------------------------------------------------

    private _updateShake(deltaTime: number): void {
        if (!this._shake) return;

        this._shake.elapsed += deltaTime;

        if (this._shake.elapsed >= this._shake.duration) {
            this._shake = null;
            return;
        }

        const t = this._shake.elapsed;
        const progress = t / this._shake.duration;

        // Exponential decay envelope: e^(-decay * t)
        const decay = 5;
        const envelope = Math.exp(-decay * progress) * this._shake.intensity;

        // Per-axis sinusoidal oscillation with unique frequencies
        const ox = Math.sin(this._shake.frequencies.x * t) * envelope;
        const oy = Math.sin(this._shake.frequencies.y * t) * envelope;
        const oz = Math.sin(this._shake.frequencies.z * t) * envelope;

        this._shake.offset = new Vector3(ox, oy, oz);
    }
}

// ---------------------------------------------------------------------------
// Module-private utilities
// ---------------------------------------------------------------------------

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

function lerpVector3(a: Vector3, b: Vector3, t: number): Vector3 {
    return a.add(b.subtract(a).multiplyScalar(t));
}
