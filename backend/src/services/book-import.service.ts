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

// 🔑 EXPORTADO — lo usa manga-import y jikan-import
export async function resolveExistingSlugs(
    slugs: string[],
    franchiseId: string,
): Promise<Map<string, string>> {
    const { data: existing, error } = await supabaseAdmin
        .from('characters')
        .select('slug')
        .in('slug', slugs);

    if (error || !existing) return new Map();

    const taken = new Set(existing.map((r: { slug: string }) => r.slug));
    const suffix = franchiseId.replace(/-/g, '').slice(0, 8);
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

// Códigos Postgres que indican incompatibilidad de esquema.
const SCHEMA_ERROR_CODES = new Set([
    '23514', // check_violation
    '42703', // undefined_column
    '42P01', // undefined_table
    '22P02', // invalid_text_representation (enum inválido)
    '42804', // datatype_mismatch
]);

function isSchemaError(error: { code?: string; message?: string } | null): boolean {
    if (!error) return false;
    if (error.code && SCHEMA_ERROR_CODES.has(error.code)) return true;
    return /type|check|constraint|column/i.test(error.message ?? '');
}

// 🔑 EXPORTADO — lo usa manga-import, jikan-import y superhero-import
// El 4º parámetro `type` es OPCIONAL: si no se pasa, se usa 'book'.
// Esto mantiene compatibilidad con los callers que solo pasan 3 args.
export async function ensureBookTheme(
    title: string,
    description: string,
    imageUrl: string | null,
    type: string = 'book',
): Promise<{ id: string; slug: string; name: string; created: boolean }> {
    const slug = slugify(title);
    console.log(`[book-import] ensureBookTheme → slug="${slug}" type="${type}"`);

    const { data: existing, error: findErr } = await supabaseAdmin
        .from('themes')
        .select('id, slug, name')
        .eq('slug', slug)
        .maybeSingle();

    if (findErr) logSupabaseError('Error buscando tema existente', findErr);
    if (existing) {
        console.log('[book-import] ✅ Tema ya existía:', existing);
        return { ...existing, created: false };
    }

    let { data: created, error } = await supabaseAdmin
        .from('themes')
        .insert({
            slug,
            name: title,
            description: description || null,
            image_url: imageUrl,
            is_active: true,
            type,                       // <-- ahora usa el parámetro
        })
        .select('id, slug, name')
        .single();

    if (isSchemaError(error)) {
        console.warn('[book-import] Fallback sin type. Causa:', error!.message, `(code=${error!.code})`);
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
    return { ...created, created: true };
}

export interface BookImportResult {
    franchiseId: string;
    franchiseName: string;
    themeSlug: string;
    charactersImported: number;
    warning?: string;
}

// Cache del índice de Superhero API (con TTL)
const SUPERHERO_INDEX_TTL_MS = 30 * 60_000;
let superheroCache: { data: Array<{ name: string; imageUrl: string | null }>; at: number } | null = null;
let superheroPromise: Promise<Array<{ name: string; imageUrl: string | null }>> | null = null;

async function fetchSuperheroIndex(): Promise<Array<{ name: string; imageUrl: string | null }>> {
    const urls = [
        'https://cdn.jsdelivr.net/gh/akabab/superhero-api@0.3.0/api/all.json',
        'https://raw.githubusercontent.com/akabab/superhero-api/master/api/all.json',
        'https://akabab.github.io/superhero-api/api/all.json',
    ];

    for (const url of urls) {
        try {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 8000);
            const res = await fetch(url, {
                signal: controller.signal,
                headers: { 'User-Agent': USER_AGENT },
            }).finally(() => clearTimeout(timer));
            if (!res.ok) continue;
            const all = (await res.json()) as Array<{
                name?: string | null;
                image?: { lg?: string | null; md?: string | null; sm?: string | null } | null;
            }>;
            const index = all
                .filter((c) => c.name && (c.image?.lg || c.image?.md || c.image?.sm))
                .map((c) => ({
                    name: c.name as string,
                    imageUrl: c.image?.lg ?? c.image?.md ?? c.image?.sm ?? null,
                }));
            console.log(`[book-import] Superhero index cargado: ${index.length} personajes`);
            return index;
        } catch (e) {
            console.warn(`[book-import] Superhero ${url.split('/')[2]} falló:`, (e as Error).message);
        }
    }
    return [];
}

async function loadSuperheroIndex(): Promise<Array<{ name: string; imageUrl: string | null }>> {
    if (superheroCache && Date.now() - superheroCache.at < SUPERHERO_INDEX_TTL_MS) {
        return superheroCache.data;
    }
    if (superheroPromise) return superheroPromise;

    superheroPromise = (async () => {
        try {
            const data = await fetchSuperheroIndex();
            superheroCache = { data, at: Date.now() };
            return data;
        } finally {
            superheroPromise = null;
        }
    })();
    return superheroPromise;
}

function findSuperheroImage(
    name: string,
    index: Array<{ name: string; imageUrl: string | null }>,
): string | null {
    if (index.length === 0) return null;
    const norm = (s: string) =>
        s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[-_\s.]+/g, '').trim();
    const target = norm(name);
    const exact = index.find((c) => norm(c.name) === target);
    return exact?.imageUrl ?? null;
}

export async function importBookAsFranchise(
    franchise: DiscoveredFranchise,
): Promise<BookImportResult> {
    console.log('[book-import] ─── INICIO ───');
    const title = franchise.name?.trim();
    if (!title) throw new HttpError(400, 'El libro no tiene título');

    const franchiseSlug = slugify(title);

    const details = await fetchWorkDetails(franchise.externalId);
    const fullDescription =
        (typeof details?.description === 'string' && details.description) ||
        (typeof details?.description === 'object' && details.description?.value) ||
        franchise.description ||
        '';

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

    const superheroIndex = await loadSuperheroIndex();
    const extractedWithImages = extracted.map((c) => ({
        ...c,
        imageUrl: findSuperheroImage(c.name, superheroIndex),
    }));
    const withImages = extractedWithImages.filter((c) => c.imageUrl).length;
    console.log(`[book-import] 🖼️ ${withImages}/${extractedWithImages.length} personajes con imagen de Superhero API`);

    const theme = await ensureBookTheme(
        title,
        String(fullDescription).slice(0, 1000),
        franchise.imageUrl,
    );

    try {
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

        const baseSlugs = buildUniqueCharacterSlugs(extractedWithImages.map((c) => c.name));
        const slugMap = await resolveExistingSlugs(baseSlugs, newFranchise.id);

        const rows = extractedWithImages.map((c, idx) => ({
            franchise_id: newFranchise.id,
            slug: slugMap.get(baseSlugs[idx]) ?? baseSlugs[idx],
            name: c.name.trim(),
            image_url: c.imageUrl ?? null,
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
            charactersImported: extractedWithImages.length,
        };
    } catch (err) {
        if (theme.created) {
            console.warn(`[book-import] ↩️ Rollback tema "${theme.slug}" (id=${theme.id})`);
            await supabaseAdmin.from('themes').delete().eq('id', theme.id);
        }
        throw err;
    }
}