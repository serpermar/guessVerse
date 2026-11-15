import { api } from '../services/api';

/**
 * Registro de tipos de temática (`themes.type`) indexado por slug.
 *
 * Permite elegir la ambientación por género (manga, cómic, fantasía,
 * videojuegos…) sin repetir peticiones en cada ruta. La lista se pide una vez
 * por sesión y se puede invalidar tras importar una franquicia nueva.
 */
const THEME_TYPES_EVENT = 'guessverse:theme-types-updated';

let cache: Record<string, string> | null = null;
let request: Promise<Record<string, string>> | null = null;

export function getCachedThemeTypes(): Record<string, string> {
    return cache ?? {};
}

export function loadThemeTypes(): Promise<Record<string, string>> {
    if (cache) return Promise.resolve(cache);

    request ??= api
        .themes()
        .then((themes) => {
            cache = Object.fromEntries(
                themes.filter((theme) => theme.type).map((theme) => [theme.slug, theme.type]),
            );
            return cache;
        })
        .catch(() => {
            // Sin backend seguimos usando la detección por palabras clave.
            return {};
        });

    return request;
}

export function refreshThemeTypes() {
    cache = null;
    request = null;
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event(THEME_TYPES_EVENT));
    }
}

export function onThemeTypesUpdated(listener: () => void): () => void {
    if (typeof window === 'undefined') return () => {};
    window.addEventListener(THEME_TYPES_EVENT, listener);
    return () => window.removeEventListener(THEME_TYPES_EVENT, listener);
}
