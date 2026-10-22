import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export function AuthCallbackPage() {
    const nav = useNavigate();
    const [message, setMessage] = useState('Confirmando tu cuenta...');

    useEffect(() => {
        (async () => {
            const params = new URLSearchParams(window.location.search);
            const token_hash = params.get('token_hash');
            const type = params.get('type') as 'signup' | 'email' | 'recovery' | null;

            if (token_hash && type) {
                const { error } = await supabase.auth.verifyOtp({ token_hash, type });
                if (!error) {
                    nav('/profile', { replace: true });
                    return;
                }
                setMessage('No se pudo confirmar la cuenta.');
                setTimeout(() => nav('/login?error=confirm', { replace: true }), 1500);
                return;
            }

            // También puede venir por URL hash/PKCE
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                nav('/profile', { replace: true });
                return;
            }

            nav('/login?error=confirm', { replace: true });
        })();
    }, [nav]);

    return (
        <div className="flex min-h-[calc(100vh-64px)] items-center justify-center bg-canvas text-fg">
            <p className="text-muted">{message}</p>
        </div>
    );
}
