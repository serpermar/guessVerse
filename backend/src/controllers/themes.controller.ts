import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/async-handler.js';
import { listThemes } from '../services/themes.service.js';

export const getThemes = asyncHandler(async (_req: Request, res: Response) => {
    const themes = await listThemes();
    res.json({ data: themes });
});
