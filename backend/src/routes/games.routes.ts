import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { requireAuth } from '../middleware/auth.middleware.js';
import {
    postCreateGame,
    postQuestion,
    postGuess,
    postAbandon,
    postLose,
    getGameById,
} from '../controllers/games.controller.js';

export const gamesRouter = Router();

// Crear partidas es más sensible: límite propio además del global.
const createGameLimiter = rateLimit({
    windowMs: 60_000,
    limit: 20,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Demasiadas partidas creadas. Espera un momento.' },
});

gamesRouter.post('/', createGameLimiter, requireAuth, postCreateGame);
gamesRouter.get('/:id', requireAuth, getGameById);
gamesRouter.post('/:id/questions', requireAuth, postQuestion);
gamesRouter.post('/:id/guess', requireAuth, postGuess);
gamesRouter.post('/:id/lose', requireAuth, postLose);
gamesRouter.post('/:id/abandon', requireAuth, postAbandon);
