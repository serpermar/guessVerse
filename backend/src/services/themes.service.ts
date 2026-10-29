import {
    findAllActiveThemes,
    findThemeBySlug,
    findCharactersByThemeId,
    deleteThemeById, // <-- IMPORTANTE: Importar esto
    type ThemeRow,
    type ThemeDetailRow,
    type CharacterPublicRow,
} from '../repositories/themes.repository.js';
import { findQuestionsByCategories } from '../repositories/questions.repository.js';
import { HttpError } from '../utils/http-error.js';

export interface ThemeDetailResponse {
    theme: ThemeDetailRow;
    characters: CharacterPublicRow[];
    questions: any[];
    schema: any;
}

function getSchemaForTheme(theme: ThemeDetailRow) {
    const isPokemon = theme.slug.includes('pokemon');
    const isHarryPotter = theme.slug.includes('harry-potter');

    if (isPokemon) {
        return {
            tags: ['species'],
            form: [{ key: 'species', label: 'Tipo Pokémon', type: 'text', placeholder: 'Ej: Fuego, Agua...' }]
        };
    }

    if (isHarryPotter) {
        return {
            tags: ['house', 'species'],
            form: [
                { key: 'house', label: 'Casa de Hogwarts', type: 'text', placeholder: 'Ej: Gryffindor...' },
                { key: 'species', label: 'Especie', type: 'text', placeholder: 'Ej: Mago, Muggle...' }
            ]
        };
    }

    return {
        tags: ['is_hero', 'is_villain', 'has_powers', 'species'],
        form: [
            { key: 'is_hero', label: '¿Es un Héroe?', type: 'boolean' },
            { key: 'is_villain', label: '¿Es un Villano?', type: 'boolean' },
            { key: 'is_protagonist', label: '¿Es Protagonista?', type: 'boolean' },
            { key: 'has_powers', label: '¿Tiene Poderes?', type: 'boolean' },
            { key: 'uses_weapon', label: '¿Usa Armas?', type: 'boolean' },
            { key: 'is_human', label: '¿Es Humano?', type: 'boolean' },
            { key: 'species', label: 'Especie / Origen', type: 'text', placeholder: 'Ej: Atlantean, Hobbit, Elfo...' }
        ]
    };
}

export async function listThemes(): Promise<ThemeRow[]> {
    return findAllActiveThemes();
}

export async function getThemeDetail(slug: string): Promise<ThemeDetailResponse> {
    const theme = await findThemeBySlug(slug);
    if (!theme) throw HttpError.notFound(`Temática "${slug}" no encontrada`);

    const [characters, questions] = await Promise.all([
        findCharactersByThemeId(theme.id),
        findQuestionsByCategories(theme.question_categories ?? []),
    ]);

    return {
        theme,
        characters,
        questions,
        schema: getSchemaForTheme(theme)
    };
}

// NUEVA FUNCIÓN PARA ELIMINAR
export async function removeTheme(slug: string): Promise<void> {
    const theme = await findThemeBySlug(slug);
    if (!theme) throw HttpError.notFound(`Temática "${slug}" no encontrada`);

    await deleteThemeById(theme.id);
}