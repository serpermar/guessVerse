import { Router } from 'express';
import { importMarvelCharacters } from '../services/import.service.js';
import { seedMarvelAttributes } from '../services/attribute-seed.service.js';
import { importStarWarsCharacters } from '../services/import-starwars.service.js';
import { seedStarWarsAttributes } from '../services/attribute-seed-starwars.service.js';
import { importPokemon } from '../services/import-pokemon.service.js';

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

importRouter.post('/starwars', async (_req, res, next) => {
    try { res.json({ ok: true, result: await importStarWarsCharacters() }); }
    catch (err) { next(err); }
});

importRouter.post('/attributes-starwars', async (_req, res, next) => {
    try { res.json({ ok: true, result: await seedStarWarsAttributes() }); }
    catch (err) { next(err); }
});

importRouter.post('/pokemon', async (_req, res, next) => {
    try { res.json({ ok: true, result: await importPokemon() }); }
    catch (err) { next(err); }
});