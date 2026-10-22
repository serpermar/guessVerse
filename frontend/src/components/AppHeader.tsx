import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthProvider';

export function AppHeader() {
    const { user, signOut } = useAuth();
    const nav = useNavigate();

    const handleLogout = async () => {
        await signOut();
        nav('/login');
    };

    return (
        <header className="bg-slate-900 border-b border-slate-800 p-4 flex justify-between items-center text-white">
            <Link to="/" className="text-xl font-bold bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent">
                GuessVerse
            </Link>

            <div className="flex gap-4 items-center">
                {user ? (
                    <>
                        <Link to="/profile" className="text-sm hover:text-purple-400">
                            Mi perfil
                        </Link>
                        <button onClick={handleLogout} className="text-sm text-red-400 hover:text-red-300">
                            Cerrar sesión
                        </button>
                    </>
                ) : (
                    <>
                        <Link to="/login" className="text-sm hover:text-purple-400">
                            Entrar
                        </Link>
                        <Link to="/register" className="text-sm bg-purple-600 hover:bg-purple-500 px-3 py-1 rounded-md">
                            Registrarse
                        </Link>
                    </>
                )}
            </div>
        </header>
    );
}