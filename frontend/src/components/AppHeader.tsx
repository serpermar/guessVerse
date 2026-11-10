import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthProvider';
import { ThemeToggle } from './ThemeToggle';

export function AppHeader() {
    const { user, signOut } = useAuth();
    const nav = useNavigate();

    const handleLogout = async () => {
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
                    <ThemeToggle />

                    {user ? (
                        <>
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
                            <Link to="/profile" className="hidden text-sm font-medium text-muted transition hover:text-brand sm:inline">
                                Mi perfil
                            </Link>
                            <button
                                onClick={handleLogout}
                                className="hidden text-sm font-medium text-muted transition hover:text-red-400 sm:inline"
                            >
                                Salir
                            </button>
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
