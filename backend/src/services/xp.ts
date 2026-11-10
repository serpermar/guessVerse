/**
 * Progresión de XP/nivel (reglas puras, compartidas con el frontend).
 *
 * Nivel = floor(sqrt(xp / 100)) + 1
 *   Nivel 1 → 0 XP
 *   Nivel 2 → 400 XP
 *   Nivel 3 → 900 XP
 */

export type GameResultStatus = 'won' | 'lost' | 'abandoned';

/** XP ganada al terminar una partida. */
export function xpForGame(status: GameResultStatus, questionsAsked: number): number {
    let xp = 10; // Base por jugar
    if (status === 'won') xp += 50; // Bonus por victoria
    if (status === 'won' && questionsAsked <= 5) xp += 20; // Bonus por eficiencia
    return xp;
}

export function levelFromXp(xp: number): number {
    return Math.floor(Math.sqrt(Math.max(0, xp) / 100)) + 1;
}

export interface LevelProgress {
    level: number;
    /** XP acumulada al inicio del nivel actual. */
    levelStartXp: number;
    /** XP necesaria para completar el nivel actual. */
    levelSpan: number;
    /** XP conseguida dentro del nivel actual. */
    progressXp: number;
    /** XP restante para subir de nivel. */
    remainingXp: number;
    /** Porcentaje 0-100 dentro del nivel actual. */
    percent: number;
}

export function levelProgress(xp: number): LevelProgress {
    const safeXp = Math.max(0, Math.floor(xp));
    const level = levelFromXp(safeXp);
    const levelStartXp = 100 * (level - 1) ** 2;
    const nextLevelXp = 100 * level ** 2;
    const levelSpan = nextLevelXp - levelStartXp;
    const progressXp = safeXp - levelStartXp;

    return {
        level,
        levelStartXp,
        levelSpan,
        progressXp,
        remainingXp: nextLevelXp - safeXp,
        percent: levelSpan > 0 ? Math.min(100, Math.round((progressXp / levelSpan) * 100)) : 0,
    };
}
