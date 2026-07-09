fetch("http://localhost:8080/tools").then(r => r.json()).then(async tools => {
  try {
    const tool = tools.find(t => t.name === "UiPath Iqbal");
    const versions = typeof tool.versions === 'string' ? JSON.parse(tool.versions) : tool.versions;
    const args = versions[0].released.args;
    
    // In my previous test script, I passed `node ... '{"baseUrl":...}'` as args[0].
    // But the user might have saved it properly so args[1] is the JSON config. Let's find the json config.
    const configStr = args.find(a => a.includes('"baseUrl"')) || args[0].match(/'({.*})'/)[1];
    
    const config = JSON.parse(configStr.replace(/^'|'$/g, ''));
    console.log("Config:", config);

    const tokenRes = await fetch(`${config.baseUrl}/identity_/connect/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: config.clientId,
        client_secret: config.clientSecret,
        scope: config.scopes
      })
    });
    const tokenData = await tokenRes.json();
    if (!tokenRes.ok) { console.log("TOKEN ERROR:", tokenData); return; }

    const foldersRes = await fetch(`${config.baseUrl}/${config.org}/${config.tenant}/orchestrator_/odata/Folders`, {
      headers: { 'Authorization': `Bearer ${tokenData.access_token}` }
    });
    const foldersData = await foldersRes.json();
    if (foldersData.value) {
      console.log("Available Folders:", foldersData.value.map(f => ({ Id: f.Id, DisplayName: f.DisplayName })));
      const folderExists = foldersData.value.find(f => String(f.Id) === String(config.folderId));
      if (!folderExists) {
         console.log(`\n>>> ERROR: Folder ID ${config.folderId} NOT FOUND in available folders! <<<`);
      } else {
         console.log(`\n>>> SUCCESS: Folder ID ${config.folderId} found (${folderExists.DisplayName}). <<<`);
      }
    } else {
      console.log("Folders fetch error:", foldersData);
    }
  } catch(e) { console.error(e) }
});
