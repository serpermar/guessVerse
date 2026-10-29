import { supabaseAdmin } from '../db/supabase.js';
import { findQuestionsByCategories, type QuestionDto } from '../repositories/questions.repository.js';
import { findCharactersByThemeId } from '../repositories/themes.repository.js';

export async function getQuestionsForTheme(themeSlug: string): Promise<QuestionDto[]> {
    const { data: theme, error } = await supabaseAdmin
        .from('themes')
        .select('id, question_categories')
        .eq('slug', themeSlug)
        .eq('is_active', true)
        .single();

    if (error || !theme) throw new Error(`Theme "${themeSlug}" no encontrado`);

    const cats = (theme.question_categories ?? []) as string[];
    const baseQuestions = await findQuestionsByCategories(cats);

    const characters = await findCharactersByThemeId(theme.id);

    // LEER TANTO DE 'attributes' COMO DE LA COLUMNA ANTIGUA 'species'
    const uniqueSpecies = new Set(
        characters
            .map((c) => {
                const spec = c.attributes?.species || c.species;
                return spec ? spec.toLowerCase().trim() : null;
            })
            .filter((s): s is string => !!s && s !== 'human' && s !== 'humano')
    );

    const dynamicQuestions: QuestionDto[] = Array.from(uniqueSpecies).map((specie) => ({
        id: `dyn_${specie}`,
        code: `dyn_species_${specie.replace(/\s+/g, '_')}`,
        text_es: `¿Es un/a ${specie}?`,
        category: 'dynamic',
    }));

    return [...baseQuestions, ...dynamicQuestions];
}