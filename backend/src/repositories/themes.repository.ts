import { supabaseAdmin } from '../db/supabase.js';

export interface ThemeRow {
    id: string;
    slug: string;
    name: string;
    description: string | null;
    type: string;
    image_url: string | null;
    source: string;
    is_active: boolean;
    created_at: string;
}

export async function findAllActiveThemes(): Promise<ThemeRow[]> {
    const { data, error } = await supabaseAdmin
        .from('themes')
        .select('id, slug, name, description, type, image_url, source, is_active, created_at')
        .eq('is_active', true)
        .order('name', { ascending: true });

    if (error) throw new Error(`Error listando themes: ${error.message}`);
    return data ?? [];
}