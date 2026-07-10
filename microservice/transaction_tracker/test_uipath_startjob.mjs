

async function testStartJob() {
  const tokenRes = await fetch("https://cloud.uipath.com/identity_/connect/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: "0b7fd08e-3614-4687-bacc-5f2446049e6b",
      client_secret: "ki!YJ#Yqi*7kLr89Rda)6(ABDP_ANuzp0%?WKF2qj31y_#G0m33XwKki47eJ4PEU",
      scope: "OR.Jobs",
    }).toString(),
  });
  const tokenJson = await tokenRes.json();
  const token = tokenJson.access_token;
  
  const org = "anakindia";
  const tenant = "DefaultTenant";
  const folderId = "997942";
  const releaseKey = "7373dfe6-aeb3-4832-9928-ba8deb6975d4"; // From user's log
  
  const url = `https://cloud.uipath.com/${org}/${tenant}/orchestrator_/odata/Jobs/UiPath.Server.Configuration.OData.StartJobs`;
  
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-UIPATH-OrganizationUnitId": folderId,
      },
      body: JSON.stringify({
        startInfo: {
          ReleaseKey: releaseKey,
          Strategy: "ModernJobsCount",
          JobsCount: 1,
          InputArguments: "{}",
        },
      }),
    });
    console.log(res.status);
    console.log(await res.text());
  } catch (err) {
    console.error("Fetch Error:", err.message);
  }
}
testStartJob();
