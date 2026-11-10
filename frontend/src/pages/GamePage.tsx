import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useGameStore } from '../stores/game.store';
import { api, type CharacterCard, type QuestionDto } from '../services/api';
import { Modal } from '../components/Modal';
import { motion, AnimatePresence } from 'framer-motion';
import { playSound } from '../lib/sounds';

const GRADIENTS = [
    'from-purple-600 to-pink-600', 'from-blue-600 to-cyan-500',
    'from-emerald-600 to-teal-500', 'from-orange-600 to-red-600',
    'from-indigo-600 to-purple-600', 'from-rose-600 to-pink-600',
];

function initials(name: string) {
    return name.split(/\s+/).map((w) => w[0] ?? '').join('').slice(0, 2).toUpperCase();
}
function gradientFor(name: string) {
    const h = name.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    return GRADIENTS[h % GRADIENTS.length];
}

function CharacterAvatar({ character }: { character: CharacterCard }) {
    if (character.image_url) {
        return <img src={character.image_url} alt={character.name} loading="lazy" decoding="async" className="h-full w-full object-cover" />;
    }
    return (
        <div className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${gradientFor(character.name)}`}>
            <span className="text-4xl font-black text-white/90 drop-shadow-lg sm:text-5xl">{initials(character.name)}</span>
        </div>
    );
}

export function GamePage() {
    const { themeSlug } = useParams<{ themeSlug: string }>();
    const [searchParams] = useSearchParams();
    const boardSize = Number(searchParams.get('size')) || 16;
    const isTimedMode = searchParams.get('mode') === 'timed';

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
    const timeLeft = useGameStore((s) => s.timeLeft);
    const setTimeLeft = useGameStore((s) => s.setTimeLeft);

    const hydrate = useGameStore((s) => s.hydrate);
    const startGame = useGameStore((s) => s.startGame);
    const toggleEliminate = useGameStore((s) => s.toggleEliminate);
    const askQuestion = useGameStore((s) => s.askQuestion);
    const askAi = useGameStore((s) => s.askAi);
    const makeGuess = useGameStore((s) => s.makeGuess);
    const abandon = useGameStore((s) => s.abandon);
    const clearError = useGameStore((s) => s.clearError);
    const reset = useGameStore((s) => s.reset);

    // --- Comodín (estado global) ---
    const hintsLeft = useGameStore((s) => s.hintsLeft);
    const hintsUsed = useGameStore((s) => s.hintsUsed);
    const hintsHistory = useGameStore((s) => s.hintsHistory);
    const currentHint = useGameStore((s) => s.currentHint);
    const hintLoading = useGameStore((s) => s.hintLoading);
    const hintError = useGameStore((s) => s.hintError);
    const requestHint = useGameStore((s) => s.requestHint);
    const clearHint = useGameStore((s) => s.clearHint);
    const clearHintError = useGameStore((s) => s.clearHintError);
    const syncHints = useGameStore((s) => s.syncHints);

    const [questions, setQuestions] = useState<QuestionDto[]>([]);
    const [questionsError, setQuestionsError] = useState(false);
    const [guessMode, setGuessMode] = useState(false);
    const [confirmCard, setConfirmCard] = useState<CharacterCard | null>(null);
    const [aiQuery, setAiQuery] = useState('');
    const [aiLoading, setAiLoading] = useState(false);
    const [aiError, setAiError] = useState<string | null>(null);
    const [showHintHistory, setShowHintHistory] = useState(false);

    const startedRef = useRef(false);

    useEffect(() => {
        if (!themeSlug || startedRef.current) return;
        if (useGameStore.getState().status !== 'idle') return;
        startedRef.current = true;
        const restored = hydrate(themeSlug);
        if (!restored) {
            startGame(themeSlug, boardSize, isTimedMode ? 60 : undefined);
        }
    }, [themeSlug, hydrate, startGame, boardSize, isTimedMode]);

    // Sincroniza el comodín con el servidor al montar (por si el usuario recarga)
    useEffect(() => {
        if (!gameId) return;
        let cancelled = false;
        api.getGame(gameId)
            .then((data) => {
                if (cancelled || !data.hints) return;
                syncHints(data.hints);
            })
            .catch(() => { /* silencioso: el usuario sigue viendo el estado local */ });
        return () => { cancelled = true; };
    }, [gameId, syncHints]);

    // Temporizador
    useEffect(() => {
        if (status !== 'playing' || timeLeft === null) return;

        if (timeLeft <= 0) {
            playSound('lose');
            void abandon();
            return;
        }

        const timer = setInterval(() => {
            setTimeLeft(timeLeft - 1);
        }, 1000);

        return () => clearInterval(timer);
    }, [status, timeLeft, setTimeLeft, abandon]);

    const loadQuestions = useCallback(() => {
        if (!themeSlug) return () => undefined;
        let cancelled = false;
        api.questions(themeSlug).then((q) => {
            if (!cancelled) { setQuestions(q); setQuestionsError(false); }
        }).catch(() => { if (!cancelled) setQuestionsError(true); });
        return () => { cancelled = true; };
    }, [themeSlug]);

    useEffect(() => { return loadQuestions(); }, [loadQuestions]);

    const onCardClick = (card: CharacterCard) => {
        if (status !== 'playing') return;
        playSound('flip');
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

    const askAiQuestion = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!aiQuery.trim() || !gameId || status !== 'playing') return;

        setAiLoading(true);
        setAiError(null);
        try {
            const result = await askAi(aiQuery);
            if (result.ok) {
                setAiQuery('');
            } else {
                setAiError(result.message ?? 'No se pudo procesar la pregunta.');
            }
        } finally {
            setAiLoading(false);
        }
    };

    const goHome = () => { reset(); nav('/'); };

    if (loading) return <p className="p-8 text-center text-muted">Creando partida…</p>;
    if (!gameId) return (
        <div className="mx-auto max-w-md px-4 py-16 text-center">
            <p className="mb-4 text-muted">No hay ninguna partida activa.</p>
            <button onClick={() => nav('/')} className="rounded-lg bg-brand-strong px-6 py-2 font-semibold text-white transition hover:opacity-90">Volver al inicio</button>
        </div>
    );

    const remaining = board.length - eliminated.size;
    const outOfHints = hintsLeft <= 0;

    return (
        <main className="mx-auto max-w-6xl animate-fade-in px-4 py-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-2xl font-bold">{theme?.name}</h2>
                <div className="flex items-center gap-3 text-sm">
                    {timeLeft !== null && (
                        <span className={`rounded-full border px-3 py-1 font-bold flex items-center gap-1 ${timeLeft <= 10 ? 'bg-red-500/20 text-red-500 border-red-500/50 animate-pulse' : 'bg-surface-2 text-muted border-border'}`}>
                            ⏱️ {timeLeft}s
                        </span>
                    )}
                    <span className="rounded-full border border-border bg-surface px-3 py-1 text-muted">Quedan <strong className="text-fg">{remaining}</strong></span>
                    <button onClick={() => { playSound('lose'); void abandon(); }} disabled={status !== 'playing'} className="text-muted transition hover:text-red-500 disabled:opacity-40">Abandonar</button>
                    <button onClick={goHome} className="text-muted transition hover:text-fg">← Salir</button>
                </div>
            </div>

            {error && (
                <div role="alert" className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-500">
                    <span>{error}</span>
                    <button onClick={clearError} aria-label="Cerrar aviso" className="hover:opacity-70">✕</button>
                </div>
            )}

            {hintError && (
                <div role="alert" className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm text-amber-300">
                    <span>{hintError}</span>
                    <button onClick={clearHintError} aria-label="Cerrar aviso" className="hover:opacity-70">✕</button>
                </div>
            )}

            {/* Panel de Pista actual */}
            <AnimatePresence>
                {currentHint && (
                    <motion.div
                        key={currentHint}
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        className="mb-4 flex flex-col items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-center text-amber-700 dark:text-amber-200"
                    >
                        <div className="flex items-center gap-3">
                            <span>💡 <strong>Pista:</strong> {currentHint}</span>
                            <button onClick={clearHint} className="text-xs text-amber-600 underline hover:text-amber-800 dark:text-amber-400 dark:hover:text-white">Ocultar</button>
                        </div>
                        {hintsHistory.length > 1 && (
                            <button
                                onClick={() => setShowHintHistory(v => !v)}
                                className="text-[11px] text-amber-600/80 underline hover:text-amber-800 dark:text-amber-300/80 dark:hover:text-amber-200"
                            >
                                {showHintHistory ? 'Ocultar historial' : `Ver historial (${hintsHistory.length})`}
                            </button>
                        )}
                        <AnimatePresence>
                            {showHintHistory && hintsHistory.length > 0 && (
                                <motion.ul
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="w-full max-w-md overflow-hidden text-left"
                                >
                                    {hintsHistory.map((h, i) => (
                                        <li key={`${i}-${h}`} className="mb-1 rounded bg-amber-500/10 px-2 py-1 text-xs text-amber-800 dark:text-amber-100/80">
                                            <span className="mr-2 text-amber-600/70 dark:text-amber-500/70">#{i + 1}</span>{h}
                                        </li>
                                    ))}
                                </motion.ul>
                            )}
                        </AnimatePresence>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
                <section>
                    <div className="mb-3 flex items-center justify-between gap-2">
                        <div className="text-sm text-muted">{guessMode ? 'Selecciona la carta secreta' : 'Clic para descartar/restaurar'}</div>
                        <div className="flex gap-2">
                            <button
                                onClick={requestHint}
                                disabled={outOfHints || hintLoading || status !== 'playing'}
                                title={outOfHints ? 'No te quedan pistas en esta partida' : 'Revelar una pista'}
                                className={`rounded-lg px-4 py-2 text-sm font-semibold text-white transition ${outOfHints || hintLoading || status !== 'playing'
                                    ? 'bg-surface-2 cursor-not-allowed opacity-60'
                                    : 'bg-amber-600 hover:bg-amber-500'
                                    }`}
                            >
                                {hintLoading
                                    ? 'Revelando…'
                                    : outOfHints
                                        ? `💡 Sin pistas (${hintsUsed})`
                                        : `💡 Comodín (${hintsLeft})`}
                            </button>
                            {!guessMode ? (
                                <button onClick={() => setGuessMode(true)} disabled={status !== 'playing'} className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-40">🎯 Adivinar</button>
                            ) : (
                                <button onClick={() => setGuessMode(false)} className="rounded-lg border border-border bg-surface-2 px-4 py-2 text-sm transition hover:bg-surface">Cancelar</button>
                            )}
                        </div>
                    </div>

                    {/* TABLERO */}
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                        <AnimatePresence>
                            {board.map((c, i) => {
                                const dead = eliminated.has(c.id);
                                return (
                                    <motion.button
                                        key={c.id}
                                        initial={{ opacity: 0, scale: 0.8 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.8 }}
                                        transition={{ duration: 0.2, delay: i * 0.02 }}
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                        onClick={() => onCardClick(c)}
                                        className={`relative aspect-[3/4] overflow-hidden rounded-xl border border-border transition ${dead ? 'border-border opacity-30 grayscale' : 'hover:border-brand/60 hover:shadow-lg hover:shadow-brand/10'
                                            } ${guessMode && !dead ? 'ring-2 ring-accent/60' : ''}`}
                                    >
                                        <motion.div
                                            animate={{ rotateY: dead ? 180 : 0 }}
                                            transition={{ duration: 0.4 }}
                                            className="w-full h-full"
                                        >
                                            <CharacterAvatar character={c} />
                                            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-2 text-left text-xs font-semibold text-white sm:text-sm">{c.name}</div>
                                        </motion.div>
                                        {dead && (
                                            <div className="absolute inset-0 flex items-center justify-center bg-canvas/80 text-4xl">❌</div>
                                        )}
                                    </motion.button>
                                );
                            })}
                        </AnimatePresence>
                    </div>
                </section>

                <aside className="space-y-4">
                    {/* IA */}
                    <div className="rounded-2xl border border-brand/40 bg-brand/10 p-4">
                        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-brand">✨ Preguntar a la IA</h3>
                        <form onSubmit={askAiQuestion} className="flex flex-col gap-2">
                            <input
                                type="text"
                                value={aiQuery}
                                onChange={(e) => setAiQuery(e.target.value)}
                                placeholder="Ej: ¿Es un villano que usa magia?"
                                className="w-full rounded-lg border border-border bg-canvas px-3 py-2 text-sm text-fg placeholder-muted focus:border-brand focus:outline-none"
                                disabled={aiLoading || status !== 'playing'}
                            />
                            {aiError && (
                                <p role="alert" className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-xs text-amber-700 dark:text-amber-300">
                                    {aiError}
                                </p>
                            )}
                            <button
                                type="submit"
                                disabled={aiLoading || !aiQuery.trim() || status !== 'playing'}
                                className="flex items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-50"
                            >
                                {aiLoading ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                        Pensando...
                                    </>
                                ) : 'Preguntar'}
                            </button>
                        </form>
                    </div>

                    {/* PREGUNTAS */}
                    <div className="rounded-2xl border border-border bg-surface p-4">
                        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">Preguntas rápidas</h3>
                        <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto pr-1">
                            {questionsError && (
                                <div className="col-span-2 text-xs text-red-500">
                                    No se pudieron cargar las preguntas.{' '}
                                    <button onClick={() => { setQuestionsError(false); loadQuestions(); }} className="underline hover:opacity-70">Reintentar</button>
                                </div>
                            )}
                            {!questionsError && questions.length === 0 && (
                                <div className="col-span-2 text-xs italic text-muted">Cargando preguntas…</div>
                            )}
                            {questions.map((q) => (
                                <button key={q.code} onClick={() => { playSound('click'); askQuestion(q.code, q.text_es); }} disabled={status !== 'playing'} className="rounded-lg border border-border bg-surface-2 p-2 text-xs transition hover:border-brand/50 hover:bg-surface disabled:opacity-40 text-left">{q.text_es}</button>
                            ))}
                        </div>
                    </div>

                    {/* HISTORIAL */}
                    <div className="rounded-2xl border border-border bg-surface p-4">
                        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">Historial</h3>
                        <ul className="max-h-72 space-y-1.5 overflow-y-auto text-sm">
                            {logs.map((l, i) => (
                                <li key={i} className="rounded border border-border bg-surface-2 p-2">
                                    <div className="text-xs text-muted">{l.question}</div>
                                    {l.details && <div className="mt-1 text-[10px] text-brand">Filtros: {l.details}</div>}
                                    <div className={`mt-1 text-right text-xs font-bold ${l.answer === '✅ Sí' ? 'text-emerald-500' : l.answer === '❌ No' ? 'text-red-500' : 'text-muted'}`}>
                                        {l.answer}
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>
                </aside>
            </div>

            {confirmCard && (
                <Modal title={`Adivinar ${confirmCard.name}`} onClose={() => setConfirmCard(null)} zIndex="z-10">
                    <h3 className="mb-2 text-xl font-bold">¿Adivinar "{confirmCard.name}"?</h3>
                    <div className="flex justify-center gap-2">
                        <button onClick={() => setConfirmCard(null)} className="rounded-lg border border-border bg-surface-2 px-4 py-2 transition hover:bg-surface">Cancelar</button>
                        <button onClick={confirmGuess} className="rounded-lg bg-accent px-4 py-2 font-semibold text-white transition hover:opacity-90">Sí, adivinar</button>
                    </div>
                </Modal>
            )}

            {status === 'won' && secret && (
                <Modal title="¡Acertaste!" onClose={goHome} hideClose zIndex="z-20">
                    <div className="mb-4 text-6xl animate-bounce">🏆</div>
                    <h3 className="mb-2 text-2xl font-bold">¡Acertaste!</h3>
                    <p className="mb-4 text-muted">Era <strong className="text-fg">{secret.name}</strong></p>
                    <button onClick={() => { playSound('win'); goHome(); }} className="rounded-lg bg-brand-strong px-6 py-2 font-semibold text-white transition hover:opacity-90">Volver al inicio</button>
                </Modal>
            )}

            {status === 'lost' && (
                <Modal title="Derrota" onClose={goHome} hideClose zIndex="z-20">
                    <div className="mb-4 text-6xl">💀</div>
                    <h3 className="mb-2 text-2xl font-bold">Derrota</h3>
                    {timeLeft === 0 && <p className="text-red-400 mb-4">¡Se acabó el tiempo!</p>}
                    <button onClick={goHome} className="rounded-lg bg-brand-strong px-6 py-2 font-semibold text-white transition hover:opacity-90">Volver al inicio</button>
                </Modal>
            )}
        </main>
    );
}