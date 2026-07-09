const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgres://amadeus:amadeus_local_dev@127.0.0.1:5432/amadeus' });

async function run() {
  try {
    const res = await pool.query("SELECT tool_id, name, versions FROM tools WHERE name ILIKE '%uipath%'");
    for (const row of res.rows) {
      const versions = typeof row.versions === 'string' ? JSON.parse(row.versions) : row.versions;
      if (versions && versions[0] && versions[0].released && versions[0].released.args) {
        let args = versions[0].released.args;
        
        // Find the arg containing the JSON config
        const jsonArgIndex = args.findIndex(a => a.includes('"baseUrl"'));
        let jsonStr = "";
        let isWrapped = false;
        
        if (jsonArgIndex !== -1) {
           jsonStr = args[jsonArgIndex];
        } else {
           // Maybe it's wrapped in single quotes
           const match = args[0].match(/'({.*})'/);
           if (match) {
             jsonStr = match[1];
             isWrapped = true;
           } else {
             // Try parsing args[0] directly
             jsonStr = args[0];
           }
        }
        
        try {
          const config = JSON.parse(jsonStr.replace(/^'|'$/g, ''));
          config.scopes = "OR.License OR.License.Read OR.License.Write OR.Settings OR.Settings.Read OR.Settings.Write OR.Robots OR.Robots.Read OR.Robots.Write OR.Machines OR.Machines.Read OR.Machines.Write OR.Execution OR.Execution.Read OR.Execution.Write OR.Assets OR.Assets.Read OR.Assets.Write OR.Queues OR.Queues.Read OR.Queues.Write OR.Jobs OR.Jobs.Read OR.Jobs.Write OR.Users OR.Users.Read OR.Users.Write OR.Administration OR.Administration.Read OR.Administration.Write OR.Audit OR.Audit.Read OR.Audit.Write OR.Webhooks OR.Webhooks.Read OR.Webhooks.Write OR.Monitoring OR.Monitoring.Read OR.Monitoring.Write OR.ML OR.ML.Read OR.ML.Write OR.Tasks OR.Tasks.Read OR.Tasks.Write OR.Analytics OR.Analytics.Read OR.Analytics.Write OR.Folders OR.Folders.Read OR.Folders.Write OR.BackgroundTasks OR.BackgroundTasks.Read OR.BackgroundTasks.Write OR.TestSets OR.TestSets.Read OR.TestSets.Write OR.TestSetExecutions OR.TestSetExecutions.Read OR.TestSetExecutions.Write OR.TestSetSchedules OR.TestSetSchedules.Read OR.TestSetSchedules.Write OR.TestDataQueues OR.TestDataQueues.Read OR.TestDataQueues.Write OR.Hypervisor OR.Hypervisor.Read OR.Hypervisor.Write OR.AutomationSolutions.Access OR.Buckets OR.Buckets.Read OR.Buckets.Write";
          
          let newArg = JSON.stringify(config);
          if (isWrapped || args[0].startsWith("'")) newArg = `'${newArg}'`;
          
          if (jsonArgIndex !== -1) {
            args[jsonArgIndex] = newArg;
          } else {
            args[0] = newArg;
          }
          
          versions[0].released.args = args;
          
          await pool.query("UPDATE tools SET versions = $1 WHERE tool_id = $2", [JSON.stringify(versions), row.tool_id]);
          console.log(`Updated scopes for tool: ${row.name}`);
        } catch (e) {
          console.error(`Failed parsing JSON for ${row.name}`, e.message);
        }
      }
    }
  } catch (e) {
    console.error(e.message);
  } finally {
    pool.end();
  }
}
run();
