import { Router } from 'express';
import { getThemes, getThemeBySlug } from '../controllers/themes.controller.js';

export const themesRouter = Router();

themesRouter.get('/', getThemes);
themesRouter.get('/:slug', getThemeBySlug);