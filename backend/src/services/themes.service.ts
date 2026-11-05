import {
    findAllActiveThemes,
    findThemeBySlug,
    findCharactersByThemeId,
    deleteThemeById,
    type ThemeRow,
    type ThemeDetailRow,
    type CharacterPublicRow,
} from '../repositories/themes.repository.js';
import { findQuestionsByCategories, findCustomQuestionsByThemeId } from '../repositories/questions.repository.js';
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
            form: [
                { key: 'species', label: 'Tipo Pokémon', type: 'text', placeholder: 'Ej: Fuego, Agua, Planta...' }
            ]
        };
    }

    if (isHarryPotter) {
        return {
            tags: ['house', 'species'],
            form: [
                { key: 'house', label: 'Casa de Hogwarts', type: 'text', placeholder: 'Ej: Gryffindor, Slytherin...' },
                { key: 'species', label: 'Especie / Rol', type: 'text', placeholder: 'Ej: Mago, Muggle, Elfo...' }
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
            { key: 'is_royal', label: '¿Es de la realeza?', type: 'boolean' },
            { key: 'is_soldier', label: '¿Es un soldado?', type: 'boolean' },
            { key: 'is_scientist', label: '¿Es un científico?', type: 'boolean' },
            { key: 'is_alien', label: '¿Es un alienígena?', type: 'boolean' },
            { key: 'is_mutant', label: '¿Es un mutante?', type: 'boolean' },
            { key: 'has_magic', label: '¿Usa magia?', type: 'boolean' },
            { key: 'is_immortal', label: '¿Es inmortal?', type: 'boolean' },
            { key: 'is_criminal', label: '¿Es un criminal?', type: 'boolean' },
            { key: 'species', label: 'Especie / Rol', type: 'text', placeholder: 'Ej: Atlantean, Hobbit, Elfo...' }
        ]
    };
}

export async function listThemes(): Promise<ThemeRow[]> {
    return findAllActiveThemes();
}

export async function getThemeDetail(slug: string): Promise<ThemeDetailResponse> {
    const theme = await findThemeBySlug(slug);
    if (!theme) throw HttpError.notFound(`Temática "${slug}" no encontrada`);

    const [characters, baseQuestions, customQuestions] = await Promise.all([
        findCharactersByThemeId(theme.id),
        findQuestionsByCategories(theme.question_categories ?? []),
        findCustomQuestionsByThemeId(theme.id)
    ]);

    // CORRECCIÓN: Usamos el texto (text_es) como clave para que no se dupliquen visualmente
    const questionMap = new Map();
    [...baseQuestions, ...customQuestions].forEach(q => questionMap.set(q.text_es, q));
    const questions = Array.from(questionMap.values());

    const schema = getSchemaForTheme(theme);

    // Inyectamos las preguntas custom en el formulario de edición (evitando duplicados)
    const uniqueCustomAttrs = new Set();
    customQuestions.forEach((q: any) => {
        if (!uniqueCustomAttrs.has(q.attribute)) {
            uniqueCustomAttrs.add(q.attribute);
            schema.form.push({
                key: q.attribute,
                label: q.text_es,
                type: 'boolean'
            });
        }
    });

    return {
        theme,
        characters,
        questions,
        schema
    };
}

export async function removeTheme(slug: string): Promise<void> {
    const theme = await findThemeBySlug(slug);
    if (!theme) throw HttpError.notFound(`Temática "${slug}" no encontrada`);

    await deleteThemeById(theme.id);
}