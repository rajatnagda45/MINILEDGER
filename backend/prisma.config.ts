import path from 'node:path';
import { config as loadDotenv } from 'dotenv';
import { defineConfig } from 'prisma/config';

// The Prisma CLI runs from the backend workspace, but the single source of truth
// for environment variables is the repository-root `.env` (the same file the API
// loads at runtime in `src/server.ts`). Loading it here lets `prisma generate`,
// `validate`, `migrate status`, `migrate dev/deploy`, and `db seed` all resolve
// DATABASE_URL consistently from one place — no duplicate backend/.env required.
loadDotenv({ path: path.resolve(process.cwd(), '../.env') });

export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  migrations: {
    seed: 'tsx prisma/seed.ts',
  },
});
