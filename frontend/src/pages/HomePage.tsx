import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, type Theme } from '../services/api';
import { readPersisted, useGameStore } from '../stores/game.store';

const THEME_EMOJI: Record<string, string> = {
    marvel: '🦸',
    'star-wars': '🌌',
    'harry-potter': '⚡',
    'resident-evil': '🧟',
    pokemon: '⚡',
    'dc-comics': '🦇',
};

const THEME_GRADIENT: Record<string, string> = {
    marvel: 'from-red-500/80 to-yellow-500/80',
    'star-wars': 'from-slate-700/80 to-amber-500/80',
    'harry-potter': 'from-amber-700/80 to-yellow-600/80',
    'resident-evil': 'from-emerald-700/80 to-red-700/80',
    pokemon: 'from-yellow-400/80 to-red-500/80',
    'dc-comics': 'from-blue-700/80 to-slate-900/80',
};

function themeEmoji(slug: string) {
    return THEME_EMOJI[slug] ?? '🎮';
}

function themeGradient(slug: string) {
    return THEME_GRADIENT[slug] ?? 'from-purple-600/80 to-pink-600/80';
}

// Función para obtener el badge de tipo
function getTypeBadge(type: string) {
    const map: Record<string, { label: string, icon: string, color: string }> = {
        'movies': { label: 'Películas', icon: '🎬', color: 'bg-blue-900/60 text-blue-300 border-blue-700/50' },
        'superheroes': { label: 'Superhéroes', icon: '🦸', color: 'bg-red-900/60 text-red-300 border-red-700/50' },
        'anime': { label: 'Anime', icon: '🎌', color: 'bg-pink-900/60 text-pink-300 border-pink-700/50' },
        'videogames': { label: 'Videojuegos', icon: '🎮', color: 'bg-emerald-900/60 text-emerald-300 border-emerald-700/50' },
        'fantasy': { label: 'Fantasía', icon: '🧙', color: 'bg-purple-900/60 text-purple-300 border-purple-700/50' },
        'series': { label: 'Series', icon: '📺', color: 'bg-orange-900/60 text-orange-300 border-orange-700/50' },
        'default': { label: 'Varios', icon: '📦', color: 'bg-slate-800 text-slate-300 border-slate-700' },
    };
    return map[type] || map['default'];
}

export function HomePage() {
    const [themes, setThemes] = useState<Theme[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [saved, setSaved] = useState<ReturnType<typeof readPersisted>>(() => readPersisted());
    const [search, setSearch] = useState('');

    const nav = useNavigate();
    const reset = useGameStore((s) => s.reset);

    const loadThemes = () => {
        setLoading(true);
        setError(null);
        api
            .themes()
            .then(setThemes)
            .catch((e) => setError((e as Error).message))
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        let cancelled = false;
        api
            .themes()
            .then((t) => {
                if (!cancelled) {
                    setThemes(t);
                    setLoading(false);
                }
            })
            .catch((e) => {
                if (!cancelled) {
                    setError((e as Error).message);
                    setLoading(false);
                }
            });
        return () => {
            cancelled = true;
        };
    }, []);

    const filteredThemes = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return themes;
        return themes.filter(
            (t) =>
                t.name.toLowerCase().includes(q) ||
                (t.description ?? '').toLowerCase().includes(q)
        );
    }, [search, themes]);

    return (
        <main className="mx-auto max-w-5xl px-4 py-10 animate-fade-in">
            <h1 className="text-center text-5xl font-black tracking-tight bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent">
                GuessVerse
            </h1>
            <p className="mt-2 text-center text-slate-400">Adivina el personaje secreto</p>

            {saved && (
                <div className="mx-auto mb-8 mt-8 flex max-w-3xl items-center justify-between gap-4 rounded-2xl border border-purple-500/40 bg-purple-500/10 p-4 animate-pop-in">
                    <div>
                        <div className="text-xs font-semibold uppercase tracking-wide text-purple-400">
                            Partida en curso
                        </div>
                        <div className="text-lg font-bold text-white">{saved.theme.name}</div>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => nav(`/game/${saved.theme.slug}`)}
                            className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
                        >
                            Continuar
                        </button>
                        <button
                            onClick={() => {
                                localStorage.removeItem('guessverse:current-game');
                                setSaved(null);
                            }}
                            className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm text-slate-300 transition hover:text-white"
                        >
                            Descartar
                        </button>
                    </div>
                </div>
            )}

            <div className="mx-auto mt-8 max-w-3xl">
                <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="🔍 Buscar temática..."
                    className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none"
                />
            </div>

            {loading && <p className="mt-10 text-center text-slate-400">Cargando temáticas…</p>}

            {error && (
                <div className="mt-10 text-center text-red-500">
                    <p className="mb-2">No se pudieron cargar las temáticas.</p>
                    <button
                        onClick={loadThemes}
                        className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm text-white transition hover:bg-slate-700"
                    >
                        Reintentar
                    </button>
                </div>
            )}

            {!loading && !error && filteredThemes.length === 0 && themes.length > 0 && (
                <p className="mt-10 text-center text-slate-500">
                    No hay temáticas que coincidan con "{search}".
                </p>
            )}

            <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filteredThemes.map((t, i) => {
                    const badge = getTypeBadge(t.type);
                    return (
                        <button
                            key={t.id}
                            onClick={() => {
                                reset();
                                nav(`/themes/${t.slug}`);
                            }}
                            style={{ animationDelay: `${i * 40}ms` }}
                            className="group flex animate-pop-in flex-col gap-3 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 p-4 text-left transition hover:-translate-y-1 hover:border-purple-500/60 hover:shadow-lg hover:shadow-purple-500/10"
                        >
                            <div
                                className={`relative flex h-36 items-center justify-center rounded-xl bg-gradient-to-br ${themeGradient(
                                    t.slug
                                )}`}
                            >
                                {t.image_url ? (
                                    <img
                                        src={t.image_url}
                                        alt=""
                                        className="h-full w-full rounded-xl object-cover"
                                    />
                                ) : (
                                    <span className="text-6xl drop-shadow-lg transition-transform group-hover:scale-110">
                                        {themeEmoji(t.slug)}
                                    </span>
                                )}
                            </div>
                            <div>
                                <div className="text-xl font-bold text-white">{t.name}</div>
                                <div className="mt-2 flex items-center gap-2">
                                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${badge.color}`}>
                                        {badge.icon} {badge.label}
                                    </span>
                                </div>
                                <div className="mt-2 text-sm text-slate-400 line-clamp-2">{t.description}</div>
                            </div>
                        </button>
                    );
                })}
            </div>
        </main>
    );
}