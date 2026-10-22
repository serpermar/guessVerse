import { supabase } from '../lib/supabase';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

async function req<T>(path: string, init?: RequestInit): Promise<T> {
    const { data: { session } } = await supabase.auth.getSession();

    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...((init?.headers as Record<string, string> | undefined) ?? {}),
    };
    if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;

    const res = await fetch(`${API_URL}${path}`, { ...init, headers });

    if (!res.ok) {
        const body = (await res.json().catch(() => ({ error: res.statusText }))) as { error?: string };
        throw new Error(body.error ?? 'Error de red');
    }
    if (res.status === 204) return undefined as T;
    return res.json() as Promise<T>;
}

// ---------- Tipos ----------
export interface Theme {
    id: string;
    slug: string;
    name: string;
    description: string | null;
    image_url: string | null;
}

export interface CharacterCard {
    id: string;
    name: string;
    image_url: string | null;
}

export interface CreateGameResponse {
    gameId: string;
    theme: Theme;
    board: CharacterCard[];
    status: string;
}

export interface AskResponse {
    question: { code: string; text: string };
    answer: 'yes' | 'no' | 'unknown';
    matches: { yes: string[]; no: string[]; unknown: string[] };
}

export interface GuessResponse {
    correct: boolean;
    status: 'playing' | 'won';
    secret?: CharacterCard;
}

export interface QuestionDto {
    id: string;
    code: string;
    text_es: string;
    category: string | null;
}

export interface UserProfile {
    id: string;
    email: string;
    username: string;
    avatar_url: string | null;
    created_at: string;
    updated_at: string;
}

export interface UserStats {
    games_played: number;
    games_won: number;
    games_lost: number;
    games_abandoned: number;
    questions_asked: number;
    win_rate: number;
}

export interface GameHistoryItem {
    id: string;
    status: 'playing' | 'won' | 'lost' | 'abandoned' | 'waiting';
    mode: string;
    started_at: string | null;
    finished_at: string | null;
    secret_character_id: string | null;
    themes: { name: string; slug: string } | null;
}

// ---------- API ----------
export const api = {
    themes: () =>
        req<{ data: Theme[] }>('/api/themes').then((r) => r.data),

    questions: (themeSlug: string) =>
        req<{ data: QuestionDto[] }>(`/api/themes/${themeSlug}/questions`).then((r) => r.data),

    createGame: (themeSlug: string, boardSize = 16) =>
        req<CreateGameResponse>('/api/games', {
            method: 'POST',
            body: JSON.stringify({ themeSlug, boardSize }),
        }),

    askQuestion: (gameId: string, questionCode: string) =>
        req<AskResponse>(`/api/games/${gameId}/questions`, {
            method: 'POST',
            body: JSON.stringify({ questionCode }),
        }),

    guess: (gameId: string, characterId: string) =>
        req<GuessResponse>(`/api/games/${gameId}/guess`, {
            method: 'POST',
            body: JSON.stringify({ characterId }),
        }),

    abandon: (gameId: string) =>
        req<{ status: 'lost' }>(`/api/games/${gameId}/abandon`, { method: 'POST' }),

    // ----- Usuarios -----
    me: () => req<{ data: UserProfile }>('/api/users/me').then((r) => r.data),

    updateMe: (patch: { username?: string; avatar_url?: string }) =>
        req<{ data: UserProfile }>('/api/users/me', {
            method: 'PATCH',
            body: JSON.stringify(patch),
        }).then((r) => r.data),

    myStats: () => req<{ data: UserStats }>('/api/users/me/stats').then((r) => r.data),

    myGames: (limit = 20) =>
        req<{ data: GameHistoryItem[] }>(`/api/users/me/games?limit=${limit}`).then((r) => r.data),
};