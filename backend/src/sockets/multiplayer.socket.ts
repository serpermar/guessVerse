import { Server, Socket } from 'socket.io';
import { supabaseAdmin } from '../db/supabase.js';
import { evaluate } from '../services/game.rules.js';
import { askAiFree } from '../services/ai.service.js';
import { getHint } from '../services/game.service.js';

function generateRoomCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 5; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

const disconnectTimers = new Map<string, NodeJS.Timeout>();

export function setupMultiplayerSockets(io: Server) {
    io.on('connection', (socket: Socket) => {
        
        socket.on('create_room', async (data, callback) => {
            try {
                const { themeSlug, userId } = data;
                let roomCode = generateRoomCode();
                let isUnique = false;
                while (!isUnique) {
                    const { data: existing } = await supabaseAdmin.from('games').select('id').eq('room_code', roomCode).maybeSingle();
                    if (!existing) isUnique = true;
                    else roomCode = generateRoomCode();
                }
                const { data: theme } = await supabaseAdmin.from('themes').select('id').eq('slug', themeSlug).single();
                const { data: game } = await supabaseAdmin.from('games').insert({ theme_id: theme!.id, mode: 'multiplayer', status: 'waiting', room_code: roomCode, created_by: userId, current_turn_user_id: userId }).select('id, room_code').single();
                await supabaseAdmin.from('game_players').insert({ game_id: game!.id, user_id: userId, role: 'host', is_connected: true });
                socket.join(game!.room_code);
                socket.data.userId = userId;
                socket.data.gameId = game!.id;
                socket.data.roomCode = game!.room_code;
                callback({ success: true, roomCode: game!.room_code, gameId: game!.id });
            } catch (err) { callback({ success: false, error: (err as Error).message }); }
        });

        socket.on('join_room', async (data, callback) => {
            try {
                const { roomCode, userId } = data;
                const { data: game } = await supabaseAdmin.from('games').select('id, status, theme_id, room_code').eq('room_code', roomCode.toUpperCase()).maybeSingle();
                if (!game || game.status !== 'waiting') throw new Error('Sala no disponible');
                await supabaseAdmin.from('game_players').insert({ game_id: game.id, user_id: userId, role: 'guest', is_connected: true });
                const { data: franchises } = await supabaseAdmin.from('franchises').select('id').eq('theme_id', game.theme_id);
                const franchiseIds = franchises!.map(f => f.id);
                const { data: allChars } = await supabaseAdmin.from('characters').select('id, name, image_url').in('franchise_id', franchiseIds);
                const shuffled = [...allChars!].sort(() => Math.random() - 0.5);
                const board = shuffled.slice(0, 16);
                const secretHost = board[Math.floor(Math.random() * 8)];
                let secretGuest = board[Math.floor(Math.random() * 8) + 8];
                if (secretHost.id === secretGuest.id) secretGuest = board[15];
                const { data: players } = await supabaseAdmin.from('game_players').select('id, role').eq('game_id', game.id);
                const hostPlayer = players?.find(p => p.role === 'host');
                const guestPlayer = players?.find(p => p.role === 'guest');
                await supabaseAdmin.from('game_players').update({ secret_character_id: secretHost.id }).eq('id', hostPlayer!.id);
                await supabaseAdmin.from('game_players').update({ secret_character_id: secretGuest.id }).eq('id', guestPlayer!.id);
                await supabaseAdmin.from('game_characters').insert(board.map(c => ({ game_id: game.id, character_id: c.id })));
                await supabaseAdmin.from('games').update({ status: 'playing' }).eq('id', game.id);
                socket.join(game.room_code);
                socket.data.userId = userId;
                socket.data.gameId = game.id;
                socket.data.roomCode = game.room_code;
                io.to(game.room_code).emit('player_joined', { gameId: game.id });
                callback({ success: true, gameId: game.id });
            } catch (err) { callback({ success: false, error: (err as Error).message }); }
        });

        socket.on('request_game_state', async (data, callback) => {
            try {
                const { gameId, userId } = data;
                const { data: game } = await supabaseAdmin.from('games').select('current_turn_user_id, theme_id, status, room_code').eq('id', gameId).single();
                if (game?.status === 'won' || game?.status === 'lost') return callback({ success: false, error: 'La partida ha terminado' });
                socket.join(game!.room_code);
                socket.data.userId = userId;
                socket.data.gameId = gameId;
                socket.data.roomCode = game!.room_code;
                const timerKey = `${gameId}:${userId}`;
                if (disconnectTimers.has(timerKey)) {
                    clearTimeout(disconnectTimers.get(timerKey));
                    disconnectTimers.delete(timerKey);
                }
                await supabaseAdmin.from('game_players').update({ is_connected: true }).eq('game_id', gameId).eq('user_id', userId);
                io.to(game!.room_code).emit('opponent_reconnected');
                const { data: theme } = await supabaseAdmin.from('themes').select('slug').eq('id', game!.theme_id).single();
                const { data: player } = await supabaseAdmin.from('game_players').select('role, secret_character_id, characters(id, name, image_url)').eq('game_id', gameId).eq('user_id', userId).single();
                const secret = player?.characters as any;
                const { data: boardRows } = await supabaseAdmin.from('game_characters').select('character_id, eliminated_by_host, eliminated_by_guest, characters(id, name, image_url)').eq('game_id', gameId);
                const board = boardRows?.map(row => row.characters).filter(Boolean) || [];
                const isHost = player?.role === 'host';
                const eliminatedIds = boardRows?.filter(row => isHost ? row.eliminated_by_host : row.eliminated_by_guest).map(row => row.character_id) || [];
                const { data: chatHistory } = await supabaseAdmin.from('game_chat').select('*').eq('game_id', gameId).order('created_at', { ascending: true }).limit(100);
                callback({ success: true, board, secret, themeSlug: theme?.slug, isMyTurn: game?.current_turn_user_id === userId, eliminatedIds, chatHistory });
            } catch (err) { callback({ success: false, error: (err as Error).message }); }
        });

        socket.on('ask_question', async (data, callback) => {
            try {
                const { gameId, userId, questionCode, questionText } = data;
                const { data: game } = await supabaseAdmin.from('games').select('*').eq('id', gameId).single();
                if (game!.current_turn_user_id !== userId) throw new Error('No es tu turno');
                const { data: players } = await supabaseAdmin.from('game_players').select('user_id, secret_character_id, role').eq('game_id', gameId);
                const me = players?.find(p => p.user_id === userId);
                const opponent = players?.find(p => p.user_id !== userId);
                const { data: question } = await supabaseAdmin.from('questions').select('*').eq('code', questionCode).single();
                const { data: secretChar } = await supabaseAdmin.from('characters').select('*').eq('id', opponent?.secret_character_id).single();
                let answer = 'unknown';
                let matchedIds: string[] = [];
                if (secretChar && question) {
                    const expected = (question.value as any)?.v;
                    const secretValue = (secretChar.attributes as any)?.[question.attribute] ?? (secretChar as any)[question.attribute];
                    answer = evaluate(secretValue, question.operator, expected);
                    if (answer === 'unknown') {
                        return callback({ success: false, error: 'Esa pregunta no aplica a esta temática.' });
                    }
                    const { data: boardRows } = await supabaseAdmin.from('game_characters').select('character_id, characters(*)').eq('game_id', gameId);
                    for (const row of boardRows ?? []) {
                        const ch = row.characters as any;
                        const attrValue = ch.attributes?.[question.attribute] ?? ch[question.attribute];
                        const v = evaluate(attrValue, question.operator, expected);
                        if (answer === 'yes' && v === 'no') matchedIds.push(row.character_id);
                        if (answer === 'no' && v === 'yes') matchedIds.push(row.character_id);
                    }
                }
                if (matchedIds.length > 0) {
                    const column = me?.role === 'host' ? 'eliminated_by_host' : 'eliminated_by_guest';
                    for (const id of matchedIds) {
                        await supabaseAdmin.from('game_characters').update({ [column]: true }).eq('game_id', gameId).eq('character_id', id);
                    }
                }
                await supabaseAdmin.from('games').update({ current_turn_user_id: opponent?.user_id }).eq('id', gameId);
                socket.emit('question_result', { questionText, answer, matchedIds });
                io.to(game!.room_code!).emit('opponent_asked', { askerId: userId, questionText, answer });
                callback({ success: true });
            } catch (err) { callback({ success: false, error: (err as Error).message }); }
        });

        // NUEVO: IA en Multijugador
        socket.on('ask_ai_question', async (data, callback) => {
            try {
                const { gameId, userId, freeText } = data;
                const { data: game } = await supabaseAdmin.from('games').select('*').eq('id', gameId).single();
                if (game!.current_turn_user_id !== userId) throw new Error('No es tu turno');

                const { data: players } = await supabaseAdmin.from('game_players').select('user_id, secret_character_id, role').eq('game_id', gameId);
                const me = players?.find(p => p.user_id === userId);
                const opponent = players?.find(p => p.user_id !== userId);

                const { data: secretChar } = await supabaseAdmin.from('characters').select('*').eq('id', opponent?.secret_character_id).single();
                if (!secretChar) throw new Error('Secreto no encontrado');

                const { data: boardRows } = await supabaseAdmin.from('game_characters').select('character_id, characters(*)').eq('game_id', gameId);
                const boardChars = boardRows?.map(r => r.characters).filter(Boolean) || [];

                const result = await askAiFree(freeText, secretChar, boardChars);
                if (result.answer === 'unknown') throw new Error(result.message || 'La IA no entendió la pregunta');

                if (result.matchedIds.length > 0) {
                    const column = me?.role === 'host' ? 'eliminated_by_host' : 'eliminated_by_guest';
                    for (const id of result.matchedIds) {
                        await supabaseAdmin.from('game_characters').update({ [column]: true }).eq('game_id', gameId).eq('character_id', id);
                    }
                }

                await supabaseAdmin.from('games').update({ current_turn_user_id: opponent?.user_id }).eq('id', gameId);

                socket.emit('ai_question_result', { freeText, answer: result.answer, matchedIds: result.matchedIds, filters: result.filters });
                io.to(game!.room_code!).emit('opponent_asked_ai', { askerId: userId, freeText, answer: result.answer });

                callback({ success: true });
            } catch (err) { callback({ success: false, error: (err as Error).message }); }
        });

        // NUEVO: Comodín en Multijugador
        socket.on('ask_hint', async (data, callback) => {
            try {
                const { gameId, userId } = data;
                const result = await getHint(gameId, userId);
                callback({ success: true, hint: result.hint });
            } catch (err) {
                callback({ success: false, error: (err as Error).message });
            }
        });

        socket.on('make_guess', async (data, callback) => {
            try {
                const { gameId, userId, characterId } = data;
                const { data: players } = await supabaseAdmin.from('game_players').select('user_id, secret_character_id').eq('game_id', gameId);
                const opponent = players?.find(p => p.user_id !== userId);
                const { data: game } = await supabaseAdmin.from('games').select('room_code, status').eq('id', gameId).single();
                if (game?.status !== 'playing') throw new Error('La partida no está activa');
                if (opponent?.secret_character_id === characterId) {
                    await supabaseAdmin.from('games').update({ status: 'won', winner_user_id: userId, finished_at: new Date().toISOString() }).eq('id', gameId);
                    io.to(game!.room_code!).emit('game_over', { winnerId: userId });
                } else {
                    await supabaseAdmin.from('games').update({ current_turn_user_id: opponent?.user_id }).eq('id', gameId);
                    socket.emit('wrong_guess', { characterId });
                }
                callback?.({ success: true });
            } catch (err) { callback?.({ success: false, error: (err as Error).message }); }
        });

        socket.on('abandon_game', async (data) => {
            const { gameId, userId } = data;
            const { data: game } = await supabaseAdmin.from('games').select('room_code, status').eq('id', gameId).single();
            if (game?.status === 'playing') {
                const { data: players } = await supabaseAdmin.from('game_players').select('user_id').eq('game_id', gameId);
                const opponent = players?.find(p => p.user_id !== userId);
                await supabaseAdmin.from('games').update({ status: 'lost', winner_user_id: opponent?.user_id, finished_at: new Date().toISOString() }).eq('id', gameId);
                io.to(game.room_code!).emit('game_over', { winnerId: opponent?.user_id });
            }
        });

        socket.on('send_chat', async (data) => {
            const { gameId, userId, message, userName } = data;
            const { data: game } = await supabaseAdmin.from('games').select('room_code').eq('id', gameId).single();
            if (game?.room_code) {
                await supabaseAdmin.from('game_chat').insert({ game_id: gameId, user_id: userId, user_name: userName, message: message });
                io.to(game.room_code).emit('receive_chat', { userId, userName, message });
            }
        });

        socket.on('disconnect', async () => {
            const { userId, gameId } = socket.data;
            if (!userId || !gameId) return;
            await supabaseAdmin.from('game_players').update({ is_connected: false }).eq('game_id', gameId).eq('user_id', userId);
            socket.to(gameId).emit('opponent_disconnected');
            const timerKey = `${gameId}:${userId}`;
            if (disconnectTimers.has(timerKey)) clearTimeout(disconnectTimers.get(timerKey));
            const timeout = setTimeout(async () => {
                const { data: player } = await supabaseAdmin.from('game_players').select('is_connected').eq('game_id', gameId).eq('user_id', userId).single();
                if (player && !player.is_connected) {
                    const { data: game } = await supabaseAdmin.from('games').select('room_code, status').eq('id', gameId).single();
                    if (game?.status === 'playing') {
                        const { data: players } = await supabaseAdmin.from('game_players').select('user_id').eq('game_id', gameId);
                        const opponent = players?.find(p => p.user_id !== userId);
                        await supabaseAdmin.from('games').update({ status: 'won', winner_user_id: opponent?.user_id, finished_at: new Date().toISOString() }).eq('id', gameId);
                        io.to(game.room_code!).emit('game_over', { winnerId: opponent?.user_id });
                    }
                }
                disconnectTimers.delete(timerKey);
            }, 30000);
            disconnectTimers.set(timerKey, timeout);
        });
    });
}