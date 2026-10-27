import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/async-handler.js';
import { listThemes, getThemeDetail } from '../services/themes.service.js';

export const getThemes = asyncHandler(async (_req: Request, res: Response) => {
    const themes = await listThemes();
    res.json({ data: themes });
});

export const getThemeBySlug = asyncHandler(async (req: Request<{ slug: string }>, res: Response) => {
    const detail = await getThemeDetail(req.params.slug);
    res.json(detail);
});