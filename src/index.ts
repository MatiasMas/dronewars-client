import Phaser from 'phaser';
import {GameScene} from "./scenes/GameScene";

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