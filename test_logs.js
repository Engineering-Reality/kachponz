fetch("http://localhost:8080/tools").then(r => r.json()).then(async tools => {
  try {
    const tool = tools.find(t => t.name === "UiPath Iqbal");
    const versions = typeof tool.versions === 'string' ? JSON.parse(tool.versions) : tool.versions;
    const args = versions[0].released.args;
    const configStr = args.find(a => a.includes('"baseUrl"')) || args[0].match(/'({.*})'/)[1];
    const config = JSON.parse(configStr.replace(/^'|'$/g, ''));
    
    const tokenRes = await fetch(`${config.baseUrl}/identity_/connect/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'client_credentials', client_id: config.clientId, client_secret: config.clientSecret, scope: config.scopes })
    });
    const tokenData = await tokenRes.json();
    
    // We don't know the exact job ID to query, let's just query /odata/RobotLogs?$top=1
    const logsRes = await fetch(`${config.baseUrl}/${config.org}/${config.tenant}/orchestrator_/odata/RobotLogs?$top=1`, {
      headers: { 'Authorization': `Bearer ${tokenData.access_token}`, 'X-UIPATH-OrganizationUnitId': config.folderId }
    });
    const logsData = await logsRes.json();
    console.log(logsRes.status, logsData);
  } catch(e) { console.error(e) }
});
