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
                <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center gap-4 p-8 text-center">
                    <div className="text-6xl">😵</div>
                    <h1 className="text-2xl font-bold">Algo salió mal</h1>
                    <button
                        onClick={() => {
                            localStorage.removeItem('guessverse:current-game');
                            window.location.href = '/';
                        }}
                        className="bg-purple-500 hover:bg-purple-600 px-6 py-2 rounded-lg font-semibold"
                    >
                        Volver al inicio
                    </button>
                </div>
            );
        }
        return this.props.children;
    }
}
