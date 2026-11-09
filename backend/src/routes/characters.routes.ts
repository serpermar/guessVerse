import { Router } from 'express';
import { patchCharacter } from '../controllers/characters.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

export const charactersRouter = Router();

// La línea que fallaba. Asegúrate de que patchCharacter está bien importado.
charactersRouter.patch('/:id', requireAuth, patchCharacter);