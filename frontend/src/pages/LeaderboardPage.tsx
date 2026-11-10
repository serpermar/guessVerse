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

    if (loading) return <div className="flex min-h-screen items-center justify-center bg-canvas"><Spinner size="lg" text="Cargando ranking..." /></div>;

    return (
        <div className="min-h-screen bg-canvas p-4 text-fg sm:p-6">
            <div className="mx-auto max-w-3xl space-y-6">

                {/* Header */}
                <div className="flex items-center justify-between rounded-2xl border border-border bg-surface p-6">
                    <div>
                        <h1 className="bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-3xl font-black text-transparent">
                            🏆 Clasificación Global
                        </h1>
                        <p className="mt-1 text-muted">Los jugadores con más experiencia de GuessVerse.</p>
                    </div>
                    <Link to="/" className="rounded-lg bg-surface-2 px-4 py-2 text-sm transition hover:bg-surface">Volver</Link>
                </div>

                {/* Tabla de Posiciones */}
                <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-xl">
                    {users.map((u, i) => (
                        <div key={u.id} className={`flex items-center gap-4 border-b border-border p-4 last:border-0 ${i < 3 ? 'bg-surface-2' : ''}`}>
                            {/* Posición */}
                            <div className={`flex h-8 w-8 items-center justify-center rounded-full font-black ${i === 0 ? 'bg-amber-500 text-amber-950 shadow-lg shadow-amber-500/30' :
                                    i === 1 ? 'bg-slate-300 text-slate-900' :
                                        i === 2 ? 'bg-amber-700 text-amber-100' : 'text-muted'
                                }`}>
                                {i + 1}
                            </div>

                            {/* Avatar */}
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-purple-600 to-pink-600 text-lg font-bold text-white">
                                {u.username[0].toUpperCase()}
                            </div>

                            {/* Nombre y Nivel */}
                            <div className="flex-1">
                                <div className="text-lg font-bold">{u.username}</div>
                                <div className="text-xs text-muted">Nivel {u.level || 1}</div>
                            </div>

                            {/* XP */}
                            <div className="text-right">
                                <div className="text-lg font-black text-brand">{u.xp || 0} XP</div>
                            </div>
                        </div>
                    ))}
                    {users.length === 0 && (
                        <div className="p-8 text-center text-muted">Aún no hay jugadores en el ranking.</div>
                    )}
                </div>

                <p className="text-center text-sm text-muted">
                    ¡Juega partidas para ganar XP y escalar posiciones!
                </p>
            </div>
        </div>
    );
}
