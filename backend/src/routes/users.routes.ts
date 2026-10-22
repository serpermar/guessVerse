import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { getMe, patchMe, getMyStats, getMyGames } from '../controllers/users.controller.js';

export const usersRouter = Router();
usersRouter.use(requireAuth);
usersRouter.get('/me', getMe);
usersRouter.patch('/me', patchMe);
usersRouter.get('/me/stats', getMyStats);
usersRouter.get('/me/games', getMyGames);