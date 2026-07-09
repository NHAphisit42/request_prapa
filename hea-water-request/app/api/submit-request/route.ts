import { NextRequest, NextResponse } from "next/server";
import { ConfidentialClientApplication } from "@azure/msal-node";

// ---- Required environment variables (see .env.example) -------------------
// AZURE_TENANT_ID        Entra ID tenant that owns the SharePoint site
// AZURE_CLIENT_ID         App registration (client) ID
// AZURE_CLIENT_SECRET     App registration client secret
// SHAREPOINT_SITE_ID      e.g. "contoso.sharepoint.com,<site-guid>,<web-guid>"
// SHAREPOINT_LIST_ID      GUID or name of the target list, e.g. "WaterRequests"
// ---------------------------------------------------------------------------

type RequestBody = {
  fullName: string;
  nationalId: string;
  phone: string;
  email?: string;
  province: string;
  district: string;
  subdistrict: string;
  branch: string;
  addressDetail?: string;
  latitude: number;
  longitude: number;
};

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
  const app = getMsalClient();
  const result = await app.acquireTokenByClientCredential({
    scopes: ["https://graph.microsoft.com/.default"],
  });
  if (!result?.accessToken) throw new Error("Failed to acquire Graph token.");
  return result.accessToken;
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

    const graphRes = await fetch(
      `https://graph.microsoft.com/v1.0/sites/${SHAREPOINT_SITE_ID}/lists/${SHAREPOINT_LIST_ID}/items`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        // Field internal names must match the SharePoint list's column names exactly.
        body: JSON.stringify({
          fields: {
            Title: body.fullName,
            NationalID: body.nationalId,
            Phone: body.phone,
            Email: body.email ?? "",
            Province: body.province,
            District: body.district,
            Subdistrict: body.subdistrict,
            PWABranch: body.branch,
            AddressDetail: body.addressDetail ?? "",
            Latitude: body.latitude,
            Longitude: body.longitude,
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
    return NextResponse.json({ id: created.id }, { status: 201 });
  } catch (err) {
    console.error("submit-request error:", err);
    return NextResponse.json(
      { message: "เกิดข้อผิดพลาดบนเซิร์ฟเวอร์ กรุณาลองใหม่อีกครั้ง" },
      { status: 500 }
    );
  }
}
