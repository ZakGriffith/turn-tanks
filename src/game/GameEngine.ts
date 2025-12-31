import * as PIXI from 'pixi.js';
import gsap from 'gsap';
import { Tank, Obstacle, Position, GameState, Particle } from './types';
import {
  TANK_SIZE,
  ACTIONS_PER_TURN,
  TANK_SPEED,
  TANK_ROTATION_SPEED,
  TURRET_ROTATION_SPEED,
  SHELL_SPEED,
  MAX_MOVE_DISTANCE,
  BARREL_LENGTH,
  MIN_FIRE_DISTANCE,
  GAME_OVER_DELAY,
} from './config';

export class GameEngine {
  private app!: PIXI.Application;
  private gameContainer!: PIXI.Container;
  private terrainLayer!: PIXI.Container;
  private obstacleLayer!: PIXI.Container;
  private waypointLayer!: PIXI.Container;
  private tankLayer!: PIXI.Container;
  private effectsLayer!: PIXI.Container;
  private uiLayer!: PIXI.Container;
  
  private tankSprites: Map<string, PIXI.Container> = new Map();
  private particles: Particle[] = [];
  private particleGraphics!: PIXI.Graphics;
  private damageSmokeIntervals: Map<string, ReturnType<typeof setInterval>> = new Map();
  
  private state: GameState;
  private onStateChange: (state: GameState) => void;
  private isExecuting = false;
  private isDestroyed = false;
  private isInitialized = false;
  private width: number;
  private height: number;
  private parentElement: HTMLElement;

  private constructor(onStateChange: (state: GameState) => void, width: number, height: number, parent: HTMLElement) {
    this.onStateChange = onStateChange;
    this.width = width;
    this.height = height;
    this.parentElement = parent;
    this.state = this.createInitialState(width, height);
  }

  static async create(
    parent: HTMLElement,
    width: number,
    height: number,
    onStateChange: (state: GameState) => void
  ): Promise<GameEngine> {
    const engine = new GameEngine(onStateChange, width, height, parent);
    await engine.init(width, height);
    return engine;
  }

  private async init(width: number, height: number) {
    if (this.isDestroyed) return;

    // Create application - let PixiJS create its own canvas
    this.app = new PIXI.Application();
    
    await this.app.init({
      width,
      height,
      backgroundColor: 0x1a2634,
      antialias: true,
      resolution: 1,
    });

    if (this.isDestroyed) {
      this.app.destroy(true);
      return;
    }

    // Add canvas to parent
    this.app.canvas.style.display = 'block';
    this.app.canvas.style.borderRadius = '8px';
    this.parentElement.insertBefore(this.app.canvas, this.parentElement.firstChild);

    // Create containers
    this.gameContainer = new PIXI.Container();
    this.terrainLayer = new PIXI.Container();
    this.obstacleLayer = new PIXI.Container();
    this.waypointLayer = new PIXI.Container();
    this.tankLayer = new PIXI.Container();
    this.effectsLayer = new PIXI.Container();
    this.uiLayer = new PIXI.Container();
    this.particleGraphics = new PIXI.Graphics();

    // Layer hierarchy (bottom to top)
    this.gameContainer.addChild(this.terrainLayer);
    this.gameContainer.addChild(this.obstacleLayer);
    this.gameContainer.addChild(this.waypointLayer); // Waypoints below tanks
    this.gameContainer.addChild(this.tankLayer);
    this.gameContainer.addChild(this.effectsLayer);
    this.gameContainer.addChild(this.uiLayer);
    this.app.stage.addChild(this.gameContainer);
    
    this.effectsLayer.addChild(this.particleGraphics);

    // Setup game elements
    this.createTerrain(width, height);
    this.createObstacles();
    this.createTanks();
    this.highlightCurrentTank();
    
    // Make stage interactive
    this.app.stage.eventMode = 'static';
    this.app.stage.hitArea = new PIXI.Rectangle(0, 0, width, height);
    this.app.stage.on('pointerdown', this.handleClick.bind(this));

    // Animation loop
    this.app.ticker.add(this.update.bind(this));

    this.isInitialized = true;
    this.drawActionMarkers(); // Show initial range ring
    this.emitState();
  }

  private createInitialState(width: number, height: number): GameState {
    const tanks: Tank[] = [
      {
        id: 'blue',
        position: { x: 80, y: height / 2 },
        rotation: Math.PI / 2,
        turretRotation: 0,
        health: 3,
        maxHealth: 3,
        color: 0x3b82f6,
        name: 'Blue Tank',
        isAlive: true,
      },
      {
        id: 'red',
        position: { x: width - 80, y: height / 2 },
        rotation: -Math.PI / 2,
        turretRotation: 0,
        health: 3,
        maxHealth: 3,
        color: 0xef4444,
        name: 'Red Tank',
        isAlive: true,
      },
    ];

    // Leave enough room above/below horizontal obstacles for tanks (TANK_SIZE + padding)
    const edgeGap = TANK_SIZE * 2; // Space from edge for tank movement
    const obstacles: Obstacle[] = [
      { id: 'obs1', position: { x: width * 0.3, y: height * 0.25 }, width: 50, height: 100, destructible: false },
      { id: 'obs2', position: { x: width * 0.7, y: height * 0.55 }, width: 50, height: 120, destructible: false },
      { id: 'obs3', position: { x: width * 0.5, y: edgeGap + 35 }, width: 80, height: 35, destructible: false },
      { id: 'obs4', position: { x: width * 0.5, y: height - edgeGap - 35 }, width: 80, height: 35, destructible: false },
    ];

    return {
      tanks,
      obstacles,
      currentPlayerIndex: 0,
      actionQueue: [],
      selectedActionType: 'move',
      phase: 'planning',
      actionsPerTurn: ACTIONS_PER_TURN,
      winner: null,
      mapWidth: width,
      mapHeight: height,
    };
  }

  private createTerrain(width: number, height: number) {
    const ground = new PIXI.Graphics();
    ground.rect(0, 0, width, height);
    ground.fill(0x1e3a2f);
    this.terrainLayer.addChild(ground);

    // Simple dots for texture
    const dots = new PIXI.Graphics();
    for (let i = 0; i < 80; i++) {
      dots.circle(Math.random() * width, Math.random() * height, 1 + Math.random() * 2);
      dots.fill({ color: 0x2a4a3a, alpha: 0.4 });
    }
    this.terrainLayer.addChild(dots);
  }

  private createObstacles() {
    this.state.obstacles.forEach((obs) => {
      const g = new PIXI.Graphics();
      
      // Shadow
      g.roundRect(3, 3, obs.width, obs.height, 4);
      g.fill({ color: 0x000000, alpha: 0.4 });
      
      // Main body
      g.roundRect(0, 0, obs.width, obs.height, 4);
      g.fill(0x4a3f35);
      
      // Top highlight
      g.roundRect(2, 2, obs.width - 4, 6, 2);
      g.fill({ color: 0x6a5f55, alpha: 0.5 });

      g.position.set(obs.position.x - obs.width / 2, obs.position.y - obs.height / 2);
      this.obstacleLayer.addChild(g);
    });
  }

  private createTanks() {
    this.state.tanks.forEach((tank) => {
      const container = this.createTankSprite(tank);
      container.position.set(tank.position.x, tank.position.y);
      container.rotation = tank.rotation;
      this.tankLayer.addChild(container);
      this.tankSprites.set(tank.id, container);
    });
  }

  private createTankSprite(tank: Tank): PIXI.Container {
    const container = new PIXI.Container();
    const body = new PIXI.Graphics();
    
    // Tracks
    body.roundRect(-TANK_SIZE / 2, -TANK_SIZE / 2.5, TANK_SIZE / 5, TANK_SIZE / 1.2, 3);
    body.fill(0x2d2d2d);
    body.roundRect(TANK_SIZE / 2 - TANK_SIZE / 5, -TANK_SIZE / 2.5, TANK_SIZE / 5, TANK_SIZE / 1.2, 3);
    body.fill(0x2d2d2d);
    
    // Hull shadow
    body.roundRect(-TANK_SIZE / 3 + 2, -TANK_SIZE / 3 + 2, TANK_SIZE / 1.5, TANK_SIZE / 1.8, 4);
    body.fill({ color: 0x000000, alpha: 0.3 });
    
    // Hull
    body.roundRect(-TANK_SIZE / 3, -TANK_SIZE / 3, TANK_SIZE / 1.5, TANK_SIZE / 1.8, 4);
    body.fill(tank.color);
    
    // Hull highlight
    body.roundRect(-TANK_SIZE / 3 + 3, -TANK_SIZE / 3 + 3, TANK_SIZE / 1.5 - 6, 5, 2);
    body.fill({ color: 0xffffff, alpha: 0.25 });
    
    container.addChild(body);
    
    // Turret
    const turret = new PIXI.Container();
    turret.label = 'turret';
    const turretG = new PIXI.Graphics();
    
    // Turret shadow
    turretG.circle(2, 2, TANK_SIZE / 4);
    turretG.fill({ color: 0x000000, alpha: 0.3 });
    
    // Turret base
    turretG.circle(0, 0, TANK_SIZE / 4);
    turretG.fill(tank.color);
    
    // Barrel
    const darkerColor = this.darkenColor(tank.color, 0.7);
    turretG.roundRect(-4, -TANK_SIZE / 2, 8, TANK_SIZE / 2.5, 2);
    turretG.fill(darkerColor);
    
    turret.addChild(turretG);
    container.addChild(turret);
    
    // Health bar bg
    const healthBg = new PIXI.Graphics();
    healthBg.label = 'healthBg';
    healthBg.roundRect(-18, TANK_SIZE / 2 + 6, 36, 5, 2);
    healthBg.fill(0x333333);
    container.addChild(healthBg);
    
    // Health bar
    const healthBar = new PIXI.Graphics();
    healthBar.label = 'healthBar';
    this.updateHealthBar(healthBar, tank);
    container.addChild(healthBar);
    
    return container;
  }

  private updateHealthBar(g: PIXI.Graphics, tank: Tank) {
    g.clear();
    const w = (tank.health / tank.maxHealth) * 32;
    const color = tank.health > 1 ? 0x22c55e : 0xef4444;
    g.roundRect(-16, TANK_SIZE / 2 + 8, w, 2, 1);
    g.fill(color);
  }

  private darkenColor(color: number, factor: number): number {
    const r = Math.floor(((color >> 16) & 0xff) * factor);
    const g = Math.floor(((color >> 8) & 0xff) * factor);
    const b = Math.floor((color & 0xff) * factor);
    return (r << 16) | (g << 8) | b;
  }

  private handleClick(event: PIXI.FederatedPointerEvent) {
    if (this.isDestroyed || this.state.phase !== 'planning' || this.isExecuting) return;
    if (this.state.actionQueue.length >= this.state.actionsPerTurn) return;

    const pos = event.global;
    const target = { x: pos.x, y: pos.y };

    const effectivePos = this.getEffectivePosition();
    const distance = Math.hypot(target.x - effectivePos.x, target.y - effectivePos.y);

    // For move actions, check bounds (tank-sized padding), distance limit, position blocked, and path clearance
    if (this.state.selectedActionType === 'move') {
      const currentTank = this.state.tanks[this.state.currentPlayerIndex];
      if (!this.isWithinBounds(target, TANK_SIZE)) return; // Stay away from edges
      if (distance > MAX_MOVE_DISTANCE) return; // Out of range
      if (this.isPositionBlocked(target)) return; // Can't end on obstacle
      if (this.isPositionBlockedByTank(target, currentTank.id)) return; // Can't end on another tank
      if (!this.isPathClear(effectivePos, target, currentTank.id)) return; // Path blocked by obstacle or tank
    }

    // For shoot actions, only check basic bounds (small padding) and minimum distance
    // Fire targets can be placed anywhere - the shot will hit obstacles if in the way
    if (this.state.selectedActionType === 'shoot') {
      if (!this.isWithinBounds(target, 5)) return; // Just need to be on the map
      if (distance < MIN_FIRE_DISTANCE) return; // Too close to self
    }

    this.state.actionQueue.push({
      id: Math.random().toString(36).substring(7),
      type: this.state.selectedActionType,
      targetPosition: target,
    });
    
    this.drawActionMarkers();
    this.emitState();
  }

  // Get the tank's effective position after all queued moves
  private getEffectivePosition(): Position {
    const tank = this.state.tanks[this.state.currentPlayerIndex];
    let pos = { ...tank.position };
    for (const action of this.state.actionQueue) {
      if (action.type === 'move') {
        pos = action.targetPosition;
      }
    }
    return pos;
  }

  private isPositionBlocked(pos: Position): boolean {
    const pad = TANK_SIZE / 2;
    return this.state.obstacles.some((obs) =>
      pos.x > obs.position.x - obs.width / 2 - pad &&
      pos.x < obs.position.x + obs.width / 2 + pad &&
      pos.y > obs.position.y - obs.height / 2 - pad &&
      pos.y < obs.position.y + obs.height / 2 + pad
    );
  }

  private isPositionBlockedByTank(pos: Position, excludeTankId: string): boolean {
    return this.state.tanks.some((tank) =>
      tank.id !== excludeTankId &&
      tank.health > 0 &&
      Math.abs(pos.x - tank.position.x) < TANK_SIZE &&
      Math.abs(pos.y - tank.position.y) < TANK_SIZE
    );
  }

  private isWithinBounds(pos: Position, pad: number = TANK_SIZE): boolean {
    return pos.x > pad && pos.x < this.width - pad && pos.y > pad && pos.y < this.height - pad;
  }

  // Check if a tank can move from 'from' to 'to' without passing through obstacles or other tanks
  // Samples the path and checks the tank's bounding box at each sample point
  private isPathClear(from: Position, to: Position, excludeTankId?: string): boolean {
    const distance = Math.hypot(to.x - from.x, to.y - from.y);
    // Sample every 10 pixels along the path
    const samples = Math.max(Math.ceil(distance / 10), 1);
    
    for (let i = 0; i <= samples; i++) {
      const t = i / samples;
      const samplePos = {
        x: from.x + (to.x - from.x) * t,
        y: from.y + (to.y - from.y) * t,
      };
      
      // Check if tank bounding box at this position overlaps any obstacle
      if (this.isPositionBlocked(samplePos)) {
        return false;
      }
      
      // Check if tank bounding box at this position overlaps any other tank
      if (excludeTankId && this.isPositionBlockedByTank(samplePos, excludeTankId)) {
        return false;
      }
    }
    
    return true;
  }

  // Raycast from 'from' to 'to' and return the first intersection point with an obstacle
  // Returns null if no obstacle is hit, otherwise returns the impact point
  private raycastToObstacle(from: Position, to: Position): Position | null {
    let closestHit: Position | null = null;
    let closestDist = Infinity;

    for (const obs of this.state.obstacles) {
      // Get obstacle bounds
      const left = obs.position.x - obs.width / 2;
      const right = obs.position.x + obs.width / 2;
      const top = obs.position.y - obs.height / 2;
      const bottom = obs.position.y + obs.height / 2;

      // Check intersection with each edge of the rectangle
      const edges: [Position, Position][] = [
        [{ x: left, y: top }, { x: right, y: top }],     // Top edge
        [{ x: right, y: top }, { x: right, y: bottom }], // Right edge
        [{ x: right, y: bottom }, { x: left, y: bottom }], // Bottom edge
        [{ x: left, y: bottom }, { x: left, y: top }],   // Left edge
      ];

      for (const [p1, p2] of edges) {
        const hit = this.lineIntersection(from, to, p1, p2);
        if (hit) {
          const dist = Math.hypot(hit.x - from.x, hit.y - from.y);
          if (dist < closestDist) {
            closestDist = dist;
            closestHit = hit;
          }
        }
      }
    }

    return closestHit;
  }

  // Calculate intersection point of two line segments
  // Returns null if they don't intersect
  private lineIntersection(p1: Position, p2: Position, p3: Position, p4: Position): Position | null {
    const x1 = p1.x, y1 = p1.y, x2 = p2.x, y2 = p2.y;
    const x3 = p3.x, y3 = p3.y, x4 = p4.x, y4 = p4.y;

    const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
    if (Math.abs(denom) < 0.0001) return null; // Lines are parallel

    const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
    const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;

    // Check if intersection is within both line segments
    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
      return {
        x: x1 + t * (x2 - x1),
        y: y1 + t * (y2 - y1),
      };
    }

    return null;
  }

  private drawActionMarkers() {
    this.uiLayer.removeChildren();
    this.waypointLayer.removeChildren(); // Clear waypoint layer
    const tank = this.state.tanks[this.state.currentPlayerIndex];
    let lastPos = tank.position;

    // Draw range ring if move is selected and we can still queue actions
    if (this.state.selectedActionType === 'move' && this.state.actionQueue.length < this.state.actionsPerTurn) {
      const effectivePos = this.getEffectivePosition();
      const rangeRing = new PIXI.Graphics();
      
      // Outer glow ring
      rangeRing.circle(effectivePos.x, effectivePos.y, MAX_MOVE_DISTANCE + 4);
      rangeRing.stroke({ color: 0x22c55e, width: 2, alpha: 0.1 });
      
      // Main ring
      rangeRing.circle(effectivePos.x, effectivePos.y, MAX_MOVE_DISTANCE);
      rangeRing.stroke({ color: 0x22c55e, width: 2, alpha: 0.4 });
      
      // Inner fill
      rangeRing.circle(effectivePos.x, effectivePos.y, MAX_MOVE_DISTANCE);
      rangeRing.fill({ color: 0x22c55e, alpha: 0.05 });
      
      // Dashed inner ring for style
      const dashCount = 32;
      const innerRadius = MAX_MOVE_DISTANCE - 8;
      for (let i = 0; i < dashCount; i += 2) {
        const startAngle = (i / dashCount) * Math.PI * 2;
        const endAngle = ((i + 1) / dashCount) * Math.PI * 2;
        // Move to start of arc segment to avoid line from origin
        const startX = effectivePos.x + Math.cos(startAngle) * innerRadius;
        const startY = effectivePos.y + Math.sin(startAngle) * innerRadius;
        rangeRing.moveTo(startX, startY);
        rangeRing.arc(effectivePos.x, effectivePos.y, innerRadius, startAngle, endAngle);
        rangeRing.stroke({ color: 0x22c55e, width: 1, alpha: 0.3 });
      }
      
      this.uiLayer.addChild(rangeRing);
      
      // Draw blocked zones (obstacles with tank padding) as orange
      this.drawBlockedZones(effectivePos);
    }

    this.state.actionQueue.forEach((action, i) => {
      if (action.type === 'move') {
        const line = new PIXI.Graphics();
        line.moveTo(lastPos.x, lastPos.y);
        line.lineTo(action.targetPosition.x, action.targetPosition.y);
        line.stroke({ color: 0xfbbf24, width: 2, alpha: 0.6 });
        this.waypointLayer.addChild(line); // Draw lines below tanks
        lastPos = action.targetPosition;
      }

      const marker = new PIXI.Graphics();
      const color = action.type === 'move' ? 0x22c55e : 0xef4444;
      
      if (action.type === 'move') {
        // Move marker: larger with fill - drawn on waypoint layer (below tanks)
        marker.circle(0, 0, 14);
        marker.stroke({ color, width: 3 });
        marker.circle(0, 0, 10);
        marker.fill({ color, alpha: 0.3 });
        
        const text = new PIXI.Text({ text: String(i + 1), style: { fontSize: 12, fontWeight: 'bold', fill: 0xffffff } });
        text.anchor.set(0.5);
        marker.addChild(text);
        marker.position.set(action.targetPosition.x, action.targetPosition.y);
        this.waypointLayer.addChild(marker); // Draw move markers below tanks
      } else {
        // Fire marker: smaller ring, no fill - drawn on UI layer (above tanks)
        marker.circle(0, 0, 10);
        marker.stroke({ color, width: 2, alpha: 0.5 });
        
        const text = new PIXI.Text({ text: String(i + 1), style: { fontSize: 12, fontWeight: 'bold', fill: 0xffffff } });
        text.anchor.set(0.5);
        marker.addChild(text);
        marker.position.set(action.targetPosition.x, action.targetPosition.y);
        this.uiLayer.addChild(marker); // Draw fire markers above tanks
      }
    });
  }

  private drawBlockedZones(effectivePos: Position) {
    const blockedGraphics = new PIXI.Graphics();
    const currentTank = this.state.tanks[this.state.currentPlayerIndex];
    
    // Sample points around the range ring to find where movement becomes blocked
    const angleCount = 72; // Check every 5 degrees
    const distanceSteps = 15; // Check at multiple distances along each angle
    const minDist = 20; // Start checking from this distance (not from center)
    
    // For each angle, find the max distance you can move and draw blocked area beyond
    const blockedRays: { angle: number; maxDist: number }[] = [];
    
    for (let i = 0; i < angleCount; i++) {
      const angle = (i / angleCount) * Math.PI * 2;
      let maxValidDist = 0;
      
      // Find the maximum distance we can move in this direction
      for (let d = 1; d <= distanceSteps; d++) {
        const dist = minDist + ((d / distanceSteps) * (MAX_MOVE_DISTANCE - minDist));
        const targetX = effectivePos.x + Math.cos(angle) * dist;
        const targetY = effectivePos.y + Math.sin(angle) * dist;
        const target = { x: targetX, y: targetY };
        
        const canMove = this.isWithinBounds(target, TANK_SIZE) && 
                        !this.isPositionBlocked(target) && 
                        !this.isPositionBlockedByTank(target, currentTank.id) &&
                        this.isPathClear(effectivePos, target, currentTank.id);
        
        if (canMove) {
          maxValidDist = dist;
        } else {
          break; // Hit a blocked zone, stop checking further
        }
      }
      
      blockedRays.push({ angle, maxDist: maxValidDist });
    }
    
    // Draw blocked zones as the area between maxDist and MAX_MOVE_DISTANCE for each angle
    // Group consecutive angles with similar blocked distances into segments
    const angleStep = (Math.PI * 2) / angleCount;
    
    for (let i = 0; i < blockedRays.length; i++) {
      const ray = blockedRays[i];
      const nextRay = blockedRays[(i + 1) % blockedRays.length];
      
      // Only draw if there's a blocked area (maxDist < MAX_MOVE_DISTANCE)
      if (ray.maxDist < MAX_MOVE_DISTANCE - 5 || nextRay.maxDist < MAX_MOVE_DISTANCE - 5) {
        const startAngle = ray.angle;
        const endAngle = ray.angle + angleStep;
        
        // Draw a trapezoid-like shape from the blocked start to the ring edge
        const innerDist1 = Math.max(ray.maxDist, minDist);
        const innerDist2 = Math.max(nextRay.maxDist, minDist);
        
        // Only draw if there's actually a blocked region
        if (innerDist1 < MAX_MOVE_DISTANCE - 5 || innerDist2 < MAX_MOVE_DISTANCE - 5) {
          blockedGraphics.moveTo(
            effectivePos.x + Math.cos(startAngle) * innerDist1,
            effectivePos.y + Math.sin(startAngle) * innerDist1
          );
          blockedGraphics.lineTo(
            effectivePos.x + Math.cos(startAngle) * MAX_MOVE_DISTANCE,
            effectivePos.y + Math.sin(startAngle) * MAX_MOVE_DISTANCE
          );
          blockedGraphics.arc(effectivePos.x, effectivePos.y, MAX_MOVE_DISTANCE, startAngle, endAngle);
          blockedGraphics.lineTo(
            effectivePos.x + Math.cos(endAngle) * innerDist2,
            effectivePos.y + Math.sin(endAngle) * innerDist2
          );
          blockedGraphics.lineTo(
            effectivePos.x + Math.cos(startAngle) * innerDist1,
            effectivePos.y + Math.sin(startAngle) * innerDist1
          );
          blockedGraphics.fill({ color: 0xff6600, alpha: 0.25 });
        }
      }
    }
    
    this.uiLayer.addChild(blockedGraphics);
  }

  public setActionType(type: 'move' | 'shoot') {
    if (this.isDestroyed) return;
    this.state.selectedActionType = type;
    this.drawActionMarkers(); // Redraw to show/hide range ring
    this.emitState();
  }

  public clearQueue() {
    if (this.isDestroyed) return;
    this.state.actionQueue = [];
    this.drawActionMarkers(); // Redraw to update range ring position
    this.emitState();
  }

  public async executeActions() {
    if (this.isDestroyed || this.state.actionQueue.length === 0 || this.isExecuting) return;
    
    this.isExecuting = true;
    this.state.phase = 'executing';
    this.emitState();

    const tank = this.state.tanks[this.state.currentPlayerIndex];
    const sprite = this.tankSprites.get(tank.id);
    if (!sprite) return;

    for (const action of this.state.actionQueue) {
      if (this.isDestroyed) return;
      
      if (action.type === 'move') {
        await this.executeMove(tank, sprite, action.targetPosition);
      } else {
        await this.executeShot(tank, sprite, action.targetPosition);
      }

      if (await this.checkGameOver()) {
        this.isExecuting = false;
        return;
      }
    }

    if (this.isDestroyed) return;

    this.uiLayer.removeChildren();
    this.waypointLayer.removeChildren(); // Clear waypoints after execution
    this.state.actionQueue = [];
    this.nextPlayer();
    
    this.isExecuting = false;
    this.state.phase = 'planning';
    this.emitState();
  }

  private executeMove(tank: Tank, sprite: PIXI.Container, target: Position): Promise<void> {
    return new Promise((resolve) => {
      if (this.isDestroyed) { resolve(); return; }

      const turret = sprite.children.find(c => c.label === 'turret');
      if (!turret) { resolve(); return; }

      const targetAngle = Math.atan2(target.y - tank.position.y, target.x - tank.position.x) + Math.PI / 2;
      
      // Calculate the shortest rotation direction
      const currentAngle = sprite.rotation;
      let angleDiff = targetAngle - currentAngle;
      
      // Normalize to -PI to PI
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
      
      const finalAngle = currentAngle + angleDiff;
      const rotationDuration = Math.abs(angleDiff) / TANK_ROTATION_SPEED;
      
      // Calculate move duration based on distance and speed
      const distance = Math.hypot(target.x - tank.position.x, target.y - tank.position.y);
      const moveDuration = distance / TANK_SPEED;
      
      let lastDustTime = 0;

      // Calculate turret rotation to forward position
      const currentTurretRotation = turret.rotation;
      let turretAngleDiff = 0 - currentTurretRotation;
      
      // Normalize turret rotation to shortest path
      while (turretAngleDiff > Math.PI) turretAngleDiff -= Math.PI * 2;
      while (turretAngleDiff < -Math.PI) turretAngleDiff += Math.PI * 2;
      
      const turretRotationDuration = Math.abs(turretAngleDiff) / TURRET_ROTATION_SPEED;
      
      // Track which animation finishes last
      let turretComplete = false;
      let tankRotationComplete = false;
      
      const checkBothComplete = () => {
        if (turretComplete && tankRotationComplete) {
          if (this.isDestroyed) { resolve(); return; }
          
          tank.rotation = finalAngle;
          this.createDustCloud(tank.position.x, tank.position.y);
          
          // Step 2: Move forward to target
          gsap.to(sprite, {
            x: target.x,
            y: target.y,
            duration: moveDuration,
            ease: 'power2.inOut',
            onUpdate: () => {
              if (this.isDestroyed) return;
              
              // Create dust particles while moving (every ~50ms)
              const now = Date.now();
              if (now - lastDustTime > 50) {
                lastDustTime = now;
                this.createMovementDust(sprite.x, sprite.y, finalAngle);
              }
            },
            onComplete: () => {
              tank.position = { ...target };
              if (!this.isDestroyed) this.createDustCloud(target.x, target.y);
              resolve();
            },
          });
        }
      };

      // Step 1: Rotate turret to front AND rotate tank to face target (simultaneously)
      gsap.to(turret, {
        rotation: currentTurretRotation + turretAngleDiff,
        duration: turretRotationDuration,
        ease: 'power2.inOut',
        onComplete: () => {
          turretComplete = true;
          checkBothComplete();
        },
      });

      gsap.to(sprite, {
        rotation: finalAngle,
        duration: rotationDuration,
        ease: 'power2.inOut',
        onComplete: () => {
          tankRotationComplete = true;
          checkBothComplete();
        },
      });
    });
  }

  private createMovementDust(x: number, y: number, angle: number) {
    if (this.isDestroyed) return;
    
    // Create dust behind the tank (opposite of movement direction)
    const backX = x - Math.sin(angle) * 15;
    const backY = y + Math.cos(angle) * 15;
    
    // Left track dust
    const leftX = backX + Math.cos(angle) * 12;
    const leftY = backY + Math.sin(angle) * 12;
    
    // Right track dust
    const rightX = backX - Math.cos(angle) * 12;
    const rightY = backY - Math.sin(angle) * 12;
    
    // Add particles for both tracks
    for (let i = 0; i < 2; i++) {
      const tx = i === 0 ? leftX : rightX;
      const ty = i === 0 ? leftY : rightY;
      
      this.particles.push({
        x: tx + (Math.random() - 0.5) * 8,
        y: ty + (Math.random() - 0.5) * 8,
        vx: (Math.random() - 0.5) * 1.5 - Math.sin(angle) * 0.5,
        vy: (Math.random() - 0.5) * 1.5 + Math.cos(angle) * 0.5,
        life: 1,
        maxLife: 1,
        size: 2 + Math.random() * 2,
        color: 0x8b7355,
        alpha: 0.4 + Math.random() * 0.2,
      });
    }
  }

  private executeShot(tank: Tank, sprite: PIXI.Container, target: Position): Promise<void> {
    return new Promise((resolve) => {
      if (this.isDestroyed) { resolve(); return; }

      const turret = sprite.children.find(c => c.label === 'turret') as PIXI.Container;
      if (!turret) { resolve(); return; }
      
      // Calculate the world angle to the target
      const worldAngleToTarget = Math.atan2(target.y - tank.position.y, target.x - tank.position.x);
      
      // Calculate barrel tip position (for raycast and muzzle flash)
      const barrelTip = {
        x: tank.position.x + Math.cos(worldAngleToTarget) * BARREL_LENGTH,
        y: tank.position.y + Math.sin(worldAngleToTarget) * BARREL_LENGTH,
      };
      
      // Check if shot hits an obstacle (from barrel tip to target)
      const obstacleHit = this.raycastToObstacle(barrelTip, target);
      const actualTarget = obstacleHit || target;
      const hitObstacle = obstacleHit !== null;
      
      // Calculate turret rotation relative to tank body
      const turretAngle = worldAngleToTarget + Math.PI / 2 - sprite.rotation;
      
      // Calculate the shortest angular distance
      const currentRotation = turret.rotation;
      let angleDiff = turretAngle - currentRotation;
      // Normalize to [-PI, PI] for shortest rotation
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
      
      // Calculate duration based on rotation speed
      const rotationDuration = Math.abs(angleDiff) / TURRET_ROTATION_SPEED;

      gsap.to(turret, {
        rotation: currentRotation + angleDiff, // Use the shortest path
        duration: rotationDuration,
        ease: 'power2.out',
        onComplete: () => {
          if (this.isDestroyed) { resolve(); return; }
          
          // Calculate final barrel tip position after turret rotation
          const finalWorldAngle = sprite.rotation + turret.rotation - Math.PI / 2;
          const finalBarrelTip = {
            x: tank.position.x + Math.cos(finalWorldAngle) * BARREL_LENGTH,
            y: tank.position.y + Math.sin(finalWorldAngle) * BARREL_LENGTH,
          };
          
          this.createMuzzleFlash(finalBarrelTip);
          this.animateProjectile(finalBarrelTip, actualTarget, () => {
            if (!this.isDestroyed) {
              // Only check for tank hits if we didn't hit an obstacle
              if (!hitObstacle) {
                this.checkHit(actualTarget);
              }
              this.createExplosion(actualTarget.x, actualTarget.y, hitObstacle ? 'obstacle' : 'normal');
            }
            resolve();
          });
        },
      });
    });
  }

  private animateProjectile(from: Position, to: Position, onComplete: () => void) {
    if (this.isDestroyed) { onComplete(); return; }

    // Calculate duration based on distance and constant speed
    const distance = Math.hypot(to.x - from.x, to.y - from.y);
    const duration = distance / SHELL_SPEED;

    const proj = new PIXI.Graphics();
    proj.circle(0, 0, 6);
    proj.fill({ color: 0xfbbf24, alpha: 0.7 });
    proj.circle(0, 0, 3);
    proj.fill(0xffffff);
    proj.position.set(from.x, from.y);
    this.effectsLayer.addChild(proj);

    const trail = new PIXI.Graphics();
    this.effectsLayer.addChild(trail);

    gsap.to(proj, {
      x: to.x,
      y: to.y,
      duration: duration,
      ease: 'none',
      onUpdate: () => {
        if (this.isDestroyed) return;
        trail.clear();
        trail.moveTo(from.x, from.y);
        trail.lineTo(proj.x, proj.y);
        trail.stroke({ color: 0xfbbf24, width: 2, alpha: 0.5 });
      },
      onComplete: () => {
        if (!this.isDestroyed) {
          this.effectsLayer.removeChild(proj);
          this.effectsLayer.removeChild(trail);
        }
        onComplete();
      },
    });
  }

  private checkHit(target: Position) {
    if (this.isDestroyed) return;
    
    this.state.tanks.forEach((tank, i) => {
      if (i === this.state.currentPlayerIndex || !tank.isAlive) return;

      if (Math.hypot(tank.position.x - target.x, tank.position.y - target.y) < TANK_SIZE) {
        tank.health--;
        
        const sprite = this.tankSprites.get(tank.id);
        if (sprite) {
          const hb = sprite.children.find(c => c.label === 'healthBar') as PIXI.Graphics;
          if (hb) this.updateHealthBar(hb, tank);
          gsap.to(sprite, { alpha: 0.3, duration: 0.1, repeat: 3, yoyo: true });
        }

        if (tank.health <= 0) {
          tank.isAlive = false;
          this.stopDamageSmoke(tank.id); // Stop damage smoke before destruction fire
          this.destroyTank(tank);
        } else {
          // Update damage smoke based on health percentage
          this.updateDamageSmoke(tank);
        }
      }
    });
  }

  private destroyTank(tank: Tank) {
    if (this.isDestroyed) return;
    const sprite = this.tankSprites.get(tank.id);
    if (!sprite) return;

    // Big initial explosion
    this.createExplosion(tank.position.x, tank.position.y, 'big');
    
    // Find and detach the turret
    const turret = sprite.children.find(c => c.label === 'turret') as PIXI.Container;
    if (turret) {
      // Move turret to effects layer so it can fly independently
      const globalPos = sprite.toGlobal(turret.position);
      sprite.removeChild(turret);
      turret.position.set(globalPos.x, globalPos.y);
      turret.rotation = sprite.rotation + turret.rotation;
      this.effectsLayer.addChild(turret);
      
      // Random direction for turret to fly
      const flyAngle = Math.random() * Math.PI * 2;
      const flyDistance = 80 + Math.random() * 60;
      const targetX = globalPos.x + Math.cos(flyAngle) * flyDistance;
      const targetY = globalPos.y + Math.sin(flyAngle) * flyDistance;
      
      // Animate turret flying off and spinning
      gsap.to(turret, {
        x: targetX,
        y: targetY,
        rotation: turret.rotation + (Math.random() > 0.5 ? 1 : -1) * Math.PI * 4,
        alpha: 0,
        duration: 1.5,
        ease: 'power2.out',
        onComplete: () => {
          if (!this.isDestroyed) this.effectsLayer.removeChild(turret);
        },
      });
    }

    // Hide health bars
    const healthBg = sprite.children.find(c => c.label === 'healthBg');
    const healthBar = sprite.children.find(c => c.label === 'healthBar');
    if (healthBg) healthBg.visible = false;
    if (healthBar) healthBar.visible = false;

    // Darken the tank body (make it look burnt)
    gsap.to(sprite, {
      alpha: 0.6,
      duration: 0.3,
    });

    // Start the fire effect (continuous burning)
    this.startTankFire(tank.position.x, tank.position.y);
  }

  private startTankFire(x: number, y: number) {
    if (this.isDestroyed) return;
    
    let fireTime = 0;
    const fireDuration = 4000; // 4 seconds of intense fire
    const fireInterval = 30; // Add particles more frequently
    
    const fireLoop = () => {
      if (this.isDestroyed || fireTime >= fireDuration) return;
      
      fireTime += fireInterval;
      const intensity = 1 - (fireTime / fireDuration) * 0.7; // Don't fade as much
      
      // LOTS of fire particles (orange/yellow/red, going up)
      for (let i = 0; i < 5; i++) {
        const fireColors = [0xff2200, 0xff4400, 0xff6600, 0xff8800, 0xffaa00, 0xffcc00];
        this.particles.push({
          x: x + (Math.random() - 0.5) * 35,
          y: y + (Math.random() - 0.5) * 25,
          vx: (Math.random() - 0.5) * 2,
          vy: -2 - Math.random() * 4, // Go upward faster
          life: 0.8 + Math.random() * 0.5,
          maxLife: 1.3,
          size: 4 + Math.random() * 6 * intensity,
          color: fireColors[Math.floor(Math.random() * fireColors.length)],
          alpha: 0.85 * intensity,
        });
      }
      
      // LOTS of smoke particles (dark gray/black, billowing up)
      for (let i = 0; i < 3; i++) {
        this.particles.push({
          x: x + (Math.random() - 0.5) * 40,
          y: y + (Math.random() - 0.5) * 20,
          vx: (Math.random() - 0.5) * 1.5,
          vy: -1 - Math.random() * 2,
          life: 1.5,
          maxLife: 1.5,
          size: 6 + Math.random() * 8,
          color: Math.random() > 0.5 ? 0x222222 : 0x444444,
          alpha: 0.6 * intensity,
        });
      }
      
      // Occasional ember sparks
      if (Math.random() > 0.7) {
        this.particles.push({
          x: x + (Math.random() - 0.5) * 20,
          y: y,
          vx: (Math.random() - 0.5) * 4,
          vy: -4 - Math.random() * 3,
          life: 0.6,
          maxLife: 0.6,
          size: 2 + Math.random() * 2,
          color: 0xffff00,
          alpha: 1,
        });
      }
      
      setTimeout(fireLoop, fireInterval);
    };
    
    fireLoop();
  }

  private updateDamageSmoke(tank: Tank) {
    if (this.isDestroyed) return;
    
    const healthPercent = tank.health / tank.maxHealth;
    
    // Clear existing smoke interval for this tank
    this.stopDamageSmoke(tank.id);
    
    // No smoke if health is above 50%
    if (healthPercent > 0.5) return;
    
    // Determine smoke intensity based on health
    const isHeavyDamage = healthPercent <= 0.25;
    const smokeInterval = isHeavyDamage ? 80 : 150; // More frequent smoke when heavily damaged
    const smokeCount = isHeavyDamage ? 2 : 1;
    
    const interval = setInterval(() => {
      if (this.isDestroyed || !tank.isAlive) {
        this.stopDamageSmoke(tank.id);
        return;
      }
      
      for (let i = 0; i < smokeCount; i++) {
        // Dark smoke rising from damaged tank
        this.particles.push({
          x: tank.position.x + (Math.random() - 0.5) * 20,
          y: tank.position.y + (Math.random() - 0.5) * 15,
          vx: (Math.random() - 0.5) * 0.8,
          vy: -0.8 - Math.random() * 1.2,
          life: 1.2,
          maxLife: 1.2,
          size: 3 + Math.random() * 4,
          color: isHeavyDamage ? 0x222222 : 0x555555,
          alpha: isHeavyDamage ? 0.5 : 0.3,
        });
      }
      
      // Occasional small flame when heavily damaged
      if (isHeavyDamage && Math.random() > 0.6) {
        this.particles.push({
          x: tank.position.x + (Math.random() - 0.5) * 15,
          y: tank.position.y + (Math.random() - 0.5) * 10,
          vx: (Math.random() - 0.5) * 0.5,
          vy: -1 - Math.random() * 1.5,
          life: 0.5,
          maxLife: 0.5,
          size: 2 + Math.random() * 3,
          color: Math.random() > 0.5 ? 0xff6600 : 0xff4400,
          alpha: 0.6,
        });
      }
    }, smokeInterval);
    
    this.damageSmokeIntervals.set(tank.id, interval);
  }

  private stopDamageSmoke(tankId: string) {
    const interval = this.damageSmokeIntervals.get(tankId);
    if (interval) {
      clearInterval(interval);
      this.damageSmokeIntervals.delete(tankId);
    }
  }

  private createMuzzleFlash(barrelTip: Position) {
    if (this.isDestroyed) return;
    const flash = new PIXI.Graphics();
    flash.circle(0, 0, 12);
    flash.fill({ color: 0xffffff, alpha: 0.9 });
    flash.circle(0, 0, 8);
    flash.fill(0xfbbf24);
    // Position flash at the barrel tip
    flash.position.set(barrelTip.x, barrelTip.y);
    this.effectsLayer.addChild(flash);
    gsap.to(flash, { alpha: 0, duration: 0.12, onComplete: () => { if (!this.isDestroyed) this.effectsLayer.removeChild(flash); } });
  }

  private createExplosion(x: number, y: number, type: 'normal' | 'big' | 'obstacle' = 'normal') {
    if (this.isDestroyed) return;
    
    let count: number, speed: number, colors: number[];
    
    if (type === 'big') {
      // Big explosion for tank destruction
      count = 30;
      speed = 6;
      colors = [0xfbbf24, 0xef4444, 0xff6b00];
    } else if (type === 'obstacle') {
      // Debris/sparks for obstacle hits
      count = 12;
      speed = 2;
      colors = [0x8b7355, 0x6b5344, 0xaaa080]; // Brown/gray debris colors
    } else {
      // Normal explosion
      count = 15;
      speed = 3;
      colors = [0xfbbf24, 0xef4444, 0xff6b00];
    }
    
    const particleSize = type === 'big' ? 6 : (type === 'obstacle' ? 3 : 4);
    
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
      const vel = speed * (0.5 + Math.random());
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * vel,
        vy: Math.sin(angle) * vel,
        life: 1, maxLife: 1,
        size: particleSize,
        color: colors[Math.floor(Math.random() * colors.length)],
        alpha: 1,
      });
    }
    
    // Screen shake intensity based on explosion type
    const shakeIntensity = type === 'big' ? 8 : (type === 'obstacle' ? 2 : 3);
    this.screenShake(shakeIntensity);
  }

  private createDustCloud(x: number, y: number) {
    if (this.isDestroyed) return;
    for (let i = 0; i < 6; i++) {
      const angle = Math.random() * Math.PI * 2;
      this.particles.push({
        x: x + (Math.random() - 0.5) * 15,
        y: y + (Math.random() - 0.5) * 15,
        vx: Math.cos(angle) * (1 + Math.random()),
        vy: Math.sin(angle) * (1 + Math.random()),
        life: 1, maxLife: 1, size: 3,
        color: 0x8b7355, alpha: 0.5,
      });
    }
  }

  private screenShake(intensity: number) {
    if (this.isDestroyed) return;
    gsap.to(this.gameContainer, {
      x: intensity, duration: 0.04, repeat: 4, yoyo: true, ease: 'none',
      onComplete: () => { if (!this.isDestroyed) { this.gameContainer.x = 0; this.gameContainer.y = 0; } },
    });
  }

  private update() {
    if (this.isDestroyed || !this.particleGraphics) return;
    
    this.particleGraphics.clear();
    
    this.particles = this.particles.filter((p) => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.1;
      p.life -= 0.03;
      
      if (p.life > 0) {
        this.particleGraphics.circle(p.x, p.y, p.size * p.life);
        this.particleGraphics.fill({ color: p.color, alpha: p.life * p.alpha });
        return true;
      }
      return false;
    });
  }

  private async checkGameOver(): Promise<boolean> {
    if (this.isDestroyed) return true;
    const alive = this.state.tanks.filter((t) => t.isAlive);
    if (alive.length <= 1) {
      // Set the winner but don't show game-over screen yet
      this.state.winner = alive[0]?.name || 'Nobody';
      
      // Victory dance for the winning tank
      if (alive.length === 1) {
        this.victoryDance(alive[0]);
      }
      
      // Wait so players can see the destruction and victory dance
      await new Promise(resolve => setTimeout(resolve, GAME_OVER_DELAY));
      
      if (this.isDestroyed) return true;
      
      this.state.phase = 'game-over';
      this.emitState();
      return true;
    }
    return false;
  }

  private victoryDance(tank: Tank) {
    if (this.isDestroyed) return;
    
    const sprite = this.tankSprites.get(tank.id);
    if (!sprite) return;
    
    const turret = sprite.children.find(c => c.label === 'turret');
    if (!turret) return;
    
    // Rotate tank body clockwise continuously
    gsap.to(sprite, {
      rotation: sprite.rotation + Math.PI * 4, // 2 full rotations
      duration: GAME_OVER_DELAY / 1000,
      ease: 'none',
    });
    
    // Rotate turret counter-clockwise continuously
    gsap.to(turret, {
      rotation: turret.rotation - Math.PI * 4, // 2 full rotations in opposite direction
      duration: GAME_OVER_DELAY / 1000,
      ease: 'none',
    });
  }

  private nextPlayer() {
    if (this.isDestroyed) return;
    let next = (this.state.currentPlayerIndex + 1) % this.state.tanks.length;
    while (!this.state.tanks[next].isAlive) {
      next = (next + 1) % this.state.tanks.length;
    }
    this.state.currentPlayerIndex = next;
    this.state.selectedActionType = 'move'; // Default to move at start of turn
    this.highlightCurrentTank();
    this.drawActionMarkers(); // Show range ring for new player
  }

  private highlightCurrentTank() {
    if (this.isDestroyed) return;
    this.state.tanks.forEach((tank) => {
      const sprite = this.tankSprites.get(tank.id);
      if (sprite) sprite.alpha = 1; // Keep all tanks fully opaque
    });
  }

  public resetGame() {
    if (this.isDestroyed) return;
    
    // Clear all damage smoke intervals
    this.damageSmokeIntervals.forEach((interval) => clearInterval(interval));
    this.damageSmokeIntervals.clear();
    
    this.tankSprites.forEach((sprite) => this.tankLayer.removeChild(sprite));
    this.tankSprites.clear();
    this.uiLayer.removeChildren();
    this.waypointLayer.removeChildren(); // Clear waypoints on reset
    this.particles = [];
    
    this.state = this.createInitialState(this.width, this.height);
    this.createTanks();
    this.highlightCurrentTank();
    this.drawActionMarkers(); // Show range ring
    this.emitState();
  }

  private emitState() {
    if (this.isDestroyed) return;
    this.onStateChange({ ...this.state });
  }

  public getState(): GameState {
    return { ...this.state };
  }

  public destroy() {
    this.isDestroyed = true;
    
    // Clear all damage smoke intervals
    this.damageSmokeIntervals.forEach((interval) => clearInterval(interval));
    this.damageSmokeIntervals.clear();
    
    gsap.killTweensOf(this.gameContainer);
    this.tankSprites.forEach((sprite) => gsap.killTweensOf(sprite));
    
    if (this.isInitialized && this.app) {
      try { 
        this.app.destroy(true, { children: true }); 
      } catch { 
        /* ignore */ 
      }
    }
  }
}
