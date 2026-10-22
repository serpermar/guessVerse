
```markdown
# Changelog â€” GuessVerse

Historial de cambios agrupados por sesiÃ³n de trabajo.

---

## [Sin publicar] â€” 2026-10-22 â€” Bloque 2: MÃ¡s temÃ¡ticas (Harry Potter + DC)

### AÃ±adido
- **TemÃ¡tica Harry Potter**: ImportaciÃ³n desde HP-API, seed de atributos manuales (hÃ©roes/villanos y casas de Hogwarts), 27 personajes con imagen.
- **TemÃ¡tica DC Comics**: ImportaciÃ³n desde SuperHero API (akabab), mapeo automÃ¡tico de alineaciÃ³n (hÃ©roe/villano), seed manual para protagonistas y poderes, 30 personajes con imagen.
- **MigraciÃ³n SQL**: Columna `house` aÃ±adida a `characters` para las casas de Harry Potter.
- **Cliente `hpapi`**: IntegraciÃ³n con `hp-api.onrender.com`.
- **Cliente `akabab`**: IntegraciÃ³n con `superhero-api` (compartida conceptualmente con Marvel).
- **Servicios**: `import-harrypotter.service.ts`, `attribute-seed-harrypotter.service.ts`, `import-dc.service.ts`, `attribute-seed-dc.service.ts`.
- **Preguntas especÃ­ficas de Harry Potter**: CategorÃ­a `hogwarts` (`hp_gryffindor`, `hp_slytherin`, etc.).
- **Frontend `ProtectedRoute.tsx`**: Componente para proteger rutas privadas (redirige a `/login` si no hay sesiÃ³n).

### Cambiado
- **App.tsx**: IntegraciÃ³n de `ProtectedRoute`. Ahora `/`, `/game/:themeSlug` y `/profile` requieren autenticaciÃ³n.
- **AppHeader.tsx**: Mejoras visuales para mostrar estado de sesiÃ³n y botones de Login/Registro/Logout.
- **`PROJECT_STATE.md`**: Actualizado con el estado real de las 5 temÃ¡ticas y los nuevos endpoints.

### Corregido
- Error de conexiÃ³n con Supabase (`ERR_NAME_NOT_RESOLVED`) causado por una errata en la URL (`cojsy...` vs `coysy...`).
- El frontend ahora muestra "Cargando sesiÃ³n" mientras verifica el token, evitando parpadeos.

### Pospuesto
- TemÃ¡tica **Resident Evil**: Se descarta su implementaciÃ³n por el momento para centrarse en el multijugador.

### Pendiente
- Tests de `auth.middleware` y `stats.service` (Vitest).
- Tests de flujo con Supertest.
- Playwright e2e.

---

## [Sin publicar] â€” 2026-10-22 â€” Bloque 1: Auth + Perfil + EstadÃ­sticas

### AÃ±adido

**Backend**
- `middleware/auth.middleware.ts`: `requireAuth` y `optionalAuth`. Verifica
  JWT con `supabaseAdmin.auth.getUser()` y adjunta `req.user`.
- `types/express.d.ts`: extiende `Express.Request` con `user?: User`.
- `HttpError.forbidden(message)` â†’ 403.
- `repositories/users.repository.ts`: `findUserById`, `updateUser`.
- `services/stats.service.ts`: `recordGameResult(userId, status, questions,
  duration)` y `getStats(userId)`.
- `controllers/users.controller.ts`: `getMe`, `patchMe`, `getMyStats`,
  `getMyGames`.
- `routes/users.routes.ts`: `/api/users/me`, `/api/users/me/stats`,
  `/api/users/me/games` (todas con `requireAuth`).
- MigraciÃ³n SQL: trigger `handle_new_user` reescrito con saneo de username,
  fallback `user_<id>` y resoluciÃ³n de colisiones (`_1`, `_2`â€¦).

**Frontend**
- `lib/supabase.ts`: cliente Supabase con `anon key`.
- `features/auth/AuthProvider.tsx`: contexto `user`, `session`, `signIn`,
  `signUp`, `signOut`, `loading`.
- `pages/LoginPage.tsx`: login con email + password.
- `pages/RegisterPage.tsx`: registro con username + email + password.
- `pages/AuthCallbackPage.tsx`: `verifyOtp({ token_hash, type })`.
- `pages/ProfilePage.tsx`: perfil con avatar, estadÃ­sticas e historial.
- `services/api.ts`: mÃ©todos `me`, `updateMe`, `myStats`, `myGames`;
  `Authorization: Bearer` automÃ¡tico.
- `App.tsx`: envuelto en `AuthProvider`.
- Variables `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` en `.env`.

### Cambiado

**Backend**
- `game.service.ts`:
  - `createGame(themeSlug, boardSize, userId)`: rellena `games.created_by`
    y aÃ±ade fila en `game_players` con `role = 'host'`.
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
- `api.ts`: corrige cÃ³digo huÃ©rfano en `req()`; aÃ±ade `Authorization`
  automÃ¡tico desde `supabase.auth.getSession()`.
- `RegisterPage.tsx`: eliminado `useNavigate` no usado.

### Corregido
- Error TS en `game.service.ts`: `HttpError.forbidden` no existÃ­a â†’ aÃ±adido.
- Errores TS en `App.tsx`: `LoginPage` y `ProfilePage` no existÃ­an â†’ creados.

### Pendiente
- Tests de `auth.middleware` y `stats.service` (Vitest).
- Tests de flujo con Supertest.
- Playwright e2e.

---

## [SesiÃ³n previa] â€” Limpieza de datos + Endurecimiento P0/P1/P2/P3

- ImÃ¡genes Star Wars completadas (35/47 con arte, 12 con placeholder).
- DeduplicaciÃ³n de 30 personajes (Marvel y Star Wars).
- Atributos desincronizados corregidos en ambas temÃ¡ticas.
- Backend endurecido: `helmet`, `express-rate-limit`, `zod`, `HttpError`,
  `error.middleware`, `async-handler`, `text.utils`.
- Frontend: `ErrorBoundary`, `AppHeader`, a11y bÃ¡sica.
- Vitest configurado en backend (13 tests).
- `.env.example` creados.
- Rutas `/api/debug/*` e `/api/import/*` restringidas a desarrollo.

---
