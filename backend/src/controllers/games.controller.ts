import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
    createGame,
    askQuestion,
    guessCharacter,
    abandonGame,
    loseGame,
    getGame,
} from '../services/game.service.js';
import { HttpError } from '../utils/http-error.js';

const createSchema = z.object({
    themeSlug: z.string().min(1).max(64),
    boardSize: z.number().int().min(4).max(32).optional(),
});

const questionSchema = z.object({ questionCode: z.string().min(1).max(64) });
const guessSchema = z.object({ characterId: z.string().uuid() });
const gameParamsSchema = z.object({ id: z.string().uuid() });

function parseGameId(req: Request): string {
    const parsed = gameParamsSchema.safeParse(req.params);
    if (!parsed.success) throw HttpError.badRequest('ID de partida inválido');
    return parsed.data.id;
}

export async function postCreateGame(req: Request, res: Response, next: NextFunction) {
    try {
        const { themeSlug, boardSize } = createSchema.parse(req.body);
        const result = await createGame(themeSlug, boardSize ?? 16, req.user!.id);
        res.status(201).json(result);
    } catch (err) { next(err); }
}

export async function getGameById(req: Request, res: Response, next: NextFunction) {
    try { res.json(await getGame(parseGameId(req), req.user!.id)); } catch (err) { next(err); }
}

export async function postQuestion(req: Request, res: Response, next: NextFunction) {
    try {
        const gameId = parseGameId(req);
        const { questionCode } = questionSchema.parse(req.body);
        res.json(await askQuestion(gameId, questionCode, req.user!.id));
    } catch (err) { next(err); }
}

export async function postGuess(req: Request, res: Response, next: NextFunction) {
    try {
        const gameId = parseGameId(req);
        const { characterId } = guessSchema.parse(req.body);
        res.json(await guessCharacter(gameId, characterId, req.user!.id));
    } catch (err) { next(err); }
}

export async function postLose(req: Request, res: Response, next: NextFunction) {
    try { res.json(await loseGame(parseGameId(req), req.user!.id)); } catch (err) { next(err); }
}

export async function postAbandon(req: Request, res: Response, next: NextFunction) {
    try { res.json(await abandonGame(parseGameId(req), req.user!.id)); } catch (err) { next(err); }
}
