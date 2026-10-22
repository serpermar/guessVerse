import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthProvider';

export function ProtectedRoute() {
    const { user, loading } = useAuth();

    // Mientras carga la sesión, mostramos un spinner o pantalla en blanco
    if (loading) {
        return (
            <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
                Cargando sesión…
            </div>
        );
    }

    // Si no hay usuario, redirigimos al login
    if (!user) {
        return <Navigate to="/login" replace />;
    }

    // Si hay usuario, renderizamos la ruta que toque (HomePage, GamePage, ProfilePage)
    return <Outlet />;
}