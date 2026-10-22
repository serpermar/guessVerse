import { Router } from 'express';
import {
    postCreateGame,
    postQuestion,
    postGuess,
    postAbandon,
    getGameById,
} from '../controllers/games.controller.js';

export const gamesRouter = Router();
gamesRouter.post('/', postCreateGame);
gamesRouter.get('/:id', getGameById);
gamesRouter.post('/:id/questions', postQuestion);
gamesRouter.post('/:id/guess', postGuess);
gamesRouter.post('/:id/abandon', postAbandon);
