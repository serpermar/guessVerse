import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, type CharacterDetail, type ThemeDetail } from '../services/api';
import { useGameStore } from '../stores/game.store';
import { Spinner } from '../components/ui/Spinner';

type EditableCharacter = CharacterDetail & Record<string, unknown>;

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
        'movies': { label: 'Películas', icon: '🎬', color: 'bg-blue-500/10 text-blue-600 dark:text-blue-300 border-blue-500/30' },
        'series': { label: 'Series', icon: '📺', color: 'bg-orange-500/10 text-orange-600 dark:text-orange-300 border-orange-500/30' },
        'anime': { label: 'Anime', icon: '🎌', color: 'bg-pink-500/10 text-pink-600 dark:text-pink-300 border-pink-500/30' },
        'superheroes': { label: 'Superhéroes', icon: '🦸', color: 'bg-red-500/10 text-red-600 dark:text-red-300 border-red-500/30' },
        'videogames': { label: 'Videojuegos', icon: '🎮', color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 border-emerald-500/30' },
        'default': { label: 'Varios', icon: '📦', color: 'bg-surface-2 text-muted border-border' },
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

    const [editingChar, setEditingChar] = useState<EditableCharacter | null>(null);
    const [saving, setSaving] = useState(false);
    const [actionError, setActionError] = useState<string | null>(null);

    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deleting, setDeleting] = useState(false);

    const [showAddQuestion, setShowAddQuestion] = useState(false);
    const [newQuestionText, setNewQuestionText] = useState('');
    const [newQuestionAttr, setNewQuestionAttr] = useState('');
    const [savingQuestion, setSavingQuestion] = useState(false);

    const fetchDetail = useCallback(async () => {
        if (!slug) return null;
        return api.themeDetail(slug);
    }, [slug]);

    const loadDetail = useCallback(async () => {
        try {
            const data = await fetchDetail();
            if (data) {
                setDetail(data);
                setError(null);
            }
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setLoading(false);
        }
    }, [fetchDetail]);

    useEffect(() => {
        let active = true;
        fetchDetail()
            .then((data) => {
                if (!active || !data) return;
                setDetail(data);
                setError(null);
            })
            .catch((e: Error) => { if (active) setError(e.message); })
            .finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [fetchDetail]);

    const filteredCharacters = useMemo(() => {
        if (!detail) return [];
        const q = search.trim().toLowerCase();
        if (!q) return detail.characters;
        return detail.characters.filter((c) => c.name.toLowerCase().includes(q));
    }, [detail, search]);

    const handlePlay = (size: number, mode?: 'timed') => {
        if (!slug) return;
        resetGame();
        const url = `/game/${slug}?size=${size}${mode === 'timed' ? '&mode=timed' : ''}`;
        nav(url);
    };

    const handleSaveChar = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingChar) return;
        setSaving(true);
        setActionError(null);
        try {
            const rootBooleans = ['is_hero', 'is_villain', 'is_protagonist', 'has_powers', 'uses_weapon', 'is_human'];
            const dynamicAttributes: Record<string, unknown> = { ...(editingChar.attributes ?? {}) };
            detail?.schema.form.forEach((field) => {
                if (field.type === 'boolean' && !rootBooleans.includes(field.key)) {
                    dynamicAttributes[field.key] = Boolean(editingChar[field.key]);
                }
            });

            const payload: Partial<CharacterDetail> = {
                gender: editingChar.gender ?? 'unknown',
                species: editingChar.species ?? null,
                is_hero: Boolean(editingChar.is_hero),
                is_villain: Boolean(editingChar.is_villain),
                is_protagonist: Boolean(editingChar.is_protagonist),
                has_powers: Boolean(editingChar.has_powers),
                uses_weapon: Boolean(editingChar.uses_weapon),
                is_human: Boolean(editingChar.is_human),
                attributes: {
                    ...dynamicAttributes,
                    species: editingChar.attributes?.species ?? null,
                    house: editingChar.attributes?.house ?? null,
                } as Record<string, string | number | boolean | null>,
            };
            await api.updateCharacter(editingChar.id, payload);
            setEditingChar(null);
            await loadDetail();
        } catch (err) {
            setActionError(`Error guardando personaje: ${(err as Error).message}`);
        } finally { setSaving(false); }
    };

    const handleDeleteTheme = async () => {
        if (!slug) return;
        setDeleting(true);
        setActionError(null);
        try {
            await api.deleteTheme(slug);
            resetGame();
            nav('/', { replace: true });
        } catch (err) {
            setActionError(`Error eliminando temática: ${(err as Error).message}`);
            setDeleting(false);
            setShowDeleteConfirm(false);
        }
    };

    const handleCreateQuestion = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!slug) return;
        setSavingQuestion(true);
        setActionError(null);
        try {
            await api.createQuestion(slug, newQuestionText, newQuestionAttr);
            setShowAddQuestion(false);
            setNewQuestionText('');
            setNewQuestionAttr('');
            await loadDetail();
        } catch (err) {
            setActionError(`Error: ${(err as Error).message}`);
        } finally { setSavingQuestion(false); }
    };

    if (loading) return <div className="flex min-h-screen items-center justify-center bg-canvas"><Spinner size="lg" text="Cargando temática..." /></div>;
    if (error) return <div className="mt-10 p-8 text-center font-bold text-red-500">{error}</div>;
    if (!detail) return null;

    const { theme, characters, questions, schema } = detail;
    const typeBadge = getTypeBadge(theme.type);

    return (
        <div className="min-h-screen bg-canvas p-4 text-fg sm:p-6">
            <div className="mx-auto max-w-7xl space-y-8">
                <div className="flex flex-col items-start justify-between gap-6 rounded-2xl border border-border bg-surface p-6 shadow-xl lg:flex-row lg:items-center">
                    <div className="flex-1">
                        <Link to="/" className="mb-3 inline-block text-sm font-medium text-muted transition hover:text-brand">← Volver al inicio</Link>
                        <h1 className="text-brand-gradient text-3xl font-black sm:text-4xl">{theme.name}</h1>
                        <p className="mt-2 max-w-3xl leading-relaxed text-muted">{theme.description}</p>
                        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm font-medium text-fg">
                            <span className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wider ${typeBadge.color}`}>{typeBadge.icon} {typeBadge.label}</span>
                            <span className="rounded-full border border-border bg-surface-2 px-3 py-1">{characters.length} Personajes</span>
                            <span className="rounded-full border border-border bg-surface-2 px-3 py-1">{questions.length} Preguntas</span>
                        </div>
                    </div>

                    <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
                        <button onClick={() => setShowDeleteConfirm(true)} className="w-full rounded-xl border border-border bg-surface-2 px-4 py-4 font-bold text-red-500 transition-all hover:border-red-500/50 hover:bg-red-500/10 sm:w-auto" title="Eliminar temática">🗑️</button>
                        <button onClick={() => handlePlay(8)} className="w-full whitespace-nowrap rounded-xl bg-blue-600 px-4 py-4 text-sm font-bold text-white shadow-lg shadow-blue-900/20 transition-all hover:-translate-y-0.5 hover:bg-blue-500 sm:w-auto">
                            ⚡ Partida Rápida (8)
                        </button>
                        <button onClick={() => handlePlay(16, 'timed')} className="w-full whitespace-nowrap rounded-xl bg-amber-600 px-4 py-4 text-sm font-bold text-white shadow-lg shadow-amber-900/20 transition-all hover:-translate-y-0.5 hover:bg-amber-500 sm:w-auto">
                            ⏱️ Contrarreloj (60s)
                        </button>
                        <button onClick={() => handlePlay(16)} className="w-full whitespace-nowrap rounded-xl bg-accent px-8 py-4 text-lg font-bold text-white shadow-lg shadow-brand/20 transition-all hover:-translate-y-0.5 hover:opacity-90 sm:w-auto">
                            ▶ Partida Clásica (16)
                        </button>
                    </div>
                </div>

                {actionError && (
                    <div role="alert" className="flex items-center justify-between gap-3 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm font-semibold text-red-600 dark:text-red-300">
                        <span>⚠️ {actionError}</span>
                        <button onClick={() => setActionError(null)} aria-label="Cerrar error" className="hover:opacity-70">✕</button>
                    </div>
                )}

                <div className="relative mx-auto max-w-2xl">
                    <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="🔍 Buscar personaje por nombre..." className="w-full rounded-xl border border-border bg-surface px-5 py-4 text-fg placeholder-muted shadow-inner focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand" />
                </div>

                <section>
                    <div className="mb-6 flex items-center justify-between border-b border-border pb-3">
                        <h2 className="text-2xl font-bold text-fg">Galería de Personajes</h2>
                    </div>
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                        {filteredCharacters.map((c) => (
                            <div key={c.id} className="group relative flex flex-col overflow-hidden rounded-xl border border-border bg-surface transition-all hover:-translate-y-1 hover:border-brand/60 hover:shadow-lg">
                                <div className="relative aspect-[3/4] overflow-hidden bg-canvas">
                                    <CharacterAvatar c={c} />
                                    <button onClick={() => setEditingChar({ ...c, attributes: c.attributes || {} })} className="absolute bottom-2 right-2 rounded-lg border border-border bg-surface/90 p-2 opacity-0 shadow-lg transition-all hover:bg-brand hover:text-white group-hover:opacity-100" title="Editar atributos">✏️</button>
                                </div>
                                <div className="p-3">
                                    <div className="truncate text-sm font-bold transition-colors group-hover:text-brand">{c.name}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                <section>
                    <div className="mb-4 flex items-center justify-between border-b border-border pb-2">
                        <h2 className="text-2xl font-bold text-fg">Preguntas Disponibles</h2>
                        <button onClick={() => setShowAddQuestion(true)} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-bold text-white transition hover:bg-emerald-500">+ Añadir Pregunta</button>
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                        {questions.map((q) => (
                            <div key={q.code} className="rounded-lg border border-border bg-surface-2 px-4 py-3 text-sm">{q.text_es}</div>
                        ))}
                    </div>
                </section>
            </div>

            {/* MODAL DE EDICIÓN DE PERSONAJE */}
            {editingChar && (
                <div className="fixed inset-0 z-50 flex animate-fade-in items-center justify-center bg-canvas/80 p-4 backdrop-blur-sm">
                    <form onSubmit={handleSaveChar} className="max-h-[90vh] w-full max-w-md space-y-5 overflow-y-auto rounded-2xl border border-border bg-surface p-6 shadow-2xl">
                        <div className="flex items-start justify-between">
                            <h3 className="flex items-center gap-2 text-xl font-bold"><span>✏️</span> Editar personaje</h3>
                            <button type="button" onClick={() => setEditingChar(null)} className="text-muted transition hover:text-fg">✕</button>
                        </div>
                        <div className="rounded-lg border border-brand/30 bg-brand/10 px-3 py-2 text-sm font-semibold text-brand">{editingChar.name}</div>
                        <div className="space-y-4 rounded-xl border border-border bg-canvas p-4">
                            {schema.form.some((f) => f.key === 'is_hero') && (
                                <div>
                                    <label className="mb-2 block text-xs font-bold uppercase text-muted">Rol</label>
                                    <div className="grid grid-cols-3 gap-2">
                                        <button type="button" onClick={() => setEditingChar({ ...editingChar, is_hero: true, is_villain: false })} className={`rounded-lg border py-2 text-sm font-bold transition ${editingChar.is_hero ? 'border-emerald-500 bg-emerald-600 text-white' : 'border-border bg-surface text-muted hover:bg-surface-2'}`}>Héroe</button>
                                        <button type="button" onClick={() => setEditingChar({ ...editingChar, is_hero: false, is_villain: true })} className={`rounded-lg border py-2 text-sm font-bold transition ${editingChar.is_villain ? 'border-red-500 bg-red-600 text-white' : 'border-border bg-surface text-muted hover:bg-surface-2'}`}>Villano</button>
                                        <button type="button" onClick={() => setEditingChar({ ...editingChar, is_hero: false, is_villain: false })} className={`rounded-lg border py-2 text-sm font-bold transition ${!editingChar.is_hero && !editingChar.is_villain ? 'border-border bg-surface-2 text-fg' : 'border-border bg-surface text-muted hover:bg-surface-2'}`}>Neutro</button>
                                    </div>
                                </div>
                            )}

                            {schema.form.map((field) => {
                                if (field.key === 'is_hero' || field.key === 'is_villain') return null;

                                return (
                                    <div key={field.key}>
                                        {field.type === 'boolean' ? (
                                            <label className="flex cursor-pointer items-center gap-3 rounded p-2 transition hover:bg-surface-2">
                                                <input type="checkbox" checked={Boolean(editingChar[field.key])} onChange={(e) => setEditingChar({ ...editingChar, [field.key]: e.target.checked })} className="h-4 w-4 accent-brand" />
                                                <span className="text-sm font-medium text-fg">{field.label}</span>
                                            </label>
                                        ) : field.type === 'select' ? (
                                            <div>
                                                <label className="mb-1 block text-xs font-bold uppercase text-muted">{field.label}</label>
                                                <select
                                                    value={String(editingChar[field.key] ?? 'unknown')}
                                                    onChange={(e) => setEditingChar({ ...editingChar, [field.key]: e.target.value })}
                                                    className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-fg focus:border-brand focus:outline-none"
                                                >
                                                    {field.options?.map((opt: string) => (
                                                        <option key={opt} value={opt}>
                                                            {opt === 'male' ? 'Hombre' : opt === 'female' ? 'Mujer' : 'Desconocido'}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                        ) : (
                                            <div>
                                                <label className="mb-1 block text-xs font-bold uppercase text-muted">{field.label}</label>
                                                <input type="text" value={String(editingChar.attributes?.[field.key] ?? editingChar[field.key] ?? '')} onChange={(e) => setEditingChar({ ...editingChar, attributes: { ...editingChar.attributes, [field.key]: e.target.value } })} placeholder={field.placeholder} className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-fg placeholder-muted focus:border-brand focus:outline-none" />
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                        <div className="flex justify-end gap-3 pt-2">
                            <button type="button" onClick={() => setEditingChar(null)} className="rounded-lg px-5 py-2.5 font-medium text-muted transition hover:bg-surface-2">Cancelar</button>
                            <button type="submit" disabled={saving} className="rounded-lg bg-brand px-5 py-2.5 font-bold text-white transition hover:opacity-90 disabled:opacity-50">{saving ? 'Guardando...' : 'Guardar'}</button>
                        </div>
                    </form>
                </div>
            )}

            {/* MODAL DE CONFIRMACIÓN DE BORRADO */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 z-50 flex animate-fade-in items-center justify-center bg-canvas/80 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-sm space-y-4 rounded-2xl border border-red-500/40 bg-surface p-6 text-center shadow-2xl">
                        <div className="text-5xl">⚠️</div>
                        <h3 className="text-xl font-bold text-red-500">¿Eliminar temática?</h3>
                        <p className="text-sm text-muted">Estás a punto de borrar <strong>{theme.name}</strong> y todos sus personajes. Esta acción no se puede deshacer.</p>
                        <div className="flex justify-center gap-3 pt-2">
                            <button onClick={() => setShowDeleteConfirm(false)} disabled={deleting} className="rounded-lg px-5 py-2.5 font-medium text-muted transition hover:bg-surface-2 disabled:opacity-50">Cancelar</button>
                            <button onClick={handleDeleteTheme} disabled={deleting} className="flex min-w-[100px] items-center justify-center rounded-lg bg-red-600 px-5 py-2.5 font-bold text-white shadow-lg shadow-red-900/30 transition hover:bg-red-500 disabled:opacity-50">{deleting ? 'Borrando...' : 'Sí, eliminar'}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL AÑADIR PREGUNTA */}
            {showAddQuestion && (
                <div className="fixed inset-0 z-50 flex animate-fade-in items-center justify-center bg-canvas/80 p-4 backdrop-blur-sm">
                    <form onSubmit={handleCreateQuestion} className="w-full max-w-md space-y-4 rounded-2xl border border-emerald-500/40 bg-surface p-6 shadow-2xl">
                        <h3 className="text-xl font-bold text-emerald-600 dark:text-emerald-400">Nueva Pregunta</h3>
                        <p className="text-sm text-muted">Esta pregunta aparecerá solo en esta temática.</p>
                        <div>
                            <label className="mb-1 block text-xs font-bold uppercase text-muted">Texto de la pregunta</label>
                            <input type="text" value={newQuestionText} onChange={(e) => setNewQuestionText(e.target.value)} placeholder="Ej: ¿Trabaja en Dunder Mifflin?" className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-fg placeholder-muted focus:border-brand focus:outline-none" required />
                        </div>
                        <div>
                            <label className="mb-1 block text-xs font-bold uppercase text-muted">Atributo técnico (sin espacios)</label>
                            <input type="text" value={newQuestionAttr} onChange={(e) => setNewQuestionAttr(e.target.value.replace(/\s+/g, '_').toLowerCase())} placeholder="Ej: works_dunder_mifflin" className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-fg placeholder-muted focus:border-brand focus:outline-none" required />
                            <p className="mt-1 text-[10px] text-muted">Se usará para evaluar si el personaje cumple la condición.</p>
                        </div>
                        <div className="flex justify-end gap-3 pt-2">
                            <button type="button" onClick={() => setShowAddQuestion(false)} className="rounded-lg px-4 py-2 text-muted transition hover:bg-surface-2">Cancelar</button>
                            <button type="submit" disabled={savingQuestion} className="rounded-lg bg-emerald-600 px-4 py-2 font-bold text-white transition hover:bg-emerald-500 disabled:opacity-50">{savingQuestion ? 'Creando...' : 'Crear Pregunta'}</button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}