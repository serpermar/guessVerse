import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthProvider';
import { useEffect, useState } from 'react';

export function AppHeader() {
    const { user, signOut } = useAuth();
    const nav = useNavigate();
    const [isDark, setIsDark] = useState(true);

    useEffect(() => {
        document.documentElement.classList.toggle('dark', isDark);
    }, [isDark]);

    const handleLogout = async () => {
        await signOut();
        nav('/login');
    };

    return (
        <header className="bg-slate-900 border-b border-slate-800 p-4 flex justify-between items-center text-white sticky top-0 z-50">
            <Link to="/" className="text-xl font-black bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent hover:opacity-80 transition">
                GuessVerse
            </Link>

            <div className="flex gap-3 items-center">
                <button onClick={() => setIsDark(!isDark)} className="text-xl">
                    {isDark ? '☀️' : '🌙'}
                </button>
                {user ? (
                    <>
                        <Link to="/leaderboard" className="text-sm font-semibold bg-amber-600/20 text-amber-300 hover:bg-amber-600/40 px-3 py-1.5 rounded-lg border border-amber-500/30 transition flex items-center gap-1">
                            <span>🏆</span> Ranking
                        </Link>
                        <Link to="/discover" className="text-sm font-semibold bg-purple-600/20 text-purple-300 hover:bg-purple-600/40 px-3 py-1.5 rounded-lg border border-purple-500/30 transition flex items-center gap-1">
                            <span>✨</span> Descubrir
                        </Link>
                        <Link to="/lobby" className="text-sm font-semibold bg-blue-600/20 text-blue-300 hover:bg-blue-600/40 px-3 py-1.5 rounded-lg border border-blue-500/30 transition flex items-center gap-1">
                            <span>⚔️</span> Multijugador
                        </Link>
                        <Link to="/profile" className="text-sm font-medium hover:text-purple-400 transition">
                            Mi perfil
                        </Link>
                        <button onClick={handleLogout} className="text-sm font-medium text-slate-400 hover:text-red-400 transition">
                            Salir
                        </button>
                    </>
                ) : (
                    <>
                        <Link to="/login" className="text-sm font-medium hover:text-purple-400 transition">Entrar</Link>
                        <Link to="/register" className="text-sm bg-purple-600 hover:bg-purple-500 px-4 py-1.5 rounded-lg font-semibold transition">Registrarse</Link>
                    </>
                )}
            </div>
        </header>
    );
}