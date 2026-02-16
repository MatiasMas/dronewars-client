import Phaser from "phaser";
import {GameScene} from "./game/scenes/GameScene";

new Phaser.Game({
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    parent: "game",
    backgroundColor: "#ffb0b0",
    scene: [GameScene]
});