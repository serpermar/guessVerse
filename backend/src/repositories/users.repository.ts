import { supabaseAdmin } from '../db/supabase.js';

export interface UserProfileRow {
    id: string;
    email: string;
    username: string;
    avatar_url: string | null;
    created_at: string;
    updated_at: string;
}

export async function findUserById(id: string): Promise<UserProfileRow | null> {
    const { data, error } = await supabaseAdmin
        .from('users')
        .select('id, email, username, avatar_url, created_at, updated_at')
        .eq('id', id)
        .maybeSingle();
    if (error) throw new Error(`Error leyendo usuario: ${error.message}`);
    return data;
}

export async function updateUser(
    id: string,
    patch: Partial<Pick<UserProfileRow, 'username' | 'avatar_url'>>
): Promise<UserProfileRow> {
    const { data, error } = await supabaseAdmin
        .from('users')
        .update(patch)
        .eq('id', id)
        .select('id, email, username, avatar_url, created_at, updated_at')
        .single();
    if (error || !data) throw new Error(`Error actualizando usuario: ${error?.message}`);
    return data;
}

export async function deleteThemeById(themeId: string): Promise<void> {
    // 1. Borrar partidas asociadas a esta temática
    const { error: gamesError } = await supabaseAdmin
        .from('games')
        .delete()
        .eq('theme_id', themeId);

    if (gamesError) {
        console.warn(`Aviso al borrar partidas: ${gamesError.message}`);
    }

    // 2. Borrar la temática
    const { error } = await supabaseAdmin.from('themes').delete().eq('id', themeId);
    if (error) throw new Error(`Error eliminando temática: ${error.message}`);
}