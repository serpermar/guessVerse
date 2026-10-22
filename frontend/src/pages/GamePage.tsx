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
                className="w-full h-full object-cover"
            />
        );
    }
    return (
        <div
            className={`w-full h-full flex items-center justify-center bg-gradient-to-br ${gradientFor(
                character.name
            )}`}
        >
            <span className="text-5xl font-black text-white/90 drop-shadow-lg">
                {initials(character.name)}
            </span>
        </div>
    );
}

export function GamePage() {
    const { themeSlug } = useParams<{ themeSlug: string }>();
    const nav = useNavigate();

    // Suscripción por selector (evita re-render de toda la página)
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

    // Hidratar o crear partida (latch para resistir StrictMode)
    useEffect(() => {
        if (!themeSlug || startedRef.current) return;
        if (useGameStore.getState().status !== 'idle') return;
        startedRef.current = true;
        const restored = hydrate(themeSlug);
        if (!restored) startGame(themeSlug);
    }, [themeSlug, hydrate, startGame]);

    // Cargar preguntas de la temática
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

    if (loading) return <div className="p-8 text-white">Creando partida…</div>;

    if (!gameId) {
        return (
            <div className="min-h-screen bg-slate-950 text-white p-8 text-center">
                <p className="mb-4">No hay ninguna partida activa.</p>
                <button
                    onClick={() => nav('/')}
                    className="bg-purple-500 hover:bg-purple-600 px-6 py-2 rounded-lg font-semibold"
                >
                    Volver al inicio
                </button>
            </div>
        );
    }

    const remaining = board.length - eliminated.size;

    return (
        <div className="min-h-screen bg-slate-950 text-white p-4">
            <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
                <h2 className="text-2xl font-bold">{theme?.name}</h2>
                <div className="flex items-center gap-3 text-sm">
                    <span className="text-slate-400">
                        Quedan <strong className="text-white">{remaining}</strong>
                    </span>
                    <button
                        onClick={() => abandon()}
                        disabled={status !== 'playing'}
                        className="text-slate-400 hover:text-red-400 disabled:opacity-40"
                    >
                        Abandonar
                    </button>
                    <button
                        onClick={() => {
                            reset();
                            nav('/');
                        }}
                        className="text-slate-400 hover:text-white"
                    >
                        ← Salir
                    </button>
                </div>
            </div>

            {error && (
                <div
                    role="alert"
                    className="mb-4 flex items-center justify-between gap-3 bg-red-900/40 border border-red-500/40 text-red-200 text-sm px-4 py-2 rounded-lg"
                >
                    <span>{error}</span>
                    <button
                        onClick={clearError}
                        aria-label="Cerrar aviso"
                        className="text-red-200 hover:text-white"
                    >
                        ✕
                    </button>
                </div>
            )}

            <div className="grid lg:grid-cols-[1fr_300px] gap-4">
                <div>
                    <div className="mb-3 flex items-center justify-between">
                        <div className="text-sm text-slate-400">
                            {guessMode
                                ? 'Selecciona la carta que crees que es el personaje secreto'
                                : 'Clic para descartar/restaurar'}
                        </div>
                        <div className="flex gap-2">
                            {!guessMode ? (
                                <button
                                    onClick={() => setGuessMode(true)}
                                    disabled={status !== 'playing'}
                                    className="bg-pink-600 hover:bg-pink-700 disabled:opacity-40 px-4 py-2 rounded-lg font-semibold text-sm"
                                >
                                    🎯 Adivinar
                                </button>
                            ) : (
                                <button
                                    onClick={() => setGuessMode(false)}
                                    className="bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded-lg text-sm"
                                >
                                    Cancelar
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                        {board.map((c) => {
                            const dead = eliminated.has(c.id);
                            return (
                                <button
                                    key={c.id}
                                    onClick={() => onCardClick(c)}
                                    aria-pressed={dead}
                                    aria-label={`${c.name}${dead ? ' (descartado)' : ''}`}
                                    className={`relative aspect-[3/4] rounded-lg overflow-hidden transition ${dead ? 'opacity-30 grayscale' : 'hover:ring-2 ring-purple-400'
                                        } ${guessMode && !dead
                                            ? 'ring-2 ring-pink-500/60 hover:ring-pink-400'
                                            : ''
                                        }`}
                                >
                                    <CharacterAvatar character={c} />
                                    <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black to-transparent p-2 text-sm font-semibold text-left">
                                        {c.name}
                                    </div>
                                    {dead && (
                                        <div className="absolute inset-0 flex items-center justify-center text-4xl">
                                            ❌
                                        </div>
                                    )}
                                    {guessMode && !dead && (
                                        <div className="absolute top-2 right-2 bg-pink-600 rounded-full w-7 h-7 flex items-center justify-center text-xs">
                                            🎯
                                        </div>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>

                <aside className="space-y-4">
                    <div>
                        <h3 className="text-sm uppercase text-slate-400 mb-2">Preguntar</h3>
                        <div className="grid grid-cols-2 gap-1">
                            {questionsError && (
                                <div className="col-span-2 text-xs text-red-300">
                                    No se pudieron cargar las preguntas.{' '}
                                    <button
                                        onClick={retryQuestions}
                                        className="underline hover:text-white"
                                    >
                                        Reintentar
                                    </button>
                                </div>
                            )}
                            {!questionsError && questions.length === 0 && (
                                <div className="text-xs text-slate-500 italic col-span-2">
                                    Cargando preguntas…
                                </div>
                            )}
                            {questions.map((q) => (
                                <button
                                    key={q.code}
                                    onClick={() => askQuestion(q.code, q.text_es)}
                                    disabled={status !== 'playing'}
                                    className="text-xs bg-slate-800 hover:bg-slate-700 disabled:opacity-40 p-2 rounded"
                                >
                                    {q.text_es}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <h3 className="text-sm uppercase text-slate-400 mb-2">Historial</h3>
                        <ul
                            aria-live="polite"
                            className="text-sm space-y-1 max-h-64 overflow-y-auto"
                        >
                            {logs.length === 0 && (
                                <li className="text-slate-500 italic">Sin preguntas todavía</li>
                            )}
                            {logs.map((l, i) => (
                                <li
                                    key={i}
                                    className="flex justify-between bg-slate-800 p-2 rounded gap-2"
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
                    <h3 className="text-xl font-bold mb-2">
                        ¿Adivinar "{confirmCard.name}"?
                    </h3>
                    <p className="text-slate-400 text-sm mb-4">
                        Si fallas, esta carta se descartará permanentemente.
                    </p>
                    <div className="flex gap-2 justify-center">
                        <button
                            onClick={() => setConfirmCard(null)}
                            className="bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded-lg"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={confirmGuess}
                            className="bg-pink-600 hover:bg-pink-700 px-4 py-2 rounded-lg font-semibold"
                        >
                            Sí, adivinar
                        </button>
                    </div>
                </Modal>
            )}

            {status === 'won' && secret && (
                <Modal
                    title="¡Acertaste!"
                    onClose={() => {
                        reset();
                        nav('/');
                    }}
                    hideClose
                    zIndex="z-20"
                >
                    <div className="text-6xl mb-4">🏆</div>
                    <h3 className="text-2xl font-bold mb-2">¡Acertaste!</h3>
                    <p className="text-slate-300 mb-4">
                        Era <strong>{secret.name}</strong>
                    </p>
                    <button
                        onClick={() => {
                            reset();
                            nav('/');
                        }}
                        className="bg-purple-500 hover:bg-purple-600 px-6 py-2 rounded-lg font-semibold"
                    >
                        Volver al inicio
                    </button>
                </Modal>
            )}

            {status === 'lost' && (
                <Modal
                    title="Derrota"
                    onClose={() => {
                        reset();
                        nav('/');
                    }}
                    hideClose
                    zIndex="z-20"
                >
                    <div className="text-6xl mb-4">💀</div>
                    <h3 className="text-2xl font-bold mb-2">Derrota</h3>
                    <p className="text-slate-300 mb-4">
                        {remaining === 0
                            ? 'Has descartado todas las cartas.'
                            : 'Has abandonado la partida.'}
                    </p>
                    <button
                        onClick={() => {
                            reset();
                            nav('/');
                        }}
                        className="bg-purple-500 hover:bg-purple-600 px-6 py-2 rounded-lg font-semibold"
                    >
                        Volver al inicio
                    </button>
                </Modal>
            )}
        </div>
    );
}
