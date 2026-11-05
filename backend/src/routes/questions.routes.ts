import { Router } from 'express';
import { getThemeQuestions, createThemeQuestion } from '../controllers/questions.controller.js';

export const questionsRouter = Router();
questionsRouter.get('/:slug/questions', getThemeQuestions);
questionsRouter.post('/:slug/questions', createThemeQuestion); 