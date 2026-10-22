-- ============================================================================
-- GuessVerse — Esquema inicial (reconstruido)
-- ============================================================================
-- Este archivo documenta y recrea el esquema que existía únicamente en el
-- proyecto Supabase remoto. Es idempotente: puede ejecutarse varias veces.
--
-- Uso:
--   1) Pegar en Supabase → SQL Editor y ejecutar, o
--   2) `supabase db push` / migraciones gestionadas.
--
-- Convenciones:
--   - Todos los ids son `uuid` con `gen_random_uuid()`.
--   - Booleanos de atributos son NULL-ables: NULL = "desconocido" (→ `unknown`).
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- updated_at automático
-- ----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

-- ============================================================================
-- Catálogo
-- ============================================================================

create table if not exists public.themes (
    id                  uuid primary key default gen_random_uuid(),
    slug                text not null unique,
    name                text not null,
    description         text,
    type                text,
    image_url           text,
    source              text not null default 'manual',
    is_active           boolean not null default true,
    question_categories text[] not null default '{}',
    created_at          timestamptz not null default now()
);

create table if not exists public.franchises (
    id          uuid primary key default gen_random_uuid(),
    theme_id    uuid not null references public.themes(id) on delete cascade,
    slug        text not null,
    name        text not null,
    description text,
    image_url   text,
    source      text not null default 'manual',
    external_id text,
    created_at  timestamptz not null default now(),
    unique (theme_id, slug)
);

create table if not exists public.characters (
    id             uuid primary key default gen_random_uuid(),
    franchise_id   uuid not null references public.franchises(id) on delete cascade,
    slug           text not null,
    name           text not null,
    description    text,
    image_url      text,
    gender         text,
    species        text,
    is_human       boolean,
    is_hero        boolean,
    is_villain     boolean,
    is_protagonist boolean,
    has_powers     boolean,
    uses_weapon    boolean,
    created_at     timestamptz not null default now(),
    updated_at     timestamptz not null default now(),
    unique (franchise_id, slug)
);

create table if not exists public.character_sources (
    id            uuid primary key default gen_random_uuid(),
    character_id  uuid not null references public.characters(id) on delete cascade,
    source        text not null,
    external_id   text not null,
    external_type text not null,
    raw_data      jsonb,
    created_at    timestamptz not null default now(),
    unique (source, external_id, external_type)
);

create table if not exists public.questions (
    id         uuid primary key default gen_random_uuid(),
    code       text not null unique,
    text_es    text not null,
    text_en    text,
    attribute  text not null,
    operator   text not null default 'eq',
    value      jsonb not null,
    category   text,
    is_active  boolean not null default true,
    created_at timestamptz not null default now()
);

-- ============================================================================
-- Partidas
-- ============================================================================

create table if not exists public.games (
    id                   uuid primary key default gen_random_uuid(),
    theme_id             uuid not null references public.themes(id) on delete cascade,
    mode                 text not null default 'classic',
    status               text not null default 'playing',
    secret_character_id  uuid references public.characters(id) on delete set null,
    started_at           timestamptz not null default now(),
    finished_at          timestamptz,
    created_at           timestamptz not null default now()
);

create table if not exists public.game_players (
    id         uuid primary key default gen_random_uuid(),
    game_id    uuid not null references public.games(id) on delete cascade,
    user_id    uuid references public.users(id) on delete set null,
    role       text not null default 'player',
    score      integer not null default 0,
    created_at timestamptz not null default now()
);

create table if not exists public.game_characters (
    game_id      uuid not null references public.games(id) on delete cascade,
    character_id uuid not null references public.characters(id) on delete cascade,
    is_eliminated boolean not null default false,
    primary key (game_id, character_id)
);

create table if not exists public.game_questions (
    id          uuid primary key default gen_random_uuid(),
    game_id     uuid not null references public.games(id) on delete cascade,
    question_id uuid not null references public.questions(id) on delete cascade,
    answer      text not null,
    created_at  timestamptz not null default now()
);

create table if not exists public.guesses (
    id           uuid primary key default gen_random_uuid(),
    game_id      uuid not null references public.games(id) on delete cascade,
    user_id      uuid references public.users(id) on delete set null,
    character_id uuid references public.characters(id) on delete cascade,
    is_correct   boolean not null default false,
    created_at   timestamptz not null default now()
);

-- ============================================================================
-- Usuarios y estadísticas
-- ============================================================================

create table if not exists public.users (
    id         uuid primary key,
    username   text,
    email      text,
    avatar_url text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.statistics (
    user_id         uuid primary key references public.users(id) on delete cascade,
    games_played    integer not null default 0,
    games_won       integer not null default 0,
    games_lost      integer not null default 0,
    questions_asked integer not null default 0,
    updated_at      timestamptz not null default now()
);

-- ============================================================================
-- Triggers
-- ============================================================================

drop trigger if exists tg_set_updated_at on public.users;
create trigger tg_set_updated_at
    before update on public.users
    for each row execute function public.set_updated_at();

drop trigger if exists tg_set_updated_at on public.characters;
create trigger tg_set_updated_at
    before update on public.characters
    for each row execute function public.set_updated_at();

-- Crea perfil público al registrarse un usuario en auth.users.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
    insert into public.users (id, username, email)
    values (new.id, new.raw_user_meta_data->>'username', new.email)
    on conflict (id) do nothing;

    insert into public.statistics (user_id)
    values (new.id)
    on conflict (user_id) do nothing;

    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();

-- ============================================================================
-- Row Level Security
-- ============================================================================

alter table public.themes            enable row level security;
alter table public.franchises        enable row level security;
alter table public.characters        enable row level security;
alter table public.character_sources enable row level security;
alter table public.questions         enable row level security;
alter table public.games             enable row level security;
alter table public.game_players      enable row level security;
alter table public.game_characters   enable row level security;
alter table public.game_questions    enable row level security;
alter table public.guesses           enable row level security;
alter table public.users             enable row level security;
alter table public.statistics        enable row level security;

-- Catálogo: lectura pública.
drop policy if exists "themes_public_read" on public.themes;
create policy "themes_public_read" on public.themes
    for select using (true);

drop policy if exists "franchises_public_read" on public.franchises;
create policy "franchises_public_read" on public.franchises
    for select using (true);

drop policy if exists "characters_public_read" on public.characters;
create policy "characters_public_read" on public.characters
    for select using (true);

drop policy if exists "questions_public_read" on public.questions;
create policy "questions_public_read" on public.questions
    for select using (true);

-- Usuarios: solo el propio perfil.
drop policy if exists "users_self_read" on public.users;
create policy "users_self_read" on public.users
    for select using (auth.uid() = id);

-- Estadísticas: solo las propias.
drop policy if exists "statistics_self_read" on public.statistics;
create policy "statistics_self_read" on public.statistics
    for select using (auth.uid() = user_id);

-- El resto (games, game_*, guesses, character_sources) queda con RLS activo
-- y sin políticas públicas → solo accesible con `service_role` desde backend.
