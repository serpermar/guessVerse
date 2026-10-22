import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, type Theme } from '../services/api';
import { readPersisted, useGameStore } from '../stores/game.store';

const THEME_EMOJI: Record<string, string> = {
    marvel: '🦸',
    'star-wars': '🌌',
    'harry-potter': '⚡',
    'resident-evil': '🧟',
    pokemon: '⚡',
};

const THEME_GRADIENT: Record<string, string> = {
    marvel: 'from-red-500/80 to-yellow-500/80',
    'star-wars': 'from-slate-700/80 to-amber-500/80',
    'harry-potter': 'from-amber-700/80 to-yellow-600/80',
    'resident-evil': 'from-emerald-700/80 to-red-700/80',
    pokemon: 'from-yellow-400/80 to-red-500/80',
};

function themeEmoji(slug: string) {
    return THEME_EMOJI[slug] ?? '🎮';
}

function themeGradient(slug: string) {
    return THEME_GRADIENT[slug] ?? 'from-brand/80 to-accent/80';
}

export function HomePage() {
    const [themes, setThemes] = useState<Theme[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [saved, setSaved] = useState<ReturnType<typeof readPersisted>>(() => readPersisted());
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

    const startNewGame = (slug: string) => {
        reset();                    // ← limpia partida anterior (Marvel, etc.)
        nav(`/game/${slug}`);
    };

    return (
        <main className="mx-auto max-w-5xl px-4 py-10 animate-fade-in">
            <h1 className="text-center text-5xl font-black tracking-tight bg-gradient-to-r from-brand to-accent bg-clip-text text-transparent">
                GuessVerse
            </h1>
            <p className="mt-2 text-center text-muted">Adivina el personaje secreto</p>

            {saved && (
                <div className="mx-auto mb-8 mt-8 flex max-w-3xl items-center justify-between gap-4 rounded-2xl border border-brand/40 bg-brand/10 p-4 animate-pop-in">
                    <div>
                        <div className="text-xs font-semibold uppercase tracking-wide text-brand">
                            Partida en curso
                        </div>
                        <div className="text-lg font-bold">{saved.theme.name}</div>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => nav(`/game/${saved.theme.slug}`)}
                            className="rounded-lg bg-brand-strong px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
                        >
                            Continuar
                        </button>
                        <button
                            onClick={() => {
                                localStorage.removeItem('guessverse:current-game');
                                setSaved(null);
                            }}
                            className="rounded-lg border border-border bg-surface-2 px-4 py-2 text-sm text-muted transition hover:text-fg"
                        >
                            Descartar
                        </button>
                    </div>
                </div>
            )}

            {loading && <p className="mt-10 text-center text-muted">Cargando temáticas…</p>}

            {error && (
                <div className="mt-10 text-center text-red-500">
                    <p className="mb-2">No se pudieron cargar las temáticas.</p>
                    <button
                        onClick={loadThemes}
                        className="rounded-lg border border-border bg-surface-2 px-4 py-2 text-sm text-fg transition hover:bg-surface"
                    >
                        Reintentar
                    </button>
                </div>
            )}

            {!loading && !error && themes.length === 0 && (
                <p className="mt-10 text-center text-muted">
                    No hay temáticas disponibles todavía.
                </p>
            )}

            <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {themes.map((t, i) => (
                    <button
                        key={t.id}
                        onClick={() => startNewGame(t.slug)}
                        style={{ animationDelay: `${i * 40}ms` }}
                        className="group flex animate-pop-in flex-col gap-3 overflow-hidden rounded-2xl border border-border bg-surface p-4 text-left transition hover:-translate-y-1 hover:border-brand/60 hover:shadow-lg hover:shadow-brand/10"
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
                            <div className="text-xl font-bold">{t.name}</div>
                            <div className="mt-1 text-sm text-muted">{t.description}</div>
                        </div>
                    </button>
                ))}
            </div>
        </main>
    );
}
