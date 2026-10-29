// frontend/src/pages/DiscoverPage.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, type DiscoveredFranchise } from '../services/api';

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
            setSuccess(true);
            setTimeout(() => {
                const newSlug = franchise.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
                nav(`/themes/${newSlug}`);
            }, 1500);
        } catch (err) {
            setError((err as Error).message);
            setImporting(null);
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 text-white p-4 sm:p-8">
            <div className="max-w-4xl mx-auto space-y-8 mt-6">

                <div className="text-center space-y-2">
                    <h1 className="text-4xl font-black bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent">
                        Descubrir Franquicias
                    </h1>
                    <p className="text-slate-400 max-w-xl mx-auto">
                        Busca películas, series o anime. Importaremos a sus personajes automáticamente.
                    </p>
                </div>

                <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3 bg-slate-900 p-2 rounded-2xl border border-slate-800 shadow-xl">
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Escribe el nombre de una saga o serie..."
                        className="flex-1 bg-transparent px-4 py-3 text-white placeholder-slate-500 focus:outline-none text-lg"
                        disabled={!!importing}
                    />
                    <button
                        type="submit"
                        disabled={loading || !!importing}
                        className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 px-8 py-3 rounded-xl font-bold transition whitespace-nowrap"
                    >
                        {loading ? 'Buscando...' : 'Buscar'}
                    </button>
                </form>

                {error && <div className="bg-red-900/30 border border-red-800 text-red-300 p-4 rounded-xl text-center">{error}</div>}

                {success && (
                    <div className="bg-emerald-900/40 border border-emerald-500/50 text-emerald-300 p-4 rounded-xl text-center font-bold animate-pulse text-lg">
                        ✅ Franquicia importada. Redirigiendo a la galería...
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {results.map((r) => (
                        <div key={r.externalId} className={`bg-slate-900 rounded-2xl overflow-hidden flex border transition-all ${importing === r.externalId ? 'border-purple-500 ring-2 ring-purple-500/50' : 'border-slate-800 hover:border-purple-500/50'}`}>

                            <div className="w-32 shrink-0 bg-slate-950 relative">
                                {r.imageUrl ? (
                                    <img src={r.imageUrl} alt={r.name} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-slate-600">🎬</div>
                                )}
                                {/* ETIQUETA DE TIPO */}
                                <span className={`absolute top-2 left-2 text-[10px] font-bold uppercase px-2 py-1 rounded-md backdrop-blur-md ${r.kind === 'Anime' ? 'bg-pink-600/80 text-white' :
                                        r.kind === 'Serie' ? 'bg-blue-600/80 text-white' :
                                            'bg-emerald-600/80 text-white'
                                    }`}>
                                    {r.kind === 'Anime' ? '🎌 Anime' : r.kind === 'Serie' ? '📺 Serie' : '🎬 Película'}
                                </span>
                            </div>

                            <div className="p-5 flex-1 flex flex-col justify-between">
                                <div>
                                    <h3 className="font-bold text-lg leading-tight mb-2">{r.name}</h3>
                                    <p className="text-xs text-slate-400 line-clamp-3">{r.description || 'Sin descripción.'}</p>
                                </div>

                                <button
                                    onClick={() => handleImport(r)}
                                    disabled={!!importing || success}
                                    className="mt-4 w-full bg-slate-800 hover:bg-emerald-600 hover:border-emerald-500 border border-slate-700 text-white disabled:opacity-50 px-4 py-2.5 rounded-lg text-sm font-bold transition flex items-center justify-center gap-2"
                                >
                                    {importing === r.externalId ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                            Importando...
                                        </>
                                    ) : (
                                        <>➕ Importar</>
                                    )}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                {results.length === 0 && !loading && query && !error && (
                    <p className="text-center text-slate-500 py-10">No se encontraron resultados.</p>
                )}
            </div>
        </div>
    );
}