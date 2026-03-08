import Phaser from "phaser";
import { HighScoreManager } from "../managers/HighScoreManager";
export class RankingScene extends Phaser.Scene {
    highScoreManager = new HighScoreManager();
    constructor() {
        super("RankingScene");
    }
    create() {
        const scores = this.highScoreManager.getScores();
        const { width, height } = this.scale;
        this.add.rectangle(width / 2, height / 2, width, height, 0x111827);
        this.add.text(width / 2, 100, "Ranking", {
            fontSize: "42px",
            color: "#ffffff",
            fontStyle: "bold"
        }).setOrigin(0.5);
        const top = scores.map((s, i) => `${i + 1}. ${s.name} - ${s.score} pts`);
        top.forEach((line, i) => {
            this.add.text(width / 2, 190 + i * 48, line, {
                fontSize: "24px",
                color: "#cbd5e1"
            }).setOrigin(0.5);
        });
        this.createButton("Volver al menú", height - 90, () => this.scene.start("MainMenuScene"));
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
