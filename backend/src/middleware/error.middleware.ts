import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { HttpError } from '../utils/http-error.js';
import { env } from '../config/env.js';

/** 404 para rutas no registradas. */
export function notFoundHandler(req: Request, res: Response): void {
    res.status(404).json({ error: `Ruta no encontrada: ${req.method} ${req.path}` });
}

/**
 * Middleware centralizado de errores.
 * - HttpError → su status/mensaje.
 * - ZodError → 400 con detalle de los campos inválidos.
 * - JSON mal formado / body demasiado grande → 400 / 413.
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

    if (err instanceof ZodError) {
        const details = err.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
        }));
        res.status(400).json({ error: 'Datos de entrada inválidos', details });
        return;
    }

    if (err instanceof SyntaxError && 'body' in err) {
        res.status(400).json({ error: 'JSON mal formado' });
        return;
    }

    if ((err as { type?: string }).type === 'entity.too.large') {
        res.status(413).json({ error: 'El cuerpo de la petición es demasiado grande' });
        return;
    }

    console.error('💥', err);

    const message = env.isProduction
        ? 'Error interno del servidor'
        : err.message;
    res.status(500).json({ error: message });
}
