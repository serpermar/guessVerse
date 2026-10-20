import { Router } from 'express';
import { getThemes } from '../controllers/themes.controller.js';

export const themesRouter = Router();

themesRouter.get('/', getThemes);