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

    // Estado para el modal de edición
    const [editingChar, setEditingChar] = useState<CharacterDetail | null>(null);
    const [saving, setSaving] = useState(false);

    const loadDetail = () => {
        if (!slug) return;
        setLoading(true);
        api.themeDetail(slug)
            .then(setDetail)
            .catch((e) => setError((e as Error).message))
            .finally(() => setLoading(false));
    };

    useEffect(() => { loadDetail(); }, [slug]);

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

    const handleSaveChar = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingChar) return;
        setSaving(true);
        try {
            await api.updateCharacter(editingChar.id, {
                is_hero: editingChar.is_hero || false,
                is_villain: editingChar.is_villain || false,
                is_protagonist: editingChar.is_protagonist || false,
                has_powers: editingChar.has_powers || false,
                uses_weapon: editingChar.uses_weapon || false,
                is_human: editingChar.is_human || false,
                species: editingChar.species,
            });
            setEditingChar(null); // Cerrar modal
            loadDetail(); // Recargar datos
        } catch (err) {
            alert("Error guardando personaje: " + (err as Error).message);
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="p-8 text-white text-center mt-10">Cargando temática...</div>;
    if (error) return <div className="p-8 text-red-400 text-center mt-10">{error}</div>;
    if (!detail) return null;

    const { theme, characters, questions } = detail;
    const typeBadge = getTypeBadge(theme.type);

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
                        <p className="text-slate-400 mt-2 max-w-2xl">{theme.description}</p>

                        <div className="mt-4 flex gap-3 text-sm font-medium text-slate-300 flex-wrap items-center">
                            <span className={`px-3 py-1 rounded-full border text-xs font-bold uppercase tracking-wider ${typeBadge.color}`}>
                                {typeBadge.icon} {typeBadge.label}
                            </span>
                            <span className="bg-slate-800 px-3 py-1 rounded-full">{characters.length} Personajes</span>
                            <span className="bg-slate-800 px-3 py-1 rounded-full">{questions.length} Preguntas</span>
                        </div>
                    </div>
                    <button
                        onClick={startGame}
                        disabled={starting}
                        className="w-full md:w-auto bg-pink-600 hover:bg-pink-700 disabled:opacity-50 px-8 py-4 rounded-xl font-bold text-lg shadow-lg shadow-pink-900/40 transition-transform hover:scale-105 whitespace-nowrap"
                    >
                        {starting ? 'Iniciando...' : '▶ Jugar ahora'}
                    </button>
                </div>

                {/* Buscador */}
                <div className="relative">
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="🔍 Buscar personaje por nombre..."
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-5 py-4 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                    />
                </div>

                {/* Galería */}
                <section>
                    <h2 className="text-2xl font-bold mb-4 border-b border-slate-800 pb-2">Galería de Personajes</h2>
                    {filteredCharacters.length === 0 ? (
                        <p className="text-slate-500 italic">No se encontraron personajes.</p>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                            {filteredCharacters.map((c) => (
                                <div key={c.id} className="bg-slate-800 rounded-xl overflow-hidden group relative border border-slate-700 hover:border-purple-500/50 transition">
                                    <div className="aspect-[3/4] relative overflow-hidden">
                                        <CharacterAvatar c={c} />
                                        <button
                                            onClick={() => setEditingChar(c)}
                                            className="absolute top-2 right-2 bg-black/60 hover:bg-black/90 p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                            title="Editar atributos"
                                        >
                                            ✏️
                                        </button>
                                    </div>
                                    <div className="p-3">
                                        <div className="text-sm font-bold truncate group-hover:text-purple-400 transition-colors" title={c.name}>
                                            {c.name}
                                        </div>

                                        {/* ETIQUETAS DEL PERSONAJE */}
                                        <div className="flex flex-wrap gap-1 mt-2">
                                            {c.is_hero && <Badge color="green">Héroe</Badge>}
                                            {c.is_villain && <Badge color="red">Villano</Badge>}
                                            {c.has_powers && <Badge color="purple">Poderes</Badge>}
                                            {c.species && <Badge color="blue">{c.species}</Badge>}

                                            {c.gender && (
                                                <Badge color="gray">
                                                    {c.gender === 'male' ? 'Hombre' : c.gender === 'female' ? 'Mujer' : c.gender}
                                                </Badge>
                                            )}

                                            {(!c.is_hero && !c.is_villain && !c.has_powers) && (
                                                <Badge color="yellow">Sin curar</Badge>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>

                {/* Preguntas */}
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

            {/* MODAL DE EDICIÓN DE PERSONAJE */}
            {editingChar && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
                    <form onSubmit={handleSaveChar} className="bg-slate-800 rounded-2xl p-6 w-full max-w-md border border-slate-700 space-y-4">
                        <h3 className="text-xl font-bold flex items-center gap-2">
                            <span>✏️</span> Editar: {editingChar.name}
                        </h3>

                        <div className="space-y-3 bg-slate-900 p-4 rounded-xl">
                            <label className="flex items-center justify-between cursor-pointer">
                                <span className="text-sm font-medium text-slate-300">¿Es un Héroe?</span>
                                <input type="checkbox" checked={editingChar.is_hero || false} onChange={(e) => setEditingChar({ ...editingChar, is_hero: e.target.checked })} className="w-5 h-5 accent-emerald-500" />
                            </label>
                            <label className="flex items-center justify-between cursor-pointer">
                                <span className="text-sm font-medium text-slate-300">¿Es un Villano?</span>
                                <input type="checkbox" checked={editingChar.is_villain || false} onChange={(e) => setEditingChar({ ...editingChar, is_villain: e.target.checked })} className="w-5 h-5 accent-red-500" />
                            </label>
                            <label className="flex items-center justify-between cursor-pointer">
                                <span className="text-sm font-medium text-slate-300">¿Es Protagonista?</span>
                                <input type="checkbox" checked={editingChar.is_protagonist || false} onChange={(e) => setEditingChar({ ...editingChar, is_protagonist: e.target.checked })} className="w-5 h-5 accent-blue-500" />
                            </label>
                            <label className="flex items-center justify-between cursor-pointer">
                                <span className="text-sm font-medium text-slate-300">¿Tiene Poderes?</span>
                                <input type="checkbox" checked={editingChar.has_powers || false} onChange={(e) => setEditingChar({ ...editingChar, has_powers: e.target.checked })} className="w-5 h-5 accent-purple-500" />
                            </label>
                            <label className="flex items-center justify-between cursor-pointer">
                                <span className="text-sm font-medium text-slate-300">¿Usa Armas?</span>
                                <input type="checkbox" checked={editingChar.uses_weapon || false} onChange={(e) => setEditingChar({ ...editingChar, uses_weapon: e.target.checked })} className="w-5 h-5 accent-orange-500" />
                            </label>
                            <label className="flex items-center justify-between cursor-pointer">
                                <span className="text-sm font-medium text-slate-300">¿Es Humano?</span>
                                <input type="checkbox" checked={editingChar.is_human || false} onChange={(e) => setEditingChar({ ...editingChar, is_human: e.target.checked })} className="w-5 h-5 accent-yellow-500" />
                            </label>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1">Especie / Rol (opcional)</label>
                            <input
                                type="text"
                                value={editingChar.species || ''}
                                onChange={(e) => setEditingChar({ ...editingChar, species: e.target.value })}
                                placeholder="Ej: Hobbit, Elfo, Humano, Programa..."
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500"
                            />
                            <p className="text-xs text-slate-500 mt-1">Si añades una especie, podrás crear preguntas específicas para ella.</p>
                        </div>

                        <div className="flex gap-2 justify-end pt-2">
                            <button type="button" onClick={() => setEditingChar(null)} className="px-4 py-2 rounded-lg text-slate-300 hover:bg-slate-700 transition">Cancelar</button>
                            <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 font-bold disabled:opacity-50 transition">
                                {saving ? 'Guardando...' : 'Guardar Cambios'}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}

function Badge({ children, color }: { children: React.ReactNode; color: 'green' | 'red' | 'purple' | 'blue' | 'gray' | 'yellow' }) {
    const colors = {
        green: 'bg-emerald-900/60 text-emerald-300 border-emerald-700/50',
        red: 'bg-red-900/60 text-red-300 border-red-700/50',
        purple: 'bg-purple-900/60 text-purple-300 border-purple-700/50',
        blue: 'bg-blue-900/60 text-blue-300 border-blue-700/50',
        gray: 'bg-slate-800 text-slate-300 border-slate-700',
        yellow: 'bg-yellow-900/60 text-yellow-300 border-yellow-700/50',
    };
    return <span className={`text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded border ${colors[color]}`}>{children}</span>;
}