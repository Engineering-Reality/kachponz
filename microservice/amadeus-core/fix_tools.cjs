const { Client } = require('pg');

async function fix() {
  const client = new Client({
    connectionString: 'postgres://amadeus:amadeus_local_dev@127.0.0.1:5432/amadeus'
  });
  await client.connect();

  const res = await client.query('SELECT tool_id, name, versions FROM tools WHERE name IN ($1, $2, $3)', [
    'amadeus-mcp', 'UiPath Iqbal', 'UiPath Maestro'
  ]);

  for (const row of res.rows) {
    const versions = row.versions;
    if (!versions || versions.length === 0) continue;
    const lastIdx = versions.length - 1;
    const release = versions[lastIdx].released;
    if (release) {
      release.command = 'node';
      if (row.name === 'amadeus-mcp') {
        release.args = ['/home/firania/Downloads/ponzgen/microservice/mcp/amadeus-mcp/build/index.js'];
      } else {
        release.args = ['/home/firania/Downloads/ponzgen/microservice/mcp/mcp-uipath/build/index.js'];
      }
      
      await client.query('UPDATE tools SET versions = $1 WHERE tool_id = $2', [JSON.stringify(versions), row.tool_id]);
      console.log(`Updated ${row.name}`);
    }
  }
  await client.end();
}

fix().catch(console.error);
