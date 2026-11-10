import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useGameStore } from '../stores/game.store';

export function HintPanel() {
    const hintsLeft = useGameStore((s) => s.hintsLeft);
    const hintsUsed = useGameStore((s) => s.hintsUsed);
    const maxHints = useGameStore((s) => s.maxHints);
    const currentHint = useGameStore((s) => s.currentHint);
    const hintsHistory = useGameStore((s) => s.hintsHistory);
    const hintLoading = useGameStore((s) => s.hintLoading);
    const hintError = useGameStore((s) => s.hintError);
    const requestHint = useGameStore((s) => s.requestHint);
    const clearHintError = useGameStore((s) => s.clearHintError);

    const [showHistory, setShowHistory] = useState(false);

    const outOfHints = hintsLeft <= 0;
    const disabled = hintLoading || outOfHints;

    return (
        <section className="mx-auto w-full max-w-md rounded-2xl border border-border bg-surface p-4">
            <header className="mb-3 flex items-center justify-between">
                <div>
                    <h3 className="font-semibold text-fg">Comodín</h3>
                    <p className="text-xs text-muted">
                        Pistas usadas: {hintsUsed}/{maxHints}
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <span
                        className={`rounded-full border px-2 py-1 text-xs font-bold ${outOfHints
                                ? 'border-border bg-surface-2 text-muted'
                                : 'border-amber-500/40 bg-amber-500/20 text-amber-600 dark:text-amber-300'
                            }`}
                        aria-label={`${hintsLeft} pistas restantes`}
                    >
                        {hintsLeft} restantes
                    </span>

                    {hintsHistory.length > 0 && (
                        <button
                            type="button"
                            onClick={() => setShowHistory((v) => !v)}
                            className="text-xs text-muted underline-offset-2 hover:text-fg hover:underline"
                        >
                            {showHistory ? 'Ocultar' : 'Historial'}
                        </button>
                    )}
                </div>
            </header>

            <button
                type="button"
                onClick={() => requestHint()}
                disabled={disabled}
                title={outOfHints ? 'No te quedan pistas en esta partida' : 'Revelar una pista'}
                className={`w-full rounded-xl py-2.5 font-semibold transition ${disabled
                        ? 'cursor-not-allowed bg-surface-2 text-muted'
                        : 'bg-amber-500 text-amber-950 hover:bg-amber-400'
                    }`}
            >
                {hintLoading ? 'Revelando pista…' : outOfHints ? 'Sin pistas disponibles' : 'Pedir pista'}
            </button>

            {hintError && (
                <div
                    role="alert"
                    className="mt-2 flex items-center justify-between gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-700 dark:text-amber-300"
                >
                    <span>{hintError}</span>
                    <button onClick={clearHintError} className="hover:opacity-70" aria-label="Cerrar aviso">✕</button>
                </div>
            )}

            <AnimatePresence mode="wait">
                {currentHint && (
                    <motion.div
                        key={currentHint}
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        className="mt-3 rounded-xl border border-border bg-surface-2 p-3"
                    >
                        <p className="mb-1 text-xs uppercase tracking-wide text-amber-600 dark:text-amber-300">Pista actual</p>
                        <p className="text-sm text-fg">{currentHint}</p>
                    </motion.div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {showHistory && hintsHistory.length > 0 && (
                    <motion.ul
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-3 space-y-1 overflow-hidden"
                    >
                        {hintsHistory.map((h: string, i: number) => (
                            <li
                                key={`${i}-${h}`}
                                className="rounded border border-border bg-surface-2 px-2 py-1 text-xs text-muted"
                            >
                                <span className="mr-2 text-muted/70">#{i + 1}</span>
                                {h}
                            </li>
                        ))}
                    </motion.ul>
                )}
            </AnimatePresence>
        </section>
    );
}