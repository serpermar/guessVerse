import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/async-handler.js';
import { supabaseAdmin } from '../db/supabase.js';
import { z } from 'zod';

const updateSchema = z.object({
    is_hero: z.boolean().nullable().optional(),
    is_villain: z.boolean().nullable().optional(),
    is_protagonist: z.boolean().nullable().optional(),
    has_powers: z.boolean().nullable().optional(),
    uses_weapon: z.boolean().nullable().optional(),
    is_human: z.boolean().nullable().optional(),
    attributes: z.record(z.string(), z.any()).optional(), // <-- CORREGIDO
});

export const patchCharacter = asyncHandler(async (req: Request<{ id: string }>, res: Response) => {
    const data = updateSchema.parse(req.body);

    const cleanData: any = {};

    if (data.is_hero !== undefined) cleanData.is_hero = data.is_hero ?? false;
    if (data.is_villain !== undefined) cleanData.is_villain = data.is_villain ?? false;
    if (data.is_protagonist !== undefined) cleanData.is_protagonist = data.is_protagonist ?? false;
    if (data.has_powers !== undefined) cleanData.has_powers = data.has_powers ?? false;
    if (data.uses_weapon !== undefined) cleanData.uses_weapon = data.uses_weapon ?? false;
    if (data.is_human !== undefined) cleanData.is_human = data.is_human ?? false;

    if (data.attributes) {
        cleanData.attributes = data.attributes;
    }

    const { data: char, error } = await supabaseAdmin
        .from('characters')
        .update(cleanData)
        .eq('id', req.params.id)
        .select('*')
        .single();

    if (error || !char) {
        res.status(500).json({ error: error?.message || 'Error actualizando personaje' });
        return;
    }

    res.json({ data: char });
});