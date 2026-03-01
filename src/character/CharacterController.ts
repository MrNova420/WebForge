/**
 * @module character
 * @fileoverview Character controller system providing physics-based movement,
 * state management, and camera control for first-person and third-person characters.
 */

import { Vector3 } from '../math/Vector3';

/**
 * Configuration for the character controller's movement and physics properties.
 */
export interface CharacterControllerConfig {
    /** Base movement speed in units per second */
    moveSpeed: number;
    /** Sprint movement speed in units per second */
    sprintSpeed: number;
    /** Upward impulse applied when jumping */
    jumpForce: number;
    /** Gravitational acceleration (positive = downward) */
    gravity: number;
    /** Distance to cast downward for ground detection */
    groundCheckDistance: number;
    /** Maximum walkable slope angle in degrees */
    slopeLimit: number;
    /** Maximum step height the controller can climb */
    stepHeight: number;
    /** Collision skin width to prevent clipping */
    skinWidth: number;
    /** Movement control multiplier while airborne (0-1) */
    airControl: number;
    /** Character mass in kilograms */
    mass: number;
    /** Linear drag coefficient applied to velocity */
    drag: number;
    /** Rotational drag coefficient */
    angularDrag: number;
}

/**
 * Enumeration of possible character movement states.
 */
export enum CharacterState {
    Idle,
    Walking,
    Running,
    Sprinting,
    Jumping,
    Falling,
    Crouching,
    Sliding,
    Swimming,
    Climbing,
    Dead
}

/** Callback invoked when the character transitions between states. */
export type StateChangeCallback = (previous: CharacterState, current: CharacterState) => void;

/**
 * Physics-based character controller with state management, gravity,
 * ground detection, and camera rotation support.
 *
 * @example
 * ```typescript
 * const controller = new CharacterController();
 * controller.onStateChange = (prev, curr) => console.log(prev, '->', curr);
 *
 * function gameLoop(dt: number) {
 *     controller.move(new Vector3(inputX, 0, inputZ), dt);
 *     controller.update(dt);
 * }
 * ```
 */
export class CharacterController {
    /** World-space position of the character. */
    public position: Vector3;

    /** Current velocity in units per second. */
    public velocity: Vector3;

    /** Horizontal rotation angle in radians. */
    public yaw: number = 0;

    /** Vertical rotation angle in radians (clamped ±89°). */
    public pitch: number = 0;

    /** Optional callback fired on every state transition. */
    public onStateChange: StateChangeCallback | null = null;

    private _state: CharacterState = CharacterState.Idle;
    private _grounded: boolean = true;
    private _sprintActive: boolean = false;
    private _crouchActive: boolean = false;
    private _swimming: boolean = false;
    private _climbing: boolean = false;
    private _config: CharacterControllerConfig;
    private _initialPosition: Vector3;

    private static readonly PITCH_LIMIT = (89 * Math.PI) / 180;

    /**
     * Creates a new CharacterController.
     * @param config - Optional partial configuration; unset fields use sensible defaults.
     */
    constructor(config?: Partial<CharacterControllerConfig>) {
        this._config = { ...CharacterMovementPresets.defaultFPS(), ...config };
        this.position = Vector3.zero();
        this.velocity = Vector3.zero();
        this._initialPosition = Vector3.zero();
    }

    // ── State management ────────────────────────────────────────────

    /** Returns the current character state. */
    public getState(): CharacterState {
        return this._state;
    }

    /**
     * Transitions to a new state, invoking {@link onStateChange} if registered.
     * No-op when the new state matches the current state.
     */
    public setState(state: CharacterState): void {
        if (this._state === state) return;
        const previous = this._state;
        this._state = state;
        this.onStateChange?.(previous, state);
    }

    // ── Movement ────────────────────────────────────────────────────

    /**
     * Processes character movement for a single frame.
     *
     * The supplied direction is transformed into world space using the current
     * yaw, scaled by the active speed and delta time, and accumulated into
     * velocity. Air control is reduced by the configured multiplier.
     *
     * @param direction - Desired movement direction in local space (typically normalized).
     * @param deltaTime - Frame delta time in seconds.
     */
    public move(direction: Vector3, deltaTime: number): void {
        if (this._state === CharacterState.Dead) return;

        const speed = this._resolveSpeed();
        const controlFactor = this._grounded ? 1.0 : this._config.airControl;

        const worldDir = this._toWorldDirection(direction);
        const factor = speed * controlFactor * deltaTime;

        this.velocity.set(
            this.velocity.x + worldDir.x * factor,
            this.velocity.y,
            this.velocity.z + worldDir.z * factor
        );

        this._updateMovementState(direction);
    }

    /**
     * Applies a jump impulse if the character is on the ground and not dead.
     * Transitions to the {@link CharacterState.Jumping} state on success.
     * @returns `true` if the jump was applied.
     */
    public jump(): boolean {
        if (!this._grounded || this._state === CharacterState.Dead) return false;

        this.velocity.set(this.velocity.x, this._config.jumpForce, this.velocity.z);
        this._grounded = false;
        this.setState(CharacterState.Jumping);
        return true;
    }

    /**
     * Enables or disables sprinting.
     * @param active - Whether sprint should be active.
     */
    public sprint(active: boolean): void {
        this._sprintActive = active;
    }

    /**
     * Enables or disables crouching.
     * Transitions state when grounded.
     * @param active - Whether crouch should be active.
     */
    public crouch(active: boolean): void {
        this._crouchActive = active;
        if (this._grounded && active) {
            this.setState(CharacterState.Crouching);
        } else if (this._grounded && !active && this._state === CharacterState.Crouching) {
            this.setState(CharacterState.Idle);
        }
    }

    // ── Physics ─────────────────────────────────────────────────────

    /**
     * Applies gravitational acceleration when the character is airborne.
     * Gravity is ignored while swimming or climbing.
     * @param deltaTime - Frame delta time in seconds.
     */
    public applyGravity(deltaTime: number): void {
        if (this._grounded || this._swimming || this._climbing) return;

        this.velocity.set(
            this.velocity.x,
            this.velocity.y - this._config.gravity * deltaTime,
            this.velocity.z
        );

        if (this.velocity.y < 0 && this._state !== CharacterState.Dead) {
            this.setState(CharacterState.Falling);
        }
    }

    /** Returns `true` when the character is standing on a surface. */
    public isGrounded(): boolean {
        return this._grounded;
    }

    // ── Orientation ─────────────────────────────────────────────────

    /**
     * Sets the camera / character look direction.
     * Pitch is clamped to ±89° to prevent gimbal lock.
     * @param yaw   - Horizontal angle in radians.
     * @param pitch - Vertical angle in radians.
     */
    public lookAt(yaw: number, pitch: number): void {
        this.yaw = yaw;
        this.pitch = Math.max(
            -CharacterController.PITCH_LIMIT,
            Math.min(CharacterController.PITCH_LIMIT, pitch)
        );
    }

    /** Returns the world-space forward direction based on current yaw. */
    public getForwardDirection(): Vector3 {
        return new Vector3(
            -Math.sin(this.yaw),
            0,
            -Math.cos(this.yaw)
        ).normalize();
    }

    /** Returns the world-space right direction based on current yaw. */
    public getRightDirection(): Vector3 {
        return new Vector3(
            Math.cos(this.yaw),
            0,
            -Math.sin(this.yaw)
        ).normalize();
    }

    // ── Teleport / special states ───────────────────────────────────

    /**
     * Instantly moves the character to the given position and zeros velocity.
     * @param target - Destination world-space position.
     */
    public teleport(target: Vector3): void {
        this.position = target.clone();
        this.velocity = Vector3.zero();
        this._grounded = true;
    }

    /**
     * Enables or disables swimming mode. Gravity is suppressed while swimming.
     * @param active - Whether the character is in water.
     */
    public setSwimming(active: boolean): void {
        this._swimming = active;
        if (active) {
            this.setState(CharacterState.Swimming);
        } else if (this._grounded) {
            this.setState(CharacterState.Idle);
        } else {
            this.setState(CharacterState.Falling);
        }
    }

    /**
     * Enables or disables climbing mode. Gravity is suppressed while climbing.
     * @param active - Whether the character is on a climbable surface.
     */
    public setClimbing(active: boolean): void {
        this._climbing = active;
        if (active) {
            this.setState(CharacterState.Climbing);
        } else if (this._grounded) {
            this.setState(CharacterState.Idle);
        } else {
            this.setState(CharacterState.Falling);
        }
    }

    // ── Queries ─────────────────────────────────────────────────────

    /** Returns the current horizontal speed (ignoring vertical component). */
    public getSpeed(): number {
        return Math.sqrt(this.velocity.x * this.velocity.x + this.velocity.z * this.velocity.z);
    }

    /** Returns a copy of the active configuration. */
    public getConfig(): CharacterControllerConfig {
        return { ...this._config };
    }

    /**
     * Merges the provided partial config into the active configuration.
     * @param config - Fields to update.
     */
    public setConfig(config: Partial<CharacterControllerConfig>): void {
        this._config = { ...this._config, ...config };
    }

    // ── Lifecycle ───────────────────────────────────────────────────

    /**
     * Full per-frame update cycle: gravity → drag → integration → ground check.
     * Call this once per frame after processing input via {@link move}.
     * @param deltaTime - Frame delta time in seconds.
     */
    public update(deltaTime: number): void {
        if (this._state === CharacterState.Dead) return;

        this.applyGravity(deltaTime);
        this._applyDrag(deltaTime);
        this._integrate(deltaTime);
        this._performGroundCheck();
    }

    /**
     * Resets the controller to its initial state: origin position,
     * zero velocity, idle state, and default orientation.
     */
    public reset(): void {
        this.position = this._initialPosition.clone();
        this.velocity = Vector3.zero();
        this.yaw = 0;
        this.pitch = 0;
        this._grounded = true;
        this._sprintActive = false;
        this._crouchActive = false;
        this._swimming = false;
        this._climbing = false;
        this.setState(CharacterState.Idle);
    }

    // ── Private helpers ─────────────────────────────────────────────

    /** Resolves the effective speed based on current state modifiers. */
    private _resolveSpeed(): number {
        if (this._crouchActive) return this._config.moveSpeed * 0.5;
        if (this._swimming) return this._config.moveSpeed * 0.6;
        if (this._climbing) return this._config.moveSpeed * 0.4;
        if (this._sprintActive) return this._config.sprintSpeed;
        return this._config.moveSpeed;
    }

    /** Transforms a local-space direction into world space using the current yaw. */
    private _toWorldDirection(direction: Vector3): Vector3 {
        const forward = this.getForwardDirection();
        const right = this.getRightDirection();

        return new Vector3(
            forward.x * direction.z + right.x * direction.x,
            direction.y,
            forward.z * direction.z + right.z * direction.x
        );
    }

    /** Updates the movement state based on input direction and modifiers. */
    private _updateMovementState(direction: Vector3): void {
        if (!this._grounded) return;
        if (this._swimming || this._climbing || this._crouchActive) return;

        const horizontalMag = Math.sqrt(direction.x * direction.x + direction.z * direction.z);

        if (horizontalMag < 0.01) {
            this.setState(CharacterState.Idle);
        } else if (this._sprintActive) {
            this.setState(CharacterState.Sprinting);
        } else if (horizontalMag > 0.5) {
            this.setState(CharacterState.Running);
        } else {
            this.setState(CharacterState.Walking);
        }
    }

    /** Applies linear drag to horizontal velocity. */
    private _applyDrag(deltaTime: number): void {
        const dragFactor = Math.max(0, 1 - this._config.drag * deltaTime);
        this.velocity.set(
            this.velocity.x * dragFactor,
            this.velocity.y,
            this.velocity.z * dragFactor
        );
    }

    /** Integrates velocity into position. */
    private _integrate(deltaTime: number): void {
        this.position.set(
            this.position.x + this.velocity.x * deltaTime,
            this.position.y + this.velocity.y * deltaTime,
            this.position.z + this.velocity.z * deltaTime
        );
    }

    /** Performs a simplified ground check based on vertical position and velocity. */
    private _performGroundCheck(): void {
        const wasGrounded = this._grounded;

        if (this.position.y <= 0) {
            this.position.set(this.position.x, 0, this.position.z);
            this.velocity.set(this.velocity.x, Math.max(0, this.velocity.y), this.velocity.z);
            this._grounded = true;

            if (!wasGrounded && this._state === CharacterState.Falling) {
                this.setState(CharacterState.Idle);
            }
        } else {
            this._grounded = this.velocity.y <= 0 &&
                this.position.y <= this._config.groundCheckDistance;
        }
    }
}

/**
 * Predefined movement configuration presets for common game styles.
 *
 * @example
 * ```typescript
 * const fps = new CharacterController(CharacterMovementPresets.defaultFPS());
 * const platformer = new CharacterController(CharacterMovementPresets.platformer());
 * ```
 */
export class CharacterMovementPresets {
    /** Standard first-person shooter configuration. */
    public static defaultFPS(): CharacterControllerConfig {
        return {
            moveSpeed: 5.0,
            sprintSpeed: 8.0,
            jumpForce: 7.0,
            gravity: 18.0,
            groundCheckDistance: 0.15,
            slopeLimit: 45,
            stepHeight: 0.35,
            skinWidth: 0.08,
            airControl: 0.3,
            mass: 80,
            drag: 8.0,
            angularDrag: 0.5,
        };
    }

    /** Third-person camera-relative movement configuration. */
    public static thirdPerson(): CharacterControllerConfig {
        return {
            moveSpeed: 4.0,
            sprintSpeed: 7.5,
            jumpForce: 6.5,
            gravity: 16.0,
            groundCheckDistance: 0.2,
            slopeLimit: 50,
            stepHeight: 0.4,
            skinWidth: 0.1,
            airControl: 0.4,
            mass: 75,
            drag: 6.0,
            angularDrag: 0.4,
        };
    }

    /** Responsive platformer-style movement with high air control. */
    public static platformer(): CharacterControllerConfig {
        return {
            moveSpeed: 7.0,
            sprintSpeed: 10.0,
            jumpForce: 12.0,
            gravity: 28.0,
            groundCheckDistance: 0.1,
            slopeLimit: 60,
            stepHeight: 0.5,
            skinWidth: 0.05,
            airControl: 0.8,
            mass: 60,
            drag: 5.0,
            angularDrag: 0.2,
        };
    }

    /** Simulation-grade realistic movement with heavy physics. */
    public static realistic(): CharacterControllerConfig {
        return {
            moveSpeed: 3.0,
            sprintSpeed: 6.0,
            jumpForce: 5.0,
            gravity: 9.81,
            groundCheckDistance: 0.25,
            slopeLimit: 35,
            stepHeight: 0.25,
            skinWidth: 0.12,
            airControl: 0.15,
            mass: 85,
            drag: 10.0,
            angularDrag: 0.8,
        };
    }

    private constructor() { /* static-only class */ }
}
