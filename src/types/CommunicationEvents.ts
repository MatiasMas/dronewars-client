/*
 * CommunicationEvents define todos los eventos transmitidos entre cliente y servidor.
 * Los clientes envian un evento; el servidor lo procesa con el nombre usado aqui.
 *
 * ServerToClient: cuando el servidor envia un evento al cliente
 * ClientToServer: cuando el cliente envia un evento al servidor
 */

export enum ClientToServerEvents {
  REGISTER_PLAYER = 'REGISTER_PLAYER',
  GET_PLAYER_UNITS = 'GET_PLAYER_UNITS',
  SELECT_UNIT = 'SELECT_UNIT',
  // MOVE_UNIT: movimiento validado por servidor
  MOVE_UNIT = 'MOVE_UNIT',
  // RELOAD_AMMO: recarga de municion validada por servidor
  RELOAD_AMMO = 'RELOAD_AMMO',

  // En el futuro, los eventos de movimiento o ataques deberian ir aqui
}

export enum ServerToClientEvents {
  PLAYER_REGISTERED = 'PLAYER_REGISTERED',
  UNITS_RECEIVED = 'UNITS_RECEIVED',
  UNIT_SELECTED = 'UNIT_SELECTED',
  SERVER_ERROR = 'SERVER_ERROR',
  AVAILABLE_PLAYERS = 'AVAILABLE_PLAYERS',
  MOVE_ACCEPTED = 'MOVE_ACCEPTED',
  GAME_STATE_UPDATE = 'GAME_STATE_UPDATE',
  MUNICION_RECARGADA = 'MUNICION_RECARGADA',

  // En el futuro, los eventos de sincronizacion deberian ir aqui
}

/*
 * Estos eventos son internos del cliente, no se envian al servidor,
 * y se usan para comunicar entre componentes como managers y escenas
 */
export enum ClientInternalEvents {
  // Gestor de seleccion
  SELECTION_CHANGED = 'SELECTION_CHANGED',
  SELECTION_CONFIRMED = 'SELECTION_CONFIRMED',
  SELECTION_CLEARED = 'SELECTION_CLEARED',
  UNITS_UPDATED = 'UNITS_UPDATED',

  // Cliente WebSocket
  CONNECTED = 'CONNECTED',
  DISCONNECTED = 'DISCONNECTED',
  CONNECTION_ERROR = 'CONNECTION_ERROR',
}

