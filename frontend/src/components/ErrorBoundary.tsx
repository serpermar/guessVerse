import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
}

/** Evita que un crash de render deje la app en blanco. */
export class ErrorBoundary extends Component<Props, State> {
    state: State = { hasError: false };

    static getDerivedStateFromError(): State {
        return { hasError: true };
    }

    componentDidCatch(error: Error, info: ErrorInfo) {
        console.error('💥 UI error:', error, info);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-canvas p-8 text-center text-fg">
                    <div className="text-6xl">😵</div>
                    <h1 className="text-2xl font-bold">Algo salió mal</h1>
                    <button
                        onClick={() => {
                            localStorage.removeItem('guessverse:current-game');
                            window.location.href = '/';
                        }}
                        className="rounded-lg bg-brand-strong px-6 py-2 font-semibold text-white transition hover:opacity-90"
                    >
                        Volver al inicio
                    </button>
                </div>
            );
        }
        return this.props.children;
    }
}
