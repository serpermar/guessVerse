import {
    findAllActiveThemes,
    findThemeBySlug,
    findCharactersByThemeId,
    type ThemeRow,
    type ThemeDetailRow,
    type CharacterPublicRow,
} from '../repositories/themes.repository.js';
import { findQuestionsByCategories } from '../repositories/questions.repository.js';
import { HttpError } from '../utils/http-error.js';

// Asumimos que QuestionDto es lo que devuelve findQuestionsByCategories
export interface ThemeDetailResponse {
    theme: ThemeDetailRow;
    characters: CharacterPublicRow[];
    questions: any[]; // Usamos any[] temporalmente si no tienes exportado QuestionDto
}

export async function listThemes(): Promise<ThemeRow[]> {
    return findAllActiveThemes();
}

export async function getThemeDetail(slug: string): Promise<ThemeDetailResponse> {
    const theme = await findThemeBySlug(slug);
    if (!theme) throw HttpError.notFound(`Temática "${slug}" no encontrada`);

    const [characters, baseQuestions] = await Promise.all([
        findCharactersByThemeId(theme.id),
        findQuestionsByCategories(theme.question_categories ?? []),
    ]);

    // Generar preguntas dinámicas basadas en las especies de los personajes
    const uniqueSpecies = new Set(
        characters
            .map((c) => c.species?.toLowerCase().trim())
            .filter((s): s is string => !!s && s !== 'human' && s !== 'humano')
    );

    const dynamicQuestions = Array.from(uniqueSpecies).map((specie) => ({
        code: `dyn_species_${specie}`,
        text_es: `¿Es un/a ${specie}?`,
        category: 'dynamic',
        // Estos campos no se envían al frontend, pero los necesitamos para el juego
        attribute: 'species',
        operator: 'eq',
        value: { v: specie },
    }));

    return {
        theme,
        characters,
        // Unimos las preguntas base con las dinámicas
        questions: [...baseQuestions, ...(dynamicQuestions as any[])]
    };
}