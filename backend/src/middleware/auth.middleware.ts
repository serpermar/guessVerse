import type { NextFunction, Request, Response } from 'express';
import type { User } from '@supabase/supabase-js';
import { supabaseAdmin } from '../db/supabase.js';
import { HttpError } from '../utils/http-error.js';

function extractBearer(header: string | undefined): string | null {
    if (!header?.startsWith('Bearer ')) return null;
    return header.slice(7).trim() || null;
}

/**
 * Verifica un access token de Supabase y devuelve el usuario.
 * Reutilizable por HTTP y por Socket.IO.
 */
export async function verifyAccessToken(token: string): Promise<User | null> {
    if (!token.trim()) return null;
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) return null;
    return user;
}

/** Verifica el JWT y adjunta req.user. 401 si falta o es inválido. */
export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
    try {
        const token = extractBearer(req.headers.authorization);
        if (!token) throw new HttpError(401, 'Token de autenticación requerido');

        const user = await verifyAccessToken(token);
        if (!user) throw new HttpError(401, 'Token inválido o expirado');

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
        const user = await verifyAccessToken(token);
        if (user) req.user = user;
        next();
    } catch {
        next();
    }
}
