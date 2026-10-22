import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export function AuthCallbackPage() {
    const nav = useNavigate();

    useEffect(() => {
        (async () => {
            const params = new URLSearchParams(window.location.search);
            const token_hash = params.get('token_hash');
            const type = params.get('type') as 'signup' | 'email' | null;

            if (token_hash && type) {
                const { error } = await supabase.auth.verifyOtp({ token_hash, type });
                if (!error) {
                    nav('/profile', { replace: true });
                    return;
                }
            }
            nav('/login?error=confirm', { replace: true });
        })();
    }, [nav]);

    return (
        <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
            <p>Confirmando tu cuenta…</p>
        </div>
    );
}