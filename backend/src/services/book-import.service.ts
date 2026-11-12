// backend/src/services/book-import.service.ts
import { supabaseAdmin } from '../db/supabase.js';
import { HttpError } from '../utils/http-error.js';
import { BOARD_SIZE_MIN } from './game.rules.js';
import { extractBookCharacters, type BookInfo } from './ai.service.js';
import type { DiscoveredFranchise } from './discover.service.js';

const OPEN_LIBRARY_BASE = 'https://openlibrary.org';
const USER_AGENT = 'GuessVerse/1.0 (https://github.com/serpermar/guessVerse)';

interface OpenLibraryWorkDetail {
    title?: string;
    description?: string | { value: string };
    covers?: number[];
    first_publish_date?: string;
    subjects?: string[];
}

function normalizeExternalId(raw: string): string {
    return raw.replace(/^\/?works\//, '').replace(/^\//, '');
}

async function fetchWorkDetails(externalId: string): Promise<OpenLibraryWorkDetail | null> {
    const id = normalizeExternalId(externalId);
    try {
        const res = await fetch(`${OPEN_LIBRARY_BASE}/works/${id}.json`, {
            headers: { 'User-Agent': USER_AGENT },
        });
        if (!res.ok) return null;
        return (await res.json()) as OpenLibraryWorkDetail;
    } catch (err) {
        console.warn(`[book-import] Error obteniendo detalles de ${id}:`, err);
        return null;
    }
}

// 🔑 EXPORTADO — lo usa manga-import y jikan-import
export function slugify(name: string): string {
    return name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
}

// 🔑 EXPORTADO
export function buildUniqueCharacterSlugs(names: string[]): string[] {
    const seen = new Map<string, number>();
    return names.map((raw, idx) => {
        const base = slugify(raw) || `personaje-${idx + 1}`;
        const count = (seen.get(base) ?? 0) + 1;
        seen.set(base, count);
        return count === 1 ? base : `${base}-${count}`;
    });
}

async function resolveExistingSlugs(slugs: string[], franchiseId: string): Promise<Map<string, string>> {
    const { data: existing, error } = await supabaseAdmin
        .from('characters')
        .select('slug')
        .in('slug', slugs);

    if (error || !existing) return new Map();

    const taken = new Set(existing.map((r: { slug: string }) => r.slug));
    const suffix = franchiseId.slice(0, 6);
    const map = new Map<string, string>();
    for (const s of slugs) {
        map.set(s, taken.has(s) ? `${s}-${suffix}` : s);
    }
    return map;
}

function logSupabaseError(label: string, error: any) {
    console.error(`[book-import] ❌ ${label}`);
    if (!error) return;
    console.error('  code:    ', error.code);
    console.error('  message: ', error.message);
    console.error('  details: ', error.details);
    console.error('  hint:    ', error.hint);
}

// 🔑 EXPORTADO — lo usa manga-import y jikan-import
export async function ensureBookTheme(
    title: string,
    description: string,
    imageUrl: string | null,
): Promise<{ id: string; slug: string; name: string }> {
    const slug = slugify(title);
    console.log(`[book-import] ensureBookTheme → slug="${slug}"`);

    const { data: existing, error: findErr } = await supabaseAdmin
        .from('themes')
        .select('id, slug, name')
        .eq('slug', slug)
        .maybeSingle();

    if (findErr) logSupabaseError('Error buscando tema existente', findErr);
    if (existing) {
        console.log('[book-import] ✅ Tema ya existía:', existing);
        return existing;
    }

    let { data: created, error } = await supabaseAdmin
        .from('themes')
        .insert({
            slug,
            name: title,
            description: description || null,
            image_url: imageUrl,
            is_active: true,
            type: 'book',
        })
        .select('id, slug, name')
        .single();

    if (error && /type|check|constraint|column/i.test(error.message)) {
        console.warn('[book-import] Fallback sin type. Causa:', error.message);
        const retry = await supabaseAdmin
            .from('themes')
            .insert({
                slug,
                name: title,
                description: description || null,
                image_url: imageUrl,
                is_active: true,
            })
            .select('id, slug, name')
            .single();
        created = retry.data;
        error = retry.error;
    }

    if (error || !created) {
        logSupabaseError('Error creando tema', error);
        throw new HttpError(500, `No se pudo crear la temática "${title}": ${error?.message ?? 'error desconocido'}`);
    }

    console.log('[book-import] ✅ Tema creado:', created);
    return created;
}

export interface BookImportResult {
    franchiseId: string;
    franchiseName: string;
    themeSlug: string;
    charactersImported: number;
    warning?: string;
}

export async function importBookAsFranchise(
    franchise: DiscoveredFranchise,
): Promise<BookImportResult> {
    console.log('[book-import] ─── INICIO ───');
    const title = franchise.name?.trim();
    if (!title) throw new HttpError(400, 'El libro no tiene título');

    const franchiseSlug = slugify(title);

    // PASO 1
    const details = await fetchWorkDetails(franchise.externalId);
    const fullDescription =
        (typeof details?.description === 'string' && details.description) ||
        (typeof details?.description === 'object' && details.description?.value) ||
        franchise.description ||
        '';

    // PASO 2
    const bookInfo: BookInfo = {
        title,
        authors: [],
        description: String(fullDescription).slice(0, 4000),
        firstPublishYear: null,
    };
    const extracted = await extractBookCharacters(bookInfo);
    console.log(`[book-import] ✅ Extraídos ${extracted.length} personajes (mínimo ${BOARD_SIZE_MIN})`);

    if (extracted.length < BOARD_SIZE_MIN) {
        throw new HttpError(
            400,
            `Solo se han podido extraer ${extracted.length} personajes de "${title}" (mínimo ${BOARD_SIZE_MIN}).`,
        );
    }

    // PASO 3
    const theme = await ensureBookTheme(title, String(fullDescription).slice(0, 1000), franchise.imageUrl);

    // PASO 4
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
            warning: `La franquicia "${existingFranchise.name}" ya existía.`,
        };
    }

    // PASO 5
    const { data: newFranchise, error: franchiseErr } = await supabaseAdmin
        .from('franchises')
        .insert({
            theme_id: theme.id,
            slug: franchiseSlug,
            name: title,
            description: String(fullDescription).slice(0, 1000) || null,
            image_url: franchise.imageUrl,
            source: 'openlibrary',
            external_id: normalizeExternalId(franchise.externalId),
        })
        .select('id, name')
        .single();

    if (franchiseErr || !newFranchise) {
        logSupabaseError('Error creando franquicia', franchiseErr);
        throw new HttpError(500, `No se pudo crear la franquicia: ${franchiseErr?.message ?? 'error desconocido'}`);
    }

    // PASO 6
    const baseSlugs = buildUniqueCharacterSlugs(extracted.map((c) => c.name));
    const slugMap = await resolveExistingSlugs(baseSlugs, newFranchise.id);

    const rows = extracted.map((c, idx) => ({
        franchise_id: newFranchise.id,
        slug: slugMap.get(baseSlugs[idx]) ?? baseSlugs[idx],
        name: c.name.trim(),
        image_url: null,
        species: c.species ?? null,
        gender: c.gender ?? null,
        is_human: c.is_human ?? null,
        is_hero: c.is_hero ?? null,
        is_villain: c.is_villain ?? null,
        is_protagonist: c.is_protagonist ?? null,
        has_powers: c.has_powers ?? null,
        uses_weapon: c.uses_weapon ?? null,
        attributes: c.extraAttributes ?? {},
    }));

    const { error: charsErr } = await supabaseAdmin.from('characters').insert(rows);

    if (charsErr) {
        logSupabaseError('Error insertando personajes', charsErr);
        await supabaseAdmin.from('franchises').delete().eq('id', newFranchise.id);
        throw new HttpError(500, `No se pudieron insertar los personajes: ${charsErr.message}`);
    }

    console.log(`[book-import] ✅ ${rows.length} personajes insertados`);
    return {
        franchiseId: newFranchise.id,
        franchiseName: newFranchise.name,
        themeSlug: theme.slug,
        charactersImported: extracted.length,
    };
}