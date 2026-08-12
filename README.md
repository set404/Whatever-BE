# The Great Decision — Backend

Two parts:

- **`supabase/`** — database schema, migrations, and Supabase Auth (sign up / log in / log out / reset password). Supabase CLI project, documented below.
- **`api/`** — [NestJS API](api/README.md) that owns all data reads/writes and role-based authorization (`superadmin` / `admin` / `member`), connecting directly to the same Postgres database rather than through Supabase's PostgREST + RLS.

The Angular/Ionic app lives in the sibling `FE/` repo.

## Setup

1. [Create a Supabase project](https://supabase.com/dashboard) (or use the CLI's local dev stack — see below).
2. Copy `.env.example` to `.env` and fill in your project's values (Project Settings → API / General in the dashboard).
3. Link the CLI to your project and push the schema:

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

4. In `FE/src/environments/environment.ts` (and `.prod.ts`), set `supabase.url` and `supabase.anonKey` from the same project. The anon key is safe to commit — see the note in that file.

## Local development (optional)

Requires Docker Desktop running.

```bash
npx supabase start     # spins up local Postgres/Auth/Studio
npx supabase db reset  # (re)applies all migrations + seed.sql
```

## Schema

Six tables, all under `public`:

| Table | Purpose |
|---|---|
| `profiles` | One row per user (mirrors `auth.users`), display name + avatar + platform-wide `global_role` |
| `groups` | A group of people deciding where to eat together |
| `group_members` | Membership + role (`owner` / `admin` / `member`) |
| `restaurants` | A group's restaurant pool (soft-deleted via `active`, never hard-deleted) |
| `decisions` | The daily pick per group (one per `group_id` + `decision_date`) |
| `invitations` | Shareable join codes for a group |

See `supabase/migrations/` for the full DDL, or `FE/src/app/shared/models/database.types.ts` for the TypeScript mirror.

### Row Level Security

Every table has RLS enabled; users can only read/write data for groups they belong to. Membership checks go through two `SECURITY DEFINER` helper functions (`is_group_member`, `is_group_admin` in `20260812093100_functions_and_triggers.sql`) rather than inline subqueries — a plain policy on `group_members` that queries `group_members` would recurse infinitely, since the subquery re-triggers the same table's RLS. The helper functions run as their owner and bypass RLS on the table they check internally, breaking the cycle.

`decisions` has a select-only policy for authenticated users. There's no insert/update/delete policy for that role by design — picking the daily restaurant will run as a trusted service-role job (a later phase), which bypasses RLS entirely.

Two triggers do the bookkeeping so client code doesn't have to: `handle_new_user` creates a `profiles` row when someone signs up, and `handle_new_group` adds the creator as `owner` in `group_members` when a group is created.

**Since `api/` was added, RLS is no longer the primary enforcement point.** The NestJS API connects with a role that bypasses RLS and enforces authorization in application code instead; RLS here now mostly matters for the one path that still goes directly through PostgREST — Supabase Auth's own signup trigger, and a user editing their own `display_name`/`avatar_url`. See `api/README.md` for the full explanation, including a gap this surfaced: this Supabase CLI version doesn't auto-grant base table access to `authenticated`/`anon` for new tables, so most RLS policies here were actually unreachable via PostgREST until fixed per-table as needed (`profiles` is fixed; the other five tables are not, since nothing currently needs direct client access to them).

## Migrations

| File | Contents |
|---|---|
| `20260812093000_initial_schema.sql` | Tables, foreign keys, indexes |
| `20260812093100_functions_and_triggers.sql` | RLS helper functions, signup/group-creation triggers |
| `20260812093200_rls_policies.sql` | RLS policies for all six tables |
| `20260812140000_profiles_global_role.sql` | Adds `profiles.global_role` (superadmin/admin/member) + column-level UPDATE grant so only `display_name`/`avatar_url` are self-editable, not the role itself |
| `20260812141500_profiles_grant_select.sql` | Grants base `SELECT` on `profiles` to `authenticated` (see RLS note above) |

Add new migrations with `npx supabase migration new <name>` rather than editing existing ones once they've shipped to a real environment.

## Status

Schema and RLS are designed for the full v1 feature set (groups, restaurants, daily decisions, invitations) but this is not yet linked to a live Supabase project — that happens once a project is provisioned. `decisions` writes (the actual "pick a restaurant" job) land in a later phase, likely as a Supabase Edge Function or scheduled job using the `service_role` key.
