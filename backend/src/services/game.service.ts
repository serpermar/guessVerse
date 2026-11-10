import { supabaseAdmin } from '../db/supabase.js';
import { HttpError } from '../utils/http-error.js';
import { recordGameResult } from './stats.service.js';
import {
    evaluate,
    clampBoardSize,
    shuffle,
    BOARD_SIZE_MIN,
    BOARD_SIZE_MAX,
    BOARD_SIZE_DEFAULT,
    MAX_HINTS_PER_GAME,
    hintsRemaining,
    type Answer,
} from './game.rules.js';
import { pickNextHint } from './hint.service.js';

export { evaluate, clampBoardSize, BOARD_SIZE_MIN, BOARD_SIZE_MAX, BOARD_SIZE_DEFAULT };
export type { Answer };

interface CharacterCard { id: string; name: string; image_url: string | null; }

async function countQuestions(gameId: string, userId?: string): Promise<number> {
    let query = supabaseAdmin
        .from('game_questions')
        .select('*', { count: 'exact', head: true })
        .eq('game_id', gameId);
    if (userId) query = query.eq('user_id', userId);
    const { count } = await query;
    return count ?? 0;
}

function secondsSince(iso: string | null): number {
    if (!iso) return 0;
    return Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
}

export async function createGame(themeSlug: string, boardSize: number, userId: string) {
    const { data: theme, error: themeErr } = await supabaseAdmin
        .from('themes')
        .select('id, name, slug, image_url')
        .eq('slug', themeSlug)
        .eq('is_active', true)
        .single();
    if (themeErr || !theme) throw HttpError.notFound(`Theme "${themeSlug}" no encontrado`);

    const { data: franchises } = await supabaseAdmin
        .from('franchises')
        .select('id')
        .eq('theme_id', theme.id);
    const franchiseIds = (franchises ?? []).map((f) => f.id);
    if (franchiseIds.length === 0) throw HttpError.badRequest('La temática no tiene personajes todavía');

    const { data: chars, error: charsErr } = await supabaseAdmin
        .from('characters')
        .select('id, name, image_url')
        .in('franchise_id', franchiseIds);
    if (charsErr) throw new Error(`Error leyendo personajes: ${charsErr.message}`);
    if (!chars || chars.length < BOARD_SIZE_MIN) {
        throw HttpError.badRequest(`La temática necesita al menos ${BOARD_SIZE_MIN} personajes`);
    }

    const size = clampBoardSize(boardSize);
    const board = shuffle(chars).slice(0, Math.min(size, chars.length));
    const secret = board[Math.floor(Math.random() * board.length)];

    // Creación transaccional: games + game_players + game_characters en una sola
    // operación. Si falla cualquier paso, Supabase revierte todo automáticamente.
    const { data: gameId, error: gameErr } = await supabaseAdmin.rpc('create_game_tx', {
        p_theme_id: theme.id,
        p_created_by: userId,
        p_secret_character_id: secret.id,
        p_character_ids: board.map((c) => c.id),
    });

    if (gameErr || !gameId) {
        throw new Error(`Error creando partida: ${gameErr?.message ?? 'desconocido'}`);
    }

    return {
        gameId: gameId as string,
        theme,
        board: board as CharacterCard[],
        status: 'playing' as const,
    };
}

export async function askQuestion(gameId: string, questionCode: string, userId: string) {
    const { data: game, error: gameErr } = await supabaseAdmin
        .from('games')
        .select('id, status, secret_character_id, theme_id, created_by, themes(question_categories)')
        .eq('id', gameId)
        .single();
    if (gameErr || !game) throw HttpError.notFound('Partida no encontrada');
    if (game.created_by !== userId) throw HttpError.forbidden('No eres el dueño de esta partida');
    if (game.status !== 'playing') throw HttpError.conflict(`La partida ya terminó (${game.status})`);

    let question: any = null;
    if (questionCode.startsWith('dyn_species_')) {
        const specie = questionCode.replace('dyn_species_', '').replace(/_/g, ' ');
        question = { code: questionCode, text_es: `¿Es un/a ${specie}?`, attribute: 'species', operator: 'eq', value: { v: specie } };
    } else {
        const { data: dbQuestion, error: qErr } = await supabaseAdmin
            .from('questions')
            .select('*')
            .eq('code', questionCode)
            .eq('is_active', true)
            .single();
        if (qErr || !dbQuestion) throw HttpError.notFound(`Pregunta "${questionCode}" no existe`);
        question = dbQuestion;
    }

    const { data: secretChar } = await supabaseAdmin
        .from('characters')
        .select('*')
        .eq('id', game.secret_character_id)
        .single();
    if (!secretChar) throw new Error('Personaje secreto no encontrado');

    const expected = (question.value as { v: unknown } | null)?.v;
    const secretValue = (secretChar.attributes as any)?.[question.attribute] ?? (secretChar as Record<string, unknown>)[question.attribute];
    const answer = evaluate(secretValue, question.operator, expected);

    if (answer === 'unknown') {
        return {
            question: { code: question.code, text: question.text_es },
            answer: 'unknown' as const,
            matches: { yes: [], no: [], unknown: [] },
            message: 'Esa pregunta no aplica a esta temática. Prueba con otra.',
        };
    }

    const { data: boardRows } = await supabaseAdmin
        .from('game_characters')
        .select('character_id, characters(id, name, image_url, gender, is_human, is_hero, is_villain, is_protagonist, has_powers, uses_weapon, species, attributes)')
        .eq('game_id', gameId);
    const yes: string[] = []; const no: string[] = []; const unknown: string[] = [];

    for (const row of boardRows ?? []) {
        const raw = row.characters as unknown;
        const ch: Record<string, any> | null = Array.isArray(raw)
            ? ((raw[0] as Record<string, any> | undefined) ?? null)
            : ((raw as Record<string, any> | null) ?? null);
        if (!ch) continue;
        const attrValue = ch.attributes?.[question.attribute] ?? ch[question.attribute];
        const v = evaluate(attrValue, question.operator, expected);
        if (v === 'yes') yes.push(row.character_id);
        else if (v === 'no') no.push(row.character_id);
        else unknown.push(row.character_id);
    }

    await supabaseAdmin.from('game_questions').insert({
        game_id: gameId,
        user_id: userId,
        question_id: question.id || null,
        answer,
    });
    return { question: { code: question.code, text: question.text_es }, answer, matches: { yes, no, unknown } };
}

export async function guessCharacter(gameId: string, characterId: string, userId: string) {
    const { data: game, error: gameErr } = await supabaseAdmin
        .from('games')
        .select('id, status, secret_character_id, created_by, started_at')
        .eq('id', gameId)
        .single();
    if (gameErr || !game) throw HttpError.notFound('Partida no encontrada');
    if (game.created_by !== userId) throw HttpError.forbidden('No eres el dueño de esta partida');
    if (game.status !== 'playing') throw HttpError.conflict(`La partida ya terminó (${game.status})`);

    const { data: onBoard } = await supabaseAdmin
        .from('game_characters')
        .select('character_id')
        .eq('game_id', gameId)
        .eq('character_id', characterId)
        .maybeSingle();
    if (!onBoard) throw HttpError.badRequest('Ese personaje no está en el tablero de esta partida');

    const isCorrect = game.secret_character_id === characterId;
    await supabaseAdmin.from('guesses').insert({ game_id: gameId, user_id: userId, character_id: characterId, is_correct: isCorrect });

    if (isCorrect) {
        const { data: finished } = await supabaseAdmin
            .from('games')
            .update({ status: 'won', winner_user_id: userId, finished_at: new Date().toISOString() })
            .eq('id', gameId)
            .eq('status', 'playing')
            .select('id')
            .maybeSingle();
        if (finished) {
            const questions = await countQuestions(gameId, userId);
            const duration = secondsSince(game.started_at);
            await recordGameResult(userId, 'won', questions, duration);
        }
        const { data: secret } = await supabaseAdmin
            .from('characters')
            .select('id, name, image_url')
            .eq('id', game.secret_character_id)
            .single();
        return { correct: true, status: 'won' as const, secret };
    }
    return { correct: false, status: 'playing' as const };
}

export async function abandonGame(gameId: string, userId: string) {
    const { data: game, error: gameErr } = await supabaseAdmin
        .from('games')
        .select('id, status, created_by, started_at')
        .eq('id', gameId)
        .single();
    if (gameErr || !game) throw HttpError.notFound('Partida no encontrada');
    if (game.created_by !== userId) throw HttpError.forbidden('No eres el dueño de esta partida');

    if (game.status === 'playing') {
        const { data: finished } = await supabaseAdmin
            .from('games')
            .update({ status: 'abandoned', finished_at: new Date().toISOString() })
            .eq('id', gameId)
            .eq('status', 'playing')
            .select('id')
            .maybeSingle();

        if (finished) {
            const questions = await countQuestions(gameId, userId);
            const duration = secondsSince(game.started_at);
            await recordGameResult(userId, 'abandoned', questions, duration);
        }
    }
    return { status: 'abandoned' as const };
}

export async function getGame(gameId: string, userId: string) {
    const { data: game, error: gameErr } = await supabaseAdmin
        .from('games')
        .select('id, status, theme_id, created_by, started_at, finished_at, secret_character_id, hints_used, hints_history, themes(id, name, slug, image_url)')
        .eq('id', gameId)
        .single();
    if (gameErr || !game) throw HttpError.notFound('Partida no encontrada');
    if (game.created_by !== userId) throw HttpError.forbidden('No eres el dueño de esta partida');

    const { data: board } = await supabaseAdmin
        .from('game_characters')
        .select('character_id, is_eliminated, characters(id, name, image_url)')
        .eq('game_id', gameId);

    const hintsHistory: string[] = Array.isArray(game.hints_history) ? game.hints_history : [];

    const { hints_used, hints_history: _raw, ...restGame } = game;
    return {
        game: restGame,
        board: board ?? [],
        hints: {
            used: hints_used ?? 0,
            left: hintsRemaining({ hints_used: hints_used ?? 0 }),
            history: hintsHistory,
            max: MAX_HINTS_PER_GAME,
            current: hintsHistory[hintsHistory.length - 1] ?? null,
        },
    };
}

export async function getHint(gameId: string, userId: string) {
    const { data: game } = await supabaseAdmin
        .from('games')
        .select('secret_character_id, created_by, mode, status, hints_used, hints_history')
        .eq('id', gameId)
        .single();

    if (!game) throw HttpError.notFound('Partida no encontrada');
    if (game.status !== 'playing') throw HttpError.conflict(`La partida ya terminó (${game.status})`);

    if (game.mode === 'classic' && game.created_by !== userId) {
        throw HttpError.forbidden('No eres el dueño de esta partida');
    }
    if (game.mode === 'multiplayer') {
        const { data: player } = await supabaseAdmin
            .from('game_players')
            .select('user_id')
            .eq('game_id', gameId)
            .eq('user_id', userId)
            .maybeSingle();
        if (!player) throw HttpError.forbidden('No eres jugador de esta partida');
    }

    const hintsUsed = game.hints_used ?? 0;
    if (hintsUsed >= MAX_HINTS_PER_GAME) {
        throw HttpError.conflict('No quedan pistas disponibles');
    }

    const { data: secret } = await supabaseAdmin
        .from('characters')
        .select('name, species, gender, is_hero, is_villain, attributes')
        .eq('id', game.secret_character_id)
        .single();
    if (!secret) throw new Error('Personaje secreto no encontrado');

    const history: string[] = Array.isArray(game.hints_history) ? game.hints_history : [];
    const hint = pickNextHint(secret, history);
    if (!hint) throw HttpError.conflict('Este personaje no tiene pistas disponibles');

    const newHintsUsed = hintsUsed + 1;
    const newHistory = [...history, hint];

    const { data: updated, error: updErr } = await supabaseAdmin
        .from('games')
        .update({ hints_used: newHintsUsed, hints_history: newHistory })
        .eq('id', gameId)
        .eq('hints_used', hintsUsed)
        .select('hints_used, hints_history')
        .maybeSingle();

    if (updErr) throw new Error(`Error guardando pista: ${updErr.message}`);
    if (!updated) {
        throw HttpError.conflict('Conflicto al actualizar pistas, inténtalo de nuevo');
    }

    return {
        hint,
        hintsUsed: updated.hints_used,
        hintsLeft: hintsRemaining({ hints_used: updated.hints_used }),
        hintsHistory: (updated.hints_history ?? []) as string[],
        maxHints: MAX_HINTS_PER_GAME,
    };
}