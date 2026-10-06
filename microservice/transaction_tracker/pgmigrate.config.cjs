// node-pg-migrate configuration
// Reads DATABASE_URL from .env (or environment).
// Run: npm run migrate
require("dotenv").config({ path: ".env" });

module.exports = {
  databaseUrl: process.env.DATABASE_URL,
  dir: "migrations",
  direction: "up",
  migrationsTable: "pgmigrations",
  verbose: true,
};
