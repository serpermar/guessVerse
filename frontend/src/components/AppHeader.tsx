import { Link } from 'react-router-dom';
import { ThemeToggle } from './ThemeToggle';

export function AppHeader() {
    return (
        <header className="sticky top-0 z-20 border-b border-border bg-surface/80 backdrop-blur">
            <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
                <Link
                    to="/"
                    className="text-lg font-black tracking-tight bg-gradient-to-r from-brand to-accent bg-clip-text text-transparent"
                >
                    GuessVerse
                </Link>
                <ThemeToggle />
            </div>
        </header>
    );
}
