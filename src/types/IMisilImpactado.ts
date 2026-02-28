import {IUnit} from './IUnit';

export interface IMisilImpactado{
    // Mantener nombres del payload del servidor.
    misilId: string;
    unidadAtaqueId: string;
    unidadDefensaId: string;
    unidadesImpactadas: IUnit[];
}
