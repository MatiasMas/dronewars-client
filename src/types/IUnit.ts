import {UnitType} from "./UnitType";

export interface IUnit {
  unitId: string;
  type: UnitType,
  x: number,
  y: number,
  z: number,
  health: number,
  combustible?: number,
  municionDisponible?: number
}

