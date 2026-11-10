# 🎯 GuessVerse — Estado del proyecto

> **🕒 Última actualización:** Bloques 1, 2 y 3 completados.  
> 🎮 Juego funcional con autenticación, 5 temáticas base, importador dinámico y multijugador 1v1 en tiempo real, incluyendo gestión de desconexiones y preguntas personalizadas.  
> **⏳ Pendiente:** Despliegue a producción y funcionalidades avanzadas de IA.  
> 📄 Ver `docs/CHANGELOG.md`.

---

## 1. 📖 Resumen

Juego web de deducción tipo «¿Quién es quién?» con personajes de cultura popular. El usuario elige una temática, ve un tablero de personajes y hace preguntas estructuradas para descubrir el personaje secreto.

**Estado actual:** MVP jugable con autenticación, importación dinámica y multijugador 1v1.

- 🎭 **Temáticas base:** Marvel, Star Wars, Pokémon, Harry Potter y DC Comics.
- 🧲 **Importación dinámica:** franquicias de TMDB (películas y series) y AniList (anime).
- 👥 **Multijugador:** salas privadas por código, turnos alternos, preguntas en tiempo real y gestión de desconexiones.
- ⏳ **Pendiente:** despliegue y funcionalidades avanzadas de IA.

---

## 2. 🧰 Stack tecnológico

### 2.1. 🎨 Frontend

- React 19 + TypeScript
- Vite 8
- Tailwind CSS v4 (`@tailwindcss/vite`, sin `tailwind.config.js`)
- React Router 7
- Zustand 5 (persistencia en `localStorage`)
- **Supabase JS:** Auth + `anon key`
- **Socket.IO Client:** comunicación en tiempo real

### 2.2. ⚙️ Backend

- Node.js + Express 5 + TypeScript
- `tsx watch` en desarrollo (`tsc` para build)
- `tsconfig` con `NodeNext`; imports con extensión `.js`
- CORS configurable mediante `CORS_ORIGINS` (obligatorio en producción)
- `helmet` + `express-rate-limit` (120 req/min) y `x-powered-by` desactivado
- Validación de entrada con `zod`
- Middleware centralizado de errores (`error.middleware.ts`) + `notFoundHandler`
- `auth.middleware.ts`: `requireAuth` / `optionalAuth` (verifica JWT con `supabaseAdmin.auth.getUser()`)
- Socket.IO con lógica de salas, turnos y reconexiones
- Apagado ordenado mediante `SIGINT` / `SIGTERM`

### 2.3. 🗄️ Base de datos

- PostgreSQL en **Supabase** (plan Free)
- Tablas con triggers y RLS activo
- Cliente backend: `@supabase/supabase-js` con `service_role`
- Cliente frontend: `anon` (solo Auth)

### 2.4. 🌐 Integraciones externas

- **TMDB:** películas y series, además de búsqueda de colecciones/franquicias.
- **AniList:** anime y manga (GraphQL).
- **PokeAPI:** Pokémon Gen 1.
- **SuperHero API (akabab):** imágenes y datos de Marvel y DC.
- **akabab/starwars-api:** imágenes de Star Wars.
- **HP-API:** personajes e imágenes de Harry Potter.
- **Wikidata:** clasificación de roles y especies.
- **Wikipedia / Fandom:** búsqueda de imágenes de personajes.
- **Supabase Auth:** registro, login y confirmación por email.

### 2.5. 🧪 Testing

- Vitest configurado en backend; 13 tests existentes.
- **Pendiente:** tests de `auth.middleware`, `stats.service`, `multiplayer.socket.ts` y flujos E2E con Playwright.

### 2.6. 📦 Contenedores

- No se usa Docker (restricción del proyecto).

### 2.7. 🎨 Identidad visual

- **Nombre:** guessVerse · **Estilo:** moderno, tecnológico y divertido.
- **Paleta:** violeta `#762BFF`, rosa `#F02C9B`, naranja `#FF9A35`, azul noche `#08091F`, blanco `#FFFFFF` y gris claro `#B8B8CC`.
- **Tipografía:** `Nunito` (sans-serif redondeada y moderna).
- **Recursos:** logo, favicons e iconos PWA en `frontend/public/`.
- **Documentación:** `docs/BRANDING.md`.

---

## 3. 🗂️ Estructura de carpetas

```text
guessverse/
├── frontend/
│   ├── src/
│   │   ├── lib/
│   │   │   ├── supabase.ts
│   │   │   └── socket.ts
│   │   ├── features/auth/AuthProvider.tsx
│   │   ├── components/
│   │   │   └── (Modal, ErrorBoundary, AppHeader, ProtectedRoute, Spinner)
│   │   ├── pages/
│   │   │   ├── HomePage.tsx
│   │   │   ├── GamePage.tsx
│   │   │   ├── MultiplayerGamePage.tsx
│   │   │   ├── LobbyPage.tsx
│   │   │   ├── LoginPage.tsx
│   │   │   ├── RegisterPage.tsx
│   │   │   ├── AuthCallbackPage.tsx
│   │   │   ├── ProfilePage.tsx
│   │   │   ├── ThemeDetailPage.tsx
│   │   │   └── DiscoverPage.tsx
│   │   ├── services/api.ts
│   │   ├── stores/game.store.ts
│   │   └── App.tsx
│   ├── .env.example
│   └── package.json
├── backend/
│   ├── src/
│   │   ├── config/env.ts
│   │   ├── db/supabase.ts
│   │   ├── types/express.d.ts
│   │   ├── integrations/
│   │   │   ├── tmdb/
│   │   │   ├── pokeapi/
│   │   │   ├── hpapi/
│   │   │   ├── akabab/
│   │   │   ├── wikidata/
│   │   │   ├── wikipedia/
│   │   │   └── fandom/
│   │   ├── middleware/
│   │   │   ├── error.middleware.ts
│   │   │   └── auth.middleware.ts
│   │   ├── utils/
│   │   ├── repositories/
│   │   ├── services/
│   │   │   ├── themes.service.ts
│   │   │   ├── questions.service.ts
│   │   │   ├── game.service.ts
│   │   │   ├── game.rules.ts
│   │   │   ├── stats.service.ts
│   │   │   ├── discover.service.ts
│   │   │   ├── import-franchise.service.ts
│   │   │   └── import-*.service.ts
│   │   ├── controllers/
│   │   ├── routes/
│   │   ├── sockets/multiplayer.socket.ts
│   │   └── server.ts
│   ├── .env
│   ├── .env.example
│   └── package.json
├── docs/
│   ├── PROJECT_STATE.md
│   ├── BRANDING.md
│   ├── auth.md
│   └── CHANGELOG.md
├── .env.example
├── .gitattributes
├── .gitignore
└── README.md
```

---

## 4. 🧱 Esquema de base de datos

### 4.1. 📋 Tablas principales

`users`, `themes`, `franchises`, `characters`, `character_sources`, `games`, `game_players`, `game_characters`, `questions`, `game_questions`, `guesses` y `statistics`.

### 4.2. 🔑 Campos clave añadidos recientemente

- `games`: `room_code` (`VARCHAR 5`), `current_turn_user_id`.
- `game_players`: `is_connected` (`BOOLEAN`), `secret_character_id`.
- `game_characters`: `eliminated_by_host` (`BOOLEAN`), `eliminated_by_guest` (`BOOLEAN`).
- `questions`: `theme_id` (`UUID`, para preguntas personalizadas).
- `characters`: `attributes` (`JSONB`) para especies, casas y atributos dinámicos.

### 4.3. ❓ Categorías de preguntas

- 🦸 **Marvel / DC:** `{identity, role, abilities}`
- 🐾 **Pokémon:** `{pokemon}`
- 🧙 **Harry Potter:** `{identity, role, abilities, hogwarts}`
- ✏️ **Personalizadas:** categoría `custom`, vinculadas a una temática.

---

## 5. 🌱 Variables de entorno

### 5.1. ⚙️ Backend — `backend/.env`

```dotenv
TMDB_ACCESS_TOKEN=
SUPABASE_URL=https://coysyijneoobxgjrlral.supabase.co
SUPABASE_SERVICE_ROLE_KEY=
PORT=3000
NODE_ENV=development
# CORS_ORIGINS=https://guessverse.vercel.app,http://localhost:5173
```

### 5.2. 🎨 Frontend — `frontend/.env`

```dotenv
VITE_API_URL=http://localhost:3000
VITE_SUPABASE_URL=https://coysyijneoobxgjrlral.supabase.co
VITE_SUPABASE_ANON_KEY= # publishable key
```

---

## 6. 🔌 API y eventos en tiempo real

### 6.1. 🌍 Rutas REST principales

- `GET /api/themes`
- `GET /api/themes/:slug`
- `POST /api/themes/:slug/questions` — crear pregunta personalizada
- `GET /api/themes/:slug/questions`
- `POST /api/games` — crear partida individual
- `POST /api/games/:id/questions`
- `POST /api/games/:id/guess`
- `POST /api/games/:id/abandon`
- `GET /api/discover` — buscador de franquicias
- `POST /api/discover/import` — importar franquicia
- Rutas de usuario: `/api/users/me`, `/api/users/me/stats`, `/api/users/me/games`.

### 6.2. ⚡ Eventos Socket.IO (multijugador)

- `create_room`, `join_room`
- `request_game_state` (reconexión automática)
- `ask_question`, `question_result`, `opponent_asked`
- `make_guess`, `wrong_guess`, `game_over`
- `abandon_game`
- `disconnect` (temporizador de 30 segundos)
- `opponent_disconnected`, `opponent_reconnected`

---

## 7. ❓ Sistema de preguntas y atributos

- 📌 **Preguntas generales:** `is_male`, `is_female`, `is_human`, `is_hero`, `is_villain`, `is_protagonist`, `has_powers`, `uses_weapon`, `is_royal`, `is_soldier`, `is_scientist`, `is_alien`, `is_mutant`, `has_magic`, `is_immortal`, `is_criminal`.
- ⚡ **Preguntas dinámicas:** se generan automáticamente a partir de la especie de los personajes (por ejemplo, «¿Es un/a pirata?»).
- ✏️ **Preguntas personalizadas:** se crean desde la interfaz y se guardan en `questions` con `theme_id`; se incorporan dinámicamente al editor de personajes.

---

## 8. 🎨 Frontend

### 8.1. 🧭 Rutas principales

- `/` — `HomePage`
- `/game/:themeSlug` — juego individual
- `/lobby` — crear/unirse a sala multijugador
- `/multiplayer/:gameId` — tablero multijugador
- `/themes/:slug` — detalle y catálogo de temática
- `/discover` — buscador dinámico
- `/login`, `/register`, `/auth/callback`, `/profile`

### 8.2. ✨ Funcionalidades destacadas

- 🖼️ **Catálogo (`ThemeDetailPage`):** galería de personajes, buscador, modal de edición con checkboxes dinámicos y creación de preguntas personalizadas.
- 👥 **Multijugador (`MultiplayerGamePage`):** tablero, panel de preguntas, historial, turnos, aviso de desconexión y modal de fin de partida.
- 🚪 **Lobby (`LobbyPage`):** creación de salas con código de 5 letras y sistema de unión.

---

## 9. 🗺️ Roadmap

| Bloque | Estado |
|---|---|
| A — Ampliar contenido base | ✅ Completado |
| 1 — Auth + perfil + stats | ✅ Completado |
| 2 — Temáticas base + buscador dinámico | ✅ Completado |
| 3 — Multijugador 1v1 | ✅ Completado |
| 4 — IA / preguntas libres | ⏳ Pendiente |
| C — Deploy | ⏳ Pendiente |

---

## 10. 🔒 Seguridad

- Las claves expuestas en chats deben rotarse antes de producción.
- `service_role` solo se utiliza en backend; `anon` en frontend.
- `requireAuth` protege rutas de juego y usuarios (401 / 403).
- CORS configurable; Helmet y rate-limit activos.
- Validación estricta de turnos y propiedad de partidas en Socket.IO.

---

## 11. 🚀 Cómo ejecutar y verificar

### 11.1. ⚙️ Backend

```bash
cd backend
npm install
npm run dev
```

### 11.2. 🎨 Frontend

```bash
cd frontend
npm install
npm run dev
```

---

## 12. 📐 Convenciones

- Imports del backend con extensión `.js`.
- `await res.json()` siempre casteado (`as MyType`).
- Lógica de negocio en `services/`; controladores delgados.
- `req.user!.id` en rutas protegidas.
- Sin Docker.
- TypeScript estricto.
- Commits en español.
