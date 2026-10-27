import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, type CharacterDetail, type ThemeDetail } from '../services/api';
import { useGameStore } from '../stores/game.store';

const GRADIENTS = [
    'from-purple-600 to-pink-600', 'from-blue-600 to-cyan-500',
    'from-emerald-600 to-teal-500', 'from-orange-600 to-red-600',
];

function initials(name: string) {
    return name.split(/\s+/).map((w) => w[0] ?? '').join('').slice(0, 2).toUpperCase();
}
function gradientFor(name: string) {
    const h = name.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    return GRADIENTS[h % GRADIENTS.length];
}

function CharacterAvatar({ c }: { c: CharacterDetail }) {
    if (c.image_url) {
        return <img src={c.image_url} alt={c.name} className="w-full h-full object-cover" />;
    }
    return (
        <div className={`w-full h-full flex items-center justify-center bg-gradient-to-br ${gradientFor(c.name)}`}>
            <span className="text-4xl font-black text-white/90 drop-shadow-lg">{initials(c.name)}</span>
        </div>
    );
}

export function ThemeDetailPage() {
    const { slug } = useParams<{ slug: string }>();
    const nav = useNavigate();
    const resetGame = useGameStore((s) => s.reset);

    const [detail, setDetail] = useState<ThemeDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [starting, setStarting] = useState(false);

    useEffect(() => {
        if (!slug) return;
        setLoading(true);
        api.themeDetail(slug)
            .then(setDetail)
            .catch((e) => setError((e as Error).message))
            .finally(() => setLoading(false));
    }, [slug]);

    const filteredCharacters = useMemo(() => {
        if (!detail) return [];
        const q = search.trim().toLowerCase();
        if (!q) return detail.characters;
        return detail.characters.filter((c) => c.name.toLowerCase().includes(q));
    }, [detail, search]);

    const startGame = () => {
        if (!slug) return;
        setStarting(true);
        resetGame();
        nav(`/game/${slug}`);
    };

    if (loading) return <div className="p-8 text-white text-center mt-10">Cargando temática...</div>;
    if (error) return <div className="p-8 text-red-400 text-center mt-10">{error}</div>;
    if (!detail) return null;

    const { theme, characters, questions } = detail;

    return (
        <div className="min-h-screen bg-slate-950 text-white p-6">
            <div className="max-w-6xl mx-auto space-y-8">

                {/* Header */}
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-slate-900 p-6 rounded-2xl border border-slate-800">
                    <div>
                        <Link to="/" className="text-sm text-slate-400 hover:text-white mb-2 inline-block">← Volver</Link>
                        <h1 className="text-4xl font-black bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent">
                            {theme.name}
                        </h1>
                        <p className="text-slate-400 mt-2">{theme.description}</p>
                        <div className="mt-4 flex gap-4 text-sm font-medium text-slate-300">
                            <span className="bg-slate-800 px-3 py-1 rounded-full">{characters.length} Personajes</span>
                            <span className="bg-slate-800 px-3 py-1 rounded-full">{questions.length} Preguntas</span>
                        </div>
                    </div>
                    <button
                        onClick={startGame}
                        disabled={starting}
                        className="w-full md:w-auto bg-pink-600 hover:bg-pink-700 disabled:opacity-50 px-8 py-4 rounded-xl font-bold text-lg shadow-lg shadow-pink-900/40 transition-transform hover:scale-105"
                    >
                        {starting ? 'Iniciando...' : '▶ Jugar ahora'}
                    </button>
                </div>

                {/* Buscador de personajes */}
                <div className="relative">
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="🔍 Buscar personaje por nombre..."
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-5 py-4 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                    />
                </div>

                {/* Galería de personajes */}
                <section>
                    <h2 className="text-2xl font-bold mb-4 border-b border-slate-800 pb-2">Galería de Personajes</h2>
                    {filteredCharacters.length === 0 ? (
                        <p className="text-slate-500 italic">No se encontraron personajes con "{search}".</p>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                            {filteredCharacters.map((c) => (
                                <div key={c.id} className="bg-slate-800 rounded-xl overflow-hidden group">
                                    <div className="aspect-[3/4] relative overflow-hidden">
                                        <CharacterAvatar c={c} />
                                    </div>
                                    <div className="p-3">
                                        <div className="text-sm font-bold truncate group-hover:text-purple-400 transition-colors" title={c.name}>
                                            {c.name}
                                        </div>
                                        <div className="flex flex-wrap gap-1 mt-2">
                                            {c.is_hero && <Badge color="green">Héroe</Badge>}
                                            {c.is_villain && <Badge color="red">Villano</Badge>}
                                            {c.has_powers && <Badge color="purple">Poderes</Badge>}
                                            {c.house && <Badge color="blue">{c.house}</Badge>}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>

                {/* Lista de preguntas */}
                <section>
                    <h2 className="text-2xl font-bold mb-4 border-b border-slate-800 pb-2">Preguntas Disponibles</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                        {questions.map((q) => (
                            <div key={q.code} className="bg-slate-800 px-4 py-3 rounded-lg text-sm border border-slate-700">
                                {q.text_es}
                            </div>
                        ))}
                    </div>
                </section>
            </div>
        </div>
    );
}

function Badge({ children, color }: { children: React.ReactNode; color: 'green' | 'red' | 'purple' | 'blue' }) {
    const colors = {
        green: 'bg-emerald-900/60 text-emerald-300 border-emerald-700/50',
        red: 'bg-red-900/60 text-red-300 border-red-700/50',
        purple: 'bg-purple-900/60 text-purple-300 border-purple-700/50',
        blue: 'bg-blue-900/60 text-blue-300 border-blue-700/50',
    };
    return <span className={`text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded border ${colors[color]}`}>{children}</span>;
}