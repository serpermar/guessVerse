import { Server, Socket } from 'socket.io';
import { supabaseAdmin } from '../db/supabase.js';
import { evaluate } from '../services/game.rules.js';

function generateRoomCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 5; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

export function setupMultiplayerSockets(io: Server) {
    io.on('connection', (socket: Socket) => {
        console.log(`🔌 Cliente conectado: ${socket.id}`);

        // 1. CREAR SALA
        socket.on('create_room', async (data, callback) => {
            try {
                const { themeSlug, userId } = data;
                if (!themeSlug || !userId) throw new Error('Faltan datos');

                let roomCode = generateRoomCode();
                let isUnique = false;
                while (!isUnique) {
                    const { data: existing } = await supabaseAdmin.from('games').select('id').eq('room_code', roomCode).maybeSingle();
                    if (!existing) isUnique = true;
                    else roomCode = generateRoomCode();
                }

                const { data: theme, error: themeErr } = await supabaseAdmin.from('themes').select('id').eq('slug', themeSlug).single();
                if (themeErr || !theme) throw new Error('Temática no encontrada');

                const { data: game, error: gameErr } = await supabaseAdmin
                    .from('games')
                    .insert({
                        theme_id: theme.id,
                        mode: 'multiplayer',
                        status: 'waiting',
                        room_code: roomCode,
                        created_by: userId,
                        current_turn_user_id: userId
                    })
                    .select('id, room_code').single();

                if (gameErr || !game) throw new Error(`Error BD: ${gameErr?.message}`);

                await supabaseAdmin.from('game_players').insert({ game_id: game.id, user_id: userId, role: 'host' });

                socket.join(game.room_code);
                socket.data.userId = userId;

                callback({ success: true, roomCode: game.room_code, gameId: game.id });
            } catch (err) {
                callback({ success: false, error: (err as Error).message });
            }
        });

        // 2. UNIRSE A SALA
        socket.on('join_room', async (data, callback) => {
            try {
                const { roomCode, userId } = data;
                if (!roomCode || !userId) throw new Error('Faltan datos');

                const { data: game, error } = await supabaseAdmin
                    .from('games')
                    .select('id, status, theme_id')
                    .eq('room_code', roomCode.toUpperCase())
                    .maybeSingle();

                if (error || !game) throw new Error('Sala no encontrada');
                if (game.status !== 'waiting') throw new Error('La partida ya ha comenzado');

                const { error: playerErr } = await supabaseAdmin.from('game_players').insert({
                    game_id: game.id, user_id: userId, role: 'guest'
                });
                if (playerErr) throw new Error(`Error BD: ${playerErr.message}`);

                // Repartir tablero y secretos
                const { data: franchises } = await supabaseAdmin.from('franchises').select('id').eq('theme_id', game.theme_id);
                if (!franchises || franchises.length === 0) throw new Error('La temática no tiene franquicias');

                const franchiseIds = franchises.map(f => f.id);
                const { data: allChars } = await supabaseAdmin.from('characters').select('id, name, image_url').in('franchise_id', franchiseIds);

                if (!allChars || allChars.length < 16) throw new Error('No hay suficientes personajes para jugar');

                const shuffled = [...allChars].sort(() => Math.random() - 0.5);
                const board = shuffled.slice(0, 16);
                const secretHost = board[Math.floor(Math.random() * 8)];
                let secretGuest = board[Math.floor(Math.random() * 8) + 8];
                if (secretHost.id === secretGuest.id) secretGuest = board[15];

                const { data: players } = await supabaseAdmin.from('game_players').select('id, role, user_id').eq('game_id', game.id);
                const hostPlayer = players?.find(p => p.role === 'host');
                const guestPlayer = players?.find(p => p.role === 'guest');

                if (hostPlayer) await supabaseAdmin.from('game_players').update({ secret_character_id: secretHost.id }).eq('id', hostPlayer.id);
                if (guestPlayer) await supabaseAdmin.from('game_players').update({ secret_character_id: secretGuest.id }).eq('id', guestPlayer.id);

                const boardInserts = board.map(c => ({ game_id: game.id, character_id: c.id }));
                await supabaseAdmin.from('game_characters').insert(boardInserts);

                await supabaseAdmin.from('games').update({ status: 'playing' }).eq('id', game.id);
                socket.join(roomCode.toUpperCase());
                socket.data.userId = userId;

                io.to(roomCode.toUpperCase()).emit('player_joined', { gameId: game.id });

                callback({ success: true, gameId: game.id });
            } catch (err) {
                console.error('❌ Error join_room:', (err as Error).message);
                callback({ success: false, error: (err as Error).message });
            }
        });

        // 3. PEDIR ESTADO
        socket.on('request_game_state', async (data, callback) => {
            try {
                const { gameId, userId } = data;

                const { data: game } = await supabaseAdmin
                    .from('games')
                    .select('current_turn_user_id, theme_id')
                    .eq('id', gameId)
                    .single();

                const { data: theme } = await supabaseAdmin.from('themes').select('slug').eq('id', game!.theme_id).single();

                const { data: player } = await supabaseAdmin
                    .from('game_players')
                    .select('role, secret_character_id, characters(id, name, image_url)')
                    .eq('game_id', gameId)
                    .eq('user_id', userId)
                    .single();

                const secret = player?.characters as any;

                const { data: boardRows } = await supabaseAdmin
                    .from('game_characters')
                    .select('character_id, eliminated_by_host, eliminated_by_guest, characters(id, name, image_url)')
                    .eq('game_id', gameId);

                const board = boardRows?.map(row => row.characters).filter(Boolean) || [];

                const isHost = player?.role === 'host';
                const eliminatedIds = boardRows?.filter(row => isHost ? row.eliminated_by_host : row.eliminated_by_guest).map(row => row.character_id) || [];

                callback({
                    success: true,
                    board,
                    secret,
                    themeSlug: theme?.slug,
                    isMyTurn: game?.current_turn_user_id === userId,
                    eliminatedIds
                });
            } catch (err) {
                callback({ success: false, error: (err as Error).message });
            }
        });

        // 4. PREGUNTAR
        socket.on('ask_question', async (data, callback) => {
            try {
                const { gameId, userId, questionCode, questionText } = data;

                const { data: game } = await supabaseAdmin.from('games').select('*').eq('id', gameId).single();
                if (game!.current_turn_user_id !== userId) throw new Error('No es tu turno');

                const { data: players } = await supabaseAdmin.from('game_players').select('user_id, secret_character_id, role').eq('game_id', gameId);
                const me = players?.find(p => p.user_id === userId);
                const opponent = players?.find(p => p.user_id !== userId);
                const isHost = me?.role === 'host';

                const { data: question } = await supabaseAdmin.from('questions').select('*').eq('code', questionCode).single();
                const { data: secretChar } = await supabaseAdmin.from('characters').select('*').eq('id', opponent?.secret_character_id).single();

                let answer = 'unknown';
                let matchedIds: string[] = [];

                if (secretChar && question) {
                    const expected = (question.value as any)?.v;
                    const secretValue = (secretChar.attributes as any)?.[question.attribute] ?? (secretChar as any)[question.attribute];
                    answer = evaluate(secretValue, question.operator, expected);

                    const { data: boardRows } = await supabaseAdmin
                        .from('game_characters')
                        .select('character_id, characters(*)')
                        .eq('game_id', gameId);

                    for (const row of boardRows ?? []) {
                        const ch = row.characters as any;
                        const attrValue = ch.attributes?.[question.attribute] ?? ch[question.attribute];
                        const v = evaluate(attrValue, question.operator, expected);

                        if (answer === 'yes' && v === 'no') matchedIds.push(row.character_id);
                        if (answer === 'no' && v === 'yes') matchedIds.push(row.character_id);
                    }
                }

                // Guardar descartes en BD
                if (matchedIds.length > 0) {
                    const column = isHost ? 'eliminated_by_host' : 'eliminated_by_guest';
                    for (const id of matchedIds) {
                        await supabaseAdmin.from('game_characters').update({ [column]: true }).eq('game_id', gameId).eq('character_id', id);
                    }
                }

                // Pasar turno
                await supabaseAdmin.from('games').update({ current_turn_user_id: opponent?.user_id }).eq('id', gameId);

                // Emitir eventos
                socket.emit('question_result', { questionText, answer, matchedIds });
                io.to(game!.room_code!).emit('opponent_asked', { askerId: userId, questionText, answer });

                callback({ success: true });
            } catch (err) {
                callback({ success: false, error: (err as Error).message });
            }
        });

        // 5. ADIVINAR
        socket.on('make_guess', async (data, callback) => {
            try {
                const { gameId, userId, characterId } = data;
                const { data: players } = await supabaseAdmin.from('game_players').select('user_id, secret_character_id').eq('game_id', gameId);
                const opponent = players?.find(p => p.user_id !== userId);
                const { data: game } = await supabaseAdmin.from('games').select('room_code').eq('id', gameId).single();

                if (opponent?.secret_character_id === characterId) {
                    await supabaseAdmin.from('games').update({ status: 'won', winner_user_id: userId, finished_at: new Date().toISOString() }).eq('id', gameId);
                    io.to(game!.room_code!).emit('game_over', { winnerId: userId });
                } else {
                    await supabaseAdmin.from('games').update({ current_turn_user_id: opponent?.user_id }).eq('id', gameId);
                    socket.emit('wrong_guess', { characterId });
                }
                callback({ success: true });
            } catch (err) {
                callback({ success: false, error: (err as Error).message });
            }
        });
    });
}