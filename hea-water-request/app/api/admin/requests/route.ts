import { NextRequest, NextResponse } from "next/server";
import { getGraphToken } from "@/lib/graph-auth";
import { isAdminLineUser } from "@/lib/admin-role";

// Returns every submitted water-service request, for staff listed in the AdminRoles list.
// Query string: /api/admin/requests?lineUserId=<line user id of the caller>
// Search/filter (by name, status, etc.) is done client-side on the returned list —
// request volume for a single branch doesn't warrant server-side paging yet.

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const lineUserId = req.nextUrl.searchParams.get("lineUserId");
  if (!lineUserId) {
    return NextResponse.json({ message: "ไม่พบข้อมูลผู้ใช้ LINE" }, { status: 400 });
  }

  const { SHAREPOINT_SITE_ID, SHAREPOINT_LIST_ID } = process.env;
  if (!SHAREPOINT_SITE_ID || !SHAREPOINT_LIST_ID) {
    return NextResponse.json(
      { message: "ยังไม่ได้ตั้งค่าการเชื่อมต่อ SharePoint บนเซิร์ฟเวอร์" },
      { status: 500 }
    );
  }

  try {
    if (!(await isAdminLineUser(lineUserId))) {
      return NextResponse.json({ message: "ไม่มีสิทธิ์เข้าถึงหน้านี้" }, { status: 403 });
    }

    const token = await getGraphToken();
    const url =
      `https://graph.microsoft.com/v1.0/sites/${SHAREPOINT_SITE_ID}/lists/${SHAREPOINT_LIST_ID}/items` +
      `?$expand=fields&$orderby=fields/SubmittedAt desc&$top=999`;

    const graphRes = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Prefer: "HonorNonIndexedQueriesWarningMayFailRandomly",
      },
    });

    if (!graphRes.ok) {
      const errBody = await graphRes.text();
      console.error("Graph API error (admin/requests):", graphRes.status, errBody);
      return NextResponse.json(
        { message: "ดึงข้อมูลคำร้องไม่สำเร็จ กรุณาลองใหม่อีกครั้ง" },
        { status: 502 }
      );
    }

    const data = await graphRes.json();
    const items = (data.value ?? []).map((item: { id: string; createdDateTime: string; fields?: Record<string, unknown> }) => ({
      id: item.id,
      requestNo: (item.fields?.RequestNo as string) ?? "",
      fullName: (item.fields?.FullName as string) ?? (item.fields?.Title as string) ?? "",
      applicantType: (item.fields?.ApplicantType as string) ?? "",
      nationalId: (item.fields?.NationalId as string) ?? "",
      phone: (item.fields?.Phone as string) ?? "",
      email: (item.fields?.Email as string) ?? "",
      district: (item.fields?.District as string) ?? "",
      subdistrict: (item.fields?.Subdistrict as string) ?? "",
      addressDetail: (item.fields?.AddressDetail as string) ?? "",
      installationType: (item.fields?.InstallationType as string) ?? "",
      meterSize: (item.fields?.MeterSize as string) ?? "",
      customerType: (item.fields?.CustomerType as string) ?? "",
      documents: (item.fields?.Documents as string) ?? "",
      attachmentUrls: ((item.fields?.AttachmentUrls as string) ?? "")
        .split("\n")
        .map((u) => u.trim())
        .filter(Boolean),
      latitude: item.fields?.Latitude as number | undefined,
      longitude: item.fields?.Longitude as number | undefined,
      status: (item.fields?.Status as string) ?? "New",
      submittedAt: (item.fields?.SubmittedAt as string) ?? item.createdDateTime,
    }));

    return NextResponse.json({ items });
  } catch (err) {
    console.error("admin/requests error:", err);
    return NextResponse.json(
      { message: "เกิดข้อผิดพลาดบนเซิร์ฟเวอร์ กรุณาลองใหม่อีกครั้ง" },
      { status: 500 }
    );
  }
}
