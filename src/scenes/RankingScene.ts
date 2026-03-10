import Phaser from "phaser";

export class RankingScene extends Phaser.Scene {
    private static readonly API_URL = "http://localhost:6969/api/ranking";

    constructor() {
        super("RankingScene");
    }

    async create(): Promise<void> {
        const { width, height } = this.scale;
        this.add.rectangle(width / 2, height / 2, width, height, 0x111827);

        this.add.text(width / 2, 100, "Ranking", {
            fontSize: "42px",
            color: "#ffffff",
            fontStyle: "bold"
        }).setOrigin(0.5);

        const statusText = this.add.text(width / 2, 160, "Cargando ranking...", {
            fontSize: "20px",
            color: "#cbd5e1"
        }).setOrigin(0.5);

        try {
            const response = await fetch(`${RankingScene.API_URL}?limit=10`);
            
            if (!response.ok) {
                throw new Error("Error al cargar ranking");
            }

            const ranking = await response.json();
            
            statusText.destroy();

            if (ranking.length === 0) {
                this.add.text(width / 2, 190, "No hay puntajes registrados", {
                    fontSize: "20px",
                    color: "#94a3b8"
                }).setOrigin(0.5);
            } else {
                ranking.forEach((entry: any, i: number) => {
                    const line = `${i + 1}. ${entry.nickname} - ${entry.score} pts`;
                    this.add.text(width / 2, 190 + i * 48, line, {
                        fontSize: "24px",
                        color: "#cbd5e1"
                    }).setOrigin(0.5);
                });
            }
        } catch (error) {
            console.error("Error al cargar ranking:", error);
            statusText.setText("Error al cargar el ranking");
            statusText.setColor("#ef4444");
        }

        this.createButton("Volver al menú", height - 90, () => {
            // Recargar la página para limpiar completamente el estado después de una partida
            window.location.reload();
        });
    }

    private createButton(label: string, y: number, onClick: () => void): void {
        const { width } = this.scale;
        const w = Math.min(360, width * 0.6);
        const h = 46;

        const bg = this.add.rectangle(width / 2, y, w, h, 0x1f2937).setStrokeStyle(2, 0x64748b);
        const text = this.add.text(width / 2, y, label, { fontSize: "20px", color: "#e2e8f0" }).setOrigin(0.5);

        bg.setInteractive({ useHandCursor: true }).on("pointerdown", onClick);
        text.setInteractive({ useHandCursor: true }).on("pointerdown", onClick);
    }
}