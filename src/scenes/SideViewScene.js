const MAP_MAX_X = 6500;
const MAP_MAX_Z = 10;
const PANEL_RATIO_ALTURA = 0.2;
const PADDING = 20;
export class SideViewScene extends Phaser.Scene {
    unidades = [];
    puntosDeUnidad = new Map();
    etiquetasAltitud = [];
    graphics;
    panelX = 0;
    panelY = 0;
    panelW = 0;
    panelH = 0;
    listenerAltura = null;
    constructor() {
        super({ key: 'SideViewScene', active: false });
    }
    create() {
        this.aplicarLayout();
        this.cameras.main.setBackgroundColor('#a8d4ff');
        this.graphics = this.add.graphics();
        this.dibujarGrilla();
        this.listenerAltura = (unidades) => {
            this.unidades = unidades;
            this.redibujarUnidades();
        };
        this.game.events.on('altura-unidades-actualizada', this.listenerAltura);
        this.scale.on('resize', this.manejarResize, this);
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.limpiarEscena, this);
        this.input.enabled = false;
    }
    aplicarLayout() {
        this.panelH = Math.floor(this.scale.height * PANEL_RATIO_ALTURA);
        this.panelW = Math.max(1, this.scale.width);
        this.panelX = 0;
        this.panelY = this.scale.height - this.panelH;
        this.cameras.main.setViewport(this.panelX, this.panelY, this.panelW, this.panelH);
    }
    manejarResize() {
        this.aplicarLayout();
        this.dibujarGrilla();
        this.redibujarUnidades();
    }
    limpiarEscena() {
        this.scale.off('resize', this.manejarResize, this);
        if (this.listenerAltura) {
            this.game.events.off('altura-unidades-actualizada', this.listenerAltura);
            this.listenerAltura = null;
        }
        this.puntosDeUnidad.forEach(c => c.destroy());
        this.puntosDeUnidad.clear();
        this.etiquetasAltitud.forEach(etiqueta => etiqueta.destroy());
        this.etiquetasAltitud = [];
    }
    dibujarGrilla() {
        const g = this.graphics;
        g.clear();
        this.etiquetasAltitud.forEach(etiqueta => etiqueta.destroy());
        this.etiquetasAltitud = [];
        g.fillStyle(0x0d1b2a, 1);
        g.fillRect(0, 0, this.panelW, this.panelH);
        g.lineStyle(1, 0x334455, 0.8);
        g.lineBetween(PADDING, this.panelH - PADDING, this.panelW - PADDING, this.panelH - PADDING);
        g.lineStyle(1, 0x223344, 0.5);
        for (let z = 0; z <= MAP_MAX_Z; z += 2) {
            const screenY = this.zAPantalla(z);
            g.lineBetween(PADDING, screenY, this.panelW - PADDING, screenY);
            if (z % 5 === 0) {
                const etiqueta = this.add.text(2, screenY - 6, `z=${z}`, {
                    fontSize: '9px',
                    color: '#556677'
                });
                this.etiquetasAltitud.push(etiqueta);
            }
        }
    }
    redibujarUnidades() {
        this.puntosDeUnidad.forEach(c => c.destroy());
        this.puntosDeUnidad.clear();
        const etiquetasPorUnidad = this.obtenerEtiquetasPorUnidad();
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
            const label = this.add.text(0, -14, this.getEtiquetaUnidad(unidad, etiquetasPorUnidad.get(unidad.unitId)), {
                fontSize: '9px',
                color: unidad.health <= 0 ? '#666666' : '#ffffff'
            }).setOrigin(0.5);
            const container = this.add.container(screenX, screenY, [figuraUnidad, label]);
            container.setDepth(5);
            this.puntosDeUnidad.set(unidad.unitId, container);
        });
    }
    xAPantalla(worldX) {
        const usableW = this.panelW - PADDING * 2;
        return PADDING + (worldX / MAP_MAX_X) * usableW;
    }
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
    getEtiquetaUnidad(unidad, etiqueta) {
        if (etiqueta) {
            return etiqueta;
        }
        return unidad.isPlayerUnit ? 'Dron' : 'Enemigo';
    }
    obtenerEtiquetasPorUnidad() {
        const unidadesPropiasOrdenadas = this.unidades
            .filter(unidad => unidad.isPlayerUnit && this.esUnidadRenderizable(unidad.type))
            .sort((a, b) => {
            const prioridad = this.getPrioridadTipo(a.type) - this.getPrioridadTipo(b.type);
            if (prioridad !== 0) {
                return prioridad;
            }
            return a.unitId.localeCompare(b.unitId);
        });
        const etiquetas = new Map();
        let numeroDron = 1;
        unidadesPropiasOrdenadas.forEach((unidad, index) => {
            if (this.esPortadrones(unidad.type)) {
                etiquetas.set(unidad.unitId, 'Portadron');
            }
            else {
                etiquetas.set(unidad.unitId, `Dron ${numeroDron}`);
                numeroDron += 1;
            }
        });
        return etiquetas;
    }
    getPrioridadTipo(tipo) {
        switch (tipo) {
            case 'AERIAL_CARRIER':
                return 0;
            case 'NAVAL_CARRIER':
                return 1;
            case 'AERIAL_DRONE':
                return 2;
            case 'NAVAL_DRONE':
                return 3;
            default:
                return 4;
        }
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
