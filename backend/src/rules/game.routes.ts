export type GameStatus = 'waiting' | 'playing' | 'finished';

export interface GameLike {
    status: GameStatus;
    hints_used: number;
    hints_history?: string[] | null;
}

export function shuffle<T>(arr: T[]): T[] {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}

/** Consistencia: solo se puede pedir pista en partidas en juego. */
export function isGamePlayable(game: GameLike): boolean {
    return game.status === 'playing';
}

export function hintsRemaining(game: GameLike, max: number): number {
    return Math.max(0, max - game.hints_used);
}

/** Consistencia: partida en juego + queda cupo de pistas. */
export function canRequestHint(game: GameLike, max: number): boolean {
    return isGamePlayable(game) && game.hints_used < max;
}