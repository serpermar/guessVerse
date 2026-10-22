fe# Autenticación — GuessVerse

Documento de referencia del flujo de autenticación implementado en el Bloque 1.

---

## 1. Visión general

- **Proveedor**: Supabase Auth (email + password).
- **Verificación**: email obligatorio para activar la cuenta.
- **Usuario**: `public.users` vinculado 1:1 con `auth.users` vía trigger.
- **Sesión**: JWT gestionado por `@supabase/supabase-js` en el frontend,
  verificado en el backend con `service_role`.

---

## 2. Configuración en Supabase (checklist)

### Authentication → Providers → Email
- [x] **Confirm email** activo.

### Authentication → URL Configuration
- [x] **Site URL**: `http://localhost:5173` (en prod será el dominio).
- [x] **Redirect URLs**:
  - `http://localhost:5173/auth/callback`
  - `http://localhost:5173/**`

### Authentication → Email Templates → Confirm sign up
- [x] Enlace:
  ```html
  <a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=signup&next={{ .RedirectTo }}">
    Confirmar mi cuenta
  </a>
  ```

> Si el `emailRedirectTo` que pasa el cliente no está en la allow-list,
> Supabase ignora el redirect y usa `Site URL`.

---

## 3. Flujo de registro

```
[RegisterPage]
  → supabase.auth.signUp({
      email, password,
      options: {
        data: { username },
        emailRedirectTo: <origin>/auth/callback
      }
    })
       ↓
[Supabase Auth] envía email
       ↓
[Usuario] clic en el enlace
       ↓
[/auth/callback?token_hash=...&type=signup]
  → supabase.auth.verifyOtp({ token_hash, type })
       ↓
[Sesión creada] + [trigger handle_new_user ejecutado]
       ↓
[Redirige a /profile]
```

---

## 4. Flujo de login

```
[LoginPage]
  → supabase.auth.signInWithPassword({ email, password })
       ↓
[Sesión creada] → persistida en localStorage
       ↓
[AuthProvider.onAuthStateChange] → user disponible
       ↓
[Redirige a /profile]
```

---

## 5. Flujo de logout

```
[ProfilePage / AppHeader]
  → supabase.auth.signOut()
       ↓
[Sesión eliminada] → user = null
       ↓
[Redirige a /]
```

---

## 6. Trigger `handle_new_user`

SQL aplicado en Supabase:

```sql
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_username text;
  v_base     text;
  v_suffix   int := 0;
begin
  v_base := coalesce(
    nullif(trim(new.raw_user_meta_data->>'username'), ''),
    split_part(new.email, '@', 1)
  );
  v_base := lower(regexp_replace(v_base, '[^a-z0-9_]', '', 'g'));
  v_base := left(v_base, 20);
  if length(v_base) < 3 then
    v_base := 'user_' || substr(new.id::text, 1, 6);
  end if;

  v_username := v_base;
  while exists (select 1 from public.users where username = v_username) loop
    v_suffix := v_suffix + 1;
    v_username := left(v_base, 17) || '_' || v_suffix;
  end loop;

  insert into public.users (id, email, username)
  values (new.id, new.email, v_username);

  return new;
end;
$$;
```

**Comportamiento:**
- Lee `username` del metadata si existe.
- Fallback a la parte local del email (`user@x.com` → `user`).
- Sanea: minúsculas, sin símbolos, máximo 20 chars.
- Fallback adicional `user_<id>` si el saneado deja <3 chars.
- Resuelve colisiones: `username`, `username_1`, `username_2`…

---

## 7. Backend — middleware

### `auth.middleware.ts`

```ts
requireAuth(req, res, next) // 401 si falta o inválido → adjunta req.user
optionalAuth(req, res, next) // no falla si no hay token
```

Verificación:
```ts
const { data: { user }, error } =
  await supabaseAdmin.auth.getUser(token);
```

`supabaseAdmin.auth.getUser(jwt)` valida la firma y devuelve el usuario.
No hace falta verificar el JWT a mano.

### `types/express.d.ts`

```ts
declare global {
  namespace Express {
    interface Request { user?: User }
  }
}
```

### Aplicación por ruta

```ts
// Protección de todo un router
router.use(requireAuth);

// Protección individual
router.post('/', requireAuth, postCreateGame);
```

---

## 8. Endpoints de usuario

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/users/me` | Perfil (id, email, username, avatar_url) |
| PATCH | `/api/users/me` | Editar username (3-20, `[a-z0-9_]`) o avatar |
| GET | `/api/users/me/stats` | `games_played`, `won`, `lost`, `abandoned`, `questions_asked`, `win_rate` |
| GET | `/api/users/me/games?limit=20` | Historial paginado (max 50) |

---

## 9. Ownership de partidas

`game.service.ts` valida en `askQuestion`, `guessCharacter`, `abandonGame`,
`getGame`:

```ts
if (game.created_by !== userId) {
  throw HttpError.forbidden('No eres el dueño de esta partida');
}
```

Respuesta: `403 Forbidden`.

---

## 10. Asociación de partidas al usuario

Al crear partida:
- `games.created_by = userId`
- `game_players` → fila con `user_id`, `role = 'host'`

Al ganar:
- `games.status = 'won'`, `winner_user_id = userId`, `finished_at = now()`
- `statistics` → `recordGameResult(userId, 'won', questions, duration)`

Al abandonar:
- `games.status = 'lost'`, `finished_at = now()`
- `statistics` → `recordGameResult(userId, 'abandoned', questions, duration)`

---

## 11. Estadísticas

`recordGameResult` actualiza:
- `games_played` +1
- `games_won` / `games_lost` / `games_abandoned` según status
- `questions_asked` + N
- `avg_duration_seconds` (media incremental)
- `win_rate` calculado en `getStats()`

---

## 12. Seguridad

- `anon` (publishable) → frontend.
- `service_role` → backend, **nunca** frontend.
- `verifyOtp` solo funciona con `token_hash` + `type` válidos.
- Rotar claves comprometidas antes de exponer el registro a usuarios reales.

---

## 13. Testing manual (checklist)

- [ ] Registro con username → email llega.
- [ ] Clic en el enlace → redirige a `/profile`.
- [ ] `public.users` tiene el `username` del metadata (no el fallback).
- [ ] Registro con username repetido → recibe `_1`.
- [ ] Logout → `/login` funciona con las credenciales.
- [ ] Recargar página estando logueado → sesión persiste.
- [ ] `POST /api/games` sin token → `401`.
- [ ] `POST /api/games` con token → `201`, `created_by` correcto.
- [ ] `GET /api/users/me/stats` → `games_won` incrementa tras ganar.
- [ ] `GET /api/users/me/games` → aparece la partida con `status: 'won'`.