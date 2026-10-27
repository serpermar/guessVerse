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

    const [characters, questions] = await Promise.all([
        findCharactersByThemeId(theme.id),
        findQuestionsByCategories(theme.question_categories ?? []),
    ]);

    return { theme, characters, questions };
}