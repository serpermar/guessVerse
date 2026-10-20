import { create } from 'zustand';
import { api, type CharacterCard, type Theme } from '../services/api';

const STORAGE_KEY = 'guessverse:current-game';

type Status = 'idle' | 'playing' | 'won' | 'lost';

interface GameState {
    gameId: string | null;
    theme: Theme | null;
    board: CharacterCard[];
    eliminated: Set<string>;
    status: Status;
    secret: CharacterCard | null;
    loading: boolean;
    error: string | null;
    logs: { question: string; answer: string }[];

    startGame: (themeSlug: string) => Promise<void>;
    toggleEliminate: (id: string) => void;
    askQuestion: (code: string, text: string) => Promise<void>;
    makeGuess: (id: string) => Promise<void>;
    abandon: () => void;
    hydrate: () => boolean;
    reset: () => void;
}

interface Persisted {
    gameId: string;
    theme: Theme;
    board: CharacterCard[];
    eliminated: string[];
    status: Status;
    secret: CharacterCard | null;
    logs: { question: string; answer: string }[];
}

function persist(s: GameState) {
    if (!s.gameId || s.theme === null) {
        localStorage.removeItem(STORAGE_KEY);
        return;
    }
    const data: Persisted = {
        gameId: s.gameId,
        theme: s.theme,
        board: s.board,
        eliminated: Array.from(s.eliminated),
        status: s.status,
        secret: s.secret,
        logs: s.logs,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function readPersisted(): Persisted | null {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        return JSON.parse(raw) as Persisted;
    } catch {
        return null;
    }
}

export const useGameStore = create<GameState>((set, get) => ({
    gameId: null,
    theme: null,
    board: [],
    eliminated: new Set(),
    status: 'idle',
    secret: null,
    loading: false,
    error: null,
    logs: [],

    hydrate: () => {
        const p = readPersisted();
        if (!p) return false;
        set({
            gameId: p.gameId,
            theme: p.theme,
            board: p.board,
            eliminated: new Set(p.eliminated),
            status: p.status,
            secret: p.secret,
            logs: p.logs,
            loading: false,
            error: null,
        });
        return true;
    },

    startGame: async (themeSlug) => {
        set({ loading: true, error: null });
        try {
            const res = await api.createGame(themeSlug, 16);
            const base: GameState = {
                ...get(),
                gameId: res.gameId,
                theme: res.theme,
                board: res.board,
                eliminated: new Set(),
                status: 'playing',
                secret: null,
                logs: [],
                loading: false,
            };
            set(base);
            persist(base);
        } catch (e) {
            set({ error: (e as Error).message, loading: false });
        }
    },

    toggleEliminate: (id) => {
        if (get().status !== 'playing') return;
        const next = new Set(get().eliminated);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        const next_state = { ...get(), eliminated: next };
        set({ eliminated: next });
        persist(next_state);

        if (next.size >= get().board.length) {
            const lost = { ...get(), eliminated: next, status: 'lost' as Status };
            set({ status: 'lost' });
            persist(lost);
        }
    },

    askQuestion: async (code, text) => {
        const { gameId, status } = get();
        if (!gameId || status !== 'playing') return;
        try {
            const res = await api.askQuestion(gameId, code);
            const elim = new Set(get().eliminated);
            if (res.answer === 'yes') res.matches.no.forEach((id) => elim.add(id));
            else if (res.answer === 'no') res.matches.yes.forEach((id) => elim.add(id));

            const logAnswer =
                res.answer === 'yes' ? '✅ Sí' : res.answer === 'no' ? '❌ No' : '❓ Desconocido';
            const logs = [...get().logs, { question: text, answer: logAnswer }];
            const isDead = elim.size >= get().board.length;
            const nextStatus: Status = isDead ? 'lost' : 'playing';
            const next = { ...get(), eliminated: elim, logs, status: nextStatus };
            set({ eliminated: elim, logs, status: nextStatus });
            persist(next);
        } catch (e) {
            set({ error: (e as Error).message });
        }
    },

    makeGuess: async (characterId) => {
        const { gameId, status } = get();
        if (!gameId || status !== 'playing') return;
        try {
            const res = await api.guess(gameId, characterId);
            if (res.correct) {
                const next = { ...get(), status: 'won' as Status, secret: res.secret ?? null };
                set({ status: 'won', secret: res.secret ?? null });
                persist(next);
            } else {
                const elim = new Set(get().eliminated);
                elim.add(characterId);
                const isDead = elim.size >= get().board.length;
                const nextStatus: Status = isDead ? 'lost' : 'playing';
                const next = { ...get(), eliminated: elim, status: nextStatus };
                set({ eliminated: elim, status: nextStatus });
                persist(next);
            }
        } catch (e) {
            set({ error: (e as Error).message });
        }
    },

    abandon: () => {
        const next = { ...get(), status: 'lost' as Status };
        set({ status: 'lost' });
        persist(next);
    },

    reset: () => {
        localStorage.removeItem(STORAGE_KEY);
        set({
            gameId: null, theme: null, board: [], eliminated: new Set(),
            status: 'idle', secret: null, logs: [], error: null, loading: false,
        });
    },
}));