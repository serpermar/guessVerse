import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { socket } from '../lib/socket';
import { useAuth } from '../features/auth/AuthProvider';
import { api, type CharacterCard, type QuestionDto } from '../services/api';

export function MultiplayerGamePage() {
    const { gameId } = useParams<{ gameId: string }>();
    const { user } = useAuth();
    const nav = useNavigate();

    const [board, setBoard] = useState<CharacterCard[]>([]);
    const [secret, setSecret] = useState<CharacterCard | null>(null);
    const [questions, setQuestions] = useState<QuestionDto[]>([]);

    const [isMyTurn, setIsMyTurn] = useState(false);
    const [logs, setLogs] = useState<{ text: string, answer: string }[]>([]);
    const [winnerId, setWinnerId] = useState<string | null>(null);

    const [eliminated, setEliminated] = useState<Set<string>>(new Set());
    const [guessMode, setGuessMode] = useState(false);
    const [confirmCard, setConfirmCard] = useState<CharacterCard | null>(null);

    useEffect(() => {
        if (!user || !gameId) return;

        socket.connect();

        // 1. Cargar estado inicial
        socket.emit('request_game_state', { gameId, userId: user.id }, async (res: any) => {
            if (res.success) {
                setBoard(res.board);
                setSecret(res.secret);
                setIsMyTurn(res.isMyTurn);
                if (res.eliminatedIds) setEliminated(new Set(res.eliminatedIds));

                if (res.themeSlug) {
                    const qs = await api.questions(res.themeSlug);
                    setQuestions(qs);
                }
            }
        });

        // 2. Escuchar resultados de mis preguntas
        socket.on('question_result', (data: { questionText: string, answer: string, matchedIds: string[] }) => {
            setLogs(prev => [...prev, { text: data.questionText, answer: data.answer }]);

            setEliminated(prev => {
                const newSet = new Set(prev);
                data.matchedIds.forEach(id => newSet.add(id));
                return newSet;
            });

            setIsMyTurn(false); // Ahora es el turno del rival
        });

        // 3. Escuchar cuando el rival pregunta
        socket.on('opponent_asked', (data: { askerId: string, questionText: string, answer: string }) => {
            if (data.askerId === user.id) return;

            setLogs(prev => [...prev, { text: `Rival: ${data.questionText}`, answer: data.answer }]);
            setIsMyTurn(true); // Ahora es mi turno
        });

        // 4. Fin de la partida
        socket.on('game_over', (data: { winnerId: string }) => {
            setWinnerId(data.winnerId);
        });

        // 5. Fallo al adivinar
        socket.on('wrong_guess', () => {
            alert("¡Fallo! Ese no era el personaje secreto.");
            setConfirmCard(null);
            setGuessMode(false);
            setIsMyTurn(false); // Pierdo el turno
        });

        return () => {
            socket.off('question_result');
            socket.off('opponent_asked');
            socket.off('game_over');
            socket.off('wrong_guess');
        };
    }, [user, gameId]);

    const askQuestion = (code: string, text: string) => {
        if (!isMyTurn) return;
        setIsMyTurn(false); // Bloqueo instantáneo visual

        socket.emit('ask_question', { gameId, userId: user?.id, questionCode: code, questionText: text }, (res: any) => {
            if (!res.success) {
                alert(res.error);
                setIsMyTurn(true); // Si falla, recupero el turno
            }
        });
    };

    const makeGuess = () => {
        if (!confirmCard) return;
        socket.emit('make_guess', { gameId, userId: user?.id, characterId: confirmCard.id });
    };

    if (!user) return null;

    return (
        <div className="min-h-screen bg-slate-950 text-white p-4 sm:p-6">
            <div className="max-w-7xl mx-auto space-y-6">

                {/* Header */}
                <div className="flex items-center justify-between bg-slate-900 p-4 rounded-xl border border-slate-800">
                    <div>
                        <h1 className="text-xl font-bold">Multijugador</h1>
                        <p className={`text-sm font-bold ${isMyTurn ? 'text-emerald-400' : 'text-slate-500'}`}>
                            {isMyTurn ? '🟢 Es tu turno' : '⏳ Esperando al rival...'}
                        </p>
                    </div>
                    <Link to="/" className="bg-slate-800 hover:bg-slate-700 px-4 py-2 rounded-lg text-sm">Salir</Link>
                </div>

                {/* Fin de partida */}
                {winnerId && (
                    <div className={`p-6 rounded-xl text-center border-2 ${winnerId === user.id ? 'bg-emerald-900/50 border-emerald-500' : 'bg-red-900/50 border-red-500'}`}>
                        <h2 className="text-3xl font-black mb-2">{winnerId === user.id ? '🏆 ¡Has Ganado!' : '💀 Has Perdido'}</h2>
                        <button onClick={() => nav('/')} className="bg-white text-slate-900 px-6 py-2 rounded-lg font-bold mt-4">Volver al inicio</button>
                    </div>
                )}

                <div className="grid lg:grid-cols-[1fr_320px] gap-6">

                    {/* Tablero */}
                    <div>
                        <div className="mb-4 flex gap-2">
                            {!guessMode ? (
                                <button onClick={() => setGuessMode(true)} disabled={!isMyTurn || !!winnerId} className="bg-pink-600 hover:bg-pink-500 disabled:opacity-50 px-4 py-2 rounded-lg font-bold text-sm">🎯 Adivinar</button>
                            ) : (
                                <button onClick={() => setGuessMode(false)} className="bg-slate-700 px-4 py-2 rounded-lg text-sm">Cancelar</button>
                            )}
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                            {board.map((c) => {
                                const dead = eliminated.has(c.id);
                                return (
                                    <button
                                        key={c.id}
                                        onClick={() => {
                                            if (guessMode) setConfirmCard(c);
                                            else {
                                                const newSet = new Set(eliminated);
                                                if (newSet.has(c.id)) newSet.delete(c.id);
                                                else newSet.add(c.id);
                                                setEliminated(newSet);
                                            }
                                        }}
                                        className={`relative aspect-[3/4] rounded-xl overflow-hidden transition-all border-2 ${dead ? 'opacity-30 grayscale border-slate-800' : 'border-slate-700 hover:border-purple-500'
                                            } ${guessMode && !dead ? 'ring-2 ring-pink-500' : ''}`}
                                    >
                                        {c.image_url ? (
                                            <img src={c.image_url} alt={c.name} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full bg-slate-800 flex items-center justify-center text-xl font-bold">{c.name[0]}</div>
                                        )}
                                        <div className="absolute bottom-0 inset-x-0 bg-black/80 p-1 text-[10px] font-bold truncate">{c.name}</div>
                                        {dead && <div className="absolute inset-0 flex items-center justify-center text-3xl">❌</div>}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Panel Lateral */}
                    <aside className="space-y-4">
                        {secret && (
                            <div className="bg-purple-900/30 border border-purple-500/50 p-4 rounded-xl text-center">
                                <span className="text-xs text-slate-400 uppercase">Tu secreto</span>
                                <div className="text-xl font-black text-purple-300">{secret.name}</div>
                            </div>
                        )}

                        <div>
                            <h3 className="text-sm uppercase text-slate-400 mb-2">Hacer Pregunta</h3>
                            <div className="grid grid-cols-2 gap-1 max-h-60 overflow-y-auto pr-1">
                                {questions.map((q) => (
                                    <button
                                        key={q.code}
                                        onClick={() => askQuestion(q.code, q.text_es)}
                                        disabled={!isMyTurn || !!winnerId}
                                        className="text-xs bg-slate-800 hover:bg-slate-700 disabled:opacity-40 p-2 rounded text-left"
                                    >
                                        {q.text_es}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <h3 className="text-sm uppercase text-slate-400 mb-2">Historial</h3>
                            <ul className="text-sm space-y-2 max-h-64 overflow-y-auto pr-1">
                                {logs.map((l, i) => (
                                    <li key={i} className="bg-slate-800 p-2 rounded border border-slate-700">
                                        <div className="text-slate-300 text-xs">{l.text}</div>
                                        <div className={`font-bold text-right text-xs mt-1 ${l.answer === 'yes' ? 'text-emerald-400' :
                                                l.answer === 'no' ? 'text-red-400' : 'text-slate-500'
                                            }`}>
                                            {l.answer === 'yes' ? 'SÍ' : l.answer === 'no' ? 'NO' : 'DESCONOCIDO'}
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </aside>
                </div>
            </div>

            {/* Modal Confirmar Adivinación */}
            {confirmCard && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
                    <div className="bg-slate-900 rounded-2xl p-6 max-w-sm w-full text-center border border-slate-700">
                        <h3 className="text-xl font-bold mb-2">¿Es {confirmCard.name}?</h3>
                        <p className="text-slate-400 text-sm mb-6">Si fallas, pierdes el turno.</p>
                        <div className="flex gap-3 justify-center">
                            <button onClick={() => setConfirmCard(null)} className="bg-slate-700 px-4 py-2 rounded-lg">Cancelar</button>
                            <button onClick={makeGuess} className="bg-pink-600 hover:bg-pink-500 px-4 py-2 rounded-lg font-bold">Adivinar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}