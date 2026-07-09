"use client";

import { useEffect, useState } from "react";
import { getLiffProfile } from "@/lib/liff";

type RequestItem = {
  id: string;
  requestNo: string;
  fullName: string;
  branch: string;
  customerType: string;
  installationType: string;
  status: string;
  submittedAt: string;
};

const STATUS_LABEL_TH: Record<string, string> = {
  New: "รอดำเนินการ",
  "In Progress": "กำลังดำเนินการ",
  Completed: "เสร็จสมบูรณ์",
  Rejected: "ปฏิเสธ",
};

const STATUS_STYLES: Record<string, string> = {
  New: "bg-aqua/50 text-navy-deep",
  "In Progress": "bg-navy/10 text-navy",
  Completed: "bg-sage/50 text-sage-olive",
  Rejected: "bg-rose-100 text-rose-600",
};

type LoadState = "loading" | "ready" | "error";

export default function StatusPage() {
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [items, setItems] = useState<RequestItem[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    async function run() {
      try {
        const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
        if (!liffId) throw new Error("ยังไม่ได้ตั้งค่า LIFF ID (NEXT_PUBLIC_LIFF_ID)");

        const profile = await getLiffProfile(liffId);
        if (!profile) return; // liff.login() is redirecting the page

        setDisplayName(profile.displayName);

        const res = await fetch(`/api/my-requests?lineUserId=${encodeURIComponent(profile.userId)}`);
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.message ?? "โหลดข้อมูลไม่สำเร็จ");
        }
        const data = await res.json();
        setItems(data.items ?? []);
        setLoadState("ready");
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง");
        setLoadState("error");
      }
    }
    run();
  }, []);

  return (
    <main className="min-h-screen bg-offwhite px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-xl">
        <h1 className="font-display text-xl font-bold text-navy-deep">คำร้องของฉัน</h1>
        {displayName && (
          <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500">
            <span>💬</span> เข้าสู่ระบบด้วย LINE: {displayName}
          </p>
        )}

        {loadState === "loading" && (
          <p className="mt-8 text-center text-sm text-slate-400">กำลังโหลดข้อมูล…</p>
        )}

        {loadState === "error" && (
          <div className="mt-6 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-600">{errorMsg}</div>
        )}

        {loadState === "ready" && items.length === 0 && (
          <div className="mt-10 flex flex-col items-center gap-3 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-aqua/40 text-2xl">
              💧
            </div>
            <p className="text-sm text-slate-500">ยังไม่มีคำร้องที่ยื่นไว้</p>
          </div>
        )}

        {loadState === "ready" && items.length > 0 && (
          <div className="mt-6 space-y-3">
            {items.map((item) => (
              <div key={item.id} className="rounded-card border border-slate-200 bg-white p-4 shadow-soft">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    {item.requestNo && (
                      <p className="font-display text-xs font-semibold tracking-wide text-navy/70">
                        {item.requestNo}
                      </p>
                    )}
                    <p className="font-medium text-navy-deep">{item.fullName}</p>
                  </div>
                  <span
                    className={`shrink-0 rounded-pill px-3 py-1 text-xs font-semibold ${
                      STATUS_STYLES[item.status] ?? "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {STATUS_LABEL_TH[item.status] ?? item.status}
                  </span>
                </div>
                <p className="mt-1.5 text-xs text-slate-500">
                  {item.branch}
                  {item.customerType ? ` · ${item.customerType}` : ""}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  ยื่นเมื่อ{" "}
                  {new Date(item.submittedAt).toLocaleDateString("th-TH", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
