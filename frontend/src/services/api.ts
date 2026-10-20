const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

async function req<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${API_URL}${path}`, {
        headers: { 'Content-Type': 'application/json' },
        ...init,
    });
    if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(body.error ?? 'Error de red');
    }
    return res.json() as Promise<T>;
}

export const api = {
    themes: () => req<{ data: Theme[] }>('/api/themes').then((r) => r.data),
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
};

export interface Theme { id: string; slug: string; name: string; description: string | null; image_url: string | null }
export interface CharacterCard { id: string; name: string; image_url: string | null }
export interface CreateGameResponse { gameId: string; theme: Theme; board: CharacterCard[]; status: string }
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