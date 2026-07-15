const { Client } = require('pg');

async function fix() {
  const client = new Client({
    connectionString: 'postgres://amadeus:amadeus_local_dev@127.0.0.1:5432/amadeus'
  });
  await client.connect();

  const companyId = '455bbe68-f931-4c1a-ad06-402f92292099';

  // 1. Insert mcp-uipath
  const mcpUipathRes = await client.query(`
    INSERT INTO tools (company_id, name, description, versions, on_status)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING tool_id
  `, [
    companyId,
    'mcp-uipath',
    'UiPath MCP Server',
    JSON.stringify([{
      released: {
        command: 'node',
        args: ['/home/firania/Downloads/ponzgen/microservice/mcp/mcp-uipath/build/index.js'],
        method: 'sse',
        env: {}
      }
    }]),
    'online'
  ]);
  const uipathId = mcpUipathRes.rows[0].tool_id;

  // 2. Insert amadeus-mcp
  const amadeusMcpRes = await client.query(`
    INSERT INTO tools (company_id, name, description, versions, on_status)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING tool_id
  `, [
    companyId,
    'amadeus-mcp',
    'Amadeus Core MCP Server',
    JSON.stringify([{
      released: {
        command: 'node',
        args: ['/home/firania/Downloads/ponzgen/microservice/mcp/amadeus-mcp/build/index.js'],
        method: 'sse',
        env: {}
      }
    }]),
    'online'
  ]);
  const amadeusId = amadeusMcpRes.rows[0].tool_id;

  // 3. Insert Agent dannatar cx100
  await client.query(`
    INSERT INTO agents (company_id, agent_name, description, agent_style, tools, on_status)
    VALUES ($1, $2, $3, $4, $5, $6)
  `, [
    companyId,
    'dannatar cx100',
    'Agent for UiPath and Amadeus Orchestration',
    'helpful and precise',
    [uipathId, amadeusId], // PostgreSQL array of UUIDs mapped by pg library
    true
  ]);

  console.log('Successfully recreated tools and agent!');
  await client.end();
}

fix().catch(console.error);
