/**
 * Game Configuration
 * All game constants and tunable parameters
 */

// Tank Properties
export const TANK_SIZE = 40;
export const TANK_SPEED = 70; // Pixels per second
export const TANK_ROTATION_SPEED = 2; // Radians per second
export const TURRET_ROTATION_SPEED = 2; // Radians per second
export const BARREL_LENGTH = 20; // How far the barrel extends from tank center

// Game Rules
export const ACTIONS_PER_TURN = 2;
export const MAX_MOVE_DISTANCE = 150; // Maximum pixels a tank can move per action
export const MIN_FIRE_DISTANCE = 50; // Minimum pixels from tank to fire target

// Projectile Properties
export const SHELL_SPEED = 1000; // Pixels per second

// Visual Effects
export const GAME_OVER_DELAY = 3000; // Milliseconds to wait before showing game over screen

