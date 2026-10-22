# GuessVerse — Estado del proyecto

> **Última actualización:** Bloques 1 (Auth) y 2 (Más temáticas) completados.  
> Registro con verificación, JWT en backend, perfil con estadísticas y ampliación a 5 temáticas jugables: Marvel, Star Wars, Pokémon, Harry Potter y DC Comics.  
> **Pendiente:** Bloque 3 (Multijugador). Resident Evil queda pospuesto.  
> Ver `docs/CHANGELOG.md`.

---

## 1. Resumen

Juego web de deducción tipo «¿Quién es quién?» con personajes de cultura popular. El usuario elige una temática, ve un tablero de personajes y hace preguntas estructuradas para descubrir el personaje secreto.

**Estado actual:** MVP jugable con autenticación completa y 5 temáticas.

- **Temáticas:** Marvel, Star Wars, Pokémon, Harry Potter y DC Comics.
- **Autenticación:** registro e inicio de sesión con verificación de email.
- **Perfil:** historial y estadísticas por usuario.
- **Pendiente:** multijugador y despliegue.

---

## 2. Stack tecnológico

### 2.1. Frontend

- React 19 + TypeScript
- Vite 8
- Tailwind CSS v4 (plugin `@tailwindcss/vite`, sin `tailwind.config.js`)
- React Router 7
- Zustand 5 (con persistencia en `localStorage`)
- **Supabase JS:** Auth + `anon key`

### 2.2. Backend

- Node.js + Express 5 + TypeScript
- `tsx watch` en desarrollo (`tsc` para build)
- `tsconfig` con `NodeNext`; imports con extensión `.js`
- CORS configurable mediante `CORS_ORIGINS` (obligatorio en producción)
- `helmet` + `express-rate-limit` (120 req/min) y `x-powered-by` desactivado
- Validación de entrada con `zod`
- Middleware centralizado de errores (`error.middleware.ts`) + `notFoundHandler`
- `auth.middleware.ts`: `requireAuth` / `optionalAuth` (verifica JWT con `supabaseAdmin.auth.getUser()`)
- Apagado ordenado mediante `SIGINT` / `SIGTERM`
- **Socket.IO:** todavía no instalado (reservado para Fase 6)

### 2.3. Base de datos

- PostgreSQL en **Supabase** (plan Free)
- 12 tablas, triggers y RLS activo
- Cliente backend: `@supabase/supabase-js` con `service_role`
- Cliente frontend: `anon` (solo Auth)

### 2.4. Integraciones externas

- **TMDB** (películas y series): Marvel MCU + Star Wars Skywalker Saga
- **PokeAPI** (Pokémon): Gen 1 (IDs 1–50)
- **SuperHero API (akabab):** imágenes y datos de Marvel y DC Comics
- **akabab/starwars-api:** imágenes de Star Wars
- **HP-API** (`hp-api.onrender.com`): personajes e imágenes de Harry Potter
- **Supabase Auth:** registro, login y confirmación por email

### 2.5. Testing

- **Vitest** configurado en backend (`npm test`): reglas de juego y utilidades de texto.
- 13 tests existentes.
- **Pendiente:** tests de `auth.middleware` y `stats.service`.

### 2.6. Contenedores

- No se usa Docker (restricción del proyecto).

---

## 3. Estructura de carpetas

```text
guessverse/
├── frontend/
│   ├── src/
│   │   ├── lib/
│   │   │   └── supabase.ts                  (cliente anon)
│   │   ├── features/
│   │   │   └── auth/
│   │   │       └── AuthProvider.tsx         (contexto Auth)
│   │   ├── components/
│   │   │   ├── Modal.tsx
│   │   │   ├── ErrorBoundary.tsx
│   │   │   ├── AppHeader.tsx
│   │   │   └── ProtectedRoute.tsx
│   │   ├── pages/
│   │   │   ├── HomePage.tsx
│   │   │   ├── GamePage.tsx
│   │   │   ├── LoginPage.tsx
│   │   │   ├── RegisterPage.tsx
│   │   │   ├── AuthCallbackPage.tsx
│   │   │   └── ProfilePage.tsx
│   │   ├── services/
│   │   │   └── api.ts                       (auth-aware + endpoints users)
│   │   ├── stores/
│   │   │   └── game.store.ts                (Zustand + persistencia)
│   │   └── App.tsx                          (Router + ErrorBoundary + AuthProvider + ProtectedRoute)
│   ├── .env.example                         (VITE_API_URL, VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)
│   └── package.json
│
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   └── env.ts                       (validación fail-fast + CORS)
│   │   ├── db/
│   │   │   └── supabase.ts                  (cliente service_role)
│   │   ├── types/
│   │   │   └── express.d.ts                 (req.user)
│   │   ├── integrations/
│   │   │   ├── tmdb/{client,credits,types}.ts
│   │   │   ├── pokeapi/client.ts
│   │   │   ├── hpapi/client.ts              (Harry Potter)
│   │   │   └── akabab/client.ts             (Marvel / DC)
│   │   ├── middleware/
│   │   │   ├── error.middleware.ts          (errorHandler + notFoundHandler)
│   │   │   └── auth.middleware.ts           (requireAuth / optionalAuth)
│   │   ├── utils/
│   │   │   ├── http-error.ts                (HttpError, incluido forbidden 403)
│   │   │   ├── async-handler.ts
│   │   │   └── text.ts
│   │   ├── repositories/
│   │   │   ├── themes.repository.ts
│   │   │   ├── questions.repository.ts
│   │   │   └── users.repository.ts
│   │   ├── services/
│   │   │   ├── themes.service.ts
│   │   │   ├── questions.service.ts
│   │   │   ├── game.service.ts              (stats + ownership)
│   │   │   ├── game.rules.ts                (puro: evaluate / shuffle)
│   │   │   ├── stats.service.ts             (recordGameResult / getStats)
│   │   │   ├── import.service.ts            (personajes Marvel)
│   │   │   ├── import-starwars.service.ts
│   │   │   ├── import-pokemon.service.ts
│   │   │   ├── import-harrypotter.service.ts (Harry Potter)
│   │   │   ├── import-dc.service.ts         (DC)
│   │   │   ├── attribute-seed.service.ts    (Marvel)
│   │   │   ├── attribute-seed-starwars.service.ts
│   │   │   ├── attribute-seed-harrypotter.service.ts
│   │   │   ├── attribute-seed-dc.service.ts
│   │   │   └── import-*-images.service.ts
│   │   ├── controllers/
│   │   │   ├── themes.controller.ts
│   │   │   ├── questions.controller.ts
│   │   │   ├── games.controller.ts           (usa req.user!.id)
│   │   │   └── users.controller.ts
│   │   ├── routes/
│   │   │   ├── themes.routes.ts
│   │   │   ├── questions.routes.ts
│   │   │   ├── games.routes.ts               (requireAuth en todas)
│   │   │   ├── users.routes.ts               (requireAuth)
│   │   │   ├── debug.routes.ts               (solo dev)
│   │   │   └── import.routes.ts              (solo dev)
│   │   └── server.ts
│   ├── .env                                  (NO se commitea)
│   ├── .env.example
│   └── package.json
│
├── docs/
│   ├── PROJECT_STATE.md                     (este archivo)
│   ├── auth.md
│   └── CHANGELOG.md
├── .env.example
├── .gitattributes
├── .gitignore
└── README.md
```

---

## 4. Esquema de base de datos

### 4.1. Tablas

12 tablas:

`users`, `themes`, `franchises`, `characters`, `character_sources`, `games`, `game_players`, `game_characters`, `questions`, `game_questions`, `guesses` y `statistics`.

### 4.2. Campos clave

La tabla `characters` incluye:

- Identificación y contenido: `id`, `franchise_id`, `slug`, `name`, `description`, `image_url`
- Características: `gender`, `species`, `house` (nuevo para Harry Potter)
- Atributos: `is_human`, `is_hero`, `is_villain`, `is_protagonist`, `has_powers`, `uses_weapon`
- Auditoría: `created_at`, `updated_at`

Los campos booleanos admiten `NULL` y producen `unknown` en el juego.

### 4.3. Categorías de preguntas por temática

El campo `themes.question_categories` es de tipo `text[]`:

- **Marvel / DC:** `{identity, role, abilities}`
- **Pokémon:** `{pokemon}`
- **Harry Potter:** `{identity, role, abilities, hogwarts}`

---

## 5. Variables de entorno

### 5.1. Backend — `backend/.env`

```dotenv
TMDB_ACCESS_TOKEN=
SUPABASE_URL=https://coysyijneoobxgjrlral.supabase.co
SUPABASE_SERVICE_ROLE_KEY=
PORT=3000
NODE_ENV=development
# CORS_ORIGINS=https://guessverse.vercel.app,http://localhost:5173
```

### 5.2. Frontend — `frontend/.env`

```dotenv
VITE_API_URL=http://localhost:3000
VITE_SUPABASE_URL=https://coysyijneoobxgjrlral.supabase.co
VITE_SUPABASE_ANON_KEY=    # publishable key
```

---

## 6. API REST

### 6.1. Rutas públicas

- `GET /api/health`
- `GET /api/themes`
- `GET /api/themes/:slug/questions`

### 6.2. Rutas protegidas (JWT)

- `POST /api/games`
- `GET /api/games/:id`
- `POST /api/games/:id/questions`
- `POST /api/games/:id/guess`
- `POST /api/games/:id/abandon`
- `GET /api/users/me`
- `PATCH /api/users/me`
- `GET /api/users/me/stats`
- `GET /api/users/me/games`

### 6.3. Rutas solo para desarrollo

Endpoints de importación para Marvel, Star Wars, Pokémon, Harry Potter y DC.

---

## 7. Sistema de preguntas

Las preguntas son estructuradas y no utilizan IA. Cada pregunta contiene: `code`, `text_es`, `attribute`, `operator`, `value` y `category`.

### 7.1. Preguntas generales

Para Marvel, Star Wars (SW), DC y Harry Potter:

`is_male`, `is_female`, `is_human`, `is_hero`, `is_villain`, `is_protagonist`, `has_powers`, `uses_weapon`.

### 7.2. Preguntas de Pokémon

Ejemplos: `pokemon_fire`, `pokemon_water`, etc. Se evalúan contra `species`.

### 7.3. Preguntas de Harry Potter

Preguntas específicas de casas (`hp_gryffindor`, `hp_slytherin`, etc.) que evalúan el campo `house`.

---

## 8. Frontend

### 8.1. Rutas protegidas

Redirigen a `/login` si no hay sesión:

- `/`
- `/game/:themeSlug`
- `/profile`

### 8.2. Rutas públicas

- `/login`
- `/register`
- `/auth/callback`

### 8.3. Componentes y funcionalidades

- **`GamePage`:** tablero responsive, descarte de cartas, preguntas dinámicas, botón para adivinar y modales de victoria / derrota.
- **`ProfilePage`:** estadísticas e historial de partidas.
- **Persistencia:** partida guardada en `localStorage`.
- **API:** `api.ts` añade el JWT automáticamente.

---

## 9. Estado actual de los datos

| Temática | Total | Con imagen | Sin imagen |
|---|---:|---:|---:|
| Marvel (MCU) | 31 | 30 | 1 (placeholder) |
| Star Wars | 47 | 35 | 12 (placeholder) |
| Pokémon | 50 | 50 | 0 ✅ |
| Harry Potter | 27 | 27 | 0 ✅ |
| DC Comics | 30 | 30 | 0 ✅ |
| Resident Evil | 0 | 0 | 0 (pospuesto) |

---

## 10. Roadmap

| Bloque | Estado |
|---|---|
| A — Ampliar contenido base | ✅ Completado |
| 1 — Auth + perfil + stats | ✅ Completado |
| 2 — Más temáticas (HP, DC) | ✅ Completado |
| 3 — Multijugador 1v1 | ⏳ Siguiente |
| 4 — IA / preguntas libres | ⏳ Pendiente |
| C — Deploy | ⏳ Al final |

---

## 11. Seguridad

- Las claves expuestas en chats deben rotarse antes de producción.
- `service_role` solo se utiliza en backend; `anon` en frontend.
- El middleware `requireAuth` protege las rutas de juego y usuarios (401 / 403).
- CORS configurable; `Helmet` y `rate-limit` activos.

---

## 12. Cómo ejecutar y verificar

### 12.1. Backend

```bash
cd backend
npm install
npm run dev
```

### 12.2. Frontend

```bash
cd frontend
npm install
npm run dev
```

---

## 13. Convenciones

- Imports del backend con extensión `.js`.
- `await res.json()` siempre casteado (`as MyType`).
- Lógica de negocio en `services/`; controladores delgados.
- `req.user!.id` en rutas protegidas.
- Sin Docker.
- TypeScript estricto.
- Commits en español.
