import {WebSocketClient} from "../network/WebSocketClient";
import {SelectionManager} from "../managers/SelectionManager";
import {ClientInternalEvents, ServerToClientEvents} from "../types/CommunicationEvents";
import {IUnit} from "../types/IUnit";
import {IAvailablePlayer} from "../types/IAvailablePlayer";

export class GameScene extends Phaser.Scene {
  private websocketClient: WebSocketClient | null = null;
  private selectionManager: SelectionManager | null = null;
  private unitSprites: Map<string, Phaser.GameObjects.Rectangle> = new Map();
  private availablePlayers: IAvailablePlayer[] = [];

  constructor() {
    super('GameScene');
  }

  async create() {
    console.log("[GameScene] Creating scene...");

    this.websocketClient = new WebSocketClient();

    try {
      // Setting websocket listeners
      await this.websocketClient.connect();
    } catch (err) {
      console.error("[GameScene] Error connecting to server:", err);
      this.showError("Error connecting to server");
      return;
    }

    this.selectionManager = new SelectionManager();

    // Registering player on server and waiting for server to confirm
    await this.waitForAvailablePlayers();

    // Selecting the first player available and registering it on the server
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
  * This method is the one that sets up what to do when receiving a message from the server,
  * It configures the events for the websocket
  */
  private setupEventListeners(): void {
    if (!this.websocketClient || !this.selectionManager) return;

    // Server returns player's units list
    this.websocketClient.on(ServerToClientEvents.UNITS_RECEIVED, (data: any) => {
      const playerUnits: IUnit[] = data.playerUnits;
      const enemyUnits: IUnit[] = data.enemyUnits;

      console.log(`[GameScene] Received ${playerUnits.length} units for player and ${enemyUnits.length} units for enemy from server`);
      this.selectionManager?.setPlayerUnits(playerUnits);
      this.renderUnits(playerUnits, enemyUnits);
    });

    // Server confirms unit selection
    this.websocketClient.on(ServerToClientEvents.UNIT_SELECTED, (unit: IUnit) => {
      console.log(`[GameScene] Selection confirmed: ${unit.unitId}`);
      this.selectionManager?.confirmSelection(unit);
      this.highlightUnit(unit.unitId);
    });

    // There has been a server error
    this.websocketClient.on(ServerToClientEvents.SERVER_ERROR, (errorMessage: string) => {
      console.error(`[GameScene] Server error: ${errorMessage}`);
      this.showError(errorMessage);
    });

    this.selectionManager.on(ClientInternalEvents.SELECTION_CHANGED, (unit: IUnit) => {
      console.log(`[GameScene] Selection changed: ${unit.unitId}, sendind selection to server...`);
      this.websocketClient?.requestUnitSelection(unit.unitId);
    })
  }

  // ------------- UI -----------------
  private renderUnits(playerUnits: IUnit[], enemyUnits: IUnit[]): void {
    const centerX = this.cameras.main.centerX;
    const centerY = this.cameras.main.centerY;

    playerUnits.forEach((unit, index) => {
      const x = centerX - 350;
      const y = centerY - 150 + index * 120;
      this.createUnitSprite(unit, x, y, true);  // true = unidad propia
    });

    // ✨ NUEVO: Renderizar unidades enemigas a la derecha
    enemyUnits.forEach((unit, index) => {
      const x = centerX + 250;
      const y = centerY - 150 + index * 120;
      this.createUnitSprite(unit, x, y, false); // false = unidad enemiga
    });

    console.log(`[GameScene] ${playerUnits.length} player units and ${enemyUnits.length} enemy units rendered`);
  }

  private createUnitSprite(unit: IUnit, x: number, y: number, isPlayerUnit: boolean): void {
    const sprite = this.add.rectangle(x, y, 60, 60, this.getUnitColor(unit.type));

    sprite.setStrokeStyle(2, isPlayerUnit ? 0x00ff00 : 0xff0000);
    sprite.setInteractive({ useHandCursor: true });

    sprite.on('pointerdown', () => {
      if (isPlayerUnit) {  // ✨ Solo puedes seleccionar tus unidades
        this.selectionManager?.selectUnit(unit.unitId);
      }
    });

    sprite.on('pointerover', () => sprite.setScale(1.1));
    sprite.on('pointerout', () => sprite.setScale(1));

    this.unitSprites.set(unit.unitId, sprite);

    this.add.text(x, y, this.getUnitLabel(unit.type), {
      fontSize: '12px',
      color: '#ffffff',
      align: 'center'
    }).setOrigin(0.5);
  }

  private highlightUnit(unitId: string): void {
    this.unitSprites.forEach(sprite => {
      sprite.setStrokeStyle(2, 0x888888);
    });

    const selectedSprite = this.unitSprites.get(unitId);
    if (selectedSprite) {
      selectedSprite.setStrokeStyle(4, 0xffff00);
    }
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
  }

}