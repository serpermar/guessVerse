/**
 * Utilidades de texto compartidas por importadores y servicios.
 */

/** minúsculas, sin acentos, sin símbolos; guiones/guiones bajos → espacio. */
export function normalizeName(raw: string): string {
    return raw
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[-_]/g, ' ')
        .replace(/[^a-z0-9 ]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

/** Convierte un nombre en slug: minúsculas, sin acentos, separado por guiones. */
export function slugify(s: string): string {
    return s
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

/**
 * Limpia el nombre de personaje que devuelve TMDB: quita paréntesis
 * (p. ej. "(uncredited)") y se queda con el último alias si hay "A / B".
 */
export function cleanTmdbCharacterName(raw: string): string {
    let s = raw.replace(/\(.*?\)/g, '').trim();
    if (s.includes('/')) s = s.split('/').pop()!.trim();
    return s;
}

/** TMDB gender (0 desconocido, 1 mujer, 2 hombre) → string interno. */
export function mapTmdbGender(g: 0 | 1 | 2): string {
    if (g === 1) return 'female';
    if (g === 2) return 'male';
    return 'unknown';
}

/** Quita títulos/prefijos comunes que TMDB añade a los créditos. */
export function stripTitles(name: string, pattern: RegExp): string {
    return name.replace(pattern, '');
}
