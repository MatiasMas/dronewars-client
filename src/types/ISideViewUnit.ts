export interface ISideViewUnit {
  unitId: string;
  x: number;
  y?: number;
  z: number;
  type: string;
  isPlayerUnit: boolean;
  health: number;
  combustible?: number;
  tieneEnemigoEnVision?: boolean;
  esVisible: boolean;
}
