create extension if not exists "pgcrypto";

create table if not exists clubs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  region text,
  sport text check (sport in ('football', 'futsal')),
  accent_color text,
  badge_url text,
  created_at timestamptz not null default now()
);

create table if not exists teams (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs(id) on delete cascade,
  name text not null,
  age_group text not null,
  photo_url text,
  created_at timestamptz not null default now()
);

create table if not exists athletes (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs(id) on delete cascade,
  team_id uuid references teams(id) on delete set null,
  name text not null,
  sex text not null check (sex in ('male', 'female')),
  age_group text not null,
  position text,
  photo_url text,
  display_order integer,
  category text,
  dob date not null,
  created_at timestamptz not null default now()
);

create table if not exists anthropometric_records (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references athletes(id) on delete cascade,
  collected_at date not null,
  stature_cm numeric not null,
  body_mass_kg numeric not null,
  sitting_height_cm numeric not null,
  mother_height_cm numeric,
  father_height_cm numeric,
  created_at timestamptz not null default now(),
  unique (athlete_id, collected_at)
);

create table if not exists user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  locale text not null default 'es'
);

create table if not exists club_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  club_id uuid not null references clubs(id) on delete cascade,
  role text not null default 'coach' check (role in ('owner', 'coach', 'analyst')),
  created_at timestamptz not null default now()
);

create table if not exists performance_entries (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references athletes(id) on delete cascade,
  area text not null check (area in ('physical', 'technicalTactical', 'psychological', 'motorSkills')),
  test_name text not null,
  unit text not null,
  value numeric not null,
  measurement_date date not null,
  notes text,
  rating_level text,
  rating_value numeric,
  attempt_count integer,
  description text,
  media_url text,
  media_type text check (media_type in ('image', 'video')),
  created_at timestamptz not null default now()
);

create table if not exists training_load_entries (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references athletes(id) on delete cascade,
  date date not null,
  attended boolean not null default true,
  session_type text not null check (session_type in ('training', 'match')),
  minutes_played integer not null default 0,
  rpe integer not null default 0,
  load integer not null default 0,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists performance_definitions (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs(id) on delete cascade,
  name text not null,
  name_key text,
  area text not null check (area in ('physical', 'technicalTactical', 'psychological', 'motorSkills')),
  unit text not null,
  attempts integer not null default 1,
  is_rating boolean not null default false,
  scoring_strategy text not null default 'best' check (scoring_strategy in ('best', 'average')),
  interpretation text not null default 'higher_better' check (interpretation in ('higher_better', 'lower_better')),
  description text,
  description_key text,
  media_url text,
  media_type text check (media_type in ('image', 'video')),
  created_at timestamptz not null default now()
);

alter table clubs add column if not exists sport text check (sport in ('football', 'futsal'));
alter table clubs add column if not exists accent_color text;
alter table clubs add column if not exists badge_url text;
alter table teams add column if not exists photo_url text;
alter table athletes add column if not exists position text;
alter table athletes add column if not exists photo_url text;
alter table athletes add column if not exists display_order integer;
alter table athletes add column if not exists category text;

create index if not exists teams_club_id_idx on teams(club_id);
create index if not exists athletes_club_id_idx on athletes(club_id);
create index if not exists athletes_team_id_idx on athletes(team_id);
create index if not exists anthropometric_records_athlete_id_idx on anthropometric_records(athlete_id);
create index if not exists performance_entries_athlete_id_idx on performance_entries(athlete_id);
create index if not exists training_load_entries_athlete_id_idx on training_load_entries(athlete_id);
create index if not exists performance_definitions_club_id_idx on performance_definitions(club_id);

alter table clubs enable row level security;
alter table teams enable row level security;
alter table athletes enable row level security;
alter table anthropometric_records enable row level security;
alter table user_preferences enable row level security;
alter table club_members enable row level security;
alter table performance_entries enable row level security;
alter table training_load_entries enable row level security;
alter table performance_definitions enable row level security;

create or replace function my_club_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select club_id from club_members where user_id = auth.uid()
$$;

drop policy if exists "own membership" on club_members;
create policy "own membership" on club_members
  for select using (user_id = auth.uid());

drop policy if exists "club isolation" on clubs;
create policy "club isolation" on clubs
  for all using (id = my_club_id())
  with check (id = my_club_id());

drop policy if exists "club isolation" on teams;
create policy "club isolation" on teams
  for all using (club_id = my_club_id())
  with check (club_id = my_club_id());

drop policy if exists "club isolation" on athletes;
create policy "club isolation" on athletes
  for all using (club_id = my_club_id())
  with check (club_id = my_club_id());

drop policy if exists "club isolation" on anthropometric_records;
create policy "club isolation" on anthropometric_records
  for all using (
    athlete_id in (select id from athletes where club_id = my_club_id())
  )
  with check (
    athlete_id in (select id from athletes where club_id = my_club_id())
  );

drop policy if exists "own preferences" on user_preferences;
create policy "own preferences" on user_preferences
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "club isolation" on performance_entries;
create policy "club isolation" on performance_entries
  for all using (
    athlete_id in (select id from athletes where club_id = my_club_id())
  )
  with check (
    athlete_id in (select id from athletes where club_id = my_club_id())
  );

drop policy if exists "club isolation" on training_load_entries;
create policy "club isolation" on training_load_entries
  for all using (
    athlete_id in (select id from athletes where club_id = my_club_id())
  )
  with check (
    athlete_id in (select id from athletes where club_id = my_club_id())
  );

drop policy if exists "club isolation" on performance_definitions;
create policy "club isolation" on performance_definitions
  for all using (club_id = my_club_id())
  with check (club_id = my_club_id());
