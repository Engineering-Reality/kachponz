async function run() {
  try {
    const { Pool } = require('pg');
    const pool = new Pool({ connectionString: 'postgres://amadeus:amadeus_local_dev@127.0.0.1:5432/amadeus' });
    const res = await pool.query("SELECT versions FROM tools WHERE name = 'UiPath Iqbal'");
    pool.end();
    
    const versions = typeof res.rows[0].versions === 'string' ? JSON.parse(res.rows[0].versions) : res.rows[0].versions;
    const configStr = versions[0].released.args.find(a => a.includes('"baseUrl"')) || versions[0].released.args[0].match(/'({.*})'/)[1];
    const config = JSON.parse(configStr.replace(/^'|'$/g, ''));
    
    const tokenRes = await fetch(`${config.baseUrl}/identity_/connect/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'client_credentials', client_id: config.clientId, client_secret: config.clientSecret, scope: config.scopes })
    });
    const tokenData = await tokenRes.json();
    
    const jobRes = await fetch(`${config.baseUrl}/${config.org}/${config.tenant}/orchestrator_/odata/Jobs(109959523)`, {
      headers: { 'Authorization': `Bearer ${tokenData.access_token}`, 'X-UIPATH-OrganizationUnitId': config.folderId }
    });
    const jobData = await jobRes.json();
    console.log("JobKey:", jobData.Key);
    
    const logsRes = await fetch(`${config.baseUrl}/${config.org}/${config.tenant}/orchestrator_/odata/RobotLogs?$filter=JobKey eq ${jobData.Key}&$top=1`, {
      headers: { 'Authorization': `Bearer ${tokenData.access_token}`, 'X-UIPATH-OrganizationUnitId': config.folderId }
    });
    console.log("Logs Status:", logsRes.status);
    const logsData = await logsRes.json();
    console.log("Logs:", logsData);
  } catch(e) { console.error(e) }
}
run();
