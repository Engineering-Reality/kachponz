fetch("http://localhost:8080/tools").then(r => r.json()).then(async tools => {
  const tool = tools.find(t => t.name.includes("UiPath"));
  if (!tool) { console.log("Tool not found"); return; }
  const payload = {
    name: tool.name,
    description: tool.description,
    on_status: tool.on_status,
    versions: [{ version: "1.0.0", released: { method: "sse", command: "node", args: ["foo"], env: {}, port: 10002 } }]
  };
  const res = await fetch(`http://localhost:8080/tools/${tool.tool_id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  console.log(res.status);
  console.log(await res.text());
});
