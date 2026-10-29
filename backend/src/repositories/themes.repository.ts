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

export interface ThemeDetailRow extends ThemeRow {
    question_categories: string[] | null;
}

export interface CharacterPublicRow {
    id: string;
    name: string;
    image_url: string | null;
    gender: string | null;
    species: string | null;
    house: string | null;
    is_human: boolean | null;
    is_hero: boolean | null;
    is_villain: boolean | null;
    is_protagonist: boolean | null;
    has_powers: boolean | null;
    uses_weapon: boolean | null;
    attributes: Record<string, any> | null; // <-- NUEVO
}

export async function findAllActiveThemes(): Promise<ThemeRow[]> {
    const { data, error } = await supabaseAdmin
        .from('themes')
        .select('*')
        .eq('is_active', true)
        .order('name', { ascending: true });

    if (error) throw new Error(`Error listando themes: ${error.message}`);
    return data ?? [];
}

export async function findThemeBySlug(slug: string): Promise<ThemeDetailRow | null> {
    const { data, error } = await supabaseAdmin
        .from('themes')
        .select('id, slug, name, description, type, image_url, source, is_active, created_at, question_categories')
        .eq('slug', slug)
        .eq('is_active', true)
        .maybeSingle();

    if (error) throw new Error(`Error leyendo theme: ${error.message}`);
    return data;
}

export async function findCharactersByThemeId(themeId: string): Promise<CharacterPublicRow[]> {
    const { data: franchises, error: fErr } = await supabaseAdmin
        .from('franchises')
        .select('id')
        .eq('theme_id', themeId);

    if (fErr) throw new Error(`Error leyendo franquicias: ${fErr.message}`);

    const ids = (franchises ?? []).map((f) => f.id);
    if (ids.length === 0) return [];

    const { data, error } = await supabaseAdmin
        .from('characters')
        .select('id, name, image_url, gender, species, house, is_human, is_hero, is_villain, is_protagonist, has_powers, uses_weapon, attributes')
        .in('franchise_id', ids)
        .order('name', { ascending: true });

    if (error) throw new Error(`Error leyendo personajes: ${error.message}`);
    return data ?? [];
}

export async function deleteThemeById(themeId: string): Promise<void> {
  // 1. Borrar partidas asociadas a esta temática para evitar errores de FK
  await supabaseAdmin.from('games').delete().eq('theme_id', themeId);
  
  // 2. Borrar la temática (esto borrará en cascada franchises y characters)
  const { error } = await supabaseAdmin.from('themes').delete().eq('id', themeId);
  if (error) throw new Error(`Error eliminando temática: ${error.message}`);
}