import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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

    const [opponentDisconnected, setOpponentDisconnected] = useState(false);
    const [showAbandonConfirm, setShowAbandonConfirm] = useState(false);
    const [askedQuestions, setAskedQuestions] = useState<Set<string>>(new Set());

    // Estados para el chat
    const [chatMessages, setChatMessages] = useState<{ userName: string, message: string, isMe: boolean }[]>([]);
    const [chatInput, setChatInput] = useState('');
    const chatEndRef = useRef<HTMLDivElement>(null);

    // Auto-scroll al último mensaje del chat
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatMessages]);

    useEffect(() => {
        if (!user || !gameId) return;

        socket.connect();

        const fetchState = () => {
            socket.emit('request_game_state', { gameId, userId: user.id }, async (res: any) => {
                if (res.success) {
                    setBoard(res.board);
                    setSecret(res.secret);
                    setIsMyTurn(res.isMyTurn);
                    setOpponentDisconnected(false);
                    if (res.eliminatedIds) setEliminated(new Set(res.eliminatedIds));

                    // Cargar historial de chat si existe
                    if (res.chatHistory) {
                        setChatMessages(res.chatHistory.map((msg: any) => ({
                            userName: msg.user_name,
                            message: msg.message,
                            isMe: msg.user_id === user.id
                        })));
                    }

                    if (res.themeSlug) {
                        const qs = await api.questions(res.themeSlug);
                        setQuestions(qs);
                    }
                } else {
                    nav('/');
                }
            });
        };

        fetchState();

        socket.on('connect', () => fetchState());

        socket.on('question_result', (data: { questionText: string, answer: string, matchedIds: string[] }) => {
            setLogs(prev => [...prev, { text: data.questionText, answer: data.answer }]);
            setEliminated(prev => {
                const newSet = new Set(prev);
                data.matchedIds.forEach(id => newSet.add(id));
                return newSet;
            });
            setIsMyTurn(false);
        });

        socket.on('opponent_asked', (data: { askerId: string, questionText: string, answer: string }) => {
            if (data.askerId === user.id) return;
            setLogs(prev => [...prev, { text: `Rival: ${data.questionText}`, answer: data.answer }]);
            setIsMyTurn(true);
        });

        socket.on('game_over', (data: { winnerId: string }) => {
            setWinnerId(data.winnerId);
            setConfirmCard(null);
            setGuessMode(false);
            setOpponentDisconnected(false);
        });

        socket.on('wrong_guess', () => {
            alert("¡Fallo! Ese no era el personaje secreto.");
            setConfirmCard(null);
            setGuessMode(false);
            setIsMyTurn(false);
        });

        socket.on('opponent_disconnected', () => setOpponentDisconnected(true));
        socket.on('opponent_reconnected', () => setOpponentDisconnected(false));

        socket.on('receive_chat', (data: { userId: string, userName: string, message: string }) => {
            setChatMessages(prev => [...prev, {
                userName: data.userName,
                message: data.message,
                isMe: data.userId === user.id
            }]);
        });

        return () => {
            socket.off('connect');
            socket.off('question_result');
            socket.off('opponent_asked');
            socket.off('game_over');
            socket.off('wrong_guess');
            socket.off('opponent_disconnected');
            socket.off('opponent_reconnected');
            socket.off('receive_chat');
        };
    }, [user, gameId, nav]);

    const askQuestion = (code: string, text: string) => {
        if (!isMyTurn || opponentDisconnected || winnerId) return;
        if (askedQuestions.has(code)) return;

        setIsMyTurn(false);
        socket.emit('ask_question', { gameId, userId: user?.id, questionCode: code, questionText: text }, (res: any) => {
            if (!res.success) {
                alert(res.error);
                setIsMyTurn(true);
            } else {
                setAskedQuestions(prev => new Set(prev).add(code));
            }
        });
    };

    const makeGuess = () => {
        if (!confirmCard || opponentDisconnected || winnerId) return;
        socket.emit('make_guess', { gameId, userId: user?.id, characterId: confirmCard.id }, (res: any) => {
            if (!res.success) alert(res.error);
        });
    };

    const handleAbandon = () => {
        socket.emit('abandon_game', { gameId, userId: user?.id });
        nav('/');
    };

    const handleSendMessage = (e: React.FormEvent) => {
        e.preventDefault();
        if (!chatInput.trim() || !user) return;

        socket.emit('send_chat', {
            gameId,
            userId: user.id,
            userName: user.email?.split('@')[0] || 'Jugador',
            message: chatInput.trim()
        });
        setChatInput('');
    };

    const sendQuickChat = (msg: string) => {
        if (!user) return;
        socket.emit('send_chat', {
            gameId,
            userId: user.id,
            userName: user.email?.split('@')[0] || 'Jugador',
            message: msg
        });
    };

    if (!user) return null;

    return (
        <div className="min-h-screen bg-slate-950 text-white p-4 sm:p-6">
            <div className="max-w-7xl mx-auto space-y-6">

                {opponentDisconnected && !winnerId && (
                    <div className="bg-yellow-900/80 border border-yellow-500 text-yellow-100 p-3 rounded-xl text-center font-bold animate-pulse">
                        ⏳ El rival se ha desconectado. Esperando reconexión (30s)...
                    </div>
                )}

                <div className="flex items-center justify-between bg-slate-900 p-4 rounded-xl border border-slate-800">
                    <div>
                        <h1 className="text-xl font-bold">Multijugador</h1>
                        <p className={`text-sm font-bold ${winnerId ? 'text-slate-400' :
                            (isMyTurn && !opponentDisconnected ? 'text-emerald-400' : 'text-slate-500')
                            }`}>
                            {winnerId ? 'Partida finalizada' :
                                (opponentDisconnected ? '⏸️ Partida en pausa' :
                                    (isMyTurn ? '🟢 Es tu turno' : '⏳ Esperando al rival...'))}
                        </p>
                    </div>

                    <button
                        onClick={() => winnerId ? nav('/') : setShowAbandonConfirm(true)}
                        className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-lg text-sm transition"
                    >
                        {winnerId ? 'Volver al inicio' : 'Abandonar'}
                    </button>
                </div>

                <div className="grid lg:grid-cols-[1fr_320px] gap-6">
                    <div>
                        <div className="mb-4 flex gap-2">
                            {!winnerId && (
                                !guessMode ? (
                                    <button onClick={() => setGuessMode(true)} disabled={!isMyTurn || opponentDisconnected} className="bg-pink-600 hover:bg-pink-500 disabled:opacity-50 px-4 py-2 rounded-lg font-bold text-sm">🎯 Adivinar</button>
                                ) : (
                                    <button onClick={() => setGuessMode(false)} className="bg-slate-700 px-4 py-2 rounded-lg text-sm">Cancelar</button>
                                )
                            )}
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                            {board.map((c) => {
                                const dead = eliminated.has(c.id);
                                return (
                                    <button
                                        key={c.id}
                                        onClick={() => {
                                            if (winnerId) return;
                                            if (guessMode) setConfirmCard(c);
                                            else {
                                                const newSet = new Set(eliminated);
                                                if (newSet.has(c.id)) newSet.delete(c.id);
                                                else newSet.add(c.id);
                                                setEliminated(newSet);
                                            }
                                        }}
                                        className={`relative aspect-[3/4] rounded-xl overflow-hidden transition-all border-2 ${dead ? 'opacity-30 grayscale border-slate-800' : 'border-slate-700 hover:border-purple-500'
                                            } ${guessMode && !dead ? 'ring-2 ring-pink-500' : ''} ${winnerId ? 'cursor-default' : ''}`}
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

                    <aside className="space-y-4">
                        {secret && (
                            <div className="bg-purple-900/30 border border-purple-500/50 p-4 rounded-xl text-center">
                                <span className="text-xs text-slate-400 uppercase">Tu secreto</span>
                                <div className="text-xl font-black text-purple-300">{secret.name}</div>
                            </div>
                        )}

                        <div>
                            <h3 className="text-sm uppercase text-slate-400 mb-2">Hacer Pregunta</h3>
                            <div className="grid grid-cols-2 gap-1 max-h-40 overflow-y-auto pr-1">
                                {questions.map((q) => {
                                    const alreadyAsked = askedQuestions.has(q.code);
                                    return (
                                        <button
                                            key={q.code}
                                            onClick={() => askQuestion(q.code, q.text_es)}
                                            disabled={!isMyTurn || !!winnerId || opponentDisconnected || alreadyAsked}
                                            className={`text-xs p-2 rounded text-left ${alreadyAsked ? 'bg-slate-900 text-slate-600' : 'bg-slate-800 hover:bg-slate-700'}`}
                                        >
                                            {q.text_es} {alreadyAsked && '✓'}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div>
                            <h3 className="text-sm uppercase text-slate-400 mb-2">Historial</h3>
                            <ul className="text-sm space-y-2 max-h-32 overflow-y-auto pr-1">
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

                        <div className="bg-slate-900 rounded-xl border border-slate-800 flex flex-col h-64">
                            <div className="p-3 border-b border-slate-800 bg-slate-900/50">
                                <h3 className="text-sm font-bold text-slate-300">💬 Chat</h3>
                            </div>

                            <div className="flex-1 overflow-y-auto p-3 space-y-2 text-xs">
                                {chatMessages.length === 0 && (
                                    <div className="text-slate-500 italic text-center mt-4">No hay mensajes aún.</div>
                                )}
                                {chatMessages.map((msg, i) => (
                                    <div key={i} className={`flex flex-col ${msg.isMe ? 'items-end' : 'items-start'}`}>
                                        <span className="text-[9px] text-slate-500 mb-0.5 px-1">{msg.isMe ? 'Tú' : msg.userName}</span>
                                        <div className={`p-2 rounded-lg max-w-[85%] break-words ${msg.isMe ? 'bg-purple-600 text-white rounded-tr-none' : 'bg-slate-700 text-slate-200 rounded-tl-none'}`}>
                                            {msg.message}
                                        </div>
                                    </div>
                                ))}
                                <div ref={chatEndRef} />
                            </div>

                            <div className="p-2 border-t border-slate-800 bg-slate-900/50 space-y-2">
                                <div className="flex flex-wrap gap-1">
                                    {['GG', 'Buena!', 'Casi...'].map((msg) => (
                                        <button key={msg} onClick={() => sendQuickChat(msg)} className="bg-slate-800 hover:bg-slate-700 text-[10px] px-2 py-1 rounded text-slate-300 transition">
                                            {msg}
                                        </button>
                                    ))}
                                </div>
                                <form onSubmit={handleSendMessage} className="flex gap-1">
                                    <input
                                        type="text"
                                        value={chatInput}
                                        onChange={(e) => setChatInput(e.target.value)}
                                        placeholder="Escribe un mensaje..."
                                        maxLength={100}
                                        className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white focus:border-purple-500 focus:outline-none"
                                    />
                                    <button
                                        type="submit"
                                        disabled={!chatInput.trim()}
                                        className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 px-3 py-1.5 rounded-lg text-xs font-bold transition"
                                    >
                                        Enviar
                                    </button>
                                </form>
                            </div>
                        </div>
                    </aside>
                </div>
            </div>

            {winnerId && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
                    <div className={`w-full max-w-md p-8 rounded-3xl border-2 text-center shadow-2xl transform transition-all animate-pop-in ${winnerId === user.id
                        ? 'bg-gradient-to-br from-emerald-900 to-emerald-950 border-emerald-500/50 shadow-emerald-900/50'
                        : 'bg-gradient-to-br from-red-900 to-red-950 border-red-500/50 shadow-red-900/50'
                        }`}>
                        <div className="text-7xl mb-6 animate-bounce">
                            {winnerId === user.id ? '🏆' : '💀'}
                        </div>
                        <h2 className="text-4xl font-black mb-4 tracking-tight">
                            {winnerId === user.id ? '¡VICTORIA!' : 'DERROTA'}
                        </h2>
                        <p className="text-lg text-white/80 mb-8 font-medium">
                            {winnerId === user.id
                                ? 'Has adivinado el personaje secreto de tu rival.'
                                : 'Tu rival ha adivinado tu personaje secreto.'}
                        </p>
                        <button
                            onClick={() => nav('/')}
                            className={`w-full py-4 rounded-xl font-bold text-lg transition-transform hover:scale-105 ${winnerId === user.id
                                ? 'bg-white text-emerald-900 shadow-lg shadow-black/20'
                                : 'bg-slate-800 text-white border border-slate-700 hover:bg-slate-700'
                                }`}
                        >
                            Volver al inicio
                        </button>
                    </div>
                </div>
            )}

            {showAbandonConfirm && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
                    <div className="bg-slate-900 rounded-2xl p-6 max-w-sm w-full text-center border border-red-900/50 shadow-xl">
                        <h3 className="text-xl font-bold text-red-400 mb-2">¿Abandonar partida?</h3>
                        <p className="text-slate-400 text-sm mb-6">Si sales ahora, el rival será declarado ganador.</p>
                        <div className="flex gap-3 justify-center">
                            <button onClick={() => setShowAbandonConfirm(false)} className="bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded-lg transition">Cancelar</button>
                            <button onClick={handleAbandon} className="bg-red-600 hover:bg-red-500 px-4 py-2 rounded-lg font-bold text-white transition">Sí, abandonar</button>
                        </div>
                    </div>
                </div>
            )}

            {confirmCard && !winnerId && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
                    <div className="bg-slate-900 rounded-2xl p-6 max-w-sm w-full text-center border border-slate-700 shadow-xl">
                        <h3 className="text-xl font-bold mb-2">¿Es {confirmCard.name}?</h3>
                        <p className="text-slate-400 text-sm mb-6">Si fallas, pierdes el turno.</p>
                        <div className="flex gap-3 justify-center">
                            <button onClick={() => setConfirmCard(null)} className="bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded-lg transition">Cancelar</button>
                            <button onClick={makeGuess} className="bg-pink-600 hover:bg-pink-500 px-4 py-2 rounded-lg font-bold shadow-lg shadow-pink-900/30 transition">Adivinar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}