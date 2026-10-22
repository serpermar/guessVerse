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
    'princess-leia-organa': { is_human: true, is_hero: true, is_villain: false, is_protagonist: true, has_powers: false, uses_weapon: true, species: 'human' },
    'han-solo': { is_human: true, is_hero: true, is_villain: false, is_protagonist: true, has_powers: false, uses_weapon: true, species: 'human' },
    'darth-vader': { is_human: true, is_hero: false, is_villain: true, is_protagonist: false, has_powers: true, uses_weapon: true, species: 'human' },
    'anakin-skywalker': { is_human: true, is_hero: true, is_villain: false, is_protagonist: true, has_powers: true, uses_weapon: true, species: 'human' },
    'obi-wan-kenobi': { is_human: true, is_hero: true, is_villain: false, is_protagonist: true, has_powers: true, uses_weapon: true, species: 'human' },
    'yoda': { is_human: false, is_hero: true, is_villain: false, is_protagonist: false, has_powers: true, uses_weapon: true, species: 'alien' },
    'emperor-palpatine': { is_human: true, is_hero: false, is_villain: true, is_protagonist: false, has_powers: true, uses_weapon: false, species: 'human' },
    'chewbacca': { is_human: false, is_hero: true, is_villain: false, is_protagonist: false, has_powers: false, uses_weapon: true, species: 'wookiee' },
    'r2-d2': { is_human: false, is_hero: true, is_villain: false, is_protagonist: false, has_powers: false, uses_weapon: false, species: 'droid' },
    'c-3po': { is_human: false, is_hero: true, is_villain: false, is_protagonist: false, has_powers: false, uses_weapon: false, species: 'droid' },
    'lando-calrissian': { is_human: true, is_hero: true, is_villain: false, is_protagonist: false, has_powers: false, uses_weapon: true, species: 'human' },
    'boba-fett': { is_human: true, is_hero: false, is_villain: true, is_protagonist: false, has_powers: false, uses_weapon: true, species: 'human' },
    'kylo-ren': { is_human: true, is_hero: false, is_villain: true, is_protagonist: true, has_powers: true, uses_weapon: true, species: 'human' },
    'rey': { is_human: true, is_hero: true, is_villain: false, is_protagonist: true, has_powers: true, uses_weapon: true, species: 'human' },
    'finn': { is_human: true, is_hero: true, is_villain: false, is_protagonist: true, has_powers: false, uses_weapon: true, species: 'human' },
    'poe-dameron': { is_human: true, is_hero: true, is_villain: false, is_protagonist: true, has_powers: false, uses_weapon: true, species: 'human' },
    'padme-amidala': { is_human: true, is_hero: true, is_villain: false, is_protagonist: true, has_powers: false, uses_weapon: true, species: 'human' },
    'qui-gon-jinn': { is_human: true, is_hero: true, is_villain: false, is_protagonist: false, has_powers: true, uses_weapon: true, species: 'human' },
    'mace-windu': { is_human: true, is_hero: true, is_villain: false, is_protagonist: false, has_powers: true, uses_weapon: true, species: 'human' },
    'count-dooku': { is_human: true, is_hero: false, is_villain: true, is_protagonist: false, has_powers: true, uses_weapon: true, species: 'human' },
    'grand-moff-tarkin': { is_human: true, is_hero: false, is_villain: true, is_protagonist: false, has_powers: false, uses_weapon: false, species: 'human' },
    'maz-kanata': { is_human: false, is_hero: true, is_villain: false, is_protagonist: false, has_powers: true, uses_weapon: false, species: 'alien' },
    'supreme-leader-snoke': { is_human: false, is_hero: false, is_villain: true, is_protagonist: false, has_powers: true, uses_weapon: false, species: 'alien' },
    'captain-phasma': { is_human: true, is_hero: false, is_villain: true, is_protagonist: false, has_powers: false, uses_weapon: true, species: 'human' },
    'general-hux': { is_human: true, is_hero: false, is_villain: true, is_protagonist: false, has_powers: false, uses_weapon: false, species: 'human' },
    'allegiant-general-pryde': { is_human: true, is_hero: false, is_villain: true, is_protagonist: false, has_powers: false, uses_weapon: false, species: 'human' },
    'admiral-piett': { is_human: true, is_hero: false, is_villain: true, is_protagonist: false, has_powers: false, uses_weapon: false, species: 'human' },
    'rose-tico': { is_human: true, is_hero: true, is_villain: false, is_protagonist: false, has_powers: false, uses_weapon: false, species: 'human' },
    'jannah': { is_human: true, is_hero: true, is_villain: false, is_protagonist: false, has_powers: false, uses_weapon: true, species: 'human' },
    'zorii-bliss': { is_human: true, is_hero: true, is_villain: false, is_protagonist: false, has_powers: false, uses_weapon: true, species: 'human' },
    'vice-admiral-holdo': { is_human: true, is_hero: true, is_villain: false, is_protagonist: false, has_powers: false, uses_weapon: false, species: 'human' },
    'lor-san-tekka': { is_human: true, is_hero: true, is_villain: false, is_protagonist: false, has_powers: false, uses_weapon: false, species: 'human' },
    'commander-cody': { is_human: true, is_hero: true, is_villain: false, is_protagonist: false, has_powers: false, uses_weapon: true, species: 'human' },
    'senator-bail-organa': { is_human: true, is_hero: true, is_villain: false, is_protagonist: false, has_powers: false, uses_weapon: false, species: 'human' },
    'queen-of-naboo': { is_human: true, is_hero: true, is_villain: false, is_protagonist: false, has_powers: false, uses_weapon: true, species: 'human' },
    'shmi-skywalker': { is_human: true, is_hero: false, is_villain: false, is_protagonist: false, has_powers: false, uses_weapon: false, species: 'human' },
    'cliegg-lars': { is_human: true, is_hero: false, is_villain: false, is_protagonist: false, has_powers: false, uses_weapon: true, species: 'human' },
    'uncle-owen': { is_human: true, is_hero: false, is_villain: false, is_protagonist: false, has_powers: false, uses_weapon: false, species: 'human' },
    'aunt-beru': { is_human: true, is_hero: false, is_villain: false, is_protagonist: false, has_powers: false, uses_weapon: false, species: 'human' },
    'governor-tarkin': { is_human: true, is_hero: false, is_villain: true, is_protagonist: false, has_powers: false, uses_weapon: false, species: 'human' },
    'dorme': { is_human: true, is_hero: true, is_villain: false, is_protagonist: false, has_powers: false, uses_weapon: false, species: 'human' },
    'ki-adi-mundi': { is_human: false, is_hero: true, is_villain: false, is_protagonist: false, has_powers: true, uses_weapon: true, species: 'cerean' },
    'tion-medon': { is_human: false, is_hero: false, is_villain: false, is_protagonist: false, has_powers: false, uses_weapon: false, species: 'pau-an' },
    'watto': { is_human: false, is_hero: false, is_villain: false, is_protagonist: false, has_powers: false, uses_weapon: false, species: 'toydarian' },
    'jar-jar-binks': { is_human: false, is_hero: true, is_villain: false, is_protagonist: false, has_powers: false, uses_weapon: false, species: 'gungan' },
    'zam-wesell': { is_human: false, is_hero: false, is_villain: true, is_protagonist: false, has_powers: false, uses_weapon: true, species: 'clawdite' },
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
