import type { Request, Response } from 'express';
import { discoverFranchises, type DiscoveredFranchise } from '../services/discover.service.js';
import { importFranchise } from '../services/import-franchise.service.js';
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
        await importFranchise(franchise);
        res.status(201).json({ ok: true, message: `Franquicia "${franchise.name}" importada.` });
    } catch (err) {
        // Capturamos cualquier error de importación y lo devolvemos como 400 (no 500)
        res.status(400).json({ error: (err as Error).message });
    }
});