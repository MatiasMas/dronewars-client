import Phaser from "phaser";
import { WebSocketClient } from "../network/WebSocketClient";

export class MainMenuScene extends Phaser.Scene {
    constructor() {
        super("MainMenuScene");
    }

    create(): void {
        const {width, height} = this.scale;

        this.add.rectangle(width / 2, height / 2, width, height, 0x0f172a);

        this.add.text(width / 2, height * 0.18, "DroneWars", {
            fontSize: "52px",
            color: "#ffffff",
            fontStyle: "bold"
        }).setOrigin(0.5);

        this.add.text(width / 2, height * 0.26, "Menú principal", {
            fontSize: "28px",
            color: "#a5b4fc",
        }).setOrigin(0.5);

        // Mostrar mensaje de carga exitosa si existe
        const loadedMessage = localStorage.getItem("savedGameLoadedMessage");
        const newGameMessage = localStorage.getItem("newGameCreatedMessage");
        const messageToShow = loadedMessage || newGameMessage;
        
        if (messageToShow) {
            const messageText = this.add.text(width / 2, height * 0.32, messageToShow, {
                fontSize: "18px",
                color: "#4ade80",
                align: "center",
                wordWrap: { width: width * 0.8 }
            }).setOrigin(0.5);

            // Remover los mensajes después de mostrarlos
            localStorage.removeItem("savedGameLoadedMessage");
            localStorage.removeItem("newGameCreatedMessage");

            // Hacer que el mensaje desaparezca después de 5 segundos
            this.time.delayedCall(5000, () => {
                this.tweens.add({
                    targets: messageText,
                    alpha: 0,
                    duration: 500,
                    onComplete: () => messageText.destroy()
                });
            });
        }

        const startY = height * 0.38;
        const gap = 64;

        const hasLoadedSavedGame = localStorage.getItem("hasLoadedSavedGame") === "true";
        let row = 0;

        if (hasLoadedSavedGame) {
            this.createButton("Comenzar nueva partida", startY + gap * row++, () => this.resetAndStartNewGame());
        }

        this.createButton("Unirse a una partida", startY + gap * row++, () => this.scene.start("JoinGameScene"));
        this.createButton("Cargar partida guardada", startY + gap * row++, () => this.scene.start("LoadGameScene"));
        this.createButton("Consultar ranking", startY + gap * row++, () => this.scene.start("RankingScene"));
        this.createButton("Salir del juego", startY + gap * row, () => this.exitGame());
    }

    private createButton(label: string, y: number, onClick: () => void): void {
        const {width} = this.scale;
        const buttonWidth = Math.min(460, width * 0.7);
        const buttonHeight = 48;

        const bg = this.add.rectangle(width / 2, y, buttonWidth, buttonHeight, 0x1e293b)
            .setStrokeStyle(2, 0x475569);

        const text = this.add.text(width / 2, y, label, {
            fontSize: "20px",
            color: "#e2e8f0"
        }).setOrigin(0.5);

        bg.setInteractive({useHandCursor: true})
            .on("pointerover", () => bg.setFillStyle(0x334155))
            .on("pointerout", () => bg.setFillStyle(0x1e293b))
            .on("pointerdown", onClick);

        text.setInteractive({useHandCursor: true}).on("pointerdown", onClick);
    }

    private exitGame(): void {
        const parent = (this.game.canvas as HTMLCanvasElement | null)?.parentElement;
        this.game.destroy(true);

        if (parent) {
            parent.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:center;height:100vh;background:#0f172a;color:#e2e8f0;font-family:sans-serif;">
      Juego cerrado
    </div>
  `;
        }
    }

    private resetAndStartNewGame(): void {
        // Limpiamos la marca de partida recuperada en localStorage
        localStorage.removeItem("hasLoadedSavedGame");
        
        // Guardamos mensaje para mostrar después del reload
        localStorage.setItem("newGameCreatedMessage", "Partida nueva creada. Unite a la partida para comenzar a jugar.");

        // Enviamos RESET_GAME al servidor en un WebSocket efímero
        const client = new WebSocketClient();
        client.connect()
            .then(() => {
                client.solicitarResetJuego();
                
                // Dar tiempo al servidor para procesar el reset antes de recargar
                setTimeout(() => {
                    client.disconnect();
                    window.location.reload();
                }, 500);
            })
            .catch(() => {
                // Si falla la conexión, recargar de todas formas
                window.location.reload();
            });
    }
}

