import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthProvider';
import {
    api,
    type UserProfile,
    type UserStats,
    type GameHistoryItem,
} from '../services/api';

export function ProfilePage() {
    const { user, signOut } = useAuth();
    const nav = useNavigate();

    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [stats, setStats] = useState<UserStats | null>(null);
    const [games, setGames] = useState<GameHistoryItem[]>([]);
    const [err, setErr] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) {
            nav('/login', { replace: true });
            return;
        }
        Promise.all([api.me(), api.myStats(), api.myGames(20)])
            .then(([p, s, g]) => {
                setProfile(p);
                setStats(s);
                setGames(g);
            })
            .catch((e) => setErr((e as Error).message))
            .finally(() => setLoading(false));
    }, [user, nav]);

    async function onLogout() {
        await signOut();
        nav('/', { replace: true });
    }

    if (loading) {
        return <div className="min-h-screen bg-slate-950 text-white p-8">Cargando perfil…</div>;
    }
    if (err) {
        return <div className="min-h-screen bg-slate-950 text-red-400 p-8">{err}</div>;
    }

    return (
        <div className="min-h-screen bg-slate-950 text-white p-8">
            <div className="max-w-3xl mx-auto space-y-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center text-2xl font-black">
                            {profile?.username?.[0]?.toUpperCase() ?? '?'}
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold">{profile?.username}</h1>
                            <p className="text-slate-400 text-sm">{profile?.email}</p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Link to="/" className="bg-slate-800 hover:bg-slate-700 px-4 py-2 rounded-lg text-sm">
                            Jugar
                        </Link>
                        <button onClick={onLogout} className="bg-red-900/60 hover:bg-red-900 px-4 py-2 rounded-lg text-sm">
                            Salir
                        </button>
                    </div>
                </div>

                <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <StatCard label="Jugadas" value={stats?.games_played ?? 0} />
                    <StatCard label="Ganadas" value={stats?.games_won ?? 0} accent="text-emerald-400" />
                    <StatCard label="Perdidas" value={stats?.games_lost ?? 0} accent="text-red-400" />
                    <StatCard label="% Victorias" value={`${stats?.win_rate ?? 0}%`} accent="text-purple-400" />
                </section>

                <section>
                    <h2 className="text-lg font-bold mb-2">Últimas partidas</h2>
                    {games.length === 0 && (
                        <p className="text-slate-400 italic">Todavía no has jugado ninguna partida.</p>
                    )}
                    <ul className="space-y-1">
                        {games.map((g) => (
                            <li key={g.id} className="bg-slate-800 p-3 rounded-lg flex items-center justify-between text-sm">
                                <div>
                                    <div className="font-semibold">{g.themes?.name ?? 'Partida'}</div>
                                    <div className="text-slate-400 text-xs">
                                        {g.started_at ? new Date(g.started_at).toLocaleString() : '—'}
                                    </div>
                                </div>
                                <StatusBadge status={g.status} />
                            </li>
                        ))}
                    </ul>
                </section>
            </div>
        </div>
    );
}

function StatCard({ label, value, accent }: { label: string; value: number | string; accent?: string }) {
    return (
        <div className="bg-slate-800 p-4 rounded-lg text-center">
            <div className={`text-2xl font-black ${accent ?? 'text-white'}`}>{value}</div>
            <div className="text-xs text-slate-400 uppercase tracking-wide">{label}</div>
        </div>
    );
}

function StatusBadge({ status }: { status: GameHistoryItem['status'] }) {
    const map = {
        won: { text: 'Victoria', cls: 'bg-emerald-900/60 text-emerald-300' },
        lost: { text: 'Derrota', cls: 'bg-red-900/60 text-red-300' },
        abandoned: { text: 'Abandonada', cls: 'bg-slate-700 text-slate-300' },
        playing: { text: 'En curso', cls: 'bg-blue-900/60 text-blue-300' },
        waiting: { text: 'Esperando', cls: 'bg-yellow-900/60 text-yellow-300' },
    } as const;
    const c = map[status] ?? map.playing;
    return <span className={`text-xs px-2 py-1 rounded ${c.cls}`}>{c.text}</span>;
}