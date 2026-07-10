

async function test() {
  const clientId = "0b7fd08e-3614-4687-bacc-5f2446049e6b";
  const clientSecret = "ki!YJ#Yqi*7kLr89Rda)6(ABDP_ANuzp0%?WKF2qj31y_#G0m33XwKki47eJ4PEU";
  
  try {
    const res = await fetch("https://cloud.uipath.com/identity_/connect/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: clientSecret,
        scope: "OR.Jobs",
      }).toString(),
    });
    console.log(res.status);
    console.log(await res.text());
  } catch (err) {
    console.error("Error:", err.message);
  }
}
test();
