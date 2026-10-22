const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

async function req<T>(path: string, init?: RequestInit): Promise<T> {
    const hasBody = init?.body !== undefined;
    const res = await fetch(`${API_URL}${path}`, {
        ...init,
        headers: {
            ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
            ...init?.headers,
        },
    });
    if (!res.ok) {
        const body = (await res.json().catch(() => ({ error: res.statusText }))) as {
            error?: string;
        };
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
};