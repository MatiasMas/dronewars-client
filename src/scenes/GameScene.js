import { WebSocketClient } from "../network/WebSocketClient";
import { SelectionManager } from "../managers/SelectionManager";
import { AnimationManager } from "../managers/AnimationManager";
import { ClientInternalEvents, ServerToClientEvents } from "../types/CommunicationEvents";
import { UnitType } from "../types/UnitType";
export class GameScene extends Phaser.Scene {
    websocketClient = null;
    selectionManager = null;
    unitSprites = new Map();
    knownUnits = new Map();
    playerUnitIds = new Set();
    indicadoresRecarga = new Map();
    teclaW = null;
    teclaA = null;
    teclaS = null;
    teclaD = null;
    teclaQ = null;
    teclaE = null;
    flechas = null;
    unidadArrastradaId = null;
    lastMoveRequestAt = 0;
    availablePlayers = [];
    bombSprites = new Map();
    spritesMisiles = new Map();
    posicionesMisiles = new Map();
    unitHealthLabels = new Map();
    unitFuelLabels = new Map();
    selectedUnitCoordsText = null;
    selectedUnitArmamentoText = null;
    selectedUnitFuelText = null;
    statsPanelContainer = null;
    statsDroneBody = null;
    statsDroneLabel = null;
    armamentoPlayerText = null;
    armamentoEnemyText = null;
    ammoByUnitId = new Map();
    botonRecargaContenedor = null;
    textoBotonRecarga = null;
    fondoBotonRecarga = null;
    botonMisilContenedor = null;
    textoBotonMisil = null;
    fondoBotonMisil = null;
    partidaFinalizada = false;
    panelResultado = null;
    avisoPausaContenedor = null;
    /** Centrar cámara en este punto en el próximo frame (al recibir unidades). */
    pendingCameraCenter = null;
    // Límites del mapa (mundo grande; el viewport solo muestra una parte y sigue a la unidad seleccionada)
    static MAP_MIN_X = 0;
    static MAP_MAX_X = 6700;
    static MAP_MIN_Y = 0;
    static MAP_MAX_Y = 2500;
    static MAP_MIN_Z = 0;
    static MAP_MAX_Z = 10;
    static MAP_MAX_Z_MISILES = 8;
    static MAP_MAX_Z_BONUS_FACTOR = 1.005;
    static MOVE_STEP = 5;
    static ALTITUDE_STEP = 0.5;
    static ALTITUDE_SCROLL_FACTOR = 0.01;
    static ALTITUDE_SCROLL_MAX_DELTA = 0.6;
    static ALTITUDE_SCROLL_REPEAT_MS = 45;
    static MOVE_REPEAT_MS = 120;
    static VELOCIDAD_CAMARA = 10;
    static AJUSTE_ROTACION_FRENTE_RAD = 0;
    static RANGO_RECARGA_MUNDO = 120;
    static RANGO_DISPARO_MISIL = 30;
    static BOMBAS_POR_DRON = 1;
    static MISILES_POR_DRON = 2;
    //Visibilidad
    static RANGO_VISION_BOMBAS = 400;
    static RANGO_VISION_MISILES = GameScene.RANGO_VISION_BOMBAS * 0.5;
    static FACTOR_VISION_MIN_Z = 0.7;
    static FACTOR_VISION_MAX_Z = 1.3;
    static ALFA_ZONA_NO_VISIBLE = 0.35;
    capaNiebla = null;
    mascaraVision = null;
    //Pausa
    partidaPausada = false;
    menuPausaVisible = false;
    menuPausaContenedor = null;
    textoBotonPausarMenu = null;
    botonesMenuPausa = [];
    constructor() {
        super('GameScene');
    }
    preload() {
        this.load.image('ocean', 'images/ocean.png');
        AnimationManager.preload(this);
    }
    async create() {
        console.log("[GameScene] Creating scene...");
        AnimationManager.createAnimations(this);
        // Creando imagen de background
        const background = this.add.image(GameScene.MAP_MAX_X / 2, GameScene.MAP_MAX_Y / 2, 'ocean');
        background.setDepth(-2);
        background.setScale((GameScene.MAP_MAX_X) / background.width, (GameScene.MAP_MAX_Y) / background.height);
        //Creando capa "niebla"
        this.capaNiebla = this.add.graphics();
        this.capaNiebla.setDepth(5);
        this.mascaraVision = this.add.graphics();
        this.mascaraVision.setVisible(false);
        const mascara = new Phaser.Display.Masks.GeometryMask(this, this.mascaraVision);
        mascara.setInvertAlpha(true);
        this.capaNiebla.setMask(mascara);
        // Mundo más grande que el viewport: la cámara solo puede desplazarse dentro del mapa
        this.cameras.main.setBounds(GameScene.MAP_MIN_X, GameScene.MAP_MIN_Y, GameScene.MAP_MAX_X - GameScene.MAP_MIN_X, GameScene.MAP_MAX_Y - GameScene.MAP_MIN_Y);
        // Limitar el viewport de la cámara principal al 80% superior
        const panelH = Math.floor(this.scale.height * 0.2);
        this.cameras.main.setViewport(0, 0, this.scale.width, this.scale.height - panelH);
        //Lanzamos panel de altura en pantalla
        this.scene.launch('SideViewScene');
        this.websocketClient = new WebSocketClient();
        try {
            // Configurando escuchas del websocket
            await this.websocketClient.connect();
        }
        catch (err) {
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
    }
    configurarDisparoConEspacio() {
        if (!this.input.keyboard) {
            return;
        }
        this.input.keyboard.on("keydown-SPACE", (evento) => {
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
    configurarDeseleccionConEscape() {
        if (!this.input.keyboard) {
            return;
        }
        this.input.keyboard.on("keydown-ESC", (evento) => {
            if (evento.repeat)
                return;
            this.alternarMenuPausa();
        });
    }
    async waitForAvailablePlayers() {
        return new Promise(resolve => {
            const timeout = setTimeout(() => {
                console.warn("[GameScene] Available players timed out");
                resolve();
            }, 3000);
            this.websocketClient?.on(ServerToClientEvents.AVAILABLE_PLAYERS, (players) => {
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
    selectFirstAvailablePlayer() {
        const availablePlayer = this.availablePlayers.find(player => player.available);
        if (availablePlayer) {
            console.log(`[GameScene] Selecting player: ${availablePlayer.playerName}]`);
            return availablePlayer.playerId;
        }
        return null;
    }
    async waitForPlayerRegistration() {
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
    setupEventListeners() {
        if (!this.websocketClient || !this.selectionManager)
            return;
        // El servidor devuelve la lista de unidades del jugador
        this.websocketClient.on(ServerToClientEvents.UNITS_RECEIVED, (data) => {
            const playerUnits = data?.playerUnits ?? data?.player_units ?? [];
            const enemyUnits = data?.enemyUnits ?? data?.enemy_units ?? [];
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
        this.websocketClient.on(ServerToClientEvents.GAME_PAUSE_UPDATED, (payload) => {
            const paused = payload?.paused;
            const pausada = payload?.pausada;
            this.partidaPausada = paused === true || pausada === true;
            this.actualizarTextoBotonPausaMenu();
            this.actualizarAvisoPausa();
            this.actualizarEstadoBotonRecarga();
            this.actualizarEstadoBotonMisil();
        });
        this.websocketClient.on(ServerToClientEvents.SAVE_GAME_RESULT, (payload) => {
            const ok = payload?.ok === true;
            const message = typeof payload?.message === 'string'
                ? payload.message
                : (ok ? 'Partida guardada' : 'No se pudo guardar la partida');
            this.showError(message);
        });
        this.selectionManager.on(ClientInternalEvents.SELECTION_CLEARED, () => {
            this.clearSelectionHighlight();
            this.updateSelectedUnitCoordsText();
        });
        // El servidor confirma la seleccion de unidad
        this.websocketClient.on(ServerToClientEvents.UNIT_SELECTED, (unit) => {
            console.log(`[GameScene] Selection confirmed: ${unit.unitId}`);
            this.selectionManager?.confirmSelection(unit);
            this.highlightUnit(unit.unitId);
            this.updateSelectedUnitCoordsText();
        });
        // Hubo un error en el servidor
        this.websocketClient.on(ServerToClientEvents.SERVER_ERROR, (errorMessage) => {
            console.error(`[GameScene] Server error: ${errorMessage}`);
            this.showError(errorMessage);
        });
        this.websocketClient.on(ServerToClientEvents.MOVE_ACCEPTED, (unitId) => {
            console.log(`[GameScene] Move accepted: ${unitId}`);
        });
        this.websocketClient.on(ServerToClientEvents.GAME_STATE_UPDATE, (unitPositions) => {
            this.syncUnitPositions(unitPositions);
        });
        this.websocketClient.on(ServerToClientEvents.MUNICION_RECARGADA, (payload) => {
            this.procesarMunicionRecargada(payload);
        });
        this.selectionManager.on(ClientInternalEvents.SELECTION_CHANGED, (unit) => {
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
        this.websocketClient.on(ServerToClientEvents.BOMB_LAUNCHED, (payload) => {
            this.handleBombLaunched(payload);
        });
        this.websocketClient.on(ServerToClientEvents.BOMB_EXPLODED, (payload) => {
            this.handleBombExploded(payload);
        });
        this.websocketClient.on(ServerToClientEvents.MISIL_DISPARADO, (payload) => {
            this.manejarMisilDisparado(payload);
        });
        this.websocketClient.on(ServerToClientEvents.MISIL_ACTUALIZADO, (payload) => {
            this.manejarMisilActualizado(payload);
        });
        this.websocketClient.on(ServerToClientEvents.MISIL_IMPACTADO, (payload) => {
            this.manejarMisilImpactado(payload);
        });
        this.websocketClient.on(ServerToClientEvents.GAME_ENDED, (payload) => {
            this.mostrarResultadoFinal(payload);
        });
    }
    update(_time) {
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
        if (this.partidaPausada || this.menuPausaVisible) {
            return;
        }
        if (!this.websocketClient ||
            !this.selectionManager ||
            !this.teclaW ||
            !this.teclaA ||
            !this.teclaS ||
            !this.teclaD ||
            !this.teclaQ ||
            !this.teclaE ||
            !this.flechas) {
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
    renderUnits(playerUnits, enemyUnits) {
        // Render inicial de unidades con posiciones del servidor
        this.clearUnitSprites();
        this.limpiarIndicadoresRecarga();
        playerUnits.forEach(unit => {
            this.createUnitSprite(unit, unit.x, unit.y, true); // true = unidad propia
        });
        enemyUnits.forEach(unit => {
            this.createUnitSprite(unit, unit.x, unit.y, false); // false = unidad enemiga
        });
        this.emitirActualizacionDeAltura();
        this.actualizarVisibilidadEnemigos();
        this.actualizarCapaNiebla();
        console.log(`[GameScene] ${playerUnits.length} player units and ${enemyUnits.length} enemy units rendered`);
    }
    createUnitSprite(unit, x, y, isPlayerUnit) {
        // x, y = coordenadas MUNDO. El container va en (x,y); los hijos en posiciones RELATIVAS al container (0,0), (0,20)...
        const esUnidadJugadorUno = this.esUnidadDeJugador1(unit.unitId);
        const esDron = this.esUnidadDron(unit);
        const esCarrier = this.esPortadrones(unit);
        let animKey;
        let textureKey;
        if (esDron) {
            if (esUnidadJugadorUno) {
                animKey = AnimationManager.KEYS.droneChinoMCenital;
                textureKey = "droneChinoMovCenital";
            }
            else {
                animKey = AnimationManager.KEYS.dronePortuguesMCenital;
                textureKey = "dronePortuguesMovCenital";
            }
        }
        else if (esCarrier) {
            if (esUnidadJugadorUno) {
                animKey = AnimationManager.KEYS.carrierChinoMCenital;
                textureKey = "carrierChinoMovCenital";
            }
            else {
                animKey = AnimationManager.KEYS.carrierPortuguesMCenital;
                textureKey = "carrierPortuguesMovCenital";
            }
        }
        else {
            // Fallback muy raro: tipo desconocido, usar un rectángulo simple
            const fallbackBody = this.add.rectangle(0, 0, 60, 60, this.getUnitColor(unit.type));
            fallbackBody.setInteractive({ useHandCursor: true });
            const fallbackLabel = this.add.text(0, 0, this.getUnitLabel(unit.type), {
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
            fallbackBody.on('pointerdown', (pointer) => {
                if (this.partidaPausada || this.menuPausaVisible || this.partidaFinalizada) {
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
            this.unitSprites.set(unit.unitId, { container: fallbackContainer, sprite: fallbackBody, label: fallbackLabel });
            return;
        }
        const sprite = this.add.sprite(0, 0, textureKey, 0);
        sprite.setOrigin(0.5);
        sprite.setInteractive({ useHandCursor: true });
        sprite.play(animKey);
        const label = this.add.text(0, -36, this.getUnitLabel(unit.type), {
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
        if (unit.health <= 0) {
            sprite.setTint(0x666666);
            sprite.disableInteractive();
        }
        this.unitHealthLabels.set(unit.unitId, hpText);
        this.unitFuelLabels.set(unit.unitId, fuelText);
        sprite.on('pointerdown', (pointer) => {
            if (this.partidaPausada || this.menuPausaVisible || this.partidaFinalizada) {
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
    clearSelectionHighlight() {
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
    highlightUnit(unitId) {
        this.unitSprites.forEach(sprite => {
            sprite.sprite.setTint(0x888888);
        });
        const selectedSprite = this.unitSprites.get(unitId);
        if (selectedSprite) {
            selectedSprite.sprite.setTint(0xffff00);
        }
    }
    clearUnitSprites() {
        this.unitSprites.forEach(sprite => sprite.container.destroy());
        this.unitSprites.clear();
        this.unitHealthLabels.forEach(label => label.destroy());
        this.unitHealthLabels.clear();
        this.unitFuelLabels.forEach(label => label.destroy());
        this.unitFuelLabels.clear();
    }
    limpiarIndicadoresRecarga() {
        this.indicadoresRecarga.forEach(indicador => indicador.destroy());
        this.indicadoresRecarga.clear();
    }
    obtenerRangoVisionUnidad(unidad) {
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
    actualizarVisibilidadEnemigos() {
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
    actualizarCapaNiebla() {
        if (!this.capaNiebla || !this.mascaraVision) {
            return;
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
    syncUnitPositions(unitPositions) {
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
                    this.girarSpriteDesdeHasta(update.unitId, posicionAnteriorX, posicionAnteriorY, update.position.x, update.position.y);
                }
                // Las coordenadas son del MUNDO, Phaser las renderizará según la cámara
                sprite.container.setPosition(update.position.x, update.position.y);
                if (typeof update.combustible === 'number') {
                    const fuelLabel = this.unitFuelLabels.get(update.unitId);
                    if (fuelLabel) {
                        fuelLabel.setText(`FUEL:${Math.round(update.combustible)}`);
                    }
                }
            }
            else if (unit) {
                // Si no existe el sprite, crear uno nuevo
                this.createUnitSprite(unit, update.position.x, update.position.y, this.playerUnitIds.has(update.unitId));
            }
        });
        this.updateSelectedUnitCoordsText();
        this.actualizarIndicadoresRecarga();
        this.actualizarEstadoBotonRecarga();
        this.actualizarArmamentoUI();
        this.actualizarEstadoBotonMisil();
        this.actualizarVisibilidadEnemigos();
        this.actualizarCapaNiebla();
        //Se notifica al panel de altura
        this.emitirActualizacionDeAltura();
    }
    // ===== METODOS DE CONVERSION MUNDO A PANTALLA =====
    /**
     * Convierte coordenadas del mundo a pantalla, considerando la posición de la cámara
     * La cámara está centrada en el dron seleccionado
     */
    mundoAPantalla(worldX, worldY) {
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
    pantallaAMundo(screenX, screenY) {
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
    radioMundoAPantalla(worldRadius) {
        // Escala basada en el ancho visible
        const worldWidth = GameScene.MAP_MAX_X - GameScene.MAP_MIN_X;
        const screenWidth = this.cameras.main.width;
        return (worldRadius / worldWidth) * screenWidth;
    }
    /**
     * Actualiza la posición de la cámara para seguir la unidad seleccionada.
     * El viewport muestra solo una parte del mapa; la cámara se desplaza con la unidad.
     */
    actualizarCamara() {
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
    moverCamaraLibreConWASD() {
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
        const maxScrollX = Math.max(GameScene.MAP_MIN_X, GameScene.MAP_MIN_X + anchoMapa - camara.width);
        const maxScrollY = Math.max(GameScene.MAP_MIN_Y, GameScene.MAP_MIN_Y + altoMapa - camara.height);
        const nuevoScrollX = Phaser.Math.Clamp(camara.scrollX + movimientoX, GameScene.MAP_MIN_X, maxScrollX);
        const nuevoScrollY = Phaser.Math.Clamp(camara.scrollY + movimientoY, GameScene.MAP_MIN_Y, maxScrollY);
        camara.setScroll(nuevoScrollX, nuevoScrollY);
    }
    // Hace que el frente del sprite mire hacia un punto del mapa.
    girarUnidadHaciaPunto(unidadId, objetivoX, objetivoY) {
        const unidad = this.knownUnits.get(unidadId);
        const sprite = this.unitSprites.get(unidadId);
        if (!sprite) {
            return;
        }
        const origenX = unidad?.x ?? sprite.container.x;
        const origenY = unidad?.y ?? sprite.container.y;
        this.girarSpriteDesdeHasta(unidadId, origenX, origenY, objetivoX, objetivoY);
    }
    girarSpriteDesdeHasta(unidadId, origenX, origenY, destinoX, destinoY) {
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
    centrarCamaraEnPortadrones(playerUnits) {
        if (!playerUnits?.length)
            return;
        const playerId = this.websocketClient?.getPlayerId();
        const tipoCarrierStr = playerId === 'player_1' ? 'AERIAL_CARRIER' : 'NAVAL_CARRIER';
        const portadrones = playerUnits.find(u => String(u?.type) === tipoCarrierStr);
        const objetivo = portadrones ?? playerUnits[0];
        if (!objetivo || typeof objetivo.x !== 'number' || typeof objetivo.y !== 'number')
            return;
        this.pendingCameraCenter = { x: objetivo.x, y: objetivo.y };
        console.log(`[GameScene] Will center camera on carrier/unit at (${objetivo.x}, ${objetivo.y}), type=${objetivo.type}`);
    }
    getUnitColor(type) {
        const colors = {
            'AERIAL_DRONE': 0xff0000,
            'NAVAL_DRONE': 0x0000ff,
            'AERIAL_CARRIER': 0xffff00,
            'NAVAL_CARRIER': 0x00ff00
        };
        return colors[type] || 0xffffff;
    }
    getUnitLabel(type) {
        const labels = {
            'AERIAL_DRONE': 'A.D',
            'NAVAL_DRONE': 'N.D',
            'AERIAL_CARRIER': 'A.C',
            'NAVAL_CARRIER': 'N.C'
        };
        return labels[type] || '?';
    }
    showError(message) {
        const texto = this.add.text(this.cameras.main.centerX, this.cameras.main.centerY, 'Error: ' + message, { fontSize: '20px', color: '#ff0000' }).setOrigin(0.5).setScrollFactor(0).setDepth(101);
        setTimeout(() => {
            texto.destroy();
        }, 1500);
    }
    drawUI() {
        // Borde del mapa (visual, sigue la cámara)
        const graphics = this.add.graphics({ x: 0, y: 0 });
        graphics.lineStyle(2, 0x00ff00, 0.5);
        graphics.strokeRect(GameScene.MAP_MIN_X, GameScene.MAP_MIN_Y, GameScene.MAP_MAX_X - GameScene.MAP_MIN_X, GameScene.MAP_MAX_Y - GameScene.MAP_MIN_Y);
        // ===== UI FIJA EN PANTALLA (no sigue cámara) =====
        const titulo = this.add.text(this.cameras.main.centerX, 30, 'DroneWars', { fontSize: '24px', color: '#00ff00', fontStyle: 'bold' }).setOrigin(0.5).setScrollFactor(0);
        titulo.setDepth(100);
        this.add.text(20, 70, 'WASD: mover mapa libre | Flechas: mover unidad | Q/E y rueda: altura', { fontSize: '14px', color: '#cccccc' }).setScrollFactor(0).setDepth(100);
        this.add.text(20, this.cameras.main.height - 40, 'Connected to the server', { fontSize: '12px', color: '#00ff00' }).setScrollFactor(0).setDepth(100);
        this.crearAvisoPausa();
        this.crearPanelEstadisticasDron();
    }
    crearAvisoPausa() {
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
    actualizarAvisoPausa() {
        if (!this.avisoPausaContenedor) {
            return;
        }
        this.avisoPausaContenedor.setVisible(this.partidaPausada);
    }
    crearPanelEstadisticasDron() {
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
        const titulo = this.add.text(-panelWidth / 2 + 10, -panelHeight / 2 + 8, this.esJugadorUno() ? 'Dron Jugador 1' : 'Dron Jugador 2', { fontSize: '13px', color: '#e5e7eb', fontStyle: 'bold' }).setOrigin(0, 0);
        // 1) Etiqueta del dron (arriba en el panel)
        const etiquetaCenterX = 0;
        const etiquetaY = -panelHeight / 2 + 26;
        const etiquetaDron = this.add.text(etiquetaCenterX, etiquetaY, '-', { fontSize: '12px', color: '#e5e7eb', align: 'center' }).setOrigin(0.5);
        // 2) "Imagen" del dron justo debajo de la etiqueta
        const imagenCenterX = 0;
        const imagenY = etiquetaY + 28;
        const cuerpoDron = this.add.rectangle(imagenCenterX, imagenY, 64, 40, 0x374151);
        cuerpoDron.setStrokeStyle(2, 0x6b7280, 1);
        // 3) Estadísticas debajo de la imagen
        const textoBaseX = -panelWidth / 2 + 16;
        const textoBaseY = imagenY + 30;
        this.selectedUnitCoordsText = this.add.text(textoBaseX, textoBaseY, 'Sin dron seleccionado', { fontSize: '12px', color: '#f9fafb' }).setOrigin(0, 0);
        this.selectedUnitArmamentoText = this.add.text(textoBaseX, textoBaseY + 18, 'Armamento: -', { fontSize: '12px', color: '#d1d5db' }).setOrigin(0, 0);
        this.selectedUnitFuelText = this.add.text(textoBaseX, textoBaseY + 36, 'Combustible: -', { fontSize: '12px', color: '#d1d5db' }).setOrigin(0, 0);
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
    crearBotonRecarga() {
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
    updateSelectedUnitCoordsText() {
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
            this.statsDroneLabel.setText(this.getUnitLabel(unit.type));
            this.statsDroneLabel.setColor(unit.health > 0 ? '#f9fafb' : '#6b7280');
        }
        this.updateSelectedUnitArmamentoText();
    }
    actualizarArmamentoUI() {
        this.updateSelectedUnitArmamentoText();
    }
    updateSelectedUnitArmamentoText() {
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
    calcularArmamentoPorJugador(jugador) {
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
    esJugadorUno() {
        const playerId = this.websocketClient?.getPlayerId();
        if (!playerId) {
            return true;
        }
        return playerId === 'player_1';
    }
    esUnidadDeJugador1(unitId) {
        const localEsJugadorUno = this.esJugadorUno();
        const esUnidadPropia = this.playerUnitIds.has(unitId);
        return localEsJugadorUno ? esUnidadPropia : !esUnidadPropia;
    }
    sincronizarMunicionInicial(units) {
        const siguiente = new Map();
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
    procesarMunicionRecargada(payload) {
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
    setupPointerControls() {
        // Click derecho en mapa: deselecciona
        // Click izquierdo en mapa: mueve a la unidad seleccionada
        this.input.on('pointerdown', (pointer, gameObjects) => {
            if (this.menuPausaVisible) {
                if (pointer.leftButtonDown()) {
                    this.manejarClickMenuPausa(pointer.x, pointer.y);
                }
                return;
            }
            if (this.partidaPausada || this.menuPausaVisible || this.partidaFinalizada) {
                return;
            }
            if (pointer.y >= this.scale.height * 0.8) {
                return;
            }
            if (pointer.rightButtonDown()) {
                this.selectionManager?.deselectUnit();
                return;
            }
            if (!pointer.leftButtonDown()) {
                return;
            }
            // Si hay objetos interactivos debajo, no es un click de mapa
            if (gameObjects && gameObjects.length > 0) {
                return;
            }
            const unidadSeleccionada = this.selectionManager?.getSelectedUnit();
            if (!unidadSeleccionada) {
                return;
            }
            // Convertir posición de pantalla a mundo
            const objetivoMundo = this.pantallaAMundo(pointer.x, pointer.y);
            const unidadActual = this.knownUnits.get(unidadSeleccionada.unitId) ?? unidadSeleccionada;
            this.solicitarMovimiento(unidadSeleccionada.unitId, objetivoMundo.x, objetivoMundo.y, unidadActual.z);
        });
        // Rueda para altura: wheel ajusta Z en pasos fijos
        this.input.on('wheel', (_pointer, _gameObjects, _deltaX, deltaY) => {
            if (this.partidaPausada || this.menuPausaVisible || this.partidaFinalizada) {
                return;
            }
            if (_pointer.y >= this.scale.height * 0.8) {
                return;
            }
            if (!this.websocketClient || !this.selectionManager) {
                return;
            }
            const unidadSeleccionada = this.selectionManager.getSelectedUnit();
            if (!unidadSeleccionada) {
                return;
            }
            if (!this.playerUnitIds.has(unidadSeleccionada.unitId)) {
                return;
            }
            const unidad = this.knownUnits.get(unidadSeleccionada.unitId) ?? unidadSeleccionada;
            const deltaZRaw = -deltaY * GameScene.ALTITUDE_SCROLL_FACTOR;
            if (Math.abs(deltaZRaw) < 0.01) {
                return;
            }
            const deltaZ = Phaser.Math.Clamp(deltaZRaw, -GameScene.ALTITUDE_SCROLL_MAX_DELTA, GameScene.ALTITUDE_SCROLL_MAX_DELTA);
            this.solicitarMovimiento(unidadSeleccionada.unitId, unidad.x, unidad.y, unidad.z + deltaZ, GameScene.ALTITUDE_SCROLL_REPEAT_MS);
        });
    }
    manejarClickMenuPausa(x, y) {
        for (const boton of this.botonesMenuPausa) {
            const dentroX = x >= (boton.x - boton.ancho / 2) && x <= (boton.x + boton.ancho / 2);
            const dentroY = y >= (boton.y - boton.alto / 2) && y <= (boton.y + boton.alto / 2);
            if (dentroX && dentroY) {
                boton.accion();
                return;
            }
        }
    }
    launchBombFromSelectedUnit() {
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
        if (pointer && pointer.y < this.scale.height * 0.8) {
            const objetivo = this.pantallaAMundo(pointer.x, pointer.y);
            this.girarUnidadHaciaPunto(selectedUnit.unitId, objetivo.x, objetivo.y);
        }
        this.websocketClient?.requestBombAttack(selectedUnit.unitId);
    }
    lanzarMisilDesdeSeleccion() {
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
        if (pointer.y >= this.scale.height * 0.8) {
            this.showError('Coloca el cursor sobre el mapa para disparar');
            return;
        }
        const objetivo = this.pantallaAMundo(pointer.x, pointer.y);
        const objetivoX = objetivo.x;
        const objetivoY = objetivo.y;
        this.girarUnidadHaciaPunto(unidadSeleccionada.unitId, objetivoX, objetivoY);
        this.websocketClient.solicitarDisparoMisil(unidadSeleccionada.unitId, objetivoX, objetivoY);
    }
    actualizarEstadoBotonMisil() {
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
        }
        else {
            this.botonMisilContenedor.setAlpha(0.6);
            this.textoBotonMisil.setColor('#7a7a7a');
            this.fondoBotonMisil.setFillStyle(0x2a2f35, 1);
            this.fondoBotonMisil.setStrokeStyle(2, 0x4c4c4c, 0.8);
        }
    }
    puedeDispararMisil() {
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
    handleBombLaunched(datosBomba) {
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
    handleBombExploded(datosExplosion) {
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
    manejarMisilDisparado(datosMisil) {
        // Dibuja el misil en el mapa en coordenadas mundo (scroll con la cámara)
        const spriteMisil = this.add.ellipse(datosMisil.x, datosMisil.y, 10, 6, 0x00bcd4);
        spriteMisil.setStrokeStyle(1, 0xffffff);
        spriteMisil.setDepth(5);
        this.spritesMisiles.set(datosMisil.misilId, spriteMisil);
        this.posicionesMisiles.set(datosMisil.misilId, { x: datosMisil.x, y: datosMisil.y });
        // Soportamos el nombre correcto del payload y el anterior por compatibilidad.
        const idUnidad = datosMisil.unidadAtaqueId ?? datosMisil.unidadAtacanteId;
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
    manejarMisilActualizado(datosMisil) {
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
    manejarMisilImpactado(datosImpacto) {
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
    eliminarUnidadDelMapa(unidadId, tipoAtaque) {
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
    solicitarMovimiento(unidadId, objetivoX, objetivoY, objetivoZ, intervaloMinimoMs = GameScene.MOVE_REPEAT_MS) {
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
    obtenerAhoraMs() {
        if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
            return performance.now();
        }
        return Date.now();
    }
    obtenerMaxZParaJugador() {
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
    actualizarIndicadoresRecarga() {
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
    actualizarEstadoBotonRecarga() {
        if (!this.botonRecargaContenedor || !this.textoBotonRecarga || !this.fondoBotonRecarga) {
            return;
        }
        const puedeRecargar = this.puedeRecargarDronSeleccionado();
        if (puedeRecargar) {
            this.botonRecargaContenedor.setAlpha(1);
            this.textoBotonRecarga.setColor('#ffffff');
            this.fondoBotonRecarga.setFillStyle(0x2f7a2f, 0.9);
            this.fondoBotonRecarga.setStrokeStyle(2, 0x7dff7d, 0.9);
        }
        else {
            this.botonRecargaContenedor.setAlpha(0.6);
            this.textoBotonRecarga.setColor('#7a7a7a');
            this.fondoBotonRecarga.setFillStyle(0x2a2f35, 1);
            this.fondoBotonRecarga.setStrokeStyle(2, 0x4c4c4c, 0.8);
        }
    }
    manejarAccionRecarga() {
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
    puedeRecargarDronSeleccionado() {
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
    buscarPortadronesCercanoId(dron) {
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
    obtenerDronesJugador() {
        const drones = [];
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
    obtenerUnidadesConVisionJugador() {
        const unidadesConVision = [];
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
    esUnidadDron(unit) {
        return unit.type === 'AERIAL_DRONE' || unit.type === 'NAVAL_DRONE';
    }
    esPortadrones(unit) {
        return unit.type === 'AERIAL_CARRIER' || unit.type === 'NAVAL_CARRIER';
    }
    crearMenuPausa() {
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
        const crearBoton = (y, texto, onClick) => {
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
    alternarMenuPausa() {
        if (!this.menuPausaContenedor) {
            return;
        }
        this.menuPausaVisible = !this.menuPausaVisible;
        this.menuPausaContenedor.setVisible(this.menuPausaVisible);
    }
    actualizarTextoBotonPausaMenu() {
        if (!this.textoBotonPausarMenu) {
            return;
        }
        this.textoBotonPausarMenu.setText(this.partidaPausada ? 'Reanudar partida' : 'Pausar partida');
    }
    mostrarResultadoFinal(payload) {
        if (this.partidaFinalizada)
            return;
        this.partidaFinalizada = true;
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
        this.panelResultado = this.add.container(0, 0, [fondo, titulo, detalle]).setScrollFactor(0).setDepth(101);
    }
    textoRazonFin(reason) {
        if (reason === 'ALL_UNITS_DESTROYED') {
            return 'Todas las unidades de un equipo fueron destruidas.';
        }
        if (reason === 'CARRIER_DESTROYED_AND_NO_RESOURCES') {
            return 'Portadrones destruido y unidades restantes sin combustible o munición.';
        }
        return 'Portadrones destruido y no se destruyó el rival en 2 minutos.';
    }
    emitirActualizacionDeAltura() {
        const unidades = Array.from(this.knownUnits.values()).map(unidad => ({
            unitId: unidad.unitId,
            x: unidad.x,
            z: unidad.z,
            type: unidad.type,
            isPlayerUnit: this.playerUnitIds.has(unidad.unitId),
            health: unidad.health,
            esVisible: this.playerUnitIds.has(unidad.unitId)
                ? true
                : this.esVisibleParaDronesPropios(unidad),
        }));
        this.game.events.emit('altura-unidades-actualizada', unidades);
    }
    esVisibleParaDronesPropios(unidadEnemiga) {
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
