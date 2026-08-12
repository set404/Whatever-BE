# The Great Decision — API

NestJS API layer for The Great Decision. Supabase Auth still handles sign up / log in / log out / reset password (see `../../FE`), but this app owns all data reads/writes and role-based authorization — it connects to the same Postgres database directly (via Prisma) and bypasses Row Level Security, enforcing access control in application code instead.

## Why a separate API in front of Supabase?

The app needs a platform-wide role system (`superadmin` / `admin` / `member`, distinct from the per-group `owner` / `admin` / `member` role already in `group_members`) with real authorization logic — e.g. only a superadmin can change someone's role. That's naturally expressed as application code with typed guards and services, not as SQL RLS policies. Supabase Auth is kept for what it's good at (session management, password reset emails, social login later); this API is kept for what it's good at (business logic, authorization, typed queries).

## Stack

- NestJS 11
- Prisma (classic `prisma-client-js` generator + `@prisma/adapter-pg`, not the newer ESM-only `prisma-client` generator — see the comment in `prisma/schema.prisma` for why)
- `jose` for verifying Supabase's JWTs against its JWKS endpoint (Supabase signs access tokens asymmetrically — there's no shared secret to configure)

## Setup

```bash
npm install
cp .env.example .env   # then fill in from `supabase status` (run from BE/)
npx prisma generate
```

`DATABASE_URL` connects as the Postgres superuser (bypasses RLS by design — this app is the authorization boundary, not RLS) and `SUPABASE_URL` is used to build the JWKS endpoint for token verification.

### Schema

`prisma/schema.prisma` is **hand-authored, not introspected** (`prisma db pull` drags in every internal Supabase Auth table — sessions, MFA, SSO, OAuth — which we don't want a dependency on). `BE/supabase/migrations` is the single source of truth for schema; after changing it there, update `schema.prisma` to match by hand. Don't run `prisma migrate` or `prisma db pull` against this schema.

## Running

```bash
npm run start:dev     # requires `supabase start` running in BE/ first
```

## Roles

- `GET /me` — any authenticated user, returns your own profile + role
- `GET /admin/users` — requires `admin` or `superadmin`, lists all users and their roles
- `PATCH /admin/users/:id/role` — requires `superadmin`, changes another user's global role

There's no in-app way to create the first superadmin (role changes require an existing superadmin — see above). Sign up through the app once, then:

```bash
# set BOOTSTRAP_SUPERADMIN_EMAIL in .env to that account's email first
npm run seed:superadmin
```

### How authorization works

1. `SupabaseAuthGuard` runs globally (every route requires a valid Supabase session unless marked `@Public()`). It verifies the bearer token against Supabase's JWKS endpoint, looks up the user's `profiles` row, and attaches `{ id, email, displayName, globalRole }` to the request.
2. `RolesGuard` + `@Roles(GlobalRole.Admin)` (etc.) check that against a route's required role. Roles are ranked (`superadmin > admin > member`), so `@Roles(Admin)` also admits a superadmin.

## A note on Row Level Security

`BE/supabase/migrations` still defines RLS policies for every table (from before this API existed). Since this app bypasses RLS entirely, those policies are no longer the enforcement point for anything this API handles — they're dormant unless something queries Postgres directly through PostgREST again. While building this, we also discovered the local Supabase CLI's newer default doesn't auto-grant base table access to `authenticated`/`anon` at all (only `profiles` has been fixed, since it's the one table this API's design still expects a legitimate direct-client write path for — self-editing your own `display_name`/`avatar_url`). The other five tables (`groups`, `group_members`, `restaurants`, `decisions`, `invitations`) are effectively unreachable via PostgREST right now; grant them base privileges too if a future feature needs direct client access to one of those instead of going through this API.

## Testing

```bash
npm test        # unit tests — no external services needed
npm run test:e2e   # requires `supabase start` running (PrismaService connects to the real local DB on boot)
```
