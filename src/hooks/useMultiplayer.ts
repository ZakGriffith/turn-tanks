import { useState, useEffect, useCallback, useRef } from 'react';
import PartySocket from 'partysocket';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'waiting' | 'connected' | 'error';

export interface MultiplayerState {
  status: ConnectionStatus;
  roomCode: string | null;
  isHost: boolean;
  error: string | null;
  playerNumber: 1 | 2 | null;
  playersInRoom: number[];
}

export interface UseMultiplayerReturn {
  state: MultiplayerState;
  createRoom: () => void;
  joinRoom: (code: string) => void;
  sendMessage: (data: unknown) => void;
  disconnect: () => void;
  onMessage: (callback: (data: unknown) => void) => void;
  startGame: () => void;
}

// PartyKit host - use localhost for dev, deployed URL for prod
const PARTYKIT_HOST = import.meta.env.DEV 
  ? '127.0.0.1:1999' 
  : 'turn-tanks.zakgriffith.partykit.dev';

// Generate a short, readable room code
function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// Message types from server
type ServerMessage =
  | { type: 'roomState'; players: number[]; hostConnected: boolean }
  | { type: 'playerJoined'; playerNumber: number }
  | { type: 'playerLeft'; playerNumber: number }
  | { type: 'gameAction'; action: unknown; from: number }
  | { type: 'stateSync'; state: unknown }
  | { type: 'gameStarted' }
  | { type: 'error'; message: string };

export function useMultiplayer(): UseMultiplayerReturn {
  const [state, setState] = useState<MultiplayerState>({
    status: 'disconnected',
    roomCode: null,
    isHost: false,
    error: null,
    playerNumber: null,
    playersInRoom: [],
  });

  const socketRef = useRef<PartySocket | null>(null);
  const messageCallbackRef = useRef<((data: unknown) => void) | null>(null);
  const gameStartCallbackRef = useRef<(() => void) | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      socketRef.current?.close();
    };
  }, []);

  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const data: ServerMessage = JSON.parse(event.data);
      console.log('[PartyKit] Received:', data.type, data);

      switch (data.type) {
        case 'roomState':
          setState(prev => ({
            ...prev,
            playersInRoom: data.players,
            status: data.players.length === 2 ? 'connected' : prev.status,
          }));
          break;

        case 'playerJoined':
          console.log(`[PartyKit] Player ${data.playerNumber} joined`);
          setState(prev => {
            const newPlayers = prev.playersInRoom.includes(data.playerNumber)
              ? prev.playersInRoom
              : [...prev.playersInRoom, data.playerNumber];
            return {
              ...prev,
              playersInRoom: newPlayers,
              status: newPlayers.length === 2 ? 'connected' : prev.status,
            };
          });
          break;

        case 'playerLeft':
          console.log(`[PartyKit] Player ${data.playerNumber} left`);
          setState(prev => ({
            ...prev,
            playersInRoom: prev.playersInRoom.filter(p => p !== data.playerNumber),
            status: prev.status === 'connected' ? 'waiting' : prev.status,
          }));
          break;

        case 'gameAction':
          if (messageCallbackRef.current) {
            messageCallbackRef.current({ type: 'action', ...data.action as object });
          }
          break;

        case 'stateSync':
          if (messageCallbackRef.current) {
            messageCallbackRef.current({ type: 'stateSync', state: data.state });
          }
          break;

        case 'gameStarted':
          // Notify via both callbacks
          if (messageCallbackRef.current) {
            messageCallbackRef.current({ type: 'gameStarted' });
          }
          if (gameStartCallbackRef.current) {
            gameStartCallbackRef.current();
          }
          break;

        case 'error':
          setState(prev => ({
            ...prev,
            status: 'error',
            error: data.message,
          }));
          break;
      }
    } catch (err) {
      console.error('[PartyKit] Error parsing message:', err);
    }
  }, []);

  const connectToRoom = useCallback((roomCode: string, isHost: boolean) => {
    const playerNumber = isHost ? 1 : 2;
    
    setState(prev => ({
      ...prev,
      status: 'connecting',
      roomCode: roomCode.toUpperCase(),
      isHost,
      playerNumber,
      error: null,
    }));

    console.log(`[PartyKit] Connecting to room ${roomCode} as ${isHost ? 'host' : 'guest'}`);

    const socket = new PartySocket({
      host: PARTYKIT_HOST,
      room: roomCode.toUpperCase(),
    });

    socketRef.current = socket;

    socket.addEventListener('open', () => {
      console.log('[PartyKit] Socket connected');
      
      // Join the room with our player number
      socket.send(JSON.stringify({
        type: 'join',
        playerNumber,
      }));

      setState(prev => ({
        ...prev,
        status: 'waiting',
      }));
    });

    socket.addEventListener('message', handleMessage);

    socket.addEventListener('close', () => {
      console.log('[PartyKit] Socket closed');
      setState(prev => ({
        ...prev,
        status: 'disconnected',
        error: 'Connection closed',
      }));
    });

    socket.addEventListener('error', (err) => {
      console.error('[PartyKit] Socket error:', err);
      setState(prev => ({
        ...prev,
        status: 'error',
        error: 'Connection error. Please try again.',
      }));
    });
  }, [handleMessage]);

  const createRoom = useCallback(() => {
    const roomCode = generateRoomCode();
    connectToRoom(roomCode, true);
  }, [connectToRoom]);

  const joinRoom = useCallback((code: string) => {
    connectToRoom(code, false);
  }, [connectToRoom]);

  const sendMessage = useCallback((data: unknown) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      // If host, send as stateSync, otherwise as gameAction
      const msgType = state.isHost ? 'stateSync' : 'gameAction';
      socketRef.current.send(JSON.stringify({
        type: msgType,
        [msgType === 'stateSync' ? 'state' : 'action']: data,
      }));
    }
  }, [state.isHost]);

  const startGame = useCallback(() => {
    if (socketRef.current?.readyState === WebSocket.OPEN && state.isHost) {
      socketRef.current.send(JSON.stringify({ type: 'startGame' }));
    }
  }, [state.isHost]);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.send(JSON.stringify({ type: 'leave' }));
      socketRef.current.close();
      socketRef.current = null;
    }
    setState({
      status: 'disconnected',
      roomCode: null,
      isHost: false,
      error: null,
      playerNumber: null,
      playersInRoom: [],
    });
  }, []);

  const onMessage = useCallback((callback: (data: unknown) => void) => {
    messageCallbackRef.current = callback;
  }, []);

  return {
    state,
    createRoom,
    joinRoom,
    sendMessage,
    disconnect,
    onMessage,
    startGame,
  };
}
