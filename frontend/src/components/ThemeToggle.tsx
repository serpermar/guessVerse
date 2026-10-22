import { useTheme } from '../hooks/useTheme';

const LABEL: Record<string, string> = {
    light: 'Tema claro',
    dark: 'Tema oscuro',
    system: 'Tema del sistema',
};

const ICON: Record<string, string> = {
    light: '☀️',
    dark: '🌙',
    system: '🖥️',
};

export function ThemeToggle() {
    const { mode, cycle } = useTheme();
    return (
        <button
            type="button"
            onClick={cycle}
            aria-label={`${LABEL[mode]} (clic para cambiar)`}
            title={LABEL[mode]}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface-2 px-3 py-1.5 text-sm text-muted hover:text-fg transition-colors"
        >
            <span aria-hidden>{ICON[mode]}</span>
            <span className="hidden sm:inline">{LABEL[mode]}</span>
        </button>
    );
}
