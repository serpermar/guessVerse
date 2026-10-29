// backend/src/services/discover.service.ts
import { tmdbFetch } from '../integrations/tmdb/client.js';

export interface DiscoveredFranchise {
    source: 'tmdb_movie' | 'tmdb_tv' | 'anilist';
    kind: 'Película' | 'Serie' | 'Anime'; // <-- NUEVO
    externalId: string;
    name: string;
    description: string;
    imageUrl: string | null;
}

async function searchTmdbMovies(query: string): Promise<DiscoveredFranchise[]> {
    const res = await tmdbFetch<any>('/search/collection', { query });
    return res.results.map((col: any) => ({
        source: 'tmdb_movie',
        kind: 'Película',
        externalId: String(col.id),
        name: col.name,
        description: col.overview || 'Sin descripción',
        imageUrl: col.poster_path ? `https://image.tmdb.org/t/p/w500${col.poster_path}` : null,
    }));
}

async function searchTmdbTv(query: string): Promise<DiscoveredFranchise[]> {
    const res = await tmdbFetch<any>('/search/tv', { query });
    return res.results.map((tv: any) => ({
        source: 'tmdb_tv',
        kind: 'Serie',
        externalId: String(tv.id),
        name: tv.name,
        description: tv.overview || 'Sin descripción',
        imageUrl: tv.poster_path ? `https://image.tmdb.org/t/p/w500${tv.poster_path}` : null,
    }));
}

interface AniListSearchResponse {
    data?: {
        Page?: {
            media?: {
                id: number;
                title: { romaji: string; english: string | null };
                description: string | null;
                coverImage: { large: string };
            }[];
        };
    };
}

async function searchAniList(query: string): Promise<DiscoveredFranchise[]> {
    const graphqlQuery = `
    query ($search: String) {
      Page(page: 1, perPage: 10) {
        media(search: $search, type: ANIME) {
          id
          title { romaji english }
          description
          coverImage { large }
        }
      }
    }
  `;

    try {
        const res = await fetch('https://graphql.anilist.co', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: graphqlQuery, variables: { search: query } }),
        });

        const data = (await res.json()) as AniListSearchResponse;

        return data.data?.Page?.media?.map((m) => ({
            source: 'anilist',
            kind: 'Anime',
            externalId: String(m.id),
            name: m.title.english || m.title.romaji,
            description: m.description?.replace(/<[^>]*>?/gm, '') || 'Sin descripción',
            imageUrl: m.coverImage.large,
        })) || [];
    } catch (e) {
        return [];
    }
}

export async function discoverFranchises(query: string): Promise<DiscoveredFranchise[]> {
    const [movies, tvs, animes] = await Promise.all([
        searchTmdbMovies(query),
        searchTmdbTv(query),
        searchAniList(query),
    ]);
    // Ordenamos para que los Animes salgan primero si existen
    return [...animes, ...movies, ...tvs];
}