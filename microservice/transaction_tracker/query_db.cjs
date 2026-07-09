const pg = require('pg');
const pool = new pg.Pool({ connectionString: 'postgres://postgres:postgres@localhost:5432/transaction_tracker' });
pool.query("SELECT * FROM mcp_runtime_state").then(res => {
  console.log(res.rows);
  pool.end();
}).catch(e => { console.error(e.message); pool.end(); });
