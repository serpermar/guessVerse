import { z } from 'zod';
import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/async-handler.js';
import { HttpError } from '../utils/http-error.js';
import { getQuestionsForTheme } from '../services/questions.service.js';

const slugParamSchema = z.object({ slug: z.string().min(1).max(64) });

export const getThemeQuestions = asyncHandler(
    async (req: Request<{ slug: string }>, res: Response) => {
        const parsed = slugParamSchema.safeParse(req.params);
        if (!parsed.success) throw HttpError.badRequest('Slug inválido');
        const questions = await getQuestionsForTheme(parsed.data.slug);
        res.json({ data: questions });
    }
);
