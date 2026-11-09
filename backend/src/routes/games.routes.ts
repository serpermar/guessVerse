// backend/src/routes/games.routes.ts
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import {
    postCreateGame,
    postQuestion,
    postGuess,
    postAbandon,
    getGameById,
    postAskFree,
} from '../controllers/games.controller.js';

export const gamesRouter = Router();

gamesRouter.post('/', requireAuth, postCreateGame);
gamesRouter.get('/:id', requireAuth, getGameById);
gamesRouter.post('/:id/questions', requireAuth, postQuestion);
gamesRouter.post('/:id/ask-free', requireAuth, postAskFree);
gamesRouter.post('/:id/guess', requireAuth, postGuess);
gamesRouter.post('/:id/abandon', requireAuth, postAbandon);