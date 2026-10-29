import { DiscoveredFranchise } from './discover.service.js';
import { tmdbFetch } from '../integrations/tmdb/client.js';
import { fetchMovieCredits } from '../integrations/tmdb/credits.js';
import { getWikipediaImage } from '../integrations/wikipedia/client.js';
import { getFandomImage } from '../integrations/fandom/client.js';
import { supabaseAdmin } from '../db/supabase.js';
import { slugify } from '../utils/text.js';

interface TmdbCollectionDetail {
    id: number;
    name: string;
    overview: string;
    parts: { id: number; title: string }[];
}

// Mapa de franquicias a sus wikis de Fandom
// Puedes añadir más aquí a medida que importes nuevas sagas
const FANDOM_DOMAINS: Record<string, string> = {
    'the-lord-of-the-rings-collection': 'lotr.fandom.com',
    'the-matrix-collection': 'matrix.fandom.com',
    'back-to-the-future-collection': 'backtothefuture.fandom.com',
    'alien-collection': 'alien.fandom.com',
    'one-piece-collection': 'onepiece.fandom.com',
};

export async function importFranchise(franchise: DiscoveredFranchise) {
    if (franchise.source !== 'tmdb') throw new Error('Fuente no soportada aún');

    const themeSlug = slugify(franchise.name);
    const fandomDomain = FANDOM_DOMAINS[themeSlug]; // ¿Tenemos wiki de Fandom para esta saga?

    // 1. Crear o actualizar el Theme
    const { data: theme, error: themeErr } = await supabaseAdmin
        .from('themes')
        .upsert({
            slug: themeSlug,
            name: franchise.name,
            description: franchise.description,
            type: 'movies',
            image_url: franchise.imageUrl,
            question_categories: ['identity', 'role', 'abilities']
        }, { onConflict: 'slug' })
        .select('id')
        .single();

    if (themeErr || !theme) throw new Error(`Error creando theme: ${themeErr?.message}`);

    // 2. Crear la Franchise asociada
    const { data: fran, error: franErr } = await supabaseAdmin
        .from('franchises')
        .upsert({
            theme_id: theme.id,
            slug: themeSlug,
            name: franchise.name,
            source: 'tmdb',
            external_id: franchise.externalId
        }, { onConflict: 'theme_id,slug' })
        .select('id')
        .single();

    if (franErr || !fran) throw new Error(`Error creando franchise: ${franErr?.message}`);

    // 3. Obtener las películas de la colección
    const collection = await tmdbFetch<TmdbCollectionDetail>(`/collection/${franchise.externalId}`);

    const uniqueSlugs = new Set<string>();

    // 4. Iterar películas y obtener sus créditos
    for (const movie of collection.parts) {
        try {
            const credits = await fetchMovieCredits(movie.id);

            const topCast = credits.cast
                .filter((c) => c.order < 10)
                .filter((c) => c.character && c.character.trim() !== '')
                .filter((c) => !/^(himself|herself|themselves)$/i.test(c.character.trim()));

            for (const cast of topCast) {
                let name = cast.character.replace(/\(.*?\)/g, '').trim();
                if (name.includes('/')) name = name.split('/').pop()!.trim();

                const charSlug = slugify(name);
                if (!charSlug || uniqueSlugs.has(charSlug)) continue;
                uniqueSlugs.add(charSlug);

                // --- LÓGICA DE IMAGEN EN CASCADA ---
                let imageUrl: string | null = null;
                console.log(`🔍 Buscando imagen para "${name}"...`);

                // 1. Intentar Fandom (si tenemos el dominio configurado)
                if (fandomDomain) {
                    const fandomImg = await getFandomImage(fandomDomain, name);
                    if (fandomImg) {
                        imageUrl = fandomImg;
                        console.log(`   ✅ Fandom: ${imageUrl}`);
                    }
                }

                // 2. Si Fandom falla, intentar Wikipedia
                if (!imageUrl) {
                    const wikiImg = await getWikipediaImage(name);
                    if (wikiImg) {
                        imageUrl = wikiImg;
                        console.log(`   ✅ Wikipedia: ${imageUrl}`);
                    }
                }

                // 3. Si ambas fallan, usar la foto del actor
                if (!imageUrl && cast.profile_path) {
                    imageUrl = `https://image.tmdb.org/t/p/w500${cast.profile_path}`;
                    console.log(`   ⚠️ Usando foto del actor.`);
                }
                // -----------------------------------

                const { data: char, error: charErr } = await supabaseAdmin
                    .from('characters')
                    .upsert({
                        franchise_id: fran.id,
                        slug: charSlug,
                        name: name,
                        gender: cast.gender === 1 ? 'female' : cast.gender === 2 ? 'male' : 'unknown',
                        image_url: imageUrl
                    }, { onConflict: 'franchise_id,slug' })
                    .select('id')
                    .single();

                if (char && !charErr) {
                    await supabaseAdmin.from('character_sources').upsert({
                        character_id: char.id,
                        source: 'tmdb',
                        external_id: cast.credit_id,
                        external_type: 'movie_credit',
                        raw_data: cast
                    }, { onConflict: 'source,external_id,external_type' });
                }
            }
        } catch (e) {
            console.warn(`Error importando película ${movie.title}:`, e);
        }
    }

    return { themeSlug, charactersCount: uniqueSlugs.size };
}