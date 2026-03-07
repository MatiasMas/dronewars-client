import { ClientInternalEvents } from "../types/CommunicationEvents";
export class SelectionManager {
    selectedUnit = null;
    playerUnits = [];
    eventListeners = new Map();
    getSelectedUnit() {
        return this.selectedUnit;
    }
    getPlayerUnits() {
        return this.playerUnits;
    }
    setPlayerUnits(units) {
        this.playerUnits = units;
        this.emit(ClientInternalEvents.UNITS_UPDATED, units);
    }
    selectUnit(unitId) {
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
    confirmSelection(unit) {
        this.selectedUnit = unit;
        this.emit(ClientInternalEvents.SELECTION_CONFIRMED, unit);
    }
    updateUnitPosition(unitId, position) {
        const unit = this.playerUnits.find(unit => unit.unitId === unitId);
        if (!unit) {
            return;
        }
        unit.x = position.x;
        unit.y = position.y;
        unit.z = position.z;
        if (this.selectedUnit?.unitId === unitId) {
            this.selectedUnit = unit;
        }
    }
    deselectUnit() {
        if (this.selectedUnit) {
            this.selectedUnit = null;
            this.emit(ClientInternalEvents.SELECTION_CLEARED);
        }
    }
    on(event, callback) {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, []);
        }
        this.eventListeners.get(event)?.push(callback);
    }
    emit(event, data) {
        const callbacks = this.eventListeners.get(event);
        if (callbacks) {
            callbacks.forEach(callback => callback(data));
        }
    }
}
