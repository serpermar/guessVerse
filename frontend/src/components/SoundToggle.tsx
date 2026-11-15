import { useEffect, useRef, useState } from 'react';
import { useAudio } from '../hooks/useAudio';

function ToggleRow({
    label,
    hint,
    enabled,
    onToggle,
}: {
    label: string;
    hint: string;
    enabled: boolean;
    onToggle: () => void;
}) {
    return (
        <div className="flex items-center justify-between gap-3">
            <div>
                <div className="text-sm font-bold text-fg">{label}</div>
                <div className="text-[11px] text-muted">{hint}</div>
            </div>
            <button
                type="button"
                onClick={onToggle}
                aria-pressed={enabled}
                className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold transition ${enabled
                    ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                    : 'bg-surface-2 text-muted hover:text-fg'
                    }`}
            >
                {enabled ? 'ON' : 'OFF'}
            </button>
        </div>
    );
}

function VolumeSlider({
    label,
    value,
    disabled,
    onChange,
}: {
    label: string;
    value: number;
    disabled: boolean;
    onChange: (value: number) => void;
}) {
    return (
        <label className="block">
            <span className="mb-1 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-muted">
                {label}
                <span className="text-fg">{Math.round(value * 100)}%</span>
            </span>
            <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={value}
                disabled={disabled}
                onChange={(event) => onChange(Number(event.target.value))}
                className="w-full accent-brand disabled:opacity-40"
            />
        </label>
    );
}

export function SoundToggle() {
    const { music, sfx, musicVolume, sfxVolume, toggleMusic, toggleSfx, setMusicVolume, setSfxVolume } = useAudio();
    const [open, setOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;

        const onPointerDown = (event: PointerEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setOpen(false);
            }
        };
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setOpen(false);
        };

        document.addEventListener('pointerdown', onPointerDown);
        document.addEventListener('keydown', onKeyDown);
        return () => {
            document.removeEventListener('pointerdown', onPointerDown);
            document.removeEventListener('keydown', onKeyDown);
        };
    }, [open]);

    return (
        <div ref={containerRef} className="relative">
            <button
                type="button"
                onClick={() => setOpen((value) => !value)}
                aria-label={music ? 'Audio activado. Abrir ajustes de sonido' : 'Audio silenciado. Abrir ajustes de sonido'}
                aria-expanded={open}
                title="Ajustes de audio"
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface-2 px-3 py-1.5 text-sm text-muted transition-colors hover:text-fg"
            >
                <span aria-hidden>{music ? '🎵' : '🔇'}</span>
                <span className="hidden sm:inline">{music ? 'Audio' : 'Silencio'}</span>
            </button>

            {open && (
                <div className="absolute right-0 z-50 mt-2 w-72 animate-pop-in space-y-4 rounded-2xl border border-border bg-surface p-4 shadow-2xl">
                    <div>
                        <h3 className="text-sm font-black text-fg">🎧 Audio</h3>
                        <p className="text-[11px] text-muted">
                            La música cambia según la temática y el modo de juego.
                        </p>
                    </div>

                    <ToggleRow
                        label="Música ambiental"
                        hint="Tema de fondo con ambiente por modo"
                        enabled={music}
                        onToggle={toggleMusic}
                    />
                    <VolumeSlider
                        label="Volumen música"
                        value={musicVolume}
                        disabled={!music}
                        onChange={setMusicVolume}
                    />

                    <div className="border-t border-border pt-3">
                        <ToggleRow
                            label="Efectos de sonido"
                            hint="Cartas, respuestas, victorias y avisos"
                            enabled={sfx}
                            onToggle={toggleSfx}
                        />
                    </div>
                    <VolumeSlider
                        label="Volumen efectos"
                        value={sfxVolume}
                        disabled={!sfx}
                        onChange={setSfxVolume}
                    />

                    <p className="text-[10px] leading-relaxed text-muted">
                        El navegador activa el audio con tu primera interacción. Tus preferencias se guardan en este dispositivo.
                    </p>
                </div>
            )}
        </div>
    );
}
