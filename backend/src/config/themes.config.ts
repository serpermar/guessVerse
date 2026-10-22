/**
 * Registro central de temáticas del juego.
 *
 * Cada temática declara su metadata de catálogo (nombre, descripción, tipo,
 * categorías de preguntas) y las franquicias que contiene. Los importadores
 * y los seeds de atributos se apoyan en este registro para no repetir slugs.
 */

export interface FranchiseConfig {
    slug: string;
    name: string;
    description: string;
}

export interface ThemeConfig {
    slug: string;
    name: string;
    description: string;
    type: string;
    /** Categorías de `questions.category` habilitadas para esta temática. */
    questionCategories: string[];
    franchises: FranchiseConfig[];
}

export const THEMES: ThemeConfig[] = [
    {
        slug: 'marvel',
        name: 'Marvel',
        description: 'Superhéroes y villanos del universo Marvel',
        type: 'superheroes',
        questionCategories: ['identity', 'role', 'abilities'],
        franchises: [
            {
                slug: 'mcu',
                name: 'Marvel Cinematic Universe',
                description: 'Películas del MCU',
            },
        ],
    },
    {
        slug: 'star-wars',
        name: 'Star Wars',
        description: 'Personajes de la saga galáctica',
        type: 'movies',
        questionCategories: ['identity', 'role', 'abilities'],
        franchises: [
            {
                slug: 'skywalker-saga',
                name: 'Star Wars: Skywalker Saga',
                description: 'Episodios I–IX',
            },
        ],
    },
    {
        slug: 'harry-potter',
        name: 'Harry Potter',
        description: 'Magos y criaturas del mundo mágico',
        type: 'fantasy',
        questionCategories: ['identity', 'role', 'abilities'],
        franchises: [
            {
                slug: 'wizarding-world',
                name: 'Wizarding World',
                description: 'Saga principal de Harry Potter',
            },
        ],
    },
    {
        slug: 'resident-evil',
        name: 'Resident Evil',
        description: 'Supervivientes y criaturas de Raccoon City',
        type: 'videogames',
        questionCategories: ['identity', 'role', 'abilities'],
        franchises: [
            {
                slug: 'raccoon-city',
                name: 'Resident Evil',
                description: 'Personajes de la saga Resident Evil',
            },
        ],
    },
    {
        slug: 'dc-comics',
        name: 'DC Comics',
        description: 'Héroes y villanos del universo DC',
        type: 'superheroes',
        questionCategories: ['identity', 'role', 'abilities'],
        franchises: [
            {
                slug: 'dceu',
                name: 'DC Extended Universe',
                description: 'Películas del DCEU',
            },
        ],
    },
    {
        slug: 'dragon-ball',
        name: 'Dragon Ball',
        description: 'Guerreros y villanos del universo Dragon Ball',
        type: 'anime',
        questionCategories: ['identity', 'role', 'abilities'],
        franchises: [
            {
                slug: 'dragon-ball-z',
                name: 'Dragon Ball',
                description: 'Personajes de Dragon Ball y Dragon Ball Z',
            },
        ],
    },
    {
        slug: 'pokemon',
        name: 'Pokémon',
        description: 'Pokémon y entrenadores',
        type: 'anime',
        questionCategories: ['pokemon'],
        franchises: [
            {
                slug: 'gen-1',
                name: 'Pokémon Generación 1',
                description: 'Los 50 Pokémon más icónicos de Kanto',
            },
        ],
    },
];

export function findTheme(slug: string): ThemeConfig | undefined {
    return THEMES.find((t) => t.slug === slug);
}

export function findFranchise(
    themeSlug: string,
    franchiseSlug: string
): FranchiseConfig | undefined {
    return findTheme(themeSlug)?.franchises.find((f) => f.slug === franchiseSlug);
}
