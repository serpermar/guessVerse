import { Router } from 'express';
import { importMarvelCharacters } from '../services/import.service.js';
import { seedMarvelAttributes } from '../services/attribute-seed.service.js';
import { importStarWarsCharacters } from '../services/import-starwars.service.js';
import { seedStarWarsAttributes } from '../services/attribute-seed-starwars.service.js';
import { importPokemon } from '../services/import-pokemon.service.js';
import { importMarvelImages } from '../services/import-marvel-images.service.js';
import { importStarWarsImages } from '../services/import-starwars-images.service.js';
import { importMovieTheme, MOVIE_CATALOGS } from '../services/import-movies.service.js';
import { seedThemes } from '../services/seed-themes.service.js';
import { asyncHandler } from '../utils/async-handler.js';
import { HttpError } from '../utils/http-error.js';
import { importHarryPotter } from '../services/import-harrypotter.service.js';
import { seedHarryPotterAttributes } from '../services/attribute-seed-harrypotter.service.js';
import { importDC } from '../services/import-dc.service.js';
import { seedDCAttributes } from '../services/attribute-seed-dc.service.js';
import { requireImportToken } from '../middleware/import-auth.middleware.js';

export const importRouter = Router();

importRouter.use(requireImportToken);

// Temáticas existentes
importRouter.post('/marvel', asyncHandler(async (_req, res) => {
    const result = await importMarvelCharacters();
    res.json({ ok: true, result });
}));

importRouter.post('/attributes-marvel', asyncHandler(async (_req, res) => {
    const result = await seedMarvelAttributes();
    res.json({ ok: true, result });
}));

importRouter.post('/starwars', asyncHandler(async (_req, res) => {
    const result = await importStarWarsCharacters();
    res.json({ ok: true, result });
}));

importRouter.post('/attributes-starwars', asyncHandler(async (_req, res) => {
    const result = await seedStarWarsAttributes();
    res.json({ ok: true, result });
}));

importRouter.post('/pokemon', asyncHandler(async (_req, res) => {
    const result = await importPokemon();
    res.json({ ok: true, result });
}));

importRouter.post('/marvel-images', asyncHandler(async (_req, res) => {
    const result = await importMarvelImages();
    res.json({ ok: true, result });
}));

importRouter.post('/starwars-images', asyncHandler(async (_req, res) => {
    const result = await importStarWarsImages();
    res.json({ ok: true, result });
}));

// Sembrar temáticas y franquicias desde el registro
importRouter.post('/seed-themes', asyncHandler(async (_req, res) => {
    const result = await seedThemes();
    res.json({ ok: true, result });
}));

// Importador genérico basado en películas TMDB (catálogo verificado)
importRouter.post('/movies/:themeSlug', asyncHandler(async (req, res) => {
    const { themeSlug } = req.params;
    if (!MOVIE_CATALOGS.some((c) => c.themeSlug === themeSlug)) {
        throw HttpError.badRequest(`Tema "${themeSlug}" no tiene catálogo de películas registrado`);
    }
    const result = await importMovieTheme(themeSlug);
    res.json({ ok: true, result });
}));

// Listado de catálogos disponibles (solo dev)
importRouter.get('/movies', (_req, res) => {
    res.json({
        ok: true,
        data: MOVIE_CATALOGS.map((c) => ({
            themeSlug: c.themeSlug,
            franchiseSlug: c.franchiseSlug,
            movies: c.movies.length,
        })),
    });
});

importRouter.post('/harrypotter', async (_req, res, next) => {
    try { res.json({ ok: true, result: await importHarryPotter() }); }
    catch (err) { next(err); }
});

importRouter.post('/attributes-harrypotter', async (_req, res, next) => {
    try { res.json({ ok: true, result: await seedHarryPotterAttributes() }); }
    catch (err) { next(err); }
});

importRouter.post('/dc', async (_req, res, next) => {
    try { res.json({ ok: true, result: await importDC() }); }
    catch (err) { next(err); }
});

importRouter.post('/attributes-dc', async (_req, res, next) => {
    try { res.json({ ok: true, result: await seedDCAttributes() }); }
    catch (err) { next(err); }
});