-- The Great Decision — helper functions and triggers.

-- Membership check used by RLS policies. SECURITY DEFINER is what breaks the
-- recursion: a normal "using (exists (select 1 from group_members ...))" policy
-- defined ON group_members would re-trigger group_members' own RLS while
-- evaluating itself ("infinite recursion detected in policy for relation
-- group_members"). Running the lookup as the function owner bypasses RLS on the
-- table it queries internally, so the cycle never starts.
create or replace function public.is_group_member(p_group_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.group_members gm
    where gm.group_id = p_group_id and gm.user_id = p_user_id
  );
$$;

revoke all on function public.is_group_member(uuid, uuid) from public;
grant execute on function public.is_group_member(uuid, uuid) to authenticated;

create or replace function public.is_group_admin(p_group_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.group_members gm
    where gm.group_id = p_group_id and gm.user_id = p_user_id and gm.role in ('owner', 'admin')
  );
$$;

revoke all on function public.is_group_admin(uuid, uuid) from public;
grant execute on function public.is_group_admin(uuid, uuid) to authenticated;

-- Auto-provision a profiles row on signup. Client code cannot write to auth.users
-- directly, so this trigger is the only place display_name/avatar_url originate from.
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Auto-add the creator as 'owner' so group creation doesn't need a separate
-- client-side insert + RLS dance.
create or replace function public.handle_new_group()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.group_members (group_id, user_id, role)
  values (new.id, new.created_by, 'owner');
  return new;
end;
$$;

create trigger on_group_created
  after insert on public.groups
  for each row execute procedure public.handle_new_group();
