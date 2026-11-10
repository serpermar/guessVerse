import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { connectSocket, socket } from '../lib/socket';
import { useAuth } from '../features/auth/auth-context';
import { api, type Theme } from '../services/api';

interface RoomResponse {
    success: boolean;
    roomCode?: string;
    gameId?: string;
    error?: string;
}

export function LobbyPage() {
    const { user } = useAuth();
    const nav = useNavigate();

    const [themes, setThemes] = useState<Theme[]>([]);
    const [selectedTheme, setSelectedTheme] = useState('');

    const [roomCode, setRoomCode] = useState('');
    const [createdCode, setCreatedCode] = useState<string | null>(null);
    const [waiting, setWaiting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [isConnected, setIsConnected] = useState(socket.connected);

    useEffect(() => {
        api.themes().then(setThemes).catch(() => setError('No se pudieron cargar las temáticas.'));
        connectSocket().catch((err: Error) => setError(err.message));

        const onConnect = () => setIsConnected(true);
        const onDisconnect = () => setIsConnected(false);
        const onConnectError = (err: Error) => {
            setIsConnected(false);
            setError(err.message);
        };
        const onPlayerJoined = (data: { gameId: string }) => {
            setWaiting(false);
            nav(`/multiplayer/${data.gameId}`);
        };

        socket.on('connect', onConnect);
        socket.on('disconnect', onDisconnect);
        socket.on('connect_error', onConnectError);
        socket.on('player_joined', onPlayerJoined);

        return () => {
            socket.off('connect', onConnect);
            socket.off('disconnect', onDisconnect);
            socket.off('connect_error', onConnectError);
            socket.off('player_joined', onPlayerJoined);
            socket.disconnect();
        };
    }, [nav]);

    const handleCreateRoom = () => {
        if (!selectedTheme) return setError('Por favor, selecciona una temática.');
        if (!user) return setError('Debes iniciar sesión para jugar.');

        setError(null);
        setWaiting(true); // Bloquea el botón mientras se procesa

        socket.emit('create_room', { themeSlug: selectedTheme }, (res: RoomResponse) => {
            if (res.success) {
                setCreatedCode(res.roomCode ?? null);
                // waiting se queda true
            } else {
                setError(res.error ?? 'No se pudo crear la sala');
                setWaiting(false); // Desbloquea si hay error
            }
        });
    };

    const handleJoinRoom = () => {
        if (!roomCode.trim()) return setError('Introduce un código de sala.');
        if (!user) return setError('Debes iniciar sesión para jugar.');

        setError(null);
        socket.emit('join_room', { roomCode }, (res: RoomResponse) => {
            if (res.success && res.gameId) {
                nav(`/multiplayer/${res.gameId}`);
            } else {
                setError(res.error ?? 'No se pudo entrar en la sala');
            }
        });
    };

    return (
        <div className="min-h-screen bg-canvas p-4 text-fg">
            {/* Indicador de conexión */}
            <div className="mx-auto mb-4 flex max-w-4xl justify-end">
                <span className={`flex items-center gap-2 rounded-full px-2 py-1 text-xs ${isConnected ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                    <span className={`h-2 w-2 rounded-full ${isConnected ? 'animate-pulse bg-emerald-500' : 'bg-red-500'}`}></span>
                    {isConnected ? 'Conectado al servidor' : 'Desconectado'}
                </span>
            </div>

            <div className="mx-auto grid w-full max-w-4xl gap-8 md:grid-cols-2">

                {/* Crear Sala */}
                <div className="relative rounded-2xl border border-border bg-surface p-8 shadow-xl">
                    <h2 className="mb-6 text-2xl font-bold text-brand">Crear Partida</h2>
                    <label className="mb-2 block text-sm font-medium text-muted">Temática</label>
                    <select
                        value={selectedTheme}
                        onChange={(e) => setSelectedTheme(e.target.value)}
                        disabled={waiting}
                        className="mb-4 w-full rounded-lg border border-border bg-surface-2 p-3 text-fg disabled:opacity-50"
                    >
                        <option value="">Selecciona una...</option>
                        {themes.map(t => <option key={t.id} value={t.slug}>{t.name}</option>)}
                    </select>

                    <button
                        onClick={handleCreateRoom}
                        disabled={waiting || !isConnected}
                        className="w-full rounded-lg bg-accent py-3 font-bold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {waiting ? 'Generando sala...' : 'Crear Sala'}
                    </button>

                    {createdCode && (
                        <div className="mt-6 rounded-xl border border-accent/30 bg-canvas p-4 text-center">
                            <p className="mb-2 text-sm text-muted">Comparte este código:</p>
                            <p className="text-4xl font-black tracking-widest text-fg">{createdCode}</p>
                            <p className="mt-4 animate-pulse text-sm text-emerald-500">Esperando a que se una alguien...</p>
                        </div>
                    )}
                </div>

                {/* Unirse a Sala */}
                <div className="rounded-2xl border border-border bg-surface p-8 shadow-xl">
                    <h2 className="mb-6 text-2xl font-bold text-brand">Unirse a Partida</h2>
                    <label className="mb-2 block text-sm font-medium text-muted">Código de Sala</label>
                    <input
                        type="text"
                        value={roomCode}
                        onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                        placeholder="Ej: XK7P2"
                        maxLength={5}
                        className="mb-4 w-full rounded-lg border border-border bg-surface-2 p-3 text-center text-2xl font-bold uppercase tracking-widest text-fg"
                    />
                    <button
                        onClick={handleJoinRoom}
                        disabled={!isConnected}
                        className="w-full rounded-lg bg-brand py-3 font-bold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        Entrar
                    </button>
                </div>

                {error && (
                    <div role="alert" className="col-span-2 rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-center font-bold text-red-500">
                        ⚠️ {error}
                    </div>
                )}
            </div>
        </div>
    );
}