import { Router } from 'express';
import { importMarvelCharacters } from '../services/import.service.js';
import { seedMarvelAttributes } from '../services/attribute-seed.service.js';

export const importRouter = Router();

importRouter.post('/marvel', async (_req, res, next) => {
    try {
        const result = await importMarvelCharacters();
        res.json({ ok: true, result });
    } catch (err) {
        next(err);
    }
});

importRouter.post('/attributes-marvel', async (_req, res, next) => {
    try {
        const result = await seedMarvelAttributes();
        res.json({ ok: true, result });
    } catch (err) { next(err); }
});