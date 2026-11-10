import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './features/auth/AuthProvider';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AppHeader } from './components/AppHeader';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Spinner } from './components/ui/Spinner';

const HomePage = lazy(() => import('./pages/HomePage').then((m) => ({ default: m.HomePage })));
const GamePage = lazy(() => import('./pages/GamePage').then((m) => ({ default: m.GamePage })));
const LoginPage = lazy(() => import('./pages/LoginPage').then((m) => ({ default: m.LoginPage })));
const RegisterPage = lazy(() => import('./pages/RegisterPage').then((m) => ({ default: m.RegisterPage })));
const AuthCallbackPage = lazy(() => import('./pages/AuthCallbackPage').then((m) => ({ default: m.AuthCallbackPage })));
const ProfilePage = lazy(() => import('./pages/ProfilePage').then((m) => ({ default: m.ProfilePage })));
const ThemeDetailPage = lazy(() => import('./pages/ThemeDetailPage').then((m) => ({ default: m.ThemeDetailPage })));
const DiscoverPage = lazy(() => import('./pages/DiscoverPage').then((m) => ({ default: m.DiscoverPage })));
const LobbyPage = lazy(() => import('./pages/LobbyPage').then((m) => ({ default: m.LobbyPage })));
const MultiplayerGamePage = lazy(() => import('./pages/MultiplayerGamePage').then((m) => ({ default: m.MultiplayerGamePage })));
const LeaderboardPage = lazy(() => import('./pages/LeaderboardPage').then((m) => ({ default: m.LeaderboardPage })));

function PageFallback() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Spinner size="lg" text="Cargando…" />
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <div className="min-h-screen bg-canvas text-fg">
            <AppHeader />
            <Suspense fallback={<PageFallback />}>
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
                  <Route path="/leaderboard" element={<LeaderboardPage />} />
                  <Route path="/multiplayer/:gameId" element={<MultiplayerGamePage />} />
                </Route>

                {/* Redirección por defecto */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </div>
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
