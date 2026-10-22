import { z } from 'zod';
import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/async-handler.js';
import { HttpError } from '../utils/http-error.js';
import {
    createGame,
    askQuestion,
    guessCharacter,
    abandonGame,
    getGame,
    clampBoardSize,
} from '../services/game.service.js';

const createGameSchema = z.object({
    themeSlug: z.string().min(1).max(64),
    boardSize: z.unknown().optional(),
});

const questionSchema = z.object({
    questionCode: z.string().min(1).max(64),
});

const guessSchema = z.object({
    characterId: z.string().uuid(),
});

const idParamSchema = z.object({
    id: z.string().uuid(),
});

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
    const result = schema.safeParse(value);
    if (!result.success) {
        const issue = result.error.issues[0];
        throw HttpError.badRequest(issue?.message ?? 'Datos inválidos');
    }
    return result.data;
}

export const postCreateGame = asyncHandler(async (req: Request, res: Response) => {
    const { themeSlug, boardSize } = parse(createGameSchema, req.body ?? {});
    const result = await createGame(themeSlug, clampBoardSize(boardSize));
    res.status(201).json(result);
});

export const postQuestion = asyncHandler(
    async (req: Request<{ id: string }>, res: Response) => {
        const { id } = parse(idParamSchema, req.params);
        const { questionCode } = parse(questionSchema, req.body ?? {});
        res.json(await askQuestion(id, questionCode));
    }
);

export const postGuess = asyncHandler(
    async (req: Request<{ id: string }>, res: Response) => {
        const { id } = parse(idParamSchema, req.params);
        const { characterId } = parse(guessSchema, req.body ?? {});
        res.json(await guessCharacter(id, characterId));
    }
);

export const postAbandon = asyncHandler(
    async (req: Request<{ id: string }>, res: Response) => {
        const { id } = parse(idParamSchema, req.params);
        res.json(await abandonGame(id));
    }
);

export const getGameById = asyncHandler(
    async (req: Request<{ id: string }>, res: Response) => {
        const { id } = parse(idParamSchema, req.params);
        res.json(await getGame(id));
    }
);
