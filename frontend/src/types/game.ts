export type GameStatus = 'waiting' | 'playing' | 'finished';

export interface Game {
    id: string;
    status: GameStatus;
    hintsUsed: number;
    hintsLeft: number;
    hintsHistory: string[];
    maxHints: number;
    // …resto de campos que ya tenías
}