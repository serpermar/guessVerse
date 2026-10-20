import { Router } from 'express';
import { tmdbFetch, tmdbImageUrl } from '../integrations/tmdb/client.js';
import type { TmdbMovie } from '../integrations/tmdb/types.js';

export const debugRouter = Router();

/**
 * GET /api/debug/tmdb/movie/:id
 * Solo para desarrollo. Borraremos este router en producción.
 */
debugRouter.get('/tmdb/movie/:id', async (req, res, next) => {
    try {
        const movie = await tmdbFetch<TmdbMovie>(`/movie/${req.params.id}`);
        res.json({
            ok: true,
            data: {
                id: movie.id,
                title: movie.title,
                overview: movie.overview,
                release_date: movie.release_date,
                genres: movie.genres,
                poster_url: tmdbImageUrl(movie.poster_path),
            },
        });
    } catch (err) {
        next(err);
    }
});