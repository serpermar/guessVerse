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
    type Answer,
} from './game.rules.js';

export {
    evaluate,
    clampBoardSize,
    BOARD_SIZE_MIN,
    BOARD_SIZE_MAX,
    BOARD_SIZE_DEFAULT,
};

interface CharacterCard {
    id: string;
    name: string;
    image_url: string | null;
}

export type { Answer };

// ---------- Helpers ----------
async function countQuestions(gameId: string): Promise<number> {
    const { count } = await supabaseAdmin
        .from('game_questions')
        .select('*', { count: 'exact', head: true })
        .eq('game_id', gameId);
    return count ?? 0;
}

function secondsSince(iso: string | null): number {
    if (!iso) return 0;
    return Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
}

// ---------- createGame ----------
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

    const { data: game, error: gameErr } = await supabaseAdmin
        .from('games')
        .insert({
            theme_id: theme.id,
            created_by: userId,
            mode: 'classic',
            status: 'playing',
            secret_character_id: secret.id,
            started_at: new Date().toISOString(),
        })
        .select('id')
        .single();
    if (gameErr || !game) throw new Error(`Error creando partida: ${gameErr?.message}`);

    // Registrar al usuario como host en la partida.
    const { error: playerErr } = await supabaseAdmin.from('game_players').insert({
        game_id: game.id,
        user_id: userId,
        role: 'host',
    });
    if (playerErr) {
        await supabaseAdmin.from('games').delete().eq('id', game.id);
        throw new Error(`Error registrando jugador: ${playerErr.message}`);
    }

    const { error: boardErr } = await supabaseAdmin.from('game_characters').insert(
        board.map((c) => ({ game_id: game.id, character_id: c.id }))
    );
    if (boardErr) {
        await supabaseAdmin.from('games').delete().eq('id', game.id);
        throw new Error(`Error creando el tablero: ${boardErr.message}`);
    }

    return {
        gameId: game.id,
        theme,
        board: board as CharacterCard[],
        status: 'playing' as const,
    };
}

// ---------- askQuestion ----------
export async function askQuestion(gameId: string, questionCode: string, userId: string) {
    const { data: game, error: gameErr } = await supabaseAdmin
        .from('games')
        .select('id, status, secret_character_id, theme_id, created_by, themes(question_categories)')
        .eq('id', gameId)
        .single();
    if (gameErr || !game) throw HttpError.notFound('Partida no encontrada');
    if (game.created_by !== userId) throw HttpError.forbidden('No eres el dueño de esta partida');
    if (game.status !== 'playing') throw HttpError.conflict(`La partida ya terminó (${game.status})`);

    const themeRaw = game.themes as unknown;
    const theme = (Array.isArray(themeRaw) ? themeRaw[0] : themeRaw) as
        | { question_categories: string[] | null }
        | null;
    const allowedCategories = theme?.question_categories ?? [];

    const { data: question, error: qErr } = await supabaseAdmin
        .from('questions')
        .select('*')
        .eq('code', questionCode)
        .eq('is_active', true)
        .single();
    if (qErr || !question) throw HttpError.notFound(`Pregunta "${questionCode}" no existe`);

    if (!question.category || !allowedCategories.includes(question.category)) {
        throw HttpError.badRequest(`La pregunta "${questionCode}" no aplica a esta temática`);
    }

    const { data: secretChar } = await supabaseAdmin
        .from('characters')
        .select('*')
        .eq('id', game.secret_character_id)
        .single();
    if (!secretChar) throw new Error('Personaje secreto no encontrado');

    const expected = (question.value as { v: unknown } | null)?.v;
    const secretValue = (secretChar as Record<string, unknown>)[question.attribute];
    const answer = evaluate(secretValue, question.operator, expected);

    const { data: boardRows } = await supabaseAdmin
        .from('game_characters')
        .select(
            'character_id, characters(id, name, image_url, gender, is_human, is_hero, is_villain, is_protagonist, has_powers, uses_weapon, species)'
        )
        .eq('game_id', gameId);

    const yes: string[] = [];
    const no: string[] = [];
    const unknown: string[] = [];

    for (const row of boardRows ?? []) {
        const raw = row.characters as unknown;
        const ch: Record<string, unknown> | null = Array.isArray(raw)
            ? ((raw[0] as Record<string, unknown> | undefined) ?? null)
            : ((raw as Record<string, unknown> | null) ?? null);

        if (!ch) continue;
        const v = evaluate(ch[question.attribute], question.operator, expected);
        if (v === 'yes') yes.push(row.character_id);
        else if (v === 'no') no.push(row.character_id);
        else unknown.push(row.character_id);
    }

    const { error: logErr } = await supabaseAdmin.from('game_questions').insert({
        game_id: gameId,
        question_id: question.id,
        answer,
    });
    if (logErr) throw new Error(`Error registrando pregunta: ${logErr.message}`);

    return {
        question: { code: question.code, text: question.text_es },
        answer,
        matches: { yes, no, unknown },
    };
}

// ---------- guessCharacter ----------
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

    const { error: guessErr } = await supabaseAdmin.from('guesses').insert({
        game_id: gameId,
        user_id: userId,
        character_id: characterId,
        is_correct: isCorrect,
    });
    if (guessErr) throw new Error(`Error registrando intento: ${guessErr.message}`);

    if (isCorrect) {
        const { error: updErr } = await supabaseAdmin
            .from('games')
            .update({ status: 'won', winner_user_id: userId, finished_at: new Date().toISOString() })
            .eq('id', gameId);
        if (updErr) throw new Error(`Error finalizando partida: ${updErr.message}`);

        const questions = await countQuestions(gameId);
        const duration = secondsSince(game.started_at);
        await recordGameResult(userId, 'won', questions, duration);

        const { data: secret } = await supabaseAdmin
            .from('characters')
            .select('id, name, image_url')
            .eq('id', game.secret_character_id)
            .single();
        return { correct: true, status: 'won' as const, secret };
    }

    return { correct: false, status: 'playing' as const };
}

// ---------- abandonGame ----------
export async function abandonGame(gameId: string, userId: string) {
    const { data: game, error: gameErr } = await supabaseAdmin
        .from('games')
        .select('id, status, created_by, started_at')
        .eq('id', gameId)
        .single();
    if (gameErr || !game) throw HttpError.notFound('Partida no encontrada');
    if (game.created_by !== userId) throw HttpError.forbidden('No eres el dueño de esta partida');

    if (game.status === 'playing') {
        const { error } = await supabaseAdmin
            .from('games')
            .update({ status: 'lost', finished_at: new Date().toISOString() })
            .eq('id', gameId);
        if (error) throw new Error(`Error abandonando partida: ${error.message}`);

        const questions = await countQuestions(gameId);
        const duration = secondsSince(game.started_at);
        await recordGameResult(userId, 'abandoned', questions, duration);
    }
    return { status: 'lost' as const };
}

// ---------- getGame ----------
export async function getGame(gameId: string, userId: string) {
    const { data: game, error: gameErr } = await supabaseAdmin
        .from('games')
        .select(
            'id, status, theme_id, created_by, started_at, finished_at, secret_character_id, themes(id, name, slug, image_url)'
        )
        .eq('id', gameId)
        .single();
    if (gameErr || !game) throw HttpError.notFound('Partida no encontrada');
    if (game.created_by !== userId) throw HttpError.forbidden('No eres el dueño de esta partida');

    const { data: board } = await supabaseAdmin
        .from('game_characters')
        .select('character_id, is_eliminated, characters(id, name, image_url)')
        .eq('game_id', gameId);

    return { game, board: board ?? [] };
}