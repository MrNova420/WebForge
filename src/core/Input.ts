/**
 * @module core
 * @fileoverview Input class - Comprehensive input handling for keyboard, mouse, and gamepad
 */

import { Vector2 } from '../math/Vector2';

/**
 * Mouse button enumeration.
 */
export enum MouseButton {
  LEFT = 0,
  MIDDLE = 1,
  RIGHT = 2
}

/**
 * Input state for a key or button.
 */
interface InputState {
  down: boolean;
  pressed: boolean;
  released: boolean;
}

/**
 * Gamepad state interface.
 */
interface GamepadState {
  connected: boolean;
  axes: number[];
  buttons: boolean[];
  buttonsPressed: boolean[];
  buttonsReleased: boolean[];
}

/**
 * Comprehensive input management system.
 * Handles keyboard, mouse, touch, and gamepad input with proper state tracking.
 * 
 * @example
 * ```typescript
 * const input = new Input(canvas);
 * 
 * function update() {
 *   // Check key states
 *   if (input.isKeyDown('KeyW')) {
 *     moveForward();
 *   }
 *   
 *   if (input.isKeyPressed('Space')) {
 *     jump();
 *   }
 *   
 *   // Mouse position and buttons
 *   const mousePos = input.getMousePosition();
 *   if (input.isMouseButtonDown(MouseButton.LEFT)) {
 *     shoot(mousePos);
 *   }
 *   
 *   // Must call this at end of frame
 *   input.update();
 * }
 * ```
 */
export class Input {
  /** Canvas element for input capture */
  private canvas: HTMLCanvasElement | null;
  
  /** Keyboard state map */
  private keys: Map<string, InputState>;
  
  /** Mouse button state map */
  private mouseButtons: Map<number, InputState>;
  
  /** Current mouse position */
  private mousePosition: Vector2;
  
  /** Previous mouse position */
  private previousMousePosition: Vector2;
  
  /** Mouse delta (movement since last frame) */
  private mouseDelta: Vector2;
  
  /** Mouse wheel delta */
  private mouseWheelDelta: number;
  
  /** Gamepad states */
  private gamepads: Map<number, GamepadState>;
  
  /** Whether input system is active */
  private active: boolean;
  
  /** Pointer lock state */
  private pointerLocked: boolean;

  /**
   * Creates a new Input system.
   * @param canvas - Canvas element to attach input listeners to
   */
  constructor(canvas?: HTMLCanvasElement) {
    this.canvas = canvas || null;
    this.keys = new Map();
    this.mouseButtons = new Map();
    this.mousePosition = new Vector2();
    this.previousMousePosition = new Vector2();
    this.mouseDelta = new Vector2();
    this.mouseWheelDelta = 0;
    this.gamepads = new Map();
    this.active = false;
    this.pointerLocked = false;
    
    if (canvas) {
      this.attach(canvas);
    }
  }

  /**
   * Attaches input listeners to a canvas element.
   * @param canvas - Canvas element
   */
  attach(canvas: HTMLCanvasElement): void {
    if (this.active) {
      this.detach();
    }
    
    this.canvas = canvas;
    
    // Keyboard events
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    
    // Mouse events
    canvas.addEventListener('mousedown', this.onMouseDown);
    canvas.addEventListener('mouseup', this.onMouseUp);
    canvas.addEventListener('mousemove', this.onMouseMove);
    canvas.addEventListener('wheel', this.onMouseWheel);
    canvas.addEventListener('contextmenu', this.onContextMenu);
    
    // Touch events
    canvas.addEventListener('touchstart', this.onTouchStart);
    canvas.addEventListener('touchend', this.onTouchEnd);
    canvas.addEventListener('touchmove', this.onTouchMove);
    
    // Pointer lock events
    document.addEventListener('pointerlockchange', this.onPointerLockChange);
    
    // Gamepad events
    window.addEventListener('gamepadconnected', this.onGamepadConnected);
    window.addEventListener('gamepaddisconnected', this.onGamepadDisconnected);
    
    this.active = true;
  }

  /**
   * Detaches all input listeners.
   */
  detach(): void {
    if (!this.active) return;
    
    // Keyboard events
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    
    if (this.canvas) {
      // Mouse events
      this.canvas.removeEventListener('mousedown', this.onMouseDown);
      this.canvas.removeEventListener('mouseup', this.onMouseUp);
      this.canvas.removeEventListener('mousemove', this.onMouseMove);
      this.canvas.removeEventListener('wheel', this.onMouseWheel);
      this.canvas.removeEventListener('contextmenu', this.onContextMenu);
      
      // Touch events
      this.canvas.removeEventListener('touchstart', this.onTouchStart);
      this.canvas.removeEventListener('touchend', this.onTouchEnd);
      this.canvas.removeEventListener('touchmove', this.onTouchMove);
    }
    
    // Pointer lock events
    document.removeEventListener('pointerlockchange', this.onPointerLockChange);
    
    // Gamepad events
    window.removeEventListener('gamepadconnected', this.onGamepadConnected);
    window.removeEventListener('gamepaddisconnected', this.onGamepadDisconnected);
    
    this.active = false;
  }

  /**
   * Updates input state. Call this at the end of each frame.
   */
  update(): void {
    // Clear pressed and released states
    this.keys.forEach(state => {
      state.pressed = false;
      state.released = false;
    });
    
    this.mouseButtons.forEach(state => {
      state.pressed = false;
      state.released = false;
    });
    
    // Clear mouse delta and wheel delta
    this.previousMousePosition.copy(this.mousePosition);
    this.mouseDelta.set(0, 0);
    this.mouseWheelDelta = 0;
    
    // Update gamepad states
    this.updateGamepads();
  }

  /**
   * Keyboard event handler - key down.
   */
  private onKeyDown = (event: KeyboardEvent): void => {
    const state = this.getOrCreateKeyState(event.code);
    
    if (!state.down) {
      state.down = true;
      state.pressed = true;
    }
  };

  /**
   * Keyboard event handler - key up.
   */
  private onKeyUp = (event: KeyboardEvent): void => {
    const state = this.getOrCreateKeyState(event.code);
    
    if (state.down) {
      state.down = false;
      state.released = true;
    }
  };

  /**
   * Mouse event handler - button down.
   */
  private onMouseDown = (event: MouseEvent): void => {
    const state = this.getOrCreateMouseButtonState(event.button);
    
    if (!state.down) {
      state.down = true;
      state.pressed = true;
    }
    
    event.preventDefault();
  };

  /**
   * Mouse event handler - button up.
   */
  private onMouseUp = (event: MouseEvent): void => {
    const state = this.getOrCreateMouseButtonState(event.button);
    
    if (state.down) {
      state.down = false;
      state.released = true;
    }
    
    event.preventDefault();
  };

  /**
   * Mouse event handler - movement.
   */
  private onMouseMove = (event: MouseEvent): void => {
    if (!this.canvas) return;
    
    const rect = this.canvas.getBoundingClientRect();
    this.mousePosition.set(
      event.clientX - rect.left,
      event.clientY - rect.top
    );
    
    this.mouseDelta.set(event.movementX, event.movementY);
  };

  /**
   * Mouse event handler - wheel.
   */
  private onMouseWheel = (event: WheelEvent): void => {
    this.mouseWheelDelta = -event.deltaY;
    event.preventDefault();
  };

  /**
   * Context menu handler (prevents right-click menu).
   */
  private onContextMenu = (event: Event): void => {
    event.preventDefault();
  };

  /**
   * Touch event handler - start.
   */
  private onTouchStart = (event: TouchEvent): void => {
    if (event.touches.length > 0 && this.canvas) {
      const touch = event.touches[0];
      const rect = this.canvas.getBoundingClientRect();
      this.mousePosition.set(
        touch.clientX - rect.left,
        touch.clientY - rect.top
      );
      
      // Simulate left mouse button
      const state = this.getOrCreateMouseButtonState(MouseButton.LEFT);
      if (!state.down) {
        state.down = true;
        state.pressed = true;
      }
    }
    
    event.preventDefault();
  };

  /**
   * Touch event handler - end.
   */
  private onTouchEnd = (event: TouchEvent): void => {
    // Simulate left mouse button release
    const state = this.getOrCreateMouseButtonState(MouseButton.LEFT);
    if (state.down) {
      state.down = false;
      state.released = true;
    }
    
    event.preventDefault();
  };

  /**
   * Touch event handler - move.
   */
  private onTouchMove = (event: TouchEvent): void => {
    if (event.touches.length > 0 && this.canvas) {
      const touch = event.touches[0];
      const rect = this.canvas.getBoundingClientRect();
      const newPos = new Vector2(
        touch.clientX - rect.left,
        touch.clientY - rect.top
      );
      this.mouseDelta = newPos.subtract(this.mousePosition);
      this.mousePosition.copy(newPos);
    }
    
    event.preventDefault();
  };

  /**
   * Pointer lock change handler.
   */
  private onPointerLockChange = (): void => {
    this.pointerLocked = document.pointerLockElement === this.canvas;
  };

  /**
   * Gamepad connected handler.
   */
  private onGamepadConnected = (event: GamepadEvent): void => {
    const gamepad = event.gamepad;
    this.gamepads.set(gamepad.index, {
      connected: true,
      axes: Array.from(gamepad.axes),
      buttons: gamepad.buttons.map(b => b.pressed),
      buttonsPressed: new Array(gamepad.buttons.length).fill(false),
      buttonsReleased: new Array(gamepad.buttons.length).fill(false)
    });
  };

  /**
   * Gamepad disconnected handler.
   */
  private onGamepadDisconnected = (event: GamepadEvent): void => {
    this.gamepads.delete(event.gamepad.index);
  };

  /**
   * Updates gamepad states.
   */
  private updateGamepads(): void {
    const gamepads = navigator.getGamepads();
    
    for (let i = 0; i < gamepads.length; i++) {
      const gamepad = gamepads[i];
      if (!gamepad) continue;
      
      const state = this.gamepads.get(gamepad.index);
      if (!state) continue;
      
      // Update axes
      state.axes = Array.from(gamepad.axes);
      
      // Update buttons with pressed/released detection
      for (let j = 0; j < gamepad.buttons.length; j++) {
        const pressed = gamepad.buttons[j].pressed;
        const wasPressed = state.buttons[j];
        
        state.buttonsPressed[j] = pressed && !wasPressed;
        state.buttonsReleased[j] = !pressed && wasPressed;
        state.buttons[j] = pressed;
      }
    }
  }

  /**
   * Gets or creates key state.
   */
  private getOrCreateKeyState(code: string): InputState {
    if (!this.keys.has(code)) {
      this.keys.set(code, { down: false, pressed: false, released: false });
    }
    return this.keys.get(code)!;
  }

  /**
   * Gets or creates mouse button state.
   */
  private getOrCreateMouseButtonState(button: number): InputState {
    if (!this.mouseButtons.has(button)) {
      this.mouseButtons.set(button, { down: false, pressed: false, released: false });
    }
    return this.mouseButtons.get(button)!;
  }

  // === Public Query Methods ===

  /**
   * Checks if a key is currently held down.
   * @param code - Key code (e.g., 'KeyW', 'Space', 'ArrowUp')
   * @returns True if key is down
   */
  isKeyDown(code: string): boolean {
    return this.keys.get(code)?.down ?? false;
  }

  /**
   * Checks if a key was pressed this frame.
   * @param code - Key code
   * @returns True if key was just pressed
   */
  isKeyPressed(code: string): boolean {
    return this.keys.get(code)?.pressed ?? false;
  }

  /**
   * Checks if a key was released this frame.
   * @param code - Key code
   * @returns True if key was just released
   */
  isKeyReleased(code: string): boolean {
    return this.keys.get(code)?.released ?? false;
  }

  /**
   * Checks if a mouse button is currently held down.
   * @param button - Mouse button
   * @returns True if button is down
   */
  isMouseButtonDown(button: number): boolean {
    return this.mouseButtons.get(button)?.down ?? false;
  }

  /**
   * Checks if a mouse button was pressed this frame.
   * @param button - Mouse button
   * @returns True if button was just pressed
   */
  isMouseButtonPressed(button: number): boolean {
    return this.mouseButtons.get(button)?.pressed ?? false;
  }

  /**
   * Checks if a mouse button was released this frame.
   * @param button - Mouse button
   * @returns True if button was just released
   */
  isMouseButtonReleased(button: number): boolean {
    return this.mouseButtons.get(button)?.released ?? false;
  }

  /**
   * Gets the current mouse position in canvas coordinates.
   * @returns Mouse position
   */
  getMousePosition(): Vector2 {
    return this.mousePosition.clone();
  }

  /**
   * Gets the mouse movement delta.
   * @returns Mouse delta
   */
  getMouseDelta(): Vector2 {
    return this.mouseDelta.clone();
  }

  /**
   * Gets the mouse wheel delta.
   * @returns Wheel delta
   */
  getMouseWheelDelta(): number {
    return this.mouseWheelDelta;
  }

  /**
   * Gets a gamepad axis value.
   * @param gamepadIndex - Gamepad index
   * @param axisIndex - Axis index
   * @returns Axis value (-1 to 1) or 0 if not available
   */
  getGamepadAxis(gamepadIndex: number, axisIndex: number): number {
    const state = this.gamepads.get(gamepadIndex);
    return state?.axes[axisIndex] ?? 0;
  }

  /**
   * Checks if a gamepad button is down.
   * @param gamepadIndex - Gamepad index
   * @param buttonIndex - Button index
   * @returns True if button is down
   */
  isGamepadButtonDown(gamepadIndex: number, buttonIndex: number): boolean {
    const state = this.gamepads.get(gamepadIndex);
    return state?.buttons[buttonIndex] ?? false;
  }

  /**
   * Checks if a gamepad button was pressed this frame.
   * @param gamepadIndex - Gamepad index
   * @param buttonIndex - Button index
   * @returns True if button was just pressed
   */
  isGamepadButtonPressed(gamepadIndex: number, buttonIndex: number): boolean {
    const state = this.gamepads.get(gamepadIndex);
    return state?.buttonsPressed[buttonIndex] ?? false;
  }

  /**
   * Checks if a gamepad button was released this frame.
   * @param gamepadIndex - Gamepad index
   * @param buttonIndex - Button index
   * @returns True if button was just released
   */
  isGamepadButtonReleased(gamepadIndex: number, buttonIndex: number): boolean {
    const state = this.gamepads.get(gamepadIndex);
    return state?.buttonsReleased[buttonIndex] ?? false;
  }

  /**
   * Checks if a gamepad is connected.
   * @param gamepadIndex - Gamepad index
   * @returns True if gamepad is connected
   */
  isGamepadConnected(gamepadIndex: number): boolean {
    return this.gamepads.get(gamepadIndex)?.connected ?? false;
  }

  /**
   * Requests pointer lock on the canvas.
   * @returns Promise that resolves when pointer lock is acquired
   */
  async requestPointerLock(): Promise<void> {
    if (this.canvas) {
      return this.canvas.requestPointerLock();
    }
    return Promise.reject('No canvas attached');
  }

  /**
   * Exits pointer lock.
   */
  exitPointerLock(): void {
    document.exitPointerLock();
  }

  /**
   * Checks if pointer is locked.
   * @returns True if pointer is locked
   */
  isPointerLocked(): boolean {
    return this.pointerLocked;
  }

  /**
   * Clears all input states.
   */
  clear(): void {
    this.keys.clear();
    this.mouseButtons.clear();
    this.mouseDelta.set(0, 0);
    this.mouseWheelDelta = 0;
  }
}
