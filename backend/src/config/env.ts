function required(name: string): string {
    const value = process.env[name];
    if (!value || value.trim() === '') {
        throw new Error(
            `❌ Falta la variable de entorno "${name}". Revisa backend/.env`
        );
    }
    return value;
}

export const env = {
    nodeEnv: process.env.NODE_ENV ?? 'development',
    port: Number(process.env.PORT) || 3000,
    tmdb: {
        accessToken: required('TMDB_ACCESS_TOKEN'),
    },
    supabase: {
        url: required('SUPABASE_URL'),
        serviceRoleKey: required('SUPABASE_SERVICE_ROLE_KEY'),
    },
} as const;