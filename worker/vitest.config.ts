import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-pool-workers'
import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig(async () => {
  const migrationsPath = path.join(__dirname, 'test/migrations')
  const migrations = await readD1Migrations(migrationsPath)
  return {
    plugins: [
      cloudflareTest({
        wrangler: { configPath: path.join(__dirname, '../wrangler.jsonc') },
        miniflare: {
          bindings: { TEST_MIGRATIONS: migrations },
        },
      }),
    ],
    root: __dirname,
    test: {
      setupFiles: ['./test/apply-migrations.ts'],
    },
  }
})
