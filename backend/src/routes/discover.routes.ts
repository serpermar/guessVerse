import { Router } from 'express';
import { asyncHandler } from '../utils/async-handler.js';
import { discoverFranchises, type DiscoveredFranchise } from '../services/discover.service.js';
import { importFranchise } from '../services/import-franchise.service.js';

export const discoverRouter = Router();

discoverRouter.get('/', asyncHandler(async (req, res) => {
    const query = req.query.q as string;
    if (!query) {
        return res.status(400).json({ error: 'El parámetro de búsqueda "q" es obligatorio.' });
    }
    const results = await discoverFranchises(query);
    res.json({ data: results });
}));

discoverRouter.post('/import', asyncHandler(async (req, res) => {
    const franchise = req.body as DiscoveredFranchise;
    await importFranchise(franchise);
    res.status(201).json({ ok: true, message: `Franquicia "${franchise.name}" importada.` });
}));