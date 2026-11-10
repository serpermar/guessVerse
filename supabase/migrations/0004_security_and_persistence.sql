-- ============================================================================
-- GuessVerse — Seguridad, persistencia multijugador y progresión (0004)
-- ============================================================================
-- Migración idempotente que alinea el esquema con el código actual:
--   * XP/nivel de usuarios y XP ganada por partida.
--   * Columnas y tablas usadas por el multijugador (sala, turnos, chat...).
--   * Preguntas libres (IA) y autoría de cada pregunta.
--   * RPC atómica de estadísticas con XP/nivel.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- Usuarios: progresión
-- ----------------------------------------------------------------------------
alter table public.users
    add column if not exists xp integer not null default 0,
    add column if not exists level integer not null default 1;

alter table public.statistics
    add column if not exists xp_earned integer not null default 0;

-- ----------------------------------------------------------------------------
-- Personajes: atributos dinámicos generados por la IA
-- ----------------------------------------------------------------------------
alter table public.characters
    add column if not exists attributes jsonb not null default '{}'::jsonb;

-- ----------------------------------------------------------------------------
-- Partidas: código de sala y turno actual
-- ----------------------------------------------------------------------------
alter table public.games
    add column if not exists room_code text,
    add column if not exists current_turn_user_id uuid references auth.users(id) on delete set null;

create unique index if not exists idx_games_room_code_unique
    on public.games (room_code)
    where room_code is not null;

create index if not exists idx_games_current_turn
    on public.games (current_turn_user_id);

-- ----------------------------------------------------------------------------
-- Jugadores: presencia y personaje secreto por jugador
-- ----------------------------------------------------------------------------
alter table public.game_players
    add column if not exists is_connected boolean not null default false,
    add column if not exists secret_character_id uuid references public.characters(id) on delete set null;

create index if not exists idx_game_players_game_user
    on public.game_players (game_id, user_id);

-- ----------------------------------------------------------------------------
-- Tablero: descartes independientes por jugador
-- ----------------------------------------------------------------------------
alter table public.game_characters
    add column if not exists eliminated_by_host boolean not null default false,
    add column if not exists eliminated_by_guest boolean not null default false;

-- ----------------------------------------------------------------------------
-- Preguntas: autoría + preguntas libres de la IA
-- ----------------------------------------------------------------------------
alter table public.game_questions
    add column if not exists user_id uuid references auth.users(id) on delete set null,
    add column if not exists free_text text,
    add column if not exists raw_data jsonb;

-- Las preguntas libres no tienen question_id; las rápidas sí.
alter table public.game_questions
    alter column question_id drop not null;

create index if not exists idx_game_questions_game_user
    on public.game_questions (game_id, user_id);

-- ----------------------------------------------------------------------------
-- Chat de partida
-- ----------------------------------------------------------------------------
create table if not exists public.game_chat (
    id         uuid primary key default gen_random_uuid(),
    game_id    uuid not null references public.games(id) on delete cascade,
    user_id    uuid references auth.users(id) on delete set null,
    user_name  text not null,
    message    text not null check (char_length(message) between 1 and 200),
    created_at timestamptz not null default now()
);

create index if not exists idx_game_chat_game_created
    on public.game_chat (game_id, created_at);

-- Solo accesible con service_role desde el backend (sin políticas públicas).
alter table public.game_chat enable row level security;

-- ----------------------------------------------------------------------------
-- RPC atómica de estadísticas + XP
-- ----------------------------------------------------------------------------
create or replace function public.record_game_result(
    p_user_id uuid,
    p_status text,
    p_questions integer,
    p_duration integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    s public.statistics%rowtype;
    v_played integer;
    v_won integer;
    v_lost integer;
    v_abandoned integer;
    v_questions integer;
    v_avg integer;
    v_duration integer := greatest(coalesce(p_duration, 0), 0);
    v_questions_add integer := greatest(coalesce(p_questions, 0), 0);
    v_xp_gain integer;
    v_total_xp integer;
    v_level integer;
begin
    -- Asegura fila de estadísticas y bloquéala para actualizar de forma atómica.
    insert into public.statistics (user_id)
    values (p_user_id)
    on conflict (user_id) do nothing;

    select * into s from public.statistics where user_id = p_user_id for update;

    v_played = coalesce(s.games_played, 0) + 1;
    v_won = coalesce(s.games_won, 0) + case when p_status = 'won' then 1 else 0 end;
    v_lost = coalesce(s.games_lost, 0) + case when p_status = 'lost' then 1 else 0 end;
    v_abandoned = coalesce(s.games_abandoned, 0) + case when p_status = 'abandoned' then 1 else 0 end;
    v_questions = coalesce(s.questions_asked, 0) + v_questions_add;

    if coalesce(s.games_played, 0) <= 0 or coalesce(s.avg_duration_seconds, 0) <= 0 then
        v_avg = v_duration;
    else
        v_avg = round(
            (coalesce(s.avg_duration_seconds, 0) * coalesce(s.games_played, 0) + v_duration)::numeric
            / v_played
        )::integer;
    end if;

    -- XP: base por jugar + bonus por victoria + bonus por eficiencia.
    v_xp_gain = 10
        + case when p_status = 'won' then 50 else 0 end
        + case when p_status = 'won' and v_questions_add <= 5 then 20 else 0 end;

    update public.statistics
    set games_played = v_played,
        games_won = v_won,
        games_lost = v_lost,
        games_abandoned = v_abandoned,
        questions_asked = v_questions,
        avg_duration_seconds = v_avg,
        xp_earned = coalesce(xp_earned, 0) + v_xp_gain,
        updated_at = now()
    where user_id = p_user_id;

    -- Progresión del usuario (misma fórmula que el frontend).
    insert into public.users (id)
    values (p_user_id)
    on conflict (id) do nothing;

    select coalesce(xp, 0) into v_total_xp
    from public.users
    where id = p_user_id
    for update;

    v_total_xp = v_total_xp + v_xp_gain;
    v_level = floor(sqrt(v_total_xp / 100.0))::integer + 1;

    update public.users
    set xp = v_total_xp,
        level = v_level,
        updated_at = now()
    where id = p_user_id;
end;
$$;

revoke all on function public.record_game_result(uuid, text, integer, integer) from public;
grant execute on function public.record_game_result(uuid, text, integer, integer) to service_role;
