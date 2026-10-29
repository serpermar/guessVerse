import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, type CharacterDetail, type ThemeDetail } from '../services/api';
import { useGameStore } from '../stores/game.store';
import { Spinner } from '../components/ui/Spinner';

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
        'series': { label: 'Series', icon: '📺', color: 'bg-orange-900/60 text-orange-300 border-orange-700/50' },
        'anime': { label: 'Anime', icon: '🎌', color: 'bg-pink-900/60 text-pink-300 border-pink-700/50' },
        'superheroes': { label: 'Superhéroes', icon: '🦸', color: 'bg-red-900/60 text-red-300 border-red-700/50' },
        'videogames': { label: 'Videojuegos', icon: '🎮', color: 'bg-emerald-900/60 text-emerald-300 border-emerald-700/50' },
        'default': { label: 'Varios', icon: '📦', color: 'bg-slate-800 text-slate-300 border-slate-700' },
    };
    return map[type] || map['default'];
}

function CharacterAvatar({ c }: { c: CharacterDetail }) {
    const [imgError, setImgError] = useState(false);
    if (c.image_url && !imgError) {
        return <img src={c.image_url} alt={c.name} className="w-full h-full object-cover" onError={() => setImgError(true)} />;
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

    const [editingChar, setEditingChar] = useState<any | null>(null);
    const [saving, setSaving] = useState(false);

    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deleting, setDeleting] = useState(false);

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
            const payload = {
                is_hero: editingChar.is_hero || false,
                is_villain: editingChar.is_villain || false,
                is_protagonist: editingChar.is_protagonist || false,
                has_powers: editingChar.has_powers || false,
                uses_weapon: editingChar.uses_weapon || false,
                is_human: editingChar.is_human || false,
                attributes: {
                    ...editingChar.attributes,
                    species: editingChar.attributes?.species || null,
                    house: editingChar.attributes?.house || null,
                }
            };
            await api.updateCharacter(editingChar.id, payload as any);
            setEditingChar(null);
            loadDetail();
        } catch (err) {
            alert("Error guardando personaje: " + (err as Error).message);
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteTheme = async () => {
        if (!slug) return;
        setDeleting(true);
        try {
            await api.deleteTheme(slug);
            resetGame();
            nav('/', { replace: true });
        } catch (err) {
            alert("Error eliminando temática: " + (err as Error).message);
            setDeleting(false);
            setShowDeleteConfirm(false);
        }
    };

    if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><Spinner size="lg" text="Cargando temática..." /></div>;
    if (error) return <div className="p-8 text-red-400 text-center mt-10 font-bold">{error}</div>;
    if (!detail) return null;

    const { theme, characters, questions, schema } = detail;
    const typeBadge = getTypeBadge(theme.type);

    return (
        <div className="min-h-screen bg-slate-950 text-white p-4 sm:p-6">
            <div className="max-w-7xl mx-auto space-y-8">

                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-xl">
                    <div className="flex-1">
                        <Link to="/" className="text-sm font-medium text-slate-400 hover:text-purple-400 mb-3 inline-block transition">← Volver al inicio</Link>
                        <h1 className="text-3xl sm:text-4xl font-black bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent">{theme.name}</h1>
                        <p className="text-slate-400 mt-2 max-w-3xl leading-relaxed">{theme.description}</p>

                        <div className="mt-4 flex gap-3 text-sm font-medium text-slate-300 flex-wrap items-center">
                            <span className={`px-3 py-1 rounded-full border text-xs font-bold uppercase tracking-wider ${typeBadge.color}`}>
                                {typeBadge.icon} {typeBadge.label}
                            </span>
                            <span className="bg-slate-800 border border-slate-700 px-3 py-1 rounded-full">{characters.length} Personajes</span>
                            <span className="bg-slate-800 border border-slate-700 px-3 py-1 rounded-full">{questions.length} Preguntas</span>
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
                        <button onClick={() => setShowDeleteConfirm(true)} className="w-full sm:w-auto bg-slate-800 hover:bg-red-900/50 text-red-400 border border-slate-700 hover:border-red-700/50 px-4 py-4 rounded-xl font-bold transition-all whitespace-nowrap" title="Eliminar temática">🗑️</button>
                        <button onClick={startGame} disabled={starting} className="w-full sm:w-auto bg-pink-600 hover:bg-pink-500 disabled:opacity-50 px-8 py-4 rounded-xl font-bold text-lg shadow-lg shadow-pink-900/40 transition-all hover:-translate-y-0.5 whitespace-nowrap">
                            {starting ? 'Iniciando...' : '▶ Jugar ahora'}
                        </button>
                    </div>
                </div>

                <div className="relative max-w-2xl mx-auto">
                    <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="🔍 Buscar personaje por nombre..." className="w-full bg-slate-900 border border-slate-700 rounded-xl px-5 py-4 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 shadow-inner" />
                </div>

                <section>
                    <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-6">
                        <h2 className="text-2xl font-bold text-slate-200">Galería de Personajes</h2>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                        {filteredCharacters.map((c) => (
                            <div key={c.id} className="bg-slate-900 rounded-xl overflow-hidden group relative border border-slate-800 hover:border-purple-500/60 transition-all hover:-translate-y-1 hover:shadow-lg flex flex-col">
                                <div className="aspect-[3/4] relative overflow-hidden bg-slate-950">
                                    <CharacterAvatar c={c} />
                                    <button onClick={() => setEditingChar({ ...c, attributes: c.attributes || {} })} className="absolute bottom-2 right-2 bg-slate-900/90 hover:bg-purple-600 p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-all border border-slate-700/50 shadow-lg" title="Editar atributos">✏️</button>
                                </div>
                                <div className="p-3">
                                    <div className="text-sm font-bold truncate group-hover:text-purple-400 transition-colors">{c.name}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            </div>

            {/* MODAL DE EDICIÓN DE PERSONAJE */}
            {editingChar && (
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
                    <form onSubmit={handleSaveChar} className="bg-slate-900 rounded-2xl p-6 w-full max-w-md border border-slate-700 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-start">
                            <h3 className="text-xl font-bold flex items-center gap-2"><span>✏️</span> Editar personaje</h3>
                            <button type="button" onClick={() => setEditingChar(null)} className="text-slate-400 hover:text-white">✕</button>
                        </div>

                        <div className="text-sm font-semibold text-purple-400 bg-purple-900/20 px-3 py-2 rounded-lg border border-purple-800/50">{editingChar.name}</div>

                        <div className="space-y-4 bg-slate-950 p-4 rounded-xl border border-slate-800">

                            {schema.form.some((f: any) => f.key === 'is_hero') && (
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Rol</label>
                                    <div className="grid grid-cols-3 gap-2">
                                        <button type="button" onClick={() => setEditingChar({ ...editingChar, is_hero: true, is_villain: false })} className={`py-2 rounded-lg text-sm font-bold border transition ${editingChar.is_hero ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-400 hover:bg-slate-800'}`}>Héroe</button>
                                        <button type="button" onClick={() => setEditingChar({ ...editingChar, is_hero: false, is_villain: true })} className={`py-2 rounded-lg text-sm font-bold border transition ${editingChar.is_villain ? 'bg-red-600 border-red-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-400 hover:bg-slate-800'}`}>Villano</button>
                                        <button type="button" onClick={() => setEditingChar({ ...editingChar, is_hero: false, is_villain: false })} className={`py-2 rounded-lg text-sm font-bold border transition ${!editingChar.is_hero && !editingChar.is_villain ? 'bg-slate-600 border-slate-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-400 hover:bg-slate-800'}`}>Neutro</button>
                                    </div>
                                </div>
                            )}

                            {schema.form.map((field: any) => {
                                if (field.key === 'is_hero' || field.key === 'is_villain') return null;

                                return (
                                    <div key={field.key}>
                                        {field.type === 'boolean' ? (
                                            <label className="flex items-center gap-3 cursor-pointer p-2 rounded hover:bg-slate-800 transition">
                                                <input type="checkbox" checked={editingChar[field.key] || false} onChange={(e) => setEditingChar({ ...editingChar, [field.key]: e.target.checked })} className="w-4 h-4 accent-purple-500" />
                                                <span className="text-sm font-medium text-slate-300">{field.label}</span>
                                            </label>
                                        ) : (
                                            <div>
                                                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">{field.label}</label>
                                                <input
                                                    type="text"
                                                    value={editingChar.attributes[field.key] || ''}
                                                    onChange={(e) => setEditingChar({ ...editingChar, attributes: { ...editingChar.attributes, [field.key]: e.target.value } })}
                                                    placeholder={field.placeholder}
                                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-600 focus:border-purple-500 focus:outline-none"
                                                />
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        <div className="flex gap-3 justify-end pt-2">
                            <button type="button" onClick={() => setEditingChar(null)} className="px-5 py-2.5 rounded-lg font-medium text-slate-300 hover:bg-slate-800 transition">Cancelar</button>
                            <button type="submit" disabled={saving} className="px-5 py-2.5 rounded-lg bg-purple-600 hover:bg-purple-500 font-bold disabled:opacity-50 transition">{saving ? 'Guardando...' : 'Guardar'}</button>
                        </div>
                    </form>
                </div>
            )}

            {/* MODAL DE CONFIRMACIÓN DE BORRADO */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
                    <div className="bg-slate-900 rounded-2xl p-6 w-full max-w-sm border border-red-900/50 shadow-2xl text-center space-y-4">
                        <div className="text-5xl">⚠️</div>
                        <h3 className="text-xl font-bold text-red-400">¿Eliminar temática?</h3>
                        <p className="text-sm text-slate-400">Estás a punto de borrar <strong>{theme.name}</strong> y todos sus personajes. Esta acción no se puede deshacer.</p>
                        <div className="flex gap-3 justify-center pt-2">
                            <button onClick={() => setShowDeleteConfirm(false)} disabled={deleting} className="px-5 py-2.5 rounded-lg font-medium text-slate-300 hover:bg-slate-800 transition disabled:opacity-50">Cancelar</button>
                            <button onClick={handleDeleteTheme} disabled={deleting} className="px-5 py-2.5 rounded-lg bg-red-600 hover:bg-red-500 font-bold text-white disabled:opacity-50 transition shadow-lg shadow-red-900/30 flex items-center justify-center min-w-[100px]">
                                {deleting ? 'Borrando...' : 'Sí, eliminar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}