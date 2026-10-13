import path from 'node:path';
import { defineConfig } from 'prisma/config';

// When a Prisma config file is present, the CLI no longer auto-loads `.env`.
// Load it here for local development; in CI/containers variables come from the environment.
try {
  process.loadEnvFile(path.join(import.meta.dirname, '.env'));
} catch {
  // No .env file — rely on the process environment.
}

export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  migrations: {
    path: path.join('prisma', 'migrations'),
    seed: 'tsx src/scripts/seed.ts',
  },
});
