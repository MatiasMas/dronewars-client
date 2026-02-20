import { IUnit } from './IUnit';

export interface IBombExploded {
    bombId: string;
    attackerUnitId: string;
    x: number;
    y: number;
    impactedUnits: IUnit[];
}