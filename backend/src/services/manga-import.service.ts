// backend/src/services/manga-import.service.ts
import { supabaseAdmin } from '../db/supabase.js';
import { HttpError } from '../utils/http-error.js';
import { BOARD_SIZE_MIN } from './game.rules.js';
import { slugify, ensureBookTheme, buildUniqueCharacterSlugs } from './book-import.service.js';
import { enrichMangaAttributes } from './ai.service.js';
import type { DiscoveredFranchise } from './discover.service.js';

interface AniListCharacterNode {
    name?: { full?: string | null } | null;
    image?: { large?: string | null } | null;
}

interface AniListMediaCharacters {
    data?: {
        Media?: {
            characters?: { nodes?: AniListCharacterNode[] | null } | null;
        } | null;
    } | null;
}

interface RawCharacter {
    name: string;
    image: string | null;
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

    // 1. Personajes desde AniList (con imagen)
    const rawCharacters = await fetchAniListMangaCharacters(franchise.externalId);
    console.log(`[manga-import] AniList devolvió ${rawCharacters.length} personajes para "${title}"`);

    if (rawCharacters.length < BOARD_SIZE_MIN) {
        throw new HttpError(
            400,
            `El manga "${title}" solo tiene ${rawCharacters.length} personajes en AniList (mínimo ${BOARD_SIZE_MIN}).`,
        );
    }

    // 2. Enriquecer atributos con IA (species, gender, is_hero…)
    const attrs = await enrichMangaAttributes(title, rawCharacters.map((c) => c.name));
    const attrsByName = new Map(attrs.map((a) => [a.name, a]));

    const characters = rawCharacters.map((c) => {
        const a = attrsByName.get(c.name);
        return {
            name: c.name,
            image: c.image,
            species: a?.species ?? null,
            gender: a?.gender ?? null,
            is_human: a?.is_human ?? null,
            is_hero: a?.is_hero ?? null,
            is_villain: a?.is_villain ?? null,
            is_protagonist: a?.is_protagonist ?? null,
            has_powers: a?.has_powers ?? null,
            uses_weapon: a?.uses_weapon ?? null,
        };
    });

    // 3. Tema + franquicia
    const theme = await ensureBookTheme(
        title,
        String(franchise.description ?? '').slice(0, 1000),
        franchise.imageUrl,
    );

    const { data: existing } = await supabaseAdmin
        .from('franchises')
        .select('id, name')
        .eq('theme_id', theme.id)
        .eq('slug', franchiseSlug)
        .maybeSingle();

    if (existing) {
        return {
            franchiseId: existing.id,
            franchiseName: existing.name,
            themeSlug: theme.slug,
            charactersImported: 0,
            warning: `La franquicia "${existing.name}" ya existía.`,
        };
    }

    const { data: newFranchise, error: fErr } = await supabaseAdmin
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

    if (fErr || !newFranchise) {
        throw new HttpError(500, `Error creando franquicia: ${fErr?.message ?? 'desconocido'}`);
    }

    // 4. Insertar personajes
    const baseSlugs = buildUniqueCharacterSlugs(characters.map((c) => c.name));
    const rows = characters.map((c, idx) => ({
        franchise_id: newFranchise.id,
        slug: baseSlugs[idx],
        name: c.name,
        image_url: c.image,
        species: c.species,
        gender: c.gender,
        is_human: c.is_human,
        is_hero: c.is_hero,
        is_villain: c.is_villain,
        is_protagonist: c.is_protagonist,
        has_powers: c.has_powers,
        uses_weapon: c.uses_weapon,
        attributes: {},
    }));

    const { error: cErr } = await supabaseAdmin.from('characters').insert(rows);
    if (cErr) {
        await supabaseAdmin.from('franchises').delete().eq('id', newFranchise.id);
        throw new HttpError(500, `Error insertando personajes: ${cErr.message}`);
    }

    return {
        franchiseId: newFranchise.id,
        franchiseName: newFranchise.name,
        themeSlug: theme.slug,
        charactersImported: rows.length,
    };
}