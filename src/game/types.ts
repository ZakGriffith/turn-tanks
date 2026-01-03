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
  currentPlayerIndex: number; // Used during execution to track which tank is acting
  // Separate action queues for each player (for simultaneous planning)
  playerActionQueues: QueuedAction[][]; // Index 0 = Player 1, Index 1 = Player 2
  // Track which players have submitted their turn
  playersReady: boolean[];
  // Selected action type per player
  playerSelectedActions: ActionType[];
  phase: GamePhase;
  actionsPerTurn: number;
  winner: string | null;
  mapWidth: number;
  mapHeight: number;
  // Track which players want to play again (for rematch)
  playersWantRematch: boolean[];
  
  // Legacy field for backwards compatibility (will be removed)
  actionQueue?: QueuedAction[];
  selectedActionType?: ActionType;
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

