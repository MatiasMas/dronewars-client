import Phaser from "phaser";
import { WebSocketClient } from "../network/WebSocketClient";
import { ServerToClientEvents } from "../types/CommunicationEvents";
export class JoinGameScene extends Phaser.Scene {
    websocketClient = null;
    statusText = null;
    constructor() {
        super("JoinGameScene");
    }
    async create() {
        const { width, height } = this.scale;
        this.add.rectangle(width / 2, height / 2, width, height, 0x111827);
        this.add.text(width / 2, 90, "Unirse a una partida", {
            fontSize: "38px",
            color: "#ffffff",
            fontStyle: "bold"
        }).setOrigin(0.5);
        this.statusText = this.add.text(width / 2, 145, "Buscando jugadores disponibles...", {
            fontSize: "18px",
            color: "#cbd5e1"
        }).setOrigin(0.5);
        this.createButton("Volver al menú", height - 90, () => {
            this.websocketClient?.disconnect();
            this.scene.start("MainMenuScene");
        });
        await this.loadPlayers();
    }
    async loadPlayers() {
        this.websocketClient = new WebSocketClient();
        try {
            await this.websocketClient.connect();
        }
        catch {
            this.setStatus("No se pudo conectar al servidor.");
            return;
        }
        const players = await this.waitForAvailablePlayers();
        const available = players.filter(p => p.available);
        if (available.length === 0) {
            this.setStatus("No hay partidas/jugadores disponibles para unirse.");
            return;
        }
        this.setStatus("Selecciona un jugador para unirte:");
        this.renderPlayerButtons(available);
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
    renderPlayerButtons(players) {
        const startY = 220;
        const gap = 56;
        players.slice(0, 6).forEach((player, idx) => {
            this.createButton(`Unirme como ${player.playerName} (${player.playerId})`, startY + idx * gap, () => {
                this.startGameWithPlayer(player.playerId);
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
        const w = Math.min(620, width * 0.85);
        const h = 42;
        const bg = this.add.rectangle(width / 2, y, w, h, 0x1f2937).setStrokeStyle(2, 0x64748b);
        const text = this.add.text(width / 2, y, label, { fontSize: "18px", color: "#e2e8f0" }).setOrigin(0.5);
        bg.setInteractive({ useHandCursor: true }).on("pointerdown", onClick);
        text.setInteractive({ useHandCursor: true }).on("pointerdown", onClick);
    }
}
