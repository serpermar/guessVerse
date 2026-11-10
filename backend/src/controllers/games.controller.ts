// backend/src/controllers/games.controller.ts
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { createGame, askQuestion, guessCharacter, abandonGame, getGame } from '../services/game.service.js';
import { askAiFree } from '../services/ai.service.js';
import { supabaseAdmin } from '../db/supabase.js';
import { HttpError } from '../utils/http-error.js';
import { getHint } from '../services/game.service.js';


const createSchema = z.object({
    themeSlug: z.string().min(1).max(64),
    boardSize: z.number().int().min(4).max(32).optional(),
});

const questionSchema = z.object({ questionCode: z.string().min(1).max(128) });
const guessSchema = z.object({ characterId: z.string().uuid() });
const askFreeSchema = z.object({ freeText: z.string().trim().min(3).max(200) });

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

// Pregunta libre a la IA (solo partida clásica del propio jugador)
export async function postAskFree(req: Request<{ id: string }>, res: Response, next: NextFunction) {
    try {
        const { freeText } = askFreeSchema.parse(req.body);

        // 1. Obtener partida y comprobar propiedad/estado
        const { data: game } = await supabaseAdmin
            .from('games')
            .select('secret_character_id, status, created_by, mode')
            .eq('id', req.params.id)
            .single();

        if (!game) throw new HttpError(404, 'Partida no encontrada');
        if (game.created_by !== req.user!.id) throw new HttpError(403, 'No eres el dueño de esta partida');
        if (game.mode !== 'classic') throw new HttpError(400, 'La IA solo está disponible en partidas clásicas');
        if (game.status !== 'playing') throw new HttpError(409, `La partida ya terminó (${game.status})`);

        const { data: secretChar } = await supabaseAdmin
            .from('characters')
            .select('*')
            .eq('id', game.secret_character_id)
            .single();
        if (!secretChar) throw new Error('Personaje secreto no encontrado');

        // 2. Obtener tablero
        const { data: boardRows } = await supabaseAdmin
            .from('game_characters')
            .select('character_id, characters(*)')
            .eq('game_id', req.params.id);

        const boardChars = (boardRows ?? [])
            .map((row) => {
                const raw = row.characters as unknown;
                return (Array.isArray(raw) ? raw[0] : raw) as (Record<string, unknown> & { id: string }) | null | undefined;
            })
            .filter((ch): ch is Record<string, unknown> & { id: string } => Boolean(ch));

        // 3. Llamar a la IA
        const result = await askAiFree(freeText, secretChar, boardChars);

        // 4. Registrar la pregunta en el historial
        await supabaseAdmin.from('game_questions').insert({
            game_id: req.params.id,
            user_id: req.user!.id,
            free_text: freeText,
            answer: result.answer,
            raw_data: { filters: result.filters }
        });

        res.json(result);
    } catch (err) { next(err); }
}

export async function postHint(req: Request<{ id: string }>, res: Response, next: NextFunction) {
    try {
        const result = await getHint(req.params.id, req.user!.id);
        res.json(result);
    } catch (err) {
        next(err);
    }
}