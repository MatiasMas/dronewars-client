import {WebSocketClient} from "../network/WebSocketClient";
import {SelectionManager} from "../managers/SelectionManager";
import {ClientInternalEvents, ServerToClientEvents} from "../types/CommunicationEvents";
import {IUnit} from "../types/IUnit";
import {IAvailablePlayer} from "../types/IAvailablePlayer";
import { UnitType } from "../types/UnitType";
import { IBombLaunched } from "../types/IBombLaunched";
import { IBombExploded } from "../types/IBombExploded";
import {IUnitPosition} from "../types/IUnitPosition";
import { IMisilDisparado } from "../types/IMisilDisparado";
import { IMisilImpactado } from "../types/IMisilImpactado";
import { IMisilActualizado } from "../types/IMisilActualizado";
import { IGameEnded } from "../types/IGameEnded";

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
  private indicadoresRecarga: Map<string, Phaser.GameObjects.Arc> = new Map();
  private cursors: Phaser.Types.Input.Keyboard.CursorKeys | null = null;
  private ascendKey: Phaser.Input.Keyboard.Key | null = null;
  private descendKey: Phaser.Input.Keyboard.Key | null = null;
  private lastMoveRequestAt = 0;
  private availablePlayers: IAvailablePlayer[] = [];
  private bombSprites: Map<string, Phaser.GameObjects.Ellipse> = new Map();
  private spritesMisiles: Map<string, Phaser.GameObjects.Ellipse> = new Map();
  private posicionesMisiles: Map<string, { x: number; y: number }> = new Map();
  private apuntandoMisil: boolean = false;
  private objetivoMisilPunto: { x: number; y: number } | null = null;
  private ultimoObjetivoMisilPunto: { x: number; y: number } | null = null;
  private marcadorObjetivoMisil: Phaser.GameObjects.Rectangle | null = null;
  private unitHealthLabels: Map<string, Phaser.GameObjects.Text> = new Map();
  private unitFuelLabels: Map<string, Phaser.GameObjects.Text> = new Map();
  private selectedUnitCoordsText: Phaser.GameObjects.Text | null = null;
  private selectedUnitArmamentoText: Phaser.GameObjects.Text | null = null;
  private armamentoPlayerText: Phaser.GameObjects.Text | null = null;
  private armamentoEnemyText: Phaser.GameObjects.Text | null = null;
  private ammoByUnitId: Map<string, number> = new Map();
  private botonRecargaContenedor: Phaser.GameObjects.Container | null = null;
  private textoBotonRecarga: Phaser.GameObjects.Text | null = null;
  private fondoBotonRecarga: Phaser.GameObjects.Rectangle | null = null;
  private botonMisilContenedor: Phaser.GameObjects.Container | null = null;
  private textoBotonMisil: Phaser.GameObjects.Text | null = null;
  private fondoBotonMisil: Phaser.GameObjects.Rectangle | null = null;
  private botonApuntarContenedor: Phaser.GameObjects.Container | null = null;
  private textoBotonApuntar: Phaser.GameObjects.Text | null = null;
  private fondoBotonApuntar: Phaser.GameObjects.Rectangle | null = null;
  private partidaFinalizada: boolean = false;
  private panelResultado: Phaser.GameObjects.Container | null = null;
  /** Centrar cámara en este punto en el próximo frame (al recibir unidades). */
  private pendingCameraCenter: { x: number; y: number } | null = null;

  // Límites del mapa (mundo grande; el viewport solo muestra una parte y sigue a la unidad seleccionada)
  private static readonly MAP_MIN_X = 0;
  private static readonly MAP_MAX_X = 6700;
  private static readonly MAP_MIN_Y = 0;
  private static readonly MAP_MAX_Y = 2500;
  private static readonly MAP_MIN_Z = 0;
  private static readonly MAP_MAX_Z = 10;
  private static readonly MAP_MAX_Z_BONUS_FACTOR = 1.005;


  private static readonly MOVE_STEP = 5;
  private static readonly ALTITUDE_STEP = 0.5;
  private static readonly MOVE_REPEAT_MS = 120;
  private static readonly RANGO_RECARGA_MUNDO = 20;
  private static readonly RANGO_DISPARO_MISIL = 30;
  private static readonly BOMBAS_POR_DRON = 1;
  private static readonly MISILES_POR_DRON = 2;

  constructor() {
    super('GameScene');
  }

  preload() {
    this.load.image('ocean', 'images/ocean.png');
  }

  async create() {
    console.log("[GameScene] Creating scene...");

    // Creando imagen de background
    const background = this.add.image(GameScene.MAP_MAX_X / 2, GameScene.MAP_MAX_Y / 2, 'ocean');
    background.setDepth(-2);
    background.setScale(
      (GameScene.MAP_MAX_X) / background.width,
      (GameScene.MAP_MAX_Y) / background.height
    );

    // Mundo más grande que el viewport: la cámara solo puede desplazarse dentro del mapa
    this.cameras.main.setBounds(
      GameScene.MAP_MIN_X,
      GameScene.MAP_MIN_Y,
      GameScene.MAP_MAX_X - GameScene.MAP_MIN_X,
      GameScene.MAP_MAX_Y - GameScene.MAP_MIN_Y
    );

    this.websocketClient = new WebSocketClient();

    try {
      // Configurando escuchas del websocket
      await this.websocketClient.connect();
    } catch (err) {
      console.error("[GameScene] Error connecting to server:", err);
      this.showError("Error connecting to server");
      return;
    }

    this.selectionManager = new SelectionManager();

    // Registrando jugador en el servidor y esperando confirmacion
    await this.waitForAvailablePlayers();

    // Seleccionando el primer jugador disponible y registrandolo en el servidor
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
    this.crearBotonMisil();
    this.crearBotonApuntar();
    this.updateSelectedUnitCoordsText();
    this.crearBotonRecarga();
    this.cursors = this.input.keyboard?.createCursorKeys() ?? null;
    this.ascendKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT) ?? null;
    this.descendKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.CTRL) ?? null;
    this.input.mouse?.disableContextMenu();
    this.setupPointerControls();
    this.input.keyboard?.addCapture([
      Phaser.Input.Keyboard.KeyCodes.UP,
      Phaser.Input.Keyboard.KeyCodes.DOWN,
      Phaser.Input.Keyboard.KeyCodes.LEFT,
      Phaser.Input.Keyboard.KeyCodes.RIGHT,
      Phaser.Input.Keyboard.KeyCodes.SHIFT,
      Phaser.Input.Keyboard.KeyCodes.CTRL
    ]);
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
      });
    });
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
  * Configura que hacer al recibir mensajes del servidor
  * Define los eventos del websocket
  */
  private setupEventListeners(): void {
    if (!this.websocketClient || !this.selectionManager) return;

    // El servidor devuelve la lista de unidades del jugador
    this.websocketClient.on(ServerToClientEvents.UNITS_RECEIVED, (data: any) => {
      const playerUnits: IUnit[] = data?.playerUnits ?? data?.player_units ?? [];
      const enemyUnits: IUnit[] = data?.enemyUnits ?? data?.enemy_units ?? [];

      console.log(`[GameScene] Received ${playerUnits.length} units for player and ${enemyUnits.length} units for enemy from server`);
      if (playerUnits.length > 0) {
        const first = playerUnits[0];
        console.log(`[GameScene] First unit: id=${first.unitId}, type=${first.type}, x=${first.x}, y=${first.y}`);
      }
      this.knownUnits.clear();
      playerUnits.forEach(unit => this.knownUnits.set(unit.unitId, unit));
      enemyUnits.forEach(unit => this.knownUnits.set(unit.unitId, unit));
      this.playerUnitIds = new Set(playerUnits.map(unit => unit.unitId));
      this.selectionManager?.setPlayerUnits(playerUnits);
      this.renderUnits(playerUnits, enemyUnits);
      this.centrarCamaraEnPortadrones(playerUnits);
      this.sincronizarMunicionInicial([...playerUnits, ...enemyUnits]);
      this.actualizarArmamentoUI();
    });

    this.selectionManager.on(ClientInternalEvents.SELECTION_CLEARED, () => {
      this.clearSelectoinHighlight()
      this.updateSelectedUnitCoordsText()
    })

    // El servidor confirma la seleccion de unidad
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

    this.websocketClient.on(ServerToClientEvents.MUNICION_RECARGADA, (payload: any) => {
      this.procesarMunicionRecargada(payload);
    });

    this.selectionManager.on(ClientInternalEvents.SELECTION_CHANGED, (unit: IUnit) => {
      console.log(`[GameScene] Selection changed: ${unit.unitId}, sendind selection to server...`);
      this.websocketClient?.requestUnitSelection(unit.unitId);
      this.updateSelectedUnitCoordsText();
    });

    this.selectionManager.on(ClientInternalEvents.SELECTION_CONFIRMED, () => {
      this.updateSelectedUnitCoordsText();
    });


    this.selectionManager.on(ClientInternalEvents.UNITS_UPDATED, () => {
      this.updateSelectedUnitCoordsText();
    });

    this.websocketClient.on(ServerToClientEvents.BOMB_LAUNCHED, (payload: IBombLaunched) => {
      this.handleBombLaunched(payload);
    });

    this.websocketClient.on(ServerToClientEvents.BOMB_EXPLODED, (payload: IBombExploded) => {
      this.handleBombExploded(payload);
    });

    this.websocketClient.on(ServerToClientEvents.MISIL_DISPARADO, (payload: IMisilDisparado) => {
      this.manejarMisilDisparado(payload);
    });

    this.websocketClient.on(ServerToClientEvents.MISIL_ACTUALIZADO, (payload: IMisilActualizado) => {
      this.manejarMisilActualizado(payload);
    });

    this.websocketClient.on(ServerToClientEvents.MISIL_IMPACTADO, (payload: IMisilImpactado) => {
      this.manejarMisilImpactado(payload);
    });

    this.websocketClient.on(ServerToClientEvents.GAME_ENDED, (payload: IGameEnded) => {
      this.mostrarResultadoFinal(payload);
    });
  }

  update(_time: number): void {
    // Centrado inicial: aplicar siempre al inicio, antes de cualquier return
    if (this.pendingCameraCenter) {
      const cam = this.cameras.main;
      const { x, y } = this.pendingCameraCenter;
      this.pendingCameraCenter = null;
      if (cam.width > 0 && cam.height > 0) {
        cam.centerOn(x, y);
        console.log(`[GameScene] Camera centerOn(${x}, ${y}), scroll=(${cam.scrollX}, ${cam.scrollY})`);
      }
    }

    if (!this.websocketClient || !this.selectionManager || !this.cursors) {
      return;
    }
    if (this.partidaFinalizada) {
      return;
    }

    this.actualizarCamara();
    this.actualizarIndicadoresRecarga();
    this.actualizarEstadoBotonRecarga();
    this.actualizarEstadoBotonMisil();
    this.actualizarEstadoBotonApuntar();

    // Movimiento por teclado: flechas + SHIFT/CTRL para altura
    const unidadSeleccionada = this.selectionManager.getSelectedUnit();
    if (!unidadSeleccionada) {
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

    const unidadActual = this.knownUnits.get(unidadSeleccionada.unitId) ?? unidadSeleccionada;
    const objetivoX = unidadActual.x + dx;
    const objetivoY = unidadActual.y + dy;
    const objetivoZ = unidadActual.z + dz;

    this.solicitarMovimiento(unidadSeleccionada.unitId, objetivoX, objetivoY, objetivoZ);

    // Actualiza indicadores de recarga y estado del boton
    this.actualizarIndicadoresRecarga();
    this.actualizarEstadoBotonRecarga();
    this.actualizarEstadoBotonMisil();
    this.actualizarEstadoBotonApuntar();
  }

  // ------------- Interfaz -----------------
  private renderUnits(playerUnits: IUnit[], enemyUnits: IUnit[]): void {
    // Render inicial de unidades con posiciones del servidor
    this.clearUnitSprites();
    this.limpiarIndicadoresRecarga();

    playerUnits.forEach(unit => {
      this.createUnitSprite(unit, unit.x, unit.y, true);  // true = unidad propia
    });

    enemyUnits.forEach(unit => {
      this.createUnitSprite(unit, unit.x, unit.y, false); // false = unidad enemiga
    });

    console.log(`[GameScene] ${playerUnits.length} player units and ${enemyUnits.length} enemy units rendered`);
  }

  private createUnitSprite(unit: IUnit, x: number, y: number, isPlayerUnit: boolean): void {
    // x, y = coordenadas MUNDO. El container va en (x,y); los hijos en posiciones RELATIVAS al container (0,0), (0,20)...
    const body = this.add.rectangle(0, 0, 60, 60, this.getUnitColor(unit.type));
    body.setStrokeStyle(2, isPlayerUnit ? 0x00ff00 : 0xff0000);
    body.setInteractive({useHandCursor: true});

    const label = this.add.text(0, 0, this.getUnitLabel(unit.type), {
      fontSize: '12px',
      color: '#ffffff',
      align: 'center'
    }).setOrigin(0.5);

    const hpText = this.add.text(0, 20, `HP:${unit.health}`, {
      fontSize: '11px',
      color: '#ffffff',
      align: 'center'
    }).setOrigin(0.5);

    const fuelText = this.add.text(0, 32, `FUEL:${Math.round(unit.combustible ?? 100)}`, {
      fontSize: '11px',
      color: '#ffffff',
      align: 'center'
    }).setOrigin(0.5);

    const container = this.add.container(x, y, [body, label, hpText, fuelText]);

    if (unit.health <= 0) {
      body.setFillStyle(0x666666);
      body.setStrokeStyle(2, 0x666666);
      body.disableInteractive();
    }

    this.unitHealthLabels.set(unit.unitId, hpText);
    this.unitFuelLabels.set(unit.unitId, fuelText);

    body.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (!pointer.leftButtonDown()) {
        return;
      }

      if (isPlayerUnit) {
        this.selectionManager?.selectUnit(unit.unitId);
        return;
      }
    });

    body.on('pointerover', () => container.setScale(1.1));
    body.on('pointerout', () => container.setScale(1));

    this.unitSprites.set(unit.unitId, { container, body, label });

    // Para portadrones aliados: crear indicador de recarga
    if (isPlayerUnit && this.esPortadrones(unit)) {
      const radio = 80;
      const indicador = this.add.circle(x, y, radio, 0x00ff00, 0.25);
      indicador.setStrokeStyle(2, 0x00ff00, 0.5);
      indicador.setDepth(-0.1);
      indicador.setVisible(false);
      this.indicadoresRecarga.set(unit.unitId, indicador);
    }
  }

  private clearSelectoinHighlight(): void {
    this.unitSprites.forEach((sprite, unitId) => {
      const unit = this.knownUnits.get(unitId);
      if (unit && unit.health <= 0) {
        sprite.body.setStrokeStyle(2, 0x666666);
        return;
      }
      const isPlayerUnit = this.playerUnitIds.has(unitId);
      sprite.body.setStrokeStyle(2, isPlayerUnit ? 0x00ff00 : 0xff0000);
    });
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
    this.unitHealthLabels.forEach(label => label.destroy());
    this.unitHealthLabels.clear();
    this.unitFuelLabels.forEach(label => label.destroy());
    this.unitFuelLabels.clear();
  }

  private limpiarIndicadoresRecarga(): void {
    this.indicadoresRecarga.forEach(indicador => indicador.destroy());
    this.indicadoresRecarga.clear();
  }

  private syncUnitPositions(unitPositions: IUnitPosition[]): void {
    // Sincroniza posiciones de todas las unidades con el estado enviado por el servidor
    unitPositions.forEach(update => {
      const unit = this.knownUnits.get(update.unitId);
      if (unit) {
        unit.x = update.position.x;
        unit.y = update.position.y;
        unit.z = update.position.z;
        if (typeof update.combustible === 'number') {
          unit.combustible = update.combustible;
        }
      }

      if (this.playerUnitIds.has(update.unitId)) {
        this.selectionManager?.updateUnitPosition(update.unitId, update.position);
      }

      const sprite = this.unitSprites.get(update.unitId);

      if (sprite) {
        // Las coordenadas son del MUNDO, Phaser las renderizará según la cámara
        sprite.container.setPosition(update.position.x, update.position.y);
        if (typeof update.combustible === 'number') {
          const fuelLabel = this.unitFuelLabels.get(update.unitId);
          if (fuelLabel) {
            fuelLabel.setText(`FUEL:${Math.round(update.combustible)}`);
          }
        }
      } else if (unit) {
        // Si no existe el sprite, crear uno nuevo
        this.createUnitSprite(unit, update.position.x, update.position.y, this.playerUnitIds.has(update.unitId));
      }
    });

    this.updateSelectedUnitCoordsText();
    this.actualizarIndicadoresRecarga();
    this.actualizarEstadoBotonRecarga();
    this.actualizarArmamentoUI();
    this.actualizarEstadoBotonMisil();
  }

  // ===== METODOS DE CONVERSION MUNDO A PANTALLA =====

  /**
   * Convierte coordenadas del mundo a pantalla, considerando la posición de la cámara
   * La cámara está centrada en el dron seleccionado
   */
  private mundoAPantalla(worldX: number, worldY: number): { x: number; y: number } {
    // Obtener la posición de la cámara (centrada en el dron seleccionado)
    const cameraX = this.cameras.main.scrollX + this.cameras.main.width / 2;
    const cameraY = this.cameras.main.scrollY + this.cameras.main.height / 2;

    // Convertir coordenadas del mundo a pantalla relativas a la cámara
    const screenX = worldX - cameraX + this.cameras.main.width / 2;
    const screenY = worldY - cameraY + this.cameras.main.height / 2;

    return { x: screenX, y: screenY };
  }

  /**
   * Convierte coordenadas de pantalla a mundo, considerando la posición de la cámara
   */
  private pantallaAMundo(screenX: number, screenY: number): { x: number; y: number } {
    // Obtener la posición de la cámara
    const cameraX = this.cameras.main.scrollX + this.cameras.main.width / 2;
    const cameraY = this.cameras.main.scrollY + this.cameras.main.height / 2;

    // Convertir coordenadas de pantalla a mundo
    const worldX = screenX - this.cameras.main.width / 2 + cameraX;
    const worldY = screenY - this.cameras.main.height / 2 + cameraY;

    // Clampear dentro de los límites del mapa
    return {
      x: Phaser.Math.Clamp(worldX, GameScene.MAP_MIN_X, GameScene.MAP_MAX_X),
      y: Phaser.Math.Clamp(worldY, GameScene.MAP_MIN_Y, GameScene.MAP_MAX_Y)
    };
  }

  /**
   * Convierte un radio del mundo a píxeles de pantalla
   */
  private radioMundoAPantalla(worldRadius: number): number {
    // Escala basada en el ancho visible
    const worldWidth = GameScene.MAP_MAX_X - GameScene.MAP_MIN_X;
    const screenWidth = this.cameras.main.width;
    return (worldRadius / worldWidth) * screenWidth;
  }

  /**
   * Actualiza la posición de la cámara para seguir la unidad seleccionada.
   * El viewport muestra solo una parte del mapa; la cámara se desplaza con la unidad.
   */
  private actualizarCamara(): void {
    const unidadSeleccionada = this.selectionManager?.getSelectedUnit();
    if (!unidadSeleccionada) {
      return;
    }

    const unit = this.knownUnits.get(unidadSeleccionada.unitId) ?? unidadSeleccionada;
    const w = this.cameras.main.width;
    const h = this.cameras.main.height;

    // Centrar la cámara en la unidad; setBounds ya limita el scroll al área del mapa
    const scrollX = unit.x - w / 2;
    const scrollY = unit.y - h / 2;
    this.cameras.main.setScroll(scrollX, scrollY);
  }

  /**
   * Al inicio del juego, enfoca la cámara en el portadrones del jugador:
   * Player 1 -> AERIAL_CARRIER, Player 2 -> NAVAL_CARRIER.
   * Se aplica en el próximo update() para tener dimensiones de cámara válidas.
   */
  private centrarCamaraEnPortadrones(playerUnits: IUnit[]): void {
    if (!playerUnits?.length) return;

    const playerId = this.websocketClient?.getPlayerId();
    const tipoCarrierStr = playerId === 'player_1' ? 'AERIAL_CARRIER' : 'NAVAL_CARRIER';
    const portadrones = playerUnits.find(u => String(u?.type) === tipoCarrierStr);
    const objetivo = portadrones ?? playerUnits[0];
    if (!objetivo || typeof objetivo.x !== 'number' || typeof objetivo.y !== 'number') return;

    this.pendingCameraCenter = { x: objetivo.x, y: objetivo.y };
    console.log(`[GameScene] Will center camera on carrier/unit at (${objetivo.x}, ${objetivo.y}), type=${objetivo.type}`);
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
    const texto = this.add.text(
      this.cameras.main.centerX,
      this.cameras.main.centerY,
      'Error: ' + message,
      {fontSize: '20px', color: '#ff0000'}
    ).setOrigin(0.5).setScrollFactor(0).setDepth(101);

    setTimeout(() => {
      texto.destroy();
    }, 1500);
  }

  private drawUI(): void {
    // Fondo del juego (sigue la cámara)
    // this.add.rectangle(
    //   GameScene.MAP_MAX_X / 2,
    //   GameScene.MAP_MAX_Y / 2,
    //   GameScene.MAP_MAX_X,
    //   GameScene.MAP_MAX_Y,
    //   0x1a1a2e
    // ).setDepth(-1);

    // Borde del mapa (visual, sigue la cámara)
    const graphics = this.add.graphics({ x: 0, y: 0 });
    graphics.lineStyle(2, 0x00ff00, 0.5);
    graphics.strokeRect(
      GameScene.MAP_MIN_X,
      GameScene.MAP_MIN_Y,
      GameScene.MAP_MAX_X - GameScene.MAP_MIN_X,
      GameScene.MAP_MAX_Y - GameScene.MAP_MIN_Y
    );

    // ===== UI FIJA EN PANTALLA (no sigue cámara) =====
    const titulo = this.add.text(
      this.cameras.main.centerX,
      30,
      'DroneWars',
      {fontSize: '24px', color: '#00ff00', fontStyle: 'bold'}
    ).setOrigin(0.5).setScrollFactor(0);
    titulo.setDepth(100);

    this.add.text(
      20,
      70,
      'Click izq: seleccionar/mover | Click der: deseleccionar',
      {fontSize: '14px', color: '#cccccc'}
    ).setScrollFactor(0).setDepth(100);

    this.add.text(
      20,
      this.cameras.main.height - 40,
      'Connected to the server',
      {fontSize: '12px', color: '#00ff00'}
    ).setScrollFactor(0).setDepth(100);

    this.selectedUnitCoordsText = this.add.text(
      this.cameras.main.width - 20,
      20,
      'Selected: none',
      {fontSize: '14px', color: '#ffffff', align: 'right'}
    ).setOrigin(1, 0).setScrollFactor(0).setDepth(100);

    this.selectedUnitArmamentoText = this.add.text(
      this.cameras.main.width - 20,
      38,
      'Armamento: -',
      { fontSize: '12px', color: '#cccccc', align: 'right' }
    ).setOrigin(1, 0).setScrollFactor(0).setDepth(100);

    this.armamentoPlayerText = this.add.text(
      20,
      50,
      'Jugador 1 Bombas: 0/0',
      { fontSize: '14px', color: '#ffffff', align: 'left' }
    ).setOrigin(0, 0).setScrollFactor(0).setDepth(100);

    this.armamentoEnemyText = this.add.text(
      this.cameras.main.width - 20,
      50,
      'Jugador 2 Misiles: 0/0',
      { fontSize: '14px', color: '#ffffff', align: 'right' }
    ).setOrigin(1, 0).setScrollFactor(0).setDepth(100);

    this.actualizarArmamentoUI();
  }

  private crearBotonRecarga(): void {
    const margen = 16;
    const ancho = 140;
    const alto = 36;
    const x = this.cameras.main.width - margen - ancho / 2;
    const y = this.cameras.main.height - margen - alto / 2;

    const fondo = this.add.rectangle(0, 0, ancho, alto, 0x2a2f35);
    fondo.setStrokeStyle(2, 0x4c4c4c, 0.8);

    const texto = this.add.text(0, 0, 'Recargar', {
      fontSize: '14px',
      color: '#b6ffb6'
    }).setOrigin(0.5);

    const contenedor = this.add.container(x, y, [fondo, texto]);
    contenedor.setScrollFactor(0).setDepth(100);
    contenedor.setInteractive(new Phaser.Geom.Rectangle(-ancho / 2, -alto / 2, ancho, alto), Phaser.Geom.Rectangle.Contains);

    contenedor.on('pointerdown', () => {
      this.manejarAccionRecarga();
    });

    this.botonRecargaContenedor = contenedor;
    this.textoBotonRecarga = texto;
    this.fondoBotonRecarga = fondo;
    this.actualizarEstadoBotonRecarga();
  }

  private updateSelectedUnitCoordsText(): void {
    // Muestra coordenadas de la unidad seleccionada
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
    this.updateSelectedUnitArmamentoText();
  }

  private actualizarArmamentoUI(): void {
    if (!this.armamentoPlayerText || !this.armamentoEnemyText) {
      return;
    }

    const player1Info = this.calcularArmamentoPorJugador(1);
    const player2Info = this.calcularArmamentoPorJugador(2);

    this.armamentoPlayerText.setText(`${player1Info.jugadorLabel} ${player1Info.etiqueta}: ${player1Info.actual}/${player1Info.max}`);
    this.armamentoEnemyText.setText(`${player2Info.jugadorLabel} ${player2Info.etiqueta}: ${player2Info.actual}/${player2Info.max}`);
    this.updateSelectedUnitArmamentoText();
  }

  private updateSelectedUnitArmamentoText(): void {
    if (!this.selectedUnitArmamentoText) {
      return;
    }

    const selectedUnit = this.selectionManager?.getSelectedUnit();
    if (!selectedUnit) {
      this.selectedUnitArmamentoText.setText('Armamento: -');
      return;
    }

    const unit = this.knownUnits.get(selectedUnit.unitId) ?? selectedUnit;
    if (!this.esUnidadDron(unit)) {
      this.selectedUnitArmamentoText.setText('Armamento: N/A');
      return;
    }

    const esJugadorUno = this.esUnidadDeJugador1(unit.unitId);
    const etiqueta = esJugadorUno ? 'Bombas' : 'Misiles';
    const maxPorDron = esJugadorUno ? GameScene.BOMBAS_POR_DRON : GameScene.MISILES_POR_DRON;
    const actual = this.ammoByUnitId.get(unit.unitId) ?? 0;

    this.selectedUnitArmamentoText.setText(`Armamento: ${etiqueta} ${actual}/${maxPorDron}`);
  }

  private calcularArmamentoPorJugador(jugador: 1 | 2): { actual: number; max: number; etiqueta: string; jugadorLabel: string } {
    const esJugadorUno = jugador === 1;
    const etiqueta = esJugadorUno ? 'Bombas' : 'Misiles';
    const porDron = esJugadorUno ? GameScene.BOMBAS_POR_DRON : GameScene.MISILES_POR_DRON;

    let drones = 0;
    let actual = 0;
    for (const [unitId, unit] of this.knownUnits.entries()) {
      const esUnidadJugadorUno = this.esUnidadDeJugador1(unitId);
      if (esJugadorUno !== esUnidadJugadorUno) {
        continue;
      }
      if (!this.esUnidadDron(unit)) {
        continue;
      }
      drones += 1;
      actual += this.ammoByUnitId.get(unitId) ?? 0;
    }

    const max = drones * porDron;
    if (actual > max) {
      actual = max;
    }

    return {
      actual,
      max,
      etiqueta,
      jugadorLabel: `Jugador ${jugador}`
    };
  }

  private esJugadorUno(): boolean {
    const playerId = this.websocketClient?.getPlayerId();
    if (!playerId) {
      return true;
    }
    return playerId === 'player_1';
  }

  private esUnidadDeJugador1(unitId: string): boolean {
    const localEsJugadorUno = this.esJugadorUno();
    const esUnidadPropia = this.playerUnitIds.has(unitId);
    return localEsJugadorUno ? esUnidadPropia : !esUnidadPropia;
  }

  private sincronizarMunicionInicial(units: IUnit[]): void {
    const siguiente = new Map<string, number>();
    units.forEach(unit => {
      if (!this.esUnidadDron(unit)) {
        return;
      }
      const actual = this.ammoByUnitId.get(unit.unitId) ?? 0;
      siguiente.set(unit.unitId, actual);
    });
    this.ammoByUnitId = siguiente;
  }

  private procesarMunicionRecargada(payload: any): void {
    const unitId = payload?.unitId;
    if (!unitId) {
      return;
    }

    const unit = this.knownUnits.get(unitId);
    if (!unit || !this.esUnidadDron(unit)) {
      return;
    }

    const esJugadorUno = this.esUnidadDeJugador1(unitId);
    const maxPorDron = esJugadorUno ? GameScene.BOMBAS_POR_DRON : GameScene.MISILES_POR_DRON;

    let nuevo = typeof payload?.ammo === 'number' ? payload.ammo : maxPorDron;
    nuevo = Phaser.Math.Clamp(nuevo, 0, maxPorDron);

    this.ammoByUnitId.set(unitId, nuevo);
    this.actualizarArmamentoUI();

    if (typeof payload?.combustible === 'number') {
      unit.combustible = payload.combustible;
      const fuelLabel = this.unitFuelLabels.get(unitId);
      if (fuelLabel) {
        fuelLabel.setText(`FUEL:${Math.round(payload.combustible)}`);
      }
    }
  }

  private setupPointerControls(): void {
    // Click derecho: deselecciona
    // Click izquierdo en mapa: mueve a la unidad seleccionada
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer, gameObjects: Phaser.GameObjects.GameObject[]) => {
      if (pointer.rightButtonDown()) {
        this.selectionManager?.deselectUnit();
        return;
      }

      if (!pointer.leftButtonDown()) {return}

      // Si hay objetos interactivos debajo, no es un click de mapa
      if (gameObjects && gameObjects.length > 0) {return}

      if (this.apuntandoMisil) {
        // Convertir posición de pantalla a mundo
        const objetivoMundo = this.pantallaAMundo(pointer.x, pointer.y);
        this.objetivoMisilPunto = { x: objetivoMundo.x, y: objetivoMundo.y };
        this.apuntandoMisil = false;
        this.actualizarMarcadorObjetivoMisil();
        this.actualizarEstadoBotonApuntar();
        this.actualizarEstadoBotonMisil();
        return;
      }

      const unidadSeleccionada = this.selectionManager?.getSelectedUnit();
      if (!unidadSeleccionada) {return}

      // Convertir posición de pantalla a mundo
      const objetivoMundo = this.pantallaAMundo(pointer.x, pointer.y);
      const unidadActual = this.knownUnits.get(unidadSeleccionada.unitId) ?? unidadSeleccionada;
      this.solicitarMovimiento(unidadSeleccionada.unitId, objetivoMundo.x, objetivoMundo.y, unidadActual.z);
    });

    // Rueda para altura: wheel ajusta Z en pasos fijos
    this.input.on('wheel', (_pointer: Phaser.Input.Pointer, _gameObjects: any, _deltaX: number, deltaY: number) => {
      if (!this.websocketClient || !this.selectionManager) {return}

      const unidadSeleccionada = this.selectionManager.getSelectedUnit();
      if (!unidadSeleccionada) {return}

      if (!this.playerUnitIds.has(unidadSeleccionada.unitId)) {return}

      const unidad = this.knownUnits.get(unidadSeleccionada.unitId) ?? unidadSeleccionada
      const direccion = Math.sign(deltaY);
      if (direccion === 0) {return}

      const deltaZ = direccion > 0 ? -GameScene.ALTITUDE_STEP : GameScene.ALTITUDE_STEP;
      this.solicitarMovimiento(unidadSeleccionada.unitId, unidad.x, unidad.y, unidad.z + deltaZ);
    });
  }

  private createBombAttackButton(): void {
    const x = 140;
    const y = 120;

    const button = this.add.rectangle(0, 0, 220, 44, 0x8b0000)
      .setStrokeStyle(2, 0xffd166)
      .setInteractive({ useHandCursor: true });

    const label = this.add.text(0, 0, 'Lanzar Bomba (Click Izq)', {
      fontSize: '14px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    const contenedor = this.add.container(x, y, [button, label]);
    contenedor.setScrollFactor(0).setDepth(100);

    button.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.leftButtonDown()) {
        this.launchBombFromSelectedUnit();
      }
    });

    if (!this.esJugadorUno()) {
      button.setInteractive(false);
      button.setFillStyle(0x4d4d4d, 1);
      button.setStrokeStyle(2, 0x888888);
      contenedor.setAlpha(0.6);
    }
  }

  private launchBombFromSelectedUnit(): void {
    if (!this.esJugadorUno()) {
      this.showError('Solo el Jugador 1 puede lanzar bombas');
      return;
    }

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

  private crearBotonMisil(): void {
    const ancho = 220;
    const alto = 44;
    const x = this.cameras.main.width - 140;
    const y = 120;

    const fondo = this.add.rectangle(0, 0, ancho, alto, 0x0b3d91);
    fondo.setStrokeStyle(2, 0x6cb6ff);

    const texto = this.add.text(0, 0, 'Lanzar Misil (Click Izq)', {
      fontSize: '14px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    const contenedor = this.add.container(x, y, [fondo, texto]);
    contenedor.setScrollFactor(0).setDepth(100);
    contenedor.setInteractive(new Phaser.Geom.Rectangle(-ancho / 2, -alto / 2, ancho, alto), Phaser.Geom.Rectangle.Contains);

    contenedor.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.leftButtonDown()) {
        this.lanzarMisilDesdeSeleccion();
      }
    });

    this.botonMisilContenedor = contenedor;
    this.textoBotonMisil = texto;
    this.fondoBotonMisil = fondo;
    this.actualizarEstadoBotonMisil();
  }

  private crearBotonApuntar(): void {
    const lado = 70;
    const x = this.cameras.main.width - 140;
    const y = 200;

    const fondo = this.add.rectangle(0, 0, lado, lado, 0x1b3a4b);
    fondo.setStrokeStyle(2, 0x6cb6ff);

    const texto = this.add.text(0, 0, 'Apuntar', {
      fontSize: '12px',
      color: '#ffffff',
      fontStyle: 'bold',
      align: 'center',
      wordWrap: { width: lado - 10 }
    }).setOrigin(0.5);

    const contenedor = this.add.container(x, y, [fondo, texto]);
    contenedor.setScrollFactor(0).setDepth(100);
    contenedor.setInteractive(new Phaser.Geom.Rectangle(-lado / 2, -lado / 2, lado, lado), Phaser.Geom.Rectangle.Contains);

    contenedor.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.leftButtonDown()) {
        this.apuntandoMisil = true;
        this.actualizarEstadoBotonApuntar();
      }
    });

    this.botonApuntarContenedor = contenedor;
    this.textoBotonApuntar = texto;
    this.fondoBotonApuntar = fondo;
    this.actualizarEstadoBotonApuntar();

    if (this.esJugadorUno()) {
      this.botonApuntarContenedor.setVisible(false);
      this.botonApuntarContenedor.disableInteractive();
    }
  }

  private lanzarMisilDesdeSeleccion(): void {
    if (this.esJugadorUno()) {
      this.showError('Solo el Jugador 2 puede lanzar misiles');
      return;
    }

    if (!this.selectionManager || !this.websocketClient) {
      return;
    }

    const unidadSeleccionada = this.selectionManager.getSelectedUnit();
    if (!unidadSeleccionada) {
      this.showError('Selecciona una unidad primero');
      return;
    }

    if (!this.playerUnitIds.has(unidadSeleccionada.unitId)) {
      return;
    }

    if (!this.esUnidadDron(unidadSeleccionada)) {
      this.showError('Solo un dron puede lanzar misiles');
      return;
    }

    const municion = this.ammoByUnitId.get(unidadSeleccionada.unitId) ?? 0;
    if (municion <= 0) {
      this.showError('No hay misiles disponibles');
      return;
    }

    const objetivo = this.objetivoMisilPunto ?? this.ultimoObjetivoMisilPunto;
    if (!objetivo) {
      this.showError('Primero apunta en el mapa');
      return;
    }

    const objetivoX = objetivo.x;
    const objetivoY = objetivo.y;

    this.websocketClient.solicitarDisparoMisil(unidadSeleccionada.unitId, objetivoX, objetivoY);
    this.ultimoObjetivoMisilPunto = { x: objetivoX, y: objetivoY };
    this.objetivoMisilPunto = null;
    this.actualizarMarcadorObjetivoMisil();
    this.actualizarEstadoBotonApuntar();
  }

  private actualizarEstadoBotonMisil(): void {
    if (!this.botonMisilContenedor || !this.textoBotonMisil || !this.fondoBotonMisil) {
      return;
    }

    if (this.esJugadorUno()) {
      this.botonMisilContenedor.setAlpha(0.6);
      this.textoBotonMisil.setColor('#7a7a7a');
      this.fondoBotonMisil.setFillStyle(0x2a2f35, 1);
      this.fondoBotonMisil.setStrokeStyle(2, 0x4c4c4c, 0.8);
      return;
    }

    const puedeDisparar = this.puedeDispararMisil();
    if (puedeDisparar) {
      this.botonMisilContenedor.setAlpha(1);
      this.textoBotonMisil.setColor('#ffffff');
      this.fondoBotonMisil.setFillStyle(0x0b5aa6, 0.9);
      this.fondoBotonMisil.setStrokeStyle(2, 0x6cb6ff, 0.9);
    } else {
      this.botonMisilContenedor.setAlpha(0.6);
      this.textoBotonMisil.setColor('#7a7a7a');
      this.fondoBotonMisil.setFillStyle(0x2a2f35, 1);
      this.fondoBotonMisil.setStrokeStyle(2, 0x4c4c4c, 0.8);
    }
  }


  private actualizarEstadoBotonApuntar(): void {
    if (!this.botonApuntarContenedor || !this.textoBotonApuntar || !this.fondoBotonApuntar) {
      return;
    }

    if (this.esJugadorUno()) {
      this.botonApuntarContenedor.setAlpha(0.6);
      this.textoBotonApuntar.setColor('#7a7a7a');
      this.fondoBotonApuntar.setFillStyle(0x2a2f35, 1);
      this.fondoBotonApuntar.setStrokeStyle(2, 0x4c4c4c, 0.8);
      return;
    }

    if (this.apuntandoMisil) {
      this.botonApuntarContenedor.setAlpha(1);
      this.textoBotonApuntar.setColor('#ffffff');
      this.fondoBotonApuntar.setFillStyle(0xffa726, 0.9);
      this.fondoBotonApuntar.setStrokeStyle(2, 0xffcc80, 0.9);
      return;
    }

    if (this.objetivoMisilPunto || this.ultimoObjetivoMisilPunto) {
      this.botonApuntarContenedor.setAlpha(1);
      this.textoBotonApuntar.setColor('#ffffff');
      this.fondoBotonApuntar.setFillStyle(0x2f7a2f, 0.9);
      this.fondoBotonApuntar.setStrokeStyle(2, 0x7dff7d, 0.9);
      return;
    }

    this.botonApuntarContenedor.setAlpha(0.8);
    this.textoBotonApuntar.setColor('#ffffff');
    this.fondoBotonApuntar.setFillStyle(0x1b3a4b, 0.9);
    this.fondoBotonApuntar.setStrokeStyle(2, 0x6cb6ff, 0.8);
  }

  private actualizarMarcadorObjetivoMisil(): void {
    const punto = this.objetivoMisilPunto ?? this.ultimoObjetivoMisilPunto;
    if (!punto) {
      if (this.marcadorObjetivoMisil) {
        this.marcadorObjetivoMisil.setVisible(false);
      }
      return;
    }

    const lado = 14;

    if (!this.marcadorObjetivoMisil) {
      const marcador = this.add.rectangle(punto.x, punto.y, lado, lado, 0xffcc80, 0.25);
      marcador.setStrokeStyle(2, 0xffa726, 0.9);
      marcador.setDepth(6);
      this.marcadorObjetivoMisil = marcador;
      this.marcadorObjetivoMisil.setVisible(true);
      return;
    }

    this.marcadorObjetivoMisil.setPosition(punto.x, punto.y);
    this.marcadorObjetivoMisil.setVisible(true);
  }

  private puedeDispararMisil(): boolean {
    if (!this.selectionManager) {
      return false;
    }

    const unidadSeleccionada = this.selectionManager.getSelectedUnit();
    if (!unidadSeleccionada) {
      return false;
    }

    if (!this.playerUnitIds.has(unidadSeleccionada.unitId)) {
      return false;
    }

    if (!this.esUnidadDron(unidadSeleccionada)) {
      return false;
    }

    const municion = this.ammoByUnitId.get(unidadSeleccionada.unitId) ?? 0;
    if (municion <= 0) {
      return false;
    }

    return this.objetivoMisilPunto !== null || this.ultimoObjetivoMisilPunto !== null;
  }

  private handleBombLaunched(datosBomba: IBombLaunched): void {
    // Dibuja la bomba en el mapa (coordenadas mundo para que haga scroll con la cámara)
    const spriteBomba = this.add.ellipse(datosBomba.x, datosBomba.y, 12, 12, 0xffaa00);
    spriteBomba.setStrokeStyle(2, 0xff0000);
    this.bombSprites.set(datosBomba.bombId, spriteBomba);

    const idUnidad = datosBomba.attackerUnitId;
    if (idUnidad) {
      const esJugadorUno = this.esUnidadDeJugador1(idUnidad);
      const maxPorDron = esJugadorUno ? GameScene.BOMBAS_POR_DRON : GameScene.MISILES_POR_DRON;
      const actual = this.ammoByUnitId.get(idUnidad) ?? maxPorDron;
      const nuevo = typeof datosBomba.ammo === 'number'
        ? datosBomba.ammo
        : Phaser.Math.Clamp(actual - 1, 0, maxPorDron);
      this.ammoByUnitId.set(idUnidad, nuevo);
      this.actualizarArmamentoUI();
    }

    const duracionMs = Math.max(180, datosBomba.z * 80);

    this.tweens.add({
      targets: spriteBomba,
      scaleX: 0.7,
      scaleY: 0.7,
      alpha: 0.85,
      duration: duracionMs,
      ease: 'Linear'
    });
  }

  private handleBombExploded(datosExplosion: IBombExploded): void {
    // Limpia la bomba del mapa si existe.
    const spriteBomba = this.bombSprites.get(datosExplosion.bombId);
    if (spriteBomba) {
      spriteBomba.destroy();
      this.bombSprites.delete(datosExplosion.bombId);
    }

    // Efecto visual de explosión (coordenadas mundo para que haga scroll)
    const ondaExplosion = this.add.circle(datosExplosion.x, datosExplosion.y, 32, 0xff5500, 0.45)
      .setStrokeStyle(2, 0xffdd00);

    this.tweens.add({
      targets: ondaExplosion,
      alpha: 0,
      scaleX: 1.8,
      scaleY: 1.8,
      duration: 260,
      onComplete: () => ondaExplosion.destroy()
    });

    datosExplosion.impactedUnits.forEach((unidadImpactada) => {
      // Sincroniza HP en el mapa local antes de pintar.
      const unidadActual = this.knownUnits.get(unidadImpactada.unitId);
      if (unidadActual) {
        unidadActual.health = unidadImpactada.health;
      }

      const sprite = this.unitSprites.get(unidadImpactada.unitId);
      const hpLabel = this.unitHealthLabels.get(unidadImpactada.unitId);

      if (hpLabel) {
        hpLabel.setText(`HP:${unidadImpactada.health}`);
      }

      if (sprite) {
        this.tweens.add({
          targets: sprite.container,
          alpha: 0.2,
          yoyo: true,
          repeat: 1,
          duration: 90
        });

        if (unidadImpactada.health <= 0) {
          // Si queda en 0, la eliminamos del mapa.
          this.eliminarUnidadDelMapa(unidadImpactada.unitId, 'bomba');
        }
      }
    });
  }

  private manejarMisilDisparado(datosMisil: IMisilDisparado): void {
    // Dibuja el misil en el mapa en coordenadas mundo (scroll con la cámara)
    const spriteMisil = this.add.ellipse(datosMisil.x, datosMisil.y, 10, 6, 0x00bcd4);
    spriteMisil.setStrokeStyle(1, 0xffffff);
    spriteMisil.setDepth(5);
    this.spritesMisiles.set(datosMisil.misilId, spriteMisil);
    this.posicionesMisiles.set(datosMisil.misilId, { x: datosMisil.x, y: datosMisil.y });

    // Soportamos el nombre correcto del payload y el anterior por compatibilidad.
    const idUnidad = datosMisil.unidadAtaqueId ?? (datosMisil as any).unidadAtacanteId;
    if (idUnidad) {
      const esJugadorUno = this.esUnidadDeJugador1(idUnidad);
      const maxPorDron = esJugadorUno ? GameScene.BOMBAS_POR_DRON : GameScene.MISILES_POR_DRON;
      const actual = this.ammoByUnitId.get(idUnidad) ?? maxPorDron;
      const nuevo = typeof datosMisil.municion === 'number'
        ? datosMisil.municion
        : Phaser.Math.Clamp(actual - 1, 0, maxPorDron);
      this.ammoByUnitId.set(idUnidad, nuevo);
      this.actualizarArmamentoUI();
    }

    // La animacion real la manda el servidor con MISIL_ACTUALIZADO.
  }

  private manejarMisilActualizado(datosMisil: IMisilActualizado): void {
    const spriteMisil = this.spritesMisiles.get(datosMisil.misilId);
    const anterior = this.posicionesMisiles.get(datosMisil.misilId);

    if (!spriteMisil) {
      const nuevo = this.add.ellipse(datosMisil.x, datosMisil.y, 10, 6, 0x00bcd4);
      nuevo.setStrokeStyle(1, 0xffffff);
      nuevo.setDepth(5);
      this.spritesMisiles.set(datosMisil.misilId, nuevo);
      this.posicionesMisiles.set(datosMisil.misilId, { x: datosMisil.x, y: datosMisil.y });
      return;
    }

    if (anterior) {
      const angulo = Phaser.Math.Angle.Between(anterior.x, anterior.y, datosMisil.x, datosMisil.y);
      spriteMisil.setRotation(angulo);
    }

    spriteMisil.setPosition(datosMisil.x, datosMisil.y);
    this.posicionesMisiles.set(datosMisil.misilId, { x: datosMisil.x, y: datosMisil.y });
  }

  private manejarMisilImpactado(datosImpacto: IMisilImpactado): void {
    const spriteMisil = this.spritesMisiles.get(datosImpacto.misilId);
    if (spriteMisil) {
      spriteMisil.destroy();
      this.spritesMisiles.delete(datosImpacto.misilId);
    }
    this.posicionesMisiles.delete(datosImpacto.misilId);

    datosImpacto.unidadesImpactadas.forEach((unidadImpactada) => {
      // Sincroniza HP en el mapa local antes de pintar.
      const unidadActual = this.knownUnits.get(unidadImpactada.unitId);
      if (unidadActual) {
        unidadActual.health = unidadImpactada.health;
      }

      const sprite = this.unitSprites.get(unidadImpactada.unitId);
      const hpLabel = this.unitHealthLabels.get(unidadImpactada.unitId);

      if (hpLabel) {
        hpLabel.setText(`HP:${unidadImpactada.health}`);
      }

      if (sprite) {
        this.tweens.add({
          targets: sprite.container,
          alpha: 0.2,
          yoyo: true,
          repeat: 1,
          duration: 90
        });

        if (unidadImpactada.health <= 0) {
          // Si queda en 0, la eliminamos del mapa.
          this.eliminarUnidadDelMapa(unidadImpactada.unitId, 'misil');
        }
      }
    });
  }

  private eliminarUnidadDelMapa(unidadId: string, tipoAtaque: 'bomba' | 'misil'): void {
    const sprite = this.unitSprites.get(unidadId);

    if (sprite) {
      const colorExplosion = tipoAtaque === 'bomba' ? 0xff5500 : 0x00bcd4;
      const onda = this.add.circle(sprite.container.x, sprite.container.y, 18, colorExplosion, 0.4);
      onda.setDepth(8);

      this.tweens.add({
        targets: onda,
        alpha: 0,
        scaleX: 1.8,
        scaleY: 1.8,
        duration: 240,
        onComplete: () => onda.destroy()
      });

      this.tweens.add({
        targets: sprite.container,
        alpha: 0,
        scaleX: 0.6,
        scaleY: 0.6,
        duration: 200,
        onComplete: () => sprite.container.destroy()
      });

      this.unitSprites.delete(unidadId);
    }

    const hpLabel = this.unitHealthLabels.get(unidadId);
    if (hpLabel) {
      hpLabel.destroy();
      this.unitHealthLabels.delete(unidadId);
    }

    const fuelLabel = this.unitFuelLabels.get(unidadId);
    if (fuelLabel) {
      fuelLabel.destroy();
      this.unitFuelLabels.delete(unidadId);
    }

    const indicador = this.indicadoresRecarga.get(unidadId);
    if (indicador) {
      indicador.destroy();
      this.indicadoresRecarga.delete(unidadId);
    }

    this.knownUnits.delete(unidadId);
    this.playerUnitIds.delete(unidadId);

    if (this.selectionManager?.getSelectedUnit()?.unitId === unidadId) {
      this.selectionManager.deselectUnit();
    }

    if (this.selectionManager) {
      const actuales = this.selectionManager.getPlayerUnits();
      const nuevos = actuales.filter(unidad => unidad.unitId !== unidadId);
      if (nuevos.length !== actuales.length) {
        this.selectionManager.setPlayerUnits(nuevos);
      }
    }

    this.actualizarArmamentoUI();
  }

  private solicitarMovimiento(unidadId: string, objetivoX: number, objetivoY: number, objetivoZ: number): void {
    // Punto unico de envio: limita la frecuencia y los rangos antes de enviar al servidor
    if (!this.websocketClient) {
      return;
    }

    if (!this.playerUnitIds.has(unidadId)) {
      return;
    }

    const ahoraMs = this.obtenerAhoraMs();
    if (ahoraMs < this.lastMoveRequestAt) {
      this.lastMoveRequestAt = 0;
    }

    if (ahoraMs - this.lastMoveRequestAt < GameScene.MOVE_REPEAT_MS) {
      return;
    }

    // Limites X/Y generales y Z segun jugador
    const maximoZ = this.obtenerMaxZParaJugador();
    const xLimitado = Phaser.Math.Clamp(objetivoX, GameScene.MAP_MIN_X, GameScene.MAP_MAX_X);
    const yLimitado = Phaser.Math.Clamp(objetivoY, GameScene.MAP_MIN_Y, GameScene.MAP_MAX_Y);
    const zLimitado = Phaser.Math.Clamp(objetivoZ, GameScene.MAP_MIN_Z, maximoZ);

    this.websocketClient.solicitarMovimientoUnidad(unidadId, xLimitado, yLimitado, zLimitado);
    this.lastMoveRequestAt = ahoraMs;
  }

  private obtenerAhoraMs(): number {
    if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
      return performance.now();
    }

    return Date.now();
  }

  private obtenerMaxZParaJugador(): number {
    // player_1 tiene un pequeno bonus de altura
    const playerId = this.websocketClient?.getPlayerId();
    if (playerId === 'player_1') {
      return GameScene.MAP_MAX_Z * GameScene.MAP_MAX_Z_BONUS_FACTOR;
    }

    return GameScene.MAP_MAX_Z;
  }

  private actualizarIndicadoresRecarga(): void {
    if (this.indicadoresRecarga.size === 0) {
      return;
    }

    const dronesJugador = this.obtenerDronesJugador();
    const rangoRecargaCuadrado = GameScene.RANGO_RECARGA_MUNDO * GameScene.RANGO_RECARGA_MUNDO;

    this.indicadoresRecarga.forEach((indicador, portadronesId) => {
      const portadrones = this.knownUnits.get(portadronesId);
      if (!portadrones) {
        indicador.setVisible(false);
        return;
      }

      indicador.setPosition(portadrones.x, portadrones.y);

      const hayDronCerca = dronesJugador.some(dron => {
        const deltaX = dron.x - portadrones.x;
        const deltaY = dron.y - portadrones.y;
        return (deltaX * deltaX + deltaY * deltaY) <= rangoRecargaCuadrado;
      });

      indicador.setVisible(hayDronCerca);
    });
  }

  private actualizarEstadoBotonRecarga(): void {
    if (!this.botonRecargaContenedor || !this.textoBotonRecarga || !this.fondoBotonRecarga) {
      return;
    }

    const puedeRecargar = this.puedeRecargarDronSeleccionado();
    if (puedeRecargar) {
      this.botonRecargaContenedor.setAlpha(1);
      this.textoBotonRecarga.setColor('#ffffff');
      this.fondoBotonRecarga.setFillStyle(0x2f7a2f, 0.9);
      this.fondoBotonRecarga.setStrokeStyle(2, 0x7dff7d, 0.9);
    } else {
      this.botonRecargaContenedor.setAlpha(0.6);
      this.textoBotonRecarga.setColor('#7a7a7a');
      this.fondoBotonRecarga.setFillStyle(0x2a2f35, 1);
      this.fondoBotonRecarga.setStrokeStyle(2, 0x4c4c4c, 0.8);
    }
  }

  private manejarAccionRecarga(): void {
    if (!this.websocketClient || !this.selectionManager) {
      return;
    }

    const unidadSeleccionada = this.selectionManager.getSelectedUnit();
    if (!unidadSeleccionada || !this.playerUnitIds.has(unidadSeleccionada.unitId)) {
      return;
    }

    if (!this.esUnidadDron(unidadSeleccionada)) {
      return;
    }

    const portadronesId = this.buscarPortadronesCercanoId(unidadSeleccionada);
    if (!portadronesId) {
      return;
    }

    // Evento para recarga (el servidor debe validar proximidad y estado)
    this.websocketClient.solicitarRecargaMunicion(unidadSeleccionada.unitId, portadronesId);
  }

  private puedeRecargarDronSeleccionado(): boolean {
    if (!this.selectionManager) {
      return false;
    }

    const unidadSeleccionada = this.selectionManager.getSelectedUnit();
    if (!unidadSeleccionada) {
      return false;
    }

    if (!this.playerUnitIds.has(unidadSeleccionada.unitId)) {
      return false;
    }

    if (!this.esUnidadDron(unidadSeleccionada)) {
      return false;
    }

    return this.buscarPortadronesCercanoId(unidadSeleccionada) !== null;
  }

  private buscarPortadronesCercanoId(dron: IUnit): string | null {
    const rangoRecargaCuadrado = GameScene.RANGO_RECARGA_MUNDO * GameScene.RANGO_RECARGA_MUNDO;
    for (const unidad of this.knownUnits.values()) {
      if (!this.playerUnitIds.has(unidad.unitId)) {
        continue;
      }

      if (!this.esPortadrones(unidad)) {
        continue;
      }

      const deltaX = dron.x - unidad.x;
      const deltaY = dron.y - unidad.y;
      if ((deltaX * deltaX + deltaY * deltaY) <= rangoRecargaCuadrado) {
        return unidad.unitId;
      }
    }

    return null;
  }

  private obtenerDronesJugador(): IUnit[] {
    const drones: IUnit[] = [];
    for (const unidad of this.knownUnits.values()) {
      if (!this.playerUnitIds.has(unidad.unitId)) {
        continue;
      }

      if (this.esUnidadDron(unidad)) {
        drones.push(unidad);
      }
    }

    return drones;
  }

  private esUnidadDron(unit: IUnit): boolean {
    return unit.type === 'AERIAL_DRONE' || unit.type === 'NAVAL_DRONE';
  }

  private esPortadrones(unit: IUnit): boolean {
    return unit.type === 'AERIAL_CARRIER' || unit.type === 'NAVAL_CARRIER';
  }

  private mostrarResultadoFinal(payload: IGameEnded): void {
    if (this.partidaFinalizada) return;
    this.partidaFinalizada = true;

    // Bloquea selección/interacciones
    this.selectionManager?.deselectUnit();
    this.unitSprites.forEach(s => s.body.disableInteractive());
    this.botonRecargaContenedor?.disableInteractive();
    this.botonMisilContenedor?.disableInteractive();
    this.botonApuntarContenedor?.disableInteractive();

    const w = this.cameras.main.width;
    const h = this.cameras.main.height;

    const fondo = this.add.rectangle(w / 2, h / 2, w, h, 0x000000, 0.75).setDepth(100);
    const titulo = this.add.text(w / 2, h / 2 - 70, payload.draw ? 'EMPATE' : 'FIN DE PARTIDA', {
      fontSize: '42px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(101);
    const ganadorTexto = payload.draw
        ? 'No hubo ganador'
        : `Ganador: ${payload.winnerTeamId === 'player_1' ? 'Equipo 1' : 'Equipo 2'}`;

    const razonTexto = this.textoRazonFin(payload.reason);

    const detalle = this.add.text(w / 2, h / 2 + 5, `${ganadorTexto}\n${razonTexto}`, {
      fontSize: '22px',
      color: '#f0f0f0',
      align: 'center'
    }).setOrigin(0.5).setDepth(101);

    this.panelResultado = this.add.container(0, 0, [fondo, titulo, detalle]).setScrollFactor(0).setDepth(101);
  }

  private textoRazonFin(reason: IGameEnded['reason']): string {
    if (reason === 'ALL_UNITS_DESTROYED') {
      return 'Todas las unidades de un equipo fueron destruidas.';
    }
    if (reason === 'CARRIER_DESTROYED_AND_NO_RESOURCES') {
      return 'Portadrones destruido y unidades restantes sin combustible o munición.';
    }
    return 'Portadrones destruido y no se destruyó el rival en 2 minutos.';
  }
}



