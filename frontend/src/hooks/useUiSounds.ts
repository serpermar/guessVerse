import { useEffect } from 'react';
import { playSfx, type SfxName } from '../lib/audio';

const SFX_NAMES: ReadonlySet<string> = new Set<SfxName>([
    'click',
    'flip',
    'eliminate',
    'restore',
    'correct',
    'wrong',
    'win',
    'lose',
    'hint',
    'tick',
    'join',
    'message',
    'start',
    'guess',
    'turn',
]);

function isSfx(value: string | undefined): value is SfxName {
    return Boolean(value) && SFX_NAMES.has(value as string);
}

/**
 * Sonido de clic global para toda la interfaz.
 *
 * Los elementos pueden personalizar el efecto con `data-sound="..."` o
 * desactivarlo con `data-sound="off"` cuando la pantalla ya reproduce su
 * propio sonido.
 */
export function useUiSounds() {
    useEffect(() => {
        const onClick = (event: MouseEvent) => {
            const target = event.target;
            if (!(target instanceof Element)) return;

            const interactive = target.closest<HTMLElement>('button, a, [role="button"], summary');
            if (!interactive) return;

            const sound = interactive.dataset.sound;
            if (sound === 'off') return;

            playSfx(isSfx(sound) ? sound : 'click');
        };

        const onChange = (event: Event) => {
            const target = event.target;
            if (!(target instanceof HTMLElement)) return;
            if (!target.matches('select, input[type="checkbox"], input[type="radio"], input[type="range"]')) return;
            if (target.dataset.sound === 'off') return;

            const sound = target.dataset.sound;
            playSfx(isSfx(sound) ? sound : 'click');
        };

        document.addEventListener('click', onClick, true);
        document.addEventListener('change', onChange, true);

        return () => {
            document.removeEventListener('click', onClick, true);
            document.removeEventListener('change', onChange, true);
        };
    }, []);
}
