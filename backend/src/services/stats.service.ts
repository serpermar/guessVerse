import { supabaseAdmin } from '../db/supabase.js';
import { levelFromXp, xpForGame, type GameResultStatus } from './xp.js';

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
 * Registra el resultado de una partida de forma atómica mediante la RPC
 * `record_game_result` (migración 0004), que también actualiza XP y nivel.
 *
 * Si la migración aún no está desplegada, usa un fallback en TypeScript para
 * no romper la app (menos atómico, pero funcional).
 */
export async function recordGameResult(
    userId: string,
    status: GameResultStatus,
    questionsAsked: number,
    durationSeconds: number
): Promise<void> {
    const { error } = await supabaseAdmin.rpc('record_game_result', {
        p_user_id: userId,
        p_status: status,
        p_questions: Math.max(0, Math.floor(questionsAsked)),
        p_duration: Math.max(0, Math.floor(durationSeconds)),
    });

    if (!error) return;

    console.warn('⚠️ RPC record_game_result no disponible; usando fallback:', error.message);
    await recordGameResultFallback(userId, status, questionsAsked, durationSeconds);
}

/** Fallback no atómico para entornos sin la migración 0004. */
export async function recordGameResultFallback(
    userId: string,
    status: GameResultStatus,
    questionsAsked: number,
    durationSeconds: number
): Promise<void> {
    const { data: existing } = await supabaseAdmin
        .from('statistics')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
    const { data: user } = await supabaseAdmin
        .from('users')
        .select('xp, level')
        .eq('id', userId)
        .maybeSingle();

    const base = existing ?? {
        user_id: userId,
        games_played: 0,
        games_won: 0,
        games_lost: 0,
        games_abandoned: 0,
        questions_asked: 0,
        avg_duration_seconds: 0,
        xp_earned: 0,
    };
    const currentXp = user?.xp || 0;
    const safeQuestions = Math.max(0, Math.floor(questionsAsked));
    const safeDuration = Math.max(0, Math.floor(durationSeconds));

    const played = base.games_played + 1;
    const won = base.games_won + (status === 'won' ? 1 : 0);
    const lost = base.games_lost + (status === 'lost' ? 1 : 0);
    const abandoned = base.games_abandoned + (status === 'abandoned' ? 1 : 0);
    const questions = base.questions_asked + safeQuestions;
    const avg = base.avg_duration_seconds
        ? Math.round((base.avg_duration_seconds * base.games_played + safeDuration) / played)
        : safeDuration;

    const xpGained = xpForGame(status, safeQuestions);
    const totalXp = currentXp + xpGained;
    const newLevel = levelFromXp(totalXp);

    await supabaseAdmin.from('statistics').upsert({
        user_id: userId,
        games_played: played,
        games_won: won,
        games_lost: lost,
        games_abandoned: abandoned,
        questions_asked: questions,
        avg_duration_seconds: avg,
        xp_earned: (base.xp_earned || 0) + xpGained,
        updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });

    await supabaseAdmin.from('users').upsert({
        id: userId,
        xp: totalXp,
        level: newLevel,
    }, { onConflict: 'id' });
}

// Ranking Global
export async function getGlobalLeaderboard(limit = 10) {
    const { data, error } = await supabaseAdmin
        .from('users')
        .select('id, username, avatar_url, xp, level')
        .order('xp', { ascending: false })
        .limit(limit);

    if (error) throw new Error(`Error obteniendo ranking: ${error.message}`);
    return data || [];
}
