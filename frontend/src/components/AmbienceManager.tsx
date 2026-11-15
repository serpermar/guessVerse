import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { setMusicScene, type MusicMode } from '../lib/audio';
import {
    getCachedThemeTypes,
    loadThemeTypes,
    onThemeTypesUpdated,
} from '../lib/theme-types';

/**
 * Sincroniza la música ambiental con la ruta actual:
 * temática para las partidas individuales y modo para cada pantalla de juego.
 *
 * El tipo de temática (`themes.type`) permite que las franquicias importadas
 * suenen según su género aunque su slug no sea reconocible.
 */
export function AmbienceManager() {
    const location = useLocation();
    const [themeTypes, setThemeTypes] = useState<Record<string, string>>(
        getCachedThemeTypes,
    );

    useEffect(() => {
        let active = true;
        const sync = () => {
            void loadThemeTypes().then((types) => {
                if (active) setThemeTypes({ ...types });
            });
        };

        sync();
        const unsubscribe = onThemeTypesUpdated(sync);
        return () => {
            active = false;
            unsubscribe();
        };
    }, []);

    useEffect(() => {
        const segments = location.pathname.split('/').filter(Boolean);
        let mode: MusicMode = 'menu';
        let theme: string | null = null;

        if (segments[0] === 'game') {
            mode = new URLSearchParams(location.search).get('mode') === 'timed' ? 'timed' : 'solo';
            theme = segments[1] ?? null;
        } else if (segments[0] === 'themes') {
            theme = segments[1] ?? null;
        } else if (segments[0] === 'multiplayer') {
            mode = 'multiplayer';
        } else if (segments[0] === 'lobby') {
            mode = 'lobby';
        }

        let decodedTheme: string | null = null;
        if (theme) {
            try {
                decodedTheme = decodeURIComponent(theme);
            } catch {
                decodedTheme = theme;
            }
        }

        setMusicScene({
            mode,
            theme: decodedTheme,
            themeType: decodedTheme ? themeTypes[decodedTheme] ?? null : null,
        });
    }, [location.pathname, location.search, themeTypes]);

    return null;
}
