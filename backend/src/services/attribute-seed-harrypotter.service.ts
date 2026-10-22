import { supabaseAdmin } from '../db/supabase.js';

type Attrs = Partial<{
    is_hero: boolean;
    is_villain: boolean;
    is_protagonist: boolean;
    is_human: boolean;
    house: string | null;
}>;

const HP_ATTRS: Record<string, Attrs> = {
    // Trío protagonista + mentores
    'harry-potter': { is_hero: true, is_villain: false, is_protagonist: true, house: 'Gryffindor' },
    'ron-weasley': { is_hero: true, is_villain: false, is_protagonist: true, house: 'Gryffindor' },
    'hermione-granger': { is_hero: true, is_villain: false, is_protagonist: true, house: 'Gryffindor' },
    'albus-dumbledore': { is_hero: true, is_villain: false, is_protagonist: true, house: 'Gryffindor' },
    'severus-snape': { is_hero: true, is_villain: false, is_protagonist: false, house: 'Slytherin' },
    'rubeus-hagrid': { is_hero: true, is_villain: false, is_protagonist: false, house: 'Gryffindor' },
    'minerva-mcgonagall': { is_hero: true, is_villain: false, is_protagonist: false, house: 'Gryffindor' },
    'horace-slughorn': { is_hero: true, is_villain: false, is_protagonist: false, house: 'Slytherin' },

    // Otros héroes
    'sirius-black': { is_hero: true, is_villain: false, is_protagonist: false, house: 'Gryffindor' },
    'remus-lupin': { is_hero: true, is_villain: false, is_protagonist: false, house: 'Gryffindor' },
    'ginny-weasley': { is_hero: true, is_villain: false, is_protagonist: false, house: 'Gryffindor' },
    'neville-longbottom': { is_hero: true, is_villain: false, is_protagonist: false, house: 'Gryffindor' },
    'luna-lovegood': { is_hero: true, is_villain: false, is_protagonist: false, house: 'Ravenclaw' },
    'cedric-diggory': { is_hero: true, is_villain: false, is_protagonist: false, house: 'Hufflepuff' },
    'cho-chang': { is_hero: true, is_villain: false, is_protagonist: false, house: 'Ravenclaw' },
    'kingsley-shacklebolt': { is_hero: true, is_villain: false, is_protagonist: false, house: 'Ravenclaw' },
    'arthur-weasley': { is_hero: true, is_villain: false, is_protagonist: false, house: 'Gryffindor' },
    'dobby': { is_hero: true, is_villain: false, is_protagonist: false, house: null },

    // Villanos
    'lord-voldemort': { is_hero: false, is_villain: true, is_protagonist: false, house: 'Slytherin' },
    'bellatrix-lestrange': { is_hero: false, is_villain: true, is_protagonist: false, house: 'Slytherin' },
    'lucius-malfoy': { is_hero: false, is_villain: true, is_protagonist: false, house: 'Slytherin' },
    'dolores-umbridge': { is_hero: false, is_villain: true, is_protagonist: false, house: 'Slytherin' },

    // Secundarios / neutrales
    'draco-malfoy': { is_hero: false, is_villain: false, is_protagonist: false, house: 'Slytherin' },
    'gregory-goyle': { is_hero: false, is_villain: false, is_protagonist: false, house: 'Slytherin' },
    'vincent-crabbe': { is_hero: false, is_villain: false, is_protagonist: false, house: 'Slytherin' },
    'argus-filch': { is_hero: false, is_villain: false, is_protagonist: false, is_human: true, house: null },
    'mrs-norris': { is_hero: false, is_villain: false, is_protagonist: false, is_human: false, house: null },
};

export async function seedHarryPotterAttributes(): Promise<{ updated: number; missing: string[] }> {
    const { data: franchise } = await supabaseAdmin
        .from('franchises').select('id').eq('slug', 'wizarding-world').single();
    if (!franchise) throw new Error('Franquicia "wizarding-world" no encontrada. Importa primero.');

    const { data: chars } = await supabaseAdmin
        .from('characters').select('id, slug').eq('franchise_id', franchise.id);

    const bySlug = new Map((chars ?? []).map((c) => [c.slug, c.id]));
    const missing: string[] = [];
    let updated = 0;

    for (const [slug, attrs] of Object.entries(HP_ATTRS)) {
        const id = bySlug.get(slug);
        if (!id) { missing.push(slug); continue; }
        const { error } = await supabaseAdmin.from('characters').update(attrs).eq('id', id);
        if (!error) updated++;
    }

    return { updated, missing };
}