import {WebSocketClient} from "../network/WebSocketClient";
import {SelectionManager} from "../managers/SelectionManager";
import {AnimationManager} from "../managers/AnimationManager";
import {HighScoreManager} from "../managers/HighScoreManager";
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
import { ISideViewUnit } from "../types/ISideViewUnit";

type UnitVisual = {
  container: Phaser.GameObjects.Container;
  sprite: Phaser.GameObjects.Sprite;
  label: Phaser.GameObjects.Text;
};

type GameSceneInitData = {
  preferredPlayerId?: string;
  websocketClient?: WebSocketClient;
  preRegistered?: boolean;
};

type UnitDestroyedPayload = {
  unitId?: string;
};

export class GameScene extends Phaser.Scene {
  private websocketClient: WebSocketClient | null = null;
  private highScoreManager: HighScoreManager = new HighScoreManager();
  private playerScore: number = 0;
  private static readonly SCORE_DRONE: number = 10;
  private static readonly SCORE_CARRIER: number = 50;
  private nombreJugador: string = "";
  private textoSiglas: Phaser.GameObjects.Text | null = null;
  private capturandoNombre: boolean = false;
  private selectionManager: SelectionManager | null = null;
  private unitSprites: Map<string, UnitVisual> = new Map();
  private knownUnits: Map<string, IUnit> = new Map();
  private playerUnitIds: Set<string> = new Set();
  private indicadoresRecarga: Map<string, Phaser.GameObjects.Arc> = new Map();
  private teclaW: Phaser.Input.Keyboard.Key | null = null;
  private teclaA: Phaser.Input.Keyboard.Key | null = null;
  private teclaS: Phaser.Input.Keyboard.Key | null = null;
  private teclaD: Phaser.Input.Keyboard.Key | null = null;
  private teclaQ: Phaser.Input.Keyboard.Key | null = null;
  private teclaE: Phaser.Input.Keyboard.Key | null = null;
  private flechas: Phaser.Types.Input.Keyboard.CursorKeys | null = null;
  private unidadArrastradaId: string | null = null;
  private lastMoveRequestAt = 0;
  private availablePlayers: IAvailablePlayer[] = [];
  private bombSprites: Map<string, Phaser.GameObjects.Ellipse> = new Map();
  private spritesMisiles: Map<string, Phaser.GameObjects.Ellipse> = new Map();
  private posicionesMisiles: Map<string, { x: number; y: number }> = new Map();
  private unitHealthLabels: Map<string, Phaser.GameObjects.Text> = new Map();
  private unitFuelLabels: Map<string, Phaser.GameObjects.Text> = new Map();
  private selectedUnitCoordsText: Phaser.GameObjects.Text | null = null;
  private selectedUnitArmamentoText: Phaser.GameObjects.Text | null = null;
  private selectedUnitFuelText: Phaser.GameObjects.Text | null = null;
  private statsPanelContainer: Phaser.GameObjects.Container | null = null;
  private statsDroneBody: Phaser.GameObjects.Rectangle | null = null;
  private statsDroneLabel: Phaser.GameObjects.Text | null = null;
  private armamentoPlayerText: Phaser.GameObjects.Text | null = null;
  private armamentoEnemyText: Phaser.GameObjects.Text | null = null;
  private ammoByUnitId: Map<string, number> = new Map();
  private botonRecargaContenedor: Phaser.GameObjects.Container | null = null;
  private textoBotonRecarga: Phaser.GameObjects.Text | null = null;
  private fondoBotonRecarga: Phaser.GameObjects.Rectangle | null = null;
  private botonMisilContenedor: Phaser.GameObjects.Container | null = null;
  private textoBotonMisil: Phaser.GameObjects.Text | null = null;
  private fondoBotonMisil: Phaser.GameObjects.Rectangle | null = null;
  private partidaFinalizada: boolean = false;
  private panelResultado: Phaser.GameObjects.Container | null = null;
  private timerPortadronesTexto: Phaser.GameObjects.Text | null = null;
  private timerPortadronesDeadlineMs: number | null = null;
  private timerPortadronesActivo: boolean = false;
  private timerPortadronesObjetivoTexto: string = '';
  private avisoPausaContenedor: Phaser.GameObjects.Container | null = null;
  private sidebarUnidades: ISideViewUnit[] = [];
  private sidebarUnidadesPorId: Map<string, ISideViewUnit> = new Map();
  private sidebarMezclaAlertaPorUnidad: Map<string, number> = new Map();
  private sidebarElementos: Phaser.GameObjects.GameObject[] = [];
  private sidebarUnidadSeleccionadaId: string | null = null;
  private sidebarNecesitaRender: boolean = true;
  private tweenCamaraSeleccion: Phaser.Tweens.Tween | null = null;
  private vistaLateralInferiorUnidades: ISideViewUnit[] = [];
  private vistaLateralInferiorGraphics: Phaser.GameObjects.Graphics | null = null;
  private vistaLateralInferiorEtiquetasAltitud: Phaser.GameObjects.Text[] = [];
  private vistaLateralInferiorPuntos: Map<string, Phaser.GameObjects.Container> = new Map();
  /** Centrar cámara en este punto en el próximo frame (al recibir unidades). */
  private pendingCameraCenter: { x: number; y: number } | null = null;

  // Límites del mapa (mundo grande; el viewport solo muestra una parte y sigue a la unidad seleccionada)
  private static readonly MAP_MIN_X = 0;
  private static readonly MAP_MAX_X = 6700;
  private static readonly MAP_MIN_Y = 0;
  private static readonly MAP_MAX_Y = 2500;
  private static readonly MAP_MIN_Z = 0;
  private static readonly MAP_MAX_Z = 10;
  private static readonly MAP_MAX_Z_MISILES = 8;
  private static readonly MAP_MAX_Z_BONUS_FACTOR = 1.005;
  private static readonly PANEL_DRONES_RATIO_ANCHO = 0.2;
  private static readonly PANEL_LATERAL_RATIO_ALTO = 0.2;
  private static readonly SIDEBAR_MARGEN_INTERNO = 12;
  private static readonly SIDEBAR_ALTO_CABECERA = 48;
  private static readonly SIDEBAR_COLUMNAS = 2;
  private static readonly SIDEBAR_ESPACIO_GRID = 8;
  private static readonly SIDEBAR_LADO_CUADRO_BASE = 92;
  private static readonly SIDEBAR_COLOR_FONDO_NORMAL = 0x121a2c;
  private static readonly SIDEBAR_COLOR_FONDO_ALERTA = 0x2a1a10;
  private static readonly SIDEBAR_COLOR_FONDO_DESTRUIDA = 0x505050;
  private static readonly SIDEBAR_COLOR_BORDE_NORMAL = 0x2f4d8c;
  private static readonly SIDEBAR_COLOR_BORDE_ALERTA = 0xff8c00;
  private static readonly SIDEBAR_COLOR_BORDE_DESTRUIDA = 0xb5b5b5;
  private static readonly SIDEBAR_COLOR_DETALLE_NORMAL = 0x93c5fd;
  private static readonly SIDEBAR_COLOR_DETALLE_ALERTA = 0xffb347;
  private static readonly SIDEBAR_COLOR_DETALLE_DESTRUIDA = 0xd0d0d0;
  private static readonly SIDEBAR_FACTOR_LERP_ALERTA = 0.012;
  private static readonly PANEL_INFERIOR_PADDING = 20;


  private static readonly MOVE_STEP = 5;
  private static readonly ALTITUDE_STEP = 0.5;
  private static readonly ALTITUDE_SCROLL_FACTOR = 0.01;
  private static readonly ALTITUDE_SCROLL_MAX_DELTA = 0.6;
  private static readonly ALTITUDE_SCROLL_REPEAT_MS = 45;
  private static readonly MOVE_REPEAT_MS = 120;
  private static readonly VELOCIDAD_CAMARA = 20;
  private static readonly AJUSTE_ROTACION_FRENTE_RAD = 0;
  private static readonly RANGO_RECARGA_MUNDO = 120;
  private static readonly RANGO_DISPARO_MISIL = 30;
  private static readonly BOMBAS_POR_DRON = 1;
  private static readonly MISILES_POR_DRON = 2;
  private static readonly CUENTA_REGRESIVA_PORTADRONES_MS = 2 * 60 * 1000;

  //Visibilidad
  private static readonly RANGO_VISION_BOMBAS = 400;
  private static readonly RANGO_VISION_MISILES = GameScene.RANGO_VISION_BOMBAS * 0.5;
  private static readonly FACTOR_VISION_MIN_Z = 0.7;
  private static readonly FACTOR_VISION_MAX_Z = 1.3;
  private static readonly ALFA_ZONA_NO_VISIBLE = 0.35;
  private capaNiebla: Phaser.GameObjects.Graphics | null = null;
  private mascaraVision: Phaser.GameObjects.Graphics | null = null;

  //Pausa
  private partidaPausada: boolean = false;
  private menuPausaVisible: boolean = false;
  private menuPausaContenedor: Phaser.GameObjects.Container | null = null;
  private textoBotonPausarMenu: Phaser.GameObjects.Text | null = null;
  private botonesMenuPausa: Array<{
    x: number;
    y: number;
    ancho: number;
    alto: number;
    accion: () => void;
  }> = [];

  constructor() {
    super('GameScene');
  }

  preload(): void {
    this.load.image('ocean', 'images/ocean.png');
    AnimationManager.preload(this);
  }


  async create(data: GameSceneInitData = {}) {
    console.log("[GameScene] Creating scene...");
    AnimationManager.createAnimations(this);

    // Creando imagen de background
    const background = this.add.image(GameScene.MAP_MAX_X / 2, GameScene.MAP_MAX_Y / 2, 'ocean');
    background.setDepth(-2);
    background.setScale(
      (GameScene.MAP_MAX_X) / background.width,
      (GameScene.MAP_MAX_Y) / background.height
    );

    //Creando capa "niebla"
    this.capaNiebla = this.add.graphics();
    this.capaNiebla.setDepth(5);
    this.mascaraVision = this.add.graphics();
    this.mascaraVision.setVisible(false);
    const mascara = new Phaser.Display.Masks.GeometryMask(this, this.mascaraVision);
    mascara.setInvertAlpha(true);
    this.capaNiebla.setMask(mascara);

    // Mundo más grande que el viewport: la cámara solo puede desplazarse dentro del mapa
    this.cameras.main.setBounds(
      GameScene.MAP_MIN_X,
      GameScene.MAP_MIN_Y,
      GameScene.MAP_MAX_X - GameScene.MAP_MIN_X,
      GameScene.MAP_MAX_Y - GameScene.MAP_MIN_Y
    );

    // Limitar el viewport de la cámara principal al 80% superior
    this.aplicarLayoutConPaneles();
    this.scale.on('resize', this.aplicarLayoutConPaneles, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off('resize', this.aplicarLayoutConPaneles, this);
      this.tweenCamaraSeleccion?.stop();
      this.tweenCamaraSeleccion = null;
      this.limpiarSidebarUI();
      this.limpiarVistaLateralInferiorUI();
    });

    this.websocketClient = data.websocketClient ?? new WebSocketClient();

    if (!this.websocketClient.isConnectedToServer()) {
      try {
        // Configurando escuchas del websocket
        await this.websocketClient.connect();
      } catch (err) {
        console.error("[GameScene] Error connecting to server:", err);
        this.showError("Error connecting to server");
        return;
      }
    }

    this.selectionManager = new SelectionManager();
    this.setupEventListeners();

    const preferredFromRegistry = this.registry.get("preferredPlayerId");
    const preferredPlayerId = (data.preferredPlayerId ?? preferredFromRegistry) as string | undefined;
    const usingPreRegisteredSession = data.preRegistered === true;

    if (!usingPreRegisteredSession) {
      // Registrando jugador en el servidor y esperando confirmacion
      await this.waitForAvailablePlayers();

      // Seleccionando el primer jugador disponible y registrandolo en el servidor
      const selectedPlayerId = this.selectPreferredOrFirstAvailablePlayer(preferredPlayerId);

      if (!selectedPlayerId) {
        this.showError('No players available');
        return;
      }

      this.websocketClient.registerPlayer(selectedPlayerId);
      await this.waitForPlayerRegistration();
    }

    this.websocketClient.requestPlayerUnits();

    this.drawUI();
    this.crearMenuPausa();
    this.updateSelectedUnitCoordsText();
    this.teclaW = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.W) ?? null;
    this.teclaA = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.A) ?? null;
    this.teclaS = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.S) ?? null;
    this.teclaD = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.D) ?? null;
    this.teclaQ = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.Q) ?? null;
    this.teclaE = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.E) ?? null;
    this.flechas = this.input.keyboard?.createCursorKeys() ?? null;
    this.input.mouse?.disableContextMenu();
    this.setupPointerControls();
    this.configurarDisparoConEspacio();
    this.configurarDeseleccionConEscape();
    this.input.keyboard?.addCapture([
      Phaser.Input.Keyboard.KeyCodes.W,
      Phaser.Input.Keyboard.KeyCodes.A,
      Phaser.Input.Keyboard.KeyCodes.S,
      Phaser.Input.Keyboard.KeyCodes.D,
      Phaser.Input.Keyboard.KeyCodes.Q,
      Phaser.Input.Keyboard.KeyCodes.E,
      Phaser.Input.Keyboard.KeyCodes.UP,
      Phaser.Input.Keyboard.KeyCodes.DOWN,
      Phaser.Input.Keyboard.KeyCodes.LEFT,
      Phaser.Input.Keyboard.KeyCodes.RIGHT,
      Phaser.Input.Keyboard.KeyCodes.ESC
    ]);

    this.input.keyboard?.on("keydown", (event: KeyboardEvent) => {
      this.manejarIngresoNombre(event);
    });

  }

  private configurarDisparoConEspacio(): void {
    if (!this.input.keyboard) {
      return;
    }

    this.input.keyboard.on("keydown-SPACE", (evento: KeyboardEvent) => {
      if (this.partidaPausada || this.menuPausaVisible || this.partidaFinalizada) {
        return;
      }

      if (evento.repeat) {
        return; // evita disparos multiples por dejar apretada la tecla
      }

      const unidadSeleccionada = this.selectionManager?.getSelectedUnit();
      if (!unidadSeleccionada) {
        console.log("[GameScene] No hay unidad seleccionada");
        return;
      }

      const esJugadorDeBombas = this.esJugadorUno();
      if (esJugadorDeBombas) {
        this.launchBombFromSelectedUnit();
        return;
      }

      this.lanzarMisilDesdeSeleccion();
    });
  }

  private configurarDeseleccionConEscape(): void {
    if (!this.input.keyboard) {
      return;
    }

    this.input.keyboard.on("keydown-ESC", (evento: KeyboardEvent) => {
      if (evento.repeat) return;

      this.alternarMenuPausa();
    });
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

  private selectPreferredOrFirstAvailablePlayer(preferredPlayerId?: string): string | null {
    if (preferredPlayerId) {
      const preferred = this.availablePlayers.find(
          p => p.playerId === preferredPlayerId && p.available
      );
      if (preferred) {
        console.log(`[GameScene] Using preferred player: ${preferred.playerName} (${preferred.playerId})`);
        return preferred.playerId;
      }
    }

    const availablePlayer = this.availablePlayers.find(player => player.available);

    if (availablePlayer) {
      console.log(`[GameScene] Selecting first available player: ${availablePlayer.playerName}`);
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

    this.websocketClient.on(ServerToClientEvents.GAME_PAUSE_UPDATED, (payload: any) => {
      const paused = payload?.paused;
      const pausada = payload?.pausada;
      this.partidaPausada = paused === true || pausada === true;
      this.actualizarTextoBotonPausaMenu();
      this.actualizarAvisoPausa();
      this.actualizarEstadoBotonRecarga();
      this.actualizarEstadoBotonMisil();
    });

    this.websocketClient.on(ServerToClientEvents.SAVE_GAME_RESULT, (payload: any) => {
      const ok = payload?.ok === true;
      const message = typeof payload?.message === 'string'
        ? payload.message
        : (ok ? 'Partida guardada' : 'No se pudo guardar la partida');

      this.showError(message);
    });

    this.selectionManager.on(ClientInternalEvents.SELECTION_CLEARED, () => {
      this.clearSelectionHighlight()
      this.updateSelectedUnitCoordsText()
      this.emitirSeleccionParaSidebar(null);
    })

    // El servidor confirma la seleccion de unidad
    this.websocketClient.on(ServerToClientEvents.UNIT_SELECTED, (unit: IUnit) => {
      console.log(`[GameScene] Selection confirmed: ${unit.unitId}`);
      this.selectionManager?.confirmSelection(unit);
      this.highlightUnit(unit.unitId);
      this.updateSelectedUnitCoordsText();
    });

    this.websocketClient.on(ServerToClientEvents.UNIT_DESTROYED, (payload: UnitDestroyedPayload | string) => {
      const unitId = typeof payload === 'string' ? payload : payload?.unitId;
      if (!unitId) {
        return;
      }

      this.removeUnitImmediately(unitId);
    });

    // Hubo un error en el servidor
    this.websocketClient.on(ServerToClientEvents.SERVER_ERROR, (errorPayload: unknown) => {
      const errorMessage = this.extractServerErrorMessage(errorPayload);
      console.error(`[GameScene] Server error: ${errorMessage}`);
      this.showError(errorMessage);

      if (errorMessage.toLowerCase().includes('unidad no encontrada')) {
        const unitId = this.extractUnitIdFromServerError(errorPayload)
          ?? this.selectionManager?.getSelectedUnit()?.unitId
          ?? null;

        if (unitId) {
          this.removeUnitImmediately(unitId);
        } else {
          this.selectionManager?.deselectUnit();
          this.updateSelectedUnitCoordsText();
        }
      }
    });

    this.websocketClient.on(ServerToClientEvents.MOVE_ACCEPTED, (unitId: string) => {
      console.log(`[GameScene] Move accepted: ${unitId}`);
    });

    this.websocketClient.on(ServerToClientEvents.GAME_STATE_UPDATE, (unitPositions: IUnitPosition[]) => {
      this.syncUnitPositions(unitPositions ?? []);
    });

    this.websocketClient.on(ServerToClientEvents.MUNICION_RECARGADA, (payload: any) => {
      this.procesarMunicionRecargada(payload);
    });

    this.selectionManager.on(ClientInternalEvents.SELECTION_CHANGED, (unit: IUnit) => {
      console.log(`[GameScene] Selection changed: ${unit.unitId}, sendind selection to server...`);
      this.websocketClient?.requestUnitSelection(unit.unitId);
      this.updateSelectedUnitCoordsText();
      this.emitirSeleccionParaSidebar(unit.unitId);
      const unidad = this.knownUnits.get(unit.unitId) ?? unit;
      this.pendingCameraCenter = { x: unidad.x, y: unidad.y };
    });

    this.selectionManager.on(ClientInternalEvents.SELECTION_CONFIRMED, (unit: IUnit) => {
      this.updateSelectedUnitCoordsText();
      this.emitirSeleccionParaSidebar(unit.unitId);
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

  private seleccionarUnidadDesdeSidebar(unitId: string): void {
    if (!unitId || !this.selectionManager) {
      return;
    }

    const unidadSeleccionada = this.selectionManager.selectUnit(unitId);
    if (!unidadSeleccionada) {
      return;
    }

    const unidad = this.knownUnits.get(unitId) ?? unidadSeleccionada;
    this.pendingCameraCenter = { x: unidad.x, y: unidad.y };
    this.emitirSeleccionParaSidebar(unitId);
  }

  private ciclarSeleccionUnidades(direccion: number): void {
    if (!this.selectionManager) {
      return;
    }

    const unidadesVivas = this.selectionManager
      .getPlayerUnits()
      .filter(unidad => {
        const actual = this.knownUnits.get(unidad.unitId) ?? unidad;
        return actual.health > 0;
      });

    if (unidadesVivas.length === 0) {
      return;
    }

    const seleccionActualId = this.selectionManager.getSelectedUnit()?.unitId ?? null;
    const indiceActual = unidadesVivas.findIndex(unidad => unidad.unitId === seleccionActualId);
    const indiceBase = indiceActual >= 0 ? indiceActual : (direccion > 0 ? -1 : 0);
    const siguienteIndice = Phaser.Math.Wrap(indiceBase + direccion, 0, unidadesVivas.length);
    const unidadObjetivo = unidadesVivas[siguienteIndice];

    const unidadSeleccionada = this.selectionManager.selectUnit(unidadObjetivo.unitId);
    if (!unidadSeleccionada) {
      return;
    }

    const unidadMapa = this.knownUnits.get(unidadObjetivo.unitId) ?? unidadSeleccionada;
    this.pendingCameraCenter = { x: unidadMapa.x, y: unidadMapa.y };
    this.emitirSeleccionParaSidebar(unidadObjetivo.unitId);
  }

  private emitirSeleccionParaSidebar(unitId: string | null): void {
    this.sidebarUnidadSeleccionadaId = unitId;
    this.sidebarNecesitaRender = true;
  }

  update(_time: number, delta: number): void {
    // Centrado inicial: aplicar siempre al inicio, antes de cualquier return
    if (this.pendingCameraCenter) {
      const cam = this.cameras.main;
      const { x, y } = this.pendingCameraCenter;
      this.pendingCameraCenter = null;
      if (cam.width > 0 && cam.height > 0) {
        this.animarCamaraConPanelIzquierdo(x, y);
      }
    }

    this.actualizarTimerPortadrones();
    const sidebarAnimando = this.actualizarLerpSidebar(delta);
    if (sidebarAnimando || this.sidebarNecesitaRender) {
      this.renderizarSidebarDrones();
    }

    if (this.partidaPausada || this.menuPausaVisible) { return; }

    if (
      !this.websocketClient ||
      !this.selectionManager ||
      !this.teclaW ||
      !this.teclaA ||
      !this.teclaS ||
      !this.teclaD ||
      !this.teclaQ ||
      !this.teclaE ||
      !this.flechas
    ) {
      return;
    }
    if (this.partidaFinalizada) {
      return;
    }

    this.actualizarCamara();
    this.actualizarIndicadoresRecarga();
    this.actualizarEstadoBotonRecarga();
    this.actualizarEstadoBotonMisil();

    // Movimiento por teclado: flechas para unidad + Q/E para altura
    const unidadSeleccionada = this.selectionManager.getSelectedUnit();
    if (!unidadSeleccionada) {
      this.moverCamaraLibreConWASD();
      return;
    }

    let deltaX = 0;
    let deltaY = 0;
    let deltaZ = 0;

    if (this.flechas.left?.isDown) {
      deltaX -= GameScene.MOVE_STEP;
    }
    if (this.flechas.right?.isDown) {
      deltaX += GameScene.MOVE_STEP;
    }
    if (this.flechas.up?.isDown) {
      deltaY -= GameScene.MOVE_STEP;
    }
    if (this.flechas.down?.isDown) {
      deltaY += GameScene.MOVE_STEP;
    }
    if (this.teclaQ.isDown) {
      deltaZ += GameScene.ALTITUDE_STEP;
    }
    if (this.teclaE.isDown) {
      deltaZ -= GameScene.ALTITUDE_STEP;
    }

    if (deltaX === 0 && deltaY === 0 && deltaZ === 0) {
      return;
    }

    const unidadActual = this.knownUnits.get(unidadSeleccionada.unitId) ?? unidadSeleccionada;
    const objetivoX = unidadActual.x + deltaX;
    const objetivoY = unidadActual.y + deltaY;
    const objetivoZ = unidadActual.z + deltaZ;

    this.solicitarMovimiento(unidadSeleccionada.unitId, objetivoX, objetivoY, objetivoZ);

    // Actualiza indicadores de recarga y estado del boton
    this.actualizarIndicadoresRecarga();
    this.actualizarEstadoBotonRecarga();
    this.actualizarEstadoBotonMisil();
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

    this.actualizarEtiquetasUnidadesMapa();
    this.emitirActualizacionDeAltura();
    this.actualizarVisibilidadEnemigos();
    this.actualizarCapaNiebla();

    console.log(`[GameScene] ${playerUnits.length} player units and ${enemyUnits.length} enemy units rendered`);
  }

  private createUnitSprite(unit: IUnit, x: number, y: number, isPlayerUnit: boolean): void {
    // x, y = coordenadas MUNDO. El container va en (x,y); los hijos en posiciones RELATIVAS al container (0,0), (0,20)...
    const esUnidadJugadorUno = this.esUnidadDeJugador1(unit.unitId);
    const esDron = this.esUnidadDron(unit);
    const esCarrier = this.esPortadrones(unit);

    let animKey: string;
    let textureKey: string;

    if (esDron) {
      if (esUnidadJugadorUno) {
        animKey = AnimationManager.KEYS.droneChinoMCenital;
        textureKey = "droneChinoMovCenital";
      } else {
        animKey = AnimationManager.KEYS.dronePortuguesMCenital;
        textureKey = "dronePortuguesMovCenital";
      }
    } else if (esCarrier) {
      if (esUnidadJugadorUno) {
        animKey = AnimationManager.KEYS.carrierChinoMCenital;
        textureKey = "carrierChinoMovCenital";
      } else {
        animKey = AnimationManager.KEYS.carrierPortuguesMCenital;
        textureKey = "carrierPortuguesMovCenital";
      }
    } else {
      // Fallback muy raro: tipo desconocido, usar un rectángulo simple
      const fallbackBody = this.add.rectangle(0, 0, 60, 60, this.getUnitColor(unit.type));
      fallbackBody.setInteractive({ useHandCursor: true });

      const fallbackLabel = this.add.text(0, 0, this.obtenerEtiquetaUnidadMapa(unit), {
        fontSize: '12px',
        color: '#ffffff',
        align: 'center'
      }).setOrigin(0.5);

      const hpTextFallback = this.add.text(0, 20, `HP:${unit.health}`, {
        fontSize: '11px',
        color: '#ffffff',
        align: 'center'
      }).setOrigin(0.5);

      const fuelTextFallback = this.add.text(0, 32, `FUEL:${Math.round(unit.combustible ?? 100)}`, {
        fontSize: '11px',
        color: '#ffffff',
        align: 'center'
      }).setOrigin(0.5);

      const fallbackContainer = this.add.container(x, y, [fallbackBody, fallbackLabel, hpTextFallback, fuelTextFallback]);

      this.unitHealthLabels.set(unit.unitId, hpTextFallback);
      this.unitFuelLabels.set(unit.unitId, fuelTextFallback);

      fallbackBody.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
        if (this.partidaPausada || this.menuPausaVisible || this.partidaFinalizada) {
          return;
        }
        if (this.pointerEnPanelDrones(pointer) || !this.pointerEnAreaDeMapa(pointer)) {
          return;
        }

        if (!pointer.leftButtonDown()) {
          return;
        }

        if (isPlayerUnit) {
          this.selectionManager?.selectUnit(unit.unitId);
          return;
        }
      });

      fallbackBody.on('pointerover', () => fallbackContainer.setScale(1.1));
      fallbackBody.on('pointerout', () => fallbackContainer.setScale(1));

      this.unitSprites.set(unit.unitId, { container: fallbackContainer, sprite: fallbackBody as any, label: fallbackLabel });
      return;
    }

    const sprite = this.add.sprite(0, 0, textureKey, 0);
    sprite.setOrigin(0.5);
    sprite.setInteractive({ useHandCursor: true });
    sprite.setScale(2.4, 2.4);
    sprite.play(animKey);

    const label = this.add.text(0, -36, this.obtenerEtiquetaUnidadMapa(unit), {
      fontSize: '12px',
      color: '#ffffff',
      align: 'center'
    }).setOrigin(0.5);

    const hpText = this.add.text(0, 28, `HP:${unit.health}`, {
      fontSize: '11px',
      color: '#ffffff',
      align: 'center'
    }).setOrigin(0.5);

    const fuelText = this.add.text(0, 40, `FUEL:${Math.round(unit.combustible ?? 100)}`, {
      fontSize: '11px',
      color: '#ffffff',
      align: 'center'
    }).setOrigin(0.5);

    const container = this.add.container(x, y, [sprite, label, hpText, fuelText]);

    let depth = 0;

    if (unit.type === "NAVAL_CARRIER") {
      depth = 0;
    }
    else if (!isPlayerUnit) {
      depth = 10;
    }
    else {
      depth = 20;
    }

    container.setDepth(depth);

    if (unit.health <= 0) {
      sprite.setTint(0x666666);
      sprite.disableInteractive();
    }

    this.unitHealthLabels.set(unit.unitId, hpText);
    this.unitFuelLabels.set(unit.unitId, fuelText);

    sprite.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.partidaPausada || this.menuPausaVisible || this.partidaFinalizada) {
        return;
      }
      if (this.pointerEnPanelDrones(pointer) || !this.pointerEnAreaDeMapa(pointer)) {
        return;
      }

      if (!pointer.leftButtonDown()) {
        return;
      }

      if (isPlayerUnit) {
        this.selectionManager?.selectUnit(unit.unitId);
        return;
      }
    });

    sprite.on('pointerover', () => container.setScale(1.1));
    sprite.on('pointerout', () => container.setScale(1));

    this.unitSprites.set(unit.unitId, { container, sprite, label });

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

  private clearSelectionHighlight(): void {
    this.unitSprites.forEach((sprite, unitId) => {
      const unit = this.knownUnits.get(unitId);
      if (unit && unit.health <= 0) {
        sprite.sprite.setTint(0x666666);
        return;
      }
      const isPlayerUnit = this.playerUnitIds.has(unitId);
      sprite.sprite.clearTint();
      sprite.sprite.setTint(isPlayerUnit ? 0x00ff00 : 0xff0000);
    });
  }

  private highlightUnit(unitId: string): void {
    this.unitSprites.forEach(sprite => {
      sprite.sprite.setTint(0x888888);
    });

    const selectedSprite = this.unitSprites.get(unitId);
    if (selectedSprite) {
      selectedSprite.sprite.setTint(0xffff00);
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

  private obtenerRangoVisionUnidad(unidad: IUnit): number {
    const esJugadorUno = this.esUnidadDeJugador1(unidad.unitId);
    const rangoBase = esJugadorUno ? GameScene.RANGO_VISION_BOMBAS : GameScene.RANGO_VISION_MISILES;
    const maxZ = this.obtenerMaxZParaJugador();
    if (maxZ <= 0) {
      return rangoBase;
    }

    const z = Phaser.Math.Clamp(unidad.z, 0, maxZ);
    const factorZ = z / maxZ;
    const factor = GameScene.FACTOR_VISION_MIN_Z
      + (GameScene.FACTOR_VISION_MAX_Z - GameScene.FACTOR_VISION_MIN_Z) * factorZ;

    return rangoBase * factor;
  }

  private actualizarVisibilidadEnemigos(): void {
    const unidadesConVisionPropias = this.obtenerUnidadesConVisionJugador();

    for (const [unitId, unidad] of this.knownUnits.entries()) {
      if (this.playerUnitIds.has(unitId)) {
        continue;
      }

      let visible = false;

      for (const unidadConVision of unidadesConVisionPropias) {
        const dx = unidadConVision.x - unidad.x;
        const dy = unidadConVision.y - unidad.y;
          const rango = this.obtenerRangoVisionUnidad(unidadConVision);
          const distancia2 = dx * dx + dy * dy;

        if (distancia2 <= rango * rango) {
          visible = true;
          break;
        }
      }

      const sprite = this.unitSprites.get(unitId);
      if (sprite) {
        sprite.container.setAlpha(visible ? 1 : 0);
      }

      const hpLabel = this.unitHealthLabels.get(unitId);
      if (hpLabel) {
        hpLabel.setAlpha(visible ? 1 : 0);
      }

      const fuelLabel = this.unitFuelLabels.get(unitId);
      if (fuelLabel) {
        fuelLabel.setAlpha(visible ? 1 : 0);
      }
    }
  }

  private actualizarCapaNiebla(): void {
    if (!this.capaNiebla || !this.mascaraVision) {
      return
    }

    const anchoMapa = GameScene.MAP_MAX_X - GameScene.MAP_MIN_X;
    const altoMapa = GameScene.MAP_MAX_Y - GameScene.MAP_MIN_Y;

    // Pintamos la niebla completa
    this.capaNiebla.clear();
    this.capaNiebla.fillStyle(0x000000, GameScene.ALFA_ZONA_NO_VISIBLE);
    this.capaNiebla.fillRect(GameScene.MAP_MIN_X, GameScene.MAP_MIN_Y, anchoMapa, altoMapa);

    // Dibujamos la mascara de vision (se invierte para dejar claro dentro del circulo)
    this.mascaraVision.clear();
    this.mascaraVision.fillStyle(0xffffff, 1);
    const unidadesConVisionPropias = this.obtenerUnidadesConVisionJugador();
    for (const unidadConVision of unidadesConVisionPropias) {
        const rango = this.obtenerRangoVisionUnidad(unidadConVision);
        this.mascaraVision.fillCircle(unidadConVision.x, unidadConVision.y, rango);
    }
  }

  private syncUnitPositions(unitPositions: IUnitPosition[]): void {
    const incomingIds = new Set(unitPositions.map(update => update.unitId));

    // Snapshot autoritativo: si una unidad local no existe en el snapshot, se elimina.
    Array.from(this.unitSprites.keys()).forEach(unitId => {
      if (!incomingIds.has(unitId)) {
        this.removeUnitImmediately(unitId);
      }
    });

    Array.from(this.knownUnits.keys()).forEach(unitId => {
      if (!incomingIds.has(unitId)) {
        this.removeUnitImmediately(unitId);
      }
    });

    // Sincroniza posiciones de todas las unidades con el estado enviado por el servidor
    unitPositions.forEach(update => {
      const unit = this.knownUnits.get(update.unitId);
      const posicionAnteriorX = unit?.x;
      const posicionAnteriorY = unit?.y;
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
        if (typeof posicionAnteriorX === 'number' && typeof posicionAnteriorY === 'number') {
          this.girarSpriteDesdeHasta(
            update.unitId,
            posicionAnteriorX,
            posicionAnteriorY,
            update.position.x,
            update.position.y
          );
        }

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

    const selectedUnitId = this.selectionManager?.getSelectedUnit()?.unitId;
    if (selectedUnitId && !incomingIds.has(selectedUnitId)) {
      this.selectionManager?.deselectUnit();
    }

    this.updateSelectedUnitCoordsText();
    this.actualizarIndicadoresRecarga();
    this.actualizarEstadoBotonRecarga();
    this.actualizarArmamentoUI();
    this.actualizarEstadoBotonMisil();
    this.actualizarEtiquetasUnidadesMapa();
    this.actualizarVisibilidadEnemigos();
    this.actualizarCapaNiebla();

    //Se notifica al panel de altura
    this.emitirActualizacionDeAltura()
  }

  private aplicarLayoutConPaneles(): void {
    const anchoMapa = Math.max(1, this.scale.width);
    const altoMapa = Math.max(1, this.scale.height);
    this.cameras.main.setViewport(0, 0, anchoMapa, altoMapa);
    this.sidebarNecesitaRender = true;
    this.redibujarVistaLateralInferiorFondo();
    this.redibujarVistaLateralInferiorUnidades();
  }

  private obtenerAnchoPanelDrones(): number {
    return Math.floor(this.scale.width * GameScene.PANEL_DRONES_RATIO_ANCHO);
  }

  private obtenerAltoPanelLateral(): number {
    return Math.floor(this.scale.height * GameScene.PANEL_LATERAL_RATIO_ALTO);
  }

  private obtenerAltoMapaVisible(): number {
    return this.scale.height - this.obtenerAltoPanelLateral();
  }

  private pointerEnAreaDeMapa(pointer: Phaser.Input.Pointer): boolean {
    return pointer.x >= this.obtenerAnchoPanelDrones()
      && pointer.y >= 0
      && pointer.y < this.obtenerAltoMapaVisible();
  }

  private pointerEnPanelDrones(pointer: Phaser.Input.Pointer): boolean {
    return pointer.x >= 0
      && pointer.x < this.obtenerAnchoPanelDrones()
      && pointer.y >= 0
      && pointer.y < this.obtenerAltoMapaVisible();
  }

  private seleccionarDesdeClickSidebar(screenX: number, screenY: number): void {
    const unidadesPropias = this.obtenerUnidadesSidebarOrdenadas();
    if (unidadesPropias.length === 0) {
      return;
    }

    const anchoPanel = this.obtenerAnchoPanelDrones();
    const altoPanel = this.obtenerAltoMapaVisible();
    const margen = GameScene.SIDEBAR_MARGEN_INTERNO;
    const cabecera = GameScene.SIDEBAR_ALTO_CABECERA;
    const { ladoCuadro, espacio, offsetY } = this.calcularGridSidebar(unidadesPropias.length, anchoPanel, altoPanel);

    for (let index = 0; index < unidadesPropias.length; index += 1) {
      const unidad = unidadesPropias[index];
      const fila = Math.floor(index / GameScene.SIDEBAR_COLUMNAS);
      const columna = index % GameScene.SIDEBAR_COLUMNAS;
      const xLeft = margen + columna * (ladoCuadro + espacio);
      const yTop = cabecera + margen + offsetY + fila * (ladoCuadro + espacio);
      const dentro = screenX >= xLeft
        && screenX <= (xLeft + ladoCuadro)
        && screenY >= yTop
        && screenY <= (yTop + ladoCuadro);
      if (!dentro) {
        continue;
      }

      if (unidad.health > 0) {
        this.seleccionarUnidadDesdeSidebar(unidad.unitId);
      }
      return;
    }
  }

  private calcularScrollCamaraConPanelIzquierdo(objetivoX: number, objetivoY: number): { scrollX: number; scrollY: number } {
    const camara = this.cameras.main;
    const anchoPanel = this.obtenerAnchoPanelDrones();
    const anchoVisibleMapa = this.scale.width - anchoPanel;
    const altoVisibleMapa = this.obtenerAltoMapaVisible();
    const centroVisibleX = anchoPanel + (anchoVisibleMapa / 2);
    const centroVisibleY = altoVisibleMapa / 2;
    const scrollXDeseado = objetivoX - centroVisibleX;
    const scrollYDeseado = objetivoY - centroVisibleY;

    const anchoMapa = GameScene.MAP_MAX_X - GameScene.MAP_MIN_X;
    const altoMapa = GameScene.MAP_MAX_Y - GameScene.MAP_MIN_Y;
    const maxScrollX = Math.max(GameScene.MAP_MIN_X, GameScene.MAP_MIN_X + anchoMapa - camara.width);
    const maxScrollY = Math.max(GameScene.MAP_MIN_Y, GameScene.MAP_MIN_Y + altoMapa - altoVisibleMapa);

    return {
      scrollX: Phaser.Math.Clamp(scrollXDeseado, GameScene.MAP_MIN_X, maxScrollX),
      scrollY: Phaser.Math.Clamp(scrollYDeseado, GameScene.MAP_MIN_Y, maxScrollY)
    };
  }

  private centrarCamaraConPanelIzquierdo(objetivoX: number, objetivoY: number): void {
    const { scrollX, scrollY } = this.calcularScrollCamaraConPanelIzquierdo(objetivoX, objetivoY);
    this.cameras.main.setScroll(scrollX, scrollY);
  }

  private animarCamaraConPanelIzquierdo(objetivoX: number, objetivoY: number): void {
    const camara = this.cameras.main;
    const { scrollX, scrollY } = this.calcularScrollCamaraConPanelIzquierdo(objetivoX, objetivoY);
    const distancia = Phaser.Math.Distance.Between(camara.scrollX, camara.scrollY, scrollX, scrollY);
    if (distancia < 1) {
      this.tweenCamaraSeleccion?.stop();
      this.tweenCamaraSeleccion = null;
      camara.setScroll(scrollX, scrollY);
      return;
    }

    this.tweenCamaraSeleccion?.stop();
    this.tweenCamaraSeleccion = this.tweens.add({
      targets: camara,
      scrollX,
      scrollY,
      duration: 220,
      ease: 'Sine.Out',
      onComplete: () => {
        this.tweenCamaraSeleccion = null;
      },
      onStop: () => {
        this.tweenCamaraSeleccion = null;
      }
    });
  }

  private removeUnitImmediately(unitId: string): void {
    const sprite = this.unitSprites.get(unitId);
    if (sprite) {
      sprite.container.destroy();
      this.unitSprites.delete(unitId);
    }

    const hpLabel = this.unitHealthLabels.get(unitId);
    if (hpLabel) {
      hpLabel.destroy();
      this.unitHealthLabels.delete(unitId);
    }

    const fuelLabel = this.unitFuelLabels.get(unitId);
    if (fuelLabel) {
      fuelLabel.destroy();
      this.unitFuelLabels.delete(unitId);
    }

    const indicador = this.indicadoresRecarga.get(unitId);
    if (indicador) {
      indicador.destroy();
      this.indicadoresRecarga.delete(unitId);
    }

    this.ammoByUnitId.delete(unitId);
    this.knownUnits.delete(unitId);
    this.playerUnitIds.delete(unitId);

    if (this.selectionManager?.getSelectedUnit()?.unitId === unitId) {
      this.selectionManager.deselectUnit();
    }

    if (this.selectionManager) {
      const actualUnits = this.selectionManager.getPlayerUnits();
      const filteredUnits = actualUnits.filter(unit => unit.unitId !== unitId);
      if (filteredUnits.length !== actualUnits.length) {
        this.selectionManager.setPlayerUnits(filteredUnits);
      }
    }

    this.updateSelectedUnitCoordsText();
    this.actualizarIndicadoresRecarga();
    this.actualizarEstadoBotonRecarga();
    this.actualizarArmamentoUI();
    this.actualizarEstadoBotonMisil();
    this.actualizarVisibilidadEnemigos();
    this.actualizarCapaNiebla();
    this.emitirActualizacionDeAltura();
  }

  private extractServerErrorMessage(errorPayload: unknown): string {
    if (typeof errorPayload === 'string') {
      return errorPayload;
    }

    if (errorPayload && typeof errorPayload === 'object') {
      const payloadObj = errorPayload as { message?: unknown; error?: unknown };
      if (typeof payloadObj.message === 'string') {
        return payloadObj.message;
      }
      if (typeof payloadObj.error === 'string') {
        return payloadObj.error;
      }
    }

    return 'Error del servidor';
  }

  private extractUnitIdFromServerError(errorPayload: unknown): string | null {
    if (!errorPayload || typeof errorPayload !== 'object') {
      return null;
    }

    const payloadObj = errorPayload as { unitId?: unknown; data?: { unitId?: unknown } };
    if (typeof payloadObj.unitId === 'string' && payloadObj.unitId.length > 0) {
      return payloadObj.unitId;
    }

    if (typeof payloadObj.data?.unitId === 'string' && payloadObj.data.unitId.length > 0) {
      return payloadObj.data.unitId;
    }

    return null;
  }

  // ===== METODOS DE CONVERSION MUNDO A PANTALLA =====

  /**
   * Convierte coordenadas del mundo a pantalla, considerando la posición de la cámara
   * La cámara está centrada en el dron seleccionado
   */
  private mundoAPantalla(worldX: number, worldY: number): { x: number; y: number } {
    const camara = this.cameras.main;
    const screenX = worldX - camara.worldView.x + camara.x;
    const screenY = worldY - camara.worldView.y + camara.y;

    return { x: screenX, y: screenY };
  }

  /**
   * Convierte coordenadas de pantalla a mundo, considerando la posición de la cámara
   */
  private pantallaAMundo(screenX: number, screenY: number): { x: number; y: number } {
    const puntoMundo = this.cameras.main.getWorldPoint(screenX, screenY);

    return {
      x: Phaser.Math.Clamp(puntoMundo.x, GameScene.MAP_MIN_X, GameScene.MAP_MAX_X),
      y: Phaser.Math.Clamp(puntoMundo.y, GameScene.MAP_MIN_Y, GameScene.MAP_MAX_Y)
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
    if (this.tweenCamaraSeleccion?.isPlaying()) {
      return;
    }

    const unit = this.knownUnits.get(unidadSeleccionada.unitId) ?? unidadSeleccionada;
    this.centrarCamaraConPanelIzquierdo(unit.x, unit.y);
  }

  private moverCamaraLibreConWASD(): void {
    if (!this.teclaW || !this.teclaA || !this.teclaS || !this.teclaD) {
      return;
    }

    let movimientoX = 0;
    let movimientoY = 0;

    if (this.teclaA.isDown) {
      movimientoX -= GameScene.VELOCIDAD_CAMARA;
    }
    if (this.teclaD.isDown) {
      movimientoX += GameScene.VELOCIDAD_CAMARA;
    }
    if (this.teclaW.isDown) {
      movimientoY -= GameScene.VELOCIDAD_CAMARA;
    }
    if (this.teclaS.isDown) {
      movimientoY += GameScene.VELOCIDAD_CAMARA;
    }

    if (movimientoX === 0 && movimientoY === 0) {
      return;
    }

    const camara = this.cameras.main;
    const anchoMapa = GameScene.MAP_MAX_X - GameScene.MAP_MIN_X;
    const altoMapa = GameScene.MAP_MAX_Y - GameScene.MAP_MIN_Y;
    const altoVisibleMapa = this.obtenerAltoMapaVisible();
    const maxScrollX = Math.max(GameScene.MAP_MIN_X, GameScene.MAP_MIN_X + anchoMapa - camara.width);
    const maxScrollY = Math.max(GameScene.MAP_MIN_Y, GameScene.MAP_MIN_Y + altoMapa - altoVisibleMapa);

    const nuevoScrollX = Phaser.Math.Clamp(camara.scrollX + movimientoX, GameScene.MAP_MIN_X, maxScrollX);
    const nuevoScrollY = Phaser.Math.Clamp(camara.scrollY + movimientoY, GameScene.MAP_MIN_Y, maxScrollY);

    camara.setScroll(nuevoScrollX, nuevoScrollY);
  }

  // Hace que el frente del sprite mire hacia un punto del mapa.
  private girarUnidadHaciaPunto(unidadId: string, objetivoX: number, objetivoY: number): void {
    const unidad = this.knownUnits.get(unidadId);
    const sprite = this.unitSprites.get(unidadId);
    if (!sprite) {
      return;
    }

    const origenX = unidad?.x ?? sprite.container.x;
    const origenY = unidad?.y ?? sprite.container.y;
    this.girarSpriteDesdeHasta(unidadId, origenX, origenY, objetivoX, objetivoY);
  }

  private girarSpriteDesdeHasta(
    unidadId: string,
    origenX: number,
    origenY: number,
    destinoX: number,
    destinoY: number
  ): void {
    const sprite = this.unitSprites.get(unidadId);
    if (!sprite) {
      return;
    }

    const dx = destinoX - origenX;
    const dy = destinoY - origenY;
    if (dx * dx + dy * dy < 0.0001) {
      return;
    }

    const angulo = Phaser.Math.Angle.Between(origenX, origenY, destinoX, destinoY);
    sprite.sprite.setRotation(angulo + GameScene.AJUSTE_ROTACION_FRENTE_RAD);
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

  private actualizarEtiquetasUnidadesMapa(): void {
    const etiquetasPropias = this.obtenerEtiquetasUnidadesPropiasMapa();
    this.unitSprites.forEach((visual, unitId) => {
      const unidad = this.knownUnits.get(unitId);
      if (!unidad) {
        return;
      }
      visual.label.setText(this.obtenerEtiquetaUnidadMapa(unidad, etiquetasPropias));
    });
  }

  private obtenerEtiquetaUnidadMapa(unidad: IUnit, etiquetasPropias?: Map<string, string>): string {
    if (this.esPortadrones(unidad)) {
      return 'Portadron';
    }
    if (!this.esUnidadDron(unidad)) {
      return 'Unidad';
    }
    if (!this.playerUnitIds.has(unidad.unitId)) {
      return 'Dron';
    }

    const etiquetas = etiquetasPropias ?? this.obtenerEtiquetasUnidadesPropiasMapa();
    return etiquetas.get(unidad.unitId) ?? 'Dron';
  }

  private obtenerEtiquetasUnidadesPropiasMapa(): Map<string, string> {
    const unidadesPropias = Array.from(this.knownUnits.values())
      .filter(unidad => this.playerUnitIds.has(unidad.unitId) && (this.esUnidadDron(unidad) || this.esPortadrones(unidad)))
      .sort((a, b) => {
        const prioridad = this.obtenerPrioridadSidebar(a.type) - this.obtenerPrioridadSidebar(b.type);
        if (prioridad !== 0) {
          return prioridad;
        }
        return a.unitId.localeCompare(b.unitId);
      });

    const etiquetas = new Map<string, string>();
    let numeroDron = 1;
    unidadesPropias.forEach(unidad => {
      if (this.esPortadrones(unidad)) {
        etiquetas.set(unidad.unitId, 'Portadron');
      } else {
        etiquetas.set(unidad.unitId, `Dron ${numeroDron}`);
        numeroDron += 1;
      }
    });

    return etiquetas;
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
      'WASD: mover mapa libre | Flechas: mover unidad | Q/E y rueda: altura',
      {fontSize: '14px', color: '#cccccc'}
    ).setScrollFactor(0).setDepth(100);

    this.add.text(
      20,
      this.obtenerAltoMapaVisible() - 40,
      'Connected to the server',
      {fontSize: '12px', color: '#00ff00'}
    ).setScrollFactor(0).setDepth(100);

    this.timerPortadronesTexto = this.add.text(
      this.cameras.main.centerX,
      58,
      '',
      { fontSize: '18px', color: '#ffd166', fontStyle: 'bold', align: 'center' }
    ).setOrigin(0.5).setScrollFactor(0).setDepth(102).setVisible(false);

    this.crearAvisoPausa();
    this.actualizarAvisoPausa();
    this.crearPanelEstadisticasDron();
    this.inicializarVistaLateralInferior();
    this.renderizarSidebarDrones();
  }

  private crearAvisoPausa(): void {
    const centroX = this.cameras.main.centerX;
    const y = 100;

    const fondo = this.add.rectangle(0, 0, 260, 34, 0x000000, 0.7);
    fondo.setStrokeStyle(2, 0xffaa00, 0.9);

    const texto = this.add.text(0, 0, 'PARTIDA PAUSADA', {
      fontSize: '18px',
      color: '#ffdd57',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    this.avisoPausaContenedor = this.add.container(centroX, y, [fondo, texto]);
    this.avisoPausaContenedor.setScrollFactor(0);
    this.avisoPausaContenedor.setDepth(121);
    this.avisoPausaContenedor.setVisible(false);
  }

  private actualizarAvisoPausa(): void {
    if (!this.avisoPausaContenedor) {
      return;
    }

    this.avisoPausaContenedor.setVisible(this.partidaPausada);
  }

  private crearPanelEstadisticasDron(): void {
    const w = this.cameras.main.width;
    const h = this.cameras.main.height;
    const bottomPanelH = Math.floor(h * 0.2);

    const panelWidth = 300;
    const panelHeight = Math.max(110, bottomPanelH - 10);
    const offsetRight = 0;
    const offsetBottom = 0;

    const panelX = w - panelWidth / 2 - offsetRight;
    const panelY = h - bottomPanelH - offsetBottom;

    const container = this.add.container(0, 0);

    const fondo = this.add.rectangle(0, 0, panelWidth, panelHeight, 0x111827, 0.92);
    fondo.setStrokeStyle(2, 0x4b5563, 0.9);

    const titulo = this.add.text(
      -panelWidth / 2 + 10,
      -panelHeight / 2 + 8,
      this.esJugadorUno() ? 'Dron Jugador 1' : 'Dron Jugador 2',
      { fontSize: '13px', color: '#e5e7eb', fontStyle: 'bold' }
    ).setOrigin(0, 0);

    // 1) Etiqueta del dron (arriba en el panel)
    const etiquetaCenterX = 0;
    const etiquetaY = -panelHeight / 2 + 26;

    const etiquetaDron = this.add.text(
      etiquetaCenterX,
      etiquetaY,
      '-',
      { fontSize: '12px', color: '#e5e7eb', align: 'center' }
    ).setOrigin(0.5);

    // 2) "Imagen" del dron justo debajo de la etiqueta
    const imagenCenterX = 0;
    const imagenY = etiquetaY + 28;

    const cuerpoDron = this.add.rectangle(imagenCenterX, imagenY, 64, 40, 0x374151);
    cuerpoDron.setStrokeStyle(2, 0x6b7280, 1);

    // 3) Estadísticas debajo de la imagen
    const textoBaseX = -panelWidth / 2 + 16;
    const textoBaseY = imagenY + 30;

    this.selectedUnitCoordsText = this.add.text(
      textoBaseX,
      textoBaseY,
      'Sin dron seleccionado',
      { fontSize: '12px', color: '#f9fafb' }
    ).setOrigin(0, 0);

    this.selectedUnitArmamentoText = this.add.text(
      textoBaseX,
      textoBaseY + 18,
      'Armamento: -',
      { fontSize: '12px', color: '#d1d5db' }
    ).setOrigin(0, 0);

    this.selectedUnitFuelText = this.add.text(
      textoBaseX,
      textoBaseY + 36,
      'Combustible: -',
      { fontSize: '12px', color: '#d1d5db' }
    ).setOrigin(0, 0);

    container.add([
      fondo,
      titulo,
      cuerpoDron,
      etiquetaDron,
      this.selectedUnitCoordsText,
      this.selectedUnitArmamentoText,
      this.selectedUnitFuelText,
    ]);

    container.setPosition(panelX, panelY);
    container.setScrollFactor(0);
    container.setDepth(100);

    this.statsPanelContainer = container;
    this.statsDroneBody = cuerpoDron;
    this.statsDroneLabel = etiquetaDron;

    this.updateSelectedUnitCoordsText();
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
    // Muestra coordenadas y actualiza panel de la unidad seleccionada
    if (!this.selectedUnitCoordsText || !this.selectedUnitArmamentoText || !this.selectedUnitFuelText) {
      return;
    }

    const selectedUnit = this.selectionManager?.getSelectedUnit();
    if (!selectedUnit) {
      this.selectedUnitCoordsText.setText('Sin dron seleccionado');
      this.selectedUnitArmamentoText.setText('Armamento: -');
      this.selectedUnitFuelText.setText('Combustible: -');

      if (this.statsDroneBody) {
        this.statsDroneBody.setFillStyle(0x374151);
        this.statsDroneBody.setStrokeStyle(2, 0x6b7280, 1);
      }
      if (this.statsDroneLabel) {
        this.statsDroneLabel.setText('-');
        this.statsDroneLabel.setColor('#9ca3af');
      }
      return;
    }

    const unit = this.knownUnits.get(selectedUnit.unitId) ?? selectedUnit;
    const x = unit.x.toFixed(1);
    const y = unit.y.toFixed(1);
    const z = unit.z.toFixed(1);

    this.selectedUnitCoordsText.setText(`Coords: X: ${x}, Y: ${y}, Z: ${z}`);

    const combustible = Math.round(unit.combustible ?? 0);
    this.selectedUnitFuelText.setText(`Combustible: ${combustible}`);

    if (this.statsDroneBody) {
      this.statsDroneBody.setFillStyle(this.getUnitColor(unit.type));
      const esJugador = this.esUnidadDeJugador1(unit.unitId) === this.esJugadorUno();
      const bordeColor = esJugador ? 0x22c55e : 0xef4444;
      this.statsDroneBody.setStrokeStyle(2, bordeColor, 1);
    }
    if (this.statsDroneLabel) {
      this.statsDroneLabel.setText(this.obtenerEtiquetaUnidadMapa(unit));
      this.statsDroneLabel.setColor(unit.health > 0 ? '#f9fafb' : '#6b7280');
    }

    this.updateSelectedUnitArmamentoText();
  }

  private actualizarArmamentoUI(): void {
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
      const esJugadorUno = this.esUnidadDeJugador1(unit.unitId);
      const maxPorDron = esJugadorUno ? GameScene.BOMBAS_POR_DRON : GameScene.MISILES_POR_DRON;
      siguiente.set(unit.unitId, maxPorDron);
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
    // Click derecho en mapa: deselecciona
    // Click izquierdo en mapa: mueve a la unidad seleccionada
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer, gameObjects: Phaser.GameObjects.GameObject[]) => {
      if (this.menuPausaVisible) {
        if (pointer.leftButtonDown()) {
          this.manejarClickMenuPausa(
            pointer.x - this.cameras.main.x,
            pointer.y - this.cameras.main.y
          );
        }
        return;
      }

      if (this.partidaPausada || this.menuPausaVisible || this.partidaFinalizada) {
        return;
      }

      if (this.pointerEnPanelDrones(pointer)) {
        if (pointer.leftButtonDown()) {
          this.seleccionarDesdeClickSidebar(pointer.x, pointer.y);
        }
        return;
      }

      if (!this.pointerEnAreaDeMapa(pointer)) {
        return;
      }

      if (pointer.rightButtonDown()) {
        this.selectionManager?.deselectUnit();
        return;
      }

      if (!pointer.leftButtonDown()) {return}

      // Si hay objetos interactivos debajo, no es un click de mapa
      if (gameObjects && gameObjects.length > 0) {return}

      const unidadSeleccionada = this.selectionManager?.getSelectedUnit();
      if (!unidadSeleccionada) {return}

      // Convertir posición de pantalla a mundo
      const objetivoMundo = this.pantallaAMundo(pointer.x, pointer.y);
      const unidadActual = this.knownUnits.get(unidadSeleccionada.unitId) ?? unidadSeleccionada;
      this.solicitarMovimiento(unidadSeleccionada.unitId, objetivoMundo.x, objetivoMundo.y, unidadActual.z);
    });

    // Rueda para altura: wheel ajusta Z en pasos fijos
    this.input.on('wheel', (_pointer: Phaser.Input.Pointer, _gameObjects: any, _deltaX: number, deltaY: number) => {
      if (this.partidaPausada || this.menuPausaVisible || this.partidaFinalizada) {
        return;
      }

      if (this.pointerEnPanelDrones(_pointer)) {
        if (deltaY === 0) {
          return;
        }
        this.ciclarSeleccionUnidades(deltaY > 0 ? 1 : -1);
        return;
      }

      if (!this.pointerEnAreaDeMapa(_pointer)) {
        return;
      }

      if (!this.websocketClient || !this.selectionManager) {return}

      const unidadSeleccionada = this.selectionManager.getSelectedUnit();
      if (!unidadSeleccionada) {return}

      if (!this.playerUnitIds.has(unidadSeleccionada.unitId)) {return}

      const unidad = this.knownUnits.get(unidadSeleccionada.unitId) ?? unidadSeleccionada
      const deltaZRaw = -deltaY * GameScene.ALTITUDE_SCROLL_FACTOR;
      if (Math.abs(deltaZRaw) < 0.01) {return}

      const deltaZ = Phaser.Math.Clamp(
        deltaZRaw,
        -GameScene.ALTITUDE_SCROLL_MAX_DELTA,
        GameScene.ALTITUDE_SCROLL_MAX_DELTA
      );
      this.solicitarMovimiento(
        unidadSeleccionada.unitId,
        unidad.x,
        unidad.y,
        unidad.z + deltaZ,
        GameScene.ALTITUDE_SCROLL_REPEAT_MS
      );
    });
  }

  private manejarClickMenuPausa(x: number, y: number): void {
    for (const boton of this.botonesMenuPausa) {
      const dentroX = x >= (boton.x - boton.ancho / 2) && x <= (boton.x + boton.ancho / 2);
      const dentroY = y >= (boton.y - boton.alto / 2) && y <= (boton.y + boton.alto / 2);

      if (dentroX && dentroY) {
        boton.accion();
        return;
      }
    }
  }

  private launchBombFromSelectedUnit(): void {
    if (this.partidaPausada || this.menuPausaVisible) {
      return;
    }

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

    const pointer = this.input.activePointer;
    if (pointer && this.pointerEnAreaDeMapa(pointer)) {
      const objetivo = this.pantallaAMundo(pointer.x, pointer.y);
      this.girarUnidadHaciaPunto(selectedUnit.unitId, objetivo.x, objetivo.y);
    }

    this.websocketClient?.requestBombAttack(selectedUnit.unitId);
  }

  private lanzarMisilDesdeSeleccion(): void {
    if (this.partidaPausada || this.menuPausaVisible) {
      return;
    }

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

    const pointer = this.input.activePointer;
    if (!pointer) {
      this.showError('No se pudo leer la posicion del cursor');
      return;
    }

    if (!this.pointerEnAreaDeMapa(pointer)) {
      this.showError('Coloca el cursor sobre el mapa para disparar');
      return;
    }

    const objetivo = this.pantallaAMundo(pointer.x, pointer.y);
    const objetivoX = objetivo.x;
    const objetivoY = objetivo.y;

    this.girarUnidadHaciaPunto(unidadSeleccionada.unitId, objetivoX, objetivoY);
    this.websocketClient.solicitarDisparoMisil(unidadSeleccionada.unitId, objetivoX, objetivoY);
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

    return true;
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
    const unidadDestruida = this.knownUnits.get(unidadId);
    const esPortadronesDestruido = !!unidadDestruida && this.esPortadrones(unidadDestruida);
    const esPortadronesPropio = esPortadronesDestruido && this.playerUnitIds.has(unidadId);

    const esUnidadPropia = this.playerUnitIds.has(unidadId);
    const playerId = this.websocketClient?.getPlayerId();

    if (!esUnidadPropia) {

      if (esPortadronesDestruido) {
        this.playerScore += GameScene.SCORE_CARRIER;
      } else {
        if (playerId === 'player_2') {
          this.playerScore += GameScene.SCORE_DRONE/2;
        } else {
          this.playerScore += GameScene.SCORE_DRONE;
        }

      }
    }

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

    if (esPortadronesDestruido) {
      this.iniciarTimerPortadrones(esPortadronesPropio);
    }
  }

  private solicitarMovimiento(
    unidadId: string,
    objetivoX: number,
    objetivoY: number,
    objetivoZ: number,
    intervaloMinimoMs: number = GameScene.MOVE_REPEAT_MS
  ): void {
    if (this.partidaPausada || this.menuPausaVisible) {
      return;
    }

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

    if (ahoraMs - this.lastMoveRequestAt < intervaloMinimoMs) {
      return;
    }

    // Limites X/Y generales y Z segun jugador
    const maximoZ = this.obtenerMaxZParaJugador();
    const xLimitado = Phaser.Math.Clamp(objetivoX, GameScene.MAP_MIN_X, GameScene.MAP_MAX_X);
    const yLimitado = Phaser.Math.Clamp(objetivoY, GameScene.MAP_MIN_Y, GameScene.MAP_MAX_Y);
    const zLimitado = Phaser.Math.Clamp(objetivoZ, GameScene.MAP_MIN_Z, maximoZ);

    this.girarUnidadHaciaPunto(unidadId, xLimitado, yLimitado);
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
    if (playerId === 'player_2') {
      return GameScene.MAP_MAX_Z_MISILES;
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

  private manejarIngresoNombre(event: KeyboardEvent): void {

    if (!this.capturandoNombre) return;

    const letra = event.key.toUpperCase();

    if (/^[A-Z]$/.test(letra) && this.nombreJugador.length < 3) {
      this.nombreJugador += letra;
    }

    if (event.key === "Backspace") {
      this.nombreJugador = this.nombreJugador.slice(0, -1);
    }

    if (this.textoSiglas) {

      const display = this.nombreJugador
          .padEnd(3, "_")
          .split("")
          .join(" ");

      this.textoSiglas.setText(display);
    }

    if (this.nombreJugador.length === 3) {

      this.capturandoNombre = false;

      this.highScoreManager.saveScore(
          this.nombreJugador,
          this.playerScore
      );

      console.log("Score guardado:", this.nombreJugador, this.playerScore);

      this.time.delayedCall(1000, () => {
        this.scene.start("RankingScene");
      });
    }

  }

  private manejarAccionRecarga(): void {
    if (this.partidaPausada || this.menuPausaVisible) {
      return;
    }

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

  private obtenerUnidadesConVisionJugador(): IUnit[] {
    const unidadesConVision: IUnit[] = [];
    for (const unidad of this.knownUnits.values()) {
      if (!this.playerUnitIds.has(unidad.unitId)) {
        continue;
      }

      if (this.esUnidadDron(unidad) || this.esPortadrones(unidad)) {
        unidadesConVision.push(unidad);
      }
    }

    return unidadesConVision;
  }

  private esUnidadDron(unit: IUnit): boolean {
    return unit.type === 'AERIAL_DRONE' || unit.type === 'NAVAL_DRONE';
  }

  private esPortadrones(unit: IUnit): boolean {
    return unit.type === 'AERIAL_CARRIER' || unit.type === 'NAVAL_CARRIER';
  }

  private crearMenuPausa(): void {
    if (this.menuPausaContenedor) {
      return;
    }

    const anchoPantalla = this.cameras.main.width;
    const altoPantalla = this.cameras.main.height;
    const centroX = anchoPantalla / 2;
    const centroY = altoPantalla / 2;

    const overlay = this.add.rectangle(centroX, centroY, anchoPantalla, altoPantalla, 0x000000, 0.45);

    const panel = this.add.rectangle(centroX, centroY, 380, 330, 0x111827, 0.96);
    panel.setStrokeStyle(2, 0x4b5563, 0.95);
    panel.setInteractive();

    const titulo = this.add.text(centroX, centroY - 125, 'Menu de pausa', {
      fontSize: '24px',
      color: '#f9fafb',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    this.botonesMenuPausa = [];

    const crearBoton = (
      y: number,
      texto: string,
      onClick: () => void
    ): { contenedor: Phaser.GameObjects.Container; texto: Phaser.GameObjects.Text } => {
      const ancho = 280;
      const alto = 44;

      const fondo = this.add.rectangle(0, 0, ancho, alto, 0x1f2937, 1);
      fondo.setStrokeStyle(2, 0x475569, 0.95);
      fondo.setInteractive({ useHandCursor: true });

      const etiqueta = this.add.text(0, 0, texto, {
        fontSize: '16px',
        color: '#e5e7eb',
        fontStyle: 'bold'
      }).setOrigin(0.5);

      const contenedor = this.add.container(centroX, y, [fondo, etiqueta]);

      fondo.on('pointerover', () => {
        fondo.setFillStyle(0x334155, 1);
      });
      fondo.on('pointerout', () => {
        fondo.setFillStyle(0x1f2937, 1);
      });
      fondo.on('pointerdown', () => onClick());

      this.botonesMenuPausa.push({
        x: centroX,
        y,
        ancho,
        alto,
        accion: onClick
      });

      return { contenedor, texto: etiqueta };
    };

    const botonPausa = crearBoton(centroY - 55, 'Pausar partida', () => {
      this.websocketClient?.solicitarPausaPartida(!this.partidaPausada);
    });

    const botonGuardar = crearBoton(centroY - 5, 'Guardar partida', () => {
      this.websocketClient?.solicitarGuardarPartida();
    });

    const botonConfig = crearBoton(centroY + 45, 'Configuracion', () => {
      this.showError('Configuracion pendiente');
    });

    const botonSalir = crearBoton(centroY + 95, 'Salir al menu', () => {
      const confirmar = window.confirm('Seguro que queres salir al menu principal?');
      if (!confirmar) {
        return;
      }

      this.websocketClient?.disconnect();
      window.location.reload();
    });

    this.menuPausaContenedor = this.add.container(0, 0, [
      overlay,
      panel,
      titulo,
      botonPausa.contenedor,
      botonGuardar.contenedor,
      botonConfig.contenedor,
      botonSalir.contenedor
    ]);
    this.menuPausaContenedor.setScrollFactor(0);
    this.menuPausaContenedor.setDepth(120);
    this.menuPausaContenedor.setVisible(false);

    this.menuPausaVisible = false;
    this.textoBotonPausarMenu = botonPausa.texto;
    this.actualizarTextoBotonPausaMenu();
  }

  private alternarMenuPausa(): void {
    if (!this.menuPausaContenedor) {
      return;
    }

    this.menuPausaVisible = !this.menuPausaVisible;
    this.menuPausaContenedor.setVisible(this.menuPausaVisible);
  }

  private actualizarTextoBotonPausaMenu(): void {
    if (!this.textoBotonPausarMenu) {
      return;
    }

    this.textoBotonPausarMenu.setText(this.partidaPausada ? 'Reanudar partida' : 'Pausar partida');
  }

  private mostrarResultadoFinal(payload: IGameEnded): void {
    if (this.partidaFinalizada) return;
    this.partidaFinalizada = true;
    this.timerPortadronesActivo = false;
    this.timerPortadronesDeadlineMs = null;
    this.timerPortadronesTexto?.setVisible(false);

    // Bloquea selección/interacciones
    this.selectionManager?.deselectUnit();
    this.unitSprites.forEach(s => s.sprite.disableInteractive());
    this.botonRecargaContenedor?.disableInteractive();
    this.botonMisilContenedor?.disableInteractive();

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

    const textoIngresar = this.add.text(w / 2, h / 2 + 60, "INGRESA TUS SIGLAS:", {
      fontSize: "28px",
      color: "#ffffff"
    }).setOrigin(0.5);

    this.textoSiglas = this.add.text(w / 2, h / 2 + 100, "_ _ _", {
      fontSize: "40px",
      color: "#6aff00"
    }).setOrigin(0.5);

    this.nombreJugador = "";
    this.capturandoNombre = true;

    this.panelResultado = this.add.container(0, 0, [fondo, titulo, detalle, textoIngresar,
      this.textoSiglas]).setScrollFactor(0).setDepth(101);
  }

  private textoRazonFin(reason: IGameEnded['reason']): string {

    const razones: Record<string, string> = {
      ALL_UNITS_DESTROYED: 'Todas las unidades de un equipo fueron destruidas.',
      CARRIER_DESTROYED_AND_NO_RESOURCES: 'Portadrones destruido y unidades restantes sin combustible o munición.',
      CARRIER_DESTROYED_TIMEOUT_DRAW: 'Portadrones destruido.'
    };
    if (!reason) return 'Fin de partida';
    return razones[reason] ?? `Fin de partida(${reason})`;
  }

  private limpiarSidebarElementos(): void {
    this.sidebarElementos.forEach(elemento => elemento.destroy());
    this.sidebarElementos = [];
  }

  private limpiarSidebarUI(): void {
    this.limpiarSidebarElementos();
    this.sidebarUnidadesPorId.clear();
    this.sidebarUnidades = [];
    this.sidebarMezclaAlertaPorUnidad.clear();
    this.sidebarUnidadSeleccionadaId = null;
    this.sidebarNecesitaRender = true;
  }

  private actualizarSidebarUnidades(unidadesActualizadas: ISideViewUnit[]): void {
    const idsPropiosActualizados = new Set<string>();

    unidadesActualizadas.forEach(unidad => {
      if (!unidad.isPlayerUnit || !this.esUnidadRenderizableSidebar(unidad.type)) {
        return;
      }

      idsPropiosActualizados.add(unidad.unitId);
      this.sidebarUnidadesPorId.set(unidad.unitId, {
        ...this.sidebarUnidadesPorId.get(unidad.unitId),
        ...unidad
      });
      if (!this.sidebarMezclaAlertaPorUnidad.has(unidad.unitId)) {
        this.sidebarMezclaAlertaPorUnidad.set(unidad.unitId, unidad.tieneEnemigoEnVision === true ? 1 : 0);
      }
    });

    this.sidebarUnidadesPorId.forEach((unidadGuardada, unitId) => {
      if (!idsPropiosActualizados.has(unitId)) {
        this.sidebarUnidadesPorId.set(unitId, {
          ...unidadGuardada,
          health: 0,
          tieneEnemigoEnVision: false
        });
        this.sidebarMezclaAlertaPorUnidad.set(unitId, 0);
      }
    });

    this.sidebarUnidades = Array.from(this.sidebarUnidadesPorId.values());
    this.sidebarNecesitaRender = true;
  }

  private actualizarLerpSidebar(delta: number): boolean {
    let huboCambios = false;
    const factor = Math.min(1, Math.max(0.01, delta * GameScene.SIDEBAR_FACTOR_LERP_ALERTA));

    this.sidebarUnidades.forEach(unidad => {
      if (!unidad.isPlayerUnit || !this.esUnidadRenderizableSidebar(unidad.type)) {
        return;
      }

      const objetivo = unidad.health > 0 && unidad.tieneEnemigoEnVision === true ? 1 : 0;
      const actual = this.sidebarMezclaAlertaPorUnidad.get(unidad.unitId) ?? objetivo;
      const interpolado = Phaser.Math.Linear(actual, objetivo, factor);
      const siguiente = Math.abs(interpolado - objetivo) < 0.01 ? objetivo : interpolado;

      if (Math.abs(siguiente - actual) > 0.001) {
        this.sidebarMezclaAlertaPorUnidad.set(unidad.unitId, siguiente);
        huboCambios = true;
      }
    });

    return huboCambios;
  }

  private renderizarSidebarDrones(): void {
    this.limpiarSidebarElementos();

    const anchoPanel = this.obtenerAnchoPanelDrones();
    const altoPanel = this.obtenerAltoMapaVisible();
    const margen = GameScene.SIDEBAR_MARGEN_INTERNO;
    const cabecera = GameScene.SIDEBAR_ALTO_CABECERA;

    const titulo = this.add.text(margen, margen, 'Mis unidades', {
      fontSize: '20px',
      color: '#f8fafc',
      fontStyle: 'bold'
    });
    titulo.setScrollFactor(0).setDepth(132);
    this.sidebarElementos.push(titulo);

    const unidadesPropias = this.obtenerUnidadesSidebarOrdenadas();

    if (unidadesPropias.length === 0) {
      const vacio = this.add.text(margen, cabecera + margen, 'Aun no hay unidades disponibles.', {
        fontSize: '13px',
        color: '#94a3b8'
      });
      vacio.setScrollFactor(0).setDepth(132);
      this.sidebarElementos.push(vacio);
      this.sidebarNecesitaRender = false;
      return;
    }

    const etiquetasSidebar = this.obtenerEtiquetasSidebarPorUnidad(unidadesPropias);
    const { ladoCuadro, espacio, offsetY } = this.calcularGridSidebar(unidadesPropias.length, anchoPanel, altoPanel);
    const fuenteEtiqueta = ladoCuadro >= 74 ? '14px' : ladoCuadro >= 52 ? '12px' : ladoCuadro >= 36 ? '10px' : '9px';

    unidadesPropias.forEach((unidad, index) => {
      const fila = Math.floor(index / GameScene.SIDEBAR_COLUMNAS);
      const columna = index % GameScene.SIDEBAR_COLUMNAS;
      const xLeft = margen + columna * (ladoCuadro + espacio);
      const yTop = cabecera + margen + offsetY + fila * (ladoCuadro + espacio);
      const centroX = xLeft + (ladoCuadro / 2);
      const habilitada = unidad.health > 0;
      const mezclaAlerta = habilitada ? (this.sidebarMezclaAlertaPorUnidad.get(unidad.unitId) ?? 0) : 0;

      const colorFondo = habilitada
        ? this.lerpColorEnteroSidebar(GameScene.SIDEBAR_COLOR_FONDO_NORMAL, GameScene.SIDEBAR_COLOR_FONDO_ALERTA, mezclaAlerta)
        : GameScene.SIDEBAR_COLOR_FONDO_DESTRUIDA;
      const colorBorde = habilitada
        ? this.lerpColorEnteroSidebar(GameScene.SIDEBAR_COLOR_BORDE_NORMAL, GameScene.SIDEBAR_COLOR_BORDE_ALERTA, mezclaAlerta)
        : GameScene.SIDEBAR_COLOR_BORDE_DESTRUIDA;
      const colorDetalle = habilitada
        ? this.lerpColorEnteroSidebar(GameScene.SIDEBAR_COLOR_DETALLE_NORMAL, GameScene.SIDEBAR_COLOR_DETALLE_ALERTA, mezclaAlerta)
        : GameScene.SIDEBAR_COLOR_DETALLE_DESTRUIDA;
      const esSeleccionada = this.sidebarUnidadSeleccionadaId === unidad.unitId;

      const tarjeta = this.add.rectangle(centroX, yTop + (ladoCuadro / 2), ladoCuadro, ladoCuadro, colorFondo, 0.97);
      tarjeta.setStrokeStyle(esSeleccionada ? 3 : 2, esSeleccionada ? 0xfff06a : colorBorde, 1);
      tarjeta.setScrollFactor(0).setDepth(132);
      this.sidebarElementos.push(tarjeta);

      const etiquetaTarjeta = this.add.text(centroX, yTop + (ladoCuadro / 2), etiquetasSidebar.get(unidad.unitId) ?? `Dron ${index + 1}`, {
        fontSize: fuenteEtiqueta,
        color: this.colorNumeroAHexSidebar(colorDetalle),
        fontStyle: 'bold',
        align: 'center'
      }).setOrigin(0.5).setScrollFactor(0).setDepth(133);
      this.sidebarElementos.push(etiquetaTarjeta);
    });

    this.sidebarNecesitaRender = false;
  }

  private calcularGridSidebar(cantidadUnidades: number, anchoPanel: number, altoPanel: number): { ladoCuadro: number; espacio: number; filas: number; offsetY: number } {
    const filas = Math.max(1, Math.ceil(cantidadUnidades / GameScene.SIDEBAR_COLUMNAS));
    const espacio = GameScene.SIDEBAR_ESPACIO_GRID;
    const anchoDisponible = Math.max(1, anchoPanel - GameScene.SIDEBAR_MARGEN_INTERNO * 2);
    const altoDisponible = Math.max(1, altoPanel - GameScene.SIDEBAR_ALTO_CABECERA - GameScene.SIDEBAR_MARGEN_INTERNO);

    const ladoPorAncho = Math.floor((anchoDisponible - (GameScene.SIDEBAR_COLUMNAS - 1) * espacio) / GameScene.SIDEBAR_COLUMNAS);
    const ladoPorAlto = Math.floor((altoDisponible - (filas - 1) * espacio) / filas);
    const ladoCuadro = Math.max(1, Math.min(GameScene.SIDEBAR_LADO_CUADRO_BASE, ladoPorAncho, ladoPorAlto));

    const altoBloque = filas * ladoCuadro + Math.max(0, filas - 1) * espacio;
    const offsetY = Math.max(0, Math.floor((altoDisponible - altoBloque) / 8));

    return { ladoCuadro, espacio, filas, offsetY };
  }

  private obtenerUnidadesSidebarOrdenadas(): ISideViewUnit[] {
    return this.sidebarUnidades
      .filter(unidad => unidad.isPlayerUnit && this.esUnidadRenderizableSidebar(unidad.type))
      .sort((a, b) => {
        const prioridad = this.obtenerPrioridadSidebar(a.type) - this.obtenerPrioridadSidebar(b.type);
        if (prioridad !== 0) {
          return prioridad;
        }
        return a.unitId.localeCompare(b.unitId);
      });
  }

  private obtenerEtiquetasSidebarPorUnidad(unidades: ISideViewUnit[]): Map<string, string> {
    const etiquetas = new Map<string, string>();
    let numeroDron = 1;

    unidades.forEach(unidad => {
      if (this.esPortadronSidebar(unidad.type)) {
        etiquetas.set(unidad.unitId, 'Portadron');
        return;
      }
      etiquetas.set(unidad.unitId, `Dron ${numeroDron}`);
      numeroDron += 1;
    });

    return etiquetas;
  }

  private lerpColorEnteroSidebar(colorDesde: number, colorHasta: number, factor: number): number {
    const desdeR = (colorDesde >> 16) & 0xff;
    const desdeG = (colorDesde >> 8) & 0xff;
    const desdeB = colorDesde & 0xff;
    const hastaR = (colorHasta >> 16) & 0xff;
    const hastaG = (colorHasta >> 8) & 0xff;
    const hastaB = colorHasta & 0xff;

    const r = Math.round(Phaser.Math.Linear(desdeR, hastaR, factor));
    const g = Math.round(Phaser.Math.Linear(desdeG, hastaG, factor));
    const b = Math.round(Phaser.Math.Linear(desdeB, hastaB, factor));

    return (r << 16) | (g << 8) | b;
  }

  private colorNumeroAHexSidebar(color: number): string {
    return `#${color.toString(16).padStart(6, '0')}`;
  }

  private esUnidadRenderizableSidebar(tipo: string): boolean {
    return tipo === 'AERIAL_DRONE'
      || tipo === 'NAVAL_DRONE'
      || tipo === 'AERIAL_CARRIER'
      || tipo === 'NAVAL_CARRIER';
  }

  private esPortadronSidebar(tipo: string): boolean {
    return tipo === 'AERIAL_CARRIER' || tipo === 'NAVAL_CARRIER';
  }

  private obtenerPrioridadSidebar(tipo: string): number {
    switch (tipo) {
      case 'AERIAL_CARRIER':
        return 0;
      case 'NAVAL_CARRIER':
        return 1;
      case 'AERIAL_DRONE':
        return 2;
      case 'NAVAL_DRONE':
        return 3;
      default:
        return 4;
    }
  }

  private inicializarVistaLateralInferior(): void {
    if (!this.vistaLateralInferiorGraphics) {
      this.vistaLateralInferiorGraphics = this.add.graphics();
      this.vistaLateralInferiorGraphics.setScrollFactor(0).setDepth(118);
    }

    this.redibujarVistaLateralInferiorFondo();
    this.redibujarVistaLateralInferiorUnidades();
  }

  private limpiarVistaLateralInferiorUI(): void {
    this.vistaLateralInferiorPuntos.forEach(contenedor => contenedor.destroy());
    this.vistaLateralInferiorPuntos.clear();
    this.vistaLateralInferiorEtiquetasAltitud.forEach(etiqueta => etiqueta.destroy());
    this.vistaLateralInferiorEtiquetasAltitud = [];
    this.vistaLateralInferiorGraphics?.destroy();
    this.vistaLateralInferiorGraphics = null;
    this.vistaLateralInferiorUnidades = [];
  }

  private redibujarVistaLateralInferiorFondo(): void {
    if (!this.vistaLateralInferiorGraphics) {
      return;
    }

    const g = this.vistaLateralInferiorGraphics;
    const panelX = 0;
    const panelY = this.obtenerAltoMapaVisible();
    const panelW = this.scale.width;
    const panelH = this.obtenerAltoPanelLateral();
    const padding = GameScene.PANEL_INFERIOR_PADDING;

    g.clear();

    this.vistaLateralInferiorEtiquetasAltitud.forEach(etiqueta => etiqueta.destroy());
    this.vistaLateralInferiorEtiquetasAltitud = [];

    g.fillStyle(0x0d1b2a, 1);
    g.fillRect(panelX, panelY, panelW, panelH);

    g.lineStyle(1, 0x334455, 0.8);
    g.lineBetween(panelX + padding, panelY + panelH - padding, panelX + panelW - padding, panelY + panelH - padding);

    g.lineStyle(1, 0x223344, 0.5);
    for (let z = 0; z <= GameScene.MAP_MAX_Z; z += 2) {
      const screenY = this.zVistaLateralInferiorAPantalla(z, panelY, panelH, padding);
      g.lineBetween(panelX + padding, screenY, panelX + panelW - padding, screenY);

      if (z % 5 === 0) {
        const etiqueta = this.add.text(panelX + 2, screenY - 6, `z=${z}`, {
          fontSize: '9px',
          color: '#556677'
        });
        etiqueta.setScrollFactor(0).setDepth(119);
        this.vistaLateralInferiorEtiquetasAltitud.push(etiqueta);
      }
    }
  }

  private redibujarVistaLateralInferiorUnidades(): void {
    const panelY = this.obtenerAltoMapaVisible();
    const panelW = this.scale.width;
    const panelH = this.obtenerAltoPanelLateral();
    const padding = GameScene.PANEL_INFERIOR_PADDING;
    const etiquetasPropias = this.obtenerEtiquetasVistaLateralInferiorPorUnidad(
      this.vistaLateralInferiorUnidades
        .filter(unidad => unidad.isPlayerUnit && this.esUnidadRenderizableSidebar(unidad.type))
        .sort((a, b) => {
          const prioridad = this.obtenerPrioridadSidebar(a.type) - this.obtenerPrioridadSidebar(b.type);
          if (prioridad !== 0) {
            return prioridad;
          }
          return a.unitId.localeCompare(b.unitId);
        })
    );

    this.vistaLateralInferiorPuntos.forEach(contenedor => contenedor.destroy());
    this.vistaLateralInferiorPuntos.clear();

    this.vistaLateralInferiorUnidades.forEach(unidad => {
      if (!this.esUnidadRenderizableSidebar(unidad.type)) {
        return;
      }
      if (!unidad.isPlayerUnit && !unidad.esVisible) {
        return;
      }

      const screenX = this.xVistaLateralInferiorAPantalla(unidad.x, panelW, padding);
      const screenY = this.zVistaLateralInferiorAPantalla(unidad.z, panelY, panelH, padding);
      const color = this.colorVistaLateralInferiorUnidad(unidad.type, unidad.isPlayerUnit, unidad.health);
      const esPortadron = this.esPortadronSidebar(unidad.type);

      const figuraUnidad = esPortadron
        ? this.add.rectangle(0, 0, 12, 12, color)
        : this.add.circle(0, 0, 6, color);
      figuraUnidad.setStrokeStyle(esPortadron ? 2 : 1, unidad.isPlayerUnit ? 0x00ff88 : 0xff4444);

      const label = this.add.text(0, -14, unidad.isPlayerUnit ? (etiquetasPropias.get(unidad.unitId) ?? '?') : 'E', {
        fontSize: '9px',
        color: unidad.health <= 0 ? '#666666' : '#ffffff'
      }).setOrigin(0.5);

      const container = this.add.container(screenX, screenY, [figuraUnidad, label]);
      container.setScrollFactor(0).setDepth(119);
      this.vistaLateralInferiorPuntos.set(unidad.unitId, container);
    });
  }

  private obtenerEtiquetasVistaLateralInferiorPorUnidad(unidades: ISideViewUnit[]): Map<string, string> {
    const etiquetas = new Map<string, string>();
    let numeroDron = 1;

    unidades.forEach(unidad => {
      if (this.esPortadronSidebar(unidad.type)) {
        etiquetas.set(unidad.unitId, 'P');
        return;
      }
      etiquetas.set(unidad.unitId, `${numeroDron}`);
      numeroDron += 1;
    });

    return etiquetas;
  }

  private xVistaLateralInferiorAPantalla(worldX: number, panelW: number, padding: number): number {
    const usableW = Math.max(1, panelW - padding * 2);
    return padding + (worldX / GameScene.MAP_MAX_X) * usableW;
  }

  private zVistaLateralInferiorAPantalla(worldZ: number, panelY: number, panelH: number, padding: number): number {
    const usableH = Math.max(1, panelH - padding * 2);
    return (panelY + panelH - padding) - (worldZ / GameScene.MAP_MAX_Z) * usableH;
  }

  private colorVistaLateralInferiorUnidad(tipo: string, esJugador: boolean, salud: number): number {
    if (salud <= 0) {
      return 0x444444;
    }
    const colores: Record<string, number> = {
      AERIAL_DRONE: esJugador ? 0xff6666 : 0xff2222,
      NAVAL_DRONE: esJugador ? 0x6688ff : 0x2244ff,
      AERIAL_CARRIER: esJugador ? 0xffe066 : 0xffb703,
      NAVAL_CARRIER: esJugador ? 0x72efdd : 0x00b4d8
    };
    return colores[tipo] ?? 0xffffff;
  }

  private actualizarVistaLateralInferiorUnidades(unidades: ISideViewUnit[]): void {
    this.vistaLateralInferiorUnidades = unidades;
    this.redibujarVistaLateralInferiorUnidades();
  }

  private iniciarTimerPortadrones(portadronesPropioDestruido: boolean): void {
    if (this.timerPortadronesActivo || this.partidaFinalizada) {
      return;
    }

    this.timerPortadronesActivo = true;
    this.timerPortadronesDeadlineMs = Date.now() + GameScene.CUENTA_REGRESIVA_PORTADRONES_MS;
    this.timerPortadronesObjetivoTexto = portadronesPropioDestruido
      ? 'Tu portadrones fue destruido. Tienes'
      : 'Portadrones enemigo destruido. El rival tiene';
    this.timerPortadronesTexto?.setVisible(true);
    this.actualizarTimerPortadrones();
  }

  private actualizarTimerPortadrones(): void {
    if (!this.timerPortadronesActivo || !this.timerPortadronesTexto || !this.timerPortadronesDeadlineMs) {
      return;
    }

    const restanteMs = Math.max(0, this.timerPortadronesDeadlineMs - Date.now());
    const restanteSegundos = Math.ceil(restanteMs / 1000);
    const minutos = Math.floor(restanteSegundos / 60);
    const segundos = restanteSegundos % 60;
    const reloj = `${String(minutos).padStart(2, '0')}:${String(segundos).padStart(2, '0')}`;

    this.timerPortadronesTexto.setText(
      `${this.timerPortadronesObjetivoTexto} ${reloj} para destruir el portadrones contrario.`
    );

    if (restanteMs <= 0) {
      this.timerPortadronesActivo = false;
    }
  }

  private emitirActualizacionDeAltura(): void {
    const unidadesConEnemigoEnVision = this.obtenerUnidadesConEnemigoEnVision();
    const unidades: ISideViewUnit[] = Array.from(this.knownUnits.values()).map(unidad => ({
      unitId: unidad.unitId,
      x: unidad.x,
      y: unidad.y,
      z: unidad.z,
      type: unidad.type,
      isPlayerUnit: this.playerUnitIds.has(unidad.unitId),
      health: unidad.health,
      combustible: unidad.combustible,
      tieneEnemigoEnVision: unidadesConEnemigoEnVision.has(unidad.unitId),
      esVisible: this.playerUnitIds.has(unidad.unitId)
        ? true
        : this.esVisibleParaDronesPropios(unidad),
    }));
    this.actualizarSidebarUnidades(unidades);
    this.actualizarVistaLateralInferiorUnidades(unidades);
  }

  private obtenerUnidadesConEnemigoEnVision(): Set<string> {
    const unidadesConVision = new Set<string>();
    const enemigosDetectables = Array.from(this.knownUnits.values()).filter(unidad =>
      !this.playerUnitIds.has(unidad.unitId) &&
      (this.esUnidadDron(unidad) || this.esPortadrones(unidad)) &&
      unidad.health > 0
    );

    for (const unidad of this.knownUnits.values()) {
      if (!this.playerUnitIds.has(unidad.unitId)) {
        continue;
      }
      if ((!this.esUnidadDron(unidad) && !this.esPortadrones(unidad)) || unidad.health <= 0) {
        continue;
      }

      const rango = this.obtenerRangoVisionUnidad(unidad);
      const rango2 = rango * rango;

      for (const enemigo of enemigosDetectables) {
        const dx = unidad.x - enemigo.x;
        const dy = unidad.y - enemigo.y;
        if ((dx * dx + dy * dy) <= rango2) {
          unidadesConVision.add(unidad.unitId);
          break;
        }
      }
    }

    return unidadesConVision;
  }

  private esVisibleParaDronesPropios(unidadEnemiga: IUnit): boolean {
    const unidadesConVisionPropias = this.obtenerUnidadesConVisionJugador();

    for (const unidadConVision of unidadesConVisionPropias) {
      const dx = unidadConVision.x - unidadEnemiga.x;
      const dy = unidadConVision.y - unidadEnemiga.y;
      const rango = this.obtenerRangoVisionUnidad(unidadConVision);
      const distancia2 = dx * dx + dy * dy;

      if (distancia2 <= rango * rango) {
        return true;
      }
    }

    return false;
  }
}
