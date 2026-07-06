# mcp-uipath

MCP server that bridges to the UiPath Automation Cloud Orchestrator API. Exposes
three tools over SSE: `trigger_uipath_job`, `list_uipath_processes`, and
`get_uipath_job_status`.

## Getting UiPath credentials to test against

1. Log in to [cloud.uipath.com](https://cloud.uipath.com).
2. Click **Admin** (gear icon) → **External Applications** → **Add Application**.
3. Choose application type **Confidential**.
4. Scopes: check `OR.Jobs`, `OR.Execution`, `OR.Robots.Read`, `OR.Folders.Read`
   (Orchestrator scope).
5. Save → note the **Client ID** and **Client Secret**.
6. Org slug: visible in the URL `cloud.uipath.com/{org-slug}/{tenant-slug}/orchestrator_/`.
7. Folder ID: open **Orchestrator** → the folder you want to use → its ID is in
   the URL, or fetch it via `GET /odata/Folders`.
8. Release key: publish a simple process from UiPath Studio, then
   `GET /odata/Releases` and take the `Key` field.

## Setup

```bash
cp .env.example .env
# fill in UIPATH_ORG, UIPATH_TENANT, UIPATH_CLIENT_ID, UIPATH_CLIENT_SECRET, UIPATH_FOLDER_ID
```

## Manual test

```bash
# 1. Start mcp-uipath
cd microservice/mcp-uipath
npm install && npm run build
UIPATH_ORG=xxx UIPATH_TENANT=yyy UIPATH_CLIENT_ID=zzz UIPATH_CLIENT_SECRET=www UIPATH_FOLDER_ID=123 npm run start

# 2. Test via MCP Inspector (separate terminal)
npx @modelcontextprotocol/inspector http://localhost:10001/sse

# 3. In the Inspector UI:
#   a. Call "list_uipath_processes" → see the processes in the folder
#   b. Copy a releaseKey from the result
#   c. Call "trigger_uipath_job" with that releaseKey → see the job ID
#   d. Call "get_uipath_job_status" with the job ID → see its state (Pending/Running/Successful)

# 4. If no robot has picked up the job yet, the state will stay Pending — that's NORMAL.
#    This already proves: MCP → OAuth2 → UiPath API → Job Created ✅
```
