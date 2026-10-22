import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { findUserById, updateUser } from '../repositories/users.repository.js';
import { getStats } from '../services/stats.service.js';
import { supabaseAdmin } from '../db/supabase.js';
import { HttpError } from '../utils/http-error.js';

export async function getMe(req: Request, res: Response, next: NextFunction) {
    try {
        const user = await findUserById(req.user!.id);
        if (!user) throw new HttpError(404, 'Usuario no encontrado');
        res.json({ data: user });
    } catch (err) { next(err); }
}

const patchSchema = z.object({
    username: z.string().min(3).max(20).regex(/^[a-z0-9_]+$/).optional(),
    avatar_url: z
        .string()
        .url()
        .refine((value) => value.startsWith('https://'), 'avatar_url debe usar HTTPS')
        .optional(),
});

export async function patchMe(req: Request, res: Response, next: NextFunction) {
    try {
        const patch = patchSchema.parse(req.body);
        const user = await updateUser(req.user!.id, patch);
        res.json({ data: user });
    } catch (err) { next(err); }
}

export async function getMyStats(req: Request, res: Response, next: NextFunction) {
    try {
        const stats = await getStats(req.user!.id);
        res.json({ data: stats });
    } catch (err) { next(err); }
}

export async function getMyGames(req: Request, res: Response, next: NextFunction) {
    try {
        const rawLimit = Number(req.query.limit);
        const limit = Number.isFinite(rawLimit)
            ? Math.min(Math.max(Math.trunc(rawLimit), 1), 50)
            : 20;
        const { data, error } = await supabaseAdmin
            .from('games')
            .select('id, status, mode, started_at, finished_at, themes(name, slug)')
            .eq('created_by', req.user!.id)
            .order('started_at', { ascending: false })
            .limit(limit);
        if (error) throw new Error(error.message);
        res.json({ data });
    } catch (err) { next(err); }
}