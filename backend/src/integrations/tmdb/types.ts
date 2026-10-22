export interface TmdbMovie {
    id: number;
    title: string;
    overview: string;
    poster_path: string | null;
    release_date: string;
    genres: { id: number; name: string }[];
}
