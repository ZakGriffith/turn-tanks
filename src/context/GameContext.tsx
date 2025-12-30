import { createContext, useContext, useReducer, ReactNode, useCallback, useRef, useEffect } from 'react';
import { GameState, GameAction, Tank, Obstacle, Position, QueuedAction } from '../types/game';

// Configuration
const ACTIONS_PER_TURN = 2;
const TANK_STARTING_HEALTH = 3;
const TANK_SIZE = 6; // Percentage of map width
const ANIMATION_DURATION = 600; // ms for movement
const SHOT_DURATION = 300; // ms for shot animation

// Helper to generate unique IDs
function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

// Helper to calculate rotation angle between two points
function calculateRotation(from: Position, to: Position): number {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  return Math.atan2(dy, dx) * (180 / Math.PI) + 90; // +90 because tank points up by default
}

// Helper to calculate distance between two points
function getDistance(a: Position, b: Position): number {
  return Math.sqrt(Math.pow(b.x - a.x, 2) + Math.pow(b.y - a.y, 2));
}

// Check if a point is inside an obstacle
function isInsideObstacle(point: Position, obstacle: Obstacle): boolean {
  return (
    point.x >= obstacle.position.x &&
    point.x <= obstacle.position.x + obstacle.width &&
    point.y >= obstacle.position.y &&
    point.y <= obstacle.position.y + obstacle.height
  );
}

// Check if position collides with any obstacle
function collidesWithObstacle(position: Position, obstacles: Obstacle[]): boolean {
  return obstacles.some((obs) => isInsideObstacle(position, obs));
}

// Check line of sight (simplified - just checks if line passes through obstacles)
function hasLineOfSight(from: Position, to: Position, obstacles: Obstacle[]): boolean {
  const steps = 20;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const point = {
      x: from.x + (to.x - from.x) * t,
      y: from.y + (to.y - from.y) * t,
    };
    if (collidesWithObstacle(point, obstacles)) {
      return false;
    }
  }
  return true;
}

// Create initial obstacles
function createObstacles(): Obstacle[] {
  return [
    { id: 'obs1', position: { x: 25, y: 20 }, width: 8, height: 25 },
    { id: 'obs2', position: { x: 67, y: 30 }, width: 8, height: 30 },
    { id: 'obs3', position: { x: 42, y: 10 }, width: 16, height: 8 },
    { id: 'obs4', position: { x: 42, y: 75 }, width: 16, height: 8 },
  ];
}

// Create initial tanks
function createInitialTanks(): Tank[] {
  return [
    {
      id: 'player1',
      position: { x: 12, y: 50 },
      rotation: 90,
      health: TANK_STARTING_HEALTH,
      color: '#3b82f6', // Blue
      name: 'Blue Tank',
    },
    {
      id: 'player2',
      position: { x: 88, y: 50 },
      rotation: 270,
      health: TANK_STARTING_HEALTH,
      color: '#ef4444', // Red
      name: 'Red Tank',
    },
  ];
}

function createInitialState(): GameState {
  return {
    tanks: createInitialTanks(),
    currentTankIndex: 0,
    obstacles: createObstacles(),
    phase: 'planning',
    actionQueue: [],
    selectedActionType: 'move',
    actionsPerTurn: ACTIONS_PER_TURN,
    winner: null,
    executingActionIndex: -1,
    animatingTank: null,
    shotAnimation: null,
  };
}

function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'SET_ACTION_TYPE': {
      return {
        ...state,
        selectedActionType: action.actionType,
      };
    }

    case 'QUEUE_ACTION': {
      if (state.actionQueue.length >= state.actionsPerTurn) {
        return state;
      }
      return {
        ...state,
        actionQueue: [...state.actionQueue, action.action],
      };
    }

    case 'REMOVE_QUEUED_ACTION': {
      return {
        ...state,
        actionQueue: state.actionQueue.filter((a) => a.id !== action.actionId),
      };
    }

    case 'CLEAR_QUEUE': {
      return {
        ...state,
        actionQueue: [],
      };
    }

    case 'START_EXECUTION': {
      if (state.actionQueue.length === 0) return state;
      return {
        ...state,
        phase: 'executing',
        executingActionIndex: 0,
      };
    }

    case 'EXECUTE_NEXT_ACTION': {
      const nextIndex = state.executingActionIndex + 1;
      if (nextIndex >= state.actionQueue.length) {
        // All actions executed, end turn
        return {
          ...state,
          phase: 'planning',
          executingActionIndex: -1,
          actionQueue: [],
          animatingTank: null,
          shotAnimation: null,
          currentTankIndex: (state.currentTankIndex + 1) % state.tanks.length,
        };
      }
      return {
        ...state,
        executingActionIndex: nextIndex,
        animatingTank: null,
        shotAnimation: null,
      };
    }

    case 'UPDATE_ANIMATION': {
      if (state.animatingTank) {
        return {
          ...state,
          animatingTank: {
            ...state.animatingTank,
            progress: action.progress,
          },
        };
      }
      if (state.shotAnimation) {
        return {
          ...state,
          shotAnimation: {
            ...state.shotAnimation,
            progress: action.progress,
          },
        };
      }
      return state;
    }

    case 'COMPLETE_MOVE': {
      const newTanks = state.tanks.map((tank, i) =>
        i === state.currentTankIndex
          ? { ...tank, position: action.position, rotation: action.rotation }
          : tank
      );
      return {
        ...state,
        tanks: newTanks,
        animatingTank: null,
      };
    }

    case 'COMPLETE_SHOT': {
      const currentTank = state.tanks[state.currentTankIndex];
      const targetPos = action.targetPosition;

      // Check if we hit an enemy tank
      let newTanks = state.tanks;
      let winner: string | null = null;

      const hitTankIndex = state.tanks.findIndex((tank, i) => {
        if (i === state.currentTankIndex) return false;
        const distance = getDistance(tank.position, targetPos);
        return distance < TANK_SIZE;
      });

      if (hitTankIndex !== -1) {
        newTanks = state.tanks.map((tank, i) =>
          i === hitTankIndex ? { ...tank, health: tank.health - 1 } : tank
        );

        const deadTank = newTanks.find((t) => t.health <= 0);
        if (deadTank) {
          winner = newTanks.find((t) => t.health > 0)?.name || null;
        }
      }

      // Update rotation to face target
      const newRotation = calculateRotation(currentTank.position, targetPos);
      newTanks = newTanks.map((tank, i) =>
        i === state.currentTankIndex ? { ...tank, rotation: newRotation } : tank
      );

      return {
        ...state,
        tanks: newTanks,
        shotAnimation: null,
        winner,
        phase: winner ? 'game-over' : state.phase,
      };
    }

    case 'END_TURN': {
      return {
        ...state,
        currentTankIndex: (state.currentTankIndex + 1) % state.tanks.length,
        actionQueue: [],
        phase: 'planning',
      };
    }

    case 'RESET_GAME': {
      return createInitialState();
    }

    default:
      return state;
  }
}

interface GameContextValue {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
  setActionType: (type: 'move' | 'shoot') => void;
  queueAction: (type: 'move' | 'shoot', targetPosition: Position) => void;
  removeQueuedAction: (actionId: string) => void;
  clearQueue: () => void;
  executeActions: () => void;
  endTurn: () => void;
  resetGame: () => void;
  canQueueMore: boolean;
  TANK_SIZE: number;
  collidesWithObstacle: (position: Position) => boolean;
}

const GameContext = createContext<GameContextValue | null>(null);

export function GameProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(gameReducer, null, createInitialState);
  const animationFrameRef = useRef<number>();
  const startTimeRef = useRef<number>();

  const setActionType = useCallback((type: 'move' | 'shoot') => {
    dispatch({ type: 'SET_ACTION_TYPE', actionType: type });
  }, []);

  const queueAction = useCallback((type: 'move' | 'shoot', targetPosition: Position) => {
    const action: QueuedAction = {
      id: generateId(),
      type,
      targetPosition,
    };
    dispatch({ type: 'QUEUE_ACTION', action });
  }, []);

  const removeQueuedAction = useCallback((actionId: string) => {
    dispatch({ type: 'REMOVE_QUEUED_ACTION', actionId });
  }, []);

  const clearQueue = useCallback(() => {
    dispatch({ type: 'CLEAR_QUEUE' });
  }, []);

  const executeActions = useCallback(() => {
    dispatch({ type: 'START_EXECUTION' });
  }, []);

  const endTurn = useCallback(() => {
    dispatch({ type: 'END_TURN' });
  }, []);

  const resetGame = useCallback(() => {
    dispatch({ type: 'RESET_GAME' });
  }, []);

  const checkCollision = useCallback((position: Position) => {
    return collidesWithObstacle(position, state.obstacles);
  }, [state.obstacles]);

  // Animation loop for executing actions
  useEffect(() => {
    if (state.phase !== 'executing' || state.executingActionIndex < 0) return;

    const currentAction = state.actionQueue[state.executingActionIndex];
    if (!currentAction) {
      dispatch({ type: 'EXECUTE_NEXT_ACTION' });
      return;
    }

    const currentTank = state.tanks[state.currentTankIndex];

    if (currentAction.type === 'move' && !state.animatingTank) {
      // Start move animation
      const animState = {
        fromPosition: currentTank.position,
        toPosition: currentAction.targetPosition,
        progress: 0,
      };
      dispatch({ type: 'UPDATE_ANIMATION', progress: 0 });
      
      // Actually set the animating state by modifying state directly through a special action
      // We need to track this differently - let's use a ref
      startTimeRef.current = performance.now();

      const animate = (time: number) => {
        const elapsed = time - (startTimeRef.current || time);
        const progress = Math.min(elapsed / ANIMATION_DURATION, 1);

        if (progress < 1) {
          dispatch({ type: 'UPDATE_ANIMATION', progress });
          animationFrameRef.current = requestAnimationFrame(animate);
        } else {
          const rotation = calculateRotation(animState.fromPosition, animState.toPosition);
          dispatch({ type: 'COMPLETE_MOVE', position: animState.toPosition, rotation });
          setTimeout(() => dispatch({ type: 'EXECUTE_NEXT_ACTION' }), 100);
        }
      };

      animationFrameRef.current = requestAnimationFrame(animate);
    }

    if (currentAction.type === 'shoot' && !state.shotAnimation) {
      startTimeRef.current = performance.now();

      const animate = (time: number) => {
        const elapsed = time - (startTimeRef.current || time);
        const progress = Math.min(elapsed / SHOT_DURATION, 1);

        if (progress < 1) {
          dispatch({ type: 'UPDATE_ANIMATION', progress });
          animationFrameRef.current = requestAnimationFrame(animate);
        } else {
          dispatch({ type: 'COMPLETE_SHOT', targetPosition: currentAction.targetPosition });
          setTimeout(() => dispatch({ type: 'EXECUTE_NEXT_ACTION' }), 100);
        }
      };

      animationFrameRef.current = requestAnimationFrame(animate);
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [state.phase, state.executingActionIndex, state.actionQueue, state.tanks, state.currentTankIndex, state.animatingTank, state.shotAnimation]);

  const canQueueMore = state.actionQueue.length < state.actionsPerTurn;

  return (
    <GameContext.Provider
      value={{
        state,
        dispatch,
        setActionType,
        queueAction,
        removeQueuedAction,
        clearQueue,
        executeActions,
        endTurn,
        resetGame,
        canQueueMore,
        TANK_SIZE,
        collidesWithObstacle: checkCollision,
      }}
    >
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
}
