import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { connectSocket, socket } from '../lib/socket';
import { useAuth } from '../features/auth/auth-context';
import { api, type CharacterCard, type QuestionDto } from '../services/api';
import { Modal } from '../components/Modal';

interface LogEntry {
    text: string;
    answer: string;
    details?: string;
}

interface ChatMessage {
    userName: string;
    message: string;
    isMe: boolean;
}

interface HintsState {
    used: number;
    left: number;
    history: string[];
    current: string | null;
    max: number;
}

interface ChatRow {
    user_id: string | null;
    user_name: string;
    message: string;
    created_at: string;
}

interface StateResponse {
    success: boolean;
    error?: string;
    status?: string;
    board?: CharacterCard[];
    secret?: CharacterCard | null;
    themeSlug?: string | null;
    isMyTurn?: boolean;
    eliminatedIds?: string[];
    chatHistory?: ChatRow[];
    askedQuestionCodes?: string[];
    hints?: HintsState;
}

interface ActionResponse {
    success: boolean;
    error?: string;
    correct?: boolean;
}

interface HintResponse extends ActionResponse {
    hint?: string;
    hintsUsed?: number;
    hintsLeft?: number;
    hintsHistory?: string[];
    maxHints?: number;
}

const INITIAL_HINTS: HintsState = { used: 0, left: 2, history: [], current: null, max: 2 };

export function MultiplayerGamePage() {
    const { gameId } = useParams<{ gameId: string }>();
    const { user } = useAuth();
    const nav = useNavigate();

    const [board, setBoard] = useState<CharacterCard[]>([]);
    const [secret, setSecret] = useState<CharacterCard | null>(null);
    const [questions, setQuestions] = useState<QuestionDto[]>([]);

    const [isMyTurn, setIsMyTurn] = useState(false);
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [winnerId, setWinnerId] = useState<string | null>(null);
    const [endReason, setEndReason] = useState<string | null>(null);

    const [eliminated, setEliminated] = useState<Set<string>>(new Set());
    const [guessMode, setGuessMode] = useState(false);
    const [confirmCard, setConfirmCard] = useState<CharacterCard | null>(null);

    const [opponentDisconnected, setOpponentDisconnected] = useState(false);
    const [showAbandonConfirm, setShowAbandonConfirm] = useState(false);
    const [askedQuestions, setAskedQuestions] = useState<Set<string>>(new Set());

    const [notice, setNotice] = useState<string | null>(null);

    // Chat
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
    const [chatInput, setChatInput] = useState('');
    const chatEndRef = useRef<HTMLDivElement>(null);

    // IA y comodines
    const [aiQuery, setAiQuery] = useState('');
    const [aiLoading, setAiLoading] = useState(false);
    const [hints, setHints] = useState<HintsState>(INITIAL_HINTS);

    // Auto-scroll del chat
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatMessages]);

    useEffect(() => {
        if (!user || !gameId) return;

        const requestState = () => {
            socket.emit('request_game_state', { gameId }, async (res: StateResponse) => {
                if (!res.success) {
                    setNotice(res.error ?? 'No se pudo cargar la partida');
                    if (res.error === 'La partida ha terminado') nav('/');
                    return;
                }

                setBoard(res.board ?? []);
                setSecret(res.secret ?? null);
                setIsMyTurn(Boolean(res.isMyTurn));
                setOpponentDisconnected(false);
                setEliminated(new Set(res.eliminatedIds ?? []));
                setAskedQuestions(new Set(res.askedQuestionCodes ?? []));
                if (res.hints) setHints(res.hints);

                if (res.chatHistory) {
                    setChatMessages(res.chatHistory.map((msg) => ({
                        userName: msg.user_name,
                        message: msg.message,
                        isMe: msg.user_id === user.id,
                    })));
                }

                if (res.themeSlug) {
                    try {
                        setQuestions(await api.questions(res.themeSlug));
                    } catch {
                        setNotice('No se pudieron cargar las preguntas rápidas.');
                    }
                }
            });
        };

        const onConnect = () => requestState();
        const onConnectError = (err: Error) => setNotice(err.message);
        const onQuestionResult = (data: { questionText: string; answer: string; matchedIds: string[] }) => {
            setLogs((prev) => [...prev, { text: data.questionText, answer: data.answer }]);
            setEliminated((prev) => {
                const next = new Set(prev);
                data.matchedIds.forEach((id) => next.add(id));
                return next;
            });
            setIsMyTurn(false);
        };
        const onOpponentAsked = (data: { askerId: string; questionText: string; answer: string }) => {
            if (data.askerId === user.id) return;
            setLogs((prev) => [...prev, { text: `Rival: ${data.questionText}`, answer: data.answer }]);
            setIsMyTurn(true);
        };
        const onAiResult = (data: { freeText: string; answer: string; matchedIds: string[]; filters: Record<string, string | number | boolean> }) => {
            const filterText = Object.entries(data.filters ?? {})
                .map(([k, v]) => `${k}=${v}`)
                .join(', ');
            setLogs((prev) => [...prev, { text: `✨ IA: ${data.freeText}`, answer: data.answer, details: filterText }]);
            setEliminated((prev) => {
                const next = new Set(prev);
                data.matchedIds.forEach((id) => next.add(id));
                return next;
            });
            setIsMyTurn(false);
        };
        const onOpponentAskedAi = (data: { askerId: string; freeText: string; answer: string }) => {
            if (data.askerId === user.id) return;
            setLogs((prev) => [...prev, { text: `Rival IA: ${data.freeText}`, answer: data.answer }]);
            setIsMyTurn(true);
        };
        const onGameOver = (data: { winnerId: string; reason?: string }) => {
            setWinnerId(data.winnerId);
            setEndReason(data.reason ?? null);
            setConfirmCard(null);
            setGuessMode(false);
            setOpponentDisconnected(false);
        };
        const onWrongGuess = () => {
            setNotice('¡Fallo! Ese no era el personaje secreto.');
            setConfirmCard(null);
            setGuessMode(false);
            setIsMyTurn(false);
        };
        const onOpponentDisconnected = () => setOpponentDisconnected(true);
        const onOpponentReconnected = () => setOpponentDisconnected(false);
        const onReceiveChat = (data: { userId: string; userName: string; message: string }) => {
            setChatMessages((prev) => [...prev, {
                userName: data.userName,
                message: data.message,
                isMe: data.userId === user.id,
            }]);
        };

        connectSocket()
            .then(requestState)
            .catch((err: Error) => setNotice(err.message));

        socket.on('connect', onConnect);
        socket.on('connect_error', onConnectError);
        socket.on('question_result', onQuestionResult);
        socket.on('opponent_asked', onOpponentAsked);
        socket.on('ai_question_result', onAiResult);
        socket.on('opponent_asked_ai', onOpponentAskedAi);
        socket.on('game_over', onGameOver);
        socket.on('wrong_guess', onWrongGuess);
        socket.on('opponent_disconnected', onOpponentDisconnected);
        socket.on('opponent_reconnected', onOpponentReconnected);
        socket.on('receive_chat', onReceiveChat);

        return () => {
            socket.off('connect', onConnect);
            socket.off('connect_error', onConnectError);
            socket.off('question_result', onQuestionResult);
            socket.off('opponent_asked', onOpponentAsked);
            socket.off('ai_question_result', onAiResult);
            socket.off('opponent_asked_ai', onOpponentAskedAi);
            socket.off('game_over', onGameOver);
            socket.off('wrong_guess', onWrongGuess);
            socket.off('opponent_disconnected', onOpponentDisconnected);
            socket.off('opponent_reconnected', onOpponentReconnected);
            socket.off('receive_chat', onReceiveChat);
        };
    }, [user, gameId, nav]);

    const toggleCard = (card: CharacterCard) => {
        if (winnerId) return;
        if (guessMode) {
            setConfirmCard(card);
            return;
        }

        const nextEliminated = !eliminated.has(card.id);
        setEliminated((prev) => {
            const next = new Set(prev);
            if (nextEliminated) next.add(card.id);
            else next.delete(card.id);
            return next;
        });

        socket.emit('toggle_eliminate', {
            gameId,
            characterId: card.id,
            eliminated: nextEliminated,
        }, (res: ActionResponse) => {
            if (!res.success) {
                setNotice(res.error ?? 'No se pudo guardar el descarte');
                setEliminated((prev) => {
                    const next = new Set(prev);
                    if (nextEliminated) next.delete(card.id);
                    else next.add(card.id);
                    return next;
                });
            }
        });
    };

    const askQuestion = (code: string, text: string) => {
        if (!isMyTurn || opponentDisconnected || winnerId) return;
        if (askedQuestions.has(code)) return;

        setIsMyTurn(false);
        socket.emit('ask_question', { gameId, questionCode: code, questionText: text }, (res: ActionResponse) => {
            if (!res.success) {
                setNotice(res.error ?? 'No se pudo hacer la pregunta');
                setIsMyTurn(true);
            } else {
                setAskedQuestions((prev) => new Set(prev).add(code));
            }
        });
    };

    const askAiMultiplayer = (e: React.FormEvent) => {
        e.preventDefault();
        if (!aiQuery.trim() || !isMyTurn || opponentDisconnected || winnerId) return;

        setAiLoading(true);
        setNotice(null);
        socket.emit('ask_ai_question', { gameId, freeText: aiQuery }, (res: ActionResponse) => {
            if (!res.success) setNotice(res.error ?? 'La IA no pudo procesar la pregunta');
            else setAiQuery('');
            setAiLoading(false);
        });
    };

    const askHintMultiplayer = () => {
        if (hints.left <= 0 || winnerId) return;
        socket.emit('ask_hint', { gameId }, (res: HintResponse) => {
            if (res.success && res.hint) {
                setHints({
                    used: res.hintsUsed ?? hints.used + 1,
                    left: res.hintsLeft ?? Math.max(0, hints.left - 1),
                    history: res.hintsHistory ?? [...hints.history, res.hint],
                    current: res.hint,
                    max: res.maxHints ?? hints.max,
                });
            } else {
                setNotice(res.error ?? 'No se pudo obtener la pista');
            }
        });
    };

    const makeGuess = () => {
        if (!confirmCard || opponentDisconnected || winnerId) return;
        socket.emit('make_guess', { gameId, characterId: confirmCard.id }, (res: ActionResponse) => {
            if (!res.success) setNotice(res.error ?? 'No se pudo adivinar');
        });
    };

    const handleAbandon = () => {
        socket.emit('abandon_game', { gameId }, (res: ActionResponse) => {
            if (res.success) nav('/');
            else setNotice(res.error ?? 'No se pudo abandonar la partida');
        });
    };

    const handleSendMessage = (e: React.FormEvent) => {
        e.preventDefault();
        if (!chatInput.trim()) return;

        socket.emit('send_chat', { gameId, message: chatInput.trim() });
        setChatInput('');
    };

    const sendQuickChat = (msg: string) => {
        socket.emit('send_chat', { gameId, message: msg });
    };

    if (!user) return null;

    const gameEnded = Boolean(winnerId);
    const isWinner = winnerId === user.id;

    return (
        <div className="min-h-screen bg-canvas p-4 text-fg sm:p-6">
            <div className="mx-auto max-w-7xl space-y-6">

                {notice && (
                    <div role="alert" className="flex items-center justify-between gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm font-semibold text-amber-700 dark:text-amber-200">
                        <span>{notice}</span>
                        <button onClick={() => setNotice(null)} aria-label="Cerrar aviso" className="hover:opacity-70">✕</button>
                    </div>
                )}

                {opponentDisconnected && !gameEnded && (
                    <div className="animate-pulse rounded-xl border border-amber-500/50 bg-amber-500/10 p-3 text-center font-bold text-amber-700 dark:text-amber-200">
                        ⏳ El rival se ha desconectado. Esperando reconexión…
                    </div>
                )}

                {hints.current && (
                    <div className="flex items-center justify-center gap-4 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-center text-amber-700 dark:text-amber-200">
                        <div>💡 <strong>Pista:</strong> {hints.current}</div>
                        <button onClick={() => setHints((prev) => ({ ...prev, current: null }))} className="text-xs underline hover:opacity-70">
                            Ocultar
                        </button>
                    </div>
                )}

                <div className="flex items-center justify-between rounded-xl border border-border bg-surface p-4">
                    <div>
                        <h1 className="text-xl font-bold">Multijugador</h1>
                        <p className={`text-sm font-bold ${gameEnded ? 'text-muted' :
                            (isMyTurn && !opponentDisconnected ? 'text-emerald-500' : 'text-muted')
                            }`}>
                            {gameEnded ? 'Partida finalizada' :
                                (opponentDisconnected ? '⏸️ Partida en pausa' :
                                    (isMyTurn ? '🟢 Es tu turno' : '⏳ Esperando al rival...'))}
                        </p>
                    </div>

                    <button
                        onClick={() => gameEnded ? nav('/') : setShowAbandonConfirm(true)}
                        className="rounded-lg border border-border bg-surface-2 px-4 py-2 text-sm text-muted transition hover:bg-surface"
                    >
                        {gameEnded ? 'Volver al inicio' : 'Abandonar'}
                    </button>
                </div>

                <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
                    <div>
                        <div className="mb-4 flex gap-2">
                            {!gameEnded && (
                                !guessMode ? (
                                    <>
                                        <button onClick={() => setGuessMode(true)} disabled={!isMyTurn || opponentDisconnected} className="rounded-lg bg-accent px-4 py-2 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-50">🎯 Adivinar</button>
                                        <button onClick={askHintMultiplayer} disabled={hints.left <= 0 || !isMyTurn || opponentDisconnected} className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-amber-500 disabled:opacity-50">💡 Comodín ({hints.left})</button>
                                    </>
                                ) : (
                                    <button onClick={() => setGuessMode(false)} className="rounded-lg border border-border bg-surface-2 px-4 py-2 text-sm transition hover:bg-surface">Cancelar</button>
                                )
                            )}
                        </div>
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                            {board.map((c) => {
                                const dead = eliminated.has(c.id);
                                return (
                                    <button
                                        key={c.id}
                                        onClick={() => toggleCard(c)}
                                        className={`relative aspect-[3/4] overflow-hidden rounded-xl border-2 transition-all ${dead ? 'border-border opacity-30 grayscale' : 'border-border hover:border-brand'
                                            } ${guessMode && !dead ? 'ring-2 ring-accent' : ''} ${gameEnded ? 'cursor-default' : ''}`}
                                    >
                                        {c.image_url ? (
                                            <img src={c.image_url} alt={c.name} loading="lazy" decoding="async" className="h-full w-full object-cover" />
                                        ) : (
                                            <div className="flex h-full w-full items-center justify-center bg-surface-2 text-xl font-bold">{c.name[0]}</div>
                                        )}
                                        <div className="absolute inset-x-0 bottom-0 truncate bg-black/80 p-1 text-[10px] font-bold text-white">{c.name}</div>
                                        {dead && <div className="absolute inset-0 flex items-center justify-center bg-canvas/60 text-3xl">❌</div>}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <aside className="space-y-4">
                        {secret && (
                            <div className="rounded-xl border border-brand/40 bg-brand/10 p-4 text-center">
                                <span className="text-xs uppercase text-muted">Tu secreto</span>
                                <div className="text-xl font-black text-brand">{secret.name}</div>
                            </div>
                        )}

                        <div>
                            <h3 className="mb-2 text-sm uppercase text-muted">Hacer Pregunta</h3>
                            <div className="grid max-h-40 grid-cols-2 gap-1 overflow-y-auto pr-1">
                                {questions.map((q) => {
                                    const alreadyAsked = askedQuestions.has(q.code);
                                    return (
                                        <button
                                            key={q.code}
                                            onClick={() => askQuestion(q.code, q.text_es)}
                                            disabled={!isMyTurn || gameEnded || opponentDisconnected || alreadyAsked}
                                            className={`rounded p-2 text-left text-xs ${alreadyAsked ? 'bg-surface-2 text-muted' : 'bg-surface-2 hover:bg-surface'}`}
                                        >
                                            {q.text_es} {alreadyAsked && '✓'}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div>
                            <h3 className="mb-2 text-sm uppercase text-muted">Historial</h3>
                            <ul className="max-h-32 space-y-2 overflow-y-auto pr-1 text-sm">
                                {logs.map((l, i) => (
                                    <li key={i} className="rounded border border-border bg-surface-2 p-2">
                                        <div className="text-xs text-muted">{l.text}</div>
                                        {l.details && <div className="mt-0.5 text-[10px] text-brand">Filtros: {l.details}</div>}
                                        <div className={`mt-1 text-right text-xs font-bold ${l.answer === 'yes' ? 'text-emerald-500' :
                                            l.answer === 'no' ? 'text-red-500' : 'text-muted'
                                            }`}>
                                            {l.answer === 'yes' ? 'SÍ' : l.answer === 'no' ? 'NO' : 'DESCONOCIDO'}
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {/* PANEL DE IA EN MULTIJUGADOR */}
                        <div className="rounded-xl border border-brand/30 bg-brand/10 p-3">
                            <h3 className="mb-2 text-xs font-bold uppercase text-brand">✨ Preguntar a la IA</h3>
                            <form onSubmit={askAiMultiplayer} className="flex gap-1">
                                <input
                                    type="text"
                                    value={aiQuery}
                                    onChange={e => setAiQuery(e.target.value)}
                                    placeholder="Ej: ¿Es un villano?"
                                    className="flex-1 rounded-lg border border-border bg-canvas px-2 py-1.5 text-xs text-fg focus:border-brand focus:outline-none"
                                    disabled={!isMyTurn || opponentDisconnected || gameEnded}
                                />
                                <button
                                    type="submit"
                                    disabled={!isMyTurn || aiLoading || opponentDisconnected || gameEnded}
                                    className="rounded-lg bg-brand px-3 py-1.5 text-xs font-bold text-white transition hover:opacity-90 disabled:opacity-50"
                                >
                                    {aiLoading ? '...' : 'Enviar'}
                                </button>
                            </form>
                        </div>

                        {/* CHAT */}
                        <div className="flex h-64 flex-col rounded-xl border border-border bg-surface">
                            <div className="border-b border-border bg-surface-2 p-2">
                                <h3 className="text-sm font-bold text-muted">💬 Chat</h3>
                            </div>

                            <div className="flex-1 space-y-2 overflow-y-auto p-2 text-xs">
                                {chatMessages.length === 0 && (
                                    <div className="mt-4 text-center italic text-muted">No hay mensajes aún.</div>
                                )}
                                {chatMessages.map((msg, i) => (
                                    <div key={i} className={`flex flex-col ${msg.isMe ? 'items-end' : 'items-start'}`}>
                                        <span className="mb-0.5 px-1 text-[9px] text-muted">{msg.isMe ? 'Tú' : msg.userName}</span>
                                        <div className={`max-w-[85%] break-words rounded-lg p-2 ${msg.isMe ? 'rounded-tr-none bg-brand text-white' : 'rounded-tl-none bg-surface-2 text-fg'}`}>
                                            {msg.message}
                                        </div>
                                    </div>
                                ))}
                                <div ref={chatEndRef} />
                            </div>

                            <div className="space-y-2 border-t border-border bg-surface-2 p-2">
                                <div className="flex flex-wrap gap-1">
                                    {['GG', 'Buena!', 'Casi...'].map((msg) => (
                                        <button key={msg} onClick={() => sendQuickChat(msg)} className="rounded bg-surface px-2 py-1 text-[10px] text-muted transition hover:text-fg">
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
                                        maxLength={200}
                                        className="flex-1 rounded-lg border border-border bg-canvas px-2 py-1.5 text-xs text-fg focus:border-brand focus:outline-none"
                                    />
                                    <button
                                        type="submit"
                                        disabled={!chatInput.trim()}
                                        className="rounded-lg bg-brand px-3 py-1.5 text-xs font-bold text-white transition hover:opacity-90 disabled:opacity-50"
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
                <Modal title={isWinner ? '¡Victoria!' : 'Derrota'} onClose={() => nav('/')} hideClose zIndex="z-50">
                    <div className="text-center">
                        <div className="mb-6 animate-bounce text-7xl">{isWinner ? '🏆' : '💀'}</div>
                        <h2 className="mb-4 text-3xl font-black tracking-tight">
                            {isWinner ? '¡VICTORIA!' : 'DERROTA'}
                        </h2>
                        <p className="mb-8 text-muted">
                            {endReason === 'abandon' || endReason === 'disconnect'
                                ? (isWinner ? 'Tu rival ha abandonado la partida.' : 'Has abandonado la partida.')
                                : (isWinner ? 'Has adivinado el personaje secreto de tu rival.' : 'Tu rival ha adivinado tu personaje secreto.')}
                        </p>
                        <button
                            onClick={() => nav('/')}
                            className={`w-full rounded-xl py-4 text-lg font-bold transition-opacity hover:opacity-90 ${isWinner ? 'bg-brand text-white' : 'border border-border bg-surface-2 text-fg'}`}
                        >
                            Volver al inicio
                        </button>
                    </div>
                </Modal>
            )}

            {showAbandonConfirm && (
                <Modal title="¿Abandonar partida?" onClose={() => setShowAbandonConfirm(false)} zIndex="z-50">
                    <div className="text-center">
                        <p className="mb-6 text-sm text-muted">Si sales ahora, el rival será declarado ganador.</p>
                        <div className="flex justify-center gap-3">
                            <button onClick={() => setShowAbandonConfirm(false)} className="rounded-lg border border-border bg-surface-2 px-4 py-2 transition hover:bg-surface">Cancelar</button>
                            <button onClick={handleAbandon} className="rounded-lg bg-red-600 px-4 py-2 font-bold text-white transition hover:bg-red-500">Sí, abandonar</button>
                        </div>
                    </div>
                </Modal>
            )}

            {confirmCard && !winnerId && (
                <Modal title={`¿Es ${confirmCard.name}?`} onClose={() => setConfirmCard(null)} zIndex="z-50">
                    <div className="text-center">
                        <p className="mb-6 text-sm text-muted">Si fallas, pierdes el turno.</p>
                        <div className="flex justify-center gap-3">
                            <button onClick={() => setConfirmCard(null)} className="rounded-lg border border-border bg-surface-2 px-4 py-2 transition hover:bg-surface">Cancelar</button>
                            <button onClick={makeGuess} className="rounded-lg bg-accent px-4 py-2 font-bold text-white shadow-lg transition hover:opacity-90">Adivinar</button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
}
