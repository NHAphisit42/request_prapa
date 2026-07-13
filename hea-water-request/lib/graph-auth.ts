import { ConfidentialClientApplication } from "@azure/msal-node";

// Cache the Graph token in-memory between invocations to save latency.
// (Each serverless instance keeps its own cache; not persisted across cold starts.)
let cachedToken: { token: string; expiresAt: number } | null = null;

function getMsalClient() {
  const { AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET } = process.env;
  if (!AZURE_TENANT_ID || !AZURE_CLIENT_ID || !AZURE_CLIENT_SECRET) {
    throw new Error("Missing Azure AD app credentials in environment variables.");
  }
  return new ConfidentialClientApplication({
    auth: {
      clientId: AZURE_CLIENT_ID,
      authority: `https://login.microsoftonline.com/${AZURE_TENANT_ID}`,
      clientSecret: AZURE_CLIENT_SECRET,
    },
  });
}

export async function getGraphToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.token;
  }
  const app = getMsalClient();
  const result = await app.acquireTokenByClientCredential({
    scopes: ["https://graph.microsoft.com/.default"],
  });
  if (!result?.accessToken) throw new Error("Failed to acquire Graph token.");

  cachedToken = {
    token: result.accessToken,
    // expiresOn is a Date; fall back to 55 minutes if missing.
    expiresAt: result.expiresOn ? result.expiresOn.getTime() - 60_000 : Date.now() + 55 * 60_000,
  };
  return result.accessToken;
}
