import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthProvider';

export function LoginPage() {
    const { signIn } = useAuth();
    const nav = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [err, setErr] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault();
        setErr(null);
        setLoading(true);
        try {
            await signIn(email, password);
            nav('/profile', { replace: true });
        } catch (e) {
            setErr((e as Error).message);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4">
            <form onSubmit={onSubmit} className="bg-slate-800 p-6 rounded-xl w-full max-w-sm space-y-3">
                <h1 className="text-2xl font-bold">Entrar</h1>
                <input
                    className="w-full p-2 rounded bg-slate-700"
                    type="email"
                    placeholder="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                />
                <input
                    className="w-full p-2 rounded bg-slate-700"
                    type="password"
                    placeholder="contraseña"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                />
                {err && <p className="text-red-400 text-sm">{err}</p>}
                <button
                    disabled={loading}
                    className="w-full bg-purple-500 hover:bg-purple-600 disabled:opacity-50 p-2 rounded font-semibold"
                >
                    {loading ? 'Entrando…' : 'Entrar'}
                </button>
                <p className="text-sm text-slate-400">
                    ¿No tienes cuenta?{' '}
                    <Link to="/register" className="text-purple-400">Regístrate</Link>
                </p>
            </form>
        </div>
    );
}