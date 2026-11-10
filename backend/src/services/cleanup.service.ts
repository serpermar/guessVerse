import { supabaseAdmin } from '../db/supabase.js';

export async function deduplicateCharacters(franchiseId: string) {
    // 1. Obtener todos los personajes de la franquicia con sus fuentes
    const { data: chars } = await supabaseAdmin
        .from('characters')
        .select('id, slug, name, image_url, character_sources(source, external_id)')
        .eq('franchise_id', franchiseId);

    if (!chars) return { deleted: 0 };

    const seenExternalIds = new Map<string, string>(); // external_id -> character_id
    let deleted = 0;

    for (const char of chars) {
        const source = char.character_sources?.[0];
        if (!source) continue;

        const key = `${source.source}:${source.external_id}`;

        if (seenExternalIds.has(key)) {
            // Es un duplicado. Si el original no tiene imagen y este sí, actualizamos el original.
            const originalId = seenExternalIds.get(key)!;
            const { data: original } = await supabaseAdmin.from('characters').select('image_url').eq('id', originalId).single();

            if (!original?.image_url && char.image_url) {
                await supabaseAdmin.from('characters').update({ image_url: char.image_url }).eq('id', originalId);
            }

            // Borramos el duplicado
            await supabaseAdmin.from('characters').delete().eq('id', char.id);
            deleted++;
        } else {
            seenExternalIds.set(key, char.id);
        }
    }

    return { deleted };
}