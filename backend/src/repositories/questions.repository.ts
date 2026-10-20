import { supabaseAdmin } from '../db/supabase.js';

export interface QuestionRow {
    id: string;
    code: string;
    text_es: string;
    category: string | null;
    attribute: string;
    operator: string;
    value: unknown;
}

export async function findQuestionsByCategories(categories: string[]): Promise<QuestionRow[]> {
    if (categories.length === 0) return [];
    const { data, error } = await supabaseAdmin
        .from('questions')
        .select('id, code, text_es, category, attribute, operator, value')
        .in('category', categories)
        .eq('is_active', true)
        .order('category')
        .order('code');
    if (error) throw new Error(`Error listando preguntas: ${error.message}`);
    return data ?? [];
}