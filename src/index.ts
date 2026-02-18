import Phaser from 'phaser';
import {GameScene} from "./scenes/GameScene";

const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    width: 1200,
    height: 800,
    backgroundColor: '#1a1a2e',
    physics: {
        default: 'arcade',
        arcade: {
            gravity: {
                y: 0,
                x: 0
            },
            debug: false
        }
    },
    scene: [GameScene]
};

new Phaser.Game(config);