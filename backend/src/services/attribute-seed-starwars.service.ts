import { supabaseAdmin } from '../db/supabase.js';

type Attrs = Partial<{
    is_human: boolean;
    is_hero: boolean;
    is_villain: boolean;
    is_protagonist: boolean;
    has_powers: boolean;
    uses_weapon: boolean;
    species: string;
}>;

const STAR_WARS_ATTRS: Record<string, Attrs> = {
    'luke-skywalker': { is_human: true, is_hero: true, is_villain: false, is_protagonist: true, has_powers: true, uses_weapon: true, species: 'human' },
    'leia-organa': { is_human: true, is_hero: true, is_villain: false, is_protagonist: true, has_powers: false, uses_weapon: true, species: 'human' },
    'han-solo': { is_human: true, is_hero: true, is_villain: false, is_protagonist: true, has_powers: false, uses_weapon: true, species: 'human' },
    'darth-vader': { is_human: true, is_hero: false, is_villain: true, is_protagonist: false, has_powers: true, uses_weapon: true, species: 'human' },
    'anakin-skywalker': { is_human: true, is_hero: true, is_villain: false, is_protagonist: true, has_powers: true, uses_weapon: true, species: 'human' },
    'obi-wan-kenobi': { is_human: true, is_hero: true, is_villain: false, is_protagonist: true, has_powers: true, uses_weapon: true, species: 'human' },
    'yoda': { is_human: false, is_hero: true, is_villain: false, is_protagonist: false, has_powers: true, uses_weapon: true, species: 'alien' },
    'emperor-palpatine': { is_human: true, is_hero: false, is_villain: true, is_protagonist: false, has_powers: true, uses_weapon: false, species: 'human' },
    'darth-sidious': { is_human: true, is_hero: false, is_villain: true, is_protagonist: false, has_powers: true, uses_weapon: false, species: 'human' },
    'chewbacca': { is_human: false, is_hero: true, is_villain: false, is_protagonist: false, has_powers: false, uses_weapon: true, species: 'wookiee' },
    'r2-d2': { is_human: false, is_hero: true, is_villain: false, is_protagonist: false, has_powers: false, uses_weapon: false, species: 'droid' },
    'c-3po': { is_human: false, is_hero: true, is_villain: false, is_protagonist: false, has_powers: false, uses_weapon: false, species: 'droid' },
    'bb-8': { is_human: false, is_hero: true, is_villain: false, is_protagonist: false, has_powers: false, uses_weapon: false, species: 'droid' },
    'lando-calrissian': { is_human: true, is_hero: true, is_villain: false, is_protagonist: false, has_powers: false, uses_weapon: true, species: 'human' },
    'boba-fett': { is_human: true, is_hero: false, is_villain: true, is_protagonist: false, has_powers: false, uses_weapon: true, species: 'human' },
    'jabba-the-hutt': { is_human: false, is_hero: false, is_villain: true, is_protagonist: false, has_powers: false, uses_weapon: false, species: 'hutt' },
    'kylo-ren': { is_human: true, is_hero: false, is_villain: true, is_protagonist: true, has_powers: true, uses_weapon: true, species: 'human' },
    'ben-solo': { is_human: true, is_hero: false, is_villain: true, is_protagonist: true, has_powers: true, uses_weapon: true, species: 'human' },
    'rey': { is_human: true, is_hero: true, is_villain: false, is_protagonist: true, has_powers: true, uses_weapon: true, species: 'human' },
    'finn': { is_human: true, is_hero: true, is_villain: false, is_protagonist: true, has_powers: false, uses_weapon: true, species: 'human' },
    'poe-dameron': { is_human: true, is_hero: true, is_villain: false, is_protagonist: true, has_powers: false, uses_weapon: true, species: 'human' },
    'padme-amidala': { is_human: true, is_hero: true, is_villain: false, is_protagonist: true, has_powers: false, uses_weapon: true, species: 'human' },
    'padmé-amidala': { is_human: true, is_hero: true, is_villain: false, is_protagonist: true, has_powers: false, uses_weapon: true, species: 'human' },
    'qui-gon-jinn': { is_human: true, is_hero: true, is_villain: false, is_protagonist: false, has_powers: true, uses_weapon: true, species: 'human' },
    'mace-windu': { is_human: true, is_hero: true, is_villain: false, is_protagonist: false, has_powers: true, uses_weapon: true, species: 'human' },
    'count-dooku': { is_human: true, is_hero: false, is_villain: true, is_protagonist: false, has_powers: true, uses_weapon: true, species: 'human' },
    'darth-maul': { is_human: false, is_hero: false, is_villain: true, is_protagonist: false, has_powers: true, uses_weapon: true, species: 'zabrak' },
    'general-grievous': { is_human: false, is_hero: false, is_villain: true, is_protagonist: false, has_powers: false, uses_weapon: true, species: 'cyborg' },
    'grand-moff-tarkin': { is_human: true, is_hero: false, is_villain: true, is_protagonist: false, has_powers: false, uses_weapon: false, species: 'human' },
    'snoke': { is_human: false, is_hero: false, is_villain: true, is_protagonist: false, has_powers: true, uses_weapon: false, species: 'alien' },
    'maz-kanata': { is_human: false, is_hero: true, is_villain: false, is_protagonist: false, has_powers: true, uses_weapon: false, species: 'alien' },
    'admiral-ackbar': { is_human: false, is_hero: true, is_villain: false, is_protagonist: false, has_powers: false, uses_weapon: false, species: 'mon-calamari' },
    'jyn-erso': { is_human: true, is_hero: true, is_villain: false, is_protagonist: true, has_powers: false, uses_weapon: true, species: 'human' },
};

export async function seedStarWarsAttributes(): Promise<{ updated: number; missing: string[] }> {
    const { data: mcu } = await supabaseAdmin
        .from('franchises').select('id').eq('slug', 'skywalker-saga').single();
    if (!mcu) throw new Error('Franquicia "skywalker-saga" no encontrada. Ejecuta primero /api/import/starwars');

    const { data: chars } = await supabaseAdmin
        .from('characters').select('id, slug').eq('franchise_id', mcu.id);

    const bySlug = new Map((chars ?? []).map((c) => [c.slug, c.id]));
    const missing: string[] = [];
    let updated = 0;

    for (const [slug, attrs] of Object.entries(STAR_WARS_ATTRS)) {
        const id = bySlug.get(slug);
        if (!id) { missing.push(slug); continue; }
        const { error } = await supabaseAdmin.from('characters').update(attrs).eq('id', id);
        if (!error) updated++;
    }

    return { updated, missing };
}