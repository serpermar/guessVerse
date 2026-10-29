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
    species: z.string().nullable().optional(),
});

export const patchCharacter = asyncHandler(async (req: Request<{ id: string }>, res: Response) => {
    const data = updateSchema.parse(req.body);

    // Limpiamos los datos antes de guardarlos
    const cleanData = {
        is_hero: data.is_hero ?? false,
        is_villain: data.is_villain ?? false,
        is_protagonist: data.is_protagonist ?? false,
        has_powers: data.has_powers ?? false,
        uses_weapon: data.uses_weapon ?? false,
        is_human: data.is_human ?? false,
        // Si el string está vacío o solo tiene espacios, lo guardamos como null
        species: !data.species || data.species.trim() === '' ? null : data.species.trim(),
    };

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