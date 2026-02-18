/*
 * This interface represents a unit.
 * Maps to UnitSelectionDTO on the server
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

