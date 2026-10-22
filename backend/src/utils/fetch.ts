const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_RETRIES = 2;

function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/** fetch con cancelación por timeout para no colgar un request indefinidamente. */
export async function fetchWithTimeout(
    input: string | URL,
    init: RequestInit = {},
    timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(input, { ...init, signal: init.signal ?? controller.signal });
    } finally {
        clearTimeout(timer);
    }
}

export interface FetchJsonOptions {
    timeoutMs?: number;
    retries?: number;
    label?: string;
}

/**
 * Descarga y parsea JSON con timeout y reintentos para errores de red o 5xx.
 * Lanza con un mensaje acotado (nunca vuelca el body entero).
 */
export async function fetchJson<T>(
    url: string,
    init: RequestInit = {},
    opts: FetchJsonOptions = {}
): Promise<T> {
    const retries = opts.retries ?? DEFAULT_RETRIES;
    const label = opts.label ?? 'HTTP';
    let lastError: unknown;

    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            const res = await fetchWithTimeout(url, init, opts.timeoutMs);
            if (!res.ok) {
                const retryable = res.status >= 500;
                if (!retryable || attempt === retries) {
                    const body = await res.text().catch(() => '');
                    throw new Error(`${label} ${res.status}: ${body.slice(0, 200)}`);
                }
            } else {
                return (await res.json()) as T;
            }
        } catch (err) {
            lastError = err;
            if (attempt === retries) throw err;
        }

        await delay(300 * (attempt + 1));
    }

    throw lastError instanceof Error ? lastError : new Error(`${label} falló`);
}
