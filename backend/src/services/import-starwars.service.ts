import { importCharactersFromMovies, type ImportResult } from './import-tmdb-movies.js';

const STAR_WARS_MOVIES = [
    { id: 11, title: 'A New Hope' },
    { id: 1891, title: 'The Empire Strikes Back' },
    { id: 1892, title: 'Return of the Jedi' },
    { id: 1893, title: 'The Phantom Menace' },
    { id: 1894, title: 'Attack of the Clones' },
    { id: 1895, title: 'Revenge of the Sith' },
    { id: 140607, title: 'The Force Awakens' },
    { id: 181808, title: 'The Last Jedi' },
    { id: 181812, title: 'The Rise of Skywalker' },
];

export type { ImportResult };

export function importStarWarsCharacters(): Promise<ImportResult> {
    return importCharactersFromMovies({
        themeSlug: 'star-wars',
        franchise: {
            slug: 'skywalker-saga',
            name: 'Star Wars: Skywalker Saga',
            description: 'Episodios I–IX',
        },
        movies: STAR_WARS_MOVIES,
        maxCastPerMovie: 15,
    });
}
