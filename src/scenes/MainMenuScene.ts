import Phaser from "phaser";
import { SoundManager } from "../managers/SoundManager";
import { AnimationManager } from "../managers/AnimationManager";

export class MainMenuScene extends Phaser.Scene {
    private static hasPlayedIntro = false;
    private soundManager!: SoundManager;

    constructor() {
        super("MainMenuScene");
    }

    preload(): void {
        SoundManager.preload(this);
        AnimationManager.preload(this);
    }

    create(): void {
        const { width, height } = this.scale;
        this.soundManager = new SoundManager(this);
        AnimationManager.createAnimations(this);

        if (!MainMenuScene.hasPlayedIntro) {
            this.showInitialClickScreen();
        } else {
            this.showMainMenuContent();
        }
    }

    private showInitialClickScreen(): void {
        const { width, height } = this.scale;

        const bg = this.add.rectangle(width / 2, height / 2, width, height, 0x000000).setInteractive();

        const titleImg = this.add.sprite(width / 2, height / 2, "TitleMM");

        this.tweens.add({
            targets: titleImg,
            alpha: 0.5,
            duration: 1000,
            yoyo: true,
            repeat: -1
        });

        bg.once("pointerdown", () => {
            titleImg.destroy();
            bg.destroy();
            this.startIntroSequence();
        });
    }

    private startIntroSequence(): void {
        const { width, height } = this.scale;

        this.soundManager.playIntro();

        const introSprite = this.add.sprite(width / 2, height / 2, "GameIntro");
        introSprite.setDisplaySize(width, height);
        introSprite.play(AnimationManager.KEYS.IntroGI);

        this.time.delayedCall(26000, () => {
            introSprite.destroy();
            MainMenuScene.hasPlayedIntro = true;
            this.showMainMenuContent();
        });
    }

    private showMainMenuContent(): void {
        const { width, height } = this.scale;

        this.soundManager.stopMusic();
        this.soundManager.playMenuMusic();
        const menuBg = this.add.sprite(width / 2, height / 2, "MainMenu");
        menuBg.setDisplaySize(width, height);
        menuBg.play(AnimationManager.KEYS.MMenu);

        const startY = height * 0.65;
        const gap = 58;

        this.createButton("Unirse a una partida", startY + gap * 0, () => {
            this.soundManager.stopMusic();
            this.scene.start("JoinGameScene");
        });
        this.createButton("Cargar partida guardada", startY + gap * 1, () => {
            this.soundManager.stopMusic();
            this.scene.start("LoadGameScene");
        });
        this.createButton("Consultar ranking", startY + gap * 2, () => {
            this.soundManager.stopMusic();
            this.scene.start("RankingScene");
        });
        this.createButton("Salir del juego", startY + gap * 3, () => this.exitGame());
    }

    private createButton(label: string, y: number, onClick: () => void): void {
        const { width } = this.scale;
        const buttonWidth = Math.min(460, width * 0.7);
        const buttonHeight = 48;

        const bg = this.add.rectangle(width / 2, y, buttonWidth, buttonHeight, 0x1e293b)
            .setStrokeStyle(2, 0x475569);

        const text = this.add.text(width / 2, y, label, {
            fontSize: "20px",
            color: "#e2e8f0"
        }).setOrigin(0.5);

        bg.setInteractive({ useHandCursor: true })
            .on("pointerover", () => bg.setFillStyle(0x334155))
            .on("pointerout", () => bg.setFillStyle(0x1e293b))
            .on("pointerdown", onClick);

        text.setInteractive({ useHandCursor: true }).on("pointerdown", onClick);
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

