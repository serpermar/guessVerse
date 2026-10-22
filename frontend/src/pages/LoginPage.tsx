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
        <div className="flex min-h-[calc(100vh-64px)] items-center justify-center bg-canvas px-4 text-fg">
            <form onSubmit={onSubmit} className="w-full max-w-sm space-y-3 rounded-xl border border-border bg-surface p-6 shadow-lg">
                <h1 className="text-2xl font-bold">Entrar</h1>
                <input
                    className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-fg placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-brand/60"
                    type="email"
                    placeholder="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                />
                <input
                    className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-fg placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-brand/60"
                    type="password"
                    placeholder="contraseña"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                />
                {err && <p className="text-sm text-red-500">{err}</p>}
                <button
                    disabled={loading}
                    className="w-full rounded-lg bg-brand-strong px-3 py-2 font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
                >
                    {loading ? 'Entrando...' : 'Entrar'}
                </button>
                <p className="text-sm text-muted">
                    ¿No tienes cuenta?{' '}
                    <Link to="/register" className="text-brand hover:opacity-90">Regístrate</Link>
                </p>
            </form>
        </div>
    );
}
