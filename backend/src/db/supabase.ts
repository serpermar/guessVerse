import { createClient } from '@supabase/supabase-js';
import { env } from '../config/env.js';

/**
 * Cliente Supabase con SERVICE_ROLE.
 * Solo se usa en el backend. Nunca debe llegar al frontend.
 */
export const supabaseAdmin = createClient(
    env.supabase.url,
    env.supabase.serviceRoleKey,
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    }
);