import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../features/auth/auth-context';
import { SoundToggle } from './SoundToggle';
import { ThemeToggle } from './ThemeToggle';

export function AppHeader() {
    const { user, signOut } = useAuth();
    const nav = useNavigate();
    const [menuOpen, setMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const closeMenu = () => setMenuOpen(false);

    useEffect(() => {
        if (!menuOpen) return;

        const onPointerDown = (event: PointerEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setMenuOpen(false);
            }
        };
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setMenuOpen(false);
        };

        document.addEventListener('pointerdown', onPointerDown);
        document.addEventListener('keydown', onKeyDown);
        return () => {
            document.removeEventListener('pointerdown', onPointerDown);
            document.removeEventListener('keydown', onKeyDown);
        };
    }, [menuOpen]);

    const handleLogout = async () => {
        setMenuOpen(false);
        await signOut();
        nav('/login');
    };

    return (
        <header className="sticky top-0 z-50 border-b border-border bg-surface/90 text-fg backdrop-blur-md">
            <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3">
                <Link to="/" className="group flex shrink-0 items-center gap-2.5" aria-label="guessVerse — Inicio">
                    <img
                        src="/icon-192.png"
                        alt=""
                        className="h-9 w-9 rounded-xl ring-1 ring-brand/40 transition group-hover:scale-105"
                    />
                    <span className="text-xl font-black tracking-tight text-brand-gradient">guessVerse</span>
                </Link>

                <div className="flex items-center gap-2 sm:gap-3">
                    <SoundToggle />
                    <ThemeToggle />

                    {user ? (
                        <>
                            <div className="hidden items-center gap-2 sm:flex sm:gap-3">
                                <Link
                                    to="/leaderboard"
                                    title="Ranking"
                                    className="inline-flex items-center gap-1 rounded-lg border border-accent-warm/30 bg-accent-warm/10 px-2.5 py-1.5 text-sm font-semibold text-accent-warm transition hover:bg-accent-warm/20"
                                >
                                    <span aria-hidden>🏆</span>
                                    <span className="hidden md:inline">Ranking</span>
                                </Link>
                                <Link
                                    to="/discover"
                                    title="Descubrir"
                                    className="inline-flex items-center gap-1 rounded-lg border border-brand/40 bg-brand/10 px-2.5 py-1.5 text-sm font-semibold text-brand transition hover:bg-brand/20"
                                >
                                    <span aria-hidden>✨</span>
                                    <span className="hidden md:inline">Descubrir</span>
                                </Link>
                                <Link
                                    to="/lobby"
                                    title="Multijugador"
                                    className="inline-flex items-center gap-1 rounded-lg border border-accent/40 bg-accent/10 px-2.5 py-1.5 text-sm font-semibold text-accent transition hover:bg-accent/20"
                                >
                                    <span aria-hidden>⚔️</span>
                                    <span className="hidden md:inline">Multijugador</span>
                                </Link>
                                <Link to="/profile" className="text-sm font-medium text-muted transition hover:text-brand">
                                    Mi perfil
                                </Link>
                                <button
                                    onClick={handleLogout}
                                    className="text-sm font-medium text-muted transition hover:text-red-400"
                                >
                                    Salir
                                </button>
                            </div>

                            <div ref={menuRef} className="relative sm:hidden">
                                <button
                                    type="button"
                                    onClick={() => setMenuOpen((value) => !value)}
                                    aria-label="Abrir menú de navegación"
                                    aria-expanded={menuOpen}
                                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface-2 text-lg text-muted transition hover:text-fg"
                                >
                                    <span aria-hidden>{menuOpen ? '✕' : '☰'}</span>
                                </button>

                                {menuOpen && (
                                    <div className="absolute right-0 z-50 mt-2 w-56 animate-pop-in space-y-1 rounded-xl border border-border bg-surface p-2 shadow-2xl">
                                        <Link to="/leaderboard" onClick={closeMenu} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-accent-warm transition hover:bg-surface-2">
                                            <span aria-hidden>🏆</span> Ranking
                                        </Link>
                                        <Link to="/discover" onClick={closeMenu} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-brand transition hover:bg-surface-2">
                                            <span aria-hidden>✨</span> Descubrir
                                        </Link>
                                        <Link to="/lobby" onClick={closeMenu} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-accent transition hover:bg-surface-2">
                                            <span aria-hidden>⚔️</span> Multijugador
                                        </Link>
                                        <div className="my-1 border-t border-border" />
                                        <Link to="/profile" onClick={closeMenu} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted transition hover:bg-surface-2 hover:text-fg">
                                            <span aria-hidden>👤</span> Mi perfil
                                        </Link>
                                        <button
                                            type="button"
                                            onClick={handleLogout}
                                            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-muted transition hover:bg-red-500/10 hover:text-red-500"
                                        >
                                            <span aria-hidden>🚪</span> Salir
                                        </button>
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        <>
                            <Link to="/login" className="text-sm font-medium text-muted transition hover:text-brand">
                                Entrar
                            </Link>
                            <Link
                                to="/register"
                                className="rounded-lg bg-brand-gradient px-4 py-1.5 text-sm font-bold text-white shadow-lg shadow-brand/20 transition hover:opacity-90"
                            >
                                Registrarse
                            </Link>
                        </>
                    )}
                </div>
            </div>
        </header>
    );
}
