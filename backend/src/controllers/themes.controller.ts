import type { Request, Response, NextFunction } from 'express';
import { listThemes } from '../services/themes.service.js';

export async function getThemes(
    _req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const themes = await listThemes();
        res.json({ data: themes });
    } catch (err) {
        next(err);
    }
}