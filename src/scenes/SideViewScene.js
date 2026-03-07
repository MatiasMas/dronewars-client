const MAP_MAX_X = 6500;
const MAP_MAX_Z = 10;
const PANEL_RATIO_ALTURA = 0.2;
const PADDING = 20;
export class SideViewScene extends Phaser.Scene {
    unidades = [];
    puntosDeUnidad = new Map();
    graphics;
    panelY = 0;
    panelW = 0;
    panelH = 0;
    constructor() {
        super({ key: 'SideViewScene', active: false });
    }
    create() {
        this.panelH = Math.floor(window.innerHeight * PANEL_RATIO_ALTURA);
        this.panelW = window.innerWidth;
        this.panelY = window.innerHeight - this.panelH;
        // Ajustar la cámara de esta escena al área del panel inferior
        this.cameras.main.setViewport(0, this.panelY, this.panelW, this.panelH);
        this.cameras.main.setBackgroundColor('#a8d4ff');
        this.graphics = this.add.graphics();
        this.dibujarGrilla();
        // Escuchar eventos del juego
        this.game.events.on('altura-unidades-actualizada', (unidades) => {
            this.unidades = unidades;
            this.redibujarUnidades();
        });
        this.input.enabled = false;
    }
    dibujarGrilla() {
        const g = this.graphics;
        g.clear();
        // Fondo del panel
        g.fillStyle(0x0d1b2a, 1);
        g.fillRect(0, 0, this.panelW, this.panelH);
        // Línea de suelo (z=0)
        g.lineStyle(1, 0x334455, 0.8);
        g.lineBetween(PADDING, this.panelH - PADDING, this.panelW - PADDING, this.panelH - PADDING);
        // Líneas de altitud (z=0, 5, 10)
        g.lineStyle(1, 0x223344, 0.5);
        for (let z = 0; z <= MAP_MAX_Z; z += 2) {
            const screenY = this.zAPantalla(z);
            g.lineBetween(PADDING, screenY, this.panelW - PADDING, screenY);
            if (z % 5 === 0) {
                this.add.text(2, screenY - 6, `z=${z}`, {
                    fontSize: '9px',
                    color: '#556677'
                });
            }
        }
    }
    redibujarUnidades() {
        this.puntosDeUnidad.forEach(c => c.destroy());
        this.puntosDeUnidad.clear();
        this.unidades.forEach(unidad => {
            if (!this.esUnidadRenderizable(unidad.type)) {
                return;
            }
            if (!unidad.isPlayerUnit && !unidad.esVisible) {
                return;
            }
            const screenX = this.xAPantalla(unidad.x);
            const screenY = this.zAPantalla(unidad.z);
            const color = this.getColorUnidad(unidad.type, unidad.isPlayerUnit, unidad.health);
            const esCarrier = this.esPortadrones(unidad.type);
            const figuraUnidad = esCarrier
                ? this.add.rectangle(0, 0, 12, 12, color)
                : this.add.circle(0, 0, 6, color);
            figuraUnidad.setStrokeStyle(esCarrier ? 2 : 1, unidad.isPlayerUnit ? 0x00ff88 : 0xff4444);
            const label = this.add.text(0, -14, this.getEtiquetaUnidad(unidad.type), {
                fontSize: '9px',
                color: unidad.health <= 0 ? '#666666' : '#ffffff'
            }).setOrigin(0.5);
            const container = this.add.container(screenX, screenY, [figuraUnidad, label]);
            container.setDepth(5);
            this.puntosDeUnidad.set(unidad.unitId, container);
        });
    }
    /** Mapea X del mundo a X en pantalla del panel */
    xAPantalla(worldX) {
        const usableW = this.panelW - PADDING * 2;
        return PADDING + (worldX / MAP_MAX_X) * usableW;
    }
    /** Mapea Z del mundo a Y en pantalla del panel (Z alta = arriba) */
    zAPantalla(worldZ) {
        const usableH = this.panelH - PADDING * 2;
        return (this.panelH - PADDING) - (worldZ / MAP_MAX_Z) * usableH;
    }
    getColorUnidad(tipo, esJugador, salud) {
        if (salud <= 0)
            return 0x444444;
        const colores = {
            AERIAL_DRONE: esJugador ? 0xff6666 : 0xff2222,
            NAVAL_DRONE: esJugador ? 0x6688ff : 0x2244ff,
            AERIAL_CARRIER: esJugador ? 0xffe066 : 0xffb703,
            NAVAL_CARRIER: esJugador ? 0x72efdd : 0x00b4d8,
        };
        return colores[tipo] ?? 0xffffff;
    }
    getEtiquetaUnidad(tipo) {
        const labels = {
            AERIAL_DRONE: 'AD',
            NAVAL_DRONE: 'ND',
            AERIAL_CARRIER: 'AC',
            NAVAL_CARRIER: 'NC',
        };
        return labels[tipo] ?? '?';
    }
    esUnidadDron(tipo) {
        return tipo === 'AERIAL_DRONE' || tipo === 'NAVAL_DRONE';
    }
    esPortadrones(tipo) {
        return tipo === 'AERIAL_CARRIER' || tipo === 'NAVAL_CARRIER';
    }
    esUnidadRenderizable(tipo) {
        return this.esUnidadDron(tipo) || this.esPortadrones(tipo);
    }
}
