export interface IMisilDisparado {
    // Mantener nombres del payload del servidor.
    misilId: string;
    unidadAtaqueId: string;
    unidadDefensaId: string;
    x: number;
    y: number;
    z: number;
    targetX: number;
    targetY: number;
    targetZ: number;
    municion?: number;
}
