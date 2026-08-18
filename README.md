# Whatever — API

Self-contained NestJS API for Whatever — no external auth, database, or storage provider. It owns account creation and login, all data reads/writes, and role-based authorization (`superadmin` / `admin` / `member`).

## Stack

- NestJS 11
- Prisma (classic `prisma-client-js` generator + `@prisma/adapter-pg`, not the newer ESM-only `prisma-client` generator — see the comment in `prisma/schema.prisma` for why), against any Postgres (Neon recommended for a free hosted DB)
- `jose` for signing/verifying its own JWTs (`HS256`, local secret) and `bcrypt` for password hashing — see `src/auth/`
- `@aws-sdk/client-s3` for presigning uploads to Cloudflare R2 — see `src/uploads/`

## Setup

```bash
npm install
cp .env.example .env   # fill in DATABASE_URL, JWT_SECRET, etc. — see below
npx prisma migrate dev
npx prisma generate
```

### Environment variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string (e.g. from Neon) |
| `JWT_SECRET` | Signs/verifies access tokens (`openssl rand -hex 32`) |
| `FRONTEND_URL` | Used to build the link in password-reset emails, and as the allowed CORS origin |
| `GMAIL_USER` / `GMAIL_APP_PASSWORD` | Sends password-reset emails via Gmail SMTP — a Gmail account with 2FA and an [App Password](https://myaccount.google.com/apppasswords). Leave unset locally to have the reset link logged to the console instead |
| `R2_ACCOUNT_ID` / `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` / `R2_BUCKET` / `R2_PUBLIC_URL` | Cloudflare R2 bucket (S3-compatible) for restaurant image uploads. Create the bucket manually in the Cloudflare dashboard with public read access enabled |
| `BOOTSTRAP_SUPERADMIN_EMAIL` | Used only by `npm run seed:superadmin`, see below |

### Schema

`prisma/schema.prisma` is hand-authored and is the single source of truth — `prisma/migrations/` is generated from it via `npx prisma migrate dev --name <description>`, run whenever the schema changes.

## Running

```bash
npm run start:dev
```

## Auth

All routes require a valid access token unless marked `@Public()` (see `src/auth/jwt-auth.guard.ts`, applied globally in `AppModule`).

- `POST /auth/signup` — `{ email, password, displayName }` → creates the account, returns `{ user, accessToken }`, sets an httpOnly refresh-token cookie
- `POST /auth/login` — `{ email, password }` → same response shape
- `POST /auth/refresh` — reads the refresh cookie, rotates it, returns a new `{ accessToken }`
- `POST /auth/logout` — revokes the refresh token and clears the cookie
- `POST /auth/request-password-reset` — `{ email }` → always 200; emails a reset link if the account exists
- `POST /auth/reset-password` — `{ token, newPassword }` → consumes the token and revokes all of that user's sessions

Access tokens are short-lived (15 min); refresh tokens are opaque, stored hashed in `refresh_tokens`, and rotated on every use. `/auth/*` responses set the refresh token as an `httpOnly`, `SameSite=None; Secure` cookie in production (`SameSite=Lax`, non-`Secure` in local dev over http) — the FE must send requests with credentials included.

- `GET /me` — any authenticated user, returns your own profile + role
- `GET /admin/users` — requires `admin` or `superadmin`, lists all users and their roles
- `PATCH /admin/users/:id/role` — requires `superadmin`, changes another user's global role

There's no in-app way to create the first superadmin (role changes require an existing superadmin — see above). Sign up through the app once, then:

```bash
# set BOOTSTRAP_SUPERADMIN_EMAIL in .env to that account's email first
npm run seed:superadmin
```

### How authorization works

1. `JwtAuthGuard` runs globally (every route requires a valid access token unless marked `@Public()`). It verifies the bearer token locally against `JWT_SECRET` and loads the user's current `global_role` from the database, attaching `{ id, email, displayName, globalRole }` to the request.
2. `RolesGuard` + `@Roles(GlobalRole.Admin)` (etc.) check that against a route's required role. Roles are ranked (`superadmin > admin > member`), so `@Roles(Admin)` also admits a superadmin.

## Restaurant images

`POST /uploads/restaurant-image` (authenticated) — `{ groupId, contentType }` → returns `{ uploadUrl, publicUrl }`. The FE `PUT`s the file directly to `uploadUrl` (a short-lived presigned R2 URL) and stores `publicUrl` as the restaurant's `image_url`. The API never handles the file bytes.

## Testing

```bash
npm test        # unit tests — no external services needed
npm run test:e2e   # requires a real DATABASE_URL (PrismaService connects on boot)
```
