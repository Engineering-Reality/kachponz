import { Pool } from 'pg';

const pool = new Pool({
  connectionString: 'postgres://amadeus:amadeus_local_dev@127.0.0.1:5432/amadeus'
});

async function run() {
  await pool.query(`
    UPDATE tools 
    SET versions = jsonb_set(
      versions, 
      ARRAY[(jsonb_array_length(versions)-1)::text, 'released'],
      jsonb_set(
        jsonb_set(
          jsonb_set(
            versions->(jsonb_array_length(versions)-1)->'released',
            '{command}', '"npx"'
          ),
          '{args}', '["-y", "mcp-remote", "https://mcp.linear.app/mcp"]'::jsonb
        ),
        '{method}', '"stdio"'
      )
    )
    WHERE name = 'Linear Official';
  `);
  console.log('Fixed Linear Official');
  await pool.end();
}

run();
