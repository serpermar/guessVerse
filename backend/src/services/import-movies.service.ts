import { importCharactersFromMovies, type ImportResult } from './import-tmdb-movies.js';
import { findFranchise } from '../config/themes.config.js';

interface MovieRef {
    id: number;
    title: string;
}

interface MovieThemeCatalog {
    themeSlug: string;
    franchiseSlug: string;
    maxCastPerMovie: number;
    movies: MovieRef[];
}

/**
 * Catálogo de películas por temática (IDs de TMDB verificados por título y año).
 * Base para los importadores TMDB genéricos.
 */
export const MOVIE_CATALOGS: MovieThemeCatalog[] = [
    {
        themeSlug: 'marvel',
        franchiseSlug: 'mcu',
        maxCastPerMovie: 10,
        movies: [
            { id: 1726, title: 'Iron Man' },
            { id: 10138, title: 'Iron Man 2' },
            { id: 10195, title: 'Thor' },
            { id: 1771, title: 'Captain America: The First Avenger' },
            { id: 24428, title: 'The Avengers' },
            { id: 118340, title: 'Guardians of the Galaxy' },
            { id: 271110, title: 'Captain America: Civil War' },
            { id: 299536, title: 'Avengers: Infinity War' },
            { id: 299534, title: 'Avengers: Endgame' },
        ],
    },
    {
        themeSlug: 'star-wars',
        franchiseSlug: 'skywalker-saga',
        maxCastPerMovie: 15,
        movies: [
            { id: 11, title: 'A New Hope' },
            { id: 1891, title: 'The Empire Strikes Back' },
            { id: 1892, title: 'Return of the Jedi' },
            { id: 1893, title: 'The Phantom Menace' },
            { id: 1894, title: 'Attack of the Clones' },
            { id: 1895, title: 'Revenge of the Sith' },
            { id: 140607, title: 'The Force Awakens' },
            { id: 181808, title: 'The Last Jedi' },
            { id: 181812, title: 'The Rise of Skywalker' },
        ],
    },
    {
        themeSlug: 'harry-potter',
        franchiseSlug: 'wizarding-world',
        maxCastPerMovie: 12,
        movies: [
            { id: 671, title: "Harry Potter and the Philosopher's Stone" },
            { id: 672, title: 'Harry Potter and the Chamber of Secrets' },
            { id: 673, title: 'Harry Potter and the Prisoner of Azkaban' },
            { id: 674, title: 'Harry Potter and the Goblet of Fire' },
            { id: 675, title: 'Harry Potter and the Order of the Phoenix' },
            { id: 767, title: 'Harry Potter and the Half-Blood Prince' },
            { id: 12444, title: 'Harry Potter and the Deathly Hallows: Part 1' },
            { id: 12445, title: 'Harry Potter and the Deathly Hallows: Part 2' },
        ],
    },
    {
        themeSlug: 'dc-comics',
        franchiseSlug: 'dceu',
        maxCastPerMovie: 10,
        movies: [
            { id: 49521, title: 'Man of Steel' },
            { id: 209112, title: 'Batman v Superman: Dawn of Justice' },
            { id: 297762, title: 'Wonder Woman' },
            { id: 141052, title: 'Justice League' },
            { id: 297802, title: 'Aquaman' },
            { id: 287947, title: 'Shazam!' },
            { id: 436969, title: 'The Suicide Squad' },
        ],
    },
    {
        themeSlug: 'resident-evil',
        franchiseSlug: 'raccoon-city',
        maxCastPerMovie: 12,
        movies: [
            { id: 1576, title: 'Resident Evil' },
            { id: 1577, title: 'Resident Evil: Apocalypse' },
            { id: 7737, title: 'Resident Evil: Extinction' },
            { id: 35791, title: 'Resident Evil: Afterlife' },
            { id: 71679, title: 'Resident Evil: Retribution' },
            { id: 173897, title: 'Resident Evil: The Final Chapter' },
            { id: 460458, title: 'Resident Evil: Welcome to Raccoon City' },
        ],
    },
    {
        themeSlug: 'dragon-ball',
        franchiseSlug: 'dragon-ball-z',
        maxCastPerMovie: 12,
        movies: [
            { id: 126963, title: 'Dragon Ball Z: Battle of Gods' },
            { id: 303857, title: "Dragon Ball Z: Resurrection 'F'" },
            { id: 34433, title: 'Dragon Ball Z: Broly - The Legendary Super Saiyan' },
            { id: 503314, title: 'Dragon Ball Super: Broly' },
            { id: 610150, title: 'Dragon Ball Super: Super Hero' },
        ],
    },
];

export function findMovieCatalog(themeSlug: string): MovieThemeCatalog | undefined {
    return MOVIE_CATALOGS.find((c) => c.themeSlug === themeSlug);
}

/** Importa personajes de una temática basada en películas TMDB. */
export function importMovieTheme(themeSlug: string): Promise<ImportResult> {
    const catalog = findMovieCatalog(themeSlug);
    if (!catalog) throw new Error(`No hay catálogo de películas para "${themeSlug}"`);
    const franchise = findFranchise(themeSlug, catalog.franchiseSlug);
    if (!franchise) throw new Error(`Franchise "${catalog.franchiseSlug}" no declarada`);
    return importCharactersFromMovies({
        themeSlug: catalog.themeSlug,
        franchise: {
            slug: franchise.slug,
            name: franchise.name,
            description: franchise.description,
        },
        movies: catalog.movies,
        maxCastPerMovie: catalog.maxCastPerMovie,
    });
}

export type { ImportResult };
