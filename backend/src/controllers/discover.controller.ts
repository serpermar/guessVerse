import type { Request, Response } from 'express';
import { discoverFranchises, type DiscoveredFranchise } from '../services/discover.service.js';
import { importFranchise } from '../services/import-franchise.service.js';
import { importBookAsFranchise } from '../services/book-import.service.js';
import { importMangaAsFranchise } from '../services/manga-import.service.js';
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
    try {
        const franchise = req.body as DiscoveredFranchise;
        if (!franchise || !franchise.source || !franchise.externalId) {
            res.status(400).json({ error: 'Faltan datos de la franquicia.' });
            return;
        }

        // ============================================================
        // LIBROS: Open Library no expone personajes → los extraemos con IA.
        // ============================================================
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

        // ============================================================
        // MANGA: AniList devuelve personajes estructurados → no hace falta IA.
        // ============================================================
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

        // ============================================================
        // RESTO: películas, series, anime y videojuegos (flujo existente).
        // ============================================================
        await importFranchise(franchise);
        res.status(201).json({
            ok: true,
            message: `Franquicia "${franchise.name}" importada.`,
        });
    } catch (err) {
        // Preserva el status del HttpError si lo hay, si no 400.
        const status =
            (err as { status?: number })?.status &&
                Number.isInteger((err as { status?: number }).status)
                ? (err as { status: number }).status
                : 400;
        res.status(status).json({ error: (err as Error).message });
    }
});