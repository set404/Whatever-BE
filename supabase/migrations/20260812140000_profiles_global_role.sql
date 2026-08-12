-- Adds a platform-wide role, distinct from the per-group role in group_members.
-- group_members.role (owner/admin/member) governs permissions *within one group*
-- (e.g. "admin of Office Lunch"). profiles.global_role governs the whole app
-- (e.g. superadmin can manage any group or user, for moderation/support) and is
-- independent of group membership. Every existing/new user defaults to 'member'.

alter table public.profiles
  add column global_role text not null default 'member'
  check (global_role in ('superadmin', 'admin', 'member'));

create index ix_profiles_global_role on public.profiles (global_role) where global_role <> 'member';

-- RLS restricts *rows*, not columns: the existing "profiles_update_own" policy
-- (id = auth.uid()) would otherwise let any user PATCH their own global_role
-- straight through PostgREST, bypassing the app entirely. Column-level GRANTs
-- close that: `authenticated` can update their own display_name/avatar_url, but
-- never global_role. Role changes only happen through the NestJS API (which
-- connects with a role that bypasses RLS/grants and enforces its own checks).
revoke update on public.profiles from authenticated;
grant update (display_name, avatar_url) on public.profiles to authenticated;
