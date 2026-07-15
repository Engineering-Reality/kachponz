const pg = require('pg');
const pool = new pg.Pool({ connectionString: 'postgres://postgres:postgres@localhost:5432/transaction_tracker' });
pool.query("SELECT * FROM service_accounts").then(res => {
  console.log(res.rows);
  pool.end();
}).catch(console.error);
