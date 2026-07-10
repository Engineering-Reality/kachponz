import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';

async function testMcp() {
  const port = 11063;
  const url = `http://127.0.0.1:${port}/sse`;
  const transport = new SSEClientTransport(new URL(url));
  const client = new Client({ name: 'test', version: '1.0' });
  
  try {
    await client.connect(transport);
    console.log("Connected successfully!");
    const res = await client.callTool({
      name: "trigger_uipath_job",
      arguments: {
        releaseKey: "7373dfe6-aeb3-4832-9928-ba8deb6975d4",
        folderId: "997942"
      }
    });
    console.log("Tool response:", res);
  } catch (err) {
    console.error("Error calling tool:", err);
  } finally {
    process.exit(0);
  }
}

testMcp();
