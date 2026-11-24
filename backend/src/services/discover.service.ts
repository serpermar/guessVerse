// backend/src/services/discover.service.ts
import { tmdbFetch } from '../integrations/tmdb/client.js';

export type ContentType =
    | 'Película' | 'Serie' | 'Anime' | 'Videojuego' | 'Libro' | 'Manga' | 'Cómic';

export type DiscoverSource =
    | 'tmdb_movie' | 'tmdb_tv' | 'anilist' | 'igdb' | 'openlibrary'
    | 'anilist_manga' | 'jikan_manga' | 'comicvine'
    | 'superhero';

export interface DiscoveredFranchise {
    source: DiscoverSource;
    kind: ContentType;
    externalId: string;
    name: string;
    description: string;
    imageUrl: string | null;
}

const USER_AGENT = 'GuessVerse/1.0 (https://github.com/serpermar/guessVerse)';

async function fetchWithTimeout(
    url: string,
    ms: number,
    init: RequestInit = {},
): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    try {
        return await fetch(url, { ...init, signal: controller.signal });
    } finally {
        clearTimeout(timer);
    }
}

function normalizeText(s: string): string {
    return s
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[-_\s.]+/g, '')
        .trim();
}

const failedSources = new Map<string, number>();
const COOLDOWN_MS = 60_000;

function isOnCooldown(key: string): boolean {
    const at = failedSources.get(key);
    if (!at) return false;
    if (Date.now() - at > COOLDOWN_MS) {
        failedSources.delete(key);
        return false;
    }
    return true;
}

function markFailed(key: string, reason: string) {
    console.warn(`[discover] ${key} no disponible (${reason}). Cooldown 60s.`);
    failedSources.set(key, Date.now());
}

const searchCache = new Map<string, { at: number; data: DiscoveredFranchise[] }>();
const CACHE_TTL_MS = 60_000;

// -----------------------------------------------------------------------------
// 1. TMDB
// -----------------------------------------------------------------------------
async function searchTmdbMovies(query: string): Promise<DiscoveredFranchise[]> {
    try {
        const res = await tmdbFetch<any>('/search/collection', { query });
        return res.results.map((col: any) => ({
            source: 'tmdb_movie' as const,
            kind: 'Película' as const,
            externalId: String(col.id),
            name: col.name,
            description: col.overview || 'Sin descripción',
            imageUrl: col.poster_path ? `https://image.tmdb.org/t/p/w500${col.poster_path}` : null,
        }));
    } catch (e) {
        console.error('Error buscando películas:', e);
        return [];
    }
}

async function searchTmdbTv(query: string): Promise<DiscoveredFranchise[]> {
    try {
        const res = await tmdbFetch<any>('/search/tv', { query });
        return res.results.map((tv: any) => ({
            source: 'tmdb_tv' as const,
            kind: 'Serie' as const,
            externalId: String(tv.id),
            name: tv.name,
            description: tv.overview || 'Sin descripción',
            imageUrl: tv.poster_path ? `https://image.tmdb.org/t/p/w500${tv.poster_path}` : null,
        }));
    } catch (e) {
        console.error('Error buscando series:', e);
        return [];
    }
}

// -----------------------------------------------------------------------------
// 2. AniList (Anime + Manga)
// -----------------------------------------------------------------------------
async function searchAniList(query: string): Promise<DiscoveredFranchise[]> {
    const graphqlQuery = `
    query ($search: String) {
      Page(page: 1, perPage: 5) {
        media(search: $search, type: ANIME) {
          id title { romaji english } description coverImage { large }
        }
      }
    }`;
    try {
        const res = await fetchWithTimeout('https://graphql.anilist.co', 5000, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: graphqlQuery, variables: { search: query } }),
        });
        if (!res.ok) return [];
        const data = (await res.json()) as any;
        return data?.data?.Page?.media?.map((m: any) => ({
            source: 'anilist' as const,
            kind: 'Anime' as const,
            externalId: String(m.id),
            name: m.title.english || m.title.romaji,
            description: m.description?.replace(/<[^>]*>?/gm, '') || 'Sin descripción',
            imageUrl: m.coverImage?.large ?? null,
        })) || [];
    } catch (e) {
        console.error('Error buscando anime:', e);
        return [];
    }
}

async function searchAniListManga(query: string): Promise<DiscoveredFranchise[]> {
    const graphqlQuery = `
    query ($search: String) {
      Page(page: 1, perPage: 5) {
        media(search: $search, type: MANGA) {
          id title { romaji english } description coverImage { large }
        }
      }
    }`;
    try {
        const res = await fetchWithTimeout('https://graphql.anilist.co', 5000, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: graphqlQuery, variables: { search: query } }),
        });
        if (!res.ok) return [];
        const data = (await res.json()) as {
            data?: {
                Page?: {
                    media?: Array<{
                        id: number;
                        title: { romaji?: string; english?: string };
                        description?: string | null;
                        coverImage?: { large?: string | null } | null;
                    }>;
                };
            };
        };
        return (data?.data?.Page?.media?.map((m) => ({
            source: 'anilist_manga' as const,
            kind: 'Manga' as const,
            externalId: String(m.id),
            name: m.title.english || m.title.romaji || 'Sin título',
            description: m.description?.replace(/<[^>]*>?/gm, '') || 'Sin descripción',
            imageUrl: m.coverImage?.large ?? null,
        }))) ?? [];
    } catch (e) {
        console.error('Error buscando manga:', e);
        return [];
    }
}

// -----------------------------------------------------------------------------
// 3. Jikan (Manga alternativo)
// -----------------------------------------------------------------------------
async function searchJikanManga(query: string): Promise<DiscoveredFranchise[]> {
    if (isOnCooldown('jikan')) return [];
    try {
        const res = await fetchWithTimeout(
            `https://api.jikan.moe/v4/manga?q=${encodeURIComponent(query)}&limit=5&sfw=true`,
            3000,
            { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' } },
        );
        if (!res.ok) {
            if (res.status === 429 || res.status >= 500) markFailed('jikan', `HTTP ${res.status}`);
            return [];
        }
        const json = (await res.json()) as {
            data?: Array<{
                mal_id: number;
                title: string;
                synopsis?: string | null;
                images?: { jpg?: { image_url?: string | null } | null } | null;
            }>;
        };
        return (json.data ?? []).map((m) => ({
            source: 'jikan_manga' as const,
            kind: 'Manga' as const,
            externalId: String(m.mal_id),
            name: m.title,
            description: m.synopsis ?? 'Sin descripción',
            imageUrl: m.images?.jpg?.image_url ?? null,
        }));
    } catch (e) {
        markFailed('jikan', (e as Error).message);
        return [];
    }
}

// -----------------------------------------------------------------------------
// 4. IGDB
// -----------------------------------------------------------------------------
let igdbToken: { token: string; expiresAt: number } | null = null;

async function getIgdbToken(): Promise<string | null> {
    if (igdbToken && Date.now() < igdbToken.expiresAt) return igdbToken.token;

    const clientId = process.env.IGDB_CLIENT_ID;
    const clientSecret = process.env.IGDB_CLIENT_SECRET;
    if (!clientId || !clientSecret) return null;

    try {
        const res = await fetchWithTimeout(
            `https://id.twitch.tv/oauth2/token?client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials`,
            5000,
            { method: 'POST' },
        );
        if (!res.ok) return null;
        const data = (await res.json()) as { access_token?: string; expires_in?: number };
        if (!data.access_token) return null;
        igdbToken = {
            token: data.access_token,
            expiresAt: Date.now() + ((data.expires_in ?? 3600) - 300) * 1000,
        };
        return igdbToken.token;
    } catch (e) {
        console.error('Error obteniendo token IGDB:', e);
        return null;
    }
}

async function searchIgdbGames(query: string): Promise<DiscoveredFranchise[]> {
    if (isOnCooldown('igdb')) return [];
    const token = await getIgdbToken();
    if (!token) return [];

    try {
        const res = await fetchWithTimeout('https://api.igdb.com/v4/games', 5000, {
            method: 'POST',
            headers: {
                'Client-ID': process.env.IGDB_CLIENT_ID!,
                Authorization: `Bearer ${token}`,
                'Content-Type': 'text/plain',
            },
            body: `search "${query}"; fields name, summary, cover.url; limit 5;`,
        });
        if (!res.ok) {
            if (res.status === 401) igdbToken = null;
            if (res.status >= 500) markFailed('igdb', `HTTP ${res.status}`);
            return [];
        }
        const games = (await res.json()) as any[];
        if (!Array.isArray(games)) return [];
        return games.map((g: any) => ({
            source: 'igdb' as const,
            kind: 'Videojuego' as const,
            externalId: g.id.toString(),
            name: g.name,
            description: g.summary || 'Sin descripción',
            imageUrl: g.cover?.url ? `https:${g.cover.url}`.replace('t_thumb', 't_cover_big') : null,
        }));
    } catch (e) {
        markFailed('igdb', (e as Error).message);
        return [];
    }
}

// -----------------------------------------------------------------------------
// 5. Open Library
// -----------------------------------------------------------------------------
async function searchBooks(query: string): Promise<DiscoveredFranchise[]> {
    try {
        const res = await fetchWithTimeout(
            `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=8&fields=key,title,author_name,first_publish_year,cover_i`,
            5000,
            { headers: { 'User-Agent': USER_AGENT } },
        );
        if (!res.ok) return [];
        const data = (await res.json()) as {
            docs?: Array<{
                key: string;
                title: string;
                author_name?: string[];
                first_publish_year?: number;
                cover_i?: number;
            }>;
        };
        return (data.docs || []).map((book) => ({
            source: 'openlibrary' as const,
            kind: 'Libro' as const,
            externalId: book.key.replace(/^\/?works\//, '').replace(/^\//, ''),
            name: book.title,
            description: `${book.author_name?.join(', ') || 'Autor desconocido'} (${book.first_publish_year || 's.f.'})`,
            imageUrl: book.cover_i ? `https://covers.openlibrary.org/b/id/${book.cover_i}-L.jpg` : null,
        }));
    } catch (e) {
        console.error('Error buscando libros:', e);
        return [];
    }
}

// -----------------------------------------------------------------------------
// 6. Superhero API (Cómics) — con caché compartida
// -----------------------------------------------------------------------------
interface SuperheroApiCharacter {
    id?: number;
    name?: string | null;
    image?: { lg?: string | null; md?: string | null; sm?: string | null } | null;
    biography?: { publisher?: string | null; fullName?: string | null } | null;
}

const SUPERHERO_INDEX_TTL_MS = 30 * 60_000;
let superheroIndexCache: { data: SuperheroApiCharacter[]; at: number } | null = null;
let superheroIndexPromise: Promise<SuperheroApiCharacter[]> | null = null;

async function fetchSuperheroIndex(): Promise<SuperheroApiCharacter[]> {
    const urls = [
        'https://cdn.jsdelivr.net/gh/akabab/superhero-api@0.3.0/api/all.json',
        'https://raw.githubusercontent.com/akabab/superhero-api/master/api/all.json',
        'https://akabab.github.io/superhero-api/api/all.json',
    ];

    for (const url of urls) {
        try {
            const res = await fetchWithTimeout(url, 8000, {
                headers: { 'User-Agent': USER_AGENT },
            });
            if (!res.ok) {
                console.warn(`[superhero] ${url.split('/')[2]} → HTTP ${res.status}`);
                continue;
            }
            const json = (await res.json()) as SuperheroApiCharacter[];
            console.log(`[superhero] ✅ cargado desde ${url.split('/')[2]} (${json.length} personajes)`);
            return json;
        } catch (e) {
            console.warn(`[superhero] ${url.split('/')[2]} → ${(e as Error).message}`);
        }
    }
    console.error('[superhero] ❌ Ninguna URL respondió.');
    return [];
}

async function loadSuperheroIndex(): Promise<SuperheroApiCharacter[]> {
    if (superheroIndexCache && Date.now() - superheroIndexCache.at < SUPERHERO_INDEX_TTL_MS) {
        return superheroIndexCache.data;
    }
    if (superheroIndexPromise) return superheroIndexPromise;

    superheroIndexPromise = (async () => {
        try {
            const data = await fetchSuperheroIndex();
            superheroIndexCache = { data, at: Date.now() };
            return data;
        } finally {
            superheroIndexPromise = null;
        }
    })();

    return superheroIndexPromise;
}

async function searchSuperheroes(query: string): Promise<DiscoveredFranchise[]> {
    const all = await loadSuperheroIndex();
    if (all.length === 0) return [];

    const q = normalizeText(query);
    if (!q) return [];

    return all
        .filter((c) => {
            const name = c?.name;
            if (typeof name !== 'string' || name.length === 0) return false;
            const url = c.image?.lg ?? c.image?.md ?? c.image?.sm;
            if (typeof url !== 'string' || url.length === 0) return false;
            return normalizeText(name).includes(q);
        })
        .slice(0, 8)
        .map((c) => ({
            source: 'superhero' as const,
            kind: 'Cómic' as const,
            externalId: String(c.id ?? c.name),
            name: c.name as string,
            description: `Personaje de ${c.biography?.publisher ?? 'cómic'}${c.biography?.fullName ? ` · ${c.biography.fullName}` : ''
                }`,
            imageUrl: c.image?.lg ?? c.image?.md ?? c.image?.sm ?? null,
        }));
}

// -----------------------------------------------------------------------------
// Orquestador
// -----------------------------------------------------------------------------
export async function discoverFranchises(query: string): Promise<DiscoveredFranchise[]> {
    const key = query.toLowerCase().trim();
    const cached = searchCache.get(key);
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
        console.log(`[discover] cache hit "${key}"`);
        return cached.data;
    }

    const [superheroes, animes, mangasAniList, mangasJikan, movies, tvs, games, books] =
        await Promise.allSettled([
            searchSuperheroes(query),
            searchAniList(query),
            searchAniListManga(query),
            searchJikanManga(query),
            searchTmdbMovies(query),
            searchTmdbTv(query),
            searchIgdbGames(query),
            searchBooks(query),
        ]);

    const ordered = [superheroes, animes, mangasAniList, mangasJikan, movies, tvs, games, books];

    const flatten: DiscoveredFranchise[] = [];
    for (const r of ordered) {
        if (r.status === 'fulfilled') flatten.push(...r.value);
    }

    searchCache.set(key, { at: Date.now(), data: flatten });

    if (searchCache.size > 200) {
        const now = Date.now();
        for (const [k, v] of searchCache) {
            if (now - v.at > CACHE_TTL_MS) searchCache.delete(k);
        }
    }

    return flatten;
}