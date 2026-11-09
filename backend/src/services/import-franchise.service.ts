// backend/src/services/import-franchise.service.ts
import { DiscoveredFranchise } from './discover.service.js';
import { tmdbFetch } from '../integrations/tmdb/client.js';
import { getWikipediaImage } from '../integrations/wikipedia/client.js';
import { getFandomImage } from '../integrations/fandom/client.js';
import { classifyWithWikidata } from '../integrations/wikidata/client.js';
import { generateThemeQuestionsAndAttributes } from './ai.service.js'; // <-- NUEVO
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

function guessSpeciesFromFranchise(franchiseName: string): string | null {
    const lower = franchiseName.toLowerCase();
    if (lower.includes('pirata') || lower.includes('pirates')) return 'pirata';
    if (lower.includes('star wars')) return 'alienígena';
    if (lower.includes('harry potter')) return 'mago';
    if (lower.includes('one piece')) return 'pirata';
    if (lower.includes('alien')) return 'alienígena';
    return null;
}

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
    const cleanName = franchiseName
        .toLowerCase()
        .replace(/collection/g, '')
        .replace(/\b(i{1,3}|iv|v|vi{0,3}|ix|x)\b/gi, '')
        .replace(/[^a-z0-9]/g, '')
        .trim();

    const candidates = [
        `${cleanName}.fandom.com`,
        `${cleanName}s.fandom.com`,
        `${cleanName}game.fandom.com`,
        `${cleanName}wiki.fandom.com`,
    ];

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

function mapGender(genderId: number | null | undefined): string {
    if (genderId === 1) return 'female';
    if (genderId === 2) return 'male';
    return 'unknown';
}

function mapIgdbGender(g: number | undefined): string {
    return ['male', 'female', 'other', 'unknown'][g || 3] || 'unknown';
}

function mapIgdbSpecies(s: number | undefined): string {
    return ['unknown', 'human', 'alien', 'animal', 'android'][s || 0] || 'unknown';
}

export async function importFranchise(franchise: DiscoveredFranchise) {
    if (franchise.source === 'anilist') return importAniList(franchise);
    if (franchise.source === 'igdb') return importIgdb(franchise);
    if (franchise.source === 'openlibrary') {
        throw new Error('Los libros aún no se pueden importar como temática jugable (no tienen personajes).');
    }
    return importTmdb(franchise);
}

// --- FUNCIÓN AUXILIAR PARA GUARDAR PREGUNTAS DE IA ---
async function saveAiQuestions(themeId: string, questions: any[]) {
    for (const q of questions) {
        await supabaseAdmin.from('questions').upsert({
            theme_id: themeId,
            code: `ai_${themeId.slice(0, 4)}_${q.attribute}_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
            text_es: q.text,
            attribute: q.attribute,
            operator: 'eq',
            value: { v: q.value },
            category: 'custom',
            is_active: true
        }, { onConflict: 'code' });
    }
    console.log(`🤖 Se guardaron ${questions.length} preguntas generadas por IA.`);
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
    if (franchise.source === 'tmdb_movie') {
        const col = await tmdbFetch<any>(`/collection/${franchise.externalId}`);
        parts = col.parts;
    } else {
        const tv = await tmdbFetch<any>(`/tv/${franchise.externalId}`);
        parts = [{ id: tv.id, title: tv.name }];
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

    // 1. Clasificación con Wikidata
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

        if (!species) species = guessSpeciesFromName(char.name) || franchiseDefaultSpecies;
        if (!species && char.cast.order < 3) species = 'humano';

        return { role, species };
    });

    // 2. Generar preguntas con IA
    const characterNames = pendingChars.map(c => c.name);
    const { questions: aiQuestions, characters: aiChars } = await generateThemeQuestionsAndAttributes(franchise.name, characterNames);

    // 3. Guardar preguntas en BD
    await saveAiQuestions(theme.id, aiQuestions);

    // 4. Guardar personajes con atributos de IA
    for (let i = 0; i < pendingChars.length; i++) {
        const char = pendingChars[i];
        const classification = classifications[i];
        const aiChar = aiChars.find(c => c.name === char.name);
        const aiAttrs = aiChar ? aiChar.attributes : {};

        const { data: savedChar, error: charErr } = await supabaseAdmin
            .from('characters')
            .upsert({
                franchise_id: fran.id, slug: char.slug, name: char.name,
                gender: mapGender(char.cast.gender),
                image_url: char.imageUrl, is_hero: classification.role === 'hero',
                is_villain: classification.role === 'villain', is_protagonist: char.cast.order < 3,
                has_powers: false,
                attributes: { ...aiAttrs, species: classification.species }
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

async function importIgdb(franchise: DiscoveredFranchise) {
    const themeSlug = slugify(franchise.name);
    const clientId = process.env.IGDB_CLIENT_ID;
    const clientSecret = process.env.IGDB_CLIENT_SECRET;

    if (!clientId || !clientSecret) throw new Error('Faltan credenciales de IGDB en el .env');

    const tokenRes = await fetch(`https://id.twitch.tv/oauth2/token?client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials`, { method: 'POST' });
    if (!tokenRes.ok) throw new Error('Fallo al conectar con Twitch para obtener el token de IGDB');
    const tokenData = (await tokenRes.json()) as any;
    const token = tokenData.access_token;
    if (!token) throw new Error('No se pudo obtener el token de IGDB');

    const headers = { 'Client-ID': clientId, 'Authorization': `Bearer ${token}`, 'Content-Type': 'text/plain' };

    const gameId = franchise.externalId;
    const charactersRes = await fetch('https://api.igdb.com/v4/characters', {
        method: 'POST', headers,
        body: `fields name, gender, species, mug_shot.image_id, mug_shot.url; where games = (${gameId}); limit 50;`
    });

    if (!charactersRes.ok) {
        const errorText = await charactersRes.text();
        throw new Error(`Error al buscar personajes en IGDB: ${errorText}`);
    }

    const characters = (await charactersRes.json()) as any[];
    if (!Array.isArray(characters) || characters.length === 0) {
        throw new Error(`No se encontraron personajes para "${franchise.name}" en IGDB.`);
    }

    const fandomDomain = await guessFandomDomain(franchise.name);

    const { data: theme } = await supabaseAdmin
        .from('themes').upsert({ slug: themeSlug, name: franchise.name, description: franchise.description, type: 'videogames', image_url: franchise.imageUrl, question_categories: ['identity', 'role', 'abilities'] }, { onConflict: 'slug' }).select('id').single();
    if (!theme) throw new Error('Error creando theme en la base de datos');

    const { data: fran } = await supabaseAdmin
        .from('franchises').upsert({ theme_id: theme.id, slug: themeSlug, name: franchise.name, source: 'igdb', external_id: franchise.externalId }, { onConflict: 'theme_id,slug' }).select('id').single();
    if (!fran) throw new Error('Error creando franchise en la base de datos');

    // Generar preguntas con IA
    const characterNames = characters.map((c: any) => c.name);
    const { questions: aiQuestions, characters: aiChars } = await generateThemeQuestionsAndAttributes(franchise.name, characterNames);
    await saveAiQuestions(theme.id, aiQuestions);

    let imagesFromIgdb = 0;
    let imagesFromFandom = 0;

    for (const char of characters) {
        const charSlug = slugify(char.name);
        const aiChar = aiChars.find(c => c.name === char.name);
        const aiAttrs = aiChar ? aiChar.attributes : {};

        let imageUrl: string | null = null;
        if (char.mug_shot?.url) {
            imageUrl = char.mug_shot.url.startsWith('//') ? `https:${char.mug_shot.url}` : char.mug_shot.url;
            imagesFromIgdb++;
        } else if (char.mug_shot?.image_id) {
            imageUrl = `https://images.igdb.com/igdb/image/upload/t_thumb/${char.mug_shot.image_id}.jpg`;
            imagesFromIgdb++;
        }

        if (!imageUrl && fandomDomain) {
            const fandomImg = await getFandomImage(fandomDomain, char.name);
            if (fandomImg) {
                imageUrl = fandomImg;
                imagesFromFandom++;
            }
        }

        const species = mapIgdbSpecies(char.species);

        await supabaseAdmin.from('characters').upsert({
            franchise_id: fran.id, slug: charSlug, name: char.name,
            gender: mapIgdbGender(char.gender),
            species: species,
            image_url: imageUrl,
            is_hero: false, is_villain: false, is_protagonist: false,
            has_powers: false, attributes: { ...aiAttrs, species }
        }, { onConflict: 'franchise_id,slug' });
    }

    console.log(`📊 Resumen de imágenes para "${franchise.name}": IGDB: ${imagesFromIgdb}, Fandom: ${imagesFromFandom}`);
    return { themeSlug, charactersCount: characters.length };
}

async function importAniList(franchise: DiscoveredFranchise) {
    const themeSlug = slugify(franchise.name);

    const { data: theme, error: themeErr } = await supabaseAdmin
        .from('themes').upsert({ slug: themeSlug, name: franchise.name, description: franchise.description, type: 'anime', image_url: franchise.imageUrl, question_categories: ['identity', 'role', 'abilities'] }, { onConflict: 'slug' }).select('id').single();
    if (themeErr || !theme) throw new Error(`Error creando theme: ${themeErr?.message}`);

    const { data: fran, error: franErr } = await supabaseAdmin
        .from('franchises').upsert({ theme_id: theme.id, slug: themeSlug, name: franchise.name, source: 'anilist', external_id: franchise.externalId }, { onConflict: 'theme_id,slug' }).select('id').single();
    if (franErr || !fran) throw new Error(`Error creando franchise: ${franErr?.message}`);

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

    const data = (await res.json()) as any;
    const edges = data?.data?.Media?.characters?.edges || [];

    // Generar preguntas con IA
    const characterNames = edges.map((e: any) => e.node.name.full);
    const { questions: aiQuestions, characters: aiChars } = await generateThemeQuestionsAndAttributes(franchise.name, characterNames);
    await saveAiQuestions(theme.id, aiQuestions);

    const uniqueSlugs = new Set<string>();

    for (const edge of edges) {
        const charNode = edge.node;
        const name = charNode.name.full;
        const charSlug = slugify(name);
        if (!charSlug || uniqueSlugs.has(charSlug)) continue;
        uniqueSlugs.add(charSlug);

        const aiChar = aiChars.find(c => c.name === name);
        const aiAttrs = aiChar ? aiChar.attributes : {};

        const isMain = edge.role === 'MAIN';
        let species = guessSpeciesFromFranchise(franchise.name);
        if (!species && isMain) species = 'humano';

        await supabaseAdmin.from('characters').upsert({
            franchise_id: fran.id, slug: charSlug, name: name,
            gender: 'unknown', image_url: charNode.image.large,
            is_hero: isMain, is_villain: false, is_protagonist: isMain,
            has_powers: true, attributes: { ...aiAttrs, species }
        }, { onConflict: 'franchise_id,slug' });
    }
    return { themeSlug, charactersCount: uniqueSlugs.size };
}