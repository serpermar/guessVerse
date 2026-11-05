import { createCustomQuestion } from '../repositories/questions.repository.js';
import { supabaseAdmin } from '../db/supabase.js';
import { z } from 'zod';
import type { Request, Response, NextFunction } from 'express';
import { asyncHandler } from '../utils/async-handler.js';
import { HttpError } from '../utils/http-error.js';
import { getQuestionsForTheme } from '../services/questions.service.js';

const slugParamSchema = z.object({ slug: z.string().min(1).max(64) });

const createSchema = z.object({
    textEs: z.string().min(3),
    attribute: z.string().min(3),
});

export async function createThemeQuestion(req: Request<{ slug: string }>, res: Response, next: NextFunction) {
    try {
        const { textEs, attribute } = createSchema.parse(req.body);

        const { data: theme } = await supabaseAdmin.from('themes').select('id').eq('slug', req.params.slug).single();
        if (!theme) throw new Error('Temática no encontrada');

        // NUEVO: Comprobar si ya existe una pregunta con ese atributo en esta temática
        const { data: existing } = await supabaseAdmin
            .from('questions')
            .select('id')
            .eq('theme_id', theme.id)
            .eq('attribute', attribute)
            .maybeSingle();

        if (existing) {
            throw new Error('Ya existe una pregunta con ese atributo para esta temática.');
        }

        const code = `custom_${theme.id.slice(0, 4)}_${Date.now()}`;

        const question = await createCustomQuestion(theme.id, code, textEs, attribute);
        res.status(201).json({ data: question });
    } catch (err) {
        next(err);
    }
}

export const getThemeQuestions = asyncHandler(
    async (req: Request<{ slug: string }>, res: Response) => {
        const parsed = slugParamSchema.safeParse(req.params);
        if (!parsed.success) throw HttpError.badRequest('Slug inválido');
        const questions = await getQuestionsForTheme(parsed.data.slug);
        res.json({ data: questions });
    }
);