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
  logs: { question: string; answer: string; details?: string }[];
  timeLeft: number | null;

  // --- Comodín / pistas ---
  hintsLeft: number;
  hintsUsed: number;
  maxHints: number;
  hintsHistory: string[];
  currentHint: string | null;
  hintLoading: boolean;
  hintError: string | null;

  startGame: (themeSlug: string, boardSize?: number, timeLimit?: number) => Promise<void>;
  toggleEliminate: (id: string) => void;
  askQuestion: (code: string, text: string) => Promise<void>;
  makeGuess: (id: string) => Promise<void>;
  abandon: () => void;
  hydrate: (themeSlug: string) => boolean;
  reset: () => void;
  clearError: () => void;
  setTimeLeft: (time: number | null) => void;

  // --- Acciones del comodín ---
  requestHint: () => Promise<void>;
  clearHint: () => void;
  clearHintError: () => void;
  syncHints: (hints: {
    used: number;
    left: number;
    history: string[];
    current: string | null;
    max?: number;
  }) => void;
}

const INITIAL_HINTS = {
  hintsLeft: 2,
  hintsUsed: 0,
  maxHints: 2,
  hintsHistory: [] as string[],
  currentHint: null as string | null,
  hintLoading: false,
  hintError: null as string | null,
};

function persist(s: GameState) {
  if (!s.gameId || s.theme === null) {
    localStorage.removeItem(STORAGE_KEY);
    return;
  }
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      gameId: s.gameId,
      theme: s.theme,
      board: s.board,
      eliminated: Array.from(s.eliminated),
      status: s.status,
      secret: s.secret,
      logs: s.logs,
      timeLeft: s.timeLeft,
      hintsLeft: s.hintsLeft,
      hintsUsed: s.hintsUsed,
      maxHints: s.maxHints,
      hintsHistory: s.hintsHistory,
      currentHint: s.currentHint,
    }),
  );
}

export function readPersisted() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return {
      ...parsed,
      eliminated: new Set<string>(parsed.eliminated ?? []),
      hintsLeft: parsed.hintsLeft ?? INITIAL_HINTS.hintsLeft,
      hintsUsed: parsed.hintsUsed ?? INITIAL_HINTS.hintsUsed,
      maxHints: parsed.maxHints ?? INITIAL_HINTS.maxHints,
      hintsHistory: parsed.hintsHistory ?? INITIAL_HINTS.hintsHistory,
      currentHint: parsed.currentHint ?? INITIAL_HINTS.currentHint,
    };
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
  timeLeft: null,

  ...INITIAL_HINTS,

  hydrate: (themeSlug: string) => {
    const p = readPersisted();
    if (!p || p.theme.slug !== themeSlug) return false;
    set({ ...p, loading: false, error: null, hintLoading: false, hintError: null });
    return true;
  },

  startGame: async (themeSlug, boardSize = 16, timeLimit) => {
    set({ loading: true, error: null });
    try {
      const res = await api.createGame(themeSlug, boardSize);
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
        timeLeft: timeLimit || null,
        ...INITIAL_HINTS,
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
    set({ eliminated: next });
    persist({ ...get(), eliminated: next });

    if (next.size >= get().board.length) {
      set({ status: 'lost' });
      persist({ ...get(), eliminated: next, status: 'lost' });
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
        res.answer === 'yes'
          ? '✅ Sí'
          : res.answer === 'no'
            ? '❌ No'
            : '❓ Desconocido';
      const logs = [...get().logs, { question: text, answer: logAnswer }];
      const isDead = elim.size >= get().board.length;

      set({ eliminated: elim, logs, status: isDead ? 'lost' : 'playing' });
      persist({ ...get(), eliminated: elim, logs, status: isDead ? 'lost' : 'playing' });
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
        set({ status: 'won', secret: res.secret ?? null });
        persist({ ...get(), status: 'won', secret: res.secret ?? null });
      } else {
        const elim = new Set(get().eliminated);
        elim.add(characterId);
        const isDead = elim.size >= get().board.length;
        set({ eliminated: elim, status: isDead ? 'lost' : 'playing' });
        persist({ ...get(), eliminated: elim, status: isDead ? 'lost' : 'playing' });
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
      gameId: null,
      theme: null,
      board: [],
      eliminated: new Set(),
      status: 'idle',
      secret: null,
      logs: [],
      error: null,
      loading: false,
      timeLeft: null,
      ...INITIAL_HINTS,
    });
  },

  clearError: () => set({ error: null }),
  setTimeLeft: (time) => set({ timeLeft: time }),

  // ============================================================
  // COMODÍN
  // ============================================================
  requestHint: async () => {
    const { gameId, status, hintsLeft, hintLoading } = get();
    if (hintLoading) return;
    if (!gameId || status !== 'playing') return;

    if (hintsLeft <= 0) {
      set({ hintError: 'No quedan pistas disponibles' });
      return;
    }

    set({ hintLoading: true, hintError: null });
    try {
      const res = await api.getHint(gameId);
      set({
        currentHint: res.hint,
        hintsUsed: res.hintsUsed,
        hintsLeft: res.hintsLeft,
        hintsHistory: res.hintsHistory,
        maxHints: res.maxHints,
        hintLoading: false,
      });
      persist(get());

      const logs = [
        ...get().logs,
        { question: '💡 Pista', answer: res.hint },
      ];
      set({ logs });
      persist(get());
    } catch (e) {
      set({
        hintError: (e as Error).message ?? 'Error obteniendo pista',
        hintLoading: false,
      });
    }
  },

  clearHint: () => {
    set({ currentHint: null });
    persist(get());
  },

  clearHintError: () => set({ hintError: null }),

  syncHints: (hints) =>
    set({
      hintsUsed: hints.used,
      hintsLeft: hints.left,
      hintsHistory: hints.history ?? [],
      currentHint: hints.current ?? get().currentHint,
      maxHints: hints.max ?? hints.used + hints.left,
    }),
}));