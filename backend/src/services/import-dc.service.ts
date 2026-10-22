import { fetchAllAkababHeroes, type AkababHero } from '../integrations/akabab/client.js';
import { supabaseAdmin } from '../db/supabase.js';

const THEME_SLUG = 'dc-comics';
const FRANCHISE = {
    slug: 'dc-universe',
    name: 'DC Universe',
    description: 'Personajes del universo DC Comics',
};

/** Lista curada: los personajes icónicos que queremos en el tablero.
 *  El matching se hace contra name + fullName + aliases del API. */
const WANTED = [
    // Héroes
    'Superman', 'Batman', 'Wonder Woman', 'Flash', 'Green Lantern',
    'Aquaman', 'Cyborg', 'Green Arrow', 'Black Canary', 'Martian Manhunter',
    'Nightwing', 'Robin', 'Batgirl', 'Supergirl', 'Shazam',
    'Starfire', 'Raven', 'Beast Boy', 'Blue Beetle', 'Booster Gold',
    // Villanos
    'Joker', 'Lex Luthor', 'Harley Quinn', 'Catwoman', 'Bane',
    'Two-Face', 'Penguin', 'Riddler', 'Scarecrow', 'Deathstroke',
    'Brainiac', 'Darkseid', 'Poison Ivy', 'Black Adam', 'Sinestro',
];

function normalizeName(raw: string): string {
    return raw
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9 ]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function slugify(raw: string): string {
    return raw
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

function mapGender(raw: string | undefined): string | null {
    const g = (raw ?? '').toLowerCase();
    if (g === 'male') return 'male';
    if (g === 'female') return 'female';
    return null;
}

function mapAlignment(raw: string | undefined): { is_hero: boolean | null; is_villain: boolean | null } {
    const a = (raw ?? '').toLowerCase();
    if (a === 'good') return { is_hero: true, is_villain: false };
    if (a === 'bad') return { is_hero: false, is_villain: true };
    if (a === 'neutral') return { is_hero: false, is_villain: false };
    return { is_hero: null, is_villain: null };
}

function isHumanRace(raw: string | undefined): boolean | null {
    const r = (raw ?? '').toLowerCase();
    if (!r || r === '-') return null;
    if (r === 'human') return true;
    return false;
}

export interface ImportDCResult {
    total_matched: number;
    imported: number;
    updated: number;
    skipped: number;
    unmatched: string[];
}

export async function importDC(): Promise<ImportDCResult> {
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

    const all = await fetchAllAkababHeroes();
    const dc = all.filter((h) =>
        (h.biography?.publisher ?? '').toLowerCase().includes('dc')
    );
    console.log(`🔍 ${dc.length} personajes DC en akabab`);

    // Índice por todas las variantes de nombre (name + fullName + aliases)
    const byName = new Map<string, AkababHero>();
    for (const hero of dc) {
        if (!hero.images?.md) continue;
        byName.set(normalizeName(hero.name), hero);
        if (hero.biography?.fullName) byName.set(normalizeName(hero.biography.fullName), hero);
        for (const alias of hero.biography?.aliases ?? []) {
            if (alias && alias.trim() !== '') byName.set(normalizeName(alias), hero);
        }
    }

    const seen = new Set<number>();
    const unmatched: string[] = [];
    let imported = 0, updated = 0, skipped = 0;

    for (const wanted of WANTED) {
        const hero = byName.get(normalizeName(wanted));
        if (!hero) { unmatched.push(wanted); continue; }
        if (seen.has(hero.id)) { skipped++; continue; }
        seen.add(hero.id);

        const slug = slugify(hero.name);
        const alignment = mapAlignment(hero.biography?.alignment);
        const isHuman = isHumanRace(hero.appearance?.race);

        const payload = {
            franchise_id: franchise.id,
            slug,
            name: hero.name,
            image_url: hero.images.md,
            gender: mapGender(hero.appearance?.gender),
            species: hero.appearance?.race && hero.appearance.race !== '-'
                ? hero.appearance.race.toLowerCase()
                : null,
            is_human: isHuman,
            is_hero: alignment.is_hero,
            is_villain: alignment.is_villain,
            // is_protagonist / has_powers / uses_weapon: los deja null
            // y se curan en el seed manual.
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
            const { error } = await supabaseAdmin.from('characters').insert(payload);
            if (error) { skipped++; continue; }
            imported++;
        }
    }

    return {
        total_matched: seen.size,
        imported,
        updated,
        skipped,
        unmatched,
    };
}