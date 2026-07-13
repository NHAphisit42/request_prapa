import { getGraphToken } from "@/lib/graph-auth";

// Checks the "AdminRoles" SharePoint list (columns: LineUserId, Title) for a row
// matching the given LINE userId. Anyone whose userId is listed there can access
// the /admin request-management screen.
export async function isAdminLineUser(lineUserId: string): Promise<boolean> {
  if (!lineUserId) return false;

  const { SHAREPOINT_SITE_ID, SHAREPOINT_ADMIN_LIST_ID } = process.env;
  if (!SHAREPOINT_SITE_ID || !SHAREPOINT_ADMIN_LIST_ID) {
    throw new Error("Missing SHAREPOINT_ADMIN_LIST_ID (or SHAREPOINT_SITE_ID) in environment variables.");
  }

  const token = await getGraphToken();
  const filterValue = lineUserId.replace(/'/g, "''"); // escape single quotes for OData
  const url =
    `https://graph.microsoft.com/v1.0/sites/${SHAREPOINT_SITE_ID}/lists/${SHAREPOINT_ADMIN_LIST_ID}/items` +
    `?$expand=fields($select=LineUserId)&$filter=fields/LineUserId eq '${filterValue}'&$top=1`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Prefer: "HonorNonIndexedQueriesWarningMayFailRandomly",
    },
  });
  if (!res.ok) {
    console.error("isAdminLineUser lookup failed:", res.status, await res.text());
    return false;
  }
  const data = await res.json();
  return (data.value ?? []).length > 0;
}
