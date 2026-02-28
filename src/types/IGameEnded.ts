export type EndReason =
    | 'ALL_UNITS_DESTROYED'
    | 'CARRIER_DESTROYED_AND_NO_RESOURCES'
    | 'CARRIER_DESTROYED_TIMEOUT_DRAW';

export interface IGameEnded {
    winnerTeamId: 'player_1' | 'player_2' | null;
    draw: boolean;
    reason: EndReason;
}