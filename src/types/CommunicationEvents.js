/*
 * CommunicationEvents define todos los eventos transmitidos entre cliente y servidor.
 * Los clientes envian un evento; el servidor lo procesa con el nombre usado aqui.
 *
 * ServerToClient: cuando el servidor envia un evento al cliente
 * ClientToServer: cuando el cliente envia un evento al servidor
 */
export var ClientToServerEvents;
(function (ClientToServerEvents) {
    ClientToServerEvents["REGISTER_PLAYER"] = "REGISTER_PLAYER";
    ClientToServerEvents["GET_PLAYER_UNITS"] = "GET_PLAYER_UNITS";
    ClientToServerEvents["SELECT_UNIT"] = "SELECT_UNIT";
    // MOVE_UNIT: movimiento validado por servidor
    ClientToServerEvents["MOVE_UNIT"] = "MOVE_UNIT";
    // RELOAD_AMMO: recarga de municion validada por servidor
    // En el futuro, los eventos de movimiento o ataques deberian ir aqui
    ClientToServerEvents["RELOAD_AMMO"] = "RELOAD_AMMO";
    ClientToServerEvents["LAUNCH_BOMB"] = "LAUNCH_BOMB";
    ClientToServerEvents["LAUNCH_MISSILE"] = "LAUNCH_MISSILE";
    //MENU DE PAUSA
    ClientToServerEvents["SET_GAME_PAUSED"] = "SET_GAME_PAUSED";
    ClientToServerEvents["REQUEST_SAVE_GAME"] = "REQUEST_SAVE_GAME";
})(ClientToServerEvents || (ClientToServerEvents = {}));
export var ServerToClientEvents;
(function (ServerToClientEvents) {
    ServerToClientEvents["PLAYER_REGISTERED"] = "PLAYER_REGISTERED";
    ServerToClientEvents["UNITS_RECEIVED"] = "UNITS_RECEIVED";
    ServerToClientEvents["UNIT_SELECTED"] = "UNIT_SELECTED";
    ServerToClientEvents["SERVER_ERROR"] = "SERVER_ERROR";
    ServerToClientEvents["AVAILABLE_PLAYERS"] = "AVAILABLE_PLAYERS";
    ServerToClientEvents["MOVE_ACCEPTED"] = "MOVE_ACCEPTED";
    ServerToClientEvents["GAME_STATE_UPDATE"] = "GAME_STATE_UPDATE";
    ServerToClientEvents["BOMB_LAUNCHED"] = "BOMB_LAUNCHED";
    ServerToClientEvents["BOMB_EXPLODED"] = "BOMB_EXPLODED";
    ServerToClientEvents["MISIL_DISPARADO"] = "MISIL_DISPARADO";
    ServerToClientEvents["MISIL_IMPACTADO"] = "MISIL_IMPACTADO";
    ServerToClientEvents["MISIL_ACTUALIZADO"] = "MISIL_ACTUALIZADO";
    ServerToClientEvents["MUNICION_RECARGADA"] = "MUNICION_RECARGADA";
    ServerToClientEvents["GAME_ENDED"] = "GAME_ENDED";
    // En el futuro, los eventos de sincronizacion deberian ir aqui
    ServerToClientEvents["GAME_PAUSE_UPDATED"] = "GAME_PAUSE_UPDATED";
    ServerToClientEvents["SAVE_GAME_RESULT"] = "SAVE_GAME_RESULT";
})(ServerToClientEvents || (ServerToClientEvents = {}));
/*
 * Estos eventos son internos del cliente, no se envian al servidor,
 * y se usan para comunicar entre componentes como managers y escenas
 */
export var ClientInternalEvents;
(function (ClientInternalEvents) {
    // Gestor de seleccion
    ClientInternalEvents["SELECTION_CHANGED"] = "SELECTION_CHANGED";
    ClientInternalEvents["SELECTION_CONFIRMED"] = "SELECTION_CONFIRMED";
    ClientInternalEvents["SELECTION_CLEARED"] = "SELECTION_CLEARED";
    ClientInternalEvents["UNITS_UPDATED"] = "UNITS_UPDATED";
    // Cliente WebSocket
    ClientInternalEvents["CONNECTED"] = "CONNECTED";
    ClientInternalEvents["DISCONNECTED"] = "DISCONNECTED";
    ClientInternalEvents["CONNECTION_ERROR"] = "CONNECTION_ERROR";
})(ClientInternalEvents || (ClientInternalEvents = {}));
