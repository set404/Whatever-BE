-- The Great Decision — Row Level Security policies.
-- Users can only access groups and data they are members of.

alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.restaurants enable row level security;
alter table public.decisions enable row level security;
alter table public.invitations enable row level security;

-- profiles: readable by any signed-in user (needed to show other members' names/
-- avatars in a group), writable only by the owning user.
create policy "profiles_select_all_authenticated" on public.profiles
  for select to authenticated using (true);

create policy "profiles_update_own" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- groups
create policy "groups_select_members" on public.groups
  for select to authenticated using (public.is_group_member(id));

create policy "groups_insert_authenticated" on public.groups
  for insert to authenticated with check (created_by = auth.uid());

create policy "groups_update_admins" on public.groups
  for update to authenticated using (public.is_group_admin(id)) with check (public.is_group_admin(id));

create policy "groups_delete_owner" on public.groups
  for delete to authenticated using (created_by = auth.uid());

-- group_members
create policy "group_members_select_members" on public.group_members
  for select to authenticated using (public.is_group_member(group_id));

create policy "group_members_insert_self" on public.group_members
  for insert to authenticated with check (user_id = auth.uid());

create policy "group_members_update_admins" on public.group_members
  for update to authenticated using (public.is_group_admin(group_id)) with check (public.is_group_admin(group_id));

create policy "group_members_delete_self_or_admin" on public.group_members
  for delete to authenticated using (user_id = auth.uid() or public.is_group_admin(group_id));

-- restaurants
create policy "restaurants_select_members" on public.restaurants
  for select to authenticated using (public.is_group_member(group_id));

create policy "restaurants_insert_members" on public.restaurants
  for insert to authenticated with check (public.is_group_member(group_id) and created_by = auth.uid());

create policy "restaurants_update_creator_or_admin" on public.restaurants
  for update to authenticated
  using (created_by = auth.uid() or public.is_group_admin(group_id))
  with check (public.is_group_member(group_id));

create policy "restaurants_delete_creator_or_admin" on public.restaurants
  for delete to authenticated using (created_by = auth.uid() or public.is_group_admin(group_id));

-- decisions: select-only for clients. Writes are reserved for a service_role job
-- (a later phase's "pick today's restaurant" job/Edge Function), which bypasses
-- RLS entirely — no insert/update/delete policy is defined for `authenticated`.
create policy "decisions_select_members" on public.decisions
  for select to authenticated using (public.is_group_member(group_id));

-- invitations: visible/manageable by group admins & members. Redeeming a code
-- pre-membership needs its own SECURITY DEFINER RPC — out of scope for Phase 1,
-- flagged for the Groups phase.
create policy "invitations_select_members" on public.invitations
  for select to authenticated using (public.is_group_member(group_id));

create policy "invitations_insert_admins" on public.invitations
  for insert to authenticated with check (public.is_group_admin(group_id) and created_by = auth.uid());

create policy "invitations_delete_admins" on public.invitations
  for delete to authenticated using (public.is_group_admin(group_id));
