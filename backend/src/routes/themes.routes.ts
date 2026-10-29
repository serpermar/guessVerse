import { Router } from 'express';
import { getThemes, getThemeBySlug, deleteTheme } from '../controllers/themes.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

export const themesRouter = Router();

themesRouter.get('/', getThemes);
themesRouter.get('/:slug', getThemeBySlug);
themesRouter.delete('/:slug', requireAuth, deleteTheme); 