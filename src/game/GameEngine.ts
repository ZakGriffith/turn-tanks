import * as PIXI from 'pixi.js';
import gsap from 'gsap';
import { Tank, Obstacle, Position, GameState, Particle } from './types';

// Configuration
const TANK_SIZE = 40;
const ACTIONS_PER_TURN = 2;
const MOVE_DURATION = 0.6;
const SHOT_DURATION = 0.3;

export class GameEngine {
  private app!: PIXI.Application;
  private gameContainer!: PIXI.Container;
  private terrainLayer!: PIXI.Container;
  private obstacleLayer!: PIXI.Container;
  private tankLayer!: PIXI.Container;
  private effectsLayer!: PIXI.Container;
  private uiLayer!: PIXI.Container;
  
  private tankSprites: Map<string, PIXI.Container> = new Map();
  private particles: Particle[] = [];
  private particleGraphics!: PIXI.Graphics;
  
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
    this.tankLayer = new PIXI.Container();
    this.effectsLayer = new PIXI.Container();
    this.uiLayer = new PIXI.Container();
    this.particleGraphics = new PIXI.Graphics();

    // Layer hierarchy
    this.gameContainer.addChild(this.terrainLayer);
    this.gameContainer.addChild(this.obstacleLayer);
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

    const obstacles: Obstacle[] = [
      { id: 'obs1', position: { x: width * 0.3, y: height * 0.25 }, width: 50, height: 100, destructible: false },
      { id: 'obs2', position: { x: width * 0.7, y: height * 0.55 }, width: 50, height: 120, destructible: false },
      { id: 'obs3', position: { x: width * 0.5, y: height * 0.12 }, width: 80, height: 35, destructible: false },
      { id: 'obs4', position: { x: width * 0.5, y: height * 0.88 }, width: 80, height: 35, destructible: false },
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

    if (this.isPositionBlocked(target) || !this.isWithinBounds(target)) return;

    this.state.actionQueue.push({
      id: Math.random().toString(36).substring(7),
      type: this.state.selectedActionType,
      targetPosition: target,
    });
    
    this.drawActionMarkers();
    this.emitState();
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

  private isWithinBounds(pos: Position): boolean {
    const pad = TANK_SIZE;
    return pos.x > pad && pos.x < this.width - pad && pos.y > pad && pos.y < this.height - pad;
  }

  private drawActionMarkers() {
    this.uiLayer.removeChildren();
    const tank = this.state.tanks[this.state.currentPlayerIndex];
    let lastPos = tank.position;

    this.state.actionQueue.forEach((action, i) => {
      if (action.type === 'move') {
        const line = new PIXI.Graphics();
        line.moveTo(lastPos.x, lastPos.y);
        line.lineTo(action.targetPosition.x, action.targetPosition.y);
        line.stroke({ color: 0xfbbf24, width: 2, alpha: 0.6 });
        this.uiLayer.addChild(line);
        lastPos = action.targetPosition;
      }

      const marker = new PIXI.Graphics();
      const color = action.type === 'move' ? 0x22c55e : 0xef4444;
      marker.circle(0, 0, 14);
      marker.stroke({ color, width: 3 });
      marker.circle(0, 0, 10);
      marker.fill({ color, alpha: 0.3 });
      
      const text = new PIXI.Text({ text: String(i + 1), style: { fontSize: 12, fontWeight: 'bold', fill: 0xffffff } });
      text.anchor.set(0.5);
      marker.addChild(text);
      marker.position.set(action.targetPosition.x, action.targetPosition.y);
      this.uiLayer.addChild(marker);
    });
  }

  public setActionType(type: 'move' | 'shoot') {
    if (this.isDestroyed) return;
    this.state.selectedActionType = type;
    this.emitState();
  }

  public clearQueue() {
    if (this.isDestroyed) return;
    this.state.actionQueue = [];
    this.uiLayer.removeChildren();
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

      if (this.checkGameOver()) {
        this.isExecuting = false;
        return;
      }
    }

    if (this.isDestroyed) return;

    this.uiLayer.removeChildren();
    this.state.actionQueue = [];
    this.nextPlayer();
    
    this.isExecuting = false;
    this.state.phase = 'planning';
    this.emitState();
  }

  private executeMove(tank: Tank, sprite: PIXI.Container, target: Position): Promise<void> {
    return new Promise((resolve) => {
      if (this.isDestroyed) { resolve(); return; }

      const angle = Math.atan2(target.y - tank.position.y, target.x - tank.position.x) + Math.PI / 2;
      this.createDustCloud(tank.position.x, tank.position.y);

      gsap.to(sprite, {
        x: target.x,
        y: target.y,
        rotation: angle,
        duration: MOVE_DURATION,
        ease: 'power2.out',
        onComplete: () => {
          tank.position = { ...target };
          tank.rotation = angle;
          if (!this.isDestroyed) this.createDustCloud(target.x, target.y);
          resolve();
        },
      });
    });
  }

  private executeShot(tank: Tank, sprite: PIXI.Container, target: Position): Promise<void> {
    return new Promise((resolve) => {
      if (this.isDestroyed) { resolve(); return; }

      const turret = sprite.children.find(c => c.label === 'turret') as PIXI.Container;
      if (!turret) { resolve(); return; }
      
      const angle = Math.atan2(target.y - tank.position.y, target.x - tank.position.x) + Math.PI / 2 - sprite.rotation;

      gsap.to(turret, {
        rotation: angle,
        duration: 0.2,
        ease: 'power2.out',
        onComplete: () => {
          if (this.isDestroyed) { resolve(); return; }
          
          this.createMuzzleFlash(tank.position, sprite.rotation + angle);
          this.animateProjectile(tank.position, target, () => {
            if (!this.isDestroyed) {
              this.checkHit(target);
              this.createExplosion(target.x, target.y);
            }
            resolve();
          });
        },
      });
    });
  }

  private animateProjectile(from: Position, to: Position, onComplete: () => void) {
    if (this.isDestroyed) { onComplete(); return; }

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
      duration: SHOT_DURATION,
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
          this.destroyTank(tank);
        }
      }
    });
  }

  private destroyTank(tank: Tank) {
    if (this.isDestroyed) return;
    const sprite = this.tankSprites.get(tank.id);
    if (sprite) {
      this.createExplosion(tank.position.x, tank.position.y, true);
      gsap.to(sprite, {
        alpha: 0,
        duration: 0.5,
        onComplete: () => { if (!this.isDestroyed) this.tankLayer.removeChild(sprite); },
      });
    }
  }

  private createMuzzleFlash(pos: Position, angle: number) {
    if (this.isDestroyed) return;
    const flash = new PIXI.Graphics();
    flash.circle(0, 0, 12);
    flash.fill({ color: 0xffffff, alpha: 0.9 });
    flash.circle(0, 0, 8);
    flash.fill(0xfbbf24);
    flash.position.set(pos.x + Math.sin(angle) * 25, pos.y - Math.cos(angle) * 25);
    this.effectsLayer.addChild(flash);
    gsap.to(flash, { alpha: 0, duration: 0.12, onComplete: () => { if (!this.isDestroyed) this.effectsLayer.removeChild(flash); } });
  }

  private createExplosion(x: number, y: number, big = false) {
    if (this.isDestroyed) return;
    const count = big ? 30 : 15;
    const speed = big ? 6 : 3;
    
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
      const vel = speed * (0.5 + Math.random());
      const colors = [0xfbbf24, 0xef4444, 0xff6b00];
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * vel,
        vy: Math.sin(angle) * vel,
        life: 1, maxLife: 1,
        size: big ? 6 : 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        alpha: 1,
      });
    }
    this.screenShake(big ? 8 : 3);
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

  private checkGameOver(): boolean {
    if (this.isDestroyed) return true;
    const alive = this.state.tanks.filter((t) => t.isAlive);
    if (alive.length <= 1) {
      this.state.phase = 'game-over';
      this.state.winner = alive[0]?.name || 'Nobody';
      this.emitState();
      return true;
    }
    return false;
  }

  private nextPlayer() {
    if (this.isDestroyed) return;
    let next = (this.state.currentPlayerIndex + 1) % this.state.tanks.length;
    while (!this.state.tanks[next].isAlive) {
      next = (next + 1) % this.state.tanks.length;
    }
    this.state.currentPlayerIndex = next;
    this.highlightCurrentTank();
  }

  private highlightCurrentTank() {
    if (this.isDestroyed) return;
    this.state.tanks.forEach((tank, i) => {
      const sprite = this.tankSprites.get(tank.id);
      if (sprite) sprite.alpha = i === this.state.currentPlayerIndex ? 1 : 0.7;
    });
  }

  public resetGame() {
    if (this.isDestroyed) return;
    
    this.tankSprites.forEach((sprite) => this.tankLayer.removeChild(sprite));
    this.tankSprites.clear();
    this.uiLayer.removeChildren();
    this.particles = [];
    
    this.state = this.createInitialState(this.width, this.height);
    this.createTanks();
    this.highlightCurrentTank();
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
