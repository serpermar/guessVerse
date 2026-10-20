export interface TmdbMovie {
    id: number;
    title: string;
    overview: string;
    poster_path: string | null;
    release_date: string;
    genres: { id: number; name: string }[];
}

export interface TmdbPagedResponse<T> {
    page: number;
    results: T[];
    total_pages: number;
    total_results: number;
}