import { supabaseAdmin } from '../db/supabase.js';
import { normalizeName } from '../utils/text.js';

const SUPERHERO_API_ALL = 'https://akabab.github.io/superhero-api/api/all.json';

interface AkababCharacter {
    id: number;
    name: string;
    slug: string;
    images: { xs: string; sm: string; md: string; lg: string };
    biography?: {
        publisher?: string;
        fullName?: string;
        aliases?: string[];
    };
}

/** Quita títulos/prefijos comunes que TMDB añade a los créditos. */
function stripTitles(name: string): string {
    return name.replace(
        /^(agent|dr|doctor|colonel|general|lt col|lt|the|mr|mrs|ms|sir|lord|king|queen)\s+/i,
        ''
    );
}

/** Alias manuales para casos que la API no cubre por biography. */
const MANUAL_ALIASES: Record<string, string> = {
    // nombre normalizado en nuestra BD → nombre en SuperHero API
    'rocket': 'Rocket Raccoon',
    'drax': 'Drax the Destroyer',
    'yondu udonta': 'Yondu',
    'ivan vanko': 'Whiplash',
    'obadiah stane': 'Iron Monger',
    'arnim zola': 'Arnim Zola',
    'abraham erskine': 'Abraham Erskine',
    'howard stark': 'Howard Stark',
    'maria hill': 'Maria Hill',
    'phil coulson': 'Phil Coulson',
    'corpsman dey': 'Rhomann Dey',
    'korath': 'Korath',
    'ronan': 'Ronan',
    'volstagg': 'Volstagg',
};

export interface ImportImagesResult {
    total_marvel_characters: number;
    matched: number;
    updated: number;
    unmatched: string[];
}

export async function importMarvelImages(): Promise<ImportImagesResult> {
    console.log('⏳ Descargando SuperHero API...');
    const res = await fetch(SUPERHERO_API_ALL);
    if (!res.ok) throw new Error(`SuperHero API respondió ${res.status}`);
    const all = (await res.json()) as AkababCharacter[];
    console.log(`✅ ${all.length} personajes descargados`);

    // Índice: nombre + fullName + aliases
    const marvelIndex = new Map<string, AkababCharacter>();
    const allIndex = new Map<string, AkababCharacter>();

    function addKey(map: Map<string, AkababCharacter>, key: string, hero: AkababCharacter) {
        if (key && !map.has(key)) map.set(key, hero);
    }

    function indexHero(map: Map<string, AkababCharacter>, hero: AkababCharacter) {
        addKey(map, normalizeName(hero.name), hero);
        if (hero.biography?.fullName) {
            addKey(map, normalizeName(hero.biography.fullName), hero);
            addKey(map, stripTitles(normalizeName(hero.biography.fullName)), hero);
        }
        if (hero.biography?.aliases) {
            for (const alias of hero.biography.aliases) {
                if (!alias || alias.trim() === '' || alias === '-') continue;
                addKey(map, normalizeName(alias), hero);
            }
        }
        // Alias manuales que apunten a este héroe
        for (const [from, to] of Object.entries(MANUAL_ALIASES)) {
            if (normalizeName(to) === normalizeName(hero.name)) {
                addKey(map, from, hero);
            }
        }
    }

    for (const hero of all) {
        const publisher = hero.biography?.publisher?.toLowerCase() ?? '';
        const isMarvel = publisher.includes('marvel');
        if (isMarvel) {
            indexHero(marvelIndex, hero);
            indexHero(allIndex, hero);
        } else {
            indexHero(allIndex, hero); // fallback por si algún Marvel está mal etiquetado
        }
    }
    console.log(`🔍 ${marvelIndex.size} claves Marvel indexadas`);

    // Personajes de nuestra BD (MCU)
    const { data: franchise } = await supabaseAdmin
        .from('franchises').select('id').eq('slug', 'mcu').single();
    if (!franchise) throw new Error('Franquicia "mcu" no encontrada. Ejecuta antes /api/import/marvel');

    const { data: characters, error: charsErr } = await supabaseAdmin
        .from('characters')
        .select('id, slug, name')
        .eq('franchise_id', franchise.id);
    if (charsErr || !characters) {
        throw new Error(`Error leyendo personajes: ${charsErr?.message}`);
    }
    console.log(`🎮 ${characters.length} personajes en nuestra BD (MCU)`);

    let matched = 0;
    let updated = 0;
    const unmatched: string[] = [];

    function findHero(rawName: string): AkababCharacter | undefined {
        const n = normalizeName(rawName);
        const s = stripTitles(n);
        return (
            marvelIndex.get(n) ??
            marvelIndex.get(s) ??
            allIndex.get(n) ??
            allIndex.get(s)
        );
    }

    for (const char of characters) {
        // Probamos con el name y con el slug (por si tienen formato distinto)
        const hero = findHero(char.name) ?? findHero(char.slug.replace(/-/g, ' '));

        if (!hero) {
            unmatched.push(char.slug);
            continue;
        }

        matched++;
        const imageUrl = hero.images.md ?? hero.images.lg ?? hero.images.sm ?? null;
        if (!imageUrl) {
            unmatched.push(char.slug);
            continue;
        }

        const { error: updErr } = await supabaseAdmin
            .from('characters')
            .update({ image_url: imageUrl })
            .eq('id', char.id);

        if (!updErr) updated++;
    }

    return {
        total_marvel_characters: characters.length,
        matched,
        updated,
        unmatched,
    };
}