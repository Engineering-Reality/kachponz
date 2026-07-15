import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // DB-backed test berbagi satu Postgres; jalankan serial dalam satu fork
    // agar TRUNCATE di beforeEach tidak bertabrakan antar file.
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    fileParallelism: false,
    include: ['test/**/*.test.ts'],
    testTimeout: 20_000,
  },
});
