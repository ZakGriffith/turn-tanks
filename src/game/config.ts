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
export const ACTIONS_PER_TURN = 5; // Both players get 5 actions, executed simultaneously
export const MAX_MOVE_DISTANCE = 150; // Maximum pixels a tank can move per action
export const MIN_FIRE_DISTANCE = 50; // Minimum pixels from tank to fire target

// Projectile Properties
export const SHELL_SPEED = 1000; // Pixels per second

// Damage
export const DIRECT_HIT_DAMAGE = 1; // Damage for a direct hit on a tank
export const SPLASH_DAMAGE = 1; // Damage for splash (can be less than direct hit)
export const SPLASH_RADIUS = 90; // Pixels - radius of splash damage area
export const DIRECT_HIT_RADIUS = 40; // Pixels - radius for direct hit (TANK_SIZE)

// Accuracy
export const DEFAULT_ACCURACY = 50; // 0-100, affects shot spread
export const MAX_SHOT_DEVIATION = 0.37; // Maximum deviation in radians at 0% accuracy (~21 degrees)

// Visual Effects
export const GAME_OVER_DELAY = 3000; // Milliseconds to wait before showing game over screen

