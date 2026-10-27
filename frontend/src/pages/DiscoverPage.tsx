import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, type DiscoveredFranchise } from '../services/api';

export function DiscoverPage() {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<DiscoveredFranchise[]>([]);
    const [loading, setLoading] = useState(false);
    const [importing, setImporting] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const nav = useNavigate();

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!query.trim()) return;
        setLoading(true);
        setError(null);
        setResults([]);
        try {
            const data = await api.discover(query);
            setResults(data);
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setLoading(false);
        }
    };

    const handleImport = async (franchise: DiscoveredFranchise) => {
        setImporting(franchise.externalId);
        setError(null);
        try {
            await api.importFranchise(franchise);
            // Redirigimos al detalle de la nueva temática
            const newSlug = franchise.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
            nav(`/themes/${newSlug}`);
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setImporting(null);
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 text-white p-8">
            <div className="max-w-4xl mx-auto space-y-8">
                <div className="text-center">
                    <h1 className="text-4xl font-black bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent mb-2">
                        Descubrir Franquicias
                    </h1>
                    <p className="text-slate-400">Busca colecciones de TMDB y conviértelas en nuevas temáticas jugables al instante.</p>
                </div>

                <form onSubmit={handleSearch} className="flex gap-2">
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Ej: El Señor de los Anillos, Matrix, Rápidos y Furiosos..."
                        className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                    />
                    <button
                        type="submit"
                        disabled={loading}
                        className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 px-6 py-3 rounded-xl font-bold transition"
                    >
                        {loading ? 'Buscando...' : 'Buscar'}
                    </button>
                </form>

                {error && <div className="bg-red-900/50 border border-red-700 text-red-200 p-4 rounded-xl">{error}</div>}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {results.map((r) => (
                        <div key={r.externalId} className="bg-slate-800 rounded-xl overflow-hidden flex border border-slate-700 hover:border-purple-500/50 transition">
                            {r.imageUrl ? (
                                <img src={r.imageUrl} alt={r.name} className="w-28 object-cover" />
                            ) : (
                                <div className="w-28 bg-slate-700 flex items-center justify-center text-slate-500 text-xs">Sin img</div>
                            )}
                            <div className="p-4 flex-1 flex flex-col justify-between">
                                <div>
                                    <h3 className="font-bold text-lg leading-tight">{r.name}</h3>
                                    <p className="text-xs text-slate-400 line-clamp-3 mt-1">{r.description}</p>
                                </div>
                                <button
                                    onClick={() => handleImport(r)}
                                    disabled={importing === r.externalId}
                                    className="mt-3 self-start bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 px-4 py-2 rounded-lg text-sm font-semibold transition flex items-center gap-2"
                                >
                                    {importing === r.externalId ? 'Importando...' : '➕ Importar'}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                {results.length === 0 && !loading && query && !error && (
                    <p className="text-center text-slate-500">No se encontraron resultados para "{query}".</p>
                )}
            </div>
        </div>
    );
}