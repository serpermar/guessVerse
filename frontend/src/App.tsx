import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './features/auth/AuthProvider';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AppHeader } from './components/AppHeader';
import { ProtectedRoute } from './components/ProtectedRoute';
import { HomePage } from './pages/HomePage';
import { GamePage } from './pages/GamePage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { AuthCallbackPage } from './pages/AuthCallbackPage';
import { ProfilePage } from './pages/ProfilePage';
import { ThemeDetailPage } from './pages/ThemeDetailPage';
import { DiscoverPage } from './pages/DiscoverPage';
import { LobbyPage } from './pages/LobbyPage';
import { MultiplayerGamePage } from './pages/MultiplayerGamePage';

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <div className="min-h-screen bg-canvas text-fg">
            <AppHeader />
            <Routes>
              {/* Rutas públicas */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/auth/callback" element={<AuthCallbackPage />} />

              {/* Rutas protegidas (requieren login) */}
              <Route element={<ProtectedRoute />}>
                <Route path="/" element={<HomePage />} />
                <Route path="/game/:themeSlug" element={<GamePage />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/themes/:slug" element={<ThemeDetailPage />} />
                <Route path="/discover" element={<DiscoverPage />} />
                <Route path="/lobby" element={<LobbyPage />} />
                <Route path="/multiplayer/:gameId" element={<MultiplayerGamePage />} />
              </Route>

              {/* Redirección por defecto */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;