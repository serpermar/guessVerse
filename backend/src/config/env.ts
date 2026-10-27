function required(name: string): string {
    const value = process.env[name];
    if (!value || value.trim() === '') {
        throw new Error(
            `❌ Falta la variable de entorno "${name}". Revisa backend/.env`
        );
    }
    return value;
}

/**
 * Lista de orígenes permitidos para CORS, separados por coma.
 * En desarrollo, si no se define, se permite cualquier origen.
 */
function corsOrigins(nodeEnv: string): string[] | true {
    const raw = process.env.CORS_ORIGINS?.trim();
    if (raw) {
        return raw.split(',').map((o) => o.trim()).filter(Boolean);
    }
    if (nodeEnv === 'production') {
        throw new Error(
            '❌ Falta CORS_ORIGINS en producción (lista de dominios separados por coma).'
        );
    }
    return true;
}

const nodeEnv = process.env.NODE_ENV ?? 'development';

export const env = {
    nodeEnv,
    isProduction: nodeEnv === 'production',
    port: Number(process.env.PORT) || 3000,
    corsOrigins: corsOrigins(nodeEnv),
    /** Si se define, /api/import exige la cabecera X-Import-Token. */
    importToken: process.env.IMPORT_TOKEN?.trim() || null,
    tmdb: {
        accessToken: required('TMDB_ACCESS_TOKEN'),
    },
    supabase: {
        url: required('SUPABASE_URL'),
        serviceRoleKey: required('SUPABASE_SERVICE_ROLE_KEY'),
    },
    fanart: {
        apiKey: required('FANART_API_KEY'),
    },
} as const;
