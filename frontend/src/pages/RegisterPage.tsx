import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthProvider';

export function RegisterPage() {
    const { signUp } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [username, setUsername] = useState('');
    const [msg, setMsg] = useState<string | null>(null);
    const [err, setErr] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault();
        setErr(null);
        setMsg(null);
        setLoading(true);
        try {
            await signUp(email, password, username);
            setMsg('Revisa tu correo para confirmar la cuenta.');
        } catch (e) {
            setErr((e as Error).message);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="flex min-h-[calc(100vh-64px)] items-center justify-center bg-canvas px-4 text-fg">
            <form onSubmit={onSubmit} className="w-full max-w-sm space-y-3 rounded-xl border border-border bg-surface p-6 shadow-lg">
                <h1 className="text-2xl font-bold">Crear cuenta</h1>
                <input
                    className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-fg placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-brand/60"
                    placeholder="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    minLength={3}
                    maxLength={20}
                />
                <input
                    className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-fg placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-brand/60"
                    type="email"
                    placeholder="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                />
                <input
                    className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-fg placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-brand/60"
                    type="password"
                    placeholder="contraseña (mín. 6)"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                />
                {err && <p className="text-sm text-red-500">{err}</p>}
                {msg && <p className="text-sm text-emerald-500">{msg}</p>}
                <button
                    disabled={loading}
                    className="w-full rounded-lg bg-brand-strong px-3 py-2 font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
                >
                    {loading ? 'Registrando...' : 'Registrarme'}
                </button>
                <p className="text-sm text-muted">
                    ¿Ya tienes cuenta?{' '}
                    <Link to="/login" className="text-brand hover:opacity-90">Entrar</Link>
                </p>
            </form>
        </div>
    );
}
