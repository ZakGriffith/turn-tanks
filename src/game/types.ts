// Game types for PixiJS version

export interface Position {
  x: number;
  y: number;
}

export interface Tank {
  id: string;
  position: Position;
  rotation: number;
  turretRotation: number;
  health: number;
  maxHealth: number;
  accuracy: number; // 0-100, affects shot spread
  color: number;
  name: string;
  isAlive: boolean;
}

export interface Obstacle {
  id: string;
  position: Position;
  width: number;
  height: number;
  destructible: boolean;
}

export type ActionType = 'move' | 'shoot';

export interface QueuedAction {
  id: string;
  type: ActionType;
  targetPosition: Position;
  // For shots: the actual target after accuracy deviation (calculated when queued)
  // This ensures both host and guest see the same shot result
  resolvedTarget?: Position;
}

export type GamePhase = 'planning' | 'executing' | 'game-over';

export interface GameState {
  tanks: Tank[];
  obstacles: Obstacle[];
  currentPlayerIndex: number;
  actionQueue: QueuedAction[];
  selectedActionType: ActionType;
  phase: GamePhase;
  actionsPerTurn: number;
  winner: string | null;
  mapWidth: number;
  mapHeight: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: number;
  alpha: number;
}

