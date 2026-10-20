import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGameStore } from '../stores/game.store';
import { api, type CharacterCard, type QuestionDto } from '../services/api';

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
    const s = useGameStore();

    const [questions, setQuestions] = useState<QuestionDto[]>([]);
    const [guessMode, setGuessMode] = useState(false);
    const [confirmCard, setConfirmCard] = useState<CharacterCard | null>(null);

    // Hidratar o crear partida
    useEffect(() => {
        if (s.status !== 'idle') return;
        const restored = s.hydrate();
        if (!restored && themeSlug) s.startGame(themeSlug);
    }, [themeSlug, s.status]);

    // Cargar preguntas de la temática
    useEffect(() => {
        if (!themeSlug) return;
        api
            .questions(themeSlug)
            .then(setQuestions)
            .catch(() => setQuestions([]));
    }, [themeSlug]);

    const onCardClick = (card: CharacterCard) => {
        if (s.status !== 'playing') return;
        if (guessMode) setConfirmCard(card);
        else s.toggleEliminate(card.id);
    };

    const confirmGuess = async () => {
        if (!confirmCard) return;
        const card = confirmCard;
        setConfirmCard(null);
        setGuessMode(false);
        await s.makeGuess(card.id);
    };

    if (s.loading) return <div className="p-8 text-white">Creando partida…</div>;
    if (s.error) return <div className="p-8 text-red-400">{s.error}</div>;
    if (!s.gameId) return null;

    const remaining = s.board.length - s.eliminated.size;

    return (
        <div className="min-h-screen bg-slate-950 text-white p-4">
            <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
                <h2 className="text-2xl font-bold">{s.theme?.name}</h2>
                <div className="flex items-center gap-3 text-sm">
                    <span className="text-slate-400">
                        Quedan <strong className="text-white">{remaining}</strong>
                    </span>
                    <button
                        onClick={() => s.abandon()}
                        className="text-slate-400 hover:text-red-400"
                    >
                        Abandonar
                    </button>
                    <button
                        onClick={() => {
                            s.reset();
                            nav('/');
                        }}
                        className="text-slate-400 hover:text-white"
                    >
                        ← Salir
                    </button>
                </div>
            </div>

            <div className="grid lg:grid-cols-[1fr_300px] gap-4">
                <div>
                    <div className="mb-3 flex items-center justify-between">
                        <div className="text-sm text-slate-400">
                            {guessMode
                                ? '👆 Selecciona la carta que crees que es el personaje secreto'
                                : '👆 Clic para descartar/restaurar'}
                        </div>
                        <div className="flex gap-2">
                            {!guessMode ? (
                                <button
                                    onClick={() => setGuessMode(true)}
                                    disabled={s.status !== 'playing'}
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
                        {s.board.map((c) => {
                            const dead = s.eliminated.has(c.id);
                            return (
                                <button
                                    key={c.id}
                                    onClick={() => onCardClick(c)}
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
                            {questions.length === 0 && (
                                <div className="text-xs text-slate-500 italic col-span-2">
                                    Cargando preguntas…
                                </div>
                            )}
                            {questions.map((q) => (
                                <button
                                    key={q.code}
                                    onClick={() => s.askQuestion(q.code, q.text_es)}
                                    disabled={s.status !== 'playing'}
                                    className="text-xs bg-slate-800 hover:bg-slate-700 disabled:opacity-40 p-2 rounded"
                                >
                                    {q.text_es}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <h3 className="text-sm uppercase text-slate-400 mb-2">Historial</h3>
                        <ul className="text-sm space-y-1 max-h-64 overflow-y-auto">
                            {s.logs.length === 0 && (
                                <li className="text-slate-500 italic">Sin preguntas todavía</li>
                            )}
                            {s.logs.map((l, i) => (
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

            {/* Modal confirmar adivinación */}
            {confirmCard && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-10">
                    <div className="bg-slate-800 rounded-2xl p-6 max-w-sm w-full text-center">
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
                    </div>
                </div>
            )}

            {/* Modal victoria */}
            {s.status === 'won' && s.secret && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-20">
                    <div className="bg-slate-800 rounded-2xl p-8 text-center max-w-sm">
                        <div className="text-6xl mb-4">🏆</div>
                        <h3 className="text-2xl font-bold mb-2">¡Acertaste!</h3>
                        <p className="text-slate-300 mb-4">
                            Era <strong>{s.secret.name}</strong>
                        </p>
                        <button
                            onClick={() => {
                                s.reset();
                                nav('/');
                            }}
                            className="bg-purple-500 hover:bg-purple-600 px-6 py-2 rounded-lg font-semibold"
                        >
                            Volver al inicio
                        </button>
                    </div>
                </div>
            )}

            {/* Modal derrota */}
            {s.status === 'lost' && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-20">
                    <div className="bg-slate-800 rounded-2xl p-8 text-center max-w-sm">
                        <div className="text-6xl mb-4">💀</div>
                        <h3 className="text-2xl font-bold mb-2">Derrota</h3>
                        <p className="text-slate-300 mb-4">
                            {remaining === 0
                                ? 'Has descartado todas las cartas.'
                                : 'Has abandonado la partida.'}
                        </p>
                        <div className="flex gap-2 justify-center">
                            <button
                                onClick={() => {
                                    s.reset();
                                    nav('/');
                                }}
                                className="bg-purple-500 hover:bg-purple-600 px-6 py-2 rounded-lg font-semibold"
                            >
                                Volver al inicio
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}