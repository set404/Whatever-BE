// Introspection-only: BE/supabase/migrations is the single source of truth for
// schema. Prisma never owns migrations here — run `npx prisma db pull` after any
// schema change there, don't run `prisma migrate`.
import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: process.env['DATABASE_URL'],
  },
});
