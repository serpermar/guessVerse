import { supabaseAdmin } from '../db/supabase.js';
import { normalizeName } from '../utils/text.js';

const AKABAB_SW_ALL = 'https://akabab.github.io/starwars-api/api/all.json';

interface AkababSwCharacter {
    id: number;
    name: string;
    image?: string;
}

/** Quita títulos/prefijos comunes que TMDB añade a los créditos. */
function stripTitles(name: string): string {
    return name.replace(
        /^(darth|general|grand moff|moff|captain|colonel|commander|admiral|senator|chancellor|supreme chancellor|master|the|king|queen|princess|jedi|sith|boba|bail prestor)\s+/i,
        ''
    );
}

/** Alias manuales para casos que la API no cubre por nombre exacto. */
const MANUAL_ALIASES: Record<string, string> = {
    // nombre normalizado en nuestra BD → nombre en akabab SW API
    'obi wan ben kenobi': 'Obi-Wan Kenobi',
    'ben kenobi': 'Obi-Wan Kenobi',
    'obiwan kenobi': 'Obi-Wan Kenobi',
    'anakin skywalker': 'Anakin Skywalker',
    'darth vader': 'Darth Vader',
    'darth sidious': 'Palpatine',
    'senator palpatine': 'Palpatine',
    'emperor palpatine': 'Palpatine',
    'chancellor palpatine': 'Palpatine',
    'sheev palpatine': 'Palpatine',
    'count dooku': 'Dooku',
    'darth tyranus': 'Dooku',
    'padme amidala': 'Padmé Amidala',
    'padme': 'Padmé Amidala',
    'amidala': 'Padmé Amidala',
    'princess leia': 'Leia Organa',
    'leia': 'Leia Organa',
    'general grievous': 'Grievous',
    'mace windu': 'Mace Windu',
    'emperor': 'Palpatine',
    'rey skywalker': 'Rey',
    'ben solo': 'Kylo Ren',
    'kylo ren': 'Kylo Ren',
    'bb 8': 'BB8',
    'bb-8': 'BB8',
    'c3po': 'C-3PO',
    'c 3po': 'C-3PO',
    'r2 d2': 'R2-D2',
    'r2d2': 'R2-D2',
    'grand moff tarkin': 'Wilhuff Tarkin',
    'governor tarkin': 'Wilhuff Tarkin',
    'admiral ackbar': 'Ackbar',
    'jango fett': 'Jango Fett',
    'boba fett': 'Boba Fett',
    'jar jar binks': 'Jar Jar Binks',
    'jarjar binks': 'Jar Jar Binks',
    'grand admiral thrawn': 'Thrawn',
    'commander cody': 'CC-2224',
    'queen of naboo': 'Padmé Amidala',
    'queen amidala': 'Padmé Amidala',
    'senator bail organa': 'Bail Prestor Organa',
    'bail organa': 'Bail Prestor Organa',
    'ben obi wan kenobi': 'Obi-Wan Kenobi',
    'uncle owen': 'Owen Lars',
    'aunt beru': 'Beru Whitesun lars',
    'aunt beru whitesun': 'Beru Whitesun lars',
    'supreme leader snoke': 'Snoke',
};

export interface ImportStarWarsImagesResult {
    total_starwars_characters: number;
    matched: number;
    updated: number;
    unmatched: string[];
}

export async function importStarWarsImages(): Promise<ImportStarWarsImagesResult> {
    console.log('⏳ Descargando akabab Star Wars API...');
    const res = await fetch(AKABAB_SW_ALL);
    if (!res.ok) throw new Error(`akabab SW API respondió ${res.status}`);
    const all = (await res.json()) as AkababSwCharacter[];
    console.log(`✅ ${all.length} personajes descargados`);

    const index = new Map<string, AkababSwCharacter>();

    function addKey(key: string, hero: AkababSwCharacter) {
        if (key && !index.has(key)) index.set(key, hero);
    }

    for (const hero of all) {
        addKey(normalizeName(hero.name), hero);
        addKey(stripTitles(normalizeName(hero.name)), hero);
    }

    // Índice de alias manuales
    for (const [from, to] of Object.entries(MANUAL_ALIASES)) {
        const target = index.get(normalizeName(to)) ?? index.get(stripTitles(normalizeName(to)));
        if (target) addKey(normalizeName(from), target);
    }

    console.log(`🔍 ${index.size} claves indexadas`);

    const { data: franchise } = await supabaseAdmin
        .from('franchises').select('id').eq('slug', 'skywalker-saga').single();
    if (!franchise) throw new Error('Franquicia "skywalker-saga" no encontrada. Ejecuta antes /api/import/starwars');

    const { data: characters, error: charsErr } = await supabaseAdmin
        .from('characters')
        .select('id, slug, name')
        .eq('franchise_id', franchise.id);
    if (charsErr || !characters) {
        throw new Error(`Error leyendo personajes: ${charsErr?.message}`);
    }
    console.log(`🎮 ${characters.length} personajes en nuestra BD (Skywalker Saga)`);

    let matched = 0;
    let updated = 0;
    const unmatched: string[] = [];

    function findHero(rawName: string): AkababSwCharacter | undefined {
        const n = normalizeName(rawName);
        const s = stripTitles(n);
        return index.get(n) ?? index.get(s);
    }

    for (const char of characters) {
        const hero = findHero(char.name) ?? findHero(char.slug.replace(/-/g, ' '));

        if (!hero || !hero.image) {
            unmatched.push(char.slug);
            continue;
        }

        matched++;
        const { error: updErr } = await supabaseAdmin
            .from('characters')
            .update({ image_url: hero.image })
            .eq('id', char.id);

        if (!updErr) updated++;
    }

    return {
        total_starwars_characters: characters.length,
        matched,
        updated,
        unmatched,
    };
}
