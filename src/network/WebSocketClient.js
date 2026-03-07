// Un callback de evento es una funcion que se ejecuta cuando se recibe un evento especifico
import { ClientInternalEvents, ClientToServerEvents, ServerToClientEvents } from "../types/CommunicationEvents";
export class WebSocketClient {
    socket = null;
    url;
    playerId = null;
    eventListeners = new Map();
    isConnected = false;
    constructor(url = 'ws://192.168.1.17:8081/game') {
        this.url = url;
    }
    // Conecta con el servidor y define eventos de conexion
    async connect() {
        return new Promise((resolve, reject) => {
            try {
                this.socket = new WebSocket(this.url);
                this.socket.onopen = () => {
                    console.log("[WebSocket] Connected to server");
                    this.isConnected = true;
                    this.emit(ClientInternalEvents.CONNECTED);
                    resolve();
                };
                this.socket.onclose = () => {
                    console.log("[WebSocket] Disconnected from server");
                    this.isConnected = false;
                    this.emit(ClientInternalEvents.DISCONNECTED);
                };
                this.socket.onerror = (error) => {
                    console.error("[WebSocket] Error:", error);
                    this.isConnected = false;
                    this.emit(ClientInternalEvents.CONNECTION_ERROR, error);
                };
                this.socket.onmessage = (event) => {
                    this.handleMessage(event.data);
                };
            }
            catch (err) {
                reject(err);
            }
        });
    }
    /*
    * Registra un jugador en el servidor
    * Mensaje: ClientToServerEvents.REGISTER_PLAYER
    */
    registerPlayer(playerId) {
        this.playerId = playerId;
        this.send({
            type: ClientToServerEvents.REGISTER_PLAYER,
            playerId: playerId
        });
    }
    /*
    * Solicita las unidades del jugador al servidor
    * Mensaje: ClientToServerEvents.GET_PLAYER_UNITS
    */
    requestPlayerUnits() {
        this.send({
            type: ClientToServerEvents.GET_PLAYER_UNITS
        });
    }
    /*
    * Solicita seleccion de unidad al servidor (validando que el jugador pueda seleccionarla)
    * Mensaje: ClientToServerEvents.SELECT_UNIT
    */
    requestUnitSelection(unitId) {
        this.send({
            type: ClientToServerEvents.SELECT_UNIT,
            unitId: unitId
        });
    }
    /*
    * Solicita movimiento de unidad al servidor
    * Mensaje: ClientToServerEvents.MOVE_UNIT
    */
    solicitarMovimientoUnidad(unidadId, objetivoX, objetivoY, objetivoZ) {
        // Envia MOVE_UNIT exacto y targetZ solo si viene definido
        this.send({
            type: 'MOVE_UNIT',
            unitId: unidadId,
            targetX: objetivoX,
            targetY: objetivoY,
            ...(objetivoZ !== undefined ? { targetZ: objetivoZ } : {})
        });
    }
    /*
    * Solicita recarga de municion al servidor
    * Mensaje: ClientToServerEvents.RELOAD_AMMO
    */
    solicitarRecargaMunicion(unidadId, portadronesId) {
        this.send({
            type: 'RELOAD_AMMO',
            unitId: unidadId,
            ...(portadronesId ? { carrierId: portadronesId } : {})
        });
    }
    /*
    * Asigna un EventCallback segun el evento recibido
    */
    on(event, callback) {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, []);
        }
        this.eventListeners.get(event)?.push(callback);
    }
    isConnectedToServer() {
        return this.isConnected;
    }
    getPlayerId() {
        return this.playerId;
    }
    disconnect() {
        if (this.socket) {
            this.socket.close();
            this.isConnected = false;
        }
    }
    /*
    * Envia un mensaje al servidor con el contenido provisto
    */
    send(message) {
        if (!this.isConnected) {
            console.log("[WebSocket] Cannot send message, not connected to server");
            return;
        }
        if (message && typeof message.type === 'string') {
            // Normaliza el type por seguridad ante espacios
            message.type = message.type.trim().replace(/\s+/g, '_');
        }
        try {
            this.socket?.send(JSON.stringify(message));
        }
        catch (err) {
            console.log("[WebSocket] Error sending message:", err);
        }
    }
    /*
    * Solicita ataque con bomba al servidor
    * Mensaje: ClientToServerEvents.LAUNCH_BOMB
    */
    requestBombAttack(idUnidad) {
        this.send({
            type: ClientToServerEvents.LAUNCH_BOMB,
            unitId: idUnidad
        });
    }
    /*
    * Solicita disparo de misil al servidor
    * Mensaje: ClientToServerEvents.LAUNCH_MISSILE
    */
    solicitarDisparoMisil(idUnidad, objetivoX, objetivoY) {
        this.send({
            type: ClientToServerEvents.LAUNCH_MISSILE,
            unitId: idUnidad,
            targetX: objetivoX,
            targetY: objetivoY
        });
    }
    /*
    * Solicita pausa al servidor
    */
    solicitarPausaPartida(pausada) {
        this.send({
            type: ClientToServerEvents.SET_GAME_PAUSED,
            paused: pausada,
        });
    }
    solicitarGuardarPartida() {
        this.send({
            type: ClientToServerEvents.REQUEST_SAVE_GAME,
        });
    }
    /*
    * Maneja los mensajes recibidos del servidor
    * Parsea el mensaje y emite el evento a los clientes
    */
    handleMessage(eventData) {
        try {
            const data = JSON.parse(eventData);
            // Si tiene type y es AVAILABLE_PLAYERS, el servidor envia la lista de jugadores disponibles
            if (data.type === ServerToClientEvents.AVAILABLE_PLAYERS) {
                this.emit(ServerToClientEvents.AVAILABLE_PLAYERS, data.payload);
                return;
            }
            if (data.type === ServerToClientEvents.UNITS_RECEIVED) {
                this.emit(ServerToClientEvents.UNITS_RECEIVED, data.payload);
                return;
            }
            if (data.type === ServerToClientEvents.UNIT_SELECTED) {
                this.emit(ServerToClientEvents.UNIT_SELECTED, data.payload);
                return;
            }
            if (data.type === ServerToClientEvents.MOVE_ACCEPTED) {
                this.emit(ServerToClientEvents.MOVE_ACCEPTED, data.payload);
                return;
            }
            if (data.type === ServerToClientEvents.GAME_STATE_UPDATE) {
                this.emit(ServerToClientEvents.GAME_STATE_UPDATE, data.payload);
                return;
            }
            if (data.type === ServerToClientEvents.MUNICION_RECARGADA) {
                this.emit(ServerToClientEvents.MUNICION_RECARGADA, data.payload);
                return;
            }
            // Primero eventos de bombas para que la UI actualice al instante.
            if (data.type === ServerToClientEvents.BOMB_LAUNCHED) {
                this.emit(ServerToClientEvents.BOMB_LAUNCHED, data.payload);
                return;
            }
            if (data.type === ServerToClientEvents.BOMB_EXPLODED) {
                this.emit(ServerToClientEvents.BOMB_EXPLODED, data.payload);
                return;
            }
            if (data.type === ServerToClientEvents.MISIL_DISPARADO) {
                this.emit(ServerToClientEvents.MISIL_DISPARADO, data.payload);
                return;
            }
            if (data.type === ServerToClientEvents.MISIL_ACTUALIZADO) {
                this.emit(ServerToClientEvents.MISIL_ACTUALIZADO, data.payload);
                return;
            }
            if (data.type === ServerToClientEvents.MISIL_IMPACTADO) {
                this.emit(ServerToClientEvents.MISIL_IMPACTADO, data.payload);
                return;
            }
            // Si data es un error, el servidor devolvio un error
            if (data.type === ServerToClientEvents.SERVER_ERROR) {
                this.emit(ServerToClientEvents.SERVER_ERROR, data.payload);
                return;
            }
            // Si no coincide con nada, envia el tipo recibido a los escuchas
            if (data.type) {
                this.emit(data.type, data);
            }
            if (data.type === ServerToClientEvents.GAME_ENDED) {
                this.emit(ServerToClientEvents.GAME_ENDED, data.payload);
                return;
            }
            if (data.type === ServerToClientEvents.GAME_PAUSE_UPDATED) {
                this.emit(ServerToClientEvents.GAME_PAUSE_UPDATED, data.payload);
                return;
            }
            if (data.type === ServerToClientEvents.SAVE_GAME_RESULT) {
                this.emit(ServerToClientEvents.SAVE_GAME_RESULT, data.payload);
                return;
            }
        }
        catch (err) {
            console.log("[WebSocket] Error parsing message:", err);
        }
    }
    /*
    * Recibe un evento
    */
    emit(event, data) {
        const callbacks = this.eventListeners.get(event);
        if (callbacks) {
            callbacks.forEach(callback => callback(data));
        }
    }
}
