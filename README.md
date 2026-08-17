# Whatever — Backend

A single self-contained NestJS API (`api/`) — no external auth or database provider. It owns:

- **Auth**: signup/login/logout/refresh/password-reset, JWT access tokens + rotating refresh tokens (see `api/README.md`).
- **Data**: Postgres (recommend [Neon](https://neon.tech)'s free tier), managed with Prisma Migrate.
- **Images**: restaurant photo uploads go straight from the FE to Cloudflare R2 via a presigned URL the API issues.
- **Role-based authorization** (`superadmin` / `admin` / `member`), enforced in application code.

The Angular/Ionic app lives in the sibling `FE/` repo.

## Setup

1. Create a free Postgres database (e.g. a [Neon](https://neon.tech) project) and grab its connection string.
2. `cd api && cp .env.example .env` and fill in `DATABASE_URL` plus the rest — see `api/README.md` for what each variable is for.
3. `npm install && npx prisma migrate dev` to create the schema.

## Schema

Eight tables, managed by Prisma Migrate (`api/prisma/migrations/`, source of truth):

| Table | Purpose |
|---|---|
| `users` | One row per account: email, password hash, display name, avatar, platform-wide `global_role` |
| `refresh_tokens` | Hashed, rotating session tokens backing `/auth/refresh` and revocable logout |
| `password_reset_tokens` | Single-use, expiring tokens for `/auth/reset-password` |
| `groups` | A group of people deciding where to eat together |
| `group_members` | Membership + role (`owner` / `admin` / `member`) |
| `restaurants` | A group's restaurant pool (soft-deleted via `active`, never hard-deleted) |
| `decisions` | The daily pick per group (one per `group_id` + `decision_date`) |
| `invitations` | Shareable join codes for a group |

See `api/prisma/schema.prisma` for the full model definitions.

## Migrations

```bash
npx prisma migrate dev --name <description>
```

Run from `api/`. This is the only way schema changes happen now — there's no separate SQL source of truth to keep in sync.
