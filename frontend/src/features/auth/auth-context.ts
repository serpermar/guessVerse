import { createContext, useContext } from 'react';
import type { Session, User } from '@supabase/supabase-js';

export interface AuthCtx {
    user: User | null;
    session: Session | null;
    loading: boolean;
    signIn: (email: string, password: string) => Promise<void>;
    signUp: (email: string, password: string, username: string) => Promise<void>;
    signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthCtx | null>(null);

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth fuera de AuthProvider');
    return ctx;
}
