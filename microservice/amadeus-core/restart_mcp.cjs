const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgres://amadeus:amadeus_local_dev@127.0.0.1:5432/amadeus' });

async function run() {
  await pool.query("UPDATE tools SET on_status = false WHERE name ILIKE '%uipath%'");
  await new Promise(r => setTimeout(r, 2000));
  await pool.query("UPDATE tools SET on_status = true WHERE name ILIKE '%uipath%'");
  console.log("Toggled on_status to force MCP restart.");
  pool.end();
}
run();
