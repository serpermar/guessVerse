import { useCallback, useEffect, useState } from 'react';

export type ThemeMode = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'guessverse:theme';

function prefersDark() {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function applyMode(mode: ThemeMode) {
    const dark = mode === 'dark' || (mode === 'system' && prefersDark());
    document.documentElement.classList.toggle('dark', dark);
    const meta = document.querySelector('meta[name="theme-color"]');
    meta?.setAttribute('content', dark ? '#020617' : '#f8fafc');
}

function readMode(): ThemeMode {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw === 'light' || raw === 'dark' || raw === 'system' ? raw : 'system';
}

/** Modo de color con persistencia en localStorage y soporte de preferencia del sistema. */
export function useTheme() {
    const [mode, setMode] = useState<ThemeMode>(() => readMode());

    useEffect(() => {
        applyMode(mode);
        localStorage.setItem(STORAGE_KEY, mode);
    }, [mode]);

    useEffect(() => {
        if (mode !== 'system') return;
        const mq = window.matchMedia('(prefers-color-scheme: dark)');
        const onChange = () => applyMode('system');
        mq.addEventListener('change', onChange);
        return () => mq.removeEventListener('change', onChange);
    }, [mode]);

    const cycle = useCallback(() => {
        setMode((m) => (m === 'light' ? 'dark' : m === 'dark' ? 'system' : 'light'));
    }, []);

    return { mode, setMode, cycle };
}

/** Aplica el tema antes del primer render (evita el "flash" de tema incorrecto). */
export function initTheme() {
    applyMode(readMode());
}
