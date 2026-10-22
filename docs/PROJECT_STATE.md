# GuessVerse — Estado del proyecto

> Última actualización: tras la sesión de **limpieza de datos** (imágenes Star
> Wars, deduplicación, atributos) y **endurecimiento P0/P2/P3** (seguridad,
> validación, tests, a11y). Pendiente: deploy (Opción C). Ver `docs/CHANGELOG.md`.

---

## 1. Resumen

Juego web de deducción tipo "¿Quién es quién?" con personajes de cultura
popular. El usuario elige una temática, ve un tablero de personajes y hace
preguntas estructuradas para descubrir el personaje secreto.

Estado actual: **MVP jugable en local** con 3 temáticas (Marvel, Star Wars,
Pokémon). Sin autenticación, sin multijugador, sin deploy todavía.

---

## 2. Stack

### Frontend
- React 19 + TypeScript
- Vite 8
- Tailwind CSS v4 (plugin `@tailwindcss/vite`, **sin** `tailwind.config.js`)
- React Router 7
- Zustand 5 (con persistencia en `localStorage`)

### Backend
- Node.js + Express 5 + TypeScript
- `tsx watch` en desarrollo (`tsc` para build)
- `tsconfig` con `NodeNext` → imports con extensión `.js`
- CORS configurable vía `CORS_ORIGINS` (obligatorio en producción)
- `helmet` + `express-rate-limit` (120 req/min) + `x-powered-by` desactivado
- Validación de entrada con `zod`
- Middleware centralizado de errores (`error.middleware.ts`) + `notFoundHandler`
- Apagado ordenado (`SIGINT`/`SIGTERM`)
- Socket.IO **no instalado todavía** (reservado para Fase 6)

### Base de datos
- PostgreSQL en **Supabase** (plan Free)
- 12 tablas + triggers + RLS activo
- Cliente backend: `@supabase/supabase-js` con `service_role`

### Integraciones externas
- **TMDB** (películas/series): Marvel MCU + Star Wars Skywalker Saga
- **PokeAPI** (pokémon): Gen 1 (IDs 1–50)
- **SuperHero API (akabab)** — imágenes Marvel (arte de cómic)
- **akabab/starwars-api** — imágenes Star Wars

### Testing
- **Vitest** configurado en backend (`npm test`): reglas de juego y utilidades
  de texto. 13 tests. Supertest / Playwright: **pendientes**.

### Contenedores
- **NO** se usa Docker (restricción del proyecto)

---

## 3. Estructura de carpetas

```
guessverse/
├── frontend/
│   ├── src/
│   │   ├── components/     Modal.tsx, ErrorBoundary.tsx
│   │   ├── pages/          HomePage, GamePage
│   │   ├── services/       api.ts (cliente HTTP tipado)
│   │   ├── stores/         game.store.ts (Zustand + persistencia)
│   │   └── App.tsx         Router (+ ErrorBoundary global)
│   ├── .env.example        VITE_API_URL
│   └── package.json
│
├── backend/
│   ├── src/
│   │   ├── config/env.ts               validación fail-fast + CORS
│   │   ├── db/supabase.ts              cliente service_role
│   │   ├── integrations/
│   │   │   ├── tmdb/{client,credits,types}.ts
│   │   │   └── pokeapi/client.ts
│   │   ├── middleware/error.middleware.ts   errorHandler + notFoundHandler
│   │   ├── utils/
│   │   │   ├── http-error.ts           HttpError
│   │   │   ├── async-handler.ts        wrapper async para controllers
│   │   │   └── text.ts                 normalizeName, slugify, ...
│   │   ├── repositories/
│   │   │   ├── themes.repository.ts
│   │   │   └── questions.repository.ts
│   │   ├── services/
│   │   │   ├── themes.service.ts
│   │   │   ├── questions.service.ts
│   │   │   ├── game.service.ts             (reexporta game.rules)
│   │   │   ├── game.rules.ts               evaluate/clampBoardSize/shuffle (puro)
│   │   │   ├── game.service.test.ts
│   │   │   ├── import-tmdb-movies.ts       base compartida TMDB
│   │   │   ├── import.service.ts             (Marvel personajes)
│   │   │   ├── import-starwars.service.ts    (Star Wars personajes)
│   │   │   ├── import-pokemon.service.ts     (Pokémon PokeAPI)
│   │   │   ├── attribute-seed.service.ts     (atributos Marvel)
│   │   │   ├── attribute-seed-starwars.service.ts
│   │   │   ├── import-marvel-images.service.ts   (SuperHero API)
│   │   │   └── import-starwars-images.service.ts (akabab SW API)
│   │   ├── controllers/    themes / questions / games
│   │   ├── routes/         themes, questions, games, debug (dev), import (dev)
│   │   └── server.ts
│   ├── .env                 (NO se commitea)
│   ├── .env.example
│   └── package.json
│
├── docs/
│   ├── PROJECT_STATE.md     ← este archivo
│   └── CHANGELOG.md
├── .env.example
├── .gitattributes
├── .gitignore
└── README.md
```

---

## 4. Esquema de base de datos

### Tablas (12)

| Tabla | Propósito |
|---|---|
| `users` | Perfil (id = `auth.users.id`) |
| `themes` | Temáticas (Marvel, Star Wars, Pokémon…) |
| `franchises` | Franquicias dentro de un theme (ej. MCU, Skywalker Saga) |
| `characters` | Personajes del juego |
| `character_sources` | Puente a APIs externas (TMDB, PokeAPI, etc.) |
| `games` | Partidas |
| `game_players` | Jugadores de cada partida (preparado multijugador) |
| `game_characters` | Tablero: personajes + estado descartado |
| `questions` | Catálogo de preguntas estructuradas |
| `game_questions` | Preguntas hechas en una partida |
| `guesses` | Intentos de adivinación |
| `statistics` | Agregados por usuario (sin usar todavía) |

### Campos clave

**`themes.question_categories` `text[]`** (añadido en Opción A)
- Determina qué categorías de preguntas se sirven para esa temática.
- Ejemplo: Marvel → `{identity,role,abilities}`; Pokémon → `{pokemon}`.

**`characters`**
```
id, franchise_id, slug, name, description, image_url,
gender, species,
is_human, is_hero, is_villain, is_protagonist,
has_powers, uses_weapon,
created_at, updated_at
```
Los booleanos son `NULL`-ables: `NULL` significa "desconocido" y produce
respuesta `unknown` en el juego.

**`character_sources`**
```
character_id, source, external_id, external_type, raw_data (jsonb)
unique (source, external_id, external_type)
```
Permite deduplicar importaciones y guardar la respuesta cruda de la API.

### Triggers
- `tg_set_updated_at` en `users` y `characters`
- `handle_new_user` (AFTER INSERT en `auth.users` → crea fila en `public.users`)

### RLS
- Catálogo público de lectura: `themes`, `franchises`, `characters`, `questions`
- `users`: solo el propio usuario
- `games`: solo el creador (se ampliará para multijugador)
- Resto: RLS activo sin políticas → solo accesible con `service_role`

### FKs con integridad al borrar (aplicado)
- `game_characters.character_id` → `ON DELETE CASCADE`
- `guesses.character_id` → `ON DELETE CASCADE`
- `games.secret_character_id` → `ON DELETE SET NULL`

---

## 5. Variables de entorno

### `backend/.env`
```env
# TMDB
TMDB_ACCESS_TOKEN=

# Supabase
SUPABASE_URL=https://cojsyijneoobxgjrlral.supabase.co
SUPABASE_SERVICE_ROLE_KEY=

# Backend
PORT=3000
NODE_ENV=development

# CORS: obligatorio en producción
# CORS_ORIGINS=https://guessverse.vercel.app,http://localhost:5173
```

> `config/env.ts` solo exige `TMDB_ACCESS_TOKEN`, `SUPABASE_URL` y
> `SUPABASE_SERVICE_ROLE_KEY`. En desarrollo, si no hay `CORS_ORIGINS`, se
> permite cualquier origen; en producción es obligatorio.

### `frontend/.env`
```env
VITE_API_URL=http://localhost:3000
```

**Reglas:**
- `.env` **nunca** se commitea (ya está en `.gitignore`). Hay `.env.example`
  versionados en `backend/` y `frontend/`.
- `SUPABASE_SERVICE_ROLE_KEY` **solo** en backend.
- Las claves pegadas en chats anteriores deben considerarse **comprometidas**
  y rotarse antes del deploy (TMDB, Twitch, Supabase `service_role`).

---

## 6. API REST (implementada)

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/health` | Health check |
| GET | `/api/themes` | Lista de temáticas activas |
| GET | `/api/themes/:slug/questions` | Preguntas filtradas por `question_categories` (sin `attribute`/`operator`/`value`) |
| POST | `/api/games` | Crear partida `{ themeSlug, boardSize }` |
| GET | `/api/games/:id` | Estado de partida + tablero |
| POST | `/api/games/:id/questions` | Preguntar `{ questionCode }` |
| POST | `/api/games/:id/guess` | Adivinar `{ characterId }` |
| POST | `/api/games/:id/abandon` | Abandonar la partida (estado `lost`) |

Todas las rutas validan la entrada con `zod`. `boardSize` se acota a `[4, 32]`;
la pregunta debe pertenecer al theme de la partida y el `characterId` debe estar
en el tablero (si no, `400`).

### Endpoints solo dev (`NODE_ENV !== 'production'`)

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/debug/tmdb/movie/:id` | Prueba TMDB |
| POST | `/api/import/marvel` | Importar personajes MCU desde TMDB |
| POST | `/api/import/attributes-marvel` | Atributos curados Marvel |
| POST | `/api/import/marvel-images` | Imágenes Marvel (SuperHero API) |
| POST | `/api/import/starwars` | Personajes Skywalker Saga desde TMDB |
| POST | `/api/import/attributes-starwars` | Atributos curados Star Wars |
| POST | `/api/import/starwars-images` | Imágenes Star Wars (akabab SW API) |
| POST | `/api/import/pokemon` | Pokémon Gen 1 desde PokeAPI |

### Respuestas del juego

**Crear partida**
```json
{ "gameId": "uuid", "theme": { "name": "..." }, "board": [/* 16 cartas */], "status": "playing" }
```

**Preguntar**
```json
{
  "question": { "code": "is_male", "text": "¿Es hombre?" },
  "answer": "yes" | "no" | "unknown",
  "matches": { "yes": ["uuid"], "no": ["uuid"], "unknown": [] }
}
```

**Adivinar**
```json
{ "correct": true|false, "status": "won"|"playing", "secret": { /* si correcto */ } }
```

---

## 7. Sistema de preguntas

Preguntas **estructuradas**, sin IA:

```
questions: { code, text_es, attribute, operator, value (jsonb), category }
```

Operadores soportados: `eq`, `ne`, `in`, `not_in`.

Evaluación en `game.service.ts#evaluate()`:
- `value === null` → `unknown`
- compara atributo del personaje secreto con `value.v`

**Marvel / Star Wars / Resident Evil / Harry Potter** (categorías `identity`, `role`, `abilities`):
`is_male`, `is_female`, `is_human`, `is_hero`, `is_villain`, `is_protagonist`, `has_powers`, `uses_weapon`.

**Pokémon** (categoría `pokemon`):
`pokemon_fire`, `pokemon_water`, `pokemon_grass`, `pokemon_electric`, `pokemon_poison`, `pokemon_flying`, `pokemon_normal`, `pokemon_bug`.
Se evalúan contra `characters.species` (tipo **primario**).

---

## 8. Frontend

### Rutas
- `/` → `HomePage` (lista de temáticas + banner "Continuar" si hay partida guardada)
- `/game/:themeSlug` → `GamePage`

### `GamePage`
- Tablero responsive (2–4 columnas según breakpoint).
- Carta: imagen si existe, si no, iniciales + gradiente determinista por nombre.
- Clic en carta → descarta / restaura.
- Botón **"🎯 Adivinar"** → modo selección + modal de confirmación.
- Panel lateral con preguntas cargadas dinámicamente desde el backend.
- Historial de preguntas.
- Modales de victoria (🏆) y derrota (💀).
- Botón "Abandonar".

### Persistencia (`game.store.ts`)
- Estado completo guardado en `localStorage` bajo `guessverse:current-game`.
- Se hidrata en `GamePage` si `status === 'idle'`.
- `HomePage` muestra banner "Continuar" con opción de descartar.
- **`startNewGame()` llama a `reset()` antes de navegar** para no reanudar
  partidas de otra temática.

### `api.ts`
Cliente tipado con `fetch`:
- `themes()`
- `questions(themeSlug)`
- `createGame(themeSlug, boardSize)`
- `askQuestion(gameId, code)`
- `guess(gameId, characterId)`

---

## 9. Estado actual de los datos

| Theme | Total | Con imagen | Sin imagen |
|---|---|---|---|
| **Marvel (MCU)** | 31 | 30 | 1 ✅ (resuelto) |
| **Star Wars** | 47 | 35 | 12 (secuelas mayores, con placeholder) |
| **Pokémon** | 50 | 50 | 0 ✅ |
| Harry Potter | 0 | 0 | 0 (theme vacío) |
| Resident Evil | 0 | 0 | 0 (theme vacío) |

### Resuelto en la última sesión

1. **Imágenes Star Wars**: `POST /api/import/starwars-images` ejecutado.
   `normalizeName` trata guiones como espacios y se ampliaron alias.
2. **Personaje Marvel sin imagen**: `ivan-vanko` no existe en akabab;
   se conserva con placeholder + atributos (villano).
3. **Deduplicación**: eliminados **30** personajes duplicados/secundarios
   (`hulk`; variantes de Palpatine, Leia, Obi-Wan, Kylo Ren, Snoke y 18
   secundarios SW sin imagen).
4. **Atributos desincronizados**: reescritos los mapas de Marvel y Star Wars.
   Verificado `unknown=0` en ambas temáticas.

> Los 12 personajes SW sin imagen que se conservan son mayores de las secuelas
> (Kylo Ren, Snoke, Hux, Maz Kanata, Rose Tico…) más `ivan-vanko`. El frontend
> usa iniciales + gradiente determinista como respaldo.

### Problemas abiertos

1. **Personajes SW sin imagen**: aceptable con placeholder; si se quiere,
   buscar fuente alternativa o eliminar.
2. **CORS**: ya no usa `origin: true`. Configurable vía `CORS_ORIGINS`
   (obligatorio en producción). El antiguo error `Failed to fetch` era síntoma
   de backend caído.
3. **Duplicados futuros**: la deduplicación se hizo con un script puntual; no
   quedó un detector permanente por `character_sources.raw_data->>'id'`.

---

## 10. Roadmap

Orden acordado: **A → C → B → D**

| Opción | Estado |
|---|---|
| **A** — Ampliar contenido (Star Wars + Pokémon) | ✅ completado (imágenes + limpieza + atributos) |
| **C** — Deploy (Vercel + Railway/Render) | ⏳ siguiente |
| **B** — Auth (Supabase) + estadísticas | ⏳ pendiente |
| **D** — Multijugador (Socket.IO) | ⏳ pendiente |

### Endurecimiento (fuera del orden A→C→B→D)
- **P0 backend** (seguridad/validación): ✅ completado y verificado.
- **P1** (no filtrar `attribute/operator/value`): ✅ completado.
- **P2 frontend** (a11y, ErrorBoundary, errores no fatales): ✅ completado.
- **P3 fundaciones** (utilidades, reglas puras, tests, `.env.example`): ✅ completado.

### Fases originales del documento
- Fase 0 (Análisis): ✅
- Fase 1 (Base): ✅
- Fase 2 (BD): ✅
- Fase 3 (Integraciones): ✅ (TMDB + PokeAPI + akabab)
- Fase 4 (Juego MVP): ✅
- Fase 5 (Usuarios): ⏳ (Opción B)
- Fase 6 (Multijugador): ⏳ (Opción D)
- Fase 7 (Avanzado): ⏳

---

## 11. Seguridad

- **Claves comprometidas**: TMDB, Twitch y Supabase `service_role` fueron
  pegadas en chat en sesiones anteriores. **Rotar antes del deploy**.
- `.env` en `.gitignore`. Verificado con `git check-ignore backend/.env`.
- `SUPABASE_SERVICE_ROLE_KEY` **nunca** en frontend.
- `express.json()` limita el body a 100kb.
- `helmet` + `express-rate-limit` (120 req/min) activos.
- Validación de entrada con `zod` en todos los controllers.
- En producción no se filtran mensajes de error internos.
- Rutas `/api/debug/*` e `/api/import/*` solo activas con
  `NODE_ENV !== 'production'` (guard corregido; antes estaban expuestas).

---

## 12. Cómo ejecutar

### Backend
```powershell
cd backend
npm install
npm run dev          # tsx watch en :3000
npm run typecheck    # tsc --noEmit
npm test             # vitest run
npm run build        # tsc → dist/
npm start            # node dist/server.js
```

### Frontend
```powershell
cd frontend
npm install
npm run dev          # Vite en :5173
npm run build
npm run preview
```

### Verificación rápida del backend
```powershell
Invoke-RestMethod http://localhost:3000/api/health
Invoke-RestMethod http://localhost:3000/api/themes
```

---

## 13. Convenciones del proyecto

- **Imports backend**: siempre con `.js` (por `NodeNext`).
- **`await res.json()`**: castear siempre (`as MyType`), porque devuelve
  `unknown` en TS estricto.
- **Lógica de negocio**: en `services/`, nunca en controllers ni componentes.
- **Controllers delgados**: validan entrada, delegan, responden.
- **Supabase**: `service_role` solo backend; el frontend usa `anon` cuando
  llegue Auth.
- **No Docker**. **No servicios de pago**. **TypeScript estricto**.
- Commits en español, formato `tipo: descripción`.

---

## 14. Próximo paso inmediato

1. **Commit** de la sesión de limpieza + endurecimiento (ver `docs/CHANGELOG.md`):
   - `fix: completar imágenes de Star Wars, deduplicar y desincronizar atributos`
   - `feat: endurecer backend (seguridad, validación, tests) y frontend (a11y)`
2. Arrancar **Opción C — Deploy**:
   - Frontend → **Vercel**
   - Backend → **Railway** (o Render)
   - Configurar `VITE_API_URL` en Vercel con la URL pública del backend.
   - Configurar `CORS_ORIGINS` en backend con el dominio de Vercel.
   - **Rotar claves comprometidas antes del deploy.**