import { Router } from 'express';
import { patchCharacter } from '../controllers/characters.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

export const charactersRouter = Router();
charactersRouter.patch('/:id', requireAuth, patchCharacter);