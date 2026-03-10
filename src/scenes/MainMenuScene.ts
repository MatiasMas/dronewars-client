import Phaser from "phaser";

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

        const startY = height * 0.34;
        const gap = 58;

        this.createButton("Unirse a una partida", startY + gap * 0, () => this.scene.start("JoinGameScene"));
        this.createButton("Cargar partida guardada", startY + gap * 1, () => this.scene.start("LoadGameScene"));
        this.createButton("Consultar ranking", startY + gap * 2, () => this.scene.start("RankingScene"));
        this.createButton("Instrucciones", startY + gap * 3, () =>
            this.scene.start("InstructionsScene", { source: "main-menu" })
        );
        this.createButton("Salir del juego", startY + gap * 4, () => this.exitGame());
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
}

