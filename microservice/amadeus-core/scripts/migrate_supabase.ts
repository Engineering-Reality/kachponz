import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

// Load env since this is a script
import dotenv from 'dotenv';
dotenv.config();
dotenv.config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://amadeus:amadeus_local_dev@127.0.0.1:5432/amadeus'
});

async function main() {
  const dbDir = '/home/firania/Downloads/ponzgen/database';
  
  console.log('Starting migration from Supabase dumps to local Postgres...');
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // 1. Create Tables (DDL)
    console.log('Creating tables...');
    await client.query(`
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

      CREATE TABLE IF NOT EXISTS companies (
        company_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name TEXT NOT NULL,
        description TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS roles (
        role_id INTEGER PRIMARY KEY,
        role_name TEXT,
        description TEXT
      );

      -- We don't have Supabase auth, so we mock a users table just so FKs don't break if needed
      -- Actually, to make it simple, we won't use FK for user_id to avoid creating fake users for every dump row
      
      CREATE TABLE IF NOT EXISTS user_companies (
        user_id UUID,
        company_id UUID REFERENCES companies(company_id) ON DELETE CASCADE,
        role_id INTEGER,
        PRIMARY KEY (user_id, company_id)
      );

      CREATE TABLE IF NOT EXISTS tools (
        tool_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID,
        company_id UUID REFERENCES companies(company_id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        description TEXT,
        versions JSONB DEFAULT '[]'::jsonb,
        on_status TEXT
      );

      CREATE TABLE IF NOT EXISTS agents (
        agent_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID,
        company_id UUID REFERENCES companies(company_id) ON DELETE CASCADE,
        agent_name TEXT NOT NULL,
        description TEXT,
        agent_style TEXT,
        on_status BOOLEAN DEFAULT true,
        tools TEXT[] DEFAULT '{}',
        share_editor_with TEXT[] DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      
      -- Clear existing data if re-running
      TRUNCATE TABLE agents, tools, user_companies, roles, companies CASCADE;
    `);
    
    // 2. Read and Execute SQL Dumps in order (Dependencies first)
    const filesToLoad = [
      'companies_rows.sql',
      'roles_rows.sql',
      'user_companies_rows.sql',
      'tools_rows.sql',
      'agents_rows.sql'
    ];
    
    for (const filename of filesToLoad) {
      const filePath = path.join(dbDir, filename);
      if (fs.existsSync(filePath)) {
        console.log(`Loading ${filename}...`);
        let sql = fs.readFileSync(filePath, 'utf-8');
        // Fix for Postgres empty array type cast error from Supabase dumps
        sql = sql.replace(/ARRAY\[\]/g, "ARRAY[]::uuid[]");
        if (sql.trim().length > 0) {
          try {
             await client.query(`SAVEPOINT file_${filename.replace(/\./g, '_')}`);
             // Temporarily disable constraint checks for this transaction block (only works for DEFERRABLE, but we can just catch)
             await client.query(sql);
             console.log(`✅ Successfully loaded ${filename}`);
             await client.query(`RELEASE SAVEPOINT file_${filename.replace(/\./g, '_')}`);
          } catch (e: any) {
             console.error(`❌ Error executing ${filename}:`, e.message);
             await client.query(`ROLLBACK TO SAVEPOINT file_${filename.replace(/\./g, '_')}`);
          }
        }
      } else {
        console.warn(`⚠️ ${filename} not found, skipping.`);
      }
    }

    await client.query('COMMIT');
    console.log('Migration completed successfully!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', err);
  } finally {
    client.release();
    pool.end();
  }
}

main();
