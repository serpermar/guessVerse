-- 0005_constraints_and_rpc.sql
-- Constraints de integridad que faltaban en 0004
alter table public.game_players
  add constraint game_players_game_user_unique unique (game_id, user_id);

alter table public.games
  add constraint games_status_check
  check (status in ('waiting', 'playing', 'won', 'lost', 'abandoned'));

alter table public.game_players
  add constraint game_players_role_check
  check (role in ('host', 'guest'));

-- Longitud del código de sala
alter table public.games
  add constraint games_room_code_length
  check (room_code is null or char_length(room_code) between 4 and 8);

-- RPC transaccional para crear partida clásica.
-- Evita el borrado manual si falla la inserción del tablero.
create or replace function public.create_game_tx(
  p_theme_id uuid,
  p_created_by uuid,
  p_secret_character_id uuid,
  p_character_ids uuid[]
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game_id uuid;
begin
  insert into public.games (
    theme_id, created_by, mode, status,
    secret_character_id, started_at, hints_used, hints_history
  ) values (
    p_theme_id, p_created_by, 'classic', 'playing',
    p_secret_character_id, now(), 0, '[]'::jsonb
  ) returning id into v_game_id;

  insert into public.game_players (game_id, user_id, role)
  values (v_game_id, p_created_by, 'host');

  insert into public.game_characters (game_id, character_id)
  select v_game_id, unnest(p_character_ids);

  return v_game_id;
exception
  when others then
    -- Si algo falla, el bloque entero se revierte automáticamente.
    raise;
end;
$$;

revoke all on function public.create_game_tx(uuid, uuid, uuid, uuid[]) from public;
grant execute on function public.create_game_tx(uuid, uuid, uuid, uuid[]) to service_role;