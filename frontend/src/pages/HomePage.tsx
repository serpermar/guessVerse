import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, type Theme } from '../services/api';
import { readPersisted, useGameStore } from '../stores/game.store';

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
            .catch((e) => setError(e.message))
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
                    setError(e.message);
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
        <div className="min-h-screen bg-slate-950 text-white p-8">
            <h1 className="text-5xl font-black text-center mb-2 bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent">
                GuessVerse
            </h1>
            <p className="text-center text-slate-400 mb-8">Adivina el personaje secreto</p>

            {saved && (
                <div className="max-w-4xl mx-auto mb-8 p-4 bg-purple-900/40 border border-purple-500/40 rounded-xl flex items-center justify-between">
                    <div>
                        <div className="text-sm text-purple-300">Partida en curso</div>
                        <div className="font-bold">{saved.theme.name}</div>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => nav(`/game/${saved.theme.slug}`)}
                            className="bg-purple-500 hover:bg-purple-600 px-4 py-2 rounded-lg font-semibold text-sm"
                        >
                            Continuar
                        </button>
                        <button
                            onClick={() => {
                                localStorage.removeItem('guessverse:current-game');
                                setSaved(null);
                            }}
                            className="bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded-lg text-sm"
                        >
                            Descartar
                        </button>
                    </div>
                </div>
            )}

            {loading && <p className="text-center">Cargando temáticas…</p>}
            {error && (
                <div className="text-center text-red-400">
                    <p className="mb-2">No se pudieron cargar las temáticas.</p>
                    <button
                        onClick={loadThemes}
                        className="bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded-lg text-sm text-white"
                    >
                        Reintentar
                    </button>
                </div>
            )}

            {!loading && !error && themes.length === 0 && (
                <p className="text-center text-slate-400">
                    No hay temáticas disponibles todavía.
                </p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl mx-auto">
                {themes.map((t) => (
                    <button
                        key={t.id}
                        onClick={() => startNewGame(t.slug)}
                        className="p-6 bg-slate-800 rounded-xl hover:bg-slate-700 transition text-left flex flex-col gap-3"
                    >
                        {t.image_url && (
                            <img
                                src={t.image_url}
                                alt=""
                                className="w-full h-32 object-cover rounded-lg"
                            />
                        )}
                        <div>
                            <div className="text-2xl font-bold">{t.name}</div>
                            <div className="text-slate-400 text-sm mt-1">{t.description}</div>
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
}