import type { Request, Response, NextFunction } from 'express';
import { getQuestionsForTheme } from '../services/questions.service.js';

export async function getThemeQuestions(
    req: Request<{ slug: string }>,
    res: Response,
    next: NextFunction
) {
    try {
        const questions = await getQuestionsForTheme(req.params.slug);
        res.json({ data: questions });
    } catch (err) { next(err); }
}