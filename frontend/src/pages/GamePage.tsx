import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGameStore } from '../stores/game.store';
import { api, type CharacterCard, type QuestionDto } from '../services/api';
import { Modal } from '../components/Modal';

const GRADIENTS = [
    'from-purple-600 to-pink-600',
    'from-blue-600 to-cyan-500',
    'from-emerald-600 to-teal-500',
    'from-orange-600 to-red-600',
    'from-indigo-600 to-purple-600',
    'from-rose-600 to-pink-600',
];

function initials(name: string) {
    return name
        .split(/\s+/)
        .map((w) => w[0] ?? '')
        .join('')
        .slice(0, 2)
        .toUpperCase();
}

function gradientFor(name: string) {
    const h = name.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    return GRADIENTS[h % GRADIENTS.length];
}

function CharacterAvatar({ character }: { character: CharacterCard }) {
    if (character.image_url) {
        return (
            <img
                src={character.image_url}
                alt={character.name}
                loading="lazy"
                className="h-full w-full object-cover"
            />
        );
    }
    return (
        <div
            className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${gradientFor(
                character.name
            )}`}
        >
            <span className="text-4xl font-black text-white/90 drop-shadow-lg sm:text-5xl">
                {initials(character.name)}
            </span>
        </div>
    );
}

export function GamePage() {
    const { themeSlug } = useParams<{ themeSlug: string }>();
    const nav = useNavigate();

    const status = useGameStore((s) => s.status);
    const loading = useGameStore((s) => s.loading);
    const error = useGameStore((s) => s.error);
    const gameId = useGameStore((s) => s.gameId);
    const theme = useGameStore((s) => s.theme);
    const board = useGameStore((s) => s.board);
    const eliminated = useGameStore((s) => s.eliminated);
    const secret = useGameStore((s) => s.secret);
    const logs = useGameStore((s) => s.logs);
    const hydrate = useGameStore((s) => s.hydrate);
    const startGame = useGameStore((s) => s.startGame);
    const toggleEliminate = useGameStore((s) => s.toggleEliminate);
    const askQuestion = useGameStore((s) => s.askQuestion);
    const makeGuess = useGameStore((s) => s.makeGuess);
    const abandon = useGameStore((s) => s.abandon);
    const clearError = useGameStore((s) => s.clearError);
    const reset = useGameStore((s) => s.reset);

    const [questions, setQuestions] = useState<QuestionDto[]>([]);
    const [questionsError, setQuestionsError] = useState(false);
    const [guessMode, setGuessMode] = useState(false);
    const [confirmCard, setConfirmCard] = useState<CharacterCard | null>(null);
    const startedRef = useRef(false);

    useEffect(() => {
        if (!themeSlug || startedRef.current) return;
        if (useGameStore.getState().status !== 'idle') return;
        startedRef.current = true;
        const restored = hydrate(themeSlug);
        if (!restored) startGame(themeSlug);
    }, [themeSlug, hydrate, startGame]);

    const loadQuestions = useCallback(() => {
        if (!themeSlug) return () => undefined;
        let cancelled = false;
        api
            .questions(themeSlug)
            .then((q) => {
                if (!cancelled) {
                    setQuestions(q);
                    setQuestionsError(false);
                }
            })
            .catch(() => {
                if (!cancelled) setQuestionsError(true);
            });
        return () => {
            cancelled = true;
        };
    }, [themeSlug]);

    useEffect(() => {
        return loadQuestions();
    }, [loadQuestions]);

    const retryQuestions = () => {
        setQuestionsError(false);
        loadQuestions();
    };

    const onCardClick = (card: CharacterCard) => {
        if (status !== 'playing') return;
        if (guessMode) setConfirmCard(card);
        else toggleEliminate(card.id);
    };

    const confirmGuess = async () => {
        if (!confirmCard) return;
        const card = confirmCard;
        setConfirmCard(null);
        setGuessMode(false);
        await makeGuess(card.id);
    };

    const goHome = () => {
        reset();
        nav('/');
    };

    if (loading) {
        return <p className="p-8 text-center text-muted">Creando partida…</p>;
    }

    if (!gameId) {
        return (
            <div className="mx-auto max-w-md px-4 py-16 text-center">
                <p className="mb-4 text-muted">No hay ninguna partida activa.</p>
                <button
                    onClick={() => nav('/')}
                    className="rounded-lg bg-brand-strong px-6 py-2 font-semibold text-white transition hover:opacity-90"
                >
                    Volver al inicio
                </button>
            </div>
        );
    }

    const remaining = board.length - eliminated.size;

    return (
        <main className="mx-auto max-w-6xl animate-fade-in px-4 py-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-2xl font-bold">{theme?.name}</h2>
                <div className="flex items-center gap-3 text-sm">
                    <span className="rounded-full border border-border bg-surface px-3 py-1 text-muted">
                        Quedan <strong className="text-fg">{remaining}</strong>
                    </span>
                    <button
                        onClick={() => abandon()}
                        disabled={status !== 'playing'}
                        className="text-muted transition hover:text-red-500 disabled:opacity-40"
                    >
                        Abandonar
                    </button>
                    <button onClick={goHome} className="text-muted transition hover:text-fg">
                        ← Salir
                    </button>
                </div>
            </div>

            {error && (
                <div
                    role="alert"
                    className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-500"
                >
                    <span>{error}</span>
                    <button
                        onClick={clearError}
                        aria-label="Cerrar aviso"
                        className="hover:opacity-70"
                    >
                        ✕
                    </button>
                </div>
            )}

            <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
                <section>
                    <div className="mb-3 flex items-center justify-between gap-2">
                        <div className="text-sm text-muted">
                            {guessMode
                                ? 'Selecciona la carta que crees que es el personaje secreto'
                                : 'Clic para descartar/restaurar'}
                        </div>
                        {!guessMode ? (
                            <button
                                onClick={() => setGuessMode(true)}
                                disabled={status !== 'playing'}
                                className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
                            >
                                🎯 Adivinar
                            </button>
                        ) : (
                            <button
                                onClick={() => setGuessMode(false)}
                                className="rounded-lg border border-border bg-surface-2 px-4 py-2 text-sm transition hover:bg-surface"
                            >
                                Cancelar
                            </button>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                        {board.map((c, i) => {
                            const dead = eliminated.has(c.id);
                            return (
                                <button
                                    key={c.id}
                                    onClick={() => onCardClick(c)}
                                    aria-pressed={dead}
                                    aria-label={`${c.name}${dead ? ' (descartado)' : ''}`}
                                    style={{ animationDelay: `${i * 20}ms` }}
                                    className={`relative aspect-[3/4] animate-flip overflow-hidden rounded-xl border border-border transition ${
                                        dead
                                            ? 'opacity-30 grayscale'
                                            : 'hover:-translate-y-0.5 hover:border-brand/60 hover:shadow-lg hover:shadow-brand/10'
                                    } ${guessMode && !dead ? 'ring-2 ring-accent/60 hover:ring-accent' : ''}`}
                                >
                                    <CharacterAvatar character={c} />
                                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-2 text-left text-xs font-semibold text-white sm:text-sm">
                                        {c.name}
                                    </div>
                                    {dead && (
                                        <div className="absolute inset-0 flex items-center justify-center text-4xl animate-pop-in">
                                            ❌
                                        </div>
                                    )}
                                    {guessMode && !dead && (
                                        <div className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-accent text-xs">
                                            🎯
                                        </div>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </section>

                <aside className="space-y-4">
                    <div className="rounded-2xl border border-border bg-surface p-4">
                        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
                            Preguntar
                        </h3>
                        <div className="grid grid-cols-2 gap-1.5">
                            {questionsError && (
                                <div className="col-span-2 text-xs text-red-500">
                                    No se pudieron cargar las preguntas.{' '}
                                    <button onClick={retryQuestions} className="underline hover:opacity-70">
                                        Reintentar
                                    </button>
                                </div>
                            )}
                            {!questionsError && questions.length === 0 && (
                                <div className="col-span-2 text-xs italic text-muted">
                                    Cargando preguntas…
                                </div>
                            )}
                            {questions.map((q) => (
                                <button
                                    key={q.code}
                                    onClick={() => askQuestion(q.code, q.text_es)}
                                    disabled={status !== 'playing'}
                                    className="rounded-lg border border-border bg-surface-2 p-2 text-xs transition hover:border-brand/50 hover:bg-surface disabled:opacity-40"
                                >
                                    {q.text_es}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="rounded-2xl border border-border bg-surface p-4">
                        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
                            Historial
                        </h3>
                        <ul aria-live="polite" className="max-h-72 space-y-1.5 overflow-y-auto text-sm">
                            {logs.length === 0 && (
                                <li className="italic text-muted">Sin preguntas todavía</li>
                            )}
                            {logs.map((l, i) => (
                                <li
                                    key={i}
                                    className="flex justify-between gap-2 rounded-lg bg-surface-2 p-2 animate-pop-in"
                                >
                                    <span>{l.question}</span>
                                    <span className="whitespace-nowrap">{l.answer}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                </aside>
            </div>

            {confirmCard && (
                <Modal
                    title={`Adivinar ${confirmCard.name}`}
                    onClose={() => setConfirmCard(null)}
                    zIndex="z-10"
                >
                    <h3 className="mb-2 text-xl font-bold">¿Adivinar "{confirmCard.name}"?</h3>
                    <p className="mb-4 text-sm text-muted">
                        Si fallas, esta carta se descartará permanentemente.
                    </p>
                    <div className="flex justify-center gap-2">
                        <button
                            onClick={() => setConfirmCard(null)}
                            className="rounded-lg border border-border bg-surface-2 px-4 py-2 transition hover:bg-surface"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={confirmGuess}
                            className="rounded-lg bg-accent px-4 py-2 font-semibold text-white transition hover:opacity-90"
                        >
                            Sí, adivinar
                        </button>
                    </div>
                </Modal>
            )}

            {status === 'won' && secret && (
                <Modal title="¡Acertaste!" onClose={goHome} hideClose zIndex="z-20">
                    <div className="mb-4 text-6xl animate-pop-in">🏆</div>
                    <h3 className="mb-2 text-2xl font-bold">¡Acertaste!</h3>
                    <p className="mb-4 text-muted">
                        Era <strong className="text-fg">{secret.name}</strong>
                    </p>
                    <button
                        onClick={goHome}
                        className="rounded-lg bg-brand-strong px-6 py-2 font-semibold text-white transition hover:opacity-90"
                    >
                        Volver al inicio
                    </button>
                </Modal>
            )}

            {status === 'lost' && (
                <Modal title="Derrota" onClose={goHome} hideClose zIndex="z-20">
                    <div className="mb-4 text-6xl animate-pop-in">💀</div>
                    <h3 className="mb-2 text-2xl font-bold">Derrota</h3>
                    <p className="mb-4 text-muted">
                        {remaining === 0
                            ? 'Has descartado todas las cartas.'
                            : 'Has abandonado la partida.'}
                    </p>
                    <button
                        onClick={goHome}
                        className="rounded-lg bg-brand-strong px-6 py-2 font-semibold text-white transition hover:opacity-90"
                    >
                        Volver al inicio
                    </button>
                </Modal>
            )}
        </main>
    );
}
