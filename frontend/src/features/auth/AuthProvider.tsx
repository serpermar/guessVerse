import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';

interface AuthCtx {
    user: User | null;
    session: Session | null;
    loading: boolean;
    signIn: (email: string, password: string) => Promise<void>;
    signUp: (email: string, password: string, username: string) => Promise<void>;
    signOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        supabase.auth.getSession().then(({ data }) => {
            setSession(data.session);
            setUser(data.session?.user ?? null);
            setLoading(false);
        });
        const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
            setSession(s);
            setUser(s?.user ?? null);
        });
        return () => sub.subscription.unsubscribe();
    }, []);

    async function signIn(email: string, password: string) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw new Error(error.message);
    }

    async function signUp(email: string, password: string, username: string) {
        const { error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: { username }, // ← el trigger lo lee de raw_user_meta_data
                emailRedirectTo: `${window.location.origin}/auth/callback`,
            },
        });
        if (error) throw new Error(error.message);
    }

    async function signOut() {
        await supabase.auth.signOut();
    }

    return (
        <Ctx.Provider value={{ user, session, loading, signIn, signUp, signOut }}>
            {children}
        </Ctx.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(Ctx);
    if (!ctx) throw new Error('useAuth fuera de AuthProvider');
    return ctx;
}