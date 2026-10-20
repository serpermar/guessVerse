import { fetchPokemon } from '../integrations/pokeapi/client.js';
import { supabaseAdmin } from '../db/supabase.js';

const THEME_SLUG = 'pokemon';
const FRANCHISE = {
    slug: 'gen-1',
    name: 'Pokémon Generación 1',
    description: 'Los 50 Pokémon más icónicos de Kanto',
};

// Los 50 primeros IDs de la Pokédex de Kanto
const POKEMON_IDS = Array.from({ length: 50 }, (_, i) => i + 1);

export interface ImportPokemonResult {
    imported: number;
    skipped: number;
    updated: number;
}

export async function importPokemon(): Promise<ImportPokemonResult> {
    const { data: theme, error: themeErr } = await supabaseAdmin
        .from('themes').select('id').eq('slug', THEME_SLUG).single();
    if (themeErr || !theme) throw new Error(`Theme "${THEME_SLUG}" no encontrado`);

    const { data: franchise, error: franErr } = await supabaseAdmin
        .from('franchises')
        .upsert(
            { theme_id: theme.id, slug: FRANCHISE.slug, name: FRANCHISE.name, description: FRANCHISE.description, source: 'manual' },
            { onConflict: 'theme_id,slug' }
        )
        .select('id').single();
    if (franErr || !franchise) throw new Error(`Error creando franchise: ${franErr?.message}`);

    let imported = 0;
    let updated = 0;
    let skipped = 0;

    for (const id of POKEMON_IDS) {
        try {
            const p = await fetchPokemon(id);
            const slug = p.name;
            const name = p.name.charAt(0).toUpperCase() + p.name.slice(1);
            const image_url = p.sprites.other['official-artwork'].front_default ?? null;
            const primaryType = p.types.find((t) => t.slot === 1)?.type.name ?? null;

            const { data: existing } = await supabaseAdmin
                .from('characters').select('id')
                .eq('franchise_id', franchise.id).eq('slug', slug).maybeSingle();

            const payload = {
                franchise_id: franchise.id,
                slug,
                name,
                image_url,
                species: primaryType,
                is_human: false,
                is_hero: false,
                is_villain: false,
                is_protagonist: false,
                has_powers: true,
                uses_weapon: false,
                gender: null,
            };

            let charId: string;
            if (existing) {
                const { data, error } = await supabaseAdmin
                    .from('characters').update(payload).eq('id', existing.id).select('id').single();
                if (error || !data) { skipped++; continue; }
                charId = data.id;
                updated++;
            } else {
                const { data, error } = await supabaseAdmin
                    .from('characters').insert(payload).select('id').single();
                if (error || !data) { skipped++; continue; }
                charId = data.id;
                imported++;
            }

            await supabaseAdmin
                .from('character_sources')
                .upsert(
                    {
                        character_id: charId,
                        source: 'pokeapi',
                        external_id: String(p.id),
                        external_type: 'pokemon',
                        raw_data: { id: p.id, name: p.name, types: p.types },
                    },
                    { onConflict: 'source,external_id,external_type' }
                );
        } catch (err) {
            console.error(`Pokémon ${id} falló:`, (err as Error).message);
            skipped++;
        }
    }

    return { imported, updated, skipped };
}