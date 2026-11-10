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
        <section className="w-full max-w-md mx-auto bg-slate-900/60 border border-slate-700 rounded-2xl p-4">
            <header className="flex items-center justify-between mb-3">
                <div>
                    <h3 className="text-white font-semibold">Comodín</h3>
                    <p className="text-xs text-slate-400">
                        Pistas usadas: {hintsUsed}/{maxHints}
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <span
                        className={`text-xs font-bold px-2 py-1 rounded-full border ${outOfHints
                                ? 'bg-slate-700 text-slate-400 border-slate-600'
                                : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                            }`}
                        aria-label={`${hintsLeft} pistas restantes`}
                    >
                        {hintsLeft} restantes
                    </span>

                    {hintsHistory.length > 0 && (
                        <button
                            type="button"
                            onClick={() => setShowHistory((v) => !v)}
                            className="text-xs text-slate-300 hover:text-white underline-offset-2 hover:underline"
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
                className={`w-full py-2.5 rounded-xl font-semibold transition ${disabled
                        ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                        : 'bg-amber-500 hover:bg-amber-400 text-slate-900'
                    }`}
            >
                {hintLoading ? 'Revelando pista…' : outOfHints ? 'Sin pistas disponibles' : 'Pedir pista'}
            </button>

            {hintError && (
                <div
                    role="alert"
                    className="mt-2 flex items-center justify-between gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-300"
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
                        className="mt-3 rounded-xl bg-slate-800 border border-slate-600 p-3"
                    >
                        <p className="text-xs uppercase tracking-wide text-amber-300 mb-1">Pista actual</p>
                        <p className="text-sm text-white">{currentHint}</p>
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
                                className="text-xs text-slate-300 bg-slate-800/60 px-2 py-1 rounded"
                            >
                                <span className="text-slate-500 mr-2">#{i + 1}</span>
                                {h}
                            </li>
                        ))}
                    </motion.ul>
                )}
            </AnimatePresence>
        </section>
    );
}