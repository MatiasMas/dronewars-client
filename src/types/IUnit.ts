/*
 * Esta interfaz representa una unidad.
 * Mapea a UnitSelectionDTO en el servidor
 */
import {UnitType} from "./UnitType";

export interface IUnit {
  unitId: string;
  type: UnitType,
  x: number,
  y: number,
  z: number,
  health: number
}

