import {IPosition} from "./IPosition";

export interface IUnitPosition {
  unitId: string;
  position: IPosition;
  combustible?: number;
}
