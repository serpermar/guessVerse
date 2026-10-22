import { env } from '../../config/env.js';
import { fetchJson } from '../../utils/fetch.js';

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p';

/**
 * Wrapper de fetch contra TMDB.
 * - Añade el bearer token.
 * - Lanza error si la respuesta no es 2xx.
 * - Tipado genérico para que cada endpoint use su DTO.
 */
export async function tmdbFetch<T>(
    path: string,
    params: Record<string, string | number | undefined> = {}
): Promise<T> {
    const url = new URL(`${TMDB_BASE_URL}${path}`);

    for (const [key, value] of Object.entries(params)) {
        if (value !== undefined) {
            url.searchParams.set(key, String(value));
        }
    }

    return fetchJson<T>(
        url.toString(),
        {
            headers: {
                Authorization: `Bearer ${env.tmdb.accessToken}`,
                accept: 'application/json',
            },
        },
        { label: `TMDB ${path}` }
    );
}

export function tmdbImageUrl(
    path: string | null,
    size: 'w200' | 'w500' | 'original' = 'w500'
): string | null {
    if (!path) return null;
    return `${TMDB_IMAGE_BASE_URL}/${size}${path}`;
}