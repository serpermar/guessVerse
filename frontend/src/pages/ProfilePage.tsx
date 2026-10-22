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
        return <div className="mx-auto max-w-3xl px-4 py-8 text-muted">Cargando perfil…</div>;
    }
    if (err) {
        return <div className="mx-auto max-w-3xl px-4 py-8 text-red-500">{err}</div>;
    }

    return (
        <div className="mx-auto max-w-3xl space-y-6 px-4 py-8 text-fg">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-brand to-accent text-2xl font-black text-white">
                        {profile?.username?.[0]?.toUpperCase() ?? '?'}
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold">{profile?.username}</h1>
                        <p className="text-sm text-muted">{profile?.email}</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Link to="/" className="rounded-lg border border-border bg-surface-2 px-4 py-2 text-sm transition hover:bg-surface">
                        Jugar
                    </Link>
                    <button onClick={onLogout} className="rounded-lg bg-red-500/90 px-4 py-2 text-sm text-white transition hover:bg-red-500">
                        Salir
                    </button>
                </div>
            </div>

            <section className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                <StatCard label="Jugadas" value={stats?.games_played ?? 0} />
                <StatCard label="Ganadas" value={stats?.games_won ?? 0} accent="text-emerald-500" />
                <StatCard label="Perdidas" value={stats?.games_lost ?? 0} accent="text-red-500" />
                <StatCard label="Abandonadas" value={stats?.games_abandoned ?? 0} accent="text-amber-500" />
                <StatCard label="% Victorias" value={`${stats?.win_rate ?? 0}%`} accent="text-brand" />
            </section>

            <section>
                <h2 className="mb-2 text-lg font-bold">Últimas partidas</h2>
                {games.length === 0 && (
                    <p className="italic text-muted">Todavía no has jugado ninguna partida.</p>
                )}
                <ul className="space-y-1">
                    {games.map((g) => (
                        <li key={g.id} className="flex items-center justify-between rounded-lg border border-border bg-surface p-3 text-sm">
                            <div>
                                <div className="font-semibold">{g.themes?.name ?? 'Partida'}</div>
                                <div className="text-xs text-muted">
                                    {g.started_at ? new Date(g.started_at).toLocaleString() : '—'}
                                </div>
                            </div>
                            <StatusBadge status={g.status} />
                        </li>
                    ))}
                </ul>
            </section>
        </div>
    );
}

function StatCard({ label, value, accent }: { label: string; value: number | string; accent?: string }) {
    return (
        <div className="rounded-lg border border-border bg-surface p-4 text-center">
            <div className={`text-2xl font-black ${accent ?? 'text-fg'}`}>{value}</div>
            <div className="text-xs uppercase tracking-wide text-muted">{label}</div>
        </div>
    );
}

function StatusBadge({ status }: { status: GameHistoryItem['status'] }) {
    const map = {
        won: { text: 'Victoria', cls: 'bg-emerald-500/10 text-emerald-500' },
        lost: { text: 'Derrota', cls: 'bg-red-500/10 text-red-500' },
        abandoned: { text: 'Abandonada', cls: 'bg-amber-500/10 text-amber-500' },
        playing: { text: 'En curso', cls: 'bg-brand/10 text-brand' },
        waiting: { text: 'Esperando', cls: 'bg-muted/10 text-muted' },
    } as const;
    const c = map[status] ?? map.playing;
    return <span className={`rounded px-2 py-1 text-xs ${c.cls}`}>{c.text}</span>;
}
