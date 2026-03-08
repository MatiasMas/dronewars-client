import Phaser from "phaser";
import { WebSocketClient } from "../network/WebSocketClient";
import { ServerToClientEvents } from "../types/CommunicationEvents";
export class CreateGameScene extends Phaser.Scene {
    websocketClient = null;
    selectedPlayerId = null;
    statusText = null;
    constructor() {
        super("CreateGameScene");
    }
    async create() {
        const { width, height } = this.scale;
        this.add.rectangle(width / 2, height / 2, width, height, 0x111827);
        this.add.text(width / 2, 110, "Crear nueva partida", {
            fontSize: "38px",
            color: "#ffffff",
            fontStyle: "bold"
        }).setOrigin(0.5);
        this.statusText = this.add.text(width / 2, 180, "Conectando al servidor...", {
            fontSize: "20px",
            color: "#cbd5e1",
            align: "center"
        }).setOrigin(0.5);
        this.createButton("Crear partida", height - 160, async () => {
            if (!this.selectedPlayerId) {
                this.setStatus("No hay jugador disponible para crear partida.");
                return;
            }
            this.startGameWithPlayer(this.selectedPlayerId);
        });
        this.createButton("Volver al menú", height - 90, () => {
            this.websocketClient?.disconnect();
            this.scene.start("MainMenuScene");
        });
        await this.bootstrapLobby();
    }
    async bootstrapLobby() {
        this.websocketClient = new WebSocketClient();
        try {
            await this.websocketClient.connect();
        }
        catch {
            this.setStatus("No se pudo conectar al servidor.");
            return;
        }
        const players = await this.waitForAvailablePlayers();
        const firstAvailable = players.find(p => p.available);
        if (!firstAvailable) {
            this.setStatus("No hay jugadores disponibles en este momento.");
            return;
        }
        this.selectedPlayerId = firstAvailable.playerId;
        this.setStatus(`Jugador asignado para crear partida: ${firstAvailable.playerName} (${firstAvailable.playerId})`);
    }
    waitForAvailablePlayers(timeoutMs = 4000) {
        return new Promise(resolve => {
            if (!this.websocketClient) {
                resolve([]);
                return;
            }
            const timeout = setTimeout(() => resolve([]), timeoutMs);
            this.websocketClient.on(ServerToClientEvents.AVAILABLE_PLAYERS, (players) => {
                clearTimeout(timeout);
                resolve(players ?? []);
            });
        });
    }
    startGameWithPlayer(playerId) {
        this.registry.set("preferredPlayerId", playerId);
        localStorage.setItem("dronewars:save-slot", JSON.stringify({
            playerId,
            savedAt: new Date().toISOString()
        }));
        this.websocketClient?.disconnect();
        this.scene.start("GameScene", { preferredPlayerId: playerId });
    }
    setStatus(text) {
        this.statusText?.setText(text);
    }
    createButton(label, y, onClick) {
        const { width } = this.scale;
        const w = Math.min(360, width * 0.6);
        const h = 46;
        const bg = this.add.rectangle(width / 2, y, w, h, 0x1f2937).setStrokeStyle(2, 0x64748b);
        const text = this.add.text(width / 2, y, label, { fontSize: "20px", color: "#e2e8f0" }).setOrigin(0.5);
        bg.setInteractive({ useHandCursor: true }).on("pointerdown", onClick);
        text.setInteractive({ useHandCursor: true }).on("pointerdown", onClick);
    }
}
