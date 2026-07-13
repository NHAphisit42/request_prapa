import { NextRequest, NextResponse } from "next/server";
import { getGraphToken } from "@/lib/graph-auth";
import { isValidThaiNationalId } from "@/lib/national-id";

const MAX_FILES = 10;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB — well under Graph's 250MB simple-upload ceiling

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
  // Juristic registration numbers use a different checksum than personal national IDs,
  // so only enforce the mod-11 check for individual applicants.
  if (body.applicantType === "juristic") {
    if (!/^\d{13}$/.test(body.nationalId ?? "")) return "เลขนิติบุคคลไม่ถูกต้อง";
  } else if (!isValidThaiNationalId(body.nationalId ?? "")) {
    return "เลขบัตรประชาชนไม่ถูกต้อง";
  }
  if (!body.phone?.trim()) return "กรุณาระบุเบอร์โทรศัพท์";
  if (!body.province || !body.district || !body.subdistrict) return "กรุณาเลือกที่อยู่ให้ครบถ้วน";
  if (!body.branch) return "กรุณาเลือก กปภ.สาขา";
  if (typeof body.latitude !== "number" || typeof body.longitude !== "number") {
    return "กรุณากำหนดตำแหน่งบนแผนที่";
  }
  return null;
}

// SharePoint/OneDrive item names can't contain these characters.
function sanitizeFileName(name: string): string {
  return name.replace(/[~"#%&*:<>?/\\{|}]/g, "_").slice(0, 180) || "file";
}

// Uploads one file into a per-request folder in the site's default document library
// and returns its webUrl, to be saved on the list item as a plain-text link.
async function uploadAttachment(
  token: string,
  siteId: string,
  requestNo: string,
  file: File
): Promise<string> {
  const path = `WaterRequests/${requestNo}/${sanitizeFileName(file.name)}`;
  const res = await fetch(
    `https://graph.microsoft.com/v1.0/sites/${siteId}/drive/root:/${encodeURI(path)}:/content`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": file.type || "application/octet-stream",
      },
      body: await file.arrayBuffer(),
    }
  );
  if (!res.ok) {
    console.error("uploadAttachment failed:", file.name, res.status, await res.text());
    throw new Error(`อัปโหลดไฟล์ "${file.name}" ไม่สำเร็จ`);
  }
  const data = await res.json();
  return data.webUrl as string;
}

export async function POST(req: NextRequest) {
  let body: Partial<RequestBody>;
  let files: File[] = [];
  try {
    const formData = await req.formData();
    const payloadRaw = formData.get("payload");
    if (typeof payloadRaw !== "string") throw new Error("missing payload");
    body = JSON.parse(payloadRaw);
    files = formData.getAll("files").filter((f): f is File => f instanceof File);
  } catch {
    return NextResponse.json({ message: "รูปแบบข้อมูลไม่ถูกต้อง" }, { status: 400 });
  }

  const validationError = validate(body);
  if (validationError) {
    return NextResponse.json({ message: validationError }, { status: 400 });
  }

  if (files.length > MAX_FILES) {
    return NextResponse.json({ message: `แนบไฟล์ได้ไม่เกิน ${MAX_FILES} ไฟล์` }, { status: 400 });
  }
  const oversized = files.find((f) => f.size > MAX_FILE_SIZE);
  if (oversized) {
    return NextResponse.json(
      { message: `ไฟล์ "${oversized.name}" มีขนาดเกิน 10MB` },
      { status: 400 }
    );
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

    let attachmentUrls: string[] = [];
    if (files.length > 0) {
      try {
        attachmentUrls = await Promise.all(
          files.map((f) => uploadAttachment(token, SHAREPOINT_SITE_ID, requestNo, f))
        );
      } catch (err) {
        console.error("attachment upload error:", err);
        return NextResponse.json(
          { message: err instanceof Error ? err.message : "อัปโหลดไฟล์แนบไม่สำเร็จ" },
          { status: 502 }
        );
      }
    }

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
            AttachmentUrls: attachmentUrls.join("\n"),
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
