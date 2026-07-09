import { NextRequest, NextResponse } from "next/server";
import { ConfidentialClientApplication } from "@azure/msal-node";

// ---- Required environment variables (see .env.example) -------------------
// AZURE_TENANT_ID        Entra ID tenant that owns the SharePoint site
// AZURE_CLIENT_ID        App registration (client) ID
// AZURE_CLIENT_SECRET    App registration client secret
// SHAREPOINT_SITE_ID     e.g. "contoso.sharepoint.com,<site-guid>,<web-guid>"
// SHAREPOINT_LIST_ID     GUID of the target list (Water_Request)
// ---------------------------------------------------------------------------

export const dynamic = "force-dynamic";

type RequestBody = {
  fullName: string;
  applicantType?: string;
  nationalId: string;
  phone: string;
  email?: string;
  lineId?: string;
  province: string;
  district: string;
  subdistrict: string;
  branch: string;
  addressDetail?: string;
  installationType?: string;
  meterSize?: string;
  nearbyPlace?: string;
  customerType?: string;
  documents?: string[];
  latitude: number;
  longitude: number;
  lineUserId?: string;
  lineDisplayName?: string;
};

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

async function getGraphToken(): Promise<string> {
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

// Bangkok is UTC+7 year-round (no DST), so a fixed offset is fine here.
function getBangkokDateStamp(d = new Date()): string {
  const bangkok = new Date(d.getTime() + 7 * 60 * 60 * 1000);
  const yyyy = bangkok.getUTCFullYear();
  const mm = String(bangkok.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(bangkok.getUTCDate()).padStart(2, "0");
  return `${yyyy}${mm}${dd}`;
}

// Builds the next request number for today, e.g. "RE20260709-001".
// Counts how many requests already carry today's prefix, then adds one.
async function getNextRequestNo(
  token: string,
  siteId: string,
  listId: string
): Promise<string> {
  const prefix = `RE${getBangkokDateStamp()}`;
  const url =
    `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${listId}/items` +
    `?$expand=fields($select=RequestNo)&$filter=startswith(fields/RequestNo,'${prefix}')&$top=999`;

  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Prefer: "HonorNonIndexedQueriesWarningMayFailRandomly",
      },
    });
    if (!res.ok) {
      console.error("getNextRequestNo lookup failed:", res.status, await res.text());
      return `${prefix}-001`;
    }
    const data = await res.json();
    const count = (data.value ?? []).length;
    return `${prefix}-${String(count + 1).padStart(3, "0")}`;
  } catch (err) {
    console.error("getNextRequestNo error:", err);
    return `${prefix}-001`;
  }
}

function validate(body: Partial<RequestBody>): string | null {
  if (!body.fullName?.trim()) return "กรุณาระบุชื่อ-นามสกุล";
  if (!body.nationalId || body.nationalId.length !== 13) return "เลขบัตรประชาชนไม่ถูกต้อง";
  if (!body.phone?.trim()) return "กรุณาระบุเบอร์โทรศัพท์";
  if (!body.province || !body.district || !body.subdistrict) return "กรุณาเลือกที่อยู่ให้ครบถ้วน";
  if (!body.branch) return "กรุณาเลือก กปภ.สาขา";
  if (typeof body.latitude !== "number" || typeof body.longitude !== "number") {
    return "กรุณากำหนดตำแหน่งบนแผนที่";
  }
  return null;
}

export async function POST(req: NextRequest) {
  let body: Partial<RequestBody>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "รูปแบบข้อมูลไม่ถูกต้อง" }, { status: 400 });
  }

  const validationError = validate(body);
  if (validationError) {
    return NextResponse.json({ message: validationError }, { status: 400 });
  }

  const { SHAREPOINT_SITE_ID, SHAREPOINT_LIST_ID } = process.env;
  if (!SHAREPOINT_SITE_ID || !SHAREPOINT_LIST_ID) {
    return NextResponse.json(
      { message: "ยังไม่ได้ตั้งค่าการเชื่อมต่อ SharePoint บนเซิร์ฟเวอร์ (ดู .env.example)" },
      { status: 500 }
    );
  }

  try {
    const token = await getGraphToken();
    const requestNo = await getNextRequestNo(token, SHAREPOINT_SITE_ID, SHAREPOINT_LIST_ID);

    const graphRes = await fetch(
      `https://graph.microsoft.com/v1.0/sites/${SHAREPOINT_SITE_ID}/lists/${SHAREPOINT_LIST_ID}/items`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        // Field internal names must match the SharePoint list's column names exactly
        // (see the column list created in the SharePoint setup step).
        body: JSON.stringify({
          fields: {
            Title: requestNo,
            RequestNo: requestNo,
            FullName: body.fullName,
            ApplicantType: body.applicantType ?? "",
            NationalId: body.nationalId,
            Phone: body.phone,
            Email: body.email ?? "",
            LineId: body.lineId ?? "",
            Province: body.province,
            District: body.district,
            Subdistrict: body.subdistrict,
            Branch: body.branch,
            AddressDetail: body.addressDetail ?? "",
            InstallationType: body.installationType ?? "",
            MeterSize: body.meterSize ?? "",
            NearbyPlace: body.nearbyPlace ?? "",
            CustomerType: body.customerType ?? "",
            Documents: (body.documents ?? []).join(", "),
            Latitude: body.latitude,
            Longitude: body.longitude,
            LineUserId: body.lineUserId ?? "",
            LineDisplayName: body.lineDisplayName ?? "",
            SubmittedAt: new Date().toISOString(),
            Status: "New",
          },
        }),
      }
    );

    if (!graphRes.ok) {
      const errBody = await graphRes.text();
      console.error("Graph API error:", graphRes.status, errBody);
      return NextResponse.json(
        { message: "บันทึกข้อมูลลง SharePoint ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง" },
        { status: 502 }
      );
    }

    const created = await graphRes.json();
    return NextResponse.json({ id: created.id, requestNo }, { status: 201 });
  } catch (err) {
    console.error("submit-request error:", err);
    return NextResponse.json(
      { message: "เกิดข้อผิดพลาดบนเซิร์ฟเวอร์ กรุณาลองใหม่อีกครั้ง" },
      { status: 500 }
    );
  }
}
