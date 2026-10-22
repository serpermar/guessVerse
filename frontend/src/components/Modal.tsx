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
                className="w-full max-w-sm animate-pop-in rounded-2xl border border-border bg-surface p-6 text-center text-fg"
                onClick={(e) => e.stopPropagation()}
            >
                {!hideClose && (
                    <button
                        type="button"
                        aria-label="Cerrar"
                        onClick={onClose}
                        className="-mr-1 -mt-1 float-right px-2 text-muted hover:text-fg"
                    >
                        ✕
                    </button>
                )}
                {children}
            </div>
        </div>
    );
}
