import {WebSocketClient} from "../network/WebSocketClient";
import {SelectionManager} from "../managers/SelectionManager";
import {ClientInternalEvents, ServerToClientEvents} from "../types/CommunicationEvents";
import {IUnit} from "../types/IUnit";
import {IAvailablePlayer} from "../types/IAvailablePlayer";
import { UnitType } from "../types/UnitType";
import { IBombLaunched } from "../types/IBombLaunched";
import { IBombExploded } from "../types/IBombExploded";

export class GameScene extends Phaser.Scene {
  private websocketClient: WebSocketClient | null = null;
  private selectionManager: SelectionManager | null = null;
  private unitSprites: Map<string, Phaser.GameObjects.Rectangle> = new Map();
  private availablePlayers: IAvailablePlayer[] = [];
  private bombSprites: Map<string, Phaser.GameObjects.Ellipse> = new Map();
  private unitHealthLabels: Map<string, Phaser.GameObjects.Text> = new Map();

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
    this.createBombAttackButton();
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

    this.websocketClient.on(ServerToClientEvents.BOMB_LAUNCHED, (payload: IBombLaunched) => {
      this.handleBombLaunched(payload);
    });

    this.websocketClient.on(ServerToClientEvents.BOMB_EXPLODED, (payload: IBombExploded) => {
      this.handleBombExploded(payload);
    });
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
      if (isPlayerUnit) {
        this.selectionManager?.selectUnit(unit.unitId);
      }
    });

    sprite.on('pointerover', () => sprite.setScale(1.1));
    sprite.on('pointerout', () => sprite.setScale(1));

    this.unitSprites.set(unit.unitId, sprite);

    this.add.text(x, y - 8, this.getUnitLabel(unit.type), {
      fontSize: '12px',
      color: '#ffffff',
      align: 'center'
    }).setOrigin(0.5);
    const hpText = this.add.text(x, y + 16, `HP:${unit.health}`, {
      fontSize: '11px',
      color: '#ffffff',
      align: 'center'
    }).setOrigin(0.5);

    this.unitHealthLabels.set(unit.unitId, hpText);
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

  private createBombAttackButton(): void {
    const x = 140;
    const y = 120;

    const button = this.add.rectangle(x, y, 220, 44, 0x8b0000)
        .setStrokeStyle(2, 0xffd166)
        .setInteractive({ useHandCursor: true });

    this.add.text(x, y, 'Lanzar Bomba (Click Izq)', {
      fontSize: '14px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    button.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.leftButtonDown()) {
        this.launchBombFromSelectedUnit();
      }
    });
  }

  private launchBombFromSelectedUnit(): void {
    const selectedUnit = this.selectionManager?.getSelectedUnit();

    if (!selectedUnit) {
      this.showError('Selecciona una unidad primero');
      return;
    }

    if (selectedUnit.type !== UnitType.AERIAL_DRONE) {
      this.showError('Solo un dron rojo (AERIAL_DRONE) puede lanzar bomba');
      return;
    }

    this.websocketClient?.requestBombAttack(selectedUnit.unitId);
  }


  private handleBombLaunched(payload: IBombLaunched): void {
    const bomb = this.add.ellipse(payload.x, payload.y, 12, 12, 0xffaa00);
    bomb.setStrokeStyle(2, 0xff0000);
    this.bombSprites.set(payload.bombId, bomb);

    const duration = Math.max(180, payload.z * 80);

    this.tweens.add({
      targets: bomb,
      scaleX: 0.7,
      scaleY: 0.7,
      alpha: 0.85,
      duration: duration,
      ease: 'Linear'
    });
  }

  private handleBombExploded(payload: IBombExploded): void {
    const bomb = this.bombSprites.get(payload.bombId);
    if (bomb) {
      bomb.destroy();
      this.bombSprites.delete(payload.bombId);
    }

    const blast = this.add.circle(payload.x, payload.y, 32, 0xff5500, 0.45)
        .setStrokeStyle(2, 0xffdd00);

    this.tweens.add({
      targets: blast,
      alpha: 0,
      scaleX: 1.8,
      scaleY: 1.8,
      duration: 260,
      onComplete: () => blast.destroy()
    });

    payload.impactedUnits.forEach((unit) => {
      const sprite = this.unitSprites.get(unit.unitId);
      const hpLabel = this.unitHealthLabels.get(unit.unitId);

      if (hpLabel) {
        hpLabel.setText(`HP:${unit.health}`);
      }

      if (sprite) {
        this.tweens.add({
          targets: sprite,
          alpha: 0.2,
          yoyo: true,
          repeat: 1,
          duration: 90
        });

        if (unit.health <= 0) {
          sprite.setFillStyle(0x333333);
          sprite.disableInteractive();
        }
      }
    });
  }
}