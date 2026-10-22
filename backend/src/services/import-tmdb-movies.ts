import { fetchMovieCredits } from '../integrations/tmdb/credits.js';
import { supabaseAdmin } from '../db/supabase.js';
import { cleanTmdbCharacterName, mapTmdbGender, slugify } from '../utils/text.js';

interface MovieRef {
    id: number;
    title: string;
}

interface ImportConfig {
    themeSlug: string;
    franchise: { slug: string; name: string; description: string };
    movies: MovieRef[];
    maxCastPerMovie: number;
}

export interface ImportResult {
    movies_processed: number;
    unique_characters: number;
    credits_processed: number;
    skipped: number;
}

/**
 * Importa personajes desde créditos de TMDB de forma idempotente
 * (base compartida por Marvel y Star Wars).
 */
export async function importCharactersFromMovies(cfg: ImportConfig): Promise<ImportResult> {
    const { data: theme, error: themeErr } = await supabaseAdmin
        .from('themes')
        .select('id')
        .eq('slug', cfg.themeSlug)
        .single();
    if (themeErr || !theme) throw new Error(`Theme "${cfg.themeSlug}" no encontrado`);

    const { data: franchise, error: franErr } = await supabaseAdmin
        .from('franchises')
        .upsert(
            {
                theme_id: theme.id,
                slug: cfg.franchise.slug,
                name: cfg.franchise.name,
                description: cfg.franchise.description,
                source: 'manual',
            },
            { onConflict: 'theme_id,slug' }
        )
        .select('id')
        .single();
    if (franErr || !franchise) throw new Error(`Error creando franchise: ${franErr?.message}`);

    let creditsProcessed = 0;
    let skipped = 0;
    const uniqueSlugs = new Set<string>();

    for (const movie of cfg.movies) {
        const credits = await fetchMovieCredits(movie.id);

        const topCast = credits.cast
            .filter((c) => c.order < cfg.maxCastPerMovie)
            .filter((c) => c.character && c.character.trim() !== '')
            .filter((c) => !/^(himself|herself|themselves)$/i.test(c.character.trim()));

        for (const cast of topCast) {
            const name = cleanTmdbCharacterName(cast.character);
            const slug = name ? slugify(name) : '';
            if (!name || !slug) {
                skipped++;
                continue;
            }

            const { data: char, error: charErr } = await supabaseAdmin
                .from('characters')
                .upsert(
                    {
                        franchise_id: franchise.id,
                        slug,
                        name,
                        gender: mapTmdbGender(cast.gender),
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
        movies_processed: cfg.movies.length,
        unique_characters: uniqueSlugs.size,
        credits_processed: creditsProcessed,
        skipped,
    };
}
