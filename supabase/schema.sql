-- =====================================================================
-- Cleburne Cafeteria Regulars: database schema
--
-- Paste this whole file into the Supabase SQL editor and run it once.
-- Safe to re-run: every statement is guarded.
--
-- The privacy rule this file enforces: a regular can only ever read
-- their own rows. Rankings reach them as a bare number ("12 of 100")
-- computed inside the database, never as other people's data. George
-- (role 'owner') sees the leaderboard totals, and not even he can read
-- individual visit rows.
-- =====================================================================

-- ------------------------------------------------------------- tables

create table if not exists public.profiles (
  id           uuid primary key references auth.users on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 2 and 40),
  role         text not null default 'regular' check (role in ('regular', 'owner')),
  created_at   timestamptz not null default now()
);

-- Houston time, so "today" and "this week" flip at midnight in the
-- dining room rather than at 6pm the previous evening in UTC.
create or replace function public.local_today()
returns date
language sql
stable
as $$
  select (now() at time zone 'America/Chicago')::date;
$$;

create table if not exists public.visits (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,
  ate_on       date not null default public.local_today(),
  amount_cents integer not null check (amount_cents > 0 and amount_cents <= 100000),
  note         text check (char_length(note) <= 120),
  created_at   timestamptz not null default now(),
  -- no logging a meal you have not eaten yet
  constraint visits_not_in_future check (ate_on <= (now() at time zone 'America/Chicago')::date + 1)
);

create index if not exists visits_user_date_idx on public.visits (user_id, ate_on desc);
create index if not exists visits_date_idx      on public.visits (ate_on);

-- -------------------------------------------------------------- roles

-- Is the caller George? SECURITY DEFINER so this can read profiles
-- without tripping the policies defined on profiles itself.
create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'owner'
  );
$$;

-- --------------------------------------------------------------- RLS

alter table public.profiles enable row level security;
alter table public.visits   enable row level security;

-- Start from nothing, then hand back exactly what each role needs.
-- Note that update on profiles is granted per column: without the role
-- column, nobody can promote themselves to owner.
revoke all on public.profiles from anon, authenticated;
revoke all on public.visits   from anon, authenticated;
grant select, insert on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;
grant select, insert, update, delete on public.visits to authenticated;

drop policy if exists profiles_read_own       on public.profiles;
drop policy if exists profiles_insert_own     on public.profiles;
drop policy if exists profiles_update_own     on public.profiles;
drop policy if exists visits_read_own         on public.visits;
drop policy if exists visits_insert_own       on public.visits;
drop policy if exists visits_update_own       on public.visits;
drop policy if exists visits_delete_own       on public.visits;

-- A regular reads only their own profile. George reads all of them,
-- which is what puts names on his leaderboard.
create policy profiles_read_own on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_owner());

-- You may create your own profile, and only as a regular.
create policy profiles_insert_own on public.profiles
  for insert to authenticated
  with check (id = auth.uid() and role = 'regular');

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Visits are private to the person who ate the meal. George included:
-- he sees totals through the leaderboard function, never the rows.
create policy visits_read_own on public.visits
  for select to authenticated using (user_id = auth.uid());

create policy visits_insert_own on public.visits
  for insert to authenticated with check (user_id = auth.uid());

create policy visits_update_own on public.visits
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy visits_delete_own on public.visits
  for delete to authenticated using (user_id = auth.uid());

-- ------------------------------------------------------ new sign-ups

-- Signup passes a display name in the magic-link metadata; this turns
-- that into a profile row the moment the account is created.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''), 'New Regular')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- --------------------------------------------------- rankings

-- Where a scoring window begins. Weeks start on Sunday, US style.
create or replace function public.window_start(win text)
returns date
language sql
stable
as $$
  select case win
    when 'week'  then (date_trunc('week', public.local_today() + 1))::date - 1
    when 'month' then (date_trunc('month', public.local_today()))::date
    when 'year'  then (date_trunc('year', public.local_today()))::date
    else '-infinity'::date
  end;
$$;

-- Everything a regular sees about themselves, in one round trip:
-- spend, visit count and rank for each window, plus the size of the
-- field. Other people's numbers are used to compute the rank and are
-- never returned.
create or replace function public.my_dashboard()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  me    uuid := auth.uid();
  field bigint;
begin
  if me is null then
    raise exception 'not signed in';
  end if;

  select count(*) into field from public.profiles where role = 'regular';

  return jsonb_build_object(
    'display_name',   (select display_name from public.profiles where id = me),
    'role',           (select role from public.profiles where id = me),
    'total_regulars', field,
    'windows', coalesce((
      select jsonb_object_agg(w.win, jsonb_build_object(
        'spend_cents', coalesce(s.cents, 0),
        'visits',      coalesce(s.n, 0),
        'rank',        coalesce(s.rnk, field)
      ))
      from (values ('week'), ('month'), ('year'), ('lifetime')) as w (win)
      left join lateral (
        with totals as (
          select p.id,
                 coalesce(sum(v.amount_cents), 0)::bigint as cents,
                 count(v.id)::bigint                      as n
          from public.profiles p
          left join public.visits v
            on v.user_id = p.id
           and v.ate_on >= public.window_start(w.win)
          where p.role = 'regular'
          group by p.id
        )
        -- rank in its own step: a WHERE in the same SELECT as a window
        -- function is applied first, which would rank the caller
        -- against themselves and call everybody number one
        , ranked as (
          select id, cents, n, rank() over (order by cents desc) as rnk
          from totals
        )
        select cents, n, rnk from ranked where id = me
      ) s on true
    ), '{}'::jsonb)
  );
end;
$$;

-- George's leaderboard. Totals and names only: individual visit rows
-- stay private even from him.
create or replace function public.leaderboard(win text default 'lifetime')
returns table (
  place        bigint,
  display_name text,
  spend_cents  bigint,
  visits       bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_owner() then
    raise exception 'the leaderboard is for the owner account';
  end if;

  return query
  with totals as (
    select p.id,
           p.display_name                           as name,
           coalesce(sum(v.amount_cents), 0)::bigint as cents,
           count(v.id)::bigint                      as n
    from public.profiles p
    left join public.visits v
      on v.user_id = p.id
     and v.ate_on >= public.window_start(win)
    where p.role = 'regular'
    group by p.id, p.display_name
  )
  select rank() over (order by t.cents desc), t.name, t.cents, t.n
  from totals t
  order by t.cents desc, t.name;
end;
$$;

-- Functions are callable by everyone unless told otherwise, and these
-- are SECURITY DEFINER, so lock them to signed-in callers.
revoke all on function public.is_owner()            from public;
revoke all on function public.my_dashboard()        from public;
revoke all on function public.leaderboard(text)     from public;
revoke all on function public.window_start(text)    from public;
revoke all on function public.local_today()         from public;
revoke all on function public.handle_new_user()     from public;

grant execute on function public.is_owner()         to authenticated;
grant execute on function public.my_dashboard()     to authenticated;
grant execute on function public.leaderboard(text)  to authenticated;
grant execute on function public.window_start(text) to authenticated;
grant execute on function public.local_today()      to authenticated;
