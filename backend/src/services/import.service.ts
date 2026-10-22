import { importCharactersFromMovies, type ImportResult } from './import-tmdb-movies.js';

const MARVEL_MOVIES = [
    { id: 1726, title: 'Iron Man' },
    { id: 10138, title: 'Iron Man 2' },
    { id: 10195, title: 'Thor' },
    { id: 1771, title: 'Captain America: The First Avenger' },
    { id: 24428, title: 'The Avengers' },
    { id: 118340, title: 'Guardians of the Galaxy' },
    { id: 271110, title: 'Captain America: Civil War' },
    { id: 299536, title: 'Avengers: Infinity War' },
    { id: 299534, title: 'Avengers: Endgame' },
];

export type { ImportResult };

export function importMarvelCharacters(): Promise<ImportResult> {
    return importCharactersFromMovies({
        themeSlug: 'marvel',
        franchise: {
            slug: 'mcu',
            name: 'Marvel Cinematic Universe',
            description: 'Películas del MCU',
        },
        movies: MARVEL_MOVIES,
        maxCastPerMovie: 10,
    });
}
