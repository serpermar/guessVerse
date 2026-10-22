import { importMovieTheme, type ImportResult } from './import-movies.service.js';

export type { ImportResult };

/** Importa los personajes de Marvel MCU desde TMDB. */
export function importMarvelCharacters(): Promise<ImportResult> {
    return importMovieTheme('marvel');
}
