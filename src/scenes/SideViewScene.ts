import {ILateralUnit} from "../types/ILateralUnit";

const MAP_MAX_X = 6500;
const MAP_MAX_Z = 10;
const PANEL_RATIO_ALTURA = 0.2;
const PADDING = 20;

export class SideViewScene extends Phaser.Scene {
  private unidades: ILateralUnit[] = [];
  private puntosDeUnidad: Map<string, Phaser.GameObjects.Container> = new Map();
  private graphics!: Phaser.GameObjects.Graphics;
  private panelY = 0;
  private panelW = 0;
  private panelH = 0;

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
    this.game.events.on('altura-unidades-actualizada', (unidades: ILateralUnit[]) => {
      this.unidades = unidades;
      this.redibujarUnidades();
    });

    this.input.enabled = false;
  }

  private dibujarGrilla() {
    const g = this.graphics;
    g.clear();

    // Fondo del panel
    g.fillStyle(0x0d1b2a, 1);
    g.fillRect(0, 0, this.panelW, this.panelH);

    // Borde superior
    g.lineStyle(1, 0x00ff88, 0.6);
    g.lineBetween(0, 0, this.panelW, 0);

    // Etiqueta
    this.add.text(4, 2, 'Vista Lateral', {
      fontSize: '10px',
      color: '#00ff88'
    }).setDepth(10);

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

  private redibujarUnidades() {
    this.puntosDeUnidad.forEach(c => c.destroy());
    this.puntosDeUnidad.clear();

    this.unidades.forEach(unidad => {
      const screenX = this.xAPantalla(unidad.x);
      const screenY = this.zAPantalla(unidad.z);

      const color = this.getColorUnidad(unidad.tipo, unidad.esUnidadJugador, unidad.salud);

      const dot = this.add.circle(0, 0, 6, color);
      dot.setStrokeStyle(1, unidad.esUnidadJugador ? 0x00ff88 : 0xff4444);

      const label = this.add.text(0, -14, this.getEtiquetaUnidad(unidad.tipo), {
        fontSize: '9px',
        color: unidad.salud <= 0 ? '#666666' : '#ffffff'
      }).setOrigin(0.5);

      const container = this.add.container(screenX, screenY, [dot, label]);
      container.setDepth(5);
      this.puntosDeUnidad.set(unidad.idUnidad, container);
    });
  }

  /** Mapea X del mundo a X en pantalla del panel */
  private xAPantalla(worldX: number): number {
    const usableW = this.panelW - PADDING * 2;
    return PADDING + (worldX / MAP_MAX_X) * usableW;
  }

  /** Mapea Z del mundo a Y en pantalla del panel (Z alta = arriba) */
  private zAPantalla(worldZ: number): number {
    const usableH = this.panelH - PADDING * 2;
    return (this.panelH - PADDING) - (worldZ / MAP_MAX_Z) * usableH;
  }

  private getColorUnidad(tipo: string, esJugador: boolean, salud: number): number {
    if (salud <= 0) return 0x444444;
    const colores: Record<string, number> = {
      AERIAL_DRONE:  esJugador ? 0xff6666 : 0xff2222,
      NAVAL_DRONE:   esJugador ? 0x6688ff : 0x2244ff,
      AERIAL_CARRIER: 0xffff00,
      NAVAL_CARRIER:  0x00ff88,
    };
    return colores[tipo] ?? 0xffffff;
  }

  private getEtiquetaUnidad(tipo: string): string {
    const labels: Record<string, string> = {
      AERIAL_DRONE: 'AD',
      NAVAL_DRONE: 'ND',
      AERIAL_CARRIER: 'AC',
      NAVAL_CARRIER: 'NC',
    };
    return labels[tipo] ?? '?';
  }
}