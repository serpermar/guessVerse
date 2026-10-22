# GuessVerse

Juego web de deducción inspirado en **¿Quién es quién?**, en el que puedes descubrir personajes de la cultura popular mediante preguntas y pistas.

## Tecnologías

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS, Zustand y Supabase JS.
- **Backend:** Node.js, Express 5 y TypeScript.
- **Base de datos:** PostgreSQL mediante Supabase.
- **Autenticación:** Supabase Auth (email + password + verificación).
- **Fuentes de datos:** TMDB (Marvel MCU, Star Wars Skywalker Saga), PokeAPI (Pokémon), SuperHero API (imágenes Marvel) y akabab (imágenes Star Wars).

> Socket.IO y la integración con IGDB están planificados pero **aún no implementados**.

## Requisitos previos

Antes de instalar el proyecto, asegúrate de tener:

- [Git](https://git-scm.com/downloads).
- [Node.js](https://nodejs.org/) — preferiblemente una versión LTS compatible con las dependencias.
- npm, incluido con Node.js.
- Un proyecto en [Supabase](https://supabase.com/) con Auth y las tablas del esquema.
- Credenciales de API de [TMDB](https://www.themoviedb.org/settings/api).

**No necesitas Docker** para ejecutar el proyecto localmente.

## Instalación en otro ordenador

### 1. Clonar el repositorio

```bash
git clone https://github.com/serpermar/guessVerse.git
cd guessVerse
code .
```

### 2. Instalar dependencias del backend

```bash
cd backend
npm install
```

### 3. Variables de entorno del backend

Crea `backend/.env` al mismo nivel que su `package.json`:

```dotenv
# ============================================
# TMDB
# ============================================
TMDB_ACCESS_TOKEN=tu_tmdb_access_token

# ============================================
# Supabase
# ============================================
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=tu_supabase_service_role_key

# ============================================
# Backend
# ============================================
PORT=3000
NODE_ENV=development

# CORS: obligatorio en producción (dominios separados por coma).
# CORS_ORIGINS=https://guessverse.vercel.app,http://localhost:5173
```

#### ¿Para qué sirve cada variable?

- `TMDB_ACCESS_TOKEN`: acceso a la API de TMDB (importaciones).
- `SUPABASE_URL`: URL del proyecto de Supabase.
- `SUPABASE_SERVICE_ROLE_KEY`: clave privilegiada del backend. **Nunca debe usarse en el frontend.**
- `PORT`: puerto del backend.
- `NODE_ENV`: entorno de ejecución.
- `CORS_ORIGINS`: dominios permitidos. **Obligatoria cuando `NODE_ENV=production`.**

> **Seguridad:** no guardes credenciales reales en este README ni las subas al repositorio. `backend/.env` debe estar en `.gitignore`.

### 4. Instalar dependencias del frontend

En otra terminal, desde la raíz:

```bash
cd frontend
npm install
```

### 5. Variables de entorno del frontend

Crea `frontend/.env` al mismo nivel que su `package.json`:

```dotenv
VITE_API_URL=http://localhost:3000
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu_supabase_anon_o_publishable_key
```

**Importante:** las variables que empiezan por `VITE_` se incluyen en el bundle del navegador. La `VITE_SUPABASE_ANON_KEY` es pública por diseño (solo permite Auth). **Nunca** pongas aquí `SUPABASE_SERVICE_ROLE_KEY` ni `TMDB_ACCESS_TOKEN`.

Si cambias variables de entorno, **reinicia Vite** para que las recoja.

### 6. Iniciar el backend

```bash
cd backend
npm run dev
```

Verifica:

```bash
curl http://localhost:3000/api/health
```

### 7. Iniciar el frontend

En otra terminal:

```bash
cd frontend
npm run dev
```

Vite mostrará `http://localhost:5173`. Ábrelo en el navegador.

## Configuración de Supabase Auth (necesaria para registro)

En el panel de Supabase:

1. **Authentication → Providers → Email** → activa **Confirm email**.
2. **Authentication → URL Configuration**:
   - **Site URL**: `http://localhost:5173`
   - **Redirect URLs**: `http://localhost:5173/auth/callback` y `http://localhost:5173/**`
3. **Authentication → Email Templates → Confirm sign up** → usa un enlace como:
   ```html
   <a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=signup&next={{ .RedirectTo }}">
     Confirmar mi cuenta
   </a>
   ```

Ver `docs/auth.md` para el flujo completo.

## Uso habitual

1. Abre la carpeta `guessVerse`.
2. Terminal 1: `cd backend` → `npm run dev`.
3. Terminal 2: `cd frontend` → `npm run dev`.
4. Abre la URL que indique Vite.
5. Regístrate → confirma el email → juega.

No hace falta `npm install` cada vez.

## Actualizar una copia existente

```bash
git pull origin main
```

Si cambian dependencias, repite `npm install` en `backend/` y `frontend/`. `git pull` **no** descarga `.env` locales.

## Acceder desde otro dispositivo de la misma red

1. Averigua la IP local del ordenador servidor.
2. Vite: `npm run dev -- --host 0.0.0.0`
3. Configura `VITE_API_URL` con la IP del servidor (no `localhost`).
4. Revisa CORS del backend (`CORS_ORIGINS`).
5. Abre solo los puertos necesarios en el firewall.

No expongas el backend directamente a Internet ni publiques credenciales.

## Desplegar en producción

Frontend y backend deben desplegarse en servicios accesibles por HTTPS (ej. Vercel + Railway/Render). Configura:

- `VITE_API_URL` en el frontend apuntando a la URL pública del backend.
- `CORS_ORIGINS` en el backend con el dominio del frontend.
- Rota las claves comprometidas antes de exponer el registro.

## Scripts disponibles

| Comando | Dónde | Uso |
|---|---|---|
| `npm install` | ambos | Instala dependencias. |
| `npm run dev` | ambos | Backend (`tsx watch`) / Frontend (Vite). |
| `npm run build` | ambos | Compila (`tsc` / `tsc -b && vite build`). |
| `npm run typecheck` | backend | Comprueba tipos sin emitir. |
| `npm test` | backend | Ejecuta tests (Vitest). |
| `npm run lint` | frontend | Ejecuta ESLint. |
| `npm start` | backend | Ejecuta el build (`node dist/server.js`). |

## Endpoints principales

**Públicos:**
- `GET /api/health`
- `GET /api/themes`
- `GET /api/themes/:slug/questions`

**Protegidos (requieren `Authorization: Bearer <jwt>`):**
- `POST /api/games`
- `GET /api/games/:id`
- `POST /api/games/:id/questions`
- `POST /api/games/:id/guess`
- `POST /api/games/:id/abandon`
- `GET /api/users/me`
- `PATCH /api/users/me`
- `GET /api/users/me/stats`
- `GET /api/users/me/games`

Ver `docs/PROJECT_STATE.md` para el detalle completo.

## Solución de problemas

### El backend no arranca
- Verifica `npm install` en `backend/`.
- Revisa `backend/.env` (variables correctas).
- Comprueba que el puerto está libre.

### El frontend no conecta al backend
- Backend iniciado.
- `VITE_API_URL` correcta.
- Si accedes desde otro dispositivo, revisa IP, firewall y CORS.

### No llega el email de confirmación
- Revisa spam.
- Comprueba la plantilla "Confirm sign up" en Supabase.
- Si persiste, configura un SMTP propio (Resend/Brevo) en Supabase.

### No se cargan datos de Supabase o TMDB
- Revisa credenciales y nombres de variables.
- Comprueba que Supabase tiene el esquema aplicado.
- Mira los logs del backend.

### Tras clonar, el proyecto no funciona
- `npm install` en `backend/` y `frontend/`.
- Crea ambos `.env` con las variables correctas.
- Verifica el esquema y políticas en Supabase.

## Seguridad

- No subas `.env` con credenciales reales.
- `SUPABASE_SERVICE_ROLE_KEY` y `TMDB_ACCESS_TOKEN`: **solo backend**.
- No incluyas secretos en el bundle del frontend.
- Usa variables distintas para desarrollo y producción.
- Revisa RLS y políticas en Supabase antes de desplegar.
- Si una clave se publica accidentalmente, **rótala** en el proveedor.

## Repositorio

[github.com/serpermar/guessVerse](https://github.com/serpermar/guessVerse)