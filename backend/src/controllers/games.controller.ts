import type { Request, Response, NextFunction } from 'express';
import { createGame, askQuestion, guessCharacter, getGame } from '../services/game.service.js';

export async function postCreateGame(req: Request, res: Response, next: NextFunction) {
    try {
        const { themeSlug, boardSize } = req.body ?? {};
        if (typeof themeSlug !== 'string') {
            res.status(400).json({ error: 'themeSlug es obligatorio' });
            return;
        }
        const result = await createGame(themeSlug, Number(boardSize) || 16);
        res.status(201).json(result);
    } catch (err) { next(err); }
}

export async function postQuestion(
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction
) {
    try {
        const { questionCode } = req.body ?? {};
        if (typeof questionCode !== 'string') {
            res.status(400).json({ error: 'questionCode es obligatorio' });
            return;
        }
        const result = await askQuestion(req.params.id, questionCode);
        res.json(result);
    } catch (err) { next(err); }
}

export async function postGuess(
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction
) {
    try {
        const { characterId } = req.body ?? {};
        if (typeof characterId !== 'string') {
            res.status(400).json({ error: 'characterId es obligatorio' });
            return;
        }
        const result = await guessCharacter(req.params.id, characterId);
        res.json(result);
    } catch (err) { next(err); }
}

export async function getGameById(
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction
) {
    try {
        res.json(await getGame(req.params.id));
    } catch (err) { next(err); }
}