// backend/src/services/import-franchise.service.ts
import { DiscoveredFranchise } from './discover.service.js';
import { tmdbFetch } from '../integrations/tmdb/client.js';
import { getWikipediaImage } from '../integrations/wikipedia/client.js';
import { getFandomImage } from '../integrations/fandom/client.js';
import { classifyWithWikidata } from '../integrations/wikidata/client.js';
import { supabaseAdmin } from '../db/supabase.js';
import { slugify } from '../utils/text.js';

const FANDOM_DOMAINS: Record<string, string> = {
    'the-lord-of-the-rings-collection': 'lotr.fandom.com',
    'the-matrix-collection': 'matrix.fandom.com',
    'back-to-the-future-collection': 'backtothefuture.fandom.com',
    'alien-collection': 'alien.fandom.com',
    'one-piece-collection': 'onepiece.fandom.com',
    'pirates-of-the-caribbean-collection': 'pirates.fandom.com',
};

const SPECIES_TRANSLATION: Record<string, string> = {
    'human': 'humano', 'pirate': 'pirata', 'elf': 'elfo', 'hobbit': 'hobbit',
    'wizard': 'mago', 'mutant': 'mutante', 'android': 'androide', 'robot': 'robot',
    'alien': 'alienígena', 'vampire': 'vampiro', 'werewolf': 'hombre lobo',
    'monster': 'monstruo', 'spartan': 'espartano', 'god': 'dios', 'demon': 'demonio',
};

function translateSpecies(raw: string | null): string | null {
    if (!raw) return null;
    const clean = raw.toLowerCase().trim();
    return SPECIES_TRANSLATION[clean] || clean;
}

// NUEVO: Adivinar especie por el nombre de la franquicia
function guessSpeciesFromFranchise(franchiseName: string): string | null {
    const lower = franchiseName.toLowerCase();
    if (lower.includes('pirata') || lower.includes('pirates')) return 'pirata';
    if (lower.includes('star wars')) return 'alienígena';
    if (lower.includes('harry potter')) return 'mago';
    if (lower.includes('one piece')) return 'pirata';
    if (lower.includes('alien')) return 'alienígena';
    return null;
}

// NUEVO: Adivinar especie/rol por el nombre del personaje
function guessSpeciesFromName(name: string): string | null {
    const lower = name.toLowerCase();
    if (lower.includes('captain') || lower.includes('capitán')) return 'capitán';
    if (lower.includes('king') || lower.includes('rey')) return 'rey';
    if (lower.includes('queen') || lower.includes('reina')) return 'reina';
    if (lower.includes('prince') || lower.includes('príncipe')) return 'príncipe';
    if (lower.includes('princess') || lower.includes('princesa')) return 'princesa';
    if (lower.includes('doctor') || lower.includes('dr.')) return 'científico';
    return null;
}

async function guessFandomDomain(franchiseName: string): Promise<string | null> {
    const cleanName = franchiseName.toLowerCase().replace(/collection/g, '').replace(/[^a-z0-9]/g, '').trim();
    const candidates = [`${cleanName}.fandom.com`, `${cleanName}s.fandom.com`];

    for (const domain of candidates) {
        if (!domain || domain.startsWith('.fandom.com')) continue;
        try {
            const res = await fetch(`https://${domain}/api.php?action=query&meta=siteinfo&format=json`, { method: 'HEAD' });
            if (res.ok) return domain;
        } catch (e) { /* Ignorar */ }
    }
    return null;
}

async function processInBatches<T, R>(items: T[], batchSize: number, fn: (item: T) => Promise<R>): Promise<R[]> {
    const results: R[] = [];
    for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);
        results.push(...(await Promise.all(batch.map(fn))));
    }
    return results;
}

interface PendingCharacter {
    cast: any;
    name: string;
    slug: string;
    imageUrl: string | null;
    movieTitle: string;
}

interface AniListMediaResponse {
    data?: { Media?: { characters?: { edges?: { role: string; node: { id: number; name: { full: string }; image: { large: string }; }; }[]; }; }; };
}

export async function importFranchise(franchise: DiscoveredFranchise) {
    if (franchise.source === 'anilist') return importAniList(franchise);
    return importTmdb(franchise);
}

async function importTmdb(franchise: DiscoveredFranchise) {
    const themeSlug = slugify(franchise.name);

    let fandomDomain: string | null = FANDOM_DOMAINS[themeSlug] || null;
    if (!fandomDomain) fandomDomain = await guessFandomDomain(franchise.name);

    const { data: theme, error: themeErr } = await supabaseAdmin
        .from('themes').upsert({ slug: themeSlug, name: franchise.name, description: franchise.description, type: franchise.source === 'tmdb_tv' ? 'series' : 'movies', image_url: franchise.imageUrl, question_categories: ['identity', 'role', 'abilities'] }, { onConflict: 'slug' }).select('id').single();
    if (themeErr || !theme) throw new Error(`Error creando theme: ${themeErr?.message}`);

    const { data: fran, error: franErr } = await supabaseAdmin
        .from('franchises').upsert({ theme_id: theme.id, slug: themeSlug, name: franchise.name, source: 'tmdb', external_id: franchise.externalId }, { onConflict: 'theme_id,slug' }).select('id').single();
    if (franErr || !fran) throw new Error(`Error creando franchise: ${franErr?.message}`);

    let parts: { id: number; title: string }[] = [];
    let overview = franchise.description;

    if (franchise.source === 'tmdb_movie') {
        const col = await tmdbFetch<any>(`/collection/${franchise.externalId}`);
        parts = col.parts;
        overview = col.overview || overview;
    } else {
        const tv = await tmdbFetch<any>(`/tv/${franchise.externalId}`);
        parts = [{ id: tv.id, title: tv.name }];
        overview = tv.overview || overview;
    }

    const uniqueSlugs = new Set<string>();
    const pendingChars: PendingCharacter[] = [];
    const franchiseDefaultSpecies = guessSpeciesFromFranchise(franchise.name);

    console.log(`📥 Recolectando personajes de ${parts.length} elementos...`);

    for (const part of parts) {
        try {
            const endpoint = franchise.source === 'tmdb_movie' ? `/movie/${part.id}/credits` : `/tv/${part.id}/aggregate_credits`;
            const credits = await tmdbFetch<any>(endpoint);

            const topCast = credits.cast
                .filter((c: any) => c.order < 10)
                .map((c: any) => ({ ...c, character: c.character || (c.roles && c.roles[0]?.character) || '' }))
                .filter((c: any) => c.character.trim() !== '' && !/^(himself|herself|themselves)$/i.test(c.character.trim()));

            for (const cast of topCast) {
                let name = cast.character.replace(/\(.*?\)/g, '').trim();
                if (name.includes('/')) name = name.split('/').pop()!.trim();

                const charSlug = slugify(name);
                if (!charSlug || uniqueSlugs.has(charSlug)) continue;
                uniqueSlugs.add(charSlug);

                let imageUrl: string | null = null;
                const { data: existing } = await supabaseAdmin.from('characters').select('image_url').eq('franchise_id', fran.id).eq('slug', charSlug).maybeSingle();

                if (existing?.image_url) {
                    imageUrl = existing.image_url;
                } else {
                    if (fandomDomain) {
                        const fandomImg = await getFandomImage(fandomDomain, name);
                        if (fandomImg) imageUrl = fandomImg;
                    }
                    if (!imageUrl) {
                        const wikiImg = await getWikipediaImage(name);
                        if (wikiImg) imageUrl = wikiImg;
                    }
                }

                pendingChars.push({ cast, name, slug: charSlug, imageUrl, movieTitle: part.title });
            }
        } catch (e) {
            console.warn(`Error leyendo ${part.title}:`, e);
        }
    }

    const classifications = await processInBatches(pendingChars, 5, async (char) => {
        let role: 'hero' | 'villain' | 'neutral' = 'neutral';
        let species: string | null = null;

        const wikiData = await classifyWithWikidata(char.name, char.movieTitle);
        if (wikiData && (wikiData.role !== 'neutral' || wikiData.species)) {
            role = wikiData.role;
            species = translateSpecies(wikiData.species);
        } else {
            const lowerName = char.name.toLowerCase();
            if (lowerName.includes('darth') || lowerName.includes('lord') || lowerName.includes('dark') || lowerName.includes('evil') || lowerName.includes('jones')) {
                role = 'villain';
            } else if (char.cast.order < 3) {
                role = 'hero';
            }
        }

        // Si después de Wikidata no hay especie, usamos heurísticas
        if (!species) {
            species = guessSpeciesFromName(char.name) || franchiseDefaultSpecies;
        }

        // Si aún así no hay especie, y parece humano por defecto
        if (!species && char.cast.order < 3) {
            species = 'humano';
        }

        return { role, species };
    });

    for (let i = 0; i < pendingChars.length; i++) {
        const char = pendingChars[i];
        const classification = classifications[i];

        const { data: savedChar, error: charErr } = await supabaseAdmin
            .from('characters')
            .upsert({
                franchise_id: fran.id, slug: char.slug, name: char.name,
                gender: char.cast.gender === 1 ? 'female' : char.cast.gender === 2 ? 'male' : 'unknown',
                image_url: char.imageUrl, is_hero: classification.role === 'hero',
                is_villain: classification.role === 'villain', is_protagonist: char.cast.order < 3,
                has_powers: false, attributes: { species: classification.species }
            }, { onConflict: 'franchise_id,slug' }).select('id').single();

        if (savedChar && !charErr) {
            await supabaseAdmin.from('character_sources').upsert({
                character_id: savedChar.id, source: 'tmdb', external_id: char.cast.credit_id,
                external_type: 'movie_credit', raw_data: char.cast
            }, { onConflict: 'source,external_id,external_type' });
        }
    }
    return { themeSlug, charactersCount: uniqueSlugs.size };
}

async function importAniList(franchise: DiscoveredFranchise) {
    const themeSlug = slugify(franchise.name);

    const { data: theme, error: themeErr } = await supabaseAdmin
        .from('themes').upsert({ slug: themeSlug, name: franchise.name, description: franchise.description, type: 'anime', image_url: franchise.imageUrl, question_categories: ['identity', 'role', 'abilities'] }, { onConflict: 'slug' }).select('id').single();
    if (themeErr || !theme) throw new Error(`Error creando theme: ${themeErr?.message}`);

    const { data: fran, error: franErr } = await supabaseAdmin
        .from('franchises').upsert({ theme_id: theme.id, slug: themeSlug, name: franchise.name, source: 'anilist', external_id: franchise.externalId }, { onConflict: 'theme_id,slug' }).select('id').single();
    if (franErr || !fran) throw new Error(`Error creando franchise: ${franErr?.message}`);

    console.log(`📥 Descargando personajes de AniList para "${franchise.name}"...`);

    const query = `
      query ($id: Int) {
        Media(id: $id) {
          characters(sort: [ROLE, RELEVANCE, ID], perPage: 20) {
            edges { role node { id name { full } image { large } } }
          }
        }
      }
    `;

    const res = await fetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, variables: { id: Number(franchise.externalId) } }),
    });

    const data = (await res.json()) as AniListMediaResponse;
    const edges = data.data?.Media?.characters?.edges || [];

    const uniqueSlugs = new Set<string>();

    for (const edge of edges) {
        const charNode = edge.node;
        const name = charNode.name.full;
        const charSlug = slugify(name);
        if (!charSlug || uniqueSlugs.has(charSlug)) continue;
        uniqueSlugs.add(charSlug);

        const isMain = edge.role === 'MAIN';

        // Para anime, asignamos una especie genérica basada en la franquicia o "humano"
        let species = guessSpeciesFromFranchise(franchise.name);
        if (!species && isMain) species = 'humano';

        await supabaseAdmin.from('characters').upsert({
            franchise_id: fran.id, slug: charSlug, name: name,
            gender: 'unknown', image_url: charNode.image.large,
            is_hero: isMain, is_villain: false, is_protagonist: isMain,
            has_powers: true, attributes: { species }
        }, { onConflict: 'franchise_id,slug' });
    }
    return { themeSlug, charactersCount: uniqueSlugs.size };
}