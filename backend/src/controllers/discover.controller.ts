import type { Request, Response } from 'express';
import { discoverFranchises, type DiscoveredFranchise } from '../services/discover.service.js';
import { importFranchise } from '../services/import-franchise.service.js';
import { importBookAsFranchise } from '../services/book-import.service.js';
import { importMangaAsFranchise } from '../services/manga-import.service.js';
import { importJikanAsFranchise } from '../services/jikan-import.service.js';
import { asyncHandler } from '../utils/async-handler.js';
import { importSuperheroFranchise } from '../services/superhero-import.service.js';

export const getDiscover = asyncHandler(async (req: Request, res: Response) => {
    const query = req.query.q as string;
    if (!query) {
        res.status(400).json({ error: 'El parámetro de búsqueda "q" es obligatorio.' });
        return;
    }
    const results = await discoverFranchises(query);
    res.json({ data: results });
});

export const postImportFranchise = asyncHandler(async (req: Request, res: Response) => {
    console.log('[discover/import] body recibido:', JSON.stringify(req.body));

    try {
        const franchise = req.body as DiscoveredFranchise;
        if (!franchise || !franchise.source || !franchise.externalId) {
            res.status(400).json({ error: 'Faltan datos de la franquicia.' });
            return;
        }

        // LIBROS
        if (franchise.source === 'openlibrary') {
            const result = await importBookAsFranchise(franchise);
            res.status(201).json({
                ok: true,
                message: result.warning
                    ? `${result.charactersImported} personajes importados. ${result.warning}`
                    : `Libro "${result.franchiseName}" importado con ${result.charactersImported} personajes.`,
                franchiseId: result.franchiseId,
                themeSlug: result.themeSlug,
                charactersImported: result.charactersImported,
            });
            return;
        }

        // MANGA (AniList)
        if (franchise.source === 'anilist_manga') {
            const result = await importMangaAsFranchise(franchise);
            res.status(201).json({
                ok: true,
                message: result.warning
                    ? `${result.charactersImported} personajes importados. ${result.warning}`
                    : `Manga "${result.franchiseName}" importado con ${result.charactersImported} personajes.`,
                franchiseId: result.franchiseId,
                themeSlug: result.themeSlug,
                charactersImported: result.charactersImported,
            });
            return;
        }

        // MANGA (Jikan)
        if (franchise.source === 'jikan_manga') {
            const result = await importJikanAsFranchise(franchise);
            res.status(201).json({
                ok: true,
                message: result.warning
                    ? `${result.charactersImported} personajes importados. ${result.warning}`
                    : `Manga "${result.franchiseName}" importado con ${result.charactersImported} personajes.`,
                franchiseId: result.franchiseId,
                themeSlug: result.themeSlug,
                charactersImported: result.charactersImported,
            });
            return;
        }

        // RESTO (películas, series, anime, videojuegos)
        if (franchise.source === 'superhero') {
            const result = await importSuperheroFranchise(franchise);
            res.status(201).json({
                ok: true,
                message: result.warning
                    ? `${result.charactersImported} personajes importados. ${result.warning}`
                    : `Franquicia "${result.franchiseName}" importada con ${result.charactersImported} personajes.`,
                franchiseId: result.franchiseId,
                themeSlug: result.themeSlug,
                charactersImported: result.charactersImported,
            });
            return;
        }

        await importFranchise(franchise);
        res.status(201).json({
            ok: true,
            message: `Franquicia "${franchise.name}" importada.`,
        });
    } catch (err) {
        // 🔍 Log detallado para diagnosticar
        console.error('[discover/import] ❌ Error:', err);
        console.error('[discover/import] Mensaje:', (err as Error)?.message);
        console.error('[discover/import] Stack:', (err as Error)?.stack);

        const status =
            (err as { status?: number })?.status &&
                Number.isInteger((err as { status?: number }).status)
                ? (err as { status: number }).status
                : 400;
        res.status(status).json({ error: (err as Error).message });
    }
});

export const getSuperheroDebug = asyncHandler(async (_req: Request, res: Response) => {
    const urls = [
        'https://cdn.jsdelivr.net/gh/akabab/superhero-api@0.3.0/api/all.json',
        'https://raw.githubusercontent.com/akabab/superhero-api/master/api/all.json',
        'https://akabab.github.io/superhero-api/api/all.json',
    ];

    const results = await Promise.all(urls.map(async (url) => {
        const start = Date.now();
        try {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 5000);
            const r = await fetch(url, { signal: controller.signal }).finally(() => clearTimeout(timer));
            const text = await r.text();
            return {
                url,
                status: r.status,
                ok: r.ok,
                ms: Date.now() - start,
                bytes: text.length,
            };
        } catch (e) {
            return { url, ok: false, error: (e as Error).message, ms: Date.now() - start };
        }
    }));

    res.json({ results });
});