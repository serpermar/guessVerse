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

            // Libros y mangas crean su propia temática con slug = slugify(título).
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
                        Busca películas, series, anime, videojuegos, libros o mangas. Los personajes se importan automáticamente.
                    </p>
                </div>

                <form onSubmit={handleSearch} className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-2 shadow-xl sm:flex-row">
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Escribe el nombre de una saga, juego, libro o manga..."
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
                                        <h3 className="mb-2 text-lg font-bold leading-tight">{r.name}</h3>
                                        <p className="line-clamp-3 text-xs text-muted">{r.description || 'Sin descripción.'}</p>

                                        {(r.kind === 'Libro' || r.kind === 'Manga') && (
                                            <p className="mt-2 text-[11px] text-purple-500/80">
                                                {r.kind === 'Libro'
                                                    ? '📚 Los personajes se extraerán automáticamente con IA.'
                                                    : '📖 Los personajes se obtienen de AniList; los atributos de juego pueden requerir edición manual.'}
                                            </p>
                                        )}
                                    </div>

                                    <button
                                        onClick={() => handleImport(r)}
                                        disabled={!!importing || success}
                                        className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-surface-2 px-4 py-2.5 text-sm font-bold text-fg transition hover:border-emerald-500 hover:bg-emerald-600 hover:text-white disabled:opacity-50"
                                    >
                                        {importing === r.externalId ? (
                                            <>
                                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-current/30 border-t-current"></div>
                                                Importando
                                                {r.kind === 'Libro' ? ' (IA)…' : '…'}
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