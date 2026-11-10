// backend/src/routes/games.routes.ts
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { requireAuth } from '../middleware/auth.middleware.js';
import { postCreateGame, postQuestion, postGuess, postAbandon, getGameById, postAskFree, postHint } from '../controllers/games.controller.js';

export const gamesRouter = Router();

/** La IA es costosa: limita las preguntas libres por IP/minuto. */
const askFreeLimiter = rateLimit({
    windowMs: 60_000,
    limit: 10,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Demasiadas preguntas a la IA. Espera un momento.' },
});

gamesRouter.post('/', requireAuth, postCreateGame);
gamesRouter.get('/:id', requireAuth, getGameById);
gamesRouter.post('/:id/questions', requireAuth, postQuestion);
gamesRouter.post('/:id/ask-free', askFreeLimiter, requireAuth, postAskFree);
gamesRouter.post('/:id/guess', requireAuth, postGuess);
gamesRouter.post('/:id/abandon', requireAuth, postAbandon);
gamesRouter.post('/:id/hint', requireAuth, postHint);
