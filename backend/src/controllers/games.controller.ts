import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {createGame, askQuestion, guessCharacter, abandonGame, getGame} from '../services/game.service.js';

const createSchema = z.object({
    themeSlug: z.string().min(1),
    boardSize: z.number().int().min(4).max(32).optional(),
});

const questionSchema = z.object({ questionCode: z.string().min(1) });
const guessSchema = z.object({ characterId: z.string().uuid() });

export async function postCreateGame(req: Request, res: Response, next: NextFunction) {
    try {
        const { themeSlug, boardSize } = createSchema.parse(req.body);
        const result = await createGame(themeSlug, boardSize ?? 16, req.user!.id);
        res.status(201).json(result);
    } catch (err) { next(err); }
}

export async function getGameById(req: Request<{ id: string }>, res: Response, next: NextFunction) {
    try { res.json(await getGame(req.params.id, req.user!.id)); } catch (err) { next(err); }
}

export async function postQuestion(req: Request<{ id: string }>, res: Response, next: NextFunction) {
    try {
        const { questionCode } = questionSchema.parse(req.body);
        res.json(await askQuestion(req.params.id, questionCode, req.user!.id));
    } catch (err) { next(err); }
}

export async function postGuess(req: Request<{ id: string }>, res: Response, next: NextFunction) {
    try {
        const { characterId } = guessSchema.parse(req.body);
        res.json(await guessCharacter(req.params.id, characterId, req.user!.id));
    } catch (err) { next(err); }
}

export async function postAbandon(req: Request<{ id: string }>, res: Response, next: NextFunction) {
    try { res.json(await abandonGame(req.params.id, req.user!.id)); } catch (err) { next(err); }
}