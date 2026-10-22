import type { NextFunction, Request, Response } from 'express';
import { HttpError } from '../utils/http-error.js';
import { env } from '../config/env.js';

/** 404 para rutas no registradas. */
export function notFoundHandler(req: Request, res: Response): void {
    res.status(404).json({ error: `Ruta no encontrada: ${req.method} ${req.path}` });
}

/**
 * Middleware centralizado de errores.
 * - HttpError → su status/mensaje.
 * - Error genérico → 500 sin filtrar detalles internos en producción.
 */
export function errorHandler(
    err: Error,
    _req: Request,
    res: Response,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _next: NextFunction
): void {
    if (err instanceof HttpError) {
        res.status(err.status).json({ error: err.message });
        return;
    }

    console.error('💥', err);

    const message = env.isProduction
        ? 'Error interno del servidor'
        : err.message;
    res.status(500).json({ error: message });
}
