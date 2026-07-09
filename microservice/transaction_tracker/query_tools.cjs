const pg = require('pg');
const pool = new pg.Pool({ connectionString: 'postgres://postgres:postgres@localhost:5432/transaction_tracker' });
pool.query("SELECT name, versions FROM tools WHERE name ILIKE '%uipath%'").then(res => {
  res.rows.forEach(r => {
    const v = typeof r.versions === 'string' ? JSON.parse(r.versions) : r.versions;
    console.log(r.name, JSON.stringify(v[0].released.args, null, 2));
  });
  pool.end();
}).catch(console.error);
