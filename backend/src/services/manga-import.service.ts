// backend/src/services/manga-import.service.ts
import { supabaseAdmin } from '../db/supabase.js';
import { HttpError } from '../utils/http-error.js';
import { BOARD_SIZE_MIN } from './game.rules.js';
import {
    slugify,
    ensureBookTheme,
    buildUniqueCharacterSlugs,
} from './book-import.service.js';
import type { DiscoveredFranchise } from './discover.service.js';

interface AniListCharacterNode {
    name?: { full?: string | null } | null;
    image?: { large?: string | null } | null;
}

interface AniListMediaCharacters {
    data?: {
        Media?: {
            characters?: {
                nodes?: AniListCharacterNode[] | null;
            } | null;
        } | null;
    } | null;
}

interface RawCharacter {
    name: string;
    image: string | null;
}

interface EnrichedCharacter {
    name: string;
    image: string | null;
    species: string | null;
    gender: string | null;
    is_hero: boolean | null;
    is_villain: boolean | null;
    is_protagonist: boolean | null;
    has_powers: boolean | null;
    uses_weapon: boolean | null;
    attributes: Record<string, unknown>;
}

async function fetchAniListMangaCharacters(mediaId: string): Promise<RawCharacter[]> {
    const query = `
    query ($id: Int) {
      Media(id: $id, type: MANGA) {
        characters(sort: [ROLE, RELEVANCE], perPage: 15) {
          nodes { name { full } image { large } }
        }
      }
    }`;

    try {
        const res = await fetch('https://graphql.anilist.co', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query, variables: { id: Number(mediaId) } }),
        });

        if (!res.ok) {
            console.warn(`[manga-import] AniList HTTP ${res.status} para id=${mediaId}`);
            return [];
        }

        const data = (await res.json()) as AniListMediaCharacters;
        const nodes = data?.data?.Media?.characters?.nodes ?? [];

        return nodes
            .map((n) => ({
                name: n.name?.full ?? '',
                image: n.image?.large ?? null,
            }))
            .filter((c) => c.name.trim().length > 0);
    } catch (err) {
        console.error('[manga-import] Error consultando AniList characters:', err);
        return [];
    }
}

/**
 * Rellena atributos de juego. De momento los deja a `null` porque AniList
 * no los expone. Es el punto donde enchufarías una llamada a Groq pasándole
 * `mangaTitle` + la lista de nombres para que los infiera (mismo patrón que
 * `extractBookCharacters`). Conserva `image` para el insert final.
 */
async function enrichWithAttributes(
    mangaTitle: string,
    characters: RawCharacter[],
): Promise<EnrichedCharacter[]> {
    // Punto de extensión: aquí se llamaría a Groq si se quiere enriquecer.
    // De momento logueamos el título para dejar traza y devolvemos nulls.
    console.log(`[manga-import] Enriqueciendo ${characters.length} personajes de "${mangaTitle}" (sin IA todavía)`);

    return characters.map((c) => ({
        name: c.name,
        image: c.image,
        species: null,
        gender: null,
        is_hero: null,
        is_villain: null,
        is_protagonist: null,
        has_powers: null,
        uses_weapon: null,
        attributes: {},
    }));
}

export interface MangaImportResult {
    franchiseId: string;
    franchiseName: string;
    themeSlug: string;
    charactersImported: number;
    warning?: string;
}

export async function importMangaAsFranchise(
    franchise: DiscoveredFranchise,
): Promise<MangaImportResult> {
    const title = franchise.name?.trim();
    if (!title) throw new HttpError(400, 'El manga no tiene título');

    const franchiseSlug = slugify(title);

    // 1. Personajes desde AniList
    const rawCharacters = await fetchAniListMangaCharacters(franchise.externalId);
    console.log(`[manga-import] AniList devolvió ${rawCharacters.length} personajes para "${title}"`);

    if (rawCharacters.length < BOARD_SIZE_MIN) {
        throw new HttpError(
            400,
            `El manga "${title}" solo tiene ${rawCharacters.length} personajes en AniList (mínimo ${BOARD_SIZE_MIN}). Prueba con otro título.`,
        );
    }

    // 2. Enriquecer (nulls por ahora)
    const characters = await enrichWithAttributes(title, rawCharacters);

    // 3. Crear/obtener tema (una temática por manga)
    const theme = await ensureBookTheme(
        title,
        String(franchise.description ?? '').slice(0, 1000),
        franchise.imageUrl,
    );

    // 4. ¿Ya existe la franquicia? Evita duplicar en reimportaciones
    const { data: existingFranchise } = await supabaseAdmin
        .from('franchises')
        .select('id, name')
        .eq('theme_id', theme.id)
        .eq('slug', franchiseSlug)
        .maybeSingle();

    if (existingFranchise) {
        return {
            franchiseId: existingFranchise.id,
            franchiseName: existingFranchise.name,
            themeSlug: theme.slug,
            charactersImported: 0,
            warning: `La franquicia "${existingFranchise.name}" ya existía. No se han añadido personajes nuevos.`,
        };
    }

    // 5. Crear franquicia
    const { data: newFranchise, error: franchiseErr } = await supabaseAdmin
        .from('franchises')
        .insert({
            theme_id: theme.id,
            slug: franchiseSlug,
            name: title,
            description: String(franchise.description ?? '').slice(0, 1000) || null,
            image_url: franchise.imageUrl,
            source: 'anilist_manga',
            external_id: franchise.externalId,
        })
        .select('id, name')
        .single();

    if (franchiseErr || !newFranchise) {
        throw new HttpError(500, `Error creando franquicia: ${franchiseErr?.message ?? 'error desconocido'}`);
    }

    // 6. Insertar personajes con slug único
    const baseSlugs = buildUniqueCharacterSlugs(characters.map((c) => c.name));
    const rows = characters.map((c, idx) => ({
        franchise_id: newFranchise.id,
        slug: baseSlugs[idx],
        name: c.name,
        image_url: c.image,
        species: c.species,
        gender: c.gender,
        is_human: null,
        is_hero: c.is_hero,
        is_villain: c.is_villain,
        is_protagonist: c.is_protagonist,
        has_powers: c.has_powers,
        uses_weapon: c.uses_weapon,
        attributes: c.attributes,
    }));

    const { error: charsErr } = await supabaseAdmin.from('characters').insert(rows);

    if (charsErr) {
        await supabaseAdmin.from('franchises').delete().eq('id', newFranchise.id);
        throw new HttpError(500, `Error insertando personajes: ${charsErr.message}`);
    }

    return {
        franchiseId: newFranchise.id,
        franchiseName: newFranchise.name,
        themeSlug: theme.slug,
        charactersImported: rows.length,
    };
}