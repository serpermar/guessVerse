// backend/src/services/superhero-import.service.ts
import { supabaseAdmin } from '../db/supabase.js';
import { HttpError } from '../utils/http-error.js';
import { BOARD_SIZE_MIN } from './game.rules.js';
import { slugify, ensureBookTheme, buildUniqueCharacterSlugs } from './book-import.service.js';
import type { DiscoveredFranchise } from './discover.service.js';

const SUPERHERO_API = 'https://cdn.jsdelivr.net/gh/akabab/superhero-api@0.3.0/api';

interface SuperheroCharacter {
    id: number;
    name: string;
    image: { lg?: string | null; md?: string | null } | null;
    appearance: {
        gender?: string | null;
        species?: string | null;
    } | null;
    biography: {
        alignment?: string | null;
        publisher?: string | null;
    } | null;
}

function normalizeGender(raw: string | null | undefined): 'male' | 'female' | 'other' | null {
    if (!raw || raw === '-' || raw === '') return null;
    const v = raw.toLowerCase();
    if (v === 'male') return 'male';
    if (v === 'female') return 'female';
    return 'other';
}

function normalizeSpecies(raw: string | null | undefined): string | null {
    if (!raw || raw === '-' || raw.trim() === '') return null;
    return raw.trim();
}

async function searchSuperheroCharacters(query: string): Promise<SuperheroCharacter[]> {
    const res = await fetch(`${SUPERHERO_API}/all.json`);
    if (!res.ok) return [];
    const all = (await res.json()) as SuperheroCharacter[];

    const q = query.toLowerCase().trim();
    return all
        .filter((c) => {
            const name = c?.name;
            const img = c?.image?.lg ?? c?.image?.md;
            return (
                typeof name === 'string' &&
                name.length > 0 &&
                typeof img === 'string' &&
                img.length > 0 &&
                name.toLowerCase().includes(q)
            );
        })
        .slice(0, 15);
}

export interface SuperheroImportResult {
    franchiseId: string;
    franchiseName: string;
    themeSlug: string;
    charactersImported: number;
    warning?: string;
}

export async function importSuperheroFranchise(
    franchise: DiscoveredFranchise,
): Promise<SuperheroImportResult> {
    const title = franchise.name.trim();
    const slug = slugify(title);

    // 1. Buscar personajes
    const characters = await searchSuperheroCharacters(title);
    console.log(`[superhero-import] ${characters.length} personajes para "${title}"`);

    if (characters.length < BOARD_SIZE_MIN) {
        throw new HttpError(
            400,
            `No se encontraron suficientes personajes para "${title}" (mínimo ${BOARD_SIZE_MIN}).`,
        );
    }

    // 2. Crear/obtener tema
    const theme = await ensureBookTheme(title, franchise.description, franchise.imageUrl);

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

    // 3. Crear franquicia
    const { data: newFranchise, error: fErr } = await supabaseAdmin
        .from('franchises')
        .insert({
            theme_id: theme.id,
            slug,
            name: title,
            description: franchise.description,
            image_url: franchise.imageUrl,
            source: 'superhero',
            external_id: `superhero:${title}`,
        })
        .select('id, name')
        .single();

    if (fErr || !newFranchise) {
        throw new HttpError(500, `Error creando franquicia: ${fErr?.message}`);
    }

    // 4. Insertar personajes (con imagen y atributos)
    const baseSlugs = buildUniqueCharacterSlugs(characters.map((c) => c.name));
    const rows = characters.map((c, idx) => {
        const imageUrl = c.image?.lg ?? c.image?.md ?? null;
        const species = normalizeSpecies(c.appearance?.species);
        const gender = normalizeGender(c.appearance?.gender);
        const alignment = c.biography?.alignment;

        return {
            franchise_id: newFranchise.id,
            slug: baseSlugs[idx],
            name: c.name,
            image_url: imageUrl,
            species,
            gender,
            is_human: species ? species.toLowerCase() === 'human' : null,
            is_hero: alignment === 'good' ? true : alignment === 'bad' ? false : null,
            is_villain: alignment === 'bad' ? true : alignment === 'good' ? false : null,
            is_protagonist: null,
            has_powers: null,
            uses_weapon: null,
            attributes: {
                publisher: c.biography?.publisher ?? null,
                alignment: alignment ?? null,
            },
        };
    });

    const { error: cErr } = await supabaseAdmin.from('characters').insert(rows);
    if (cErr) {
        await supabaseAdmin.from('franchises').delete().eq('id', newFranchise.id);
        throw new HttpError(500, `Error insertando personajes: ${cErr.message}`);
    }

    console.log(`[superhero-import] ✅ ${rows.length} personajes insertados con imágenes`);

    return {
        franchiseId: newFranchise.id,
        franchiseName: newFranchise.name,
        themeSlug: theme.slug,
        charactersImported: rows.length,
    };
}