import { randomInt } from 'node:crypto';
import { Server, Socket } from 'socket.io';
import { z } from 'zod';
import { supabaseAdmin } from '../db/supabase.js';
import { env } from '../config/env.js';
import { verifyAccessToken } from '../middleware/auth.middleware.js';
import { evaluate, shuffle, hintsRemaining, MAX_HINTS_PER_GAME } from '../services/game.rules.js';
import { askAiFree } from '../services/ai.service.js';
import { getHint } from '../services/game.service.js';
import { recordGameResult } from '../services/stats.service.js';

// ---------------------------------------------------------------------------
// Tipos y utilidades
// ---------------------------------------------------------------------------

interface CharacterCard {
    id: string;
    name: string;
    image_url: string | null;
}

interface GameRow {
    id: string;
    theme_id: string;
    status: string;
    room_code: string | null;
    current_turn_user_id: string | null;
    created_by: string | null;
    started_at: string | null;
    hints_used: number | null;
    hints_history: string[] | null;
}

interface PlayerRow {
    id: string;
    game_id: string;
    user_id: string;
    role: string;
    secret_character_id: string | null;
    is_connected: boolean | null;
}

type Ack = ((res: { success: boolean; error?: string;[key: string]: unknown }) => void) | undefined;

const disconnectTimers = new Map<string, NodeJS.Timeout>();
const rateBuckets = new Map<string, number[]>();

function fail(callback: Ack, err: unknown) {
    let message = err instanceof Error ? err.message : 'Error inesperado';
    if (err instanceof z.ZodError) message = err.issues[0]?.message ?? 'Datos inválidos';
    callback?.({ success: false, error: message });
}

function generateRoomCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 5; i++) code += chars[randomInt(chars.length)];
    return code;
}

function randomItem<T>(items: T[]): T {
    return items[randomInt(items.length)];
}

function singleCharacter(raw: unknown): CharacterCard | null {
    if (Array.isArray(raw)) return (raw[0] as CharacterCard | undefined) ?? null;
    return (raw as CharacterCard | null) ?? null;
}

function readAttribute(character: Record<string, unknown>, key: string): unknown {
    const attributes = character.attributes;
    if (attributes && typeof attributes === 'object' && !Array.isArray(attributes)) {
        const value = (attributes as Record<string, unknown>)[key];
        if (value !== undefined) return value;
    }
    return character[key];
}

function secondsSince(iso: string | null): number {
    if (!iso) return 0;
    return Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
}

/** Límite en memoria por usuario (suficiente para una instancia del backend). */
function enforceRateLimit(key: string, limit: number, windowMs: number) {
    const now = Date.now();
    const recent = (rateBuckets.get(key) ?? []).filter((t) => now - t < windowMs);
    if (recent.length >= limit) throw new Error('Demasiadas acciones seguidas. Espera un momento.');
    recent.push(now);
    rateBuckets.set(key, recent);
}

async function loadGame(gameId: string): Promise<GameRow> {
    const { data, error } = await supabaseAdmin
        .from('games')
        .select('id, theme_id, status, room_code, current_turn_user_id, created_by, started_at, hints_used, hints_history')
        .eq('id', gameId)
        .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error('Partida no encontrada');
    return data as GameRow;
}

async function loadPlayer(gameId: string, userId: string): Promise<PlayerRow | null> {
    const { data } = await supabaseAdmin
        .from('game_players')
        .select('id, game_id, user_id, role, secret_character_id, is_connected')
        .eq('game_id', gameId)
        .eq('user_id', userId)
        .maybeSingle();
    return (data as PlayerRow | null) ?? null;
}

async function requirePlayer(gameId: string, userId: string): Promise<PlayerRow> {
    const player = await loadPlayer(gameId, userId);
    if (!player) throw new Error('No eres jugador de esta partida');
    return player;
}

async function loadOpponent(gameId: string, userId: string): Promise<PlayerRow> {
    const { data } = await supabaseAdmin
        .from('game_players')
        .select('id, game_id, user_id, role, secret_character_id, is_connected')
        .eq('game_id', gameId);
    const opponent = (data ?? []).find((p) => p.user_id !== userId) as PlayerRow | undefined;
    if (!opponent) throw new Error('El rival no está en la partida');
    return opponent;
}

function eliminationColumn(player: PlayerRow): 'eliminated_by_host' | 'eliminated_by_guest' {
    return player.role === 'host' ? 'eliminated_by_host' : 'eliminated_by_guest';
}

async function countQuestionsFor(gameId: string, userId: string): Promise<number> {
    const { count } = await supabaseAdmin
        .from('game_questions')
        .select('*', { count: 'exact', head: true })
        .eq('game_id', gameId)
        .eq('user_id', userId);
    return count ?? 0;
}

/**
 * Cierra una partida de forma atómica (solo si seguía `playing`) y registra
 * estadísticas para ganador y perdedor.
 */
async function closeGame(params: {
    gameId: string;
    gameStatus: 'won' | 'abandoned';
    winnerId: string | null;
    loserId: string;
    loserStatus: 'lost' | 'abandoned';
    startedAt: string | null;
}): Promise<boolean> {
    const { data: finished } = await supabaseAdmin
        .from('games')
        .update({
            status: params.gameStatus,
            winner_user_id: params.winnerId,
            finished_at: new Date().toISOString(),
        })
        .eq('id', params.gameId)
        .eq('status', 'playing')
        .select('id')
        .maybeSingle();

    if (!finished) return false;

    const duration = secondsSince(params.startedAt);
    const [winnerQuestions, loserQuestions] = await Promise.all([
        params.winnerId ? countQuestionsFor(params.gameId, params.winnerId) : Promise.resolve(0),
        countQuestionsFor(params.gameId, params.loserId),
    ]);

    await Promise.allSettled([
        params.winnerId
            ? recordGameResult(params.winnerId, 'won', winnerQuestions, duration)
            : Promise.resolve(),
        recordGameResult(params.loserId, params.loserStatus, loserQuestions, duration),
    ]);

    return true;
}

async function resolveQuestion(questionCode: string) {
    if (questionCode.startsWith('dyn_species_')) {
        const species = questionCode.replace('dyn_species_', '').replace(/_/g, ' ');
        return {
            id: null,
            code: questionCode,
            text_es: `¿Es un/a ${species}?`,
            attribute: 'species',
            operator: 'eq',
            value: { v: species },
        };
    }

    const { data } = await supabaseAdmin
        .from('questions')
        .select('id, code, text_es, attribute, operator, value')
        .eq('code', questionCode)
        .eq('is_active', true)
        .maybeSingle();
    if (!data) throw new Error(`Pregunta "${questionCode}" no existe`);
    return data;
}

// ---------------------------------------------------------------------------
// Esquemas de eventos
// ---------------------------------------------------------------------------

const roomCodeSchema = z.string().trim().toUpperCase().regex(/^[A-Z0-9]{5}$/, 'Código de sala inválido');
const gameIdSchema = z.string().uuid('Partida inválida');

const createRoomSchema = z.object({ themeSlug: z.string().trim().min(1).max(64) });
const joinRoomSchema = z.object({ roomCode: roomCodeSchema });
const stateSchema = z.object({ gameId: gameIdSchema });
const askQuestionSchema = z.object({
    gameId: gameIdSchema,
    questionCode: z.string().trim().min(1).max(128),
    questionText: z.string().trim().min(1).max(200),
});
const askAiSchema = z.object({
    gameId: gameIdSchema,
    freeText: z.string().trim().min(3).max(200),
});
const hintSchema = z.object({ gameId: gameIdSchema });
const guessSchema = z.object({ gameId: gameIdSchema, characterId: z.string().uuid() });
const abandonSchema = z.object({ gameId: gameIdSchema });
const chatSchema = z.object({
    gameId: gameIdSchema,
    message: z.string().trim().min(1).max(200),
});
const eliminateSchema = z.object({
    gameId: gameIdSchema,
    characterId: z.string().uuid(),
    eliminated: z.boolean(),
});

// ---------------------------------------------------------------------------
// Sockets
// ---------------------------------------------------------------------------

export function setupMultiplayerSockets(io: Server) {
    // Autenticación: el cliente envía el access token de Supabase en handshake.auth.
    io.use(async (socket, next) => {
        try {
            const token = socket.handshake.auth?.token;
            if (typeof token !== 'string' || !token) {
                return next(new Error('Autenticación requerida'));
            }
            const user = await verifyAccessToken(token);
            if (!user) return next(new Error('Token inválido o expirado'));
            socket.data.userId = user.id;
            next();
        } catch {
            next(new Error('No se pudo autenticar la conexión'));
        }
    });

    io.on('connection', (socket: Socket) => {
        const userId = (): string => socket.data.userId as string;

        const clearDisconnectTimer = (gameId: string) => {
            const key = `${gameId}:${userId()}`;
            const timer = disconnectTimers.get(key);
            if (timer) clearTimeout(timer);
            disconnectTimers.delete(key);
        };

        const joinRoomSession = (game: GameRow) => {
            if (!game.room_code) throw new Error('La sala no tiene código');
            socket.join(game.room_code);
            socket.data.gameId = game.id;
            socket.data.roomCode = game.room_code;
        };

        socket.on('create_room', async (raw: unknown, callback?: Ack) => {
            try {
                const { themeSlug } = createRoomSchema.parse(raw);
                const hostId = userId();

                const { data: theme } = await supabaseAdmin
                    .from('themes')
                    .select('id')
                    .eq('slug', themeSlug)
                    .eq('is_active', true)
                    .maybeSingle();
                if (!theme) throw new Error('Temática no encontrada');

                let roomCode = generateRoomCode();
                for (let attempt = 0; attempt < 10; attempt++) {
                    const { data: existing } = await supabaseAdmin
                        .from('games')
                        .select('id')
                        .eq('room_code', roomCode)
                        .maybeSingle();
                    if (!existing) break;
                    roomCode = generateRoomCode();
                }

                const { data: game, error } = await supabaseAdmin
                    .from('games')
                    .insert({
                        theme_id: theme.id,
                        mode: 'multiplayer',
                        status: 'waiting',
                        room_code: roomCode,
                        created_by: hostId,
                        current_turn_user_id: hostId,
                        started_at: new Date().toISOString(),
                    })
                    .select('id, theme_id, status, room_code, current_turn_user_id, created_by, started_at, hints_used, hints_history')
                    .single();
                if (error || !game) throw new Error(error?.message ?? 'No se pudo crear la sala');

                const { error: playerError } = await supabaseAdmin
                    .from('game_players')
                    .insert({
                        game_id: game.id,
                        user_id: hostId,
                        role: 'host',
                        is_connected: true,
                    });
                if (playerError) {
                    await supabaseAdmin.from('games').delete().eq('id', game.id);
                    throw new Error(playerError.message);
                }

                joinRoomSession(game as GameRow);
                callback?.({ success: true, roomCode: game.room_code, gameId: game.id });
            } catch (err) {
                fail(callback, err);
            }
        });

        socket.on('join_room', async (raw: unknown, callback?: Ack) => {
            try {
                const { roomCode } = joinRoomSchema.parse(raw);
                const guestId = userId();

                const { data: gameRow } = await supabaseAdmin
                    .from('games')
                    .select('id, theme_id, status, room_code, current_turn_user_id, created_by, started_at, hints_used, hints_history')
                    .eq('room_code', roomCode)
                    .maybeSingle();
                if (!gameRow) throw new Error('Sala no encontrada');
                const game = gameRow as GameRow;

                const { data: players } = await supabaseAdmin
                    .from('game_players')
                    .select('id, game_id, user_id, role, secret_character_id, is_connected')
                    .eq('game_id', game.id);
                const existing = (players ?? []) as PlayerRow[];
                const me = existing.find((p) => p.user_id === guestId);
                const otherGuest = existing.find((p) => p.role === 'guest' && p.user_id !== guestId);

                if (me && me.role === 'host') throw new Error('Ya eres el anfitrión de esta sala');
                if (!me && otherGuest) throw new Error('La sala ya está llena');
                if (game.status !== 'waiting' && !me) throw new Error('La partida ya ha empezado');

                if (!me) {
                    const { error: joinError } = await supabaseAdmin
                        .from('game_players')
                        .insert({
                            game_id: game.id,
                            user_id: guestId,
                            role: 'guest',
                            is_connected: true,
                        });
                    if (joinError) throw new Error(joinError.message);
                } else {
                    await supabaseAdmin
                        .from('game_players')
                        .update({ is_connected: true })
                        .eq('id', me.id);
                }

                const host = existing.find((p) => p.role === 'host');
                if (!host) throw new Error('La sala no tiene anfitrión');

                if (game.status === 'waiting') {
                    const { data: franchises } = await supabaseAdmin
                        .from('franchises')
                        .select('id')
                        .eq('theme_id', game.theme_id);
                    const franchiseIds = (franchises ?? []).map((f) => f.id);
                    if (franchiseIds.length === 0) throw new Error('La temática no tiene personajes');

                    const { data: characters } = await supabaseAdmin
                        .from('characters')
                        .select('id, name, image_url')
                        .in('franchise_id', franchiseIds);
                    const allChars = (characters ?? []) as CharacterCard[];
                    if (allChars.length < 4) throw new Error('La temática necesita al menos 4 personajes');

                    const board = shuffle(allChars).slice(0, Math.min(16, allChars.length));
                    const midpoint = Math.max(1, Math.floor(board.length / 2));
                    const hostSecret = randomItem(board.slice(0, midpoint));
                    let guestSecret = randomItem(board.slice(midpoint));
                    if (guestSecret.id === hostSecret.id) {
                        guestSecret = board.find((c) => c.id !== hostSecret.id) ?? guestSecret;
                    }

                    await Promise.all([
                        supabaseAdmin
                            .from('game_players')
                            .update({ secret_character_id: hostSecret.id, is_connected: true })
                            .eq('id', host.id),
                        supabaseAdmin
                            .from('game_players')
                            .update({ secret_character_id: guestSecret.id, is_connected: true })
                            .eq('game_id', game.id)
                            .eq('user_id', guestId),
                    ]);

                    await supabaseAdmin
                        .from('game_characters')
                        .upsert(
                            board.map((c) => ({ game_id: game.id, character_id: c.id })),
                            { onConflict: 'game_id,character_id', ignoreDuplicates: true }
                        );

                    await supabaseAdmin
                        .from('games')
                        .update({
                            status: 'playing',
                            current_turn_user_id: host.user_id,
                            started_at: new Date().toISOString(),
                        })
                        .eq('id', game.id)
                        .eq('status', 'waiting');

                    game.status = 'playing';
                    game.current_turn_user_id = host.user_id;
                    game.started_at = new Date().toISOString();
                }

                joinRoomSession(game);
                io.to(game.room_code!).emit('player_joined', { gameId: game.id });
                callback?.({ success: true, gameId: game.id });
            } catch (err) {
                fail(callback, err);
            }
        });

        socket.on('request_game_state', async (raw: unknown, callback?: Ack) => {
            try {
                const { gameId } = stateSchema.parse(raw);
                const me = await requirePlayer(gameId, userId());
                const game = await loadGame(gameId);

                if (game.status !== 'playing' && game.status !== 'waiting') {
                    throw new Error('La partida ha terminado');
                }

                joinRoomSession(game);
                clearDisconnectTimer(gameId);
                await supabaseAdmin
                    .from('game_players')
                    .update({ is_connected: true })
                    .eq('id', me.id);
                socket.to(game.room_code!).emit('opponent_reconnected');

                const [{ data: theme }, { data: secret }, { data: boardRows }, { data: chatHistory }, { data: askedRows }] = await Promise.all([
                    supabaseAdmin.from('themes').select('slug').eq('id', game.theme_id).maybeSingle(),
                    me.secret_character_id
                        ? supabaseAdmin.from('characters').select('id, name, image_url').eq('id', me.secret_character_id).maybeSingle()
                        : Promise.resolve({ data: null }),
                    supabaseAdmin
                        .from('game_characters')
                        .select('character_id, eliminated_by_host, eliminated_by_guest, characters(id, name, image_url)')
                        .eq('game_id', gameId),
                    supabaseAdmin
                        .from('game_chat')
                        .select('user_id, user_name, message, created_at')
                        .eq('game_id', gameId)
                        .order('created_at', { ascending: true })
                        .limit(100),
                    supabaseAdmin
                        .from('game_questions')
                        .select('question_id, questions(code)')
                        .eq('game_id', gameId)
                        .eq('user_id', userId())
                        .not('question_id', 'is', null),
                ]);

                const rows = boardRows ?? [];
                const board = rows
                    .map((row) => singleCharacter(row.characters))
                    .filter((c): c is CharacterCard => Boolean(c));
                const eliminatedIds = rows
                    .filter((row) => (me.role === 'host' ? row.eliminated_by_host : row.eliminated_by_guest))
                    .map((row) => row.character_id);

                const askedQuestionCodes = (askedRows ?? [])
                    .map((row) => {
                        const rel = row.questions as { code?: string } | { code?: string }[] | null;
                        const q = Array.isArray(rel) ? rel[0] : rel;
                        return q?.code;
                    })
                    .filter((code): code is string => Boolean(code));

                const hintsUsed = game.hints_used ?? 0;
                const hintsHistory = Array.isArray(game.hints_history) ? game.hints_history : [];

                callback?.({
                    success: true,
                    status: game.status,
                    board,
                    secret: secret ?? null,
                    themeSlug: theme?.slug ?? null,
                    isMyTurn: game.current_turn_user_id === userId(),
                    eliminatedIds,
                    chatHistory: chatHistory ?? [],
                    askedQuestionCodes,
                    hints: {
                        used: hintsUsed,
                        left: hintsRemaining({ hints_used: hintsUsed }),
                        history: hintsHistory,
                        current: hintsHistory[hintsHistory.length - 1] ?? null,
                        max: MAX_HINTS_PER_GAME,
                    },
                });
            } catch (err) {
                fail(callback, err);
            }
        });

        socket.on('ask_question', async (raw: unknown, callback?: Ack) => {
            try {
                const { gameId, questionCode, questionText } = askQuestionSchema.parse(raw);
                const me = await requirePlayer(gameId, userId());
                const game = await loadGame(gameId);

                if (game.status !== 'playing') throw new Error('La partida no está activa');
                if (game.current_turn_user_id !== userId()) throw new Error('No es tu turno');

                const opponent = await loadOpponent(gameId, userId());
                if (!opponent.secret_character_id) throw new Error('El rival aún no tiene personaje secreto');

                const question = await resolveQuestion(questionCode);

                if (question.id) {
                    const { data: repeated } = await supabaseAdmin
                        .from('game_questions')
                        .select('id')
                        .eq('game_id', gameId)
                        .eq('user_id', userId())
                        .eq('question_id', question.id)
                        .maybeSingle();
                    if (repeated) throw new Error('Ya has hecho esa pregunta en esta partida');
                }

                const { data: secretChar } = await supabaseAdmin
                    .from('characters')
                    .select('*')
                    .eq('id', opponent.secret_character_id)
                    .maybeSingle();
                if (!secretChar) throw new Error('Personaje secreto no encontrado');

                const expected = (question.value as { v?: unknown } | null)?.v;
                const secretValue = readAttribute(secretChar as Record<string, unknown>, question.attribute);
                const answer = evaluate(secretValue, question.operator, expected);
                if (answer === 'unknown') throw new Error('Esa pregunta no aplica a esta temática.');

                const { data: boardRows } = await supabaseAdmin
                    .from('game_characters')
                    .select('character_id, characters(*)')
                    .eq('game_id', gameId);

                const matchedIds: string[] = [];
                for (const row of boardRows ?? []) {
                    const ch = singleCharacter(row.characters) as (CharacterCard & Record<string, unknown>) | null;
                    if (!ch) continue;
                    const value = readAttribute(ch, question.attribute);
                    const result = evaluate(value, question.operator, expected);
                    if (answer === 'yes' && result === 'no') matchedIds.push(row.character_id);
                    if (answer === 'no' && result === 'yes') matchedIds.push(row.character_id);
                }

                if (matchedIds.length > 0) {
                    await supabaseAdmin
                        .from('game_characters')
                        .update({ [eliminationColumn(me)]: true })
                        .eq('game_id', gameId)
                        .in('character_id', matchedIds);
                }

                await Promise.all([
                    supabaseAdmin.from('game_questions').insert({
                        game_id: gameId,
                        user_id: userId(),
                        question_id: question.id,
                        answer,
                    }),
                    supabaseAdmin
                        .from('games')
                        .update({ current_turn_user_id: opponent.user_id })
                        .eq('id', gameId),
                ]);

                socket.emit('question_result', {
                    questionText,
                    answer,
                    matchedIds,
                    nextTurnUserId: opponent.user_id,
                });
                socket.to(game.room_code!).emit('opponent_asked', {
                    askerId: userId(),
                    questionText,
                    answer,
                });

                callback?.({ success: true, answer, matchedIds });
            } catch (err) {
                fail(callback, err);
            }
        });

        socket.on('ask_ai_question', async (raw: unknown, callback?: Ack) => {
            try {
                const { gameId, freeText } = askAiSchema.parse(raw);
                enforceRateLimit(`ai:${userId()}`, 8, 60_000);

                const me = await requirePlayer(gameId, userId());
                const game = await loadGame(gameId);

                if (game.status !== 'playing') throw new Error('La partida no está activa');
                if (game.current_turn_user_id !== userId()) throw new Error('No es tu turno');

                const opponent = await loadOpponent(gameId, userId());
                if (!opponent.secret_character_id) throw new Error('El rival aún no tiene personaje secreto');

                const [{ data: secretChar }, { data: boardRows }] = await Promise.all([
                    supabaseAdmin.from('characters').select('*').eq('id', opponent.secret_character_id).maybeSingle(),
                    supabaseAdmin.from('game_characters').select('character_id, characters(*)').eq('game_id', gameId),
                ]);
                if (!secretChar) throw new Error('Personaje secreto no encontrado');

                const boardChars = (boardRows ?? [])
                    .map((row) => singleCharacter(row.characters))
                    .filter((c): c is CharacterCard => Boolean(c)) as Array<CharacterCard & Record<string, unknown>>;

                const result = await askAiFree(freeText, secretChar as Record<string, unknown>, boardChars);
                if (result.answer === 'unknown') {
                    throw new Error(result.message || 'La IA no entendió la pregunta');
                }

                if (result.matchedIds.length > 0) {
                    await supabaseAdmin
                        .from('game_characters')
                        .update({ [eliminationColumn(me)]: true })
                        .eq('game_id', gameId)
                        .in('character_id', result.matchedIds);
                }

                await Promise.all([
                    supabaseAdmin.from('game_questions').insert({
                        game_id: gameId,
                        user_id: userId(),
                        question_id: null,
                        free_text: freeText,
                        answer: result.answer,
                        raw_data: { filters: result.filters },
                    }),
                    supabaseAdmin
                        .from('games')
                        .update({ current_turn_user_id: opponent.user_id })
                        .eq('id', gameId),
                ]);

                socket.emit('ai_question_result', {
                    freeText,
                    answer: result.answer,
                    matchedIds: result.matchedIds,
                    filters: result.filters,
                    nextTurnUserId: opponent.user_id,
                });
                socket.to(game.room_code!).emit('opponent_asked_ai', {
                    askerId: userId(),
                    freeText,
                    answer: result.answer,
                });

                callback?.({ success: true, answer: result.answer, matchedIds: result.matchedIds });
            } catch (err) {
                fail(callback, err);
            }
        });

        socket.on('ask_hint', async (raw: unknown, callback?: Ack) => {
            try {
                const { gameId } = hintSchema.parse(raw);
                await requirePlayer(gameId, userId());
                const result = await getHint(gameId, userId());
                callback?.({
                    success: true,
                    hint: result.hint,
                    hintsUsed: result.hintsUsed,
                    hintsLeft: result.hintsLeft,
                    hintsHistory: result.hintsHistory,
                    maxHints: result.maxHints,
                });
            } catch (err) {
                fail(callback, err);
            }
        });

        socket.on('toggle_eliminate', async (raw: unknown, callback?: Ack) => {
            try {
                const { gameId, characterId, eliminated } = eliminateSchema.parse(raw);
                const me = await requirePlayer(gameId, userId());
                const game = await loadGame(gameId);
                if (game.status !== 'playing') throw new Error('La partida no está activa');

                const { data: onBoard } = await supabaseAdmin
                    .from('game_characters')
                    .select('character_id')
                    .eq('game_id', gameId)
                    .eq('character_id', characterId)
                    .maybeSingle();
                if (!onBoard) throw new Error('Ese personaje no está en el tablero');

                const { error } = await supabaseAdmin
                    .from('game_characters')
                    .update({ [eliminationColumn(me)]: eliminated })
                    .eq('game_id', gameId)
                    .eq('character_id', characterId);
                if (error) throw new Error(error.message);

                callback?.({ success: true, eliminated });
            } catch (err) {
                fail(callback, err);
            }
        });

        socket.on('make_guess', async (raw: unknown, callback?: Ack) => {
            try {
                const { gameId, characterId } = guessSchema.parse(raw);
                await requirePlayer(gameId, userId());
                const game = await loadGame(gameId);

                if (game.status !== 'playing') throw new Error('La partida no está activa');
                if (game.current_turn_user_id !== userId()) throw new Error('No es tu turno');

                const opponent = await loadOpponent(gameId, userId());

                const { data: onBoard } = await supabaseAdmin
                    .from('game_characters')
                    .select('character_id')
                    .eq('game_id', gameId)
                    .eq('character_id', characterId)
                    .maybeSingle();
                if (!onBoard) throw new Error('Ese personaje no está en el tablero');

                const isCorrect = opponent.secret_character_id === characterId;
                await supabaseAdmin.from('guesses').insert({
                    game_id: gameId,
                    user_id: userId(),
                    character_id: characterId,
                    is_correct: isCorrect,
                });

                if (isCorrect) {
                    await closeGame({
                        gameId,
                        gameStatus: 'won',
                        winnerId: userId(),
                        loserId: opponent.user_id,
                        loserStatus: 'lost',
                        startedAt: game.started_at,
                    });
                    io.to(game.room_code!).emit('game_over', {
                        winnerId: userId(),
                        loserId: opponent.user_id,
                        reason: 'guess',
                    });
                } else {
                    await supabaseAdmin
                        .from('games')
                        .update({ current_turn_user_id: opponent.user_id })
                        .eq('id', gameId);
                    socket.emit('wrong_guess', { characterId });
                }

                callback?.({ success: true, correct: isCorrect });
            } catch (err) {
                fail(callback, err);
            }
        });

        socket.on('abandon_game', async (raw: unknown, callback?: Ack) => {
            try {
                const { gameId } = abandonSchema.parse(raw);
                await requirePlayer(gameId, userId());
                const game = await loadGame(gameId);
                if (game.status !== 'playing') return callback?.({ success: true });

                const opponent = await loadOpponent(gameId, userId());
                const closed = await closeGame({
                    gameId,
                    gameStatus: 'abandoned',
                    winnerId: opponent.user_id,
                    loserId: userId(),
                    loserStatus: 'abandoned',
                    startedAt: game.started_at,
                });

                if (closed) {
                    io.to(game.room_code!).emit('game_over', {
                        winnerId: opponent.user_id,
                        loserId: userId(),
                        reason: 'abandon',
                    });
                }
                callback?.({ success: true });
            } catch (err) {
                fail(callback, err);
            }
        });

        socket.on('send_chat', async (raw: unknown, callback?: Ack) => {
            try {
                const { gameId, message } = chatSchema.parse(raw);
                enforceRateLimit(`chat:${userId()}`, 20, 10_000);

                await requirePlayer(gameId, userId());
                const game = await loadGame(gameId);

                const { data: profile } = await supabaseAdmin
                    .from('users')
                    .select('username, email')
                    .eq('id', userId())
                    .maybeSingle();
                const userName = profile?.username
                    || profile?.email?.split('@')[0]
                    || 'Jugador';

                const { error } = await supabaseAdmin.from('game_chat').insert({
                    game_id: gameId,
                    user_id: userId(),
                    user_name: userName,
                    message,
                });
                if (error) throw new Error(error.message);

                io.to(game.room_code!).emit('receive_chat', {
                    userId: userId(),
                    userName,
                    message,
                });
                callback?.({ success: true });
            } catch (err) {
                fail(callback, err);
            }
        });

        socket.on('disconnect', async () => {
            const gameId = socket.data.gameId as string | undefined;
            const roomCode = socket.data.roomCode as string | undefined;
            const currentUserId = socket.data.userId as string | undefined;
            if (!gameId || !currentUserId) return;

            clearDisconnectTimer(gameId);
            await supabaseAdmin
                .from('game_players')
                .update({ is_connected: false })
                .eq('game_id', gameId)
                .eq('user_id', currentUserId)
                .then(() => undefined);

            if (roomCode) socket.to(roomCode).emit('opponent_disconnected');

            const timerKey = `${gameId}:${currentUserId}`;
            const timeout = setTimeout(async () => {
                try {
                    const { data: player } = await supabaseAdmin
                        .from('game_players')
                        .select('is_connected')
                        .eq('game_id', gameId)
                        .eq('user_id', currentUserId)
                        .maybeSingle();

                    if (!player || player.is_connected) return;

                    const game = await loadGame(gameId);
                    if (game.status !== 'playing') return;

                    const opponent = await loadOpponent(gameId, currentUserId);
                    const closed = await closeGame({
                        gameId,
                        gameStatus: 'abandoned',
                        winnerId: opponent.user_id,
                        loserId: currentUserId,
                        loserStatus: 'abandoned',
                        startedAt: game.started_at,
                    });

                    if (closed && game.room_code) {
                        io.to(game.room_code).emit('game_over', {
                            winnerId: opponent.user_id,
                            loserId: currentUserId,
                            reason: 'disconnect',
                        });
                    }
                } catch (err) {
                    console.error('Error cerrando partida por desconexión:', err);
                } finally {
                    disconnectTimers.delete(timerKey);
                }
            }, env.disconnectGraceMs);

            disconnectTimers.set(timerKey, timeout);
        });
    });
}
