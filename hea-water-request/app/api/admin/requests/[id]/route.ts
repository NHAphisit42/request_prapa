import { NextRequest, NextResponse } from "next/server";
import { getGraphToken } from "@/lib/graph-auth";
import { isAdminLineUser } from "@/lib/admin-role";
import { STATUS_OPTIONS } from "@/lib/request-status";

// Updates the status of one request. Body: { lineUserId, status }

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  let body: { lineUserId?: string; status?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "รูปแบบข้อมูลไม่ถูกต้อง" }, { status: 400 });
  }

  const { lineUserId, status } = body;
  if (!lineUserId) {
    return NextResponse.json({ message: "ไม่พบข้อมูลผู้ใช้ LINE" }, { status: 400 });
  }
  if (!status || !STATUS_OPTIONS.includes(status as (typeof STATUS_OPTIONS)[number])) {
    return NextResponse.json({ message: "สถานะไม่ถูกต้อง" }, { status: 400 });
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
      return NextResponse.json({ message: "ไม่มีสิทธิ์แก้ไขคำร้องนี้" }, { status: 403 });
    }

    const token = await getGraphToken();
    const graphRes = await fetch(
      `https://graph.microsoft.com/v1.0/sites/${SHAREPOINT_SITE_ID}/lists/${SHAREPOINT_LIST_ID}/items/${params.id}/fields`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ Status: status }),
      }
    );

    if (!graphRes.ok) {
      const errBody = await graphRes.text();
      console.error("Graph API error (admin/requests PATCH):", graphRes.status, errBody);
      return NextResponse.json(
        { message: "อัปเดตสถานะไม่สำเร็จ กรุณาลองใหม่อีกครั้ง" },
        { status: 502 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("admin/requests PATCH error:", err);
    return NextResponse.json(
      { message: "เกิดข้อผิดพลาดบนเซิร์ฟเวอร์ กรุณาลองใหม่อีกครั้ง" },
      { status: 500 }
    );
  }
}
