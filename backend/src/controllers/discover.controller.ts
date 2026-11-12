import type { Request, Response } from 'express';
import { discoverFranchises, type DiscoveredFranchise } from '../services/discover.service.js';
import { importFranchise } from '../services/import-franchise.service.js';
import { importBookAsFranchise } from '../services/book-import.service.js';
import { importMangaAsFranchise } from '../services/manga-import.service.js';
import { importJikanAsFranchise } from '../services/jikan-import.service.js';
import { asyncHandler } from '../utils/async-handler.js';

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