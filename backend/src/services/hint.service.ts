import { shuffle } from './game.rules.js';

export interface HintCharacter {
    id?: string;
    name: string;
    species?: string | null;
    gender?: string | null;
    is_hero?: boolean | null;
    is_villain?: boolean | null;
    attributes?: Record<string, unknown> | null;
}

/** Construye el pool de pistas disponibles para el personaje secreto. */
export function buildPossibleHints(secret: HintCharacter): string[] {
    const hints: string[] = [];

    if (secret.species) hints.push(`Es de especie: ${secret.species}`);
    if (secret.gender) {
        const g =
            secret.gender === 'male' ? 'Hombre' :
                secret.gender === 'female' ? 'Mujer' :
                    secret.gender;
        hints.push(`Es de género: ${g}`);
    }
    if (secret.is_hero) hints.push('Es un héroe');
    if (secret.is_villain) hints.push('Es un villano');

    if (secret.attributes) {
        for (const [k, v] of Object.entries(secret.attributes)) {
            if (v !== null && v !== undefined && k !== 'species') {
                hints.push(`Atributo ${k}: ${String(v)}`);
            }
        }
    }

    return hints;
}

/**
 * Devuelve una pista nueva (no presente en `alreadyGiven`).
 * Devuelve `null` si el personaje no tiene pistas posibles.
 */
export function pickNextHint(
    secret: HintCharacter,
    alreadyGiven: string[],
): string | null {
    const pool = buildPossibleHints(secret);
    if (pool.length === 0) return null;

    const remaining = pool.filter((h) => !alreadyGiven.includes(h));
    const candidates = remaining.length > 0 ? remaining : pool;
    return shuffle(candidates)[0];
}