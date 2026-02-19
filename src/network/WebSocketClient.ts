// An event callback its just a function that executes when a specific event is received
import {ClientInternalEvents, ClientToServerEvents, ServerToClientEvents} from "../types/CommunicationEvents";
import P = Phaser.Input.Keyboard.KeyCodes.P;

type EventCallback = (data?: any) => void;

export class WebSocketClient {
  private socket: WebSocket | null = null;
  private url: string;
  private playerId: string | null = null;
  private eventListeners: Map<string, EventCallback[]> = new Map();
  private isConnected: boolean = false;

  constructor(url: string = 'ws://localhost:8080/game') {
    this.url = url;
  }

  // Connects to the server and defines connection events
  public async connect(): Promise<void> {
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

        this.socket.onerror = (error: Event) => {
          console.error("[WebSocket] Error:", error);
          this.isConnected = false;
          this.emit(ClientInternalEvents.CONNECTION_ERROR, error);
        };

        this.socket.onmessage = (event: MessageEvent) => {
          this.handleMessage(event.data);
        };
      } catch (err) {
        reject(err);
      }
    });
  }

  /*
  * Register a player on the server
  * Message: ClientToServerEvents.REGISTER_PLAYER
  */
  public registerPlayer(playerId: string): void {
    this.playerId = playerId;

    this.send({
      type: ClientToServerEvents.REGISTER_PLAYER,
      playerId: playerId
    });
  }

  /*
  * Request player units from the server
  * Message: ClientToServerEvents.GET_PLAYER_UNITS
  */
  public requestPlayerUnits(): void {
    this.send({
      type: ClientToServerEvents.GET_PLAYER_UNITS
    });
  }

  /*
  * Request unit selection to the server (checking if the player can actually select a unit)
  * Message: ClientToServerEvents.SELECT_UNIT
  */
  public requestUnitSelection(unitId: string): void {
    this.send({
      type: ClientToServerEvents.SELECT_UNIT,
      unitId: unitId
    });
  }

  /*
  * This method assigns an EventCallback depending on the event being passed
  */
  public on(event: string, callback: EventCallback): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }

    this.eventListeners.get(event)?.push(callback);
  }

  public isConnectedToServer(): boolean {
    return this.isConnected;
  }

  public getPlayerId(): string | null {
    return this.playerId;
  }

  public disconnect(): void {
    if (this.socket) {
      this.socket.close();
      this.isConnected = false;
    }
  }

  /*
  * This method sends a message to the server with whatever you pass to the message
  */
  private send(message: any): void {
    if (!this.isConnected) {
      console.log("[WebSocket] Cannot send message, not connected to server");
      return;
    }

    try {
      this.socket?.send(JSON.stringify(message));
    } catch (err) {
      console.log("[WebSocket] Error sending message:", err);
    }
  }

  public requestBombAttack(unitId: string): void {
    this.send({
      type: ClientToServerEvents.LAUNCH_BOMB,
      unitId: unitId
    });
  }

  /*
  * This method handles messages received from the server
  * It parses the message and emits the event to the clients
  */
  private handleMessage(eventData: string): void {
    try {
      const data = JSON.parse(eventData);

      // If it has type and is AVAILABLE_PLAYERS means the server is sending a list of available players
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

      // If data is an error means the server returned error
      if (data.type === ServerToClientEvents.SERVER_ERROR) {
        this.emit(ServerToClientEvents.SERVER_ERROR, data.payload);
        return;
      }

      // If none of the above matches just sent the message type from the server to the listeners
      if (data.type) {
        this.emit(data.type, data);
      }
      if (data.type === ServerToClientEvents.BOMB_LAUNCHED) {
        this.emit(ServerToClientEvents.BOMB_LAUNCHED, data.payload);
        return;
      }

      if (data.type === ServerToClientEvents.BOMB_EXPLODED) {
        this.emit(ServerToClientEvents.BOMB_EXPLODED, data.payload);
        return;
      }
    } catch (err) {
      console.log("[WebSocket] Error parsing message:", err);
    }
  }

  /*
  * This method receives an event
  */
  private emit(event: string, data?: any): void {
    const callbacks = this.eventListeners.get(event);

    if (callbacks) {
      callbacks.forEach(callback => callback(data));
    }
  }
}
