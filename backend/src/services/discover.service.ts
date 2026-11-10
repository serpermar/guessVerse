// backend/src/services/discover.service.ts
import { tmdbFetch } from '../integrations/tmdb/client.js';

export type ContentType = 'Película' | 'Serie' | 'Anime' | 'Videojuego' | 'Libro' | 'Manga' | 'Cómic';

export interface DiscoveredFranchise {
    source: 'tmdb_movie' | 'tmdb_tv' | 'anilist' | 'igdb' | 'openlibrary' | 'anilist_manga' | 'comicvine';
    kind: ContentType;
    externalId: string;
    name: string;
    description: string;
    imageUrl: string | null;
}

// --- 1. TMDB (Películas y Series) ---
async function searchTmdbMovies(query: string): Promise<DiscoveredFranchise[]> {
    try {
        const res = await tmdbFetch<any>('/search/collection', { query });
        return res.results.map((col: any) => ({
            source: 'tmdb_movie', kind: 'Película', externalId: String(col.id),
            name: col.name, description: col.overview || 'Sin descripción',
            imageUrl: col.poster_path ? `https://image.tmdb.org/t/p/w500${col.poster_path}` : null,
        }));
    } catch (e) { console.error('Error buscando películas:', e); return []; }
}

async function searchTmdbTv(query: string): Promise<DiscoveredFranchise[]> {
    try {
        const res = await tmdbFetch<any>('/search/tv', { query });
        return res.results.map((tv: any) => ({
            source: 'tmdb_tv', kind: 'Serie', externalId: String(tv.id),
            name: tv.name, description: tv.overview || 'Sin descripción',
            imageUrl: tv.poster_path ? `https://image.tmdb.org/t/p/w500${tv.poster_path}` : null,
        }));
    } catch (e) { console.error('Error buscando series:', e); return []; }
}

// --- 2. AniList (Anime) ---
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
        const res = await fetch('https://graphql.anilist.co', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: graphqlQuery, variables: { search: query } }),
        });
        const data = (await res.json()) as any;
        return data?.data?.Page?.media?.map((m: any) => ({
            source: 'anilist', kind: 'Anime', externalId: String(m.id),
            name: m.title.english || m.title.romaji,
            description: m.description?.replace(/<[^>]*>?/gm, '') || 'Sin descripción',
            imageUrl: m.coverImage.large,
        })) || [];
    } catch (e) { console.error('Error buscando anime:', e); return []; }
}

// --- 3. IGDB (Videojuegos) ---
async function getIgdbToken(): Promise<string | null> {
    const clientId = process.env.IGDB_CLIENT_ID;
    const clientSecret = process.env.IGDB_CLIENT_SECRET;
    if (!clientId || !clientSecret) return null;

    try {
        const res = await fetch(`https://id.twitch.tv/oauth2/token?client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials`, { method: 'POST' });
        const data = (await res.json()) as any;
        return data.access_token || null;
    } catch (e) { console.error('Error obteniendo token IGDB:', e); return null; }
}

async function searchIgdbGames(query: string): Promise<DiscoveredFranchise[]> {
    const token = await getIgdbToken();
    if (!token) return [];

    try {
        const res = await fetch('https://api.igdb.com/v4/games', {
            method: 'POST',
            headers: { 'Client-ID': process.env.IGDB_CLIENT_ID!, 'Authorization': `Bearer ${token}`, 'Content-Type': 'text/plain' },
            body: `search "${query}"; fields name, summary, cover.url; limit 5;`
        });
        const games = (await res.json()) as any[];
        if (!Array.isArray(games)) return []; // Por si IGDB devuelve un error

        return games.map((g: any) => ({
            source: 'igdb', kind: 'Videojuego', externalId: g.id.toString(),
            name: g.name, description: g.summary || 'Sin descripción',
            imageUrl: g.cover?.url ? `https:${g.cover.url}`.replace('t_thumb', 't_cover_big') : null,
        }));
    } catch (e) { console.error('Error buscando juegos:', e); return []; }
}

// --- 4. Open Library (Libros) ---
async function searchBooks(query: string): Promise<DiscoveredFranchise[]> {
    try {
        const res = await fetch(
            `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=8&fields=key,title,author_name,first_publish_year,cover_i`,
        );
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
            // Limpiamos "/works/" para que el import service solo reciba el ID limpio.
            externalId: book.key.replace(/^\/?works\//, '').replace(/^\//, ''),
            name: book.title,
            // Autor + año como descripción corta; el import service pedirá
            // la sinopsis completa al endpoint /works/{id}.json antes de la IA.
            description: `${book.author_name?.join(', ') || 'Autor desconocido'} (${book.first_publish_year || 's.f.'})`,
            imageUrl: book.cover_i ? `https://covers.openlibrary.org/b/id/${book.cover_i}-L.jpg` : null,
        }));
    } catch (e) {
        console.error('Error buscando libros:', e);
        return [];
    }
}

// --- Orquestador principal ---
export async function discoverFranchises(query: string): Promise<DiscoveredFranchise[]> {
    const [movies, tvs, animes, mangas, games, books] = await Promise.all([
        searchTmdbMovies(query),
        searchTmdbTv(query),
        searchAniList(query),
        searchAniListManga(query),
        searchIgdbGames(query),
        searchBooks(query),
    ]);
    return [...animes, ...mangas, ...movies, ...tvs, ...games, ...books];
}

async function searchAniListManga(query: string): Promise<DiscoveredFranchise[]> {
    const graphqlQuery = `
    query ($search: String) {
      Page(page: 1, perPage: 5) {
        media(search: $search, type: MANGA) {
          id
          title { romaji english }
          description
          coverImage { large }
          format
        }
      }
    }`;

    try {
        const res = await fetch('https://graphql.anilist.co', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: graphqlQuery, variables: { search: query } }),
        });

        if (!res.ok) {
            console.warn(`[discover] AniList manga HTTP ${res.status}`);
            return [];
        }

        const data = (await res.json()) as {
            data?: {
                Page?: {
                    media?: Array<{
                        id: number;
                        title: { romaji?: string; english?: string };
                        description?: string | null;
                        coverImage?: { large?: string | null } | null;
                        format?: string | null;
                    }>;
                };
            };
        };

        return (
            data?.data?.Page?.media?.map((m) => ({
                source: 'anilist_manga' as const,
                kind: 'Manga' as const,
                externalId: String(m.id),
                name: m.title.english || m.title.romaji || 'Sin título',
                description:
                    m.description?.replace(/<[^>]*>?/gm, '') || 'Sin descripción',
                imageUrl: m.coverImage?.large ?? null,
            })) ?? []
        );
    } catch (e) {
        console.error('Error buscando manga:', e);
        return [];
    }
}