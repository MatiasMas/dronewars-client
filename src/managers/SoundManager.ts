import Phaser from "phaser";

export class SoundManager {

    private scene: Phaser.Scene;
    private lastPlayed: Map<string, number> = new Map();
    private cooldowns: Record<string, number> = {
        unit_move: 120,
        bomb_explosion: 200,
        unit_destroyed: 150
    };

    constructor(scene: Phaser.Scene) {
        this.scene = scene;
    }

    static preload(scene: Phaser.Scene): void {

        scene.load.audio(
            "unit_move",
            "assets/sounds/825555_akelley6_droid_ui.wav"
        );

        scene.load.audio(
            "bomb_explosion",
            "assets/sounds/215595_taira_komori_bomb.mp3"
        );

        scene.load.audio(
            "unit_destroyed",
            "assets/sounds/649191_ayadrevis_explosion.ogg"
        );

        scene.load.audio(
            "Intro",
            "assets/music/Intro_Music.wav"
        );

        scene.load.audio(
            "MenuMusic",
            "assets/music/Main_Menu_Music.wav"
        );
    }

    private playWithCooldown(key: string, volume: number): void {

        const now = this.scene.time.now;
        const last = this.lastPlayed.get(key) ?? 0;
        const cooldown = this.cooldowns[key] ?? 0;

        if (now - last < cooldown) return;

        this.lastPlayed.set(key, now);

        this.scene.sound.play(key, {
            volume,
            detune: Phaser.Math.Between(-60, 60)
        });
    }

    playUnitMove(): void {
        this.playWithCooldown("unit_move", 0.35);
    }

    playExplosion(): void {
        this.playWithCooldown("bomb_explosion", 0.6);
    }

    playUnitDestroyed(): void {
        this.playWithCooldown("unit_destroyed", 0.4);
    }

    playIntro(): void {
        this.scene.sound.play("Intro", { loop: false, volume: 0.5 });
    }

    playMenuMusic(): void {
        if (!this.scene.sound.get("MenuMusic")?.isPlaying){
        this.scene.sound.play("MenuMusic", { loop: true, volume: 0.5 });
        }
    }

    stopMusic(): void {
        if (this.scene.sound.get("MenuMusic")) {
            this.scene.sound.stopByKey("MenuMusic");
        }
        if (this.scene.sound.get("Intro")) {
            this.scene.sound.stopByKey("Intro");
        }
    }

    stopAll(): void {
        this.scene.sound.stopAll();
    }
}