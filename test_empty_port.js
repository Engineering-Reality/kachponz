fetch("http://localhost:8080/tools").then(r => r.json()).then(async tools => {
  const tool = tools.find(t => t.name.includes("UiPath Iqbal"));
  const payload = {
    name: tool.name,
    description: tool.description,
    on_status: tool.on_status,
    versions: [{ version: "1.0.0", released: { method: "sse", command: "node", args: ["node /home/firania/Downloads/ponzgen/microservice/mcp-uipath/build/index.js '{\"baseUrl\":\"https://cloud.uipath.com\",\"org\":\"anakindia\",\"tenant\":\"DefaultTenant\",\"clientId\":\"0b7fd08e-3614-4687-bacc-5f2446049e6b\",\"clientSecret\":\"ki!YJ#Yqi*7kLr89Rda)6(ABDP_ANuzp0%?WKF2qj31y_#G0m33XwKki47eJ4PEU\",\"scopes\":\"OR.Default\",\"folderId\":\"997943\"}'"], env: {}, port: 0 } }]
  };
  const res = await fetch(`http://localhost:8080/tools/${tool.tool_id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  console.log(res.status, await res.text());
});
