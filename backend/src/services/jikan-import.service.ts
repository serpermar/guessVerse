// backend/src/services/jikan-import.service.ts
import { supabaseAdmin } from '../db/supabase.js';
import { HttpError } from '../utils/http-error.js';
import { BOARD_SIZE_MIN } from './game.rules.js';
import { slugify, ensureBookTheme, buildUniqueCharacterSlugs } from './book-import.service.js';
import { enrichMangaAttributes } from './ai.service.js';
import type { DiscoveredFranchise } from './discover.service.js';

const JIKAN_BASE = 'https://api.jikan.moe/v4';
const USER_AGENT = 'GuessVerse/1.0 (https://github.com/serpermar/guessVerse)';

interface JikanCharacter {
    character: {
        mal_id: number;
        name: string;
        images?: { jpg?: { image_url?: string | null } | null } | null;
    };
    role?: string;
}

async function fetchWithTimeout(url: string, ms: number): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    try {
        return await fetch(url, {
            headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
            signal: controller.signal,
        });
    } finally {
        clearTimeout(timer);
    }
}

async function fetchJikanCharacters(malId: string): Promise<Array<{ name: string; image: string | null }>> {
    try {
        const res = await fetchWithTimeout(`${JIKAN_BASE}/manga/${malId}/characters`, 8000);
        if (!res.ok) {
            console.warn(`[jikan-import] HTTP ${res.status} para manga ${malId}`);
            return [];
        }
        const json = (await res.json()) as { data?: JikanCharacter[] };
        const list = json.data ?? [];
        return list
            .map((c) => ({
                name: c.character?.name?.trim() ?? '',
                image: c.character?.images?.jpg?.image_url ?? null,
            }))
            .filter((c) => c.name.length > 0);
    } catch (e) {
        console.warn(`[jikan-import] Timeout/error consultando ${malId}:`, (e as Error).message);
        return [];
    }
}

export interface JikanImportResult {
    franchiseId: string;
    franchiseName: string;
    themeSlug: string;
    charactersImported: number;
    warning?: string;
}

export async function importJikanAsFranchise(
    franchise: DiscoveredFranchise,
): Promise<JikanImportResult> {
    const title = franchise.name?.trim();
    if (!title) throw new HttpError(400, 'El manga/cómic no tiene título');

    const slug = slugify(title);

    // 1. Personajes + imágenes
    const rawCharacters = await fetchJikanCharacters(franchise.externalId);
    console.log(`[jikan-import] ${rawCharacters.length} personajes para "${title}"`);

    if (rawCharacters.length < BOARD_SIZE_MIN) {
        throw new HttpError(
            400,
            `"${title}" solo tiene ${rawCharacters.length} personajes en Jikan (mínimo ${BOARD_SIZE_MIN}).`,
        );
    }

    // 2. Atributos IA
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
    const theme = await ensureBookTheme(title, String(franchise.description ?? ''), franchise.imageUrl);

    const { data: existing } = await supabaseAdmin
        .from('franchises')
        .select('id, name')
        .eq('theme_id', theme.id)
        .eq('slug', slug)
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
            slug,
            name: title,
            description: String(franchise.description ?? '').slice(0, 1000) || null,
            image_url: franchise.imageUrl,
            source: 'jikan_manga',
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