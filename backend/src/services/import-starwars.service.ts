import { importMovieTheme, type ImportResult } from './import-movies.service.js';

export type { ImportResult };

/** Importa los personajes de Star Wars (Skywalker Saga) desde TMDB. */
export function importStarWarsCharacters(): Promise<ImportResult> {
    return importMovieTheme('star-wars');
}
