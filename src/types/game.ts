// Core game types and interfaces

export interface Position {
  x: number; // Percentage 0-100
  y: number; // Percentage 0-100
}

export interface Obstacle {
  id: string;
  position: Position;
  width: number;  // Percentage
  height: number; // Percentage
}

export interface Tank {
  id: string;
  position: Position;
  rotation: number; // Degrees
  health: number;
  color: string;
  name: string;
}

export type ActionType = 'move' | 'shoot';

export interface QueuedAction {
  id: string;
  type: ActionType;
  targetPosition: Position;
}

export interface GameState {
  tanks: Tank[];
  currentTankIndex: number;
  obstacles: Obstacle[];
  phase: 'planning' | 'executing' | 'game-over';
  actionQueue: QueuedAction[];
  selectedActionType: ActionType;
  actionsPerTurn: number;
  winner: string | null;
  executingActionIndex: number;
  animatingTank: {
    fromPosition: Position;
    toPosition: Position;
    progress: number;
  } | null;
  shotAnimation: {
    from: Position;
    to: Position;
    progress: number;
  } | null;
}

export type GameAction =
  | { type: 'SET_ACTION_TYPE'; actionType: ActionType }
  | { type: 'QUEUE_ACTION'; action: QueuedAction }
  | { type: 'REMOVE_QUEUED_ACTION'; actionId: string }
  | { type: 'CLEAR_QUEUE' }
  | { type: 'START_EXECUTION' }
  | { type: 'EXECUTE_NEXT_ACTION' }
  | { type: 'UPDATE_ANIMATION'; progress: number }
  | { type: 'COMPLETE_MOVE'; position: Position; rotation: number }
  | { type: 'COMPLETE_SHOT'; targetPosition: Position }
  | { type: 'END_TURN' }
  | { type: 'RESET_GAME' };
