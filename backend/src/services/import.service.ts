import { fetchMovieCredits } from '../integrations/tmdb/credits.js';
import { supabaseAdmin } from '../db/supabase.js';

const THEME_SLUG = 'marvel';
const FRANCHISE = {
    slug: 'mcu',
    name: 'Marvel Cinematic Universe',
    description: 'Películas del MCU',
};

const MARVEL_MOVIES: { id: number; title: string }[] = [
    { id: 1726, title: 'Iron Man' },
    { id: 10138, title: 'Iron Man 2' },
    { id: 10195, title: 'Thor' },
    { id: 1771, title: 'Captain America: The First Avenger' },
    { id: 24428, title: 'The Avengers' },
    { id: 118340, title: 'Guardians of the Galaxy' },
    { id: 271110, title: 'Captain America: Civil War' },
    { id: 299536, title: 'Avengers: Infinity War' },
    { id: 299534, title: 'Avengers: Endgame' },
];

const MAX_CAST_PER_MOVIE = 10;

function normalizeCharacterName(raw: string): string {
    let s = raw.replace(/\(.*?\)/g, '').trim();
    if (s.includes('/')) s = s.split('/').pop()!.trim();
    return s;
}

function slugify(s: string): string {
    return s
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

function mapGender(g: 0 | 1 | 2): string {
    if (g === 1) return 'female';
    if (g === 2) return 'male';
    return 'unknown';
}

export interface ImportResult {
    movies_processed: number;
    unique_characters: number;
    credits_processed: number;
    skipped: number;
}

export async function importMarvelCharacters(): Promise<ImportResult> {
    // 1. Buscar el theme
    const { data: theme, error: themeErr } = await supabaseAdmin
        .from('themes')
        .select('id')
        .eq('slug', THEME_SLUG)
        .single();
    if (themeErr || !theme) {
        throw new Error(`Theme "${THEME_SLUG}" no encontrado: ${themeErr?.message}`);
    }

    // 2. Upsert franquicia MCU
    const { data: franchise, error: franErr } = await supabaseAdmin
        .from('franchises')
        .upsert(
            {
                theme_id: theme.id,
                slug: FRANCHISE.slug,
                name: FRANCHISE.name,
                description: FRANCHISE.description,
                source: 'manual',
            },
            { onConflict: 'theme_id,slug' }
        )
        .select('id')
        .single();
    if (franErr || !franchise) {
        throw new Error(`Error creando franchise: ${franErr?.message}`);
    }

    let creditsProcessed = 0;
    let skipped = 0;
    const uniqueSlugs = new Set<string>();

    for (const movie of MARVEL_MOVIES) {
        const credits = await fetchMovieCredits(movie.id);

        const topCast = credits.cast
            .filter((c) => c.order < MAX_CAST_PER_MOVIE)
            .filter((c) => c.character && c.character.trim() !== '')
            .filter((c) => !/^(himself|herself|themselves)$/i.test(c.character.trim()));

        for (const cast of topCast) {
            const name = normalizeCharacterName(cast.character);
            const slug = name ? slugify(name) : '';
            if (!name || !slug) {
                skipped++;
                continue;
            }

            // 3. Upsert personaje
            const { data: char, error: charErr } = await supabaseAdmin
                .from('characters')
                .upsert(
                    {
                        franchise_id: franchise.id,
                        slug,
                        name,
                        gender: mapGender(cast.gender),
                        image_url: null,
                    },
                    { onConflict: 'franchise_id,slug' }
                )
                .select('id')
                .single();

            if (charErr || !char) {
                skipped++;
                continue;
            }

            // 4. Registrar la fuente externa (idempotente)
            const { error: srcErr } = await supabaseAdmin
                .from('character_sources')
                .upsert(
                    {
                        character_id: char.id,
                        source: 'tmdb',
                        external_id: cast.credit_id,
                        external_type: 'movie_credit',
                        raw_data: { ...cast, movie_id: movie.id, movie_title: movie.title },
                    },
                    { onConflict: 'source,external_id,external_type' }
                );

            if (srcErr) {
                skipped++;
                continue;
            }

            uniqueSlugs.add(slug);
            creditsProcessed++;
        }
    }

    return {
        movies_processed: MARVEL_MOVIES.length,
        unique_characters: uniqueSlugs.size,
        credits_processed: creditsProcessed,
        skipped,
    };
}