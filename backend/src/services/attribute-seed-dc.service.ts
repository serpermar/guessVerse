import { supabaseAdmin } from '../db/supabase.js';

type Attrs = Partial<{
    is_hero: boolean;
    is_villain: boolean;
    is_protagonist: boolean;
    has_powers: boolean;
    uses_weapon: boolean;
}>;

const DC_ATTRS: Record<string, Attrs> = {
    // Héroes protagonistas
    'superman': { is_hero: true, is_villain: false, is_protagonist: true, has_powers: true, uses_weapon: false },
    'batman': { is_hero: true, is_villain: false, is_protagonist: true, has_powers: false, uses_weapon: true },
    'wonder-woman': { is_hero: true, is_villain: false, is_protagonist: true, has_powers: true, uses_weapon: true },
    'flash': { is_hero: true, is_villain: false, is_protagonist: true, has_powers: true, uses_weapon: false },
    'green-lantern': { is_hero: true, is_villain: false, is_protagonist: true, has_powers: true, uses_weapon: false },
    'aquaman': { is_hero: true, is_villain: false, is_protagonist: true, has_powers: true, uses_weapon: true },
    'cyborg': { is_hero: true, is_villain: false, is_protagonist: true, has_powers: true, uses_weapon: true },
    'green-arrow': { is_hero: true, is_villain: false, is_protagonist: true, has_powers: false, uses_weapon: true },
    'supergirl': { is_hero: true, is_villain: false, is_protagonist: true, has_powers: true, uses_weapon: false },
    'shazam': { is_hero: true, is_villain: false, is_protagonist: true, has_powers: true, uses_weapon: false },

    // Héroes secundarios
    'black-canary': { is_hero: true, is_villain: false, is_protagonist: false, has_powers: true, uses_weapon: false },
    'martian-manhunter': { is_hero: true, is_villain: false, is_protagonist: false, has_powers: true, uses_weapon: false },
    'nightwing': { is_hero: true, is_villain: false, is_protagonist: false, has_powers: false, uses_weapon: true },
    'robin': { is_hero: true, is_villain: false, is_protagonist: false, has_powers: false, uses_weapon: true },
    'batgirl': { is_hero: true, is_villain: false, is_protagonist: false, has_powers: false, uses_weapon: true },
    'starfire': { is_hero: true, is_villain: false, is_protagonist: false, has_powers: true, uses_weapon: false },
    'raven': { is_hero: true, is_villain: false, is_protagonist: false, has_powers: true, uses_weapon: false },
    'beast-boy': { is_hero: true, is_villain: false, is_protagonist: false, has_powers: true, uses_weapon: false },
    'blue-beetle': { is_hero: true, is_villain: false, is_protagonist: false, has_powers: true, uses_weapon: false },
    'booster-gold': { is_hero: true, is_villain: false, is_protagonist: false, has_powers: false, uses_weapon: true },

    // Villanos
    'joker': { is_hero: false, is_villain: true, is_protagonist: false, has_powers: false, uses_weapon: true },
    'lex-luthor': { is_hero: false, is_villain: true, is_protagonist: false, has_powers: false, uses_weapon: true },
    'bane': { is_hero: false, is_villain: true, is_protagonist: false, has_powers: true, uses_weapon: true },
    'two-face': { is_hero: false, is_villain: true, is_protagonist: false, has_powers: false, uses_weapon: true },
    'penguin': { is_hero: false, is_villain: true, is_protagonist: false, has_powers: false, uses_weapon: true },
    'riddler': { is_hero: false, is_villain: true, is_protagonist: false, has_powers: false, uses_weapon: false },
    'scarecrow': { is_hero: false, is_villain: true, is_protagonist: false, has_powers: false, uses_weapon: true },
    'brainiac': { is_hero: false, is_villain: true, is_protagonist: false, has_powers: true, uses_weapon: false },
    'darkseid': { is_hero: false, is_villain: true, is_protagonist: false, has_powers: true, uses_weapon: false },
    'black-adam': { is_hero: false, is_villain: true, is_protagonist: false, has_powers: true, uses_weapon: false },
    'sinestro': { is_hero: false, is_villain: true, is_protagonist: false, has_powers: true, uses_weapon: false },

    // Ambiguos (anti-héroes / neutrales)
    'harley-quinn': { is_hero: false, is_villain: false, is_protagonist: false, has_powers: false, uses_weapon: true },
    'catwoman': { is_hero: false, is_villain: false, is_protagonist: false, has_powers: false, uses_weapon: true },
    'poison-ivy': { is_hero: false, is_villain: false, is_protagonist: false, has_powers: true, uses_weapon: false },
    'deathstroke': { is_hero: false, is_villain: true, is_protagonist: false, has_powers: true, uses_weapon: true },
};

export async function seedDCAttributes(): Promise<{ updated: number; missing: string[] }> {
    const { data: franchise } = await supabaseAdmin
        .from('franchises').select('id').eq('slug', 'dc-universe').single();
    if (!franchise) throw new Error('Franquicia "dc-universe" no encontrada. Importa primero.');

    const { data: chars } = await supabaseAdmin
        .from('characters').select('id, slug').eq('franchise_id', franchise.id);

    const bySlug = new Map((chars ?? []).map((c) => [c.slug, c.id]));
    const missing: string[] = [];
    let updated = 0;

    for (const [slug, attrs] of Object.entries(DC_ATTRS)) {
        const id = bySlug.get(slug);
        if (!id) { missing.push(slug); continue; }
        const { error } = await supabaseAdmin.from('characters').update(attrs).eq('id', id);
        if (!error) updated++;
    }

    return { updated, missing };
}