import { supabaseAdmin } from '../db/supabase.js';
import { findQuestionsByCategories, type QuestionDto } from '../repositories/questions.repository.js';
import { HttpError } from '../utils/http-error.js';

export async function getQuestionsForTheme(themeSlug: string): Promise<QuestionDto[]> {
    const { data: theme, error } = await supabaseAdmin
        .from('themes')
        .select('question_categories')
        .eq('slug', themeSlug)
        .eq('is_active', true)
        .single();
    if (error || !theme) throw HttpError.notFound(`Theme "${themeSlug}" no encontrado`);
    const cats = (theme.question_categories ?? []) as string[];
    return findQuestionsByCategories(cats);
}
