import type { NextFunction, Request, Response } from 'express';
import { supabaseAdmin } from '../db/supabase.js';
import { HttpError } from '../utils/http-error.js';

function extractBearer(header: string | undefined): string | null {
    if (!header?.startsWith('Bearer ')) return null;
    return header.slice(7).trim() || null;
}

/** Verifica el JWT y adjunta req.user. 401 si falta o es inválido. */
export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
    try {
        const token = extractBearer(req.headers.authorization);
        if (!token) throw new HttpError(401, 'Token de autenticación requerido');

        const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
        if (error || !user) throw new HttpError(401, 'Token inválido o expirado');

        req.user = user;
        next();
    } catch (err) {
        next(err);
    }
}

/** Igual que requireAuth pero no falla si no hay token (rutas mixtas). */
export async function optionalAuth(req: Request, _res: Response, next: NextFunction) {
    try {
        const token = extractBearer(req.headers.authorization);
        if (!token) return next();
        const { data: { user } } = await supabaseAdmin.auth.getUser(token);
        if (user) req.user = user;
        next();
    } catch {
        next();
    }
}