/**
 * @module physics
 * @fileoverview Vehicle physics simulation
 * 
 * Raycast-based vehicle model with suspension, steering, and drivetrain.
 * Supports front/rear/all-wheel drive configurations.
 */

import { Vector3 } from '../math/Vector3';

/**
 * Drivetrain configuration
 */
export enum DriveType {
  FRONT_WHEEL = 'fwd',
  REAR_WHEEL = 'rwd',
  ALL_WHEEL = 'awd'
}

/**
 * Single wheel configuration
 */
export interface WheelConfig {
  /** Local attachment point relative to chassis */
  attachmentPoint: Vector3;
  /** Suspension rest length */
  suspensionRestLength: number;
  /** Suspension stiffness (spring constant) */
  suspensionStiffness: number;
  /** Suspension damping */
  suspensionDamping: number;
  /** Wheel radius */
  radius: number;
  /** Maximum suspension travel */
  maxTravel: number;
  /** Friction coefficient */
  friction: number;
  /** Whether this wheel steers */
  isSteering: boolean;
  /** Whether this wheel is driven */
  isDriven: boolean;
}

/**
 * Runtime wheel state
 */
export interface WheelState {
  config: WheelConfig;
  /** Current suspension compression (0 = rest, 1 = fully compressed) */
  suspensionCompression: number;
  /** Current suspension force */
  suspensionForce: number;
  /** Current wheel rotation angle (radians) */
  rotationAngle: number;
  /** Current steering angle (radians) */
  steeringAngle: number;
  /** Whether the wheel is in contact with ground */
  isGrounded: boolean;
  /** Ground contact point */
  contactPoint: Vector3;
  /** Ground contact normal */
  contactNormal: Vector3;
  /** Current slip ratio (0 = no slip) */
  slipRatio: number;
  /** Current slip angle (radians) */
  slipAngle: number;
  /** World position of wheel center */
  worldPosition: Vector3;
}

/**
 * Vehicle configuration
 */
export interface VehicleConfig {
  /** Vehicle mass in kg */
  mass: number;
  /** Drive type */
  driveType: DriveType;
  /** Maximum engine torque (Nm) */
  maxEngineTorque: number;
  /** Maximum brake torque (Nm) */
  maxBrakeTorque: number;
  /** Maximum steering angle (radians) */
  maxSteeringAngle: number;
  /** Drag coefficient */
  dragCoefficient: number;
  /** Center of mass offset from chassis origin */
  centerOfMass: Vector3;
  /** Wheel configurations */
  wheels: WheelConfig[];
}

/**
 * Vehicle input state
 */
export interface VehicleInput {
  /** Throttle input (-1 to 1, negative = reverse) */
  throttle: number;
  /** Brake input (0 to 1) */
  brake: number;
  /** Steering input (-1 to 1, negative = left) */
  steering: number;
  /** Handbrake input (0 to 1) */
  handbrake: number;
}

/**
 * Raycast-based vehicle physics simulation
 */
export class VehiclePhysics {
  /** Vehicle configuration */
  config: VehicleConfig;
  /** Current wheel states */
  wheels: WheelState[];
  /** Current vehicle position */
  position: Vector3;
  /** Current vehicle velocity */
  velocity: Vector3;
  /** Current angular velocity */
  angularVelocity: Vector3;
  /** Forward direction */
  forward: Vector3 = new Vector3(0, 0, -1);
  /** Right direction */
  right: Vector3 = new Vector3(1, 0, 0);
  /** Up direction */
  up: Vector3 = new Vector3(0, 1, 0);
  /** Current speed in m/s */
  speed: number = 0;
  /** Current RPM estimate */
  rpm: number = 0;
  /** Current gear (0 = neutral, -1 = reverse, 1+ = forward gears) */
  gear: number = 1;
  
  private _input: VehicleInput = { throttle: 0, brake: 0, steering: 0, handbrake: 0 };

  constructor(config: VehicleConfig) {
    this.config = config;
    this.position = new Vector3();
    this.velocity = new Vector3();
    this.angularVelocity = new Vector3();
    
    // Initialize wheel states
    this.wheels = config.wheels.map(wheelConfig => ({
      config: wheelConfig,
      suspensionCompression: 0,
      suspensionForce: 0,
      rotationAngle: 0,
      steeringAngle: 0,
      isGrounded: false,
      contactPoint: new Vector3(),
      contactNormal: new Vector3(0, 1, 0),
      slipRatio: 0,
      slipAngle: 0,
      worldPosition: wheelConfig.attachmentPoint.clone()
    }));
  }

  /**
   * Sets the vehicle input
   */
  setInput(input: VehicleInput): void {
    this._input.throttle = Math.max(-1, Math.min(1, input.throttle));
    this._input.brake = Math.max(0, Math.min(1, input.brake));
    this._input.steering = Math.max(-1, Math.min(1, input.steering));
    this._input.handbrake = Math.max(0, Math.min(1, input.handbrake));
  }

  /**
   * Gets current input
   */
  getInput(): VehicleInput {
    return { ...this._input };
  }

  /**
   * Steps the vehicle simulation
   * @param dt - Delta time in seconds
   * @param groundHeight - Function returning ground height at a world (x,z) position. Defaults to flat ground at y=0.
   */
  update(dt: number, groundHeight: (x: number, z: number) => number = () => 0): void {
    if (dt <= 0) return;

    const gravity = new Vector3(0, -9.81, 0);
    
    // Update steering angles
    for (const wheel of this.wheels) {
      if (wheel.config.isSteering) {
        wheel.steeringAngle = this._input.steering * this.config.maxSteeringAngle;
      }
    }

    // Process each wheel: suspension, traction
    let totalForce = new Vector3();
    let totalTorque = new Vector3();

    for (const wheel of this.wheels) {
      // Raycast from wheel attachment to ground
      const worldPos = wheel.config.attachmentPoint.clone().add(this.position);
      const groundY = groundHeight(worldPos.x, worldPos.z);
      const rayLength = wheel.config.suspensionRestLength + wheel.config.radius;
      const distToGround = worldPos.y - groundY;

      wheel.isGrounded = distToGround < rayLength;

      if (wheel.isGrounded) {
        // Suspension force (spring-damper)
        const compression = 1 - (distToGround / rayLength);
        wheel.suspensionCompression = Math.max(0, Math.min(1, compression));
        const springForce = wheel.config.suspensionStiffness * wheel.suspensionCompression * wheel.config.maxTravel;
        const damperVelocity = this.velocity.y;
        const damperForce = -wheel.config.suspensionDamping * damperVelocity;
        wheel.suspensionForce = Math.max(0, springForce + damperForce);
        
        totalForce.y += wheel.suspensionForce;

        // Contact point
        wheel.contactPoint = new Vector3(worldPos.x, groundY, worldPos.z);
        wheel.contactNormal = new Vector3(0, 1, 0);

        // Traction force
        if (wheel.config.isDriven) {
          const engineForce = this._input.throttle * this.config.maxEngineTorque / wheel.config.radius;
          const forwardForce = this.forward.clone().multiplyScalar(engineForce);
          totalForce = totalForce.add(forwardForce);
        }

        // Brake force
        if (this._input.brake > 0 || this._input.handbrake > 0) {
          const brakeAmount = Math.max(this._input.brake, this._input.handbrake);
          const brakeMagnitude = this.config.maxBrakeTorque * brakeAmount / wheel.config.radius;
          if (this.speed > 0.1) {
            const brakeForce = this.velocity.clone().normalize().multiplyScalar(-brakeMagnitude);
            totalForce = totalForce.add(brakeForce);
          }
        }

        // Lateral friction (cornering)
        const lateralVelocity = this.right.clone().multiplyScalar(this.velocity.dot(this.right));
        const lateralFriction = lateralVelocity.clone().multiplyScalar(-wheel.config.friction * wheel.suspensionForce / (this.config.mass * 9.81));
        totalForce = totalForce.add(lateralFriction);

        // Compute slip
        const forwardSpeed = this.velocity.dot(this.forward);
        wheel.slipAngle = Math.atan2(lateralVelocity.length(), Math.abs(forwardSpeed) + 0.001);
      } else {
        wheel.suspensionCompression = 0;
        wheel.suspensionForce = 0;
      }

      // Update wheel world position
      const suspOffset = wheel.suspensionCompression * wheel.config.maxTravel;
      wheel.worldPosition = wheel.config.attachmentPoint.clone().add(this.position);
      wheel.worldPosition.y -= (wheel.config.suspensionRestLength - suspOffset);

      // Spin the wheel
      const forwardSpeed = this.velocity.dot(this.forward);
      wheel.rotationAngle += (forwardSpeed / wheel.config.radius) * dt;
    }

    // Apply gravity
    totalForce = totalForce.add(gravity.clone().multiplyScalar(this.config.mass));

    // Aerodynamic drag
    const dragForce = this.velocity.clone().multiplyScalar(-this.config.dragCoefficient * this.velocity.length());
    totalForce = totalForce.add(dragForce);

    // Steering torque
    if (Math.abs(this._input.steering) > 0.01 && this.speed > 0.5) {
      const steerTorque = this._input.steering * this.speed * 0.5;
      totalTorque.y += steerTorque;
    }

    // Integrate forces
    const acceleration = totalForce.clone().multiplyScalar(1 / this.config.mass);
    this.velocity = this.velocity.add(acceleration.clone().multiplyScalar(dt));
    this.position = this.position.add(this.velocity.clone().multiplyScalar(dt));

    // Keep above ground
    const chassisGroundY = groundHeight(this.position.x, this.position.z);
    if (this.position.y < chassisGroundY + 0.5) {
      this.position.y = chassisGroundY + 0.5;
      if (this.velocity.y < 0) this.velocity.y = 0;
    }

    // Update speed
    this.speed = this.velocity.dot(this.forward);

    // RPM estimate (simplified)
    this.rpm = Math.abs(this.speed) * 60 / (2 * Math.PI * 0.35);

    // Apply angular velocity for steering
    this.angularVelocity = this.angularVelocity.add(totalTorque.clone().multiplyScalar(dt));
    this.angularVelocity = this.angularVelocity.multiplyScalar(0.95); // angular damping

    // Rotate forward/right vectors based on angular velocity
    const yawRate = this.angularVelocity.y * dt;
    if (Math.abs(yawRate) > 0.0001) {
      const cosYaw = Math.cos(yawRate);
      const sinYaw = Math.sin(yawRate);
      const fx = this.forward.x * cosYaw - this.forward.z * sinYaw;
      const fz = this.forward.x * sinYaw + this.forward.z * cosYaw;
      this.forward = new Vector3(fx, 0, fz).normalize();
      this.right = new Vector3(-this.forward.z, 0, this.forward.x);
    }
  }

  /**
   * Creates a standard sedan vehicle configuration
   */
  static createSedan(): VehicleConfig {
    const wheelBase = 2.5;
    const trackWidth = 1.5;
    const wheelRadius = 0.35;
    const suspLength = 0.3;

    const makeWheel = (x: number, z: number, steering: boolean, driven: boolean): WheelConfig => ({
      attachmentPoint: new Vector3(x, 0.5, z),
      suspensionRestLength: suspLength,
      suspensionStiffness: 20000,
      suspensionDamping: 2000,
      radius: wheelRadius,
      maxTravel: 0.2,
      friction: 1.5,
      isSteering: steering,
      isDriven: driven
    });

    return {
      mass: 1500,
      driveType: DriveType.FRONT_WHEEL,
      maxEngineTorque: 300,
      maxBrakeTorque: 500,
      maxSteeringAngle: Math.PI / 6,
      dragCoefficient: 0.35,
      centerOfMass: new Vector3(0, 0.3, 0),
      wheels: [
        makeWheel(-trackWidth / 2, wheelBase / 2, true, true),   // Front left
        makeWheel(trackWidth / 2, wheelBase / 2, true, true),    // Front right
        makeWheel(-trackWidth / 2, -wheelBase / 2, false, false), // Rear left
        makeWheel(trackWidth / 2, -wheelBase / 2, false, false)   // Rear right
      ]
    };
  }

  /**
   * Creates a truck vehicle configuration
   */
  static createTruck(): VehicleConfig {
    const wheelBase = 4.0;
    const trackWidth = 2.0;
    const wheelRadius = 0.5;
    const suspLength = 0.4;

    const makeWheel = (x: number, z: number, steering: boolean, driven: boolean): WheelConfig => ({
      attachmentPoint: new Vector3(x, 0.8, z),
      suspensionRestLength: suspLength,
      suspensionStiffness: 40000,
      suspensionDamping: 4000,
      radius: wheelRadius,
      maxTravel: 0.3,
      friction: 1.2,
      isSteering: steering,
      isDriven: driven
    });

    return {
      mass: 5000,
      driveType: DriveType.REAR_WHEEL,
      maxEngineTorque: 800,
      maxBrakeTorque: 1200,
      maxSteeringAngle: Math.PI / 7,
      dragCoefficient: 0.6,
      centerOfMass: new Vector3(0, 0.5, -0.5),
      wheels: [
        makeWheel(-trackWidth / 2, wheelBase / 2, true, false),
        makeWheel(trackWidth / 2, wheelBase / 2, true, false),
        makeWheel(-trackWidth / 2, -wheelBase / 2, false, true),
        makeWheel(trackWidth / 2, -wheelBase / 2, false, true)
      ]
    };
  }

  /**
   * Creates a sports car configuration
   */
  static createSportsCar(): VehicleConfig {
    const wheelBase = 2.6;
    const trackWidth = 1.7;
    const wheelRadius = 0.33;
    const suspLength = 0.25;

    const makeWheel = (x: number, z: number, steering: boolean, driven: boolean): WheelConfig => ({
      attachmentPoint: new Vector3(x, 0.4, z),
      suspensionRestLength: suspLength,
      suspensionStiffness: 30000,
      suspensionDamping: 3000,
      radius: wheelRadius,
      maxTravel: 0.15,
      friction: 2.0,
      isSteering: steering,
      isDriven: driven
    });

    return {
      mass: 1200,
      driveType: DriveType.ALL_WHEEL,
      maxEngineTorque: 500,
      maxBrakeTorque: 800,
      maxSteeringAngle: Math.PI / 5,
      dragCoefficient: 0.28,
      centerOfMass: new Vector3(0, 0.25, 0),
      wheels: [
        makeWheel(-trackWidth / 2, wheelBase / 2, true, true),
        makeWheel(trackWidth / 2, wheelBase / 2, true, true),
        makeWheel(-trackWidth / 2, -wheelBase / 2, false, true),
        makeWheel(trackWidth / 2, -wheelBase / 2, false, true)
      ]
    };
  }
}
