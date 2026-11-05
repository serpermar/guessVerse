# Changelog — GuessVerse

Historial de cambios agrupados por sesión de trabajo.

---

## [Sin publicar] — 2026-11-05 — Bloque 3: Multijugador 1v1 y preguntas personalizadas

### Añadido

**Backend**
- `sockets/multiplayer.socket.ts`: lógica Socket.IO para salas privadas, creación de tableros, asignación de secretos, turnos, evaluación de preguntas, desconexiones y reconexión.
- `discover.service.ts`: búsqueda de franquicias en TMDB (películas y series) y AniList (anime).
- `import-franchise.service.ts`: importador universal que enruta a TMDB o AniList, con heurísticas para asignar especies y roles.
- `integrations/wikidata/client.ts`: clasificación de personajes (rol y especie) vía SPARQL.
- `integrations/fandom/client.ts` y `wikipedia/client.ts`: búsqueda de imágenes de personajes.
- `repositories/questions.repository.ts`: `createCustomQuestion` y `findCustomQuestionsByThemeId`.
- `controllers/questions.controller.ts`: endpoint para crear preguntas personalizadas.
- Migraciones SQL: `room_code`, `current_turn_user_id`, `is_connected`, `eliminated_by_host`, `eliminated_by_guest` y `theme_id` en `questions`.

**Frontend**
- `LobbyPage.tsx`: pantalla para crear y unirse a salas con código.
- `MultiplayerGamePage.tsx`: tablero multijugador con panel de preguntas, historial, gestión de turnos, aviso de desconexión y modal de fin de partida.
- `lib/socket.ts`: cliente Socket.IO.
- `ThemeDetailPage.tsx`: modal para crear preguntas personalizadas, editor de atributos dinámicos y visualización de etiquetas.
- `DiscoverPage.tsx`: buscador dinámico de franquicias con etiquetas de tipo (película, serie, anime).
- `services/api.ts`: métodos `discover`, `importFranchise`, `createQuestion` y `updateCharacter`.

### Cambiado
- `themes.service.ts`: el esquema por defecto incluye nuevos atributos booleanos (`is_royal`, `has_magic`, etc.) e inyecta preguntas personalizadas en el formulario de edición.
- `questions.service.ts`: unificación de preguntas base, personalizadas y dinámicas para evitar duplicados.
- `game.service.ts`: lectura de atributos desde `attributes` (JSONB).

### Corregido
- Error de conexión con Supabase (`ERR_NAME_NOT_RESOLVED`) por errata en la URL.
- Error `Invalid hook call` en `ThemeDetailPage`.
- Error `callback is not a function` en Socket.IO.
- Duplicidad de preguntas personalizadas al recargar la página.

### Pendiente
- Tests de `multiplayer.socket.ts` y flujos E2E.
- Despliegue a producción (Vercel + Railway/Render).

---

## [Sin publicar] — 2026-10-22 — Bloque 2: Más temáticas (Harry Potter + DC)

### Añadido
- Temática Harry Potter: importación desde HP-API, seed manual de atributos y casas.
- Temática DC Comics: importación desde SuperHero API (akabab) con alineación automática.
- Migración: columna `house` en `characters`.
- Clientes `hpapi` y `akabab`.
- Servicios de importación y seed de atributos.
- Preguntas de Hogwarts.
- `ProtectedRoute.tsx` para proteger rutas.

### Cambiado
- `App.tsx`: integración de `ProtectedRoute`.
- `AppHeader.tsx`: mejoras visuales.
- `PROJECT_STATE.md`: actualizado a 5 temáticas.

### Corregido
- Error de conexión con Supabase por errata en la URL.
- Parpadeos al cargar sesión.

### Pospuesto
- Temática Resident Evil.

### Pendiente
- Tests de auth y stats. Playwright E2E.

---

## [Sin publicar] — 2026-10-22 — Bloque 1: Auth + Perfil + Estadísticas

### Añadido

**Backend**
- Middleware `auth.middleware.ts`, `express.d.ts`, `HttpError.forbidden`, repositorio de usuarios, servicio de estadísticas, controladores y rutas de usuario.
- Migración SQL: trigger `handle_new_user` mejorado.

**Frontend**
- `lib/supabase.ts`, `AuthProvider.tsx`, páginas de Login, Registro, Callback y Perfil.
- Métodos de usuario en `api.ts`.
- Variables de entorno `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.

### Cambiado
- `game.service.ts`: asociación de partidas a usuarios, ownership y registro de estadísticas.
- `games.controller.ts` y rutas protegidas.
- `api.ts`: JWT automático y corrección de código huérfano.
- `App.tsx`: envuelto en `AuthProvider`.

### Corregido
- Errores de TypeScript por `HttpError.forbidden` y páginas faltantes.

### Pendiente
- Tests de auth y stats. Playwright E2E.

---

## [Sesión previa] — Limpieza de datos + endurecimiento P0/P1/P2/P3

- Imágenes Star Wars completadas (35/47 con arte, 12 con placeholder).
- Deduplicación de 30 personajes (Marvel y Star Wars).
- Atributos desincronizados corregidos en ambas temáticas.
- Backend endurecido: `helmet`, `express-rate-limit`, `zod`, `HttpError`, `error.middleware`, `async-handler`, `text.utils`.
- Frontend: `ErrorBoundary`, `AppHeader`, accesibilidad básica.
- Vitest configurado en backend (13 tests).
- `.env.example` creados.
- Rutas `/api/debug/*` e `/api/import/*` restringidas a desarrollo.
