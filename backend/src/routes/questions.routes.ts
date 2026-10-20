import { Router } from 'express';
import { getThemeQuestions } from '../controllers/questions.controller.js';

export const questionsRouter = Router();
questionsRouter.get('/:slug/questions', getThemeQuestions);