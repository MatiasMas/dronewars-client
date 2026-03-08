import Phaser from "phaser";
import { WebSocketClient } from "../network/WebSocketClient";
import { ServerToClientEvents } from "../types/CommunicationEvents";
export class LoadGameScene extends Phaser.Scene {
    websocketClient = null;
    statusText = null;
    constructor() {
        super("LoadGameScene");
    }
    async create() {
        const { width, height } = this.scale;
        this.add.rectangle(width / 2, height / 2, width, height, 0x111827);
        this.add.text(width / 2, 100, "Cargar partida guardada", {
            fontSize: "38px",
            color: "#ffffff",
            fontStyle: "bold"
        }).setOrigin(0.5);
        this.statusText = this.add.text(width / 2, 160, "Buscando guardado local...", {
            fontSize: "20px",
            color: "#cbd5e1",
            align: "center"
        }).setOrigin(0.5);
        this.createButton("Volver al menú", height - 90, () => {
            this.websocketClient?.disconnect();
            this.scene.start("MainMenuScene");
        });
        await this.loadSavedGame();
    }
    async loadSavedGame() {
        const slotRaw = localStorage.getItem("dronewars:save-slot");
        if (!slotRaw) {
            this.setStatus("No hay partida guardada.");
            return;
        }
        let slot;
        try {
            slot = JSON.parse(slotRaw);
        }
        catch {
            this.setStatus("El guardado local está corrupto.");
            return;
        }
        this.websocketClient = new WebSocketClient();
        try {
            await this.websocketClient.connect();
        }
        catch {
            this.setStatus("No se pudo conectar al servidor.");
            return;
        }
        const players = await this.waitForAvailablePlayers();
        const isAvailable = players.some(p => p.playerId === slot.playerId && p.available);
        const savedAtReadable = slot.savedAt ? new Date(slot.savedAt).toLocaleString() : "fecha desconocida";
        if (!isAvailable) {
            this.setStatus(`Guardado encontrado (${slot.playerId}, ${savedAtReadable}), pero no está disponible ahora.`);
            return;
        }
        this.setStatus(`Guardado listo: ${slot.playerId} (${savedAtReadable})`);
        this.createButton("Cargar guardado", this.scale.height - 160, () => this.startGameWithPlayer(slot.playerId));
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
        this.websocketClient?.disconnect();
        this.scene.start("GameScene", { preferredPlayerId: playerId });
    }
    setStatus(text) {
        this.statusText?.setText(text);
    }
    createButton(label, y, onClick) {
        const { width } = this.scale;
        const w = Math.min(420, width * 0.72);
        const h = 46;
        const bg = this.add.rectangle(width / 2, y, w, h, 0x1f2937).setStrokeStyle(2, 0x64748b);
        const text = this.add.text(width / 2, y, label, { fontSize: "20px", color: "#e2e8f0" }).setOrigin(0.5);
        bg.setInteractive({ useHandCursor: true }).on("pointerdown", onClick);
        text.setInteractive({ useHandCursor: true }).on("pointerdown", onClick);
    }
}
