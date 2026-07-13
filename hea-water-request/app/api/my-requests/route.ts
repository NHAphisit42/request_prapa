import { NextRequest, NextResponse } from "next/server";
import { getGraphToken } from "@/lib/graph-auth";

// Returns the submitted water-service requests belonging to a given LINE user.
// Query string: /api/my-requests?lineUserId=<line user id>

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
    const token = await getGraphToken();

    // Filtering on a custom text column requires the column to be indexed in SharePoint,
    // otherwise large lists may reject the query. The "Prefer" header lets small/medium
    // lists through with a warning instead of a hard failure.
    const filterValue = lineUserId.replace(/'/g, "''"); // escape single quotes for OData
    const url =
      `https://graph.microsoft.com/v1.0/sites/${SHAREPOINT_SITE_ID}/lists/${SHAREPOINT_LIST_ID}/items` +
      `?$expand=fields&$filter=fields/LineUserId eq '${filterValue}'&$orderby=fields/SubmittedAt desc`;

    const graphRes = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Prefer: "HonorNonIndexedQueriesWarningMayFailRandomly",
      },
    });

    if (!graphRes.ok) {
      const errBody = await graphRes.text();
      console.error("Graph API error (my-requests):", graphRes.status, errBody);
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
      branch: (item.fields?.Branch as string) ?? "",
      customerType: (item.fields?.CustomerType as string) ?? "",
      installationType: (item.fields?.InstallationType as string) ?? "",
      status: (item.fields?.Status as string) ?? "New",
      submittedAt: (item.fields?.SubmittedAt as string) ?? item.createdDateTime,
    }));

    return NextResponse.json({ items });
  } catch (err) {
    console.error("my-requests error:", err);
    return NextResponse.json(
      { message: "เกิดข้อผิดพลาดบนเซิร์ฟเวอร์ กรุณาลองใหม่อีกครั้ง" },
      { status: 500 }
    );
  }
}
