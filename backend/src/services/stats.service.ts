import { supabaseAdmin } from '../db/supabase.js';

export interface UserStats {
    games_played: number;
    games_won: number;
    games_lost: number;
    games_abandoned: number;
    questions_asked: number;
    win_rate: number;
}

export async function getStats(userId: string): Promise<UserStats> {
    const { data: row } = await supabaseAdmin
        .from('statistics')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

    if (!row) {
        return {
            games_played: 0, games_won: 0, games_lost: 0,
            games_abandoned: 0, questions_asked: 0, win_rate: 0
        };
    }

    const played = row.games_played || 0;
    return {
        games_played: played,
        games_won: row.games_won || 0,
        games_lost: row.games_lost || 0,
        games_abandoned: row.games_abandoned || 0,
        questions_asked: row.questions_asked || 0,
        win_rate: played > 0 ? Math.round((row.games_won / played) * 100) : 0,
    };
}

/**
 * Incrementa contadores de forma atómica mediante la función SQL
 * `record_game_result` (migración 0003). Si la función no está desplegada
 * todavía, cae al cálculo clásico lectura-modificación para no romper la app.
 */
export async function recordGameResult(
    userId: string,
    status: 'won' | 'lost' | 'abandoned',
    questionsAsked: number,
    durationSeconds: number
): Promise<void> {
    const { error: rpcError } = await supabaseAdmin.rpc('record_game_result', {
        p_user_id: userId,
        p_status: status,
        p_questions: questionsAsked,
        p_duration: durationSeconds,
    });
    if (!rpcError) return;
    console.warn('⚠️ record_game_result no disponible, usando fallback:', rpcError.message);

    const { data: existing } = await supabaseAdmin
        .from('statistics')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

    const base = existing ?? {
        user_id: userId, games_played: 0, games_won: 0, games_lost: 0,
        games_abandoned: 0, questions_asked: 0, avg_duration_seconds: 0,
    };

    const played = base.games_played + 1;
    const won = base.games_won + (status === 'won' ? 1 : 0);
    const lost = base.games_lost + (status === 'lost' ? 1 : 0);
    const abandoned = base.games_abandoned + (status === 'abandoned' ? 1 : 0);
    const questions = base.questions_asked + questionsAsked;
    const avg = base.avg_duration_seconds
        ? Math.round((base.avg_duration_seconds * base.games_played + durationSeconds) / played)
        : durationSeconds;

    await supabaseAdmin.from('statistics').upsert({
        user_id: userId,
        games_played: played,
        games_won: won,
        games_lost: lost,
        games_abandoned: abandoned,
        questions_asked: questions,
        avg_duration_seconds: avg,
        updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
}