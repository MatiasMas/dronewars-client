export class SocketClient {
    private socket: WebSocket;

    constructor(onMessage: (data: any) => void) {
        this.socket = new WebSocket('ws://localhost:8080/game');

        this.socket.onopen = () => {
            console.log('Conectado al servidor');
        }

        this.socket.onmessage = (event) => {
            const data = JSON.parse(event.data);
            onMessage(data);
        }
    }

    sendPosition(x: number, y: number) {
        this.socket.send(JSON.stringify({x, y}));
    }
}
