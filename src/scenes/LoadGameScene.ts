import Phaser from "phaser";
import { WebSocketClient } from "../network/WebSocketClient";
import { ServerToClientEvents } from "../types/CommunicationEvents";

export class LoadGameScene extends Phaser.Scene {
    private websocketClient: WebSocketClient | null = null;
    private statusText: Phaser.GameObjects.Text | null = null;
    private codeText: Phaser.GameObjects.Text | null = null;
    private codeBg: Phaser.GameObjects.Rectangle | null = null;
    private currentCode: string = "";

    constructor() {
        super("LoadGameScene");
    }

    async create(): Promise<void> {
        const { width, height } = this.scale;
        this.add.rectangle(width / 2, height / 2, width, height, 0x111827);

        this.add.text(width / 2, 100, "Cargar partida guardada", {
            fontSize: "38px",
            color: "#ffffff",
            fontStyle: "bold"
        }).setOrigin(0.5);

        this.statusText = this.add.text(width / 2, 160, "Ingresa el código de tu partida.", {
            fontSize: "20px",
            color: "#cbd5e1",
            align: "center"
        }).setOrigin(0.5);

        this.createButton("Volver al menú", height - 90, () => {
            this.websocketClient?.disconnect();
            this.scene.start("MainMenuScene");
        });

        this.createCodeInput();
    }

    private async connectIfNeeded(): Promise<void> {
        if (this.websocketClient && this.websocketClient.isConnectedToServer()) {
            return;
        }

        this.websocketClient = new WebSocketClient();
        try {
            await this.websocketClient.connect();
        } catch {
            this.setStatus("No se pudo conectar al servidor.");
        }
    }

    private async requestLoadByCode(code: string): Promise<void> {
        if (!code || !code.trim()) {
            this.setStatus("Debes ingresar un código.");
            return;
        }

        await this.connectIfNeeded();
        if (!this.websocketClient || !this.websocketClient.isConnectedToServer()) {
            return;
        }

        this.setStatus(`Enviando código ${code.trim()} al servidor...`);

        // Suscripción única a la respuesta
        this.websocketClient.on(ServerToClientEvents.SAVED_GAME_LOADED, (dto: any) => {
            const success = dto?.success === true;
            const message = dto?.message ?? (success ? "Partida cargada" : "No se pudo cargar la partida");

            if (!success) {
                this.setStatus(message);
                return;
            }

            // Guardar mensaje de éxito para mostrarlo después del reload
            localStorage.setItem("hasLoadedSavedGame", "true");
            localStorage.setItem("savedGameLoadedMessage", `Partida cargada correctamente. Unite a la partida para continuar jugando.`);
            
            // Recargar la página para limpiar completamente el estado
            window.location.reload();
        });

        this.websocketClient.solicitarCargarPartidaPorCodigo(code.trim());
    }

    private createCodeInput(): void {
        const { width } = this.scale;
        const w = Math.min(420, width * 0.72);
        const h = 46;
        const y = 220;

        this.codeBg = this.add.rectangle(width / 2, y, w, h, 0x1f2937)
            .setStrokeStyle(2, 0x64748b);

        this.codeText = this.add.text(width / 2, y, "Código de partida", {
            fontSize: "20px",
            color: "#64748b"
        }).setOrigin(0.5);

        this.codeBg.setInteractive({ useHandCursor: true }).on("pointerdown", () => {
            this.input.keyboard?.enableGlobalCapture();
        });

        // Botón "Cargar partida" con el mismo estilo que los otros botones
        this.createButton("Cargar partida", 280, () => {
            this.requestLoadByCode(this.currentCode);
        });

        // Manejo de teclado para escribir el código
        this.input.keyboard?.on("keydown", (event: KeyboardEvent) => {
            if (!this.codeText) return;

            if (event.key === "Backspace") {
                this.currentCode = this.currentCode.slice(0, -1);
            } else if (event.key === "Enter") {
                this.requestLoadByCode(this.currentCode);
                return;
            } else {
                const k = event.key.toUpperCase();
                if (/^[A-Z0-9]$/.test(k) && this.currentCode.length < 16) {
                    this.currentCode += k;
                }
            }

            if (this.currentCode.length === 0) {
                this.codeText.setText("Código de partida");
                this.codeText.setColor("#64748b");
            } else {
                this.codeText.setText(this.currentCode);
                this.codeText.setColor("#e2e8f0");
            }
        });

        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            this.input.keyboard?.removeAllListeners();
        });
    }

    private setStatus(text: string): void {
        this.statusText?.setText(text);
    }

    private createButton(label: string, y: number, onClick: () => void): void {
        const { width } = this.scale;
        const w = Math.min(420, width * 0.72);
        const h = 46;

        const bg = this.add.rectangle(width / 2, y, w, h, 0x1f2937).setStrokeStyle(2, 0x64748b);
        const text = this.add.text(width / 2, y, label, { fontSize: "20px", color: "#e2e8f0" }).setOrigin(0.5);

        bg.setInteractive({ useHandCursor: true }).on("pointerdown", onClick);
        text.setInteractive({ useHandCursor: true }).on("pointerdown", onClick);
    }
}