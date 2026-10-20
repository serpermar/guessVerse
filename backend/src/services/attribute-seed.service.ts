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

const MARVEL_ATTRS: Record<string, Attrs> = {
    'iron-man': { is_human: true, is_hero: true, is_villain: false, is_protagonist: true, has_powers: false, uses_weapon: true, species: 'human' },
    'captain-america': { is_human: true, is_hero: true, is_villain: false, is_protagonist: true, has_powers: false, uses_weapon: true, species: 'human' },
    'thor': { is_human: false, is_hero: true, is_villain: false, is_protagonist: true, has_powers: true, uses_weapon: true, species: 'asgardian' },
    'loki': { is_human: false, is_hero: false, is_villain: true, is_protagonist: false, has_powers: true, uses_weapon: true, species: 'asgardian' },
    'black-widow': { is_human: true, is_hero: true, is_villain: false, is_protagonist: true, has_powers: false, uses_weapon: true, species: 'human' },
    'hawkeye': { is_human: true, is_hero: true, is_villain: false, is_protagonist: false, has_powers: false, uses_weapon: true, species: 'human' },
    'hulk': { is_human: false, is_hero: true, is_villain: false, is_protagonist: true, has_powers: true, uses_weapon: false, species: 'mutate' },
    'bruce-banner': { is_human: true, is_hero: true, is_villain: false, is_protagonist: false, has_powers: false, uses_weapon: false, species: 'human' },
    'nick-fury': { is_human: true, is_hero: true, is_villain: false, is_protagonist: false, has_powers: false, uses_weapon: true, species: 'human' },
    'spider-man': { is_human: false, is_hero: true, is_villain: false, is_protagonist: true, has_powers: true, uses_weapon: false, species: 'mutate' },
    'doctor-strange': { is_human: true, is_hero: true, is_villain: false, is_protagonist: true, has_powers: true, uses_weapon: false, species: 'human' },
    'black-panther': { is_human: true, is_hero: true, is_villain: false, is_protagonist: true, has_powers: true, uses_weapon: true, species: 'human' },
    'scarlet-witch': { is_human: true, is_hero: true, is_villain: false, is_protagonist: false, has_powers: true, uses_weapon: false, species: 'mutate' },
    'vision': { is_human: false, is_hero: true, is_villain: false, is_protagonist: false, has_powers: true, uses_weapon: false, species: 'synthezoid' },
    'war-machine': { is_human: true, is_hero: true, is_villain: false, is_protagonist: false, has_powers: false, uses_weapon: true, species: 'human' },
    'falcon': { is_human: true, is_hero: true, is_villain: false, is_protagonist: false, has_powers: false, uses_weapon: true, species: 'human' },
    'winter-soldier': { is_human: true, is_hero: true, is_villain: false, is_protagonist: false, has_powers: false, uses_weapon: true, species: 'human' },
    'star-lord': { is_human: false, is_hero: true, is_villain: false, is_protagonist: true, has_powers: false, uses_weapon: true, species: 'celestial' },
    'gamora': { is_human: false, is_hero: true, is_villain: false, is_protagonist: false, has_powers: true, uses_weapon: true, species: 'zehoberei' },
    'drax': { is_human: false, is_hero: true, is_villain: false, is_protagonist: false, has_powers: true, uses_weapon: true, species: 'kylosian' },
    'rocket': { is_human: false, is_hero: true, is_villain: false, is_protagonist: false, has_powers: false, uses_weapon: true, species: 'raccoon' },
    'groot': { is_human: false, is_hero: true, is_villain: false, is_protagonist: false, has_powers: true, uses_weapon: false, species: 'flora-colossus' },
    'nebula': { is_human: false, is_hero: false, is_villain: true, is_protagonist: false, has_powers: false, uses_weapon: true, species: 'luphomoid' },
    'thanos': { is_human: false, is_hero: false, is_villain: true, is_protagonist: false, has_powers: true, uses_weapon: true, species: 'titan' },
    'ant-man': { is_human: true, is_hero: true, is_villain: false, is_protagonist: true, has_powers: false, uses_weapon: false, species: 'human' },
    'wasp': { is_human: true, is_hero: true, is_villain: false, is_protagonist: false, has_powers: false, uses_weapon: false, species: 'human' },
    'pepper-potts': { is_human: true, is_hero: false, is_villain: false, is_protagonist: false, has_powers: false, uses_weapon: false, species: 'human' },
    'happy-hogan': { is_human: true, is_hero: false, is_villain: false, is_protagonist: false, has_powers: false, uses_weapon: false, species: 'human' },
    'odin': { is_human: false, is_hero: false, is_villain: false, is_protagonist: false, has_powers: true, uses_weapon: true, species: 'asgardian' },
    'heimdall': { is_human: false, is_hero: true, is_villain: false, is_protagonist: false, has_powers: true, uses_weapon: true, species: 'asgardian' },
    'jane-foster': { is_human: true, is_hero: false, is_villain: false, is_protagonist: false, has_powers: false, uses_weapon: false, species: 'human' },
    'peggy-carter': { is_human: true, is_hero: true, is_villain: false, is_protagonist: false, has_powers: false, uses_weapon: true, species: 'human' },
    'phil-coulson': { is_human: true, is_hero: true, is_villain: false, is_protagonist: false, has_powers: false, uses_weapon: true, species: 'human' },
    'maria-hill': { is_human: true, is_hero: true, is_villain: false, is_protagonist: false, has_powers: false, uses_weapon: true, species: 'human' },
    'ultron': { is_human: false, is_hero: false, is_villain: true, is_protagonist: false, has_powers: true, uses_weapon: false, species: 'ai' },
    'red-skull': { is_human: true, is_hero: false, is_villain: true, is_protagonist: false, has_powers: false, uses_weapon: true, species: 'human' },
    'obadiah-stane': { is_human: true, is_hero: false, is_villain: true, is_protagonist: false, has_powers: false, uses_weapon: true, species: 'human' },
    'crossbones': { is_human: true, is_hero: false, is_villain: true, is_protagonist: false, has_powers: false, uses_weapon: true, species: 'human' },
    'helmut-zemo': { is_human: true, is_hero: false, is_villain: true, is_protagonist: false, has_powers: false, uses_weapon: true, species: 'human' },
};

export async function seedMarvelAttributes(): Promise<{ updated: number; missing: string[] }> {
    const { data: mcu } = await supabaseAdmin
        .from('franchises')
        .select('id')
        .eq('slug', 'mcu')
        .single();

    if (!mcu) throw new Error('Franquicia "mcu" no encontrada. Ejecuta primero /api/import/marvel');

    const { data: chars } = await supabaseAdmin
        .from('characters')
        .select('id, slug')
        .eq('franchise_id', mcu.id);

    const bySlug = new Map((chars ?? []).map((c) => [c.slug, c.id]));
    const missing: string[] = [];
    let updated = 0;

    for (const [slug, attrs] of Object.entries(MARVEL_ATTRS)) {
        const id = bySlug.get(slug);
        if (!id) { missing.push(slug); continue; }
        const { error } = await supabaseAdmin
            .from('characters')
            .update(attrs)
            .eq('id', id);
        if (!error) updated++;
    }

    return { updated, missing };
}