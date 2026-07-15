import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const MCP_REGISTRY = "https://registry.modelcontextprotocol.io/v0.1/servers";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get("q") || "";
  const limit = Math.min(Number(searchParams.get("limit") || "10"), 50);

  try {
    // Fetch more results from the registry to allow for deduplication
    const fetchLimit = Math.max(limit * 5, 20);
    const url = `${MCP_REGISTRY}?search=${encodeURIComponent(search)}&limit=${fetchLimit}`;
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      next: { revalidate: 60 }, // cache 60s
    });

    if (!res.ok) {
      return NextResponse.json({ error: `Registry error: ${res.status}` }, { status: res.status });
    }

    const data = await res.json();

    // Normalize and deduplicate by server name
    const seenNames = new Set<string>();
    const uniqueServers = [];
    
    for (const item of (data.servers ?? [])) {
      const s = item.server ?? item;
      const name = s.name ?? "";
      
      if (!name || seenNames.has(name)) continue;
      seenNames.add(name);
      
      uniqueServers.push({
        name,
        description: s.description ?? "",
        repository: s.repository?.url ?? "",
        version: s.version ?? "",
        remotes: (s.remotes ?? []).map((r: any) => ({ type: r.type, url: r.url })),
        official: item._meta?.["io.modelcontextprotocol.registry/official"]?.status === "active",
      });
      
      if (uniqueServers.length >= limit) break;
    }

    return NextResponse.json({ servers: uniqueServers, total: uniqueServers.length });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
