import { useEffect, useRef, type ReactNode } from 'react';

interface ModalProps {
    title: string;
    onClose: () => void;
    children: ReactNode;
    /** Oculta el botón de cierre (p. ej. modales de fin de partida) */
    hideClose?: boolean;
    zIndex?: string;
}

/**
 * Modal accesible: role="dialog", aria-modal, foco atrapado y restaurado,
 * cierre con Escape y clic en el fondo.
 */
export function Modal({ title, onClose, children, hideClose, zIndex = 'z-30' }: ModalProps) {
    const dialogRef = useRef<HTMLDivElement>(null);
    const previouslyFocused = useRef<HTMLElement | null>(null);

    useEffect(() => {
        previouslyFocused.current = document.activeElement as HTMLElement | null;

        const node = dialogRef.current;
        const focusables = node?.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        focusables?.[0]?.focus();

        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
                return;
            }
            if (e.key !== 'Tab' || !node) return;
            const items = node.querySelectorAll<HTMLElement>(
                'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
            );
            if (items.length === 0) return;
            const first = items[0];
            const last = items[items.length - 1];
            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        };

        document.addEventListener('keydown', onKeyDown);
        return () => {
            document.removeEventListener('keydown', onKeyDown);
            previouslyFocused.current?.focus();
        };
    }, [onClose]);

    return (
        <div
            className={`fixed inset-0 bg-black/80 flex items-center justify-center p-4 ${zIndex}`}
            onClick={onClose}
        >
            <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-label={title}
                className="bg-slate-800 rounded-2xl p-6 max-w-sm w-full text-center"
                onClick={(e) => e.stopPropagation()}
            >
                {!hideClose && (
                    <button
                        type="button"
                        aria-label="Cerrar"
                        onClick={onClose}
                        className="float-right text-slate-400 hover:text-white -mt-1 -mr-1 px-2"
                    >
                        ✕
                    </button>
                )}
                {children}
            </div>
        </div>
    );
}
