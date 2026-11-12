import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, type DiscoveredFranchise } from '../services/api';

const KIND_CONFIG: Record<string, { label: string; icon: string; color: string }> = {
    Película: { label: 'Película', icon: '🎬', color: 'bg-blue-600/80' },
    Serie: { label: 'Serie', icon: '📺', color: 'bg-orange-600/80' },
    Anime: { label: 'Anime', icon: '🎌', color: 'bg-pink-600/80' },
    Videojuego: { label: 'Videojuego', icon: '🎮', color: 'bg-emerald-600/80' },
    Libro: { label: 'Libro', icon: '📚', color: 'bg-purple-600/80' },
    Manga: { label: 'Manga', icon: '📖', color: 'bg-rose-600/80' },
    Cómic: { label: 'Cómic', icon: '💥', color: 'bg-yellow-600/80' },
};

function isPersonajeSource(source: DiscoveredFranchise['source']): boolean {
    return source === 'superhero';
}

export function DiscoverPage() {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<DiscoveredFranchise[]>([]);
    const [loading, setLoading] = useState(false);
    const [importing, setImporting] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const nav = useNavigate();

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!query.trim()) return;
        setLoading(true);
        setError(null);
        setResults([]);
        setSuccess(false);
        try {
            const data = await api.discover(query);
            setResults(data);
        } catch (err) {
            const msg = (err as Error).message;
            if (msg.includes('Failed to fetch') || msg.includes('ERR_CONNECTION_REFUSED')) {
                setError('No se pudo conectar con el servidor. Revisa que el backend esté encendido.');
            } else {
                setError(msg);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleImport = async (franchise: DiscoveredFranchise) => {
        setImporting(franchise.externalId);
        setError(null);
        try {
            const res = await api.importFranchise(franchise);
            setSuccess(true);

            const targetSlug =
                res.themeSlug ??
                franchise.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

            setTimeout(() => {
                nav(`/themes/${targetSlug}`);
            }, 1500);
        } catch (err) {
            const msg = (err as Error).message;
            if (msg.includes('Failed to fetch') || msg.includes('ERR_CONNECTION_REFUSED')) {
                setError('El servidor está apagado o ha fallado. Revisa la terminal del backend.');
            } else {
                setError(msg);
            }
            setImporting(null);
        }
    };

    return (
        <div className="min-h-screen bg-canvas p-4 text-fg sm:p-8">
            <div className="mx-auto mt-6 max-w-4xl space-y-6">
                <div className="space-y-2 text-center">
                    <h1 className="text-brand-gradient text-4xl font-black">Descubrir Franquicias</h1>
                    <p className="mx-auto max-w-xl text-muted">
                        Busca películas, series, anime, videojuegos, libros, mangas y cómics.
                    </p>
                    <p className="mx-auto max-w-xl text-xs text-muted/80">
                        💡 Para cómics (Batman, Spider-Man, Watchmen…), busca por <strong>nombre de personaje</strong>, no por título de la obra.
                    </p>
                </div>

                <form onSubmit={handleSearch} className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-2 shadow-xl sm:flex-row">
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Ej: Batman, Spider-Man, Berserk, The Hobbit…"
                        className="flex-1 bg-transparent px-4 py-3 text-lg text-fg placeholder-muted focus:outline-none"
                        disabled={!!importing}
                    />
                    <button
                        type="submit"
                        disabled={loading || !!importing}
                        className="whitespace-nowrap rounded-xl bg-brand px-8 py-3 font-bold text-white transition hover:opacity-90 disabled:opacity-50"
                    >
                        {loading ? 'Buscando...' : 'Buscar'}
                    </button>
                </form>

                {error && (
                    <div role="alert" className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-center text-red-600 dark:text-red-300">
                        {error}
                    </div>
                )}

                {success && (
                    <div className="animate-pulse rounded-xl border border-emerald-500/50 bg-emerald-500/10 p-4 text-center text-lg font-bold text-emerald-600 dark:text-emerald-300">
                        ✅ Franquicia importada. Redirigiendo a la galería...
                    </div>
                )}

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {results.map((r) => {
                        const config = KIND_CONFIG[r.kind] || KIND_CONFIG['Película'];
                        const esPersonaje = isPersonajeSource(r.source);
                        return (
                            <div
                                key={`${r.source}:${r.externalId}`}
                                className={`flex overflow-hidden rounded-2xl border bg-surface transition-all ${importing === r.externalId
                                    ? 'border-brand ring-2 ring-brand/50'
                                    : 'border-border hover:border-brand/50'
                                    }`}
                            >
                                <div className="relative w-32 shrink-0 bg-canvas">
                                    {r.imageUrl ? (
                                        <img
                                            src={r.imageUrl}
                                            alt={r.name}
                                            loading="lazy"
                                            decoding="async"
                                            className="h-full w-full object-cover"
                                        />
                                    ) : (
                                        <div className="flex h-full w-full items-center justify-center text-muted">📦</div>
                                    )}
                                    <span className={`absolute left-2 top-2 rounded-md px-2 py-1 text-[10px] font-bold uppercase text-white backdrop-blur-md ${config.color}`}>
                                        {config.icon} {config.label}
                                    </span>
                                </div>

                                <div className="flex flex-1 flex-col justify-between p-5">
                                    <div>
                                        <div className="mb-2 flex items-center gap-2">
                                            <h3 className="text-lg font-bold leading-tight">{r.name}</h3>
                                            <span
                                                className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${esPersonaje
                                                        ? 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-300'
                                                        : 'bg-slate-500/20 text-slate-600 dark:text-slate-300'
                                                    }`}
                                            >
                                                {esPersonaje ? 'Personaje' : 'Obra'}
                                            </span>
                                        </div>
                                        <p className="line-clamp-3 text-xs text-muted">
                                            {r.description || 'Sin descripción.'}
                                        </p>

                                        {r.kind === 'Libro' && (
                                            <p className="mt-2 text-[11px] text-purple-500/80">
                                                📚 Los personajes se extraerán con IA (sin imagen de retrato).
                                            </p>
                                        )}
                                        {r.kind === 'Manga' && (
                                            <p className="mt-2 text-[11px] text-rose-500/80">
                                                📖 Personajes e imágenes se importan desde la API de manga.
                                            </p>
                                        )}
                                        {esPersonaje && (
                                            <p className="mt-2 text-[11px] text-yellow-600/80">
                                                💥 Personaje con imagen y atributos completos.
                                            </p>
                                        )}
                                    </div>

                                    <button
                                        onClick={() => handleImport(r)}
                                        disabled={!!importing || success}
                                        className={`mt-4 flex w-full items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-bold transition disabled:opacity-50 ${esPersonaje
                                                ? 'border-yellow-500/50 bg-yellow-500/10 text-yellow-700 hover:bg-yellow-500 hover:text-white dark:text-yellow-300'
                                                : 'border-border bg-surface-2 text-fg hover:border-emerald-500 hover:bg-emerald-600 hover:text-white'
                                            }`}
                                    >
                                        {importing === r.externalId ? (
                                            <>
                                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-current/30 border-t-current"></div>
                                                {r.kind === 'Libro' ? 'Importando (IA)…' : 'Importando…'}
                                            </>
                                        ) : (
                                            <>➕ Importar</>
                                        )}
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {results.length === 0 && !loading && query && !error && (
                    <p className="py-10 text-center text-muted">No se encontraron resultados.</p>
                )}
            </div>
        </div>
    );
}