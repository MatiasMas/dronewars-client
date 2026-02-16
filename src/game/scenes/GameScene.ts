import {SocketClient} from "../../network/SocketClient";

export class GameScene extends Phaser.Scene {
    private socket!: SocketClient;
    private myPlayer!: Phaser.GameObjects.Arc;
    private enemyPlayer!: Phaser.GameObjects.Arc;

    constructor() {
        super('GameScene');
    }

    create() {
        this.myPlayer = this.add.circle(100, 100, 50, 0xff0000);
        this.enemyPlayer = this.add.circle(100, 100, 50, 0xff0000);

        this.socket = new SocketClient((data) => {
            this.enemyPlayer.setPosition(data.x, data.y);
        });

        this.input.keyboard?.on('keydown', (event: KeyboardEvent) => {
            switch (event.key) {
                case 'ArrowUp':
                    this.myPlayer.y -= 10;
                    break;
                case 'ArrowDown':
                    this.myPlayer.y += 10;
                    break;
                case 'ArrowLeft':
                    this.myPlayer.x -= 10;
                    break;
                case 'ArrowRight':
                    this.myPlayer.x += 10;
            }

            this.socket.sendPosition(this.myPlayer.x, this.myPlayer.y);
        })
    }
}