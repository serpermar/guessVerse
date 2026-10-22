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

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault();
        setErr(null); setMsg(null);
        try {
            await signUp(email, password, username);
            setMsg('Revisa tu correo para confirmar la cuenta.');
        } catch (e) {
            setErr((e as Error).message);
        }
    }

    return (
        <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4">
            <form onSubmit={onSubmit} className="bg-slate-800 p-6 rounded-xl w-full max-w-sm space-y-3">
                <h1 className="text-2xl font-bold">Crear cuenta</h1>
                <input className="w-full p-2 rounded bg-slate-700" placeholder="username"
                    value={username} onChange={(e) => setUsername(e.target.value)} required minLength={3} maxLength={20} />
                <input className="w-full p-2 rounded bg-slate-700" type="email" placeholder="email"
                    value={email} onChange={(e) => setEmail(e.target.value)} required />
                <input className="w-full p-2 rounded bg-slate-700" type="password" placeholder="contraseña (mín. 6)"
                    value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
                {err && <p className="text-red-400 text-sm">{err}</p>}
                {msg && <p className="text-emerald-400 text-sm">{msg}</p>}
                <button className="w-full bg-purple-500 hover:bg-purple-600 p-2 rounded font-semibold">Registrarme</button>
                <p className="text-sm text-slate-400">¿Ya tienes cuenta? <Link to="/login" className="text-purple-400">Entrar</Link></p>
            </form>
        </div>
    );
}