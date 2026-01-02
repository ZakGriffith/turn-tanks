import type * as Party from "partykit/server";

// Message types
type ClientMessage = 
  | { type: 'join'; playerNumber: 1 | 2 }
  | { type: 'leave' }
  | { type: 'gameAction'; action: unknown }
  | { type: 'stateSync'; state: unknown }
  | { type: 'startGame' };

type ServerMessage =
  | { type: 'roomState'; players: number[]; hostConnected: boolean }
  | { type: 'playerJoined'; playerNumber: number }
  | { type: 'playerLeft'; playerNumber: number }
  | { type: 'gameAction'; action: unknown; from: number }
  | { type: 'stateSync'; state: unknown }
  | { type: 'gameStarted' }
  | { type: 'error'; message: string };

interface RoomState {
  players: Map<string, number>; // connectionId -> playerNumber
  hostConnectionId: string | null;
}

export default class TurnTanksParty implements Party.Server {
  constructor(readonly room: Party.Room) {}

  // In-memory state for this room
  state: RoomState = {
    players: new Map(),
    hostConnectionId: null,
  };

  onConnect(conn: Party.Connection, ctx: Party.ConnectionContext) {
    console.log(`[${this.room.id}] Client connected: ${conn.id}`);
    
    // Send current room state to the new connection
    this.sendRoomState(conn);
  }

  onClose(conn: Party.Connection) {
    console.log(`[${this.room.id}] Client disconnected: ${conn.id}`);
    
    const playerNumber = this.state.players.get(conn.id);
    if (playerNumber !== undefined) {
      this.state.players.delete(conn.id);
      
      // If host left, clear host
      if (conn.id === this.state.hostConnectionId) {
        this.state.hostConnectionId = null;
      }
      
      // Broadcast player left
      this.broadcast({
        type: 'playerLeft',
        playerNumber,
      });
      
      // Send updated room state to all
      this.broadcastRoomState();
    }
  }

  onMessage(message: string, sender: Party.Connection) {
    try {
      const data: ClientMessage = JSON.parse(message);
      console.log(`[${this.room.id}] Message from ${sender.id}:`, data.type);

      switch (data.type) {
        case 'join':
          this.handleJoin(sender, data.playerNumber);
          break;
        case 'leave':
          this.handleLeave(sender);
          break;
        case 'gameAction':
          this.handleGameAction(sender, data.action);
          break;
        case 'stateSync':
          this.handleStateSync(sender, data.state);
          break;
        case 'startGame':
          this.handleStartGame(sender);
          break;
      }
    } catch (err) {
      console.error(`[${this.room.id}] Error parsing message:`, err);
    }
  }

  handleJoin(conn: Party.Connection, requestedPlayerNumber: 1 | 2) {
    // Check if player number is already taken
    const takenNumbers = new Set(this.state.players.values());
    
    if (takenNumbers.has(requestedPlayerNumber)) {
      conn.send(JSON.stringify({
        type: 'error',
        message: `Player ${requestedPlayerNumber} slot is already taken`,
      } as ServerMessage));
      return;
    }

    // Assign player
    this.state.players.set(conn.id, requestedPlayerNumber);
    
    // Player 1 is always the host
    if (requestedPlayerNumber === 1) {
      this.state.hostConnectionId = conn.id;
    }

    console.log(`[${this.room.id}] Player ${requestedPlayerNumber} joined`);

    // Broadcast player joined
    this.broadcast({
      type: 'playerJoined',
      playerNumber: requestedPlayerNumber,
    });

    // Send updated room state to all
    this.broadcastRoomState();
  }

  handleLeave(conn: Party.Connection) {
    const playerNumber = this.state.players.get(conn.id);
    if (playerNumber !== undefined) {
      this.state.players.delete(conn.id);
      
      if (conn.id === this.state.hostConnectionId) {
        this.state.hostConnectionId = null;
      }

      this.broadcast({
        type: 'playerLeft',
        playerNumber,
      });
      
      this.broadcastRoomState();
    }
  }

  handleGameAction(sender: Party.Connection, action: unknown) {
    const playerNumber = this.state.players.get(sender.id);
    if (playerNumber === undefined) return;

    // Broadcast action to all other players
    this.broadcast({
      type: 'gameAction',
      action,
      from: playerNumber,
    }, [sender.id]); // Exclude sender
  }

  handleStateSync(sender: Party.Connection, state: unknown) {
    // Only host can sync state
    if (sender.id !== this.state.hostConnectionId) return;

    // Broadcast state to all other players
    this.broadcast({
      type: 'stateSync',
      state,
    }, [sender.id]); // Exclude sender
  }

  handleStartGame(sender: Party.Connection) {
    // Only host can start game
    if (sender.id !== this.state.hostConnectionId) return;
    
    // Check both players are present
    if (this.state.players.size < 2) return;

    this.broadcast({
      type: 'gameStarted',
    });
  }

  sendRoomState(conn: Party.Connection) {
    const msg: ServerMessage = {
      type: 'roomState',
      players: Array.from(this.state.players.values()),
      hostConnected: this.state.hostConnectionId !== null,
    };
    conn.send(JSON.stringify(msg));
  }

  broadcastRoomState() {
    const msg: ServerMessage = {
      type: 'roomState',
      players: Array.from(this.state.players.values()),
      hostConnected: this.state.hostConnectionId !== null,
    };
    this.broadcast(msg);
  }

  broadcast(msg: ServerMessage, exclude: string[] = []) {
    const msgStr = JSON.stringify(msg);
    for (const conn of this.room.getConnections()) {
      if (!exclude.includes(conn.id)) {
        conn.send(msgStr);
      }
    }
  }
}

