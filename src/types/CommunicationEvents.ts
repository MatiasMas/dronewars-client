/*
 * CommunicationEvents defines all events that are transmitted between the client and server,
 * clients send an event; server processes the event with the name used here.
 *
 * ServerToClient: When the server sends an event to the client
 * ClientToServer: When the client sends an event to the server
 */

export enum ClientToServerEvents {
  REGISTER_PLAYER = 'REGISTER_PLAYER',
  GET_PLAYER_UNITS = 'GET_PLAYER_UNITS',
  SELECT_UNIT = 'SELECT_UNIT',
  MOVE_UNIT = 'MOVE_UNIT'

  // In the future, movement or attacks events should be here
}

export enum ServerToClientEvents {
  PLAYER_REGISTERED = 'PLAYER_REGISTERED',
  UNITS_RECEIVED = 'UNITS_RECEIVED',
  UNIT_SELECTED = 'UNIT_SELECTED',
  SERVER_ERROR = 'SERVER_ERROR',
  AVAILABLE_PLAYERS = 'AVAILABLE_PLAYERS',
  MOVE_ACCEPTED = 'MOVE_ACCEPTED',
  GAME_STATE_UPDATE = 'GAME_STATE_UPDATE'

  // In the future, sync events should be here
}

/*
 * These events are internal to the client, they are not sent to the server,
 * they are used to communicate between components like managers and scenes
 */
export enum ClientInternalEvents {
  // SelectionManager
  SELECTION_CHANGED = 'SELECTION_CHANGED',
  SELECTION_CONFIRMED = 'SELECTION_CONFIRMED',
  SELECTION_CLEARED = 'SELECTION_CLEARED',
  UNITS_UPDATED = 'UNITS_UPDATED',

  // WebSocketClient
  CONNECTED = 'CONNECTED',
  DISCONNECTED = 'DISCONNECTED',
  CONNECTION_ERROR = 'CONNECTION_ERROR',
}
