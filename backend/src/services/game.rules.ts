/**
 * Reglas puras del juego (sin dependencias de DB/env), fáciles de testear.
 */

export const BOARD_SIZE_MIN = 4;
export const BOARD_SIZE_MAX = 32;
export const BOARD_SIZE_DEFAULT = 16;

export type Answer = 'yes' | 'no' | 'unknown';

/** Evalúa el atributo del personaje contra la condición de la pregunta. */
export function evaluate(value: unknown, operator: string, expected: unknown): Answer {
    if (value === null || value === undefined) return 'unknown';

    // Normalizar strings para comparar
    const normalize = (v: unknown) =>
        typeof v === 'string' ? v.toLowerCase().trim() : v;

    const v = normalize(value);
    const e = normalize(expected);

    switch (operator) {
        case 'eq':
            return v === e ? 'yes' : 'no';
        case 'ne':
            return v !== e ? 'yes' : 'no';
        case 'in':
            return Array.isArray(e) && e.includes(v) ? 'yes' : 'no';
        case 'not_in':
            return Array.isArray(e) && !e.includes(v) ? 'yes' : 'no';
        default:
            return 'unknown';
    }
}

/** Ajusta el tamaño de tablero a un entero dentro de [MIN, MAX]. */
export function clampBoardSize(raw: unknown): number {
    const n = Number(raw);
    if (!Number.isFinite(n)) return BOARD_SIZE_DEFAULT;
    return Math.min(BOARD_SIZE_MAX, Math.max(BOARD_SIZE_MIN, Math.trunc(n)));
}

/** Fisher-Yates: shuffle uniforme (no sesgado como `.sort(random)`). */
export function shuffle<T>(input: T[]): T[] {
    const arr = [...input];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}
