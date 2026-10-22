import { supabaseAdmin } from '../db/supabase.js';

/** Fila interna con todos los campos (uso server-side, nunca se expone). */
export interface QuestionRow {
    id: string;
    code: string;
    text_es: string;
    category: string | null;
    attribute: string;
    operator: string;
    value: unknown;
}

/** DTO público: solo lo que el cliente necesita para mostrar la pregunta. */
export interface QuestionDto {
    id: string;
    code: string;
    text_es: string;
    category: string | null;
}

export async function findQuestionsByCategories(categories: string[]): Promise<QuestionDto[]> {
    if (categories.length === 0) return [];
    const { data, error } = await supabaseAdmin
        .from('questions')
        .select('id, code, text_es, category')
        .in('category', categories)
        .eq('is_active', true)
        .order('category')
        .order('code');
    if (error) throw new Error(`Error listando preguntas: ${error.message}`);
    return data ?? [];
}
