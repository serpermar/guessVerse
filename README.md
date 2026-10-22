# GuessVerse

Juego web de deducción inspirado en **¿Quién es quién?**, en el que puedes descubrir personajes de la cultura popular mediante preguntas y pistas.

## Tecnologías

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS y Zustand.
- **Backend:** Node.js, Express 5 y TypeScript.
- **Base de datos:** PostgreSQL mediante Supabase.
- **Fuentes de datos:** TMDB (Marvel MCU, Star Wars Skywalker Saga), PokeAPI (Pokémon) y akabab (imágenes de Star Wars).

> Socket.IO y la integración con IGDB están planificados pero **aún no implementados**.

## Requisitos previos

Antes de instalar el proyecto, asegúrate de tener:

- [Git](https://git-scm.com/downloads).
- [Node.js](https://nodejs.org/) — preferiblemente una versión LTS compatible con las dependencias.
- npm, incluido con Node.js.
- Un proyecto en [Supabase](https://supabase.com/).
- Credenciales de API de [TMDB](https://www.themoviedb.org/settings/api).

**No necesitas Docker** para ejecutar el proyecto localmente.

## Instalación en otro ordenador

### 1. Clonar el repositorio

Abre PowerShell, una terminal o la terminal integrada de Visual Studio Code y ejecuta:

```bash
git clone https://github.com/serpermar/guessVerse.git
cd guessVerse
```

Para abrir el proyecto en Visual Studio Code:

```bash
code .
```

### 2. Instalar las dependencias del backend

Desde la raíz del repositorio:

```bash
cd backend
npm install
```

### 3. Configurar las variables de entorno del backend

Crea un archivo llamado `.env` dentro de `backend/`, al mismo nivel que su `package.json`.

Usa esta plantilla como referencia y sustituye los valores de ejemplo por tus propias credenciales:

```dotenv
# ============================================
# TMDB
# Obtener en: https://www.themoviedb.org/settings/api
# ============================================
TMDB_ACCESS_TOKEN=tu_tmdb_access_token

# ============================================
# Supabase
# Obtener en: Settings → API del proyecto
# ============================================
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=tu_supabase_secret_o_service_role_key

# ============================================
# Backend
# ============================================
PORT=3000
NODE_ENV=development

# CORS: obligatorio en producción (dominios separados por coma).
# CORS_ORIGINS=https://guessverse.vercel.app,http://localhost:5173
```

#### ¿Para qué sirve cada variable?

- `TMDB_ACCESS_TOKEN`: permite acceder a la API de TMDB.
- `SUPABASE_URL`: URL del proyecto de Supabase.
- `SUPABASE_SERVICE_ROLE_KEY`: clave privilegiada para operaciones de servidor. **Nunca debe utilizarse en el frontend ni exponerse al navegador.**
- `PORT`: puerto en el que escucha el backend.
- `NODE_ENV`: entorno de ejecución.
- `CORS_ORIGINS`: lista de dominios permitidos. **Obligatoria cuando `NODE_ENV=production`.**

> **Seguridad:** no guardes credenciales reales en este README ni las subas al repositorio. El archivo `backend/.env` debe estar excluido de Git mediante `.gitignore`. Comprueba también que no haya secretos incluidos en otros archivos versionados.

Si una variable no se utiliza en el código actual, no es necesario inventar un valor para ella; comprueba las referencias en el proyecto. Las variables deben llamarse exactamente como espera el código.

### 4. Instalar las dependencias del frontend

Abre una segunda terminal desde la raíz del proyecto y ejecuta:

```bash
cd frontend
npm install
```

### 5. Configurar las variables de entorno del frontend

Crea un archivo llamado `.env` dentro de `frontend/`, al mismo nivel que su `package.json`:

```dotenv
VITE_API_URL=http://localhost:3000
```

`VITE_API_URL` debe apuntar a la dirección donde se ejecuta el backend.

**Importante:** las variables que empiezan por `VITE_` se incluyen en el código accesible desde el navegador. Nunca pongas `SUPABASE_SERVICE_ROLE_KEY` ni tokens privados en el `.env` del frontend.

Si cambias las variables de entorno, reinicia el servidor de desarrollo de Vite para que cargue los nuevos valores.

### 6. Iniciar el backend

Desde `backend/`, ejecuta:

```bash
npm run dev
```

Con la configuración predeterminada, el backend utiliza el puerto `3000`. Puedes verificar que responde con:

```bash
curl http://localhost:3000/api/health
```

Mantén esta terminal abierta mientras utilizas la aplicación.

### 7. Iniciar el frontend

En la segunda terminal, desde `frontend/`, ejecuta:

```bash
npm run dev
```

Vite mostrará la dirección local de la aplicación, normalmente:

```text
http://localhost:5173
```

Abre en el navegador la dirección que aparezca en la terminal.

Si la aplicación depende de Supabase, TMDB o IGDB, comprueba que las credenciales estén configuradas y que el proyecto de Supabase tenga las tablas, políticas y datos requeridos.

## Uso habitual

Cada vez que quieras ejecutar el proyecto en desarrollo:

1. Abre la carpeta `guessVerse`.
2. Inicia el backend en una terminal: `cd backend` y `npm run dev`.
3. Asegúrate de haber creado `frontend/.env` y de que `VITE_API_URL` apunta al backend correcto.
4. Inicia el frontend en otra terminal: `cd frontend` y `npm run dev`.
5. Abre la URL que indique Vite.

No necesitas ejecutar `npm install` cada vez. Solo tendrás que repetirlo si cambian las dependencias o si necesitas reconstruir la instalación local.

## Actualizar una copia existente

Si ya clonaste el repositorio y quieres descargar los últimos cambios publicados:

```bash
git pull origin main
```

Si se han modificado las dependencias, actualízalas en cada proyecto:

```bash
cd backend
npm install
```

Y, desde otra terminal:

```bash
cd frontend
npm install
```

Revisa los cambios en los archivos de configuración y en las variables de entorno antes de reiniciar los servicios. `git pull` no descarga los archivos `.env` locales que no están versionados, por lo que tendrás que configurarlos en cada ordenador.

Si Git indica que hay cambios locales que entrarían en conflicto, guarda o confirma esos cambios antes de actualizar.

## Acceder desde otro dispositivo de la misma red

Si quieres abrir GuessVerse desde otro dispositivo conectado a la misma red local, recuerda que `localhost` se refiere al propio dispositivo que abre el navegador.

Para permitir el acceso en la red local:

1. Averigua la IP local del ordenador donde se ejecutan los servicios.
2. Configura Vite para escuchar en la red, por ejemplo:

   ```bash
   npm run dev -- --host 0.0.0.0
   ```

3. Configura la URL de la API para que apunte a la IP del ordenador servidor, no a `localhost`.
4. Revisa la configuración de CORS del backend.
5. Permite únicamente los puertos necesarios en el firewall para tu red de confianza.

El frontend puede necesitar una configuración adicional para usar una URL de backend accesible desde el otro dispositivo. Comprueba cómo se construye esa URL en el código antes de cambiarla.

No expongas el backend directamente a Internet ni publiques credenciales.

## Desplegarlo para acceder desde otra ubicación

Para utilizar GuessVerse desde otra casa o fuera de la red local, tendrás que desplegar el frontend y el backend en servicios accesibles desde Internet, o configurar una solución de acceso remoto segura.

Configura las URL de producción, HTTPS, variables de entorno y CORS para los dominios correspondientes. No uses las claves privadas en el frontend. Supabase puede seguir siendo el mismo proyecto si su configuración y políticas permiten el acceso desde el entorno desplegado.

## Scripts disponibles

Los comandos dependen de los scripts definidos en cada `package.json`. Como referencia, comprueba los disponibles con:

```bash
npm run
```

Ejecuta ese comando desde `backend/` y `frontend/` por separado para ver los scripts reales de cada parte. Los comandos actuales son:

| Comando | Dónde | Uso |
|---|---|---|
| `npm install` | ambos | Instala las dependencias. |
| `npm run dev` | ambos | Backend (`tsx watch`) / Frontend (Vite). |
| `npm run build` | ambos | Compila (`tsc` / `tsc -b && vite build`). |
| `npm run typecheck` | backend | Comprueba tipos sin emitir. |
| `npm test` | backend | Ejecuta los tests (Vitest). |
| `npm run lint` | frontend | Ejecuta ESLint. |
| `npm start` | backend | Ejecuta el build (`node dist/server.js`). |

No ejecutes un script que no aparezca en el `package.json` correspondiente.

## Solución de problemas

### El backend no arranca

- Comprueba que has ejecutado `npm install` en `backend/`.
- Verifica que `backend/.env` existe y contiene las variables que requiere el código.
- Comprueba que el puerto configurado está libre.
- Revisa los mensajes de error de la terminal.

### El frontend no se conecta al backend

- Comprueba que el backend está iniciado.
- Revisa la URL de la API configurada en el frontend.
- Si accedes desde otro dispositivo, comprueba la IP, el firewall y CORS.
- No uses `localhost` en la URL del backend cuando el navegador se ejecute en otro dispositivo.

### No se cargan datos de Supabase o TMDB
- Revisa las credenciales y que los nombres de las variables coincidan con los que utiliza el código.
- Comprueba que Supabase esté disponible y que la base de datos tenga el esquema requerido.
- Consulta los errores de la terminal del backend.

### El proyecto no funciona después de clonarlo

- Ejecuta `npm install` tanto en `backend/` como en `frontend/`.
- Crea `backend/.env` con las credenciales necesarias y `frontend/.env` con las variables `VITE_*`.
- Comprueba la configuración de Supabase y de las API externas.
- Ejecuta `npm run` en cada carpeta para revisar los scripts disponibles.

## Seguridad

- No subas archivos `.env` con credenciales reales a GitHub.
- Mantén `SUPABASE_SERVICE_ROLE_KEY` y `IGDB_CLIENT_SECRET` exclusivamente en el servidor.
- No incluyas secretos en el código del frontend.
- Usa variables distintas para desarrollo y producción cuando sea necesario.
- Revisa los permisos y las políticas de acceso de Supabase antes de desplegar.
- Si una clave se publica accidentalmente, revócala o rótala desde el proveedor correspondiente.

## Repositorio

[github.com/serpermar/guessVerse](https://github.com/serpermar/guessVerse)
