import {WebSocketClient} from "../network/WebSocketClient";
import {SelectionManager} from "../managers/SelectionManager";
import {ClientInternalEvents, ServerToClientEvents} from "../types/CommunicationEvents";
import {IUnit} from "../types/IUnit";
import {IAvailablePlayer} from "../types/IAvailablePlayer";
import {IUnitPosition} from "../types/IUnitPosition";

type UnitVisual = {
  container: Phaser.GameObjects.Container;
  body: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
};

export class GameScene extends Phaser.Scene {
  private websocketClient: WebSocketClient | null = null;
  private selectionManager: SelectionManager | null = null;
  private unitSprites: Map<string, UnitVisual> = new Map();
  private knownUnits: Map<string, IUnit> = new Map();
  private playerUnitIds: Set<string> = new Set();
  private cursors: Phaser.Types.Input.Keyboard.CursorKeys | null = null;
  private ascendKey: Phaser.Input.Keyboard.Key | null = null;
  private descendKey: Phaser.Input.Keyboard.Key | null = null;
  private lastMoveRequestAt = 0;
  private availablePlayers: IAvailablePlayer[] = [];
  private selectedUnitCoordsText: Phaser.GameObjects.Text | null = null;
  private static readonly MAP_MIN_X = 0;
  private static readonly MAP_MAX_X = 200;
  private static readonly MAP_MIN_Y = 0;
  private static readonly MAP_MAX_Y = 200;
  private static readonly MAP_MIN_Z = 0;
  private static readonly MAP_MAX_Z = 10;
  private static readonly MAP_MAX_Z_BONUS_FACTOR = 1.005;
  private static readonly MAP_PADDING = 60;
  private static readonly MOVE_STEP = 5;
  private static readonly ALTITUDE_STEP = 0.5;
  private static readonly MOVE_REPEAT_MS = 120;

  constructor() {
    super('GameScene');
  }

  async create() {
    console.log("[GameScene] Creating scene...");

    this.websocketClient = new WebSocketClient();

    try {
      // Configurando listeners del websocket
      await this.websocketClient.connect();
    } catch (err) {
      console.error("[GameScene] Error connecting to server:", err);
      this.showError("Error connecting to server");
      return;
    }

    this.selectionManager = new SelectionManager();

    // Registrando jugador en el servidor y esperando confirmación
    await this.waitForAvailablePlayers();

    // Seleccionando el primer jugador disponible y registrándolo en el servidor
    const selectedPlayerId = this.selectFirstAvailablePlayer();
    if (!selectedPlayerId) {
      this.showError('No players available');
      return;
    }

    this.websocketClient.registerPlayer(selectedPlayerId);
    await this.waitForPlayerRegistration();

    this.websocketClient.requestPlayerUnits();

    this.setupEventListeners();
    this.drawUI();
    this.updateSelectedUnitCoordsText();
    this.cursors = this.input.keyboard?.createCursorKeys() ?? null;
    this.ascendKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT) ?? null;
    this.descendKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.CTRL) ?? null;
    this.input.keyboard?.addCapture([
      Phaser.Input.Keyboard.KeyCodes.UP,
      Phaser.Input.Keyboard.KeyCodes.DOWN,
      Phaser.Input.Keyboard.KeyCodes.LEFT,
      Phaser.Input.Keyboard.KeyCodes.RIGHT,
      Phaser.Input.Keyboard.KeyCodes.SHIFT,
      Phaser.Input.Keyboard.KeyCodes.CTRL
    ]);
  }

  private async waitForAvailablePlayers(): Promise<void> {
    return new Promise(resolve => {
      const timeout = setTimeout(() => {
        console.warn("[GameScene] Available players timed out");
        resolve();
      }, 3000);

      this.websocketClient?.on(ServerToClientEvents.AVAILABLE_PLAYERS, (players: IAvailablePlayer[]) => {
        clearTimeout(timeout);
        this.availablePlayers = players;

        console.log(`[GameScene] ${players.length} players available`);
        players.forEach(player => {
          console.log(`- ${player.playerName} (${player.playerId}) - ${player.available ? 'Available' : 'Taken'}`);
        });

        resolve();
      })
    })
  }

  private selectFirstAvailablePlayer(): string | null {
    const availablePlayer = this.availablePlayers.find(player => player.available);

    if (availablePlayer) {
      console.log(`[GameScene] Selecting player: ${availablePlayer.playerName}]`);
      return availablePlayer.playerId;
    }

    return null;
  }

  private async waitForPlayerRegistration(): Promise<void> {
    return new Promise(resolve => {
      const timeout = setTimeout(() => {
        console.warn("[GameScene] Player registration timed out");
        resolve();
      }, 3000);

      this.websocketClient?.on(ServerToClientEvents.PLAYER_REGISTERED, () => {
        clearTimeout(timeout);
        console.log("[GameScene] Player registered successfully");
        resolve();
      });
    });
  }

  /*
  * Configura qué hacer al recibir mensajes del servidor
  * Define los eventos del websocket
  */
  private setupEventListeners(): void {
    if (!this.websocketClient || !this.selectionManager) return;

    // El servidor devuelve la lista de unidades del jugador
    this.websocketClient.on(ServerToClientEvents.UNITS_RECEIVED, (data: any) => {
      const playerUnits: IUnit[] = data.playerUnits;
      const enemyUnits: IUnit[] = data.enemyUnits;

      console.log(`[GameScene] Received ${playerUnits.length} units for player and ${enemyUnits.length} units for enemy from server`);
      this.knownUnits.clear();
      playerUnits.forEach(unit => this.knownUnits.set(unit.unitId, unit));
      enemyUnits.forEach(unit => this.knownUnits.set(unit.unitId, unit));
      this.playerUnitIds = new Set(playerUnits.map(unit => unit.unitId));
      this.selectionManager?.setPlayerUnits(playerUnits);
      this.renderUnits(playerUnits, enemyUnits);
    });

    // El servidor confirma la selección de unidad
    this.websocketClient.on(ServerToClientEvents.UNIT_SELECTED, (unit: IUnit) => {
      console.log(`[GameScene] Selection confirmed: ${unit.unitId}`);
      this.selectionManager?.confirmSelection(unit);
      this.highlightUnit(unit.unitId);
      this.updateSelectedUnitCoordsText();
    });

    // Hubo un error en el servidor
    this.websocketClient.on(ServerToClientEvents.SERVER_ERROR, (errorMessage: string) => {
      console.error(`[GameScene] Server error: ${errorMessage}`);
      this.showError(errorMessage);
    });

    this.websocketClient.on(ServerToClientEvents.MOVE_ACCEPTED, (unitId: string) => {
      console.log(`[GameScene] Move accepted: ${unitId}`);
    });

    this.websocketClient.on(ServerToClientEvents.GAME_STATE_UPDATE, (unitPositions: IUnitPosition[]) => {
      this.syncUnitPositions(unitPositions);
    });

    this.selectionManager.on(ClientInternalEvents.SELECTION_CHANGED, (unit: IUnit) => {
      console.log(`[GameScene] Selection changed: ${unit.unitId}, sendind selection to server...`);
      this.websocketClient?.requestUnitSelection(unit.unitId);
      this.updateSelectedUnitCoordsText();
    })

    this.selectionManager.on(ClientInternalEvents.SELECTION_CONFIRMED, () => {
      this.updateSelectedUnitCoordsText();
    });

    this.selectionManager.on(ClientInternalEvents.SELECTION_CLEARED, () => {
      this.updateSelectedUnitCoordsText();
    });

    this.selectionManager.on(ClientInternalEvents.UNITS_UPDATED, () => {
      this.updateSelectedUnitCoordsText();
    });
  }

  update(time: number): void {
    if (!this.websocketClient || !this.selectionManager || !this.cursors) {
      return;
    }

    if (time - this.lastMoveRequestAt < GameScene.MOVE_REPEAT_MS) {
      return;
    }

    const selectedUnit = this.selectionManager.getSelectedUnit();
    if (!selectedUnit) {
      return;
    }

    let dx = 0;
    let dy = 0;
    let dz = 0;

    if (this.cursors.left?.isDown) {
      dx -= GameScene.MOVE_STEP;
    } else if (this.cursors.right?.isDown) {
      dx += GameScene.MOVE_STEP;
    }

    if (this.cursors.up?.isDown) {
      dy -= GameScene.MOVE_STEP;
    } else if (this.cursors.down?.isDown) {
      dy += GameScene.MOVE_STEP;
    }

    if (this.ascendKey?.isDown) {
      dz += GameScene.ALTITUDE_STEP;
    } else if (this.descendKey?.isDown) {
      dz -= GameScene.ALTITUDE_STEP;
    }

    if (dx === 0 && dy === 0 && dz === 0) {
      return;
    }

    const currentUnit = this.knownUnits.get(selectedUnit.unitId) ?? selectedUnit;
    const targetX = Phaser.Math.Clamp(currentUnit.x + dx, GameScene.MAP_MIN_X, GameScene.MAP_MAX_X);
    const targetY = Phaser.Math.Clamp(currentUnit.y + dy, GameScene.MAP_MIN_Y, GameScene.MAP_MAX_Y);
    const playerId = this.websocketClient?.getPlayerId();
    const maxZ = playerId === 'player_1'
      ? GameScene.MAP_MAX_Z * GameScene.MAP_MAX_Z_BONUS_FACTOR
      : GameScene.MAP_MAX_Z;
    const targetZ = Phaser.Math.Clamp(currentUnit.z + dz, GameScene.MAP_MIN_Z, maxZ);

    this.websocketClient.requestUnitMove(selectedUnit.unitId, targetX, targetY, targetZ);
    this.lastMoveRequestAt = time;
  }

  // ------------- UI -----------------
  private renderUnits(playerUnits: IUnit[], enemyUnits: IUnit[]): void {
    this.clearUnitSprites();

    playerUnits.forEach(unit => {
      const screenPosition = this.worldToScreen(unit.x, unit.y);
      this.createUnitSprite(unit, screenPosition.x, screenPosition.y, true);  // true = unidad propia
    });

    enemyUnits.forEach(unit => {
      const screenPosition = this.worldToScreen(unit.x, unit.y);
      this.createUnitSprite(unit, screenPosition.x, screenPosition.y, false); // false = unidad enemiga
    });

    console.log(`[GameScene] ${playerUnits.length} player units and ${enemyUnits.length} enemy units rendered`);
  }

  private createUnitSprite(unit: IUnit, x: number, y: number, isPlayerUnit: boolean): void {
    const body = this.add.rectangle(0, 0, 60, 60, this.getUnitColor(unit.type));
    body.setStrokeStyle(2, isPlayerUnit ? 0x00ff00 : 0xff0000);
    body.setInteractive({ useHandCursor: isPlayerUnit });

    const label = this.add.text(0, 0, this.getUnitLabel(unit.type), {
      fontSize: '12px',
      color: '#ffffff',
      align: 'center'
    }).setOrigin(0.5);

    const container = this.add.container(x, y, [body, label]);

    body.on('pointerdown', () => {
      if (isPlayerUnit) {  // Solo puedes seleccionar tus unidades
        this.selectionManager?.selectUnit(unit.unitId);
      }
    });

    body.on('pointerover', () => container.setScale(1.1));
    body.on('pointerout', () => container.setScale(1));

    this.unitSprites.set(unit.unitId, { container, body, label });
  }

  private highlightUnit(unitId: string): void {
    this.unitSprites.forEach(sprite => {
      sprite.body.setStrokeStyle(2, 0x888888);
    });

    const selectedSprite = this.unitSprites.get(unitId);
    if (selectedSprite) {
      selectedSprite.body.setStrokeStyle(4, 0xffff00);
    }
  }

  private clearUnitSprites(): void {
    this.unitSprites.forEach(sprite => sprite.container.destroy());
    this.unitSprites.clear();
  }

  private syncUnitPositions(unitPositions: IUnitPosition[]): void {
    unitPositions.forEach(update => {
      const unit = this.knownUnits.get(update.unitId);
      if (unit) {
        unit.x = update.position.x;
        unit.y = update.position.y;
        unit.z = update.position.z;
      }

      if (this.playerUnitIds.has(update.unitId)) {
        this.selectionManager?.updateUnitPosition(update.unitId, update.position);
      }

      const sprite = this.unitSprites.get(update.unitId);
      const screenPosition = this.worldToScreen(update.position.x, update.position.y);

      if (sprite) {
        sprite.container.setPosition(screenPosition.x, screenPosition.y);
      } else if (unit) {
        this.createUnitSprite(unit, screenPosition.x, screenPosition.y, this.playerUnitIds.has(update.unitId));
      }
    });

    this.updateSelectedUnitCoordsText();
  }

  private worldToScreen(worldX: number, worldY: number): { x: number; y: number } {
    const width = this.cameras.main.width - GameScene.MAP_PADDING * 2;
    const height = this.cameras.main.height - GameScene.MAP_PADDING * 2;
    const clampedX = Phaser.Math.Clamp(worldX, GameScene.MAP_MIN_X, GameScene.MAP_MAX_X);
    const clampedY = Phaser.Math.Clamp(worldY, GameScene.MAP_MIN_Y, GameScene.MAP_MAX_Y);
    const normalizedX = (clampedX - GameScene.MAP_MIN_X) / (GameScene.MAP_MAX_X - GameScene.MAP_MIN_X);
    const normalizedY = (clampedY - GameScene.MAP_MIN_Y) / (GameScene.MAP_MAX_Y - GameScene.MAP_MIN_Y);

    return {
      x: GameScene.MAP_PADDING + normalizedX * width,
      y: GameScene.MAP_PADDING + normalizedY * height
    };
  }

  private getUnitColor(type: string): number {
    const colors: { [key: string]: number } = {
      'AERIAL_DRONE': 0xff0000,
      'NAVAL_DRONE': 0x0000ff,
      'AERIAL_CARRIER': 0xffff00,
      'NAVAL_CARRIER': 0x00ff00
    };
    return colors[type] || 0xffffff;
  }

  private getUnitLabel(type: string): string {
    const labels: { [key: string]: string } = {
      'AERIAL_DRONE': 'A.D',
      'NAVAL_DRONE': 'N.D',
      'AERIAL_CARRIER': 'A.C',
      'NAVAL_CARRIER': 'N.C'
    };
    return labels[type] || '?';
  }

  private showError(message: string): void {
    this.add.text(
      this.cameras.main.centerX,
      this.cameras.main.centerY,
      'Error: ' + message,
      { fontSize: '20px', color: '#ff0000' }
    ).setOrigin(0.5);
  }

  private drawUI(): void {
    this.add.rectangle(
      this.cameras.main.centerX,
      this.cameras.main.centerY,
      this.cameras.main.width,
      this.cameras.main.height,
      0x1a1a2e
    ).setDepth(-1);

    this.add.text(
      this.cameras.main.centerX,
      30,
      'DroneWars',
      { fontSize: '24px', color: '#00ff00', fontStyle: 'bold' }
    ).setOrigin(0.5);

    this.add.text(
      20,
      70,
      'Click a drone to select it',
      { fontSize: '14px', color: '#cccccc' }
    );

    this.add.text(
      20,
      this.cameras.main.height - 40,
      'Connected to the server',
      { fontSize: '12px', color: '#00ff00' }
    );

    this.selectedUnitCoordsText = this.add.text(
      this.cameras.main.width - 20,
      20,
      'Selected: none',
      { fontSize: '14px', color: '#ffffff', align: 'right' }
    ).setOrigin(1, 0);
  }

  private updateSelectedUnitCoordsText(): void {
    if (!this.selectedUnitCoordsText) {
      return;
    }

    const selectedUnit = this.selectionManager?.getSelectedUnit();
    if (!selectedUnit) {
      this.selectedUnitCoordsText.setText('Selected: none');
      return;
    }

    const unit = this.knownUnits.get(selectedUnit.unitId) ?? selectedUnit;
    const x = unit.x.toFixed(1);
    const y = unit.y.toFixed(1);
    const z = unit.z.toFixed(1);

    this.selectedUnitCoordsText.setText(`Coords: ${x}, ${y}, ${z}`);
  }
}
