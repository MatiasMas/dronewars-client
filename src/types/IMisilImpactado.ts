import {IUnit} from './IUnit';

export interface IMisilImpactado{
    misilId: string;
    unidadAtaqueId: string;
    unidadDefensaId: string;
    unidadesImpactadas: IUnit[];
}
