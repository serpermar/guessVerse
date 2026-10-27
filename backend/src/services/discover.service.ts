import { tmdbFetch } from '../integrations/tmdb/client.js';

export interface DiscoveredFranchise {
    source: 'tmdb';
    externalId: string;
    name: string;
    description: string;
    imageUrl: string | null;
}

interface TmdbCollection {
    id: number;
    name: string;
    overview: string;
    poster_path: string | null;
}

interface TmdbSearchResponse {
    results: TmdbCollection[];
}

export async function discoverFranchises(query: string): Promise<DiscoveredFranchise[]> {
    try {
        // Buscamos colecciones (sagas) en TMDB
        const res = await tmdbFetch<TmdbSearchResponse>('/search/collection', { query });

        return res.results.map(col => ({
            source: 'tmdb',
            externalId: String(col.id),
            name: col.name,
            description: col.overview || 'Sin descripción',
            imageUrl: col.poster_path ? `https://image.tmdb.org/t/p/w500${col.poster_path}` : null,
        }));
    } catch (error) {
        console.error('Error buscando en TMDB:', error);
        return [];
    }
}