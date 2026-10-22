import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env.js';
import { HttpError } from '../utils/http-error.js';

/**
 * Protege /api/import con un token compartido cuando IMPORT_TOKEN está
 * definido. Sin la variable se mantiene el comportamiento de desarrollo.
 */
export function requireImportToken(req: Request, _res: Response, next: NextFunction): void {
    if (!env.importToken) return next();

    const header = req.headers['x-import-token'];
    const token = Array.isArray(header) ? header[0] : header;
    if (token !== env.importToken) {
        return next(new HttpError(401, 'Token de importación inválido'));
    }
    next();
}
