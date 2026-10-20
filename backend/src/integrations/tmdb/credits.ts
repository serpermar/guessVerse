import { tmdbFetch } from './client.js';

export interface TmdbCastMember {
    id: number;              // person id
    name: string;            // nombre del actor
    character: string;       // "Tony Stark / Iron Man"
    credit_id: string;       // único por crédito
    order: number;           // 0 = protagonista
    gender: 0 | 1 | 2;       // 0 unknown, 1 female, 2 male
    profile_path: string | null;
}

export interface TmdbCreditsResponse {
    id: number;
    cast: TmdbCastMember[];
}

export async function fetchMovieCredits(movieId: number): Promise<TmdbCreditsResponse> {
    return tmdbFetch<TmdbCreditsResponse>(`/movie/${movieId}/credits`);
}