-- The Great Decision — initial schema
-- Tables, foreign keys, and indexes for: profiles, groups, group_members,
-- restaurants, decisions, invitations.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now()
);

create table public.group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  joined_at timestamptz not null default now()
);

create unique index ux_group_members_group_user on public.group_members (group_id, user_id);
create index ix_group_members_user on public.group_members (user_id);

create table public.restaurants (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  name text not null,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  active boolean not null default true
);

create index ix_restaurants_group on public.restaurants (group_id);

-- restaurant_id uses ON DELETE RESTRICT deliberately: restaurants are meant to be
-- deactivated via the `active` flag, not hard-deleted. A restrict FK surfaces a
-- clear error if any code path ever tries to hard-delete a restaurant that has
-- decision history, instead of silently corrupting that history.
create table public.decisions (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  restaurant_id uuid not null references public.restaurants (id) on delete restrict,
  decision_date date not null,
  created_at timestamptz not null default now()
);

create unique index ux_decisions_group_date on public.decisions (group_id, decision_date);
create index ix_decisions_group on public.decisions (group_id);

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  code text not null unique,
  created_by uuid not null references auth.users (id),
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create index ix_invitations_group on public.invitations (group_id);
