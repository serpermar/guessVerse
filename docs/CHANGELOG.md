
```markdown
# Changelog — GuessVerse

Historial de cambios agrupados por sesión de trabajo.

---

## [Sin publicar] — 2026-10-22 — Bloque 2: Más temáticas (Harry Potter + DC)

### Añadido
- **Temática Harry Potter**: Importación desde HP-API, seed de atributos manuales (héroes/villanos y casas de Hogwarts), 27 personajes con imagen.
- **Temática DC Comics**: Importación desde SuperHero API (akabab), mapeo automático de alineación (héroe/villano), seed manual para protagonistas y poderes, 30 personajes con imagen.
- **Migración SQL**: Columna `house` añadida a `characters` para las casas de Harry Potter.
- **Cliente `hpapi`**: Integración con `hp-api.onrender.com`.
- **Cliente `akabab`**: Integración con `superhero-api` (compartida conceptualmente con Marvel).
- **Servicios**: `import-harrypotter.service.ts`, `attribute-seed-harrypotter.service.ts`, `import-dc.service.ts`, `attribute-seed-dc.service.ts`.
- **Preguntas específicas de Harry Potter**: Categoría `hogwarts` (`hp_gryffindor`, `hp_slytherin`, etc.).
- **Frontend `ProtectedRoute.tsx`**: Componente para proteger rutas privadas (redirige a `/login` si no hay sesión).

### Cambiado
- **App.tsx**: Integración de `ProtectedRoute`. Ahora `/`, `/game/:themeSlug` y `/profile` requieren autenticación.
- **AppHeader.tsx**: Mejoras visuales para mostrar estado de sesión y botones de Login/Registro/Logout.
- **`PROJECT_STATE.md`**: Actualizado con el estado real de las 5 temáticas y los nuevos endpoints.

### Corregido
- Error de conexión con Supabase (`ERR_NAME_NOT_RESOLVED`) causado por una errata en la URL (`cojsy...` vs `coysy...`).
- El frontend ahora muestra "Cargando sesión" mientras verifica el token, evitando parpadeos.

### Pospuesto
- Temática **Resident Evil**: Se descarta su implementación por el momento para centrarse en el multijugador.

### Pendiente
- Tests de `auth.middleware` y `stats.service` (Vitest).
- Tests de flujo con Supertest.
- Playwright e2e.

---

## [Sin publicar] — 2026-10-22 — Bloque 1: Auth + Perfil + Estadísticas

### Añadido

**Backend**
- `middleware/auth.middleware.ts`: `requireAuth` y `optionalAuth`. Verifica
  JWT con `supabaseAdmin.auth.getUser()` y adjunta `req.user`.
- `types/express.d.ts`: extiende `Express.Request` con `user?: User`.
- `HttpError.forbidden(message)` → 403.
- `repositories/users.repository.ts`: `findUserById`, `updateUser`.
- `services/stats.service.ts`: `recordGameResult(userId, status, questions,
  duration)` y `getStats(userId)`.
- `controllers/users.controller.ts`: `getMe`, `patchMe`, `getMyStats`,
  `getMyGames`.
- `routes/users.routes.ts`: `/api/users/me`, `/api/users/me/stats`,
  `/api/users/me/games` (todas con `requireAuth`).
- Migración SQL: trigger `handle_new_user` reescrito con saneo de username,
  fallback `user_<id>` y resolución de colisiones (`_1`, `_2`…).

**Frontend**
- `lib/supabase.ts`: cliente Supabase con `anon key`.
- `features/auth/AuthProvider.tsx`: contexto `user`, `session`, `signIn`,
  `signUp`, `signOut`, `loading`.
- `pages/LoginPage.tsx`: login con email + password.
- `pages/RegisterPage.tsx`: registro con username + email + password.
- `pages/AuthCallbackPage.tsx`: `verifyOtp({ token_hash, type })`.
- `pages/ProfilePage.tsx`: perfil con avatar, estadísticas e historial.
- `services/api.ts`: métodos `me`, `updateMe`, `myStats`, `myGames`;
  `Authorization: Bearer` automático.
- `App.tsx`: envuelto en `AuthProvider`.
- Variables `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` en `.env`.

### Cambiado

**Backend**
- `game.service.ts`:
  - `createGame(themeSlug, boardSize, userId)`: rellena `games.created_by`
    y añade fila en `game_players` con `role = 'host'`.
  - `askQuestion(gameId, questionCode, userId)`: valida ownership (`403`).
  - `guessCharacter(gameId, characterId, userId)`: registra `user_id` en
    `guesses`, actualiza `winner_user_id` al ganar y llama
    `recordGameResult(..., 'won', ...)`.
  - `abandonGame(gameId, userId)`: valida ownership y llama
    `recordGameResult(..., 'abandoned', ...)`.
  - `getGame(gameId, userId)`: valida ownership.
- `games.controller.ts`: pasa `req.user!.id` a los servicios. `HttpError`
  import eliminado (no se usa en el controller).
- `routes/games.routes.ts`: `requireAuth` aplicado a todas las rutas.
- `server.ts`: monta `usersRouter` en `/api/users`.

**Frontend**
- `api.ts`: corrige código huérfano en `req()`; añade `Authorization`
  automático desde `supabase.auth.getSession()`.
- `RegisterPage.tsx`: eliminado `useNavigate` no usado.

### Corregido
- Error TS en `game.service.ts`: `HttpError.forbidden` no existía → añadido.
- Errores TS en `App.tsx`: `LoginPage` y `ProfilePage` no existían → creados.

### Pendiente
- Tests de `auth.middleware` y `stats.service` (Vitest).
- Tests de flujo con Supertest.
- Playwright e2e.

---

## [Sesión previa] — Limpieza de datos + Endurecimiento P0/P1/P2/P3

- Imágenes Star Wars completadas (35/47 con arte, 12 con placeholder).
- Deduplicación de 30 personajes (Marvel y Star Wars).
- Atributos desincronizados corregidos en ambas temáticas.
- Backend endurecido: `helmet`, `express-rate-limit`, `zod`, `HttpError`,
  `error.middleware`, `async-handler`, `text.utils`.
- Frontend: `ErrorBoundary`, `AppHeader`, a11y básica.
- Vitest configurado en backend (13 tests).
- `.env.example` creados.
- Rutas `/api/debug/*` e `/api/import/*` restringidas a desarrollo.

---