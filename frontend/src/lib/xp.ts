/**
 * Progresión de XP/nivel. Debe coincidir con `backend/src/services/xp.ts`
 * y con la RPC `record_game_result` de Supabase.
 *
 * Nivel = floor(sqrt(xp / 100)) + 1
 */

export interface LevelProgress {
    level: number;
    levelStartXp: number;
    levelSpan: number;
    progressXp: number;
    remainingXp: number;
    percent: number;
}

export function levelFromXp(xp: number): number {
    return Math.floor(Math.sqrt(Math.max(0, xp) / 100)) + 1;
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
