import pg from 'pg';

const pool = new pg.Pool({
  connectionString: 'postgres://amadeus:amadeus_local_dev@127.0.0.1:5432/amadeus'
});

async function run() {
  const res = await pool.query("SELECT tool_id, name, versions->-1->'released'->'command' as command, versions->-1->'released'->'args' as args, versions->-1->'released'->'env' as env FROM tools WHERE name ILIKE '%uipath%';");
  console.log(JSON.stringify(res.rows, null, 2));
  await pool.end();
}

run().catch(console.error);
