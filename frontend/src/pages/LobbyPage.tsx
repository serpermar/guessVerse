import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { socket } from '../lib/socket';
import { useAuth } from '../features/auth/AuthProvider';
import { api, type Theme } from '../services/api';

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
        api.themes().then(setThemes);
        socket.connect();

        socket.on('connect', () => setIsConnected(true));
        socket.on('disconnect', () => setIsConnected(false));

        socket.on('player_joined', (data: { gameId: string }) => {
            setWaiting(false);
            nav(`/multiplayer/${data.gameId}`);
        });

        return () => {
            socket.off('connect');
            socket.off('disconnect');
            socket.off('player_joined');
            socket.disconnect();
        };
    }, [nav]);

    const handleCreateRoom = () => {
        if (!selectedTheme) return setError('Por favor, selecciona una temática.');
        if (!user) return setError('Debes iniciar sesión para jugar.');

        setError(null);
        setWaiting(true); // Bloquea el botón mientras se procesa

        socket.emit('create_room', { themeSlug: selectedTheme, userId: user.id }, (res: any) => {
            if (res.success) {
                setCreatedCode(res.roomCode);
                // waiting se queda true
            } else {
                setError(res.error);
                setWaiting(false); // Desbloquea si hay error
            }
        });
    };

    const handleJoinRoom = () => {
        if (!roomCode.trim()) return setError('Introduce un código de sala.');
        if (!user) return setError('Debes iniciar sesión para jugar.');

        setError(null);
        socket.emit('join_room', { roomCode, userId: user.id }, (res: any) => {
            if (res.success) {
                nav(`/multiplayer/${res.gameId}`);
            } else {
                setError(res.error);
            }
        });
    };

    return (
        <div className="min-h-screen bg-slate-950 text-white p-4">
            {/* Indicador de conexión */}
            <div className="max-w-4xl mx-auto mb-4 flex justify-end">
                <span className={`text-xs px-2 py-1 rounded-full flex items-center gap-2 ${isConnected ? 'bg-emerald-900/50 text-emerald-400' : 'bg-red-900/50 text-red-400'}`}>
                    <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`}></span>
                    {isConnected ? 'Conectado al servidor' : 'Desconectado'}
                </span>
            </div>

            <div className="max-w-4xl mx-auto w-full grid md:grid-cols-2 gap-8">

                {/* Crear Sala */}
                <div className="bg-slate-900 p-8 rounded-2xl border border-slate-800 shadow-xl relative">
                    <h2 className="text-2xl font-bold mb-6 text-purple-400">Crear Partida</h2>
                    <label className="block text-sm font-medium text-slate-400 mb-2">Temática</label>
                    <select
                        value={selectedTheme}
                        onChange={(e) => setSelectedTheme(e.target.value)}
                        disabled={waiting}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 mb-4 disabled:opacity-50"
                    >
                        <option value="">Selecciona una...</option>
                        {themes.map(t => <option key={t.id} value={t.slug}>{t.name}</option>)}
                    </select>

                    <button
                        onClick={handleCreateRoom}
                        disabled={waiting || !isConnected}
                        className="w-full bg-pink-600 hover:bg-pink-500 py-3 rounded-lg font-bold disabled:opacity-50 disabled:cursor-not-allowed transition"
                    >
                        {waiting ? 'Generando sala...' : 'Crear Sala'}
                    </button>

                    {createdCode && (
                        <div className="mt-6 text-center bg-slate-950 p-4 rounded-xl border border-purple-500/30">
                            <p className="text-sm text-slate-400 mb-2">Comparte este código:</p>
                            <p className="text-4xl font-black tracking-widest text-white">{createdCode}</p>
                            <p className="mt-4 text-sm text-emerald-400 animate-pulse">Esperando a que se una alguien...</p>
                        </div>
                    )}
                </div>

                {/* Unirse a Sala */}
                <div className="bg-slate-900 p-8 rounded-2xl border border-slate-800 shadow-xl">
                    <h2 className="text-2xl font-bold mb-6 text-blue-400">Unirse a Partida</h2>
                    <label className="block text-sm font-medium text-slate-400 mb-2">Código de Sala</label>
                    <input
                        type="text"
                        value={roomCode}
                        onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                        placeholder="Ej: XK7P2"
                        maxLength={5}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 mb-4 text-center text-2xl tracking-widest uppercase font-bold"
                    />
                    <button
                        onClick={handleJoinRoom}
                        disabled={!isConnected}
                        className="w-full bg-blue-600 hover:bg-blue-500 py-3 rounded-lg font-bold disabled:opacity-50 disabled:cursor-not-allowed transition"
                    >
                        Entrar
                    </button>
                </div>

                {error && (
                    <div className="col-span-2 text-center text-red-400 font-bold bg-red-900/20 p-4 rounded-lg border border-red-800/50">
                        ⚠️ {error}
                    </div>
                )}
            </div>
        </div>
    );
}