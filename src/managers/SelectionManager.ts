import {IUnit} from "../types/IUnit";
import {ClientInternalEvents} from "../types/CommunicationEvents";

type ManagerCallback = (data?: any) => void;

export class SelectionManager {
  private selectedUnit: IUnit | null = null;
  private playerUnits: IUnit[] = [];
  private eventListeners: Map<string, ManagerCallback[]> = new Map();

  public getSelectedUnit(): IUnit | null {
    return this.selectedUnit;
  }

  public getPlayerUnits(): IUnit[] {
    return this.playerUnits;
  }

  public setPlayerUnits(units: IUnit[]): void {
    this.playerUnits = units;
    this.emit(ClientInternalEvents.UNITS_UPDATED, units);
  }

  public selectUnit(unitId: string): IUnit | null {
    const unit = this.playerUnits.find(unit => unit.unitId === unitId);

    if (!unit) {
      console.warn(`[SelectionManager] Unit not found: ${unitId}`);
      return null;
    }

    if (this.selectedUnit?.unitId === unitId) {
      return unit;
    }

    this.selectedUnit = unit;
    this.emit(ClientInternalEvents.SELECTION_CHANGED, unit);
    return unit;
  }

  public confirmSelection(unit: IUnit): void {
    this.selectedUnit = unit;
    this.emit(ClientInternalEvents.SELECTION_CONFIRMED, unit);
  }

  public deselectUnit(): void {
    if (this.selectedUnit) {
      this.selectedUnit = null;
      this.emit(ClientInternalEvents.SELECTION_CLEARED);
    }
  }

  public on(event: string, callback: ManagerCallback): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }

    this.eventListeners.get(event)?.push(callback);
  }

  private emit(event: string, data?: any): void {
    const callbacks = this.eventListeners.get(event);

    if (callbacks) {
      callbacks.forEach(callback => callback(data));
    }
  }
}