import { supabaseAdmin } from '../db/supabase.js';
import { findQuestionsByCategories, type QuestionRow } from '../repositories/questions.repository.js';

export async function getQuestionsForTheme(themeSlug: string): Promise<QuestionRow[]> {
    const { data: theme, error } = await supabaseAdmin
        .from('themes')
        .select('question_categories')
        .eq('slug', themeSlug)
        .eq('is_active', true)
        .single();
    if (error || !theme) throw new Error(`Theme "${themeSlug}" no encontrado`);
    const cats = (theme.question_categories ?? []) as string[];
    return findQuestionsByCategories(cats);
}