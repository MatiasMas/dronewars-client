import Phaser from 'phaser';
import { MainMenuScene } from "./scenes/MainMenuScene";
import { CreateGameScene } from "./scenes/CreateGameScene";
import { JoinGameScene } from "./scenes/JoinGameScene";
import { LoadGameScene } from "./scenes/LoadGameScene";
import { RankingScene } from "./scenes/RankingScene";
import { GameScene } from "./scenes/GameScene";


const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    width: window.innerWidth,
    height: window.innerHeight,
    backgroundColor: '#1a1a2e',
    scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 0, x: 0 },
            debug: false
        }
    },
    scene: [
        MainMenuScene,
        CreateGameScene,
        JoinGameScene,
        LoadGameScene,
        RankingScene,
        GameScene
    ]
};

new Phaser.Game(config);
