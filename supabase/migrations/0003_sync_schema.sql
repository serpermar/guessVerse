-- ============================================================================
-- GuessVerse — Sincronización de esquema (0003)
-- ============================================================================
-- Añade campos que usa el código actual y crea índices/RPC necesarios.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- games: ownership + winner
-- ----------------------------------------------------------------------------
alter table public.games
    add column if not exists created_by uuid references auth.users(id) on delete set null,
    add column if not exists winner_user_id uuid references auth.users(id) on delete set null,
    add column if not exists finished_at timestamptz;

-- Backfill created_by desde game_players (host) si existe
do $$
begin
    if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'game_players') then
        update public.games g
        set created_by = gp.user_id
        from public.game_players gp
        where gp.game_id = g.id
          and gp.role = 'host'
          and g.created_by is null;
    end if;
end $$;

-- ----------------------------------------------------------------------------
-- statistics: nuevos contadores
-- ----------------------------------------------------------------------------
alter table public.statistics
    add column if not exists games_abandoned integer not null default 0,
    add column if not exists avg_duration_seconds integer not null default 0,
    add column if not exists questions_asked integer not null default 0;

update public.statistics
set games_abandoned = coalesce(games_abandoned, 0),
    avg_duration_seconds = coalesce(avg_duration_seconds, 0),
    questions_asked = coalesce(questions_asked, 0);

-- ----------------------------------------------------------------------------
-- characters: house para Harry Potter
-- ----------------------------------------------------------------------------
alter table public.characters
    add column if not exists house text;

-- ----------------------------------------------------------------------------
-- Índices útiles
-- ----------------------------------------------------------------------------
create index if not exists idx_games_created_by on public.games(created_by);
create index if not exists idx_games_theme_id on public.games(theme_id);
create index if not exists idx_game_players_game_id on public.game_players(game_id);
create index if not exists idx_game_players_user_id on public.game_players(user_id);
create index if not exists idx_game_characters_game_id on public.game_characters(game_id);
create index if not exists idx_game_questions_game_id on public.game_questions(game_id);
create index if not exists idx_guesses_game_id on public.guesses(game_id);
create index if not exists idx_characters_franchise_id on public.characters(franchise_id);
create index if not exists idx_franchises_theme_id on public.franchises(theme_id);

-- username único (case-insensitive)
create unique index if not exists idx_users_username_unique_ci
    on public.users (lower(username))
    where username is not null and trim(username) <> '';

-- ----------------------------------------------------------------------------
-- RPC atómica para estadísticas
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
    v_duration integer := coalesce(p_duration, 0);
    v_questions_add integer := coalesce(p_questions, 0);
begin
    select * into s from public.statistics where user_id = p_user_id for update;

    if not found then
        insert into public.statistics (user_id, games_played, games_won, games_lost, games_abandoned, questions_asked, avg_duration_seconds, updated_at)
        values (p_user_id, 0, 0, 0, 0, 0, 0, now())
        on conflict (user_id) do nothing;
        select * into s from public.statistics where user_id = p_user_id for update;
    end if;

    v_played = coalesce(s.games_played, 0) + 1;
    v_won = coalesce(s.games_won, 0) + case when p_status = 'won' then 1 else 0 end;
    v_lost = coalesce(s.games_lost, 0) + case when p_status = 'lost' then 1 else 0 end;
    v_abandoned = coalesce(s.games_abandoned, 0) + case when p_status = 'abandoned' then 1 else 0 end;
    v_questions = coalesce(s.questions_asked, 0) + v_questions_add;

    if coalesce(s.games_played, 0) <= 0 or coalesce(s.avg_duration_seconds, 0) <= 0 then
        v_avg = v_duration;
    else
        v_avg = round((coalesce(s.avg_duration_seconds, 0) * coalesce(s.games_played, 0) + v_duration)::numeric / v_played)::integer;
    end if;

    update public.statistics
    set games_played = v_played,
        games_won = v_won,
        games_lost = v_lost,
        games_abandoned = v_abandoned,
        questions_asked = v_questions,
        avg_duration_seconds = v_avg,
        updated_at = now()
    where user_id = p_user_id;
end;
$$;

revoke all on function public.record_game_result(uuid, text, integer, integer) from public;
grant execute on function public.record_game_result(uuid, text, integer, integer) to service_role;
