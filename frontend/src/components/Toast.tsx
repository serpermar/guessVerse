import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

export type ToastKind = 'info' | 'success' | 'error';

interface ToastProps {
    open: boolean;
    message: string;
    kind?: ToastKind;
    onClose: () => void;
    duration?: number;
}

const KIND_STYLES: Record<ToastKind, string> = {
    info: 'bg-slate-800 text-white border-slate-600',
    success: 'bg-emerald-700 text-white border-emerald-500',
    error: 'bg-rose-700 text-white border-rose-500',
};

export function Toast({
    open,
    message,
    kind = 'info',
    onClose,
    duration = 3500,
}: ToastProps) {
    useEffect(() => {
        if (!open) return;
        const t = setTimeout(onClose, duration);
        return () => clearTimeout(t);
    }, [open, duration, onClose]);

    return (
        <AnimatePresence>
            {open && (
                <motion.div
                    initial={{ opacity: 0, y: -20, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -20, scale: 0.95 }}
                    role="status"
                    aria-live="polite"
                    className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl border shadow-lg ${KIND_STYLES[kind]}`}
                >
                    <div className="flex items-start gap-3">
                        <span className="text-sm">{message}</span>
                        <button
                            onClick={onClose}
                            className="text-white/70 hover:text-white text-xs"
                            aria-label="Cerrar notificación"
                        >
                            ✕
                        </button>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}