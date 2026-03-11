import Phaser from "phaser";
import { WebSocketClient } from "../network/WebSocketClient";
import { ServerToClientEvents } from "../types/CommunicationEvents";
import { IAvailablePlayer } from "../types/IAvailablePlayer";

type JoinGameSceneInitData = {
    websocketClient?: WebSocketClient;
};

export class JoinGameScene extends Phaser.Scene {
    private websocketClient: WebSocketClient | null = null;
    private statusText: Phaser.GameObjects.Text | null = null;
    private lastPlayersSnapshot: IAvailablePlayer[] = [];
    private selectedPlayerId: string | null = null;
    private registrationConfirmed = false;
    private hasStartedGame = false;
    private joinButtons: Array<{
        bg: Phaser.GameObjects.Rectangle;
        texts: Phaser.GameObjects.Text[];
    }> = [];
    private availablePlayersListener: ((players: IAvailablePlayer[]) => void) | null = null;

    constructor() {
        super("JoinGameScene");
    }

    async create(data?: JoinGameSceneInitData): Promise<void> {
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
            this.detachLobbyListeners();
            this.websocketClient?.disconnect();
            // Recargar la página para limpiar completamente el estado después de una partida
            window.location.reload();
        });

        // Si LoadGameScene nos pasó un websocketClient ya conectado, lo reutilizamos
        if (data?.websocketClient && data.websocketClient.isConnectedToServer()) {
            this.websocketClient = data.websocketClient;
        }

        await this.loadPlayers();
    }

    private async loadPlayers(): Promise<void> {
        // Si no tenemos websocketClient, creamos uno nuevo
        if (!this.websocketClient) {
            this.websocketClient = new WebSocketClient();

            try {
                await this.websocketClient.connect();
            } catch {
                this.setStatus("No se pudo conectar al servidor.");
                return;
            }
        }

        this.availablePlayersListener = (players: IAvailablePlayer[]) => {
            this.handleAvailablePlayers(players ?? []);
        };
        this.websocketClient.on(ServerToClientEvents.AVAILABLE_PLAYERS, this.availablePlayersListener);

        // Si estamos reutilizando un WebSocket ya conectado, solicitar explícitamente los jugadores
        this.websocketClient.solicitarJugadoresDisponibles();

        const players = await this.waitForAvailablePlayers();
        this.handleAvailablePlayers(players ?? []);
    }

    private handleAvailablePlayers(players: IAvailablePlayer[]): void {
        this.lastPlayersSnapshot = players;

        if (!this.selectedPlayerId) {
            const available = players.filter(p => p.available);

            if (available.length === 0) {
                this.setStatus("No hay partidas/jugadores disponibles para unirse.");
                this.clearJoinButtons();
                return;
            }

            this.setStatus("Selecciona un jugador para unirte:");
            this.renderPlayerButtons(available);
        } else {
            this.setStatus("Esperando a que el otro jugador se una...");
        }

        this.tryStartGameWhenBothJoined();
    }

    private waitForAvailablePlayers(timeoutMs = 4000): Promise<IAvailablePlayer[]> {
        return new Promise(resolve => {
            if (!this.websocketClient) {
                resolve([]);
                return;
            }

            const onPlayers = (players: IAvailablePlayer[]) => {
                clearTimeout(timeout);
                this.websocketClient?.off(ServerToClientEvents.AVAILABLE_PLAYERS, onPlayers);
                resolve(players ?? []);
            };

            const timeout = setTimeout(() => {
                this.websocketClient?.off(ServerToClientEvents.AVAILABLE_PLAYERS, onPlayers);
                resolve([]);
            }, timeoutMs);

            this.websocketClient.on(ServerToClientEvents.AVAILABLE_PLAYERS, onPlayers);
        });
    }

    private renderPlayerButtons(players: IAvailablePlayer[]): void {
        const startY = 220;
        const gap = 56;
        this.clearJoinButtons();

        players.slice(0, 6).forEach((player, idx) => {
            const playerNameColor =
                player.playerId === "player_1" ? "#ef4444" :
                player.playerId === "player_2" ? "#22c55e" :
                "#e2e8f0";

            const button = this.createJoinPlayerButton("Unirme como ", player.playerName, startY + idx * gap, () => {
                this.tryJoinAsPlayer(player.playerId);
            }, playerNameColor);
            this.joinButtons.push(button);
        });
    }

    private clearJoinButtons(): void {
        this.joinButtons.forEach(button => {
            button.bg.destroy();
            button.texts.forEach(text => text.destroy());
        });
        this.joinButtons = [];
    }

    private createJoinPlayerButton(
        prefix: string,
        playerName: string,
        y: number,
        onClick: () => void,
        playerNameColor: string
    ): {
        bg: Phaser.GameObjects.Rectangle;
        texts: Phaser.GameObjects.Text[];
    } {
        const { width } = this.scale;
        const w = Math.min(620, width * 0.85);
        const h = 42;

        const bg = this.add.rectangle(width / 2, y, w, h, 0x1f2937).setStrokeStyle(2, 0x64748b);
        const prefixText = this.add.text(0, y, prefix, { fontSize: "18px", color: "#e2e8f0" }).setOrigin(0, 0.5);
        const nameText = this.add.text(0, y, playerName, { fontSize: "18px", color: playerNameColor }).setOrigin(0, 0.5);

        const totalTextWidth = prefixText.width + nameText.width;
        const startX = width / 2 - totalTextWidth / 2;
        prefixText.setX(startX);
        nameText.setX(startX + prefixText.width);

        bg.setInteractive({ useHandCursor: true }).on("pointerdown", onClick);
        prefixText.setInteractive({ useHandCursor: true }).on("pointerdown", onClick);
        nameText.setInteractive({ useHandCursor: true }).on("pointerdown", onClick);

        return { bg, texts: [prefixText, nameText] };
    }

    private async tryJoinAsPlayer(playerId: string): Promise<void> {
        if (!this.websocketClient || this.selectedPlayerId) {
            return;
        }

        this.selectedPlayerId = playerId;
        this.registrationConfirmed = false;
        this.registry.set("preferredPlayerId", playerId);
        localStorage.setItem("dronewars:save-slot", JSON.stringify({
            playerId,
            savedAt: new Date().toISOString()
        }));
        this.clearJoinButtons();
        this.setStatus(`Te uniste como ${playerId}. Esperando al otro jugador...`);

        this.websocketClient.registerPlayer(playerId);
        const registered = await this.waitForPlayerRegistration();

        if (!registered) {
            this.setStatus("No se pudo confirmar el registro. Volvé a intentar.");
            this.selectedPlayerId = null;
            this.registrationConfirmed = false;
            this.handleAvailablePlayers(this.lastPlayersSnapshot);
            return;
        }

        this.registrationConfirmed = true;
        // Ya no necesitamos polling; el servidor hace broadcast cuando alguien se registra
        this.tryStartGameWhenBothJoined();
    }

    private areBothPlayersJoined(): boolean {
        if (!this.selectedPlayerId) {
            return false;
        }

        const player1 = this.lastPlayersSnapshot.find(player => player.playerId === "player_1");
        const player2 = this.lastPlayersSnapshot.find(player => player.playerId === "player_2");

        // Caso A: el server envía snapshot completo con ambos jugadores
        if (player1 && player2) {
            return player1.available === false && player2.available === false;
        }

        // Caso B: el server envía solo jugadores disponibles.
        // Si el "otro" jugador ya no aparece como disponible, ambos ya están unidos.
        const availableIds = new Set(
            this.lastPlayersSnapshot
                .filter(player => player.available)
                .map(player => player.playerId)
        );
        const otherPlayerId = this.selectedPlayerId === "player_1" ? "player_2" : "player_1";
        return !availableIds.has(otherPlayerId);
    }

    private tryStartGameWhenBothJoined(): void {
        if (!this.selectedPlayerId || !this.websocketClient || this.hasStartedGame || !this.registrationConfirmed) {
            return;
        }

        if (!this.areBothPlayersJoined()) {
            return;
        }

        this.hasStartedGame = true;
        this.setStatus("Ambos jugadores unidos. Iniciando partida...");
        this.detachLobbyListeners();
        this.scene.start("GameScene", {
            preferredPlayerId: this.selectedPlayerId,
            websocketClient: this.websocketClient,
            preRegistered: true
        });
    }

    private waitForPlayerRegistration(timeoutMs = 5000): Promise<boolean> {
        return new Promise(resolve => {
            if (!this.websocketClient) {
                resolve(false);
                return;
            }

            const onRegistered = () => {
                clearTimeout(timeout);
                this.websocketClient?.off(ServerToClientEvents.PLAYER_REGISTERED, onRegistered);
                this.websocketClient?.off(ServerToClientEvents.SERVER_ERROR, onServerError);
                resolve(true);
            };

            const onServerError = () => {
                clearTimeout(timeout);
                this.websocketClient?.off(ServerToClientEvents.PLAYER_REGISTERED, onRegistered);
                this.websocketClient?.off(ServerToClientEvents.SERVER_ERROR, onServerError);
                resolve(false);
            };

            const timeout = setTimeout(() => {
                this.websocketClient?.off(ServerToClientEvents.PLAYER_REGISTERED, onRegistered);
                this.websocketClient?.off(ServerToClientEvents.SERVER_ERROR, onServerError);
                resolve(false);
            }, timeoutMs);

            this.websocketClient.on(ServerToClientEvents.PLAYER_REGISTERED, onRegistered);
            this.websocketClient.on(ServerToClientEvents.SERVER_ERROR, onServerError);
        });
    }

    private detachLobbyListeners(): void {
        if (!this.websocketClient || !this.availablePlayersListener) {
            return;
        }

        this.websocketClient.off(ServerToClientEvents.AVAILABLE_PLAYERS, this.availablePlayersListener);
        this.availablePlayersListener = null;
    }

    private setStatus(text: string): void {
        this.statusText?.setText(text);
    }

    private createButton(label: string, y: number, onClick: () => void, textColor = "#e2e8f0"): {
        bg: Phaser.GameObjects.Rectangle;
        text: Phaser.GameObjects.Text;
    } {
        const { width } = this.scale;
        const w = Math.min(620, width * 0.85);
        const h = 42;

        const bg = this.add.rectangle(width / 2, y, w, h, 0x1f2937).setStrokeStyle(2, 0x64748b);
        const text = this.add.text(width / 2, y, label, { fontSize: "18px", color: textColor }).setOrigin(0.5);

        bg.setInteractive({ useHandCursor: true }).on("pointerdown", onClick);
        text.setInteractive({ useHandCursor: true }).on("pointerdown", onClick);
        return { bg, text };
    }
}
