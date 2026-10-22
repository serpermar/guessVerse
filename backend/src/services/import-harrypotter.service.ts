import { fetchAllHpCharacters } from '../integrations/hpapi/client.js';
import { supabaseAdmin } from '../db/supabase.js';

const THEME_SLUG = 'harry-potter';
const FRANCHISE = {
    slug: 'wizarding-world',
    name: 'Wizarding World',
    description: 'Personajes del universo Harry Potter',
};

function slugify(s: string): string {
    return s
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

function mapSpecies(raw: string): string {
    const s = raw.toLowerCase();
    if (s.includes('half-giant')) return 'half-giant';
    if (s.includes('ghost')) return 'ghost';
    if (s.includes('goblin')) return 'goblin';
    if (s.includes('house-elf')) return 'house-elf';
    if (s.includes('werewolf')) return 'werewolf';
    if (s.includes('centaur')) return 'centaur';
    return 'human';
}

export interface ImportHpResult {
    imported: number;
    skipped: number;
    updated: number;
}

export async function importHarryPotter(): Promise<ImportHpResult> {
    const { data: theme } = await supabaseAdmin
        .from('themes').select('id').eq('slug', THEME_SLUG).single();
    if (!theme) throw new Error(`Theme "${THEME_SLUG}" no encontrado`);

    const { data: franchise, error: franErr } = await supabaseAdmin
        .from('franchises')
        .upsert(
            { theme_id: theme.id, ...FRANCHISE, source: 'manual' },
            { onConflict: 'theme_id,slug' }
        )
        .select('id').single();
    if (franErr || !franchise) throw new Error(`Error franquicia: ${franErr?.message}`);

    const characters = await fetchAllHpCharacters();

    // Filtrar personajes sin nombre útil y duplicados (algunos vienen repetidos)
    const seen = new Set<string>();
    let imported = 0, updated = 0, skipped = 0;

    for (const c of characters) {
        if (!c.name || !c.name.trim()) { skipped++; continue; }
        const slug = slugify(c.name);
        if (!slug || seen.has(slug)) { skipped++; continue; }
        seen.add(slug);

        const species = mapSpecies(c.species || 'human');
        const isHuman = species === 'human';

        const payload = {
            franchise_id: franchise.id,
            slug,
            name: c.name,
            image_url: c.image || null,
            gender: c.gender === 'male' || c.gender === 'female' ? c.gender : null,
            species,
            is_human: isHuman,
            // El resto (is_hero, is_villain, is_protagonist) se rellena en el seed manual
            has_powers: c.wizard === true,
            uses_weapon: c.wizard === true, // usan varita
        };

        const { data: existing } = await supabaseAdmin
            .from('characters').select('id')
            .eq('franchise_id', franchise.id).eq('slug', slug)
            .maybeSingle();

        if (existing) {
            const { error } = await supabaseAdmin
                .from('characters').update(payload).eq('id', existing.id);
            if (error) { skipped++; continue; }
            updated++;
        } else {
            const { error } = await supabaseAdmin
                .from('characters').insert(payload);
            if (error) { skipped++; continue; }
            imported++;
        }
    }

    return { imported, updated, skipped };
}