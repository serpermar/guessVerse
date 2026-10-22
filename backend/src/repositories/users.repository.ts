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