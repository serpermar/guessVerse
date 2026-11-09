import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type LeaderboardUser } from '../services/api';
import { Spinner } from '../components/ui/Spinner';

export function LeaderboardPage() {
    const [users, setUsers] = useState<LeaderboardUser[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.getLeaderboard()
            .then(setUsers)
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><Spinner size="lg" text="Cargando ranking..." /></div>;

    return (
        <div className="min-h-screen bg-slate-950 text-white p-4 sm:p-6">
            <div className="max-w-3xl mx-auto space-y-6">

                {/* Header */}
                <div className="flex items-center justify-between bg-slate-900 p-6 rounded-2xl border border-slate-800">
                    <div>
                        <h1 className="text-3xl font-black bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">
                            🏆 Clasificación Global
                        </h1>
                        <p className="text-slate-400 mt-1">Los jugadores con más experiencia de GuessVerse.</p>
                    </div>
                    <Link to="/" className="bg-slate-800 hover:bg-slate-700 px-4 py-2 rounded-lg text-sm transition">Volver</Link>
                </div>

                {/* Tabla de Posiciones */}
                <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
                    {users.map((u, i) => (
                        <div key={u.id} className={`flex items-center gap-4 p-4 border-b border-slate-800 last:border-0 ${i < 3 ? 'bg-slate-800/50' : ''}`}>
                            {/* Posición */}
                            <div className={`w-8 h-8 flex items-center justify-center font-black rounded-full ${i === 0 ? 'bg-amber-500 text-amber-950 shadow-lg shadow-amber-500/30' :
                                    i === 1 ? 'bg-slate-300 text-slate-900' :
                                        i === 2 ? 'bg-amber-700 text-amber-100' : 'text-slate-500'
                                }`}>
                                {i + 1}
                            </div>

                            {/* Avatar */}
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center font-bold text-lg">
                                {u.username[0].toUpperCase()}
                            </div>

                            {/* Nombre y Nivel */}
                            <div className="flex-1">
                                <div className="font-bold text-lg">{u.username}</div>
                                <div className="text-xs text-slate-400">Nivel {u.level || 1}</div>
                            </div>

                            {/* XP */}
                            <div className="text-right">
                                <div className="font-black text-purple-400 text-lg">{u.xp || 0} XP</div>
                            </div>
                        </div>
                    ))}
                    {users.length === 0 && (
                        <div className="p-8 text-center text-slate-500">Aún no hay jugadores en el ranking.</div>
                    )}
                </div>

                <p className="text-center text-sm text-slate-500">
                    ¡Juega partidas para ganar XP y escalar posiciones!
                </p>
            </div>
        </div>
    );
}