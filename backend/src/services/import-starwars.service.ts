import { fetchMovieCredits } from '../integrations/tmdb/credits.js';
import { supabaseAdmin } from '../db/supabase.js';

const THEME_SLUG = 'star-wars';
const FRANCHISE = {
    slug: 'skywalker-saga',
    name: 'Star Wars: Skywalker Saga',
    description: 'Episodios I–IX',
};

const STAR_WARS_MOVIES: { id: number; title: string }[] = [
    { id: 11, title: 'A New Hope' },
    { id: 1891, title: 'The Empire Strikes Back' },
    { id: 1892, title: 'Return of the Jedi' },
    { id: 1893, title: 'The Phantom Menace' },
    { id: 1894, title: 'Attack of the Clones' },
    { id: 1895, title: 'Revenge of the Sith' },
    { id: 140607, title: 'The Force Awakens' },
    { id: 181808, title: 'The Last Jedi' },
    { id: 181812, title: 'The Rise of Skywalker' },
];

const MAX_CAST_PER_MOVIE = 15;

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

export async function importStarWarsCharacters(): Promise<ImportResult> {
    const { data: theme, error: themeErr } = await supabaseAdmin
        .from('themes').select('id').eq('slug', THEME_SLUG).single();
    if (themeErr || !theme) throw new Error(`Theme "${THEME_SLUG}" no encontrado`);

    const { data: franchise, error: franErr } = await supabaseAdmin
        .from('franchises')
        .upsert(
            { theme_id: theme.id, slug: FRANCHISE.slug, name: FRANCHISE.name, description: FRANCHISE.description, source: 'manual' },
            { onConflict: 'theme_id,slug' }
        )
        .select('id').single();
    if (franErr || !franchise) throw new Error(`Error creando franchise: ${franErr?.message}`);

    let creditsProcessed = 0;
    let skipped = 0;
    const uniqueSlugs = new Set<string>();

    for (const movie of STAR_WARS_MOVIES) {
        const credits = await fetchMovieCredits(movie.id);
        const topCast = credits.cast
            .filter((c) => c.order < MAX_CAST_PER_MOVIE)
            .filter((c) => c.character && c.character.trim() !== '')
            .filter((c) => !/^(himself|herself|themselves)$/i.test(c.character.trim()));

        for (const cast of topCast) {
            const name = normalizeCharacterName(cast.character);
            const slug = name ? slugify(name) : '';
            if (!name || !slug) { skipped++; continue; }

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
                .select('id').single();

            if (charErr || !char) { skipped++; continue; }

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
            if (srcErr) { skipped++; continue; }

            uniqueSlugs.add(slug);
            creditsProcessed++;
        }
    }

    return {
        movies_processed: STAR_WARS_MOVIES.length,
        unique_characters: uniqueSlugs.size,
        credits_processed: creditsProcessed,
        skipped,
    };
}